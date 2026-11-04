import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/save.js';
import { newGame } from '../js/rules/game.js';

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
