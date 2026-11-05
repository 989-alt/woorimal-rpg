import { test } from 'node:test';
import assert from 'node:assert/strict';
import ACT from '../data/acts/act1.js';
import { parseMap } from '../js/explore/grid.js';
import { ACTS } from '../data/acts/index.js';
import {
  newGame, chapterOf, chapterWords, actWords, acquireWords, takeWords, acquiredCount,
  fogOpen, chapterComplete, enterNextChapter, finishAct, setPos, markTip, extractWords, wordMark,
  exitOpen, exitBlockedText, bossGone, enterNextAct, nextChapterOf, fastForward,
  afterBossKey, afterBossDue, markSceneSeen, stepOffOpenExit, startIntro, introDue, finishIntro,
} from '../js/rules/game.js';
import { isWalkable } from '../js/explore/grid.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};
const start = (id) => parseMap(chapterOf(ACT, id).map.rows).start;
const fresh = () => newGame({ nickname: '하늘', avatar: 'f' });

test('새 게임: 1-1 시작 칸, q1만 open', () => {
  const s = fresh();
  assert.equal(s.version, 1);
  assert.equal(s.chapter, '1-1');
  assert.deepEqual(s.pos, start('1-1'));
  assert.equal(s.facing, 'down');
  assert.equal(Object.keys(s.quests).length, 20);
  assert.equal(s.quests.q1.stage, 'open');
  for (let i = 2; i <= 20; i++) assert.equal(s.quests[`q${i}`].stage, 'locked');
  assert.deepEqual(s.quests.q1.gathered, []);
  assert.deepEqual(s.askedWordIds, []);
});

test('낱말 습득은 한 번만 센다', () => {
  const ch = chapterOf(ACT, '1-1');
  const a = acquireWords(fresh(), ['어스름'], 'dodam');
  const b = acquireWords(a, ['어스름', '아침나절'], 'other');
  assert.equal(acquiredCount(a, ch), 1);
  assert.equal(acquiredCount(b, ch), 2);
  assert.deepEqual(b.acquired['어스름'], { from: 'dodam' });
});

test('낱말 목록: 장 5개, 막 10개', () => {
  assert.equal(chapterWords(chapterOf(ACT, '1-1')).length, 5);
  assert.deepEqual(chapterWords(chapterOf(ACT, '1-1')), ['어스름', '아침나절', '매무새', '손사래', '오롯이']);
  assert.equal(new Set(actWords(ACT)).size, 10);
  assert.throws(() => chapterOf(ACT, '9-9'));
});

test('앞 장 5개를 다 모으면 장 완료, 다음 장으로 가면 1-2 시작 칸과 q3 open', () => {
  const ch = chapterOf(ACT, '1-1');
  let s = acquireWords(fresh(), chapterWords(ch).slice(0, 4), 'x');
  assert.equal(chapterComplete(s, ch), false);
  s = acquireWords(s, chapterWords(ch), 'x');
  assert.equal(chapterComplete(s, ch), true);
  const n = enterNextChapter(s, ACT);
  assert.equal(n.chapter, '1-2');
  assert.deepEqual(n.pos, start('1-2'));
  assert.equal(n.facing, 'down');
  assert.deepEqual(n.clearedChapters, ['1-1']);
  assert.equal(n.quests.q3.stage, 'open');
  assert.equal(n.quests.q4.stage, 'locked');
  assert.throws(() => enterNextChapter(n, ACT));
});

test('뒷 장 5개를 다 모으면 안개가 열린다', () => {
  const ch = chapterOf(ACT, '1-2');
  let s = acquireWords(fresh(), chapterWords(ch).slice(0, 4), 'x');
  assert.equal(fogOpen(s, ch), false);
  s = acquireWords(s, chapterWords(ch), 'x');
  assert.equal(fogOpen(s, ch), true);
});

test('보스전 출제 기록은 finishAct에서만 남는다 (전투 중 새로 고침 대비)', () => {
  let s = acquireWords(fresh(), actWords(ACT), 'x');
  assert.deepEqual(s.askedWordIds, []);
  s = { ...s, chapter: '1-2' };
  const ids = actWords(ACT);
  const f = finishAct(s, ACT, [...ids, ids[0]]);
  assert.equal(f.askedWordIds.length, 10);
  assert.deepEqual(f.askedWordIds, ids);
  assert.ok(f.clearedChapters.includes('1-2'));
  assert.deepEqual(f.clearedActs, [1]);
  const g = finishAct(f, ACT, ids);
  assert.equal(g.askedWordIds.length, 10);
  assert.deepEqual(g.clearedActs, [1]);
});

test('wordMark·extractWords: [[id|꼴]]은 id로 센다', () => {
  assert.deepEqual(wordMark('살갑다|살갑구나'), { id: '살갑다', form: '살갑구나' });
  assert.deepEqual(wordMark('윤슬'), { id: '윤슬', form: '윤슬' });
  assert.deepEqual(extractWords('넌 참 [[살갑다|살갑구나]], [[서름하다|서름해]].'), ['살갑다', '서름하다']);
});

test('setPos, markTip, extractWords', () => {
  const s = setPos(fresh(), { x: 3, y: 4 }, 'left');
  assert.deepEqual(s.pos, { x: 3, y: 4 });
  assert.equal(s.facing, 'left');
  const t = markTip(markTip(s, 'move'), 'move');
  assert.deepEqual(t.seenTips, ['move']);
  assert.deepEqual(extractWords('깨진 것 하나 없이 [[오롯이]] 남고 [[짬]]도'), ['오롯이', '짬']);
  assert.deepEqual(extractWords('없음'), []);
});

test('상태 함수는 원래 상태를 바꾸지 않는다', () => {
  const ch = chapterOf(ACT, '1-1');
  const s = deepFreeze(acquireWords(fresh(), chapterWords(ch), 'x'));
  const act = deepFreeze(structuredClone(ACT));
  assert.doesNotThrow(() => {
    acquireWords(s, ['부리나케'], 'y');
    setPos(s, { x: 1, y: 1 }, 'up');
    markTip(s, 't');
    const n = enterNextChapter(s, act);
    finishAct(deepFreeze(n), act, actWords(act));
    acquiredCount(s, ch); fogOpen(s, ch); chapterComplete(s, ch);
  });
});

test('takeWords: 대화 전에 한꺼번에 얻고, 이번에 새로 얻은 낱말만 fresh로 돌려준다', () => {
  const s0 = deepFreeze(acquireWords(fresh(), ['어스름'], '앞'));
  const r = takeWords(s0, ['어스름', '아침나절', '아침나절'], '도담 할머니');
  assert.deepEqual(r.fresh, ['아침나절']);
  assert.deepEqual(r.state.acquired, { 어스름: { from: '앞' }, 아침나절: { from: '도담 할머니' } });
  const none = takeWords(s0, [], 'x');
  assert.equal(none.state, s0);
  assert.deepEqual(none.fresh, []);
});

// ── 출구: 직접 걸어서 나가는 길 ──
test('새 게임에는 알려 준 숨은 낱말 목록(revealed)이 빈 채로 있다', () => {
  assert.deepEqual(fresh().revealed, {});
});

test('exitOpen: 앞 장은 낱말을 다 모았을 때, 뒷 장은 막 보스를 이긴 뒤에만 열린다', () => {
  const ch1 = chapterOf(ACT, '1-1');
  const ch2 = chapterOf(ACT, '1-2');
  let s = acquireWords(fresh(), chapterWords(ch1).slice(0, 4), 'x');
  assert.equal(exitOpen(s, ch1), false);
  s = acquireWords(s, chapterWords(ch1), 'x');
  assert.equal(exitOpen(s, ch1), true);
  // 뒷 장: 낱말을 다 모아도 보스를 이기기 전에는 닫혀 있다
  const t = { ...acquireWords(fresh(), chapterWords(ch2), 'x'), chapter: '1-2' };
  assert.equal(exitOpen(t, ch2), false);
  assert.equal(exitOpen({ ...t, clearedActs: [1] }, ch2), true);
  // 옛 저장: 필드가 없어도 낱말·막 기록만으로 같은 답
  const { revealed, ...old } = s;
  assert.equal(exitOpen(old, ch1), true);
  // 출구가 없는 장은 열 수 없다
  const bare = { ...ch1 };
  delete bare.exit;
  assert.equal(exitOpen(s, bare), false);
});

test('stepOffOpenExit: 열린 출구 칸이면 안쪽으로 한 칸 물러서 출구를 보고, 아니면 그대로', () => {
  const ch1 = chapterOf(ACT, '1-1');
  const e = ch1.exit;
  const open = deepFreeze({ ...acquireWords(fresh(), chapterWords(ch1), 'x'), pos: { x: e.x, y: e.y }, facing: 'up' });
  const off = stepOffOpenExit(open, ch1);
  assert.deepEqual(off.pos, { x: e.x, y: e.y + 1 });
  assert.equal(off.facing, e.dir);
  // 닫힌 출구 칸·출구가 아닌 칸은 그대로(같은 상태)
  const closed = { ...fresh(), pos: { x: e.x, y: e.y } };
  assert.equal(stepOffOpenExit(closed, ch1), closed);
  const elsewhere = { ...open, pos: { x: e.x, y: e.y + 2 } };
  assert.equal(stepOffOpenExit(elsewhere, ch1), elsewhere);
});

test('모든 장: 출구 안쪽 한 칸은 걸을 수 있는 칸이고, 거기서 출구 쪽으로 한 걸음이면 출구다', () => {
  const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const act of ACTS) {
    for (const ch of act.chapters) {
      const s = { ...fastForward(fresh(), ch.id), clearedActs: ACTS.map((a) => a.id), pos: { x: ch.exit.x, y: ch.exit.y } };
      const all = acquireWords(s, actWords(act), 'x');
      const off = stepOffOpenExit(all, ch);
      assert.notDeepEqual(off.pos, all.pos, `${ch.id} 출구가 열려 있어야 한다`);
      const map = parseMap(ch.map.rows);
      assert.ok(isWalkable(map, off.pos.x, off.pos.y, { fogOpen: true, smallMonsterGone: true, bossGone: true }), `${ch.id} ${JSON.stringify(off.pos)}`);
      const [dx, dy] = STEP[off.facing];
      assert.deepEqual({ x: off.pos.x + dx, y: off.pos.y + dy }, { x: ch.exit.x, y: ch.exit.y }, ch.id);
    }
  }
});

test('exitBlockedText: 앞 장은 남은 낱말 수, 뒷 장은 그림자 글, 열렸으면 null', () => {
  const ch1 = chapterOf(ACT, '1-1');
  const ch2 = chapterOf(ACT, '1-2');
  const s = acquireWords(fresh(), chapterWords(ch1).slice(0, 3), 'x');
  assert.equal(exitBlockedText(s, ch1), '아직 찾지 못한 낱말이 2개 있어.');
  assert.equal(exitBlockedText(acquireWords(fresh(), chapterWords(ch1), 'x'), ch1), null);
  const t = { ...fresh(), chapter: '1-2' };
  assert.equal(exitBlockedText(t, ch2), ch2.exit.closed);
  assert.equal(exitBlockedText({ ...t, clearedActs: [1] }, ch2), null);
});

test('bossGone: 막을 마치면 보스는 사라진다', () => {
  const ch2 = chapterOf(ACT, '1-2');
  assert.equal(bossGone(fresh(), ch2), false);
  assert.equal(bossGone({ ...fresh(), clearedActs: [1] }, ch2), true);
  const { clearedActs, ...old } = fresh();
  assert.equal(bossGone(old, ch2), false);
});

test('newGame: 1-1에서 q1만 open, q2~q20은 locked, seenScenes 빈 배열', () => {
  const s = newGame({ nickname: '하늘', avatar: 'f' });
  assert.equal(Object.keys(s.quests).length, 20);
  assert.equal(s.quests.q1.stage, 'open');
  assert.equal(s.quests.q20.stage, 'locked');
  assert.deepEqual(s.seenScenes, []);
});

test('enterNextAct: 막을 마쳐야 넘어가고, 다음 막 첫 장 S에서 첫 부탁 open', () => {
  const at12 = fastForward(newGame({ nickname: '하늘', avatar: 'f' }), '1-2');
  assert.throws(() => enterNextAct(at12), /마치지/);
  const n = enterNextAct({ ...at12, clearedActs: [1] });
  assert.equal(n.act, 2); assert.equal(n.chapter, '2-1'); assert.equal(n.facing, 'down');
  assert.deepEqual(n.pos, parseMap(ACTS[1].chapters[0].map.rows).start);
  assert.equal(n.quests.q5.stage, 'open');
  assert.ok(n.clearedChapters.includes('1-2'));
  const D = { stage: 'done', gathered: [] };
  const old = { ...at12, clearedActs: [1], quests: { q1: D, q2: D, q3: D, q4: D } }; // 1막만 있던 옛 저장
  assert.equal(enterNextAct(old).quests.q5.stage, 'open');
  const end = { ...fastForward(at12, '5-2'), clearedActs: [1, 2, 3, 4, 5] };
  assert.throws(() => enterNextAct(end), /마지막/);
});

test('enterNextAct: 받은 상태를 바꾸지 않고, 이미 받은 부탁은 그대로 둔다', () => {
  const at12 = deepFreeze({ ...fastForward(newGame({ nickname: '하늘', avatar: 'f' }), '1-2'), clearedActs: [1] });
  const n = enterNextAct(at12);
  assert.notEqual(n, at12);
  const active = { ...at12, quests: { ...at12.quests, q5: { stage: 'active', gathered: [] } } };
  assert.equal(enterNextAct(active).quests.q5.stage, 'active');
});

test('nextChapterOf: 같은 막 다음 장, 막 끝이면 다음 막 첫 장, 끝이면 null', () => {
  assert.equal(nextChapterOf('2-1').id, '2-2');
  assert.equal(nextChapterOf('1-2').id, '2-1');
  assert.equal(nextChapterOf('5-2'), null);
});

test('fastForward 3-2: 1·2막과 3-1을 마친 상태, q11 open, 2-2 보스 뒤 장면은 본 것', () => {
  const s = fastForward(newGame({ nickname: '하늘', avatar: 'f' }), '3-2');
  assert.equal(s.act, 3); assert.equal(s.chapter, '3-2'); assert.deepEqual(s.clearedActs, [1, 2]);
  assert.equal(s.quests.q10.stage, 'done'); assert.equal(s.quests.q11.stage, 'open');
  assert.ok('함초롬하다' in s.acquired && !('윤슬' in s.acquired));
  assert.ok(s.seenScenes.includes('2-2:afterBoss'));
  assert.deepEqual(s.pos, parseMap(ACTS[2].chapters[1].map.rows).start);
  assert.deepEqual(s.bag, []);
  assert.equal(s.facing, 'down');
});

test('fastForward: 앞 장의 숨은 낱말·알려 주기·쫓기 기록, 앞 막의 출제 기록', () => {
  const s = fastForward(newGame({ nickname: '하늘', avatar: 'f' }), '2-2');
  assert.equal(s.hiddenFound['1-1'], true); assert.equal(s.hiddenFound['2-1'], true);
  assert.equal(s.revealed['1-2'], true); assert.equal(s.revealed['2-1'], true);
  assert.equal(s.smallGone['1-1'], true); assert.equal(s.smallGone['2-1'], undefined);
  assert.deepEqual(s.clearedChapters, ['1-1', '1-2', '2-1']);
  assert.deepEqual(s.clearedActs, [1]);
  assert.deepEqual(s.askedWordIds.sort(), [...actWords(ACT)].sort());
  assert.equal(s.quests.q5.stage, 'done'); assert.equal(s.quests.q7.stage, 'open');
  assert.equal(s.acquired['어스름'].from, '검사');
  assert.deepEqual(s.seenScenes, []); // 1막 뒷 장에는 보스 뒤 장면이 없다
  // 받은 상태를 바꾸지 않는다
  const base = deepFreeze(fresh());
  fastForward(base, '5-2');
});

test('막마다 뒷 장 출구는 보스를 이긴 뒤에만 열리고, 닫혔을 때 글은 그림자 글', () => {
  for (const act of ACTS.slice(1)) {
    const last = act.chapters[1];
    const s = fastForward(newGame({ nickname: '하늘', avatar: 'f' }), last.id);
    assert.equal(exitOpen(s, last), false, last.id);
    assert.equal(exitBlockedText(s, last), '길을 막은 그림자를 먼저 물리치자');
    assert.equal(exitOpen({ ...s, clearedActs: [...s.clearedActs, act.id] }, last), true, last.id);
  }
});

test('afterBossDue: 보스를 이기고 아직 안 봤을 때만, markSceneSeen 뒤에는 false', () => {
  const ch = ACTS[3].chapters[1];
  const s = fastForward(newGame({ nickname: '하늘', avatar: 'f' }), '4-2');
  assert.equal(afterBossKey(ch), '4-2:afterBoss');
  assert.equal(afterBossDue(s, ch), false);
  const won = { ...s, clearedActs: [...s.clearedActs, 4] };
  assert.equal(afterBossDue(won, ch), true);
  const seen = markSceneSeen(won, afterBossKey(ch));
  assert.equal(afterBossDue(seen, ch), false);
  assert.deepEqual(markSceneSeen(seen, '4-2:afterBoss').seenScenes, seen.seenScenes);
  const { seenScenes, ...old } = won; // 옛 상태
  assert.deepEqual(markSceneSeen(old, '4-2:afterBoss').seenScenes, ['4-2:afterBoss']);
  assert.equal(afterBossDue(old, ch), true); // seenScenes가 없으면 빈 것으로 본다
  assert.equal(afterBossDue({ ...won, chapter: '1-2' }, ACTS[0].chapters[1]), false); // 1막에는 afterBoss 없음
  assert.equal(afterBossDue(won, ACTS[3].chapters[0]), false); // 앞 장에는 afterBoss 없음
  // 받은 상태를 바꾸지 않는다
  const frozen = deepFreeze({ ...won });
  markSceneSeen(frozen, '4-2:afterBoss');
});

test('장 시작 이야기: startIntro로 표시하고 끝까지 보면 finishIntro로 지운다. 옛 상태(필드 없음)는 다 본 것으로 본다', () => {
  const s = newGame({ nickname: '하늘', avatar: 'f' });
  const ch = ACTS[0].chapters[0];
  assert.equal(introDue(s, ch), false, '새 게임 상태만으로는 이야기를 열지 않는다(여는 쪽이 표시한다)');
  const opened = startIntro(s);
  assert.equal(opened.introPending, '1-1');
  assert.equal(introDue(opened, ch), true);
  assert.equal(introDue(opened, ACTS[0].chapters[1]), false, '다른 장에서는 열지 않는다');
  const done = finishIntro(opened, '1-1');
  assert.equal(done.introPending, null);
  assert.equal(introDue(done, ch), false);
  assert.equal(finishIntro(opened, '1-2'), opened, '다른 장 id로는 지우지 않는다');
  const next = startIntro(enterNextChapter(done, ACTS[0]));
  assert.equal(next.introPending, '1-2');
  assert.equal(introDue(next, ACTS[0].chapters[1]), true);
  const frozen = Object.freeze({ ...opened });
  finishIntro(frozen, '1-1');
  startIntro(frozen);
});
