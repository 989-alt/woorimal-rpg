import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glidePos, drawnPos, nextGlide, snapTile, MOVE_MS } from '../js/explore/motion.js';
import { HOLD_MS } from '../js/explore/input.js';

const A = { x: 3, y: 5 };
const B = { x: 4, y: 5 };

test('걸음 시간은 꾹 누를 때의 간격과 같다', () => {
  assert.equal(MOVE_MS, HOLD_MS);
});

test('glidePos: 시작·가운데·끝', () => {
  assert.deepEqual(glidePos(A, B, 1000, 1000, 150), { x: 3, y: 5 });
  assert.deepEqual(glidePos(A, B, 1000, 1075, 150), { x: 3.5, y: 5 });
  assert.deepEqual(glidePos(A, B, 1000, 1150, 150), { x: 4, y: 5 });
  // 범위 밖은 끝점에 붙는다
  assert.deepEqual(glidePos(A, B, 1000, 900, 150), A);
  assert.deepEqual(glidePos(A, B, 1000, 5000, 150), B);
  // 세로
  assert.deepEqual(glidePos({ x: 2, y: 2 }, { x: 2, y: 1 }, 0, 75, 150), { x: 2, y: 1.5 });
});

test('glidePos: 그림 픽셀(세계 1/3 = 칸의 1/48)에 맞춘다', () => {
  for (let now = 0; now <= 150; now += 7) {
    const { x } = glidePos(A, B, 0, now, 150);
    const px = x * 48;
    assert.ok(Math.abs(px - Math.round(px)) < 1e-9, `${now}ms: ${x}`);
  }
  assert.equal(snapTile(0.5 / 48), 1 / 48);
  assert.equal(snapTile(0.4 / 48), 0);
  // 곧게 늘어난다: 뒤로 가지 않는다
  let last = -Infinity;
  for (let now = 0; now <= 150; now += 3) {
    const { x } = glidePos(A, B, 0, now, 150);
    assert.ok(x >= last);
    last = x;
  }
});

test('drawnPos: 미끄러짐이 없거나 끝났거나 순간이동이면 상태 자리 그대로', () => {
  const g = nextGlide(null, A, B, 1000);
  assert.deepEqual(drawnPos(null, B, 1000), B);
  assert.deepEqual(drawnPos(g, B, 1075), { x: 3.5, y: 5 });
  assert.deepEqual(drawnPos(g, B, 1000 + MOVE_MS), B);
  // 상태 자리가 목적지와 다르면(순간이동·불러오기) 미끄러지지 않는다
  assert.deepEqual(drawnPos(g, { x: 10, y: 10 }, 1075), { x: 10, y: 10 });
});

test('nextGlide: 처음 걸음, 이어 걷기(일찍·조금 늦게), 오래 쉬고 걷기', () => {
  const g1 = nextGlide(null, A, B, 1000);
  assert.deepEqual(g1, { from: A, to: B, startedAt: 1000, ms: MOVE_MS });
  const C = { x: 5, y: 5 };
  // 끝나고 조금 늦게 다음 걸음: 끊김 없이 앞 걸음이 끝난 때부터
  assert.equal(nextGlide(g1, B, C, 1000 + MOVE_MS + 10).startedAt, 1000 + MOVE_MS);
  // 일찍 옴: 지금 보이는 자리에서 이어 간다
  const early = nextGlide(g1, B, C, 1075);
  assert.deepEqual(early.from, { x: 3.5, y: 5 });
  assert.equal(early.startedAt, 1075);
  // 오래 쉬었다 걷기: 칸에서 새로 시작
  const late = nextGlide(g1, B, C, 3000);
  assert.deepEqual(late.from, B);
  assert.equal(late.startedAt, 3000);
});

test('꾹 누른 걸음 사슬은 끊김 없이 고르게 간다', () => {
  let g = nextGlide(null, { x: 0, y: 0 }, { x: 1, y: 0 }, 0);
  let pos = { x: 1, y: 0 };
  // 타이머가 조금씩 흔들려도(0~12ms 늦음) 그려지는 자리는 줄어들지 않고 칸 사이를 계속 지난다
  const jitter = [3, 0, 12, 5, 9];
  let t = 0;
  for (const j of jitter) {
    t += MOVE_MS + j;
    const to = { x: pos.x + 1, y: 0 };
    g = nextGlide(g, pos, to, t);
    pos = to;
  }
  let last = -Infinity;
  for (let now = 0; now <= t + MOVE_MS; now += 4) {
    const x = drawnPos(g, pos, now).x;
    assert.ok(x >= last);
    last = x;
  }
  assert.equal(last, pos.x);
});
