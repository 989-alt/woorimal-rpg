import { test } from 'node:test';
import assert from 'node:assert/strict';
import ACT from '../data/acts/act1.js';
import { newGame, chapterOf, chapterWords, acquireWords, fastForward } from '../js/rules/game.js';
import { ACTS, actOfChapter } from '../data/acts/index.js';
import {
  talkTo, inspect, winSmall, npcMarker, currentTask, hiddenGlow, questList,
  fightGate, visibleNpcs, chatLines,
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
  ({ state: s } = talkTo(s, ch1, 'gardener'));
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

test('숨은 낱말: 텃밭 아저씨가 알려 주기 전에는 조사해도 낱말이 없고 반짝이지도 않는다', () => {
  const s0 = fresh();
  assert.equal(hiddenGlow(s0, ch1), 'none');
  let r = inspect(s0, ch1, '1');
  assert.equal(r.event, 'nothing');
  assert.deepEqual(r.script, [{ who: 'narration', text: ch1.objects[1].text }]);
  assert.deepEqual(r.state.hiddenFound, {});
  // 말빛 주머니를 받은 뒤에도 아저씨 이야기를 듣기 전에는 그대로다
  const s1 = talkTo(s0, ch1, 'dodam').state;
  assert.equal(hiddenGlow(s1, ch1), 'none');
  r = inspect(s1, ch1, '1');
  assert.equal(r.event, 'nothing');
  assert.deepEqual(r.words, []);
  assert.deepEqual(r.script, [{ who: 'narration', text: ch1.objects[1].text }]);
  assert.deepEqual(r.state.hiddenFound, {});
  assert.deepEqual(r.state.acquired, {});
  // 부탁을 다 끝내도 알려 주기 전에는 반짝이지 않는다
  assert.equal(hiddenGlow(afterChapter1Quests(), ch1), 'none');
});

test('텃밭 아저씨: 주머니를 받기 전에는 알려 주지 않고, 받은 뒤 처음 말하면 알려 주며, 그 뒤에는 장독대를 일러 준다', () => {
  const g = ch1.npcs.find((n) => n.id === 'gardener');
  // 주머니를 받기 전: 그냥 대화(도담 할머니께 가 보라는 말), 알려 주지 않는다
  let r = talkTo(fresh(), ch1, 'gardener');
  assert.equal(r.event, 'chat');
  assert.deepEqual(r.script, g.chat);
  assert.deepEqual(r.state.revealed ?? {}, {});
  assert.equal(hiddenGlow(r.state, ch1), 'none');
  // 주머니를 받은 뒤 처음: 알려 준다
  const pouch = talkTo(fresh(), ch1, 'dodam').state;
  r = talkTo(pouch, ch1, 'gardener');
  assert.equal(r.event, 'reveal');
  assert.deepEqual(r.script, g.reveal);
  assert.deepEqual(r.words, []);
  assert.deepEqual(r.state.revealed, { '1-1': true });
  assert.equal(hiddenGlow(r.state, ch1), 'dim');
  // 다시 말하면 장독대 쪽을 일러 주고 상태는 그대로
  const again = talkTo(r.state, ch1, 'gardener');
  assert.equal(again.event, 'chat');
  assert.deepEqual(again.script, g.after);
  assert.equal(again.state, r.state);
  // 다른 인물과 말해도 알려지지 않는다
  assert.deepEqual(talkTo(pouch, ch1, 'daon').state.revealed ?? {}, {});
});

test('숨은 낱말: 알려 준 뒤 처음 조사만 낱말을 준다, 부탁 2개가 끝나면 bright', () => {
  const told = talkTo(talkTo(fresh(), ch1, 'dodam').state, ch1, 'gardener').state;
  assert.equal(hiddenGlow(told, ch1), 'dim');
  let r = inspect(told, ch1, '1');
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
  const s2 = talkTo(afterChapter1Quests(), ch1, 'gardener').state;
  assert.equal(hiddenGlow(s2, ch1), 'bright');
  const mid = talkTo(afterQ1(), ch1, 'gardener').state;
  assert.equal(hiddenGlow(mid, ch1), 'dim');
});

test('숨은 낱말: revealedBy가 없는 장은 주머니를 받으면 바로 반짝이고, 옛 저장(revealed 없음·이미 찾음)도 막히지 않는다', () => {
  const plain = structuredClone(ch1);
  delete plain.hidden.revealedBy;
  const pouch = talkTo(fresh(), ch1, 'dodam').state;
  assert.equal(hiddenGlow(pouch, plain), 'dim');
  assert.equal(inspect(pouch, plain, '1').event, 'hidden');
  // 옛 저장: revealed 필드가 없다
  const { revealed, ...old } = talkTo(fresh(), ch1, 'dodam').state;
  assert.equal(hiddenGlow(old, ch1), 'none');
  assert.equal(inspect(old, ch1, '1').event, 'nothing');
  // 옛 저장에서 숨은 낱말을 이미 찾았다면 알려 준 것으로 본다: 아저씨는 알려 주는 말을 다시 하지 않는다
  const found = { ...old, hiddenFound: { '1-1': true } };
  const r = talkTo(found, ch1, 'gardener');
  assert.equal(r.event, 'chat');
  assert.deepEqual(r.script, ch1.npcs.find((n) => n.id === 'gardener').after);
});

test('1-2: 빨래터 아주머니가 알려 주기 전에는 빨랫줄이 반짝이지 않는다', () => {
  let s = inChapter2();
  assert.equal(hiddenGlow(s, ch2), 'none');
  assert.equal(inspect(s, ch2, '3').event, 'nothing');
  const r = talkTo(s, ch2, 'laundry'); // 아직 q3이 끝나지 않아 q4는 잠겨 있다: 그냥 이야기 = 알려 주기
  assert.equal(r.event, 'reveal');
  assert.deepEqual(r.script, ch2.npcs.find((n) => n.id === 'laundry').reveal);
  assert.equal(hiddenGlow(r.state, ch2), 'dim');
  assert.equal(inspect(r.state, ch2, '3').event, 'hidden');
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
  s = inspect(talkTo(s, ch1, 'gardener').state, ch1, '1').state;
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
  t = inspect(talkTo(t, ch2, 'laundry').state, ch2, '3').state;
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
  // 시험용 막(9): ACTS에 잠깐 넣었다가 빼낸다
  const rename = (c, id, prefix) => {
    const k = structuredClone(c);
    k.id = id;
    k.quests.forEach((q) => { q.id = prefix + q.id; });
    k.hidden.word = prefix + k.hidden.word;
    k.quests.forEach((q) => { q.words = q.words.map((w) => prefix + w); });
    return k;
  };
  const a = rename(ch1, '9-1', 'x');
  const b = rename(ch2, '9-2', 'y');
  const act2 = { id: 9, chapters: [a, b] };
  ACTS.push(act2);
  try {
    assert.equal(actOfChapter('9-2'), act2);
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
    assert.equal(hiddenGlow(s, a), 'none'); // 아저씨가 알려 주기 전
    s = talkTo(s, a, 'gardener').state;
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
  assert.throws(() => actOfChapter('9-9'));
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
    { ok: false, message: '1막을 마쳤어요.' });
});

test('talkTo: 2막부터는 그 막 첫 부탁 전에도 알려 주는 인물의 chat이 숨은 낱말을 알려 준다', () => {
  const ch = ACTS[1].chapters[0]; // 2-1, 문지기
  const s = fastForward(newGame({ nickname: '하늘', avatar: 'f' }), '2-1');
  assert.equal(inspect(s, ch, '9').words.length, 0); // 알려 주기 전 아치 문 조사: 낱말 없음
  const r = talkTo(s, ch, 'guard');
  assert.equal(r.event, 'reveal');
  assert.equal(r.script, ch.npcs.find((n) => n.id === 'guard').chat);
  assert.equal(r.state.revealed['2-1'], true);
  assert.equal(hiddenGlow(r.state, ch), 'dim');
  assert.deepEqual(inspect(r.state, ch, '9').words, ['들머리']);
  // 다시 말하면 알려 주지 않고 그냥 이야기
  const again = talkTo(r.state, ch, 'guard');
  assert.equal(again.event, 'chat');
  assert.equal(again.state, r.state);
});

test('talkTo: 1막 첫 부탁을 받기 전에는 chat만 하는 알려 주는 인물도 알려 주지 않는다', () => {
  const ch = ACTS[1].chapters[0];
  const s = fresh(); // q1 open: 주머니 전
  const r = talkTo(s, ch, 'guard');
  assert.equal(r.event, 'chat');
  assert.deepEqual(r.state.revealed, {});
});

const doneQuests = (s, ...ids) => ({
  ...s, quests: { ...s.quests, ...Object.fromEntries(ids.map((id) => [id, { stage: 'done', gathered: [] }])) },
});

test('visibleNpcs: 4-2 나래는 보스 전에만, 5-2 나래는 보스 뒤에만', () => {
  const [ch42, ch52] = [ACTS[3].chapters[1], ACTS[4].chapters[1]];
  const s4 = fastForward(newGame({ nickname: '하늘', avatar: 'f' }), '4-2');
  assert.ok(visibleNpcs(s4, ch42).some((n) => n.id === 'narae'));
  assert.ok(!visibleNpcs({ ...s4, clearedActs: [...s4.clearedActs, 4] }, ch42).some((n) => n.id === 'narae'));
  const s5 = fastForward(s4, '5-2');
  assert.ok(!visibleNpcs(s5, ch52).some((n) => n.id === 'narae'));
  assert.ok(visibleNpcs({ ...s5, clearedActs: [...s5.clearedActs, 5] }, ch52).some((n) => n.id === 'narae'));
});

test('visibleNpcs: show가 없으면 늘 보이고 순서는 chapter.npcs 그대로', () => {
  const s = fresh();
  assert.deepEqual(visibleNpcs(s, ch1).map((n) => n.id), ch1.npcs.map((n) => n.id));
  const ch42 = ACTS[3].chapters[1];
  const s4 = fastForward(s, '4-2');
  const ids = visibleNpcs(s4, ch42).map((n) => n.id);
  assert.deepEqual(ids, ch42.npcs.map((n) => n.id));
  const after = visibleNpcs({ ...s4, clearedActs: [4] }, ch42).map((n) => n.id);
  assert.deepEqual(after, ch42.npcs.filter((n) => n.id !== 'narae').map((n) => n.id));
});

test('visibleNpcs: 받은 상태를 바꾸지 않는다', () => {
  const s = deepFreeze(fastForward(fresh(), '4-2'));
  visibleNpcs(s, ACTS[3].chapters[1]);
});

test('chatAfter: 4-2 해솔·나래는 q16을 끝낸 뒤 말이 바뀌고, 5-1 잿빛 아이는 q18 뒤', () => {
  const ch42 = ACTS[3].chapters[1];
  const [haesol, narae] = ['haesol', 'narae'].map((id) => ch42.npcs.find((n) => n.id === id));
  const s4 = fastForward(newGame({ nickname: '하늘', avatar: 'f' }), '4-2');
  for (const npc of [haesol, narae]) {
    assert.equal(talkTo(s4, ch42, npc.id).script, npc.chat);
    assert.equal(chatLines(s4, npc), npc.chat);
  }
  // q15만 끝나서는 바뀌지 않는다
  assert.equal(talkTo(doneQuests(s4, 'q15'), ch42, 'haesol').script, haesol.chat);
  const done = doneQuests(s4, 'q15', 'q16');
  for (const npc of [haesol, narae]) {
    const r = talkTo(done, ch42, npc.id);
    assert.equal(r.script, npc.chatAfter.lines);
    assert.equal(r.event, 'chat');
  }
  // 5-1 잿빛 아이
  const ch51 = ACTS[4].chapters[0];
  const grey = ch51.npcs.find((n) => n.id === 'greykid');
  const s5 = fastForward(s4, '5-1');
  assert.equal(talkTo(s5, ch51, 'greykid').script, grey.chat);
  assert.equal(talkTo(doneQuests(s5, 'q17', 'q18'), ch51, 'greykid').script, grey.chatAfter.lines);
});

test('chatLines: chatAfter가 없는 인물은 늘 chat', () => {
  const dodam = ch1.npcs.find((n) => n.id === 'dodam');
  assert.equal(chatLines(doneQuests(fresh(), 'q1', 'q2'), dodam), dodam.chat);
});

test('talkTo: 안 보이는 인물에게는 대사가 없다', () => {
  const ch42 = ACTS[3].chapters[1];
  const s = { ...fastForward(fresh(), '4-2'), clearedActs: [1, 2, 3, 4] };
  const r = talkTo(s, ch42, 'narae');
  assert.deepEqual(r, { state: s, script: [], event: 'chat', words: [] });
  // 5-2 보스 전 나래도 마찬가지
  const ch52 = ACTS[4].chapters[1];
  const s5 = fastForward(fresh(), '5-2');
  assert.deepEqual(talkTo(s5, ch52, 'narae').script, []);
  assert.ok(talkTo({ ...s5, clearedActs: [1, 2, 3, 4, 5] }, ch52, 'narae').script.length > 0);
});
