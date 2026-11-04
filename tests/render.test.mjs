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
