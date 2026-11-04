import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/save.js';
import { newGame, acquireWords, chapterWords, exitOpen, fastForward } from '../js/rules/game.js';
import { parseMap } from '../js/explore/grid.js';
import ACT1 from '../data/acts/act1.js';

function fakeStorage({ failAfter = Infinity } = {}) {
  const m = new Map();
  let sets = 0;
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (++sets > failAfter) throw new Error('quota'); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

test('save then load round-trips and names lists once', () => {
  const s = createStore(fakeStorage());
  assert.equal(s.available, true);
  const g = newGame({ nickname: '하늘', avatar: 0 });
  assert.equal(s.save(g), true);
  assert.equal(s.save(g), true);
  assert.deepEqual(s.load('하늘'), { ok: true, state: g });
  assert.deepEqual(s.names(), ['하늘']);
  assert.equal(s.has('하늘'), true);
  assert.equal(s.has('없음'), false);
});

test('missing key', () => {
  assert.deepEqual(createStore(fakeStorage()).load('x'), { ok: false, reason: 'missing' });
});

test('corrupt JSON is kept', () => {
  const st = fakeStorage();
  st.setItem('malbit:save:가', '{broken');
  const r = createStore(st).load('가');
  assert.deepEqual(r, { ok: false, reason: 'corrupt' });
  assert.equal(st.getItem('malbit:save:가'), '{broken');
});

test('wrong version or missing field is corrupt', () => {
  const st = fakeStorage();
  const g = newGame({ nickname: '나', avatar: 0 });
  st.setItem('malbit:save:v0', JSON.stringify({ ...g, version: 0 }));
  const { bag, ...noBag } = g;
  st.setItem('malbit:save:nb', JSON.stringify(noBag));
  st.setItem('malbit:save:ty', JSON.stringify({ ...g, bag: {} }));
  const s = createStore(st);
  for (const k of ['v0', 'nb', 'ty']) assert.equal(s.load(k).reason, 'corrupt');
});

test('null storage is unavailable and safe', () => {
  const s = createStore(null);
  assert.equal(s.available, false);
  assert.equal(s.save(newGame({ nickname: 'a', avatar: 0 })), false);
  assert.deepEqual(s.names(), []);
  assert.equal(s.load('a').reason, 'missing');
  assert.equal(s.has('a'), false);
});

test('probe failure means unavailable', () => {
  assert.equal(createStore(fakeStorage({ failAfter: 0 })).available, false);
});

test('names corrupt returns []', () => {
  const st = fakeStorage();
  st.setItem('malbit:names', 'nope');
  assert.deepEqual(createStore(st).names(), []);
});

test('setItem throwing on later save returns false and flips available', () => {
  // probe uses 1 set; first save uses 2 (save + names); fail from 4th set
  const s = createStore(fakeStorage({ failAfter: 3 }));
  assert.equal(s.available, true);
  assert.equal(s.save(newGame({ nickname: '가', avatar: 0 })), true);
  assert.equal(s.save(newGame({ nickname: '나', avatar: 0 })), false);
  assert.equal(s.available, false);
});

test('없는 장(chapter)의 저장은 깨진 저장으로 본다', () => {
  const st = fakeStorage();
  const g = newGame({ nickname: '가', avatar: 'f' });
  st.setItem('malbit:save:가', JSON.stringify({ ...g, chapter: '9-9' }));
  assert.deepEqual(createStore(st).load('가'), { ok: false, reason: 'corrupt' });
});

test('지도 밖이나 걸을 수 없는 자리는 그 장의 시작 자리로 고쳐서 불러온다', () => {
  const st = fakeStorage();
  const s = createStore(st);
  const g = newGame({ nickname: '가', avatar: 'f' });
  const map1 = parseMap(ACT1.chapters[0].map.rows);
  const start1 = { x: map1.start.x, y: map1.start.y };
  for (const pos of [{ x: -1, y: 3 }, { x: 999, y: 0 }, { x: 0, y: 0 }, { x: 1.5, y: 19 }, { x: 'a', y: 19 }]) {
    st.setItem('malbit:save:가', JSON.stringify({ ...g, pos, facing: 'left' }));
    const r = s.load('가');
    assert.equal(r.ok, true, JSON.stringify(pos));
    assert.deepEqual(r.state.pos, start1);
    assert.equal(r.state.facing, 'down');
  }
  // 걸을 수 있는 자리는 그대로
  st.setItem('malbit:save:가', JSON.stringify({ ...g, pos: { x: 6, y: 19 }, facing: 'left' }));
  assert.deepEqual(s.load('가').state.pos, { x: 6, y: 19 });
  assert.equal(s.load('가').state.facing, 'left');
  // 꼬마 안개 칸: 쫓아내기 전에는 고치고, 쫓아낸 뒤에는 그대로
  const m = map1.smallMonster;
  st.setItem('malbit:save:가', JSON.stringify({ ...g, pos: m }));
  assert.deepEqual(s.load('가').state.pos, start1);
  st.setItem('malbit:save:가', JSON.stringify({ ...g, pos: m, smallGone: { '1-1': true } }));
  assert.deepEqual(s.load('가').state.pos, { x: m.x, y: m.y });
  // 1-2 안개 문 칸: 낱말 5개를 다 모았을 때만 설 수 있다
  const ch2 = ACT1.chapters[1];
  const map2 = parseMap(ch2.map.rows);
  const fog = map2.fog[0];
  const in2 = { ...g, chapter: '1-2', pos: fog };
  st.setItem('malbit:save:가', JSON.stringify(in2));
  assert.deepEqual(s.load('가').state.pos, { x: map2.start.x, y: map2.start.y });
  st.setItem('malbit:save:가', JSON.stringify(acquireWords(in2, chapterWords(ch2), 'x')));
  assert.deepEqual(s.load('가').state.pos, { x: fog.x, y: fog.y });
  // 막 보스 칸: 막을 마치기 전에는 고치고, 마친 뒤(보스가 사라진 뒤)에는 그대로
  const boss = map2.boss;
  const atBoss = acquireWords({ ...in2, pos: boss }, chapterWords(ch2), 'x');
  st.setItem('malbit:save:가', JSON.stringify(atBoss));
  assert.deepEqual(s.load('가').state.pos, { x: map2.start.x, y: map2.start.y });
  st.setItem('malbit:save:가', JSON.stringify({ ...atBoss, clearedActs: [1] }));
  assert.deepEqual(s.load('가').state.pos, { x: boss.x, y: boss.y });
});

test('revealed가 없는 옛 version 1 저장도 그대로 불러온다(알려 주지 않은 것으로 본다)', () => {
  const st = fakeStorage();
  const { revealed, ...old } = newGame({ nickname: '옛', avatar: 0 });
  st.setItem('malbit:save:옛', JSON.stringify(old));
  const r = createStore(st).load('옛');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.revealed, {});
});

test('옛 seenTips(옛 id만)인 version 1 저장도 그대로 불러온다', () => {
  const st = fakeStorage();
  const g = { ...newGame({ nickname: '옛', avatar: 0 }), seenTips: ['move', 'first-npc', 'tip-word', 'tip-boss', 'tip-review'] };
  st.setItem('malbit:save:옛', JSON.stringify(g));
  const r = createStore(st).load('옛');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.seenTips, ['move', 'first-npc', 'tip-word', 'tip-boss', 'tip-review']);
});

test('1막만 있던 옛 저장(q1~q4, seenScenes·revealed 없음)을 불러오면 빈 seenScenes·revealed로 이어진다', () => {
  const st = fakeStorage();
  const { seenScenes, revealed, ...old } = newGame({ nickname: '옛', avatar: 'f' });
  const D = { stage: 'done', gathered: [] };
  const quests = { q1: D, q2: { stage: 'open', gathered: [] }, q3: { stage: 'locked', gathered: [] }, q4: { stage: 'locked', gathered: [] } };
  st.setItem('malbit:save:옛', JSON.stringify({ ...old, quests }));
  const r = createStore(st).load('옛');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.seenScenes, []);
  assert.deepEqual(r.state.revealed, {});
  assert.deepEqual(r.state.quests, quests);
  // 이미 있는 값은 그대로 둔다
  const kept = { ...old, seenScenes: ['2-2:afterBoss'], revealed: { '1-1': true } };
  st.setItem('malbit:save:옛', JSON.stringify(kept));
  const k = createStore(st).load('옛').state;
  assert.deepEqual(k.seenScenes, ['2-2:afterBoss']);
  assert.deepEqual(k.revealed, { '1-1': true });
  // 모양이 틀린 값은 빈 것으로
  st.setItem('malbit:save:옛', JSON.stringify({ ...old, seenScenes: 'x', revealed: [1] }));
  const w = createStore(st).load('옛').state;
  assert.deepEqual(w.seenScenes, []);
  assert.deepEqual(w.revealed, {});
});

test('act가 장과 다른 저장은 장의 막으로 고쳐 불러온다', () => {
  const st = fakeStorage();
  const g = fastForward(newGame({ nickname: '가', avatar: 'f' }), '2-2');
  st.setItem('malbit:save:가', JSON.stringify({ ...g, act: 1 }));
  assert.equal(createStore(st).load('가').state.act, 2);
  st.setItem('malbit:save:가', JSON.stringify({ ...g, act: 2 }));
  assert.equal(createStore(st).load('가').state.act, 2);
});

test('1막을 마친 옛 저장은 1-2에서 출구가 열린 채 불러온다', () => {
  const st = fakeStorage();
  const g = { ...fastForward(newGame({ nickname: '가', avatar: 'f' }), '1-2'), clearedActs: [1] };
  const ch = ACT1.chapters[1];
  st.setItem('malbit:save:가', JSON.stringify({ ...g, pos: { x: ch.exit.x, y: ch.exit.y } }));
  const r = createStore(st).load('가');
  assert.equal(r.ok, true);
  assert.equal(exitOpen(r.state, ch), true);
  assert.deepEqual(r.state.pos, { x: ch.exit.x, y: ch.exit.y });
});
