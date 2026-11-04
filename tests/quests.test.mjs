import { test } from 'node:test';
import assert from 'node:assert/strict';
import ACT from '../data/acts/act1.js';
import { newGame, chapterOf, chapterWords, acquireWords } from '../js/rules/game.js';
import { ACTS, actOfChapter } from '../data/acts/index.js';
import {
  talkTo, inspect, winSmall, npcMarker, currentTask, hiddenGlow, questList,
  fightGate,
} from '../js/rules/quests.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};
const fresh = () => newGame({ nickname: '하늘', avatar: 'f' });
const ch1 = chapterOf(ACT, '1-1');
const ch2 = chapterOf(ACT, '1-2');
const wellSlot = '0';

// 1-1 부탁 2개(q1, q2)와 숨은 낱말 전까지 끝낸 상태
function afterQ1() {
  let s = fresh();
  ({ state: s } = talkTo(s, ch1, 'dodam'));
  ({ state: s } = inspect(s, ch1, wellSlot));
  ({ state: s } = talkTo(s, ch1, 'dodam'));
  return s;
}
function afterChapter1Quests() {
  let s = afterQ1();
  ({ state: s } = talkTo(s, ch1, 'daon'));
  s = winSmall(s, ch1);
  ({ state: s } = talkTo(s, ch1, 'daon'));
  return s;
}
// 1-2로 넘어간 상태
function inChapter2() {
  let s = afterChapter1Quests();
  ({ state: s } = inspect(s, ch1, '1'));
  s = acquireWords(s, chapterWords(ch1), 'x');
  return { ...s, chapter: '1-2', quests: { ...s.quests, q3: { stage: 'open', gathered: [] } } };
}

test('fetch: 받기 → 우물 조사 → 보고하면 낱말 2개, 다음 부탁 open', () => {
  let s = fresh();
  let r = talkTo(s, ch1, 'dodam');
  assert.equal(r.event, 'offer');
  assert.deepEqual(r.words, []);
  assert.ok(r.script.length > 0);
  s = r.state;
  assert.equal(s.quests.q1.stage, 'active');
  r = inspect(s, ch1, wellSlot);
  assert.equal(r.event, 'item');
  s = r.state;
  assert.equal(s.quests.q1.stage, 'ready');
  assert.deepEqual(s.bag, ['water']);
  assert.equal(talkTo({ ...s, quests: { ...s.quests, q1: { stage: 'active', gathered: [] } } }, ch1, 'dodam').event, 'waiting');
  const d = talkTo(s, ch1, 'dodam');
  assert.equal(d.event, 'done');
  assert.deepEqual(d.words, ['어스름', '아침나절']);
  assert.deepEqual(d.script, ch1.quests[0].done);
  assert.equal(d.state.quests.q1.stage, 'done');
  assert.deepEqual(d.state.bag, []);
  assert.equal(d.state.quests.q2.stage, 'open');
});

test('다음 장 부탁은 여기서 열지 않는다', () => {
  const s = afterChapter1Quests();
  assert.equal(s.quests.q2.stage, 'done');
  assert.equal(s.quests.q3.stage, 'locked');
});

test('부탁 전 조사·끝난 뒤 조사는 물건을 주지 않는다 (Review Focus 5)', () => {
  const s0 = fresh();
  let r = inspect(s0, ch1, wellSlot);
  assert.equal(r.event, 'nothing');
  assert.deepEqual(r.script, [{ who: 'narration', text: ch1.objects[0].text }]);
  assert.deepEqual(r.words, []);
  assert.deepEqual(r.state.bag, []);
  assert.equal(r.state.quests.q1.stage, 'open');
  // 받은 뒤 ready: 다시 조사해도 두 번째 물건 없음
  let s = talkTo(s0, ch1, 'dodam').state;
  s = inspect(s, ch1, wellSlot).state;
  r = inspect(s, ch1, wellSlot);
  assert.equal(r.event, 'nothing');
  assert.deepEqual(r.state.bag, ['water']);
  assert.equal(r.state.quests.q1.stage, 'ready');
  // 끝난 뒤
  s = talkTo(s, ch1, 'dodam').state;
  r = inspect(s, ch1, wellSlot);
  assert.equal(r.event, 'nothing');
  assert.deepEqual(r.state.bag, []);
  assert.equal(r.state.quests.q1.stage, 'done');
});

test('아직 열리지 않은 부탁의 대상은 조사해도 진행되지 않는다 (Review Focus 5)', () => {
  const s = inChapter2();
  const locked = { ...s, quests: { ...s.quests, q3: { stage: 'locked', gathered: [] } } };
  const r = inspect(locked, ch2, '0');
  assert.equal(r.event, 'nothing');
  assert.deepEqual(r.state.quests.q3, { stage: 'locked', gathered: [] });
  const open = inspect(s, ch2, '0');
  assert.equal(open.event, 'nothing');
  assert.deepEqual(open.state.quests.q3.gathered, []);
  assert.deepEqual(open.state.bag, []);
});

test('가방 3칸이 차면 bag-full, 부탁은 active 그대로 (Review Focus 5)', () => {
  let s = talkTo(fresh(), ch1, 'dodam').state;
  s = { ...s, bag: ['a', 'b', 'c'] };
  const r = inspect(s, ch1, wellSlot);
  assert.equal(r.event, 'bag-full');
  assert.deepEqual(r.script, [{ who: 'narration', text: '가방이 가득 찼어.' }]);
  assert.deepEqual(r.words, []);
  assert.deepEqual(r.state.bag, ['a', 'b', 'c']);
  assert.equal(r.state.quests.q1.stage, 'active');
});

test('gather: 같은 나무를 두 번 조사해도 한 번만 센다, 3곳이면 ready', () => {
  let s = inChapter2();
  s = talkTo(s, ch2, 'baker').state;
  assert.equal(s.quests.q3.stage, 'active');
  let r = inspect(s, ch2, '0');
  assert.equal(r.event, 'gathered');
  s = r.state;
  assert.deepEqual(s.quests.q3.gathered, ['0']);
  r = inspect(s, ch2, '0');
  assert.equal(r.event, 'nothing');
  assert.deepEqual(r.state.quests.q3.gathered, ['0']);
  s = inspect(r.state, ch2, '1').state;
  assert.equal(s.quests.q3.stage, 'active');
  assert.deepEqual(s.bag, []);
  r = inspect(s, ch2, '2');
  assert.equal(r.event, 'gathered');
  s = r.state;
  assert.equal(s.quests.q3.stage, 'ready');
  assert.deepEqual(s.bag, ['firewood']);
  const d = talkTo(s, ch2, 'baker');
  assert.equal(d.event, 'done');
  assert.deepEqual(d.words, ['부리나케', '짬']);
  assert.deepEqual(d.state.bag, []);
  assert.equal(d.state.quests.q3.stage, 'done');
  assert.equal(d.state.quests.q4.stage, 'open');
});

test('gather: 마지막 나무에서 가방이 꽉 차 있으면 bag-full, 세지 않는다', () => {
  let s = talkTo(inChapter2(), ch2, 'baker').state;
  s = inspect(inspect(s, ch2, '0').state, ch2, '1').state;
  const full = { ...s, bag: ['a', 'b', 'c'] };
  const r = inspect(full, ch2, '2');
  assert.equal(r.event, 'bag-full');
  assert.deepEqual(r.state.quests.q3.gathered, ['0', '1']);
  assert.equal(r.state.quests.q3.stage, 'active');
});

function readyForDeliver() {
  let s = inChapter2();
  s = talkTo(s, ch2, 'baker').state;
  for (const slot of ['0', '1', '2']) s = inspect(s, ch2, slot).state;
  return talkTo(s, ch2, 'baker').state;
}

test('deliver: 받으면 가방에 편지, 받는 인물에게 말 걸면 완료', () => {
  let s = readyForDeliver();
  assert.equal(s.quests.q4.stage, 'open');
  // 받기 전 받는 인물은 그냥 대화
  const pre = talkTo(s, ch2, 'gate');
  assert.equal(pre.event, 'chat');
  assert.deepEqual(pre.script, ch2.npcs[2].chat);
  assert.equal(pre.state.quests.q4.stage, 'open');
  let r = talkTo(s, ch2, 'laundry');
  assert.equal(r.event, 'offer');
  s = r.state;
  assert.equal(s.quests.q4.stage, 'active');
  assert.deepEqual(s.bag, ['letter']);
  assert.equal(talkTo(s, ch2, 'laundry').event, 'waiting');
  r = talkTo(s, ch2, 'gate');
  assert.equal(r.event, 'done');
  assert.deepEqual(r.script, ch2.quests[1].done);
  assert.deepEqual(r.words, ['곰비임비', '얼추']);
  assert.equal(r.state.quests.q4.stage, 'done');
  assert.deepEqual(r.state.bag, []);
  // 편지가 가방에 없으면 받는 인물은 완료시키지 않는다
  const lost = { ...s, bag: [] };
  assert.equal(talkTo(lost, ch2, 'gate').event, 'chat');
  assert.equal(talkTo(lost, ch2, 'gate').state.quests.q4.stage, 'active');
});

test('deliver: 편지가 가방에서 사라졌으면 맡긴 인물이 다시 준다(부탁이 끝날 수 있게)', () => {
  const s = talkTo(readyForDeliver(), ch2, 'laundry').state;
  const lost = deepFreeze({ ...s, bag: [] });
  const r = talkTo(lost, ch2, 'laundry');
  assert.equal(r.event, 'waiting');
  assert.deepEqual(r.state.bag, ['letter']);
  assert.equal(r.state.quests.q4.stage, 'active');
  assert.deepEqual(r.script.slice(0, ch2.quests[1].waiting.length), ch2.quests[1].waiting);
  assert.equal(r.script.at(-1).text, '편지를 다시 받아 가방에 넣었다.');
  assert.deepEqual(r.words, []);
  // 다시 받은 편지로 부탁을 끝낼 수 있다
  assert.equal(talkTo(r.state, ch2, 'gate').event, 'done');
  // 편지가 있으면 그냥 기다리는 말만, 가방은 그대로
  const again = talkTo(r.state, ch2, 'laundry');
  assert.deepEqual(again.script, ch2.quests[1].waiting);
  assert.deepEqual(again.state.bag, ['letter']);
  // 가방이 꽉 찼으면 다시 줄 수 없다는 안내만
  const full = { ...lost, bag: ['a', 'b', 'c'] };
  const f = talkTo(full, ch2, 'laundry');
  assert.deepEqual(f.state.bag, ['a', 'b', 'c']);
  assert.equal(f.script[0].text, '가방이 가득 찼어.');
});

test('chase: winSmall 뒤 보고하면 완료', () => {
  let s = afterQ1();
  assert.equal(talkTo(s, ch1, 'daon').event, 'offer');
  // 부탁 받기 전 winSmall은 아무것도 바꾸지 않는다
  assert.equal(winSmall(s, ch1), s);
  s = talkTo(s, ch1, 'daon').state;
  assert.equal(talkTo(s, ch1, 'daon').event, 'waiting');
  const w = winSmall(s, ch1);
  assert.equal(w.quests.q2.stage, 'ready');
  assert.deepEqual(w.smallGone, { '1-1': true });
  assert.equal(winSmall(w, ch1), w);
  const d = talkTo(w, ch1, 'daon');
  assert.equal(d.event, 'done');
  assert.deepEqual(d.words, ['매무새', '손사래']);
  assert.equal(d.state.quests.q2.stage, 'done');
  assert.deepEqual(d.state.bag, []);
});

test('숨은 낱말: 처음 조사만 낱말을 준다, 부탁 2개가 끝나면 bright', () => {
  // 첫 부탁을 받기 전에는 flavour만
  const s0 = fresh();
  assert.equal(hiddenGlow(s0, ch1), 'none');
  let r = inspect(s0, ch1, '1');
  assert.equal(r.event, 'nothing');
  assert.deepEqual(r.script, [{ who: 'narration', text: ch1.objects[1].text }]);
  assert.deepEqual(r.state.hiddenFound, {});
  // 받은 뒤에는 일찍 찾아도 된다
  const s1 = talkTo(s0, ch1, 'dodam').state;
  assert.equal(hiddenGlow(s1, ch1), 'dim');
  r = inspect(s1, ch1, '1');
  assert.equal(r.event, 'hidden');
  assert.deepEqual(r.words, ['오롯이']);
  assert.deepEqual(r.script, ch1.hidden.lines);
  assert.deepEqual(r.state.hiddenFound, { '1-1': true });
  assert.equal(hiddenGlow(r.state, ch1), 'none');
  // 두 번째는 flavour
  const again = inspect(r.state, ch1, '1');
  assert.equal(again.event, 'nothing');
  assert.deepEqual(again.words, []);
  // 부탁 2개가 끝나면 bright
  const s2 = afterChapter1Quests();
  assert.equal(hiddenGlow(s2, ch1), 'bright');
  const mid = afterQ1();
  assert.equal(hiddenGlow(mid, ch1), 'dim');
});

test('인물 표시: open → !, active → …, ready·받는 인물 → ?, 그 밖 null', () => {
  let s = fresh();
  assert.equal(npcMarker(s, ch1, 'dodam'), '!');
  assert.equal(npcMarker(s, ch1, 'daon'), null); // locked
  assert.equal(npcMarker(s, ch1, 'gardener'), null);
  s = talkTo(s, ch1, 'dodam').state;
  assert.equal(npcMarker(s, ch1, 'dodam'), '…');
  s = inspect(s, ch1, wellSlot).state;
  assert.equal(npcMarker(s, ch1, 'dodam'), '?');
  s = talkTo(s, ch1, 'dodam').state;
  assert.equal(npcMarker(s, ch1, 'dodam'), null);
  assert.equal(npcMarker(s, ch1, 'daon'), '!');
  // 전하기
  s = readyForDeliver();
  assert.equal(npcMarker(s, ch2, 'laundry'), '!');
  assert.equal(npcMarker(s, ch2, 'gate'), null);
  s = talkTo(s, ch2, 'laundry').state;
  assert.equal(npcMarker(s, ch2, 'laundry'), '…');
  assert.equal(npcMarker(s, ch2, 'gate'), '?');
  assert.equal(npcMarker({ ...s, bag: [] }, ch2, 'gate'), null);
});

test('currentTask 순서', () => {
  let s = fresh();
  assert.equal(currentTask(s, ch1), '우물에서 물 길어 오기');
  s = afterQ1();
  assert.equal(currentTask(s, ch1), '꼬마 안개 쫓아내기');
  s = afterChapter1Quests();
  assert.equal(currentTask(s, ch1), '숨은 낱말을 찾아라');
  s = inspect(s, ch1, '1').state;
  // 낱말이 아직 등록되기 전에는 다음 장 안내를 하지 않는다
  assert.equal(currentTask(s, ch1), '꼬마 안개 쫓아내기');
  s = acquireWords(s, chapterWords(ch1), 'x');
  assert.equal(currentTask(s, ch1), '다음 장으로');
  // 뒷 장
  let t = inChapter2();
  assert.equal(currentTask(t, ch2), '마른 나무에서 장작 모으기');
  t = readyForDeliver();
  assert.equal(currentTask(t, ch2), '할머니 편지 전하기');
  t = talkTo(talkTo(t, ch2, 'laundry').state, ch2, 'gate').state;
  assert.equal(currentTask(t, ch2), '숨은 낱말을 찾아라');
  t = inspect(t, ch2, '3').state;
  t = acquireWords(t, chapterWords(ch2), 'x');
  assert.equal(currentTask(t, ch2), '그림자를 물리쳐라');
  // 막을 마친 뒤
  assert.equal(currentTask({ ...t, clearedActs: [1] }, ch2), '1막을 마쳤어요');
});

test('questList', () => {
  const s = talkTo(fresh(), ch1, 'dodam').state;
  assert.deepEqual(questList(s, ch1), [
    { id: 'q1', title: '우물에서 물 길어 오기', stage: 'active' },
    { id: 'q2', title: '꼬마 안개 쫓아내기', stage: 'locked' },
  ]);
});

test('규칙 함수는 받은 상태를 바꾸지 않는다', () => {
  const s = deepFreeze(afterQ1());
  const act = deepFreeze(structuredClone(ACT));
  const c = act.chapters[0];
  assert.doesNotThrow(() => {
    talkTo(s, c, 'daon'); talkTo(s, c, 'dodam'); inspect(s, c, '1'); inspect(s, c, '0');
    winSmall(s, c); npcMarker(s, c, 'daon'); currentTask(s, c); hiddenGlow(s, c); questList(s, c);
  });
});

test('막은 넘겨 받은 장에서 찾는다 (1막 하드코딩 금지)', () => {
  assert.equal(actOfChapter('1-2'), ACT);
  assert.throws(() => actOfChapter('9-9'));
  // 시험용 2막: ACTS에 잠깐 넣었다가 빼낸다
  const rename = (c, id, prefix) => {
    const k = structuredClone(c);
    k.id = id;
    k.quests.forEach((q) => { q.id = prefix + q.id; });
    k.hidden.word = prefix + k.hidden.word;
    k.quests.forEach((q) => { q.words = q.words.map((w) => prefix + w); });
    return k;
  };
  const a = rename(ch1, '2-1', 'x');
  const b = rename(ch2, '2-2', 'y');
  const act2 = { id: 2, chapters: [a, b] };
  ACTS.push(act2);
  try {
    assert.equal(actOfChapter('2-2'), act2);
    const base = fresh(); // 1막 첫 부탁(q1)은 open
    const quests = { ...base.quests };
    for (const q of [...a.quests, ...b.quests]) quests[q.id] = { stage: 'locked', gathered: [] };
    quests.xq1 = { stage: 'open', gathered: [] };
    // 주머니: 2막 첫 부탁을 받기 전에는 숨은 낱말이 없다 (1막은 이미 받았어도)
    quests.q1 = { stage: 'done', gathered: [] };
    let s = { ...base, quests };
    assert.equal(hiddenGlow(s, a), 'none');
    assert.equal(inspect(s, a, '1').event, 'nothing');
    s = talkTo(s, a, 'dodam').state;
    assert.equal(s.quests.xq1.stage, 'active');
    assert.equal(hiddenGlow(s, a), 'dim');
    assert.equal(inspect(s, a, '1').event, 'hidden');
    // 2막의 마지막 장이므로 "그림자를 물리쳐라", 첫 장은 "다음 장으로"
    const done = (c, st) => {
      let t = { ...st, quests: { ...st.quests } };
      for (const q of c.quests) t.quests[q.id] = { stage: 'done', gathered: [] };
      t = { ...t, hiddenFound: { ...t.hiddenFound, [c.id]: true } };
      return acquireWords(t, chapterWords(c), 'x');
    };
    assert.equal(currentTask(done(a, s), a), '다음 장으로');
    assert.equal(currentTask(done(b, s), b), '그림자를 물리쳐라');
    // 낱말이 다 모이지 않았으면 안내하지 않는다
    const partial = { ...done(b, s), acquired: {} };
    assert.notEqual(currentTask(partial, b), '그림자를 물리쳐라');
  } finally {
    ACTS.pop();
  }
  assert.throws(() => actOfChapter('2-2'));
});

test('fightGate small: chase 부탁이 active일 때만 싸운다, 아니면 주는 인물 이름으로 안내', () => {
  const ch = ACT.chapters[0];
  let s = newGame({ nickname: '하늘', avatar: 'f' });
  const msg = '꼬마 안개가 길을 막고 있어. 다온에게 먼저 이야기해 보자.';
  assert.deepEqual(fightGate(s, ch, 'small'), { ok: false, message: msg }); // q2 locked
  s = { ...s, quests: { ...s.quests, q1: { stage: 'done', gathered: [] }, q2: { stage: 'open', gathered: [] } } };
  assert.deepEqual(fightGate(s, ch, 'small'), { ok: false, message: msg });
  s = { ...s, quests: { ...s.quests, q2: { stage: 'active', gathered: [] } } };
  assert.deepEqual(fightGate(s, ch, 'small'), { ok: true, message: null });
  s = { ...s, quests: { ...s.quests, q2: { stage: 'ready', gathered: [] } } };
  assert.equal(fightGate(s, ch, 'small').ok, false);
});

test('fightGate boss: 이미 끝낸 막이면 막는다', () => {
  const ch = ACT.chapters[1];
  const s = { ...newGame({ nickname: '하늘', avatar: 'f' }), chapter: '1-2' };
  assert.deepEqual(fightGate(s, ch, 'boss'), { ok: true, message: null });
  assert.deepEqual(fightGate({ ...s, clearedActs: [1] }, ch, 'boss'),
    { ok: false, message: '1막을 마쳤어요. 다음 막은 준비 중이에요.' });
});
