import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeHint, splitEmphasis } from '../js/ui/hint.js';

const BOX = { w: 1366, h: 768 };
const SIZE = { w: 300, h: 80 };

test('앵커가 위 절반이면 아래에, 왼쪽 끝이면 x는 여백에 붙는다', () => {
  assert.deepEqual(placeHint({ x: 100, y: 50, w: 40, h: 40 }, SIZE, BOX), { x: 16, y: 102, place: 'below', arrowX: 104 });
});

test('앵커가 아래 절반이면 위에: y = 앵커 y − 말풍선 높이 − 12', () => {
  const r = placeHint({ x: 600, y: 500, w: 40, h: 40 }, SIZE, BOX);
  assert.equal(r.place, 'above');
  assert.equal(r.y, 500 - 92);
  assert.equal(r.x, 620 - 150);
  assert.equal(r.arrowX, 150);
});

test('오른쪽 끝 앵커: x는 오른쪽 여백에 붙고 꼬리는 말풍선 안에 머문다', () => {
  const r = placeHint({ x: 1330, y: 40, w: 30, h: 40 }, SIZE, BOX);
  assert.equal(r.x, 1366 - 300 - 16);
  assert.ok(r.arrowX <= 284 && r.arrowX >= 16);
});

test('gap과 margin을 바꿀 수 있다', () => {
  const r = placeHint({ x: 0, y: 600, w: 10, h: 10 }, SIZE, BOX, 20, 30);
  assert.equal(r.x, 30);
  assert.equal(r.y, 600 - 80 - 20);
});

test('말풍선이 화면보다 넓어도 x는 여백 아래로 내려가지 않는다', () => {
  const r = placeHint({ x: 50, y: 50, w: 10, h: 10 }, { w: 500, h: 80 }, { w: 400, h: 768 });
  assert.equal(r.x, 16);
});

test('강조 낱말만 따로 나눈다(조각을 이으면 원래 글)', () => {
  const parts = splitEmphasis('사람을 보고 Space를 누르면\n말을 걸 수 있어요');
  assert.equal(parts.map((p) => p.text).join(''), '사람을 보고 Space를 누르면\n말을 걸 수 있어요');
  assert.deepEqual(parts.filter((p) => p.em).map((p) => p.text), ['Space']);
  assert.deepEqual(splitEmphasis('아무 말'), [{ text: '아무 말', em: false }]);
  assert.deepEqual(splitEmphasis('방향키로 걸어 보세요\nShift를 누르고 있으면 달릴 수 있어요').filter((p) => p.em).map((p) => p.text), ['방향키', 'Shift']);
  assert.deepEqual(splitEmphasis('달리기 버튼을 누르고 있으면 빨리 걸어요').filter((p) => p.em).map((p) => p.text), ['달리기 버튼']);
});

test('force로 자리를 정하면 앵커 높이와 상관없이 그쪽에 놓인다', () => {
  const a = { x: 600, y: 360, w: 40, h: 40 }; // 가운데 높이 380 < 384: 보통은 아래
  assert.equal(placeHint(a, SIZE, BOX).place, 'below');
  assert.deepEqual(placeHint(a, SIZE, BOX, 12, 16, 'above'), { x: 470, y: 360 - 92, place: 'above', arrowX: 150 });
  assert.equal(placeHint({ ...a, y: 600 }, SIZE, BOX, 12, 16, 'below').y, 600 + 40 + 12);
});
