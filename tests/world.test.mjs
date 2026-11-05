import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTS } from '../data/acts/index.js';
import { WORLD } from '../data/world.js';
import { newGame, fastForward } from '../js/rules/game.js';
import { travelOf, worldMarks } from '../js/rules/world.js';

const fresh = () => newGame({ nickname: '하늘', avatar: 'f' });

test('travelOf: 막을 마쳐야 다음 막으로, 마지막 막은 null', () => {
  const s = fastForward(fresh(), '1-2');
  assert.equal(travelOf(s), null);
  assert.deepEqual(travelOf({ ...s, clearedActs: [1] }), { from: 1, to: 2 });
  assert.equal(travelOf({ ...fastForward(s, '5-2'), clearedActs: [1, 2, 3, 4, 5] }), null);
});

test('travelOf: 지금 장의 막을 기준으로 한다(3막 장에서는 3 → 4)', () => {
  const s = { ...fastForward(fresh(), '3-2'), clearedActs: [1, 2, 3] };
  assert.deepEqual(travelOf(s), { from: 3, to: 4 });
});

test('travelOf: 받은 상태를 바꾸지 않는다', () => {
  const s = Object.freeze({ ...fastForward(fresh(), '1-2'), clearedActs: Object.freeze([1]) });
  assert.deepEqual(travelOf(s), { from: 1, to: 2 });
});

test('worldMarks: 마친 곳 done, 갈 곳 next, 나머지 far', () => {
  const s = { ...fastForward(fresh(), '2-2'), clearedActs: [1, 2] };
  assert.deepEqual(worldMarks(s, 3).map((p) => p.mark), ['done', 'done', 'next', 'far', 'far']);
  assert.deepEqual(worldMarks(s, 3).map((p) => p.act), [1, 2, 3, 4, 5]);
});

test('worldMarks: 1막만 마친 때는 done 1, next 1, far 3', () => {
  const s = { ...fastForward(fresh(), '1-2'), clearedActs: [1] };
  const marks = worldMarks(s, 2).map((p) => p.mark);
  assert.deepEqual(marks, ['done', 'next', 'far', 'far', 'far']);
});

test('WORLD.places: 막 1~5, 이름은 막 제목, 좌표는 지도 안', () => {
  assert.deepEqual(WORLD.size, { w: 1536, h: 864 });
  assert.equal(WORLD.places.length, ACTS.length);
  WORLD.places.forEach((p, i) => {
    assert.equal(p.act, i + 1);
    assert.equal(p.name, ACTS[i].title);
    assert.ok(p.x >= 0 && p.x <= WORLD.size.w, `${p.name} x`);
    assert.ok(p.y >= 0 && p.y <= WORLD.size.h, `${p.name} y`);
  });
});

test('WORLD.places: 아래(새벽골)에서 위(잿빛 탑)로 오르는 길이다', () => {
  for (let i = 1; i < WORLD.places.length; i++) assert.ok(WORLD.places[i].y < WORLD.places[i - 1].y, `${i + 1}번째 곳이 더 위`);
});
