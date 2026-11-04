import { test } from 'node:test';
import assert from 'node:assert/strict';
import ACT from '../data/acts/act1.js';
import { parseMap } from '../js/explore/grid.js';
import {
  newGame, chapterOf, chapterWords, actWords, acquireWords, takeWords, acquiredCount,
  fogOpen, chapterComplete, enterNextChapter, finishAct, setPos, markTip, extractWords, wordMark,
  exitOpen, exitBlockedText, bossGone,
} from '../js/rules/game.js';

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
  assert.deepEqual(Object.keys(s.quests).sort(), ['q1', 'q2', 'q3', 'q4']);
  assert.equal(s.quests.q1.stage, 'open');
  for (const q of ['q2', 'q3', 'q4']) assert.equal(s.quests[q].stage, 'locked');
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
