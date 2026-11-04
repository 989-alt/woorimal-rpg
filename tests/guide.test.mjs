// 길잡이 규칙: 지금 할 한 가지(nextGoal)와 "끝내러 돌아가지 않고 떠나는 걸음"(leavingTooSoon).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ACT from '../data/acts/act1.js';
import { newGame, chapterOf, chapterWords, acquireWords } from '../js/rules/game.js';
import { talkTo, inspect, winSmall } from '../js/rules/quests.js';
import { nextGoal, leavingTooSoon } from '../js/rules/guide.js';
import { parseMap } from '../js/explore/grid.js';
import { ACTS } from '../data/acts/index.js';
import { fastForward } from '../js/rules/game.js';

const fresh = () => newGame({ nickname: '하늘', avatar: 'f' });
const ch1 = chapterOf(ACT, '1-1');
const ch2 = chapterOf(ACT, '1-2');
const map1 = parseMap(ch1.map.rows);

const afterQ1Done = () => {
  let s = talkTo(fresh(), ch1, 'dodam').state;
  s = inspect(s, ch1, '0').state;
  return talkTo(s, ch1, 'dodam').state;
};
const inChapter2 = () => {
  let s = afterQ1Done();
  s = talkTo(s, ch1, 'daon').state;
  s = winSmall(s, ch1);
  s = talkTo(s, ch1, 'daon').state;
  s = talkTo(s, ch1, 'gardener').state;
  s = inspect(s, ch1, '1').state;
  s = acquireWords(s, chapterWords(ch1), 'x');
  return { ...s, chapter: '1-2', quests: { ...s.quests, q3: { stage: 'open', gathered: [] } } };
};

test('nextGoal: 1-1 처음에는 도담 할머니께 말 걸기', () => {
  const g = nextGoal(fresh(), ch1);
  assert.equal(g.kind, 'talk');
  assert.equal(g.npcId, 'dodam');
  assert.equal(g.text, '도담 할머니에게 말을 걸어 보자');
});

test('nextGoal: 부탁을 받으면 조사할 곳, 물동이를 들면 돌아가기', () => {
  let s = talkTo(fresh(), ch1, 'dodam').state;
  let g = nextGoal(s, ch1);
  assert.deepEqual([g.kind, g.objectSlot, g.text], ['find', '0', '우물에서 물을 길어 오자']);
  s = inspect(s, ch1, '0').state;
  g = nextGoal(s, ch1);
  assert.deepEqual([g.kind, g.npcId], ['talk', 'dodam']);
  assert.match(g.text, /돌아가/);
});

test('nextGoal: 다온의 부탁을 받으면 꼬마 안개, 이기면 다온에게 돌아가기', () => {
  let s = talkTo(afterQ1Done(), ch1, 'daon').state;
  let g = nextGoal(s, ch1);
  assert.deepEqual([g.kind, g.text], ['fight', '꼬마 안개를 쫓아내자']);
  s = winSmall(s, ch1);
  g = nextGoal(s, ch1);
  assert.deepEqual([g.kind, g.npcId, g.text], ['talk', 'daon', '다온에게 돌아가 알려 주자']);
});

test('nextGoal: 부탁을 다 끝냈고 숨은 낱말이 남았으면 알려 줄 인물, 알려 준 뒤에는 숨은 곳, 모두 끝나면 출구', () => {
  let s = talkTo(winSmall(talkTo(afterQ1Done(), ch1, 'daon').state, ch1), ch1, 'daon').state;
  let g = nextGoal(s, ch1);
  assert.deepEqual([g.kind, g.npcId, g.text], ['talk', 'gardener', '텃밭 아저씨 이야기를 들어 보자']);
  s = talkTo(s, ch1, 'gardener').state;
  g = nextGoal(s, ch1);
  assert.deepEqual([g.kind, g.objectSlot, g.text], ['hidden', '1', '반짝이는 곳을 찾아 조사해 보자']);
  s = acquireWords(inspect(s, ch1, '1').state, chapterWords(ch1), 'x');
  g = nextGoal(s, ch1);
  assert.deepEqual([g.kind, g.text], ['exit', '골목 끝 길로 마을 어귀로 가자']);
});

test('nextGoal: 부탁이 남아 있으면 아저씨 이야기보다 부탁이 먼저다', () => {
  const g = nextGoal(afterQ1Done(), ch1); // 다온의 부탁이 열려 있다
  assert.deepEqual([g.kind, g.npcId], ['talk', 'daon']);
});

test('nextGoal: 1-2 모으기는 남은 곳과 개수, 전하기는 받는 이, 끝나면 보스', () => {
  let s = inChapter2();
  assert.equal(nextGoal(s, ch2).text, '빵집 아저씨에게 말을 걸어 보자');
  s = talkTo(s, ch2, 'baker').state;
  let g = nextGoal(s, ch2);
  assert.deepEqual([g.kind, g.objectSlot, g.text], ['find', '0', '마른 나무에서 장작을 모으자 (0/3)']);
  s = inspect(s, ch2, '0').state;
  g = nextGoal(s, ch2);
  assert.deepEqual([g.objectSlot, g.text], ['1', '마른 나무에서 장작을 모으자 (1/3)']);
  assert.deepEqual(g.objectSlots, ['1', '2']);
  s = inspect(inspect(s, ch2, '1').state, ch2, '2').state;
  assert.deepEqual([nextGoal(s, ch2).kind, nextGoal(s, ch2).npcId], ['talk', 'baker']);
  s = talkTo(s, ch2, 'baker').state;
  s = talkTo(s, ch2, 'laundry').state; // 편지를 받는다
  g = nextGoal(s, ch2);
  assert.deepEqual([g.kind, g.npcId, g.text], ['talk', 'gate', '편지를 어귀 할아버지에게 전하자']);
  s = talkTo(s, ch2, 'gate').state;
  g = nextGoal(s, ch2);
  assert.deepEqual([g.kind, g.npcId, g.text], ['talk', 'laundry', '빨래터 아주머니 이야기를 들어 보자']);
  s = talkTo(s, ch2, 'laundry').state;
  g = nextGoal(s, ch2);
  assert.equal(g.kind, 'hidden');
  s = acquireWords(inspect(s, ch2, '3').state, chapterWords(ch2), 'x');
  g = nextGoal(s, ch2);
  assert.deepEqual([g.kind, g.text], ['boss', '안개 덩이와 맞서자']);
  // 보스를 이기면(막 기록) 출구로 가자
  g = nextGoal({ ...s, clearedActs: [1] }, ch2);
  assert.deepEqual([g.kind, g.text], ['exit', '북쪽 길로 너울장으로 가자']);
});

test('nextGoal: 출구 글이 없는 장은 옛 글 그대로(다음 장으로 가자 / 막을 마쳤어요)', () => {
  const bare = structuredClone(ch1);
  delete bare.exit;
  const done = acquireWords(inChapter2(), chapterWords(ch1), 'x');
  const s = { ...done, chapter: '1-1', hiddenFound: { '1-1': true } };
  assert.deepEqual([nextGoal(s, bare).kind, nextGoal(s, bare).text], ['none', '다음 장으로 가자']);
});

test('nextGoal: 글은 25자 이하이고 받는 글에 인물 이름이 들어간다', () => {
  const states = [fresh(), afterQ1Done(), inChapter2(), { ...inChapter2(), clearedActs: [1] }];
  for (const s of states) for (const ch of [ch1, ch2]) assert.ok(nextGoal(s, ch).text.length <= 25, nextGoal(s, ch).text);
  for (const ch of [ch1, ch2]) {
    for (const t of [ch.exit.goal, ch.exit.won, ch.hidden.revealGoal]) if (t) assert.ok(t.length <= 25, t);
  }
  for (const q of [...ch1.quests, ...ch2.quests]) {
    assert.ok(q.goal && q.goal.length <= 25, `${q.id} goal`);
  }
});

test('nextGoal: 옛 저장에서 전하기 물건이 가방에 없으면 맡긴 사람에게 다시 받기', () => {
  let s = talkTo(inChapter2(), ch2, 'laundry').state;
  s = { ...s, quests: { ...s.quests, q3: { stage: 'done', gathered: [] }, q4: { stage: 'active', gathered: [] } }, bag: [] };
  const g = nextGoal(s, ch2);
  assert.deepEqual([g.kind, g.npcId], ['talk', 'laundry']);
});

test('nextGoal: 받은 상태를 바꾸지 않는다', () => {
  const s = afterQ1Done();
  const before = JSON.stringify(s);
  nextGoal(s, ch1); leavingTooSoon(s, ch1, { x: 1, y: 1 }, { x: 2, y: 1 }, map1);
  assert.equal(JSON.stringify(s), before);
});

test('leavingTooSoon: 돌아갈 부탁이 있고 막혔던 골목 너머로 가는 걸음이면 true', () => {
  const s = winSmall(talkTo(afterQ1Done(), ch1, 'daon').state, ch1);
  const gone = { ...s };
  const m = map1.smallMonster; // (21,7): 골목 입구
  const daon = map1.slots.b;
  // 골목으로 들어서는 걸음, 골목 안에서 빈터로 가는 걸음
  assert.equal(leavingTooSoon(gone, ch1, { x: m.x, y: m.y + 1 }, { x: m.x, y: m.y }, map1), true);
  assert.equal(leavingTooSoon(gone, ch1, { x: m.x, y: m.y - 4 }, { x: m.x, y: m.y - 5 }, map1), true);
  // 다온 쪽으로 가는 걸음, 광장 안에서 다니는 걸음은 아니다
  assert.equal(leavingTooSoon(gone, ch1, { x: daon.x - 2, y: daon.y + 1 }, { x: daon.x - 1, y: daon.y + 1 }, map1), false);
  assert.equal(leavingTooSoon(gone, ch1, { x: 12, y: 8 }, { x: 11, y: 8 }, map1), false);
  // 골목 안에서 다온 쪽(아래)으로 돌아 나오는 걸음
  assert.equal(leavingTooSoon(gone, ch1, { x: m.x, y: m.y - 1 }, { x: m.x, y: m.y }, map1), false);
});

test('leavingTooSoon: 돌아갈 부탁(ready)이 없으면 false', () => {
  const s = talkTo(afterQ1Done(), ch1, 'daon').state; // q2 active
  const m = map1.smallMonster;
  assert.equal(leavingTooSoon(s, ch1, { x: m.x, y: m.y + 1 }, { x: m.x, y: m.y }, map1), false);
  assert.equal(leavingTooSoon(fresh(), ch1, { x: 5, y: 8 }, { x: 6, y: 8 }, map1), false);
});

test('leavingTooSoon·nextGoal은 안 보이는 인물을 목표로 삼지 않는다', () => {
  // leavingTooSoon: 1-1의 다온을 "보스 뒤에만 서는 인물"로 바꾸면, 같은 걸음이 더는 "돌아갈 인물에게서 멀어짐"이 아니다.
  const s = winSmall(talkTo(afterQ1Done(), ch1, 'daon').state, ch1);
  const m = map1.smallMonster;
  const [from, to] = [{ x: m.x, y: m.y + 1 }, { x: m.x, y: m.y }];
  assert.equal(leavingTooSoon(s, ch1, from, to, map1), true);
  const hiddenDaon = { ...ch1, npcs: ch1.npcs.map((n) => (n.id === 'daon' ? { ...n, show: 'afterBoss' } : n)) };
  assert.equal(leavingTooSoon(s, hiddenDaon, from, to, map1), false);
  // nextGoal: 4-2 보스를 이긴 뒤에는 사라진 나래가 아니라 출구를 가리킨다(나래의 부탁이 남아 있어도)
  const ch = ACTS[3].chapters[1];
  const cleared = { ...fastForward(fresh(), '4-2'), clearedActs: [1, 2, 3, 4] };
  const withReady = { ...cleared, quests: { ...cleared.quests, q16: { stage: 'ready', gathered: [] } } };
  assert.deepEqual([nextGoal(withReady, ch).kind, nextGoal(withReady, ch).npcId], ['exit', undefined]);
  // 보스 전에는 나래가 목표
  assert.equal(nextGoal({ ...withReady, clearedActs: [1, 2, 3] }, ch).npcId, 'narae');
});
