import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraFor, questObjectSlots } from '../js/explore/render.js';
import { parseMap } from '../js/explore/grid.js';
import { newGame, chapterOf } from '../js/rules/game.js';
import { talkTo } from '../js/rules/quests.js';
import ACT1 from '../data/acts/act1.js';

const big = { w: 32, h: 24 }; // 512×384 픽셀

test('카메라는 주인공을 가운데 두고 맵 밖으로 나가지 않는다', () => {
  // 화면 384×216 = 24×13.5칸
  assert.deepEqual(cameraFor(big, { x: 16, y: 12 }), { x: 16 * 16 + 8 - 192, y: 12 * 16 + 8 - 108 });
  assert.deepEqual(cameraFor(big, { x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(cameraFor(big, { x: 31, y: 23 }), { x: 512 - 384, y: 384 - 216 });
});

test('맵이 화면보다 작으면 가운데 놓는다', () => {
  assert.deepEqual(cameraFor({ w: 20, h: 10 }, { x: 3, y: 3 }), { x: (320 - 384) / 2, y: (160 - 216) / 2 });
});

test('부탁 대상 물건: 부탁을 받은 뒤에만, 물건을 얻으면 사라진다', () => {
  const ch = chapterOf(ACT1, '1-1');
  let s = newGame({ nickname: '하늘', avatar: 'f' });
  assert.deepEqual(questObjectSlots(s, ch), []);
  s = talkTo(s, ch, 'dodam').state;
  assert.deepEqual(questObjectSlots(s, ch), ['0']);
  s = { ...s, quests: { ...s.quests, q1: { stage: 'ready', gathered: [] } } };
  assert.deepEqual(questObjectSlots(s, ch), []);
  assert.ok(parseMap(ch.map.rows).objects['0']);
});

test('안개 문 안내는 남은 낱말 수를 센다', async () => {
  const { fogMessage } = await import('../js/explore/hud.js');
  const ch = chapterOf(ACT1, '1-2');
  const s = { ...newGame({ nickname: '하늘', avatar: 'f' }), chapter: '1-2', acquired: { 부리나케: { from: 'x' }, 짬: { from: 'x' } } };
  assert.equal(fogMessage(s, ch), '아직 찾지 못한 낱말이 3개 있어.');
});

test('animKey: 화면 안에 움직이는 그림이 없으면 시간이 흘러도 같고, 있으면 그 모습에 따라 바뀐다', async () => {
  const { animKey } = await import('../js/explore/render.js');
  const ch = chapterOf(ACT1, '1-1');
  const map = parseMap(ch.map.rows);
  let s = newGame({ nickname: '하늘', avatar: 'f' });
  const at = (state, time, extra = {}) => animKey({ map, state, chapter: ch, camera: cameraFor(map, state.pos), time, ...extra });
  // 처음: 화살표도 반짝임도 없다
  assert.equal(at(s, 0), at(s, 600));
  assert.equal(at(s, 0), '');
  // 우물 부탁을 받으면 우물 발밑 화살표가 흔들린다(우물이 화면 안일 때)
  s = talkTo(s, ch, 'dodam').state;
  const well = map.objects['0'];
  const near = { ...s, pos: { x: well.x, y: well.y + 1 } };
  assert.notEqual(at(near, 0), at(near, 400)); // sin(0)=0, sin(1.6)≈1
  // 움직임 줄이기: 흔들리지 않는다
  assert.equal(at(near, 0, { still: true }), at(near, 400, { still: true }));
  // 숨은 낱말 반짝임: 첫 부탁을 받은 뒤, 장독대가 화면 안이면 켜짐/꺼짐이 바뀐다
  const jar = map.objects[ch.hidden.object];
  const byJar = { ...s, pos: { x: jar.x, y: jar.y + 1 } };
  assert.notEqual(at(byJar, 100, { still: true }), at(byJar, 500, { still: true }));
});

test('feetRect: 발이 칸 아래 줄 가운데에 닿는 세계 상자(인물 16×32, 보스 32×32 = 2×2칸)', async () => {
  const { feetRect } = await import('../js/explore/render.js');
  // 인물: 칸 (5,6) → 칸 너비 그대로, 위로 16 솟는다
  assert.deepEqual(feetRect(5, 6, 16, 32), [80, 80, 16, 32]);
  // 보스: 1-2의 M 칸 (15,2) → 좌우 반 칸씩 넓고 위로 한 칸, 아래 끝은 M 칸 아래 줄
  const [x, y, w, h] = feetRect(15, 2, 32, 32);
  assert.deepEqual([x, y, w, h], [232, 16, 32, 32]);
  assert.equal(y + h, 3 * 16);
  assert.equal(x + w / 2, 15 * 16 + 8);
  // 아이콘 16×16은 칸과 같다
  assert.deepEqual(feetRect(3, 4, 16, 16), [48, 64, 16, 16]);
});

test('headTop: 머리 위 표시는 도트 그림이 있으면 16×32 상자 위, 임시 블록이면 블록 위에 붙는다', async () => {
  const { headTop } = await import('../js/explore/render.js');
  assert.equal(headTop(6, true), 6 * 16 - 16);
  assert.equal(headTop(6, false), 6 * 16 - 8);
});
