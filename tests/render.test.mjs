import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraFor, inViewWorld, questObjectSlots } from '../js/explore/render.js';
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

test('카메라: 보이는 크기(view)와 위쪽 HUD 여백(insetTop)에 맞춘다', () => {
  const view = { w: 1366 / 3, h: 256 };
  const inset = 88 / 3;
  // 주인공은 HUD 아래 영역의 가운데
  assert.deepEqual(cameraFor(big, { x: 16, y: 12 }, view, inset).y, 12 * 16 + 8 - (256 + inset) / 2);
  assert.equal(cameraFor(big, { x: 16, y: 12 }, view, inset).x, 16 * 16 + 8 - view.w / 2);
  // 맵 맨 위: HUD 바로 아래에서 맵이 시작한다
  assert.equal(cameraFor(big, { x: 16, y: 0 }, view, inset).y, -inset);
  assert.equal(cameraFor(big, { x: 16, y: 23 }, view, inset).y, 384 - 256);
  // 낮은 맵은 HUD 아래 영역의 가운데
  assert.equal(cameraFor({ w: 20, h: 10 }, { x: 3, y: 3 }, view, inset).y, (160 - 256 - inset) / 2);
  // 맵이 화면 폭보다 좁으면 가로 가운데
  assert.equal(cameraFor({ w: 20, h: 10 }, { x: 3, y: 3 }, view, inset).x, (320 - view.w) / 2);
});

test('inViewWorld: 카메라가 보는 세계 상자 안인지', () => {
  const cam = { x: 100, y: 50 };
  const view = { w: 200, h: 100 };
  assert.equal(inViewWorld(cam, view, { x: 150, y: 80 }), true);
  assert.equal(inViewWorld(cam, view, { x: 99, y: 80 }), false);
  assert.equal(inViewWorld(cam, view, { x: 150, y: 151 }), false);
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

test('walkFrame: 서 있으면 0, 걸으면 1-2-1-3 순서로 125ms마다', async () => {
  const { walkFrame } = await import('../js/explore/render.js');
  assert.equal(walkFrame(0, false), 0);
  assert.equal(walkFrame(130, false), 0);
  assert.deepEqual([0, 125, 250, 375].map((t) => walkFrame(t, true)), [0, 1, 0, 2]);
  assert.equal(walkFrame(124, true), 0);
  assert.equal(walkFrame(500, true), 0); // 한 바퀴(500ms) 돌고 처음으로
  assert.equal(walkFrame(625, true), 1);
});

test('tipLift: 첫 부탁 인물에 도트 그림이 그려져 있을 때만 8', async () => {
  const { tipLift } = await import('../js/explore/render.js');
  const { loadImage, forgetFailed } = await import('../js/ui/images.js');
  const { ASSETS } = await import('../data/assets.js');
  const ch = chapterOf(ACT1, '1-1');
  const map = parseMap(ch.map.rows);
  const giver = ch.npcs.find((n) => n.id === ch.quests[0].giver);
  const at = map.slots[giver.slot];
  // 인물이 없는 칸: 0
  assert.equal(tipLift(ch, map, { x: -1, y: -1 }), 0);
  // 그림이 아직 없다: 0
  assert.equal(tipLift(ch, map, at), 0);
  // 가짜 Image로 그림을 불러온 뒤: 8
  const real = globalThis.Image;
  globalThis.Image = class { set src(_) { setTimeout(() => this.onload?.(), 0); } };
  try {
    forgetFailed(); // 위 확인에서 실패로 남은 기록을 지운다
    await loadImage(ASSETS.npcs[giver.id]);
    assert.equal(tipLift(ch, map, at), 8);
    assert.equal(tipLift(ch, map, { x: -1, y: -1 }), 0);
  } finally {
    if (real) globalThis.Image = real; else delete globalThis.Image;
  }
});

test('haloStep: 숨은 낱말 빛무리는 6초마다(부탁을 다 끝낸 뒤에는 3초마다) 1.2초 동안, 50ms 단계', async () => {
  const { haloStep, HALO_MS } = await import('../js/explore/render.js');
  assert.equal(HALO_MS, 1200);
  assert.equal(haloStep('none', 0), null);
  assert.equal(haloStep('dim', 0), 0);
  assert.equal(haloStep('dim', 1199), 23);
  assert.equal(haloStep('dim', 1200), null);
  assert.equal(haloStep('dim', 3000), null);
  assert.equal(haloStep('dim', 6000), 0);
  assert.equal(haloStep('bright', 3000), 0);
  assert.equal(haloStep('bright', 2999), null);
  assert.equal(haloStep('bright', 4100), 22);
});

test('animKey: 빛무리는 보이는 때 단계마다 바뀌고, 쉬는 동안·화면 밖에서는 그대로다', async () => {
  const { animKey } = await import('../js/explore/render.js');
  const ch = chapterOf(ACT1, '1-1');
  const map = parseMap(ch.map.rows);
  const s = talkTo(newGame({ nickname: '하늘', avatar: 'f' }), ch, 'dodam').state; // 주머니를 받아 빛무리가 켜지는 상태
  const jar = map.objects[ch.hidden.object];
  const near = { ...s, pos: { x: jar.x, y: jar.y + 1 } };
  const far = { ...s, pos: { x: 22, y: 19 } }; // 시작 자리 맞은편: 장독대가 화면 밖
  const at = (state, time, extra = {}) => animKey({ map, state, chapter: ch, camera: cameraFor(map, state.pos), time, ...extra });
  assert.equal(at(near, 1300), at(near, 5900)); // 쉬는 동안
  assert.notEqual(at(near, 1000), at(near, 1060)); // 보이는 동안 50ms 단계
  assert.equal(at(near, 1000), at(near, 1040));
  assert.notEqual(at(near, 1150), at(near, 1250)); // 끝나면 지워지려고 한 번 더
  assert.equal(at({ ...far, bag: [] }, 100, { camera: { x: 0, y: 0 }, view: { w: 100, h: 100 } }), ''); // 화면 밖
});

test('animKey: 깜박이는 인물 표시는 화면 안에서 250ms마다 바뀌고, 깜박임이 끝나면(null) 멈춘다', async () => {
  const { animKey, blinkAt } = await import('../js/explore/render.js');
  const ch = chapterOf(ACT1, '1-1');
  const map = parseMap(ch.map.rows);
  const daon = map.slots.b;
  const s = { ...newGame({ nickname: '하늘', avatar: 'f' }), pos: { x: daon.x, y: daon.y + 1 } };
  const at = (time, flashNpc) => animKey({ map, state: s, chapter: ch, camera: cameraFor(map, s.pos), time, flashNpc });
  assert.deepEqual([0, 249, 250, 499, 500].map(blinkAt), [0, 0, 1, 1, 0]);
  assert.notEqual(at(0, 'daon'), at(300, 'daon'));
  assert.equal(at(0, 'daon'), at(100, 'daon'));
  assert.equal(at(0, null), at(300, null));
  assert.equal(at(0, null), '');
});
