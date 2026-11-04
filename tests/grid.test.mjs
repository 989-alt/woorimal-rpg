import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, shuffle } from '../js/rules/rng.js';
import { parseMap, isWalkable, step, facingTarget, reachable } from '../js/explore/grid.js';
import { computeView, CANVAS_W, CANVAS_H } from '../js/explore/scale.js';

test('화면: 창을 꽉 채우는 캔버스(1152×648보다 작으면 줄이고, 크면 키우지 않고 더 보인다)', () => {
  assert.equal(CANVAS_W, 1152);
  assert.equal(CANVAS_H, 648);
  assert.deepEqual(computeView(1366, 768), { factor: 1, canvasW: 1366, canvasH: 768, cssW: 1366, cssH: 768, viewW: 1366 / 3, viewH: 256 });
  const t = computeView(1024, 768); // 태블릿: 줄여서 보이고 세계는 384×288칸 만큼
  assert.ok(Math.abs(t.factor - 1024 / 1152) < 1e-9);
  assert.deepEqual([t.canvasW, t.canvasH, t.cssW, t.cssH, t.viewW, t.viewH], [1152, 864, 1024, 768, 384, 288]);
  assert.deepEqual(computeView(1920, 1080), { factor: 1, canvasW: 1920, canvasH: 1080, cssW: 1920, cssH: 1080, viewW: 640, viewH: 360 }); // 키우지 않는다
  const tiny = computeView(300, 150);
  assert.ok(tiny.factor > 0 && tiny.factor < 0.3);
  assert.ok(tiny.cssW === 300 && tiny.cssH === 150);
});

test('막힌 칸은 제자리, 방향만 바뀜', () => {
  const m = parseMap(['###', '#S.', '###']);
  assert.deepEqual(m.start, { x: 1, y: 1 });
  const r = step(m, { x: 1, y: 1 }, 'up', {});
  assert.deepEqual(r, { pos: { x: 1, y: 1 }, facing: 'up' });
  const r2 = step(m, { x: 1, y: 1 }, 'right', {});
  assert.deepEqual(r2, { pos: { x: 2, y: 1 }, facing: 'right' });
  assert.equal(m.tileAt(-1, 0), '#');
  assert.equal(m.tileAt(9, 9), '#');
});

test('안개 문은 열렸을 때만, 작은 몬스터 칸은 물리친 뒤에만 지나감', () => {
  const m = parseMap(['#####', 'S.Fm.', '#####']);
  assert.equal(isWalkable(m, 2, 1, {}), false);
  assert.equal(isWalkable(m, 2, 1, { fogOpen: true }), true);
  assert.equal(isWalkable(m, 3, 1, { fogOpen: true }), false);
  assert.equal(isWalkable(m, 3, 1, { fogOpen: true, smallMonsterGone: true }), true);
  assert.deepEqual(step(m, { x: 1, y: 1 }, 'right', {}).pos, { x: 1, y: 1 });
  assert.deepEqual(step(m, { x: 1, y: 1 }, 'right', { fogOpen: true }).pos, { x: 2, y: 1 });
  assert.deepEqual([...reachable(m, m.start, {})].sort(), ['0,1', '1,1']);
  assert.equal(reachable(m, m.start, { fogOpen: true, smallMonsterGone: true }).size, 5);
  assert.deepEqual(m.fog, [{ x: 2, y: 1 }]);
});

test('바라보는 대상: 인물, 물건, 몬스터, 안개', () => {
  const m = parseMap(['#######', '#a0mFM#', '#.S...#', '#######']);
  assert.deepEqual(m.slots.a, { x: 1, y: 1 });
  assert.deepEqual(m.objects['0'], { x: 2, y: 1 });
  assert.deepEqual(m.boss, { x: 5, y: 1 });
  assert.deepEqual(m.smallMonster, { x: 3, y: 1 });
  assert.deepEqual(facingTarget(m, { x: 1, y: 2 }, 'up'), { kind: 'npc', slot: 'a' });
  assert.deepEqual(facingTarget(m, { x: 2, y: 2 }, 'up'), { kind: 'object', slot: '0' });
  assert.deepEqual(facingTarget(m, { x: 3, y: 2 }, 'up'), { kind: 'small' });
  assert.equal(facingTarget(m, { x: 3, y: 2 }, 'up', { smallMonsterGone: true }), null);
  assert.deepEqual(facingTarget(m, { x: 4, y: 2 }, 'up'), { kind: 'fog' });
  assert.deepEqual(facingTarget(m, { x: 5, y: 2 }, 'up'), { kind: 'boss' });
  assert.equal(facingTarget(m, { x: 2, y: 2 }, 'down'), null);
  assert.equal(isWalkable(m, 1, 1, {}), false);
});

test('parseMap 검증', () => {
  assert.throws(() => parseMap(['S#', '#']), /길이|length/i);
  assert.throws(() => parseMap(['##', '##']), /S/);
  assert.throws(() => parseMap(['SS']), /S/);
  assert.throws(() => parseMap(['SMM']), /M/);
  assert.throws(() => parseMap(['Smm']), /m/);
  assert.throws(() => parseMap(['S00']), /0/);
  assert.throws(() => parseMap(['Saa']), /a/);
});

test('shuffle는 같은 시드면 같은 순서', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const s1 = shuffle(a, makeRng(42));
  const s2 = shuffle(a, makeRng(42));
  assert.deepEqual(s1, s2);
  assert.deepEqual(a, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...s1].sort((x, y) => x - y), a);
  const r = makeRng(1);
  const v = r();
  assert.ok(v >= 0 && v < 1);
  assert.notDeepEqual(shuffle(a, makeRng(1)), shuffle(a, makeRng(2)));
});
