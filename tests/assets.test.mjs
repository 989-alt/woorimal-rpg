import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ASSETS, UI_KIT, bustFor } from '../data/assets.js';
import { loadImage, getLoaded, preloadChapter, onImageLoaded } from '../js/ui/images.js';
import { ACTS } from '../data/acts/index.js';

const NAME_RULE = /^assets\/(pixel|illust|ui)\/[a-z0-9_.\-]+\.(png|webp)$/;

function* paths(node, trail = '') {
  if (typeof node === 'string') yield [trail, node];
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* paths(v, trail ? `${trail}.${k}` : k);
}

test('그림 경로는 모두 이름 규칙을 따르고 실제 파일이 있다(null 제외)', () => {
  for (const [where, path] of paths(ASSETS)) {
    assert.match(path, NAME_RULE, `${where}: ${path}`);
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${where}: ${path} 파일이 없다`);
  }
});

test('모든 값은 문자열 경로 또는 null이다', () => {
  const walk = (n, where) => {
    if (n === null || typeof n === 'string') return;
    assert.equal(typeof n, 'object', where);
    for (const [k, v] of Object.entries(n)) walk(v, `${where}.${k}`);
  };
  walk(ASSETS, 'ASSETS');
});

test('틀: 장·인물·물건·표정·막 번호 키가 데이터와 맞는다', () => {
  const chapters = ACTS.flatMap((a) => a.chapters);
  assert.deepEqual(Object.keys(ASSETS.maps), chapters.map((c) => c.id));
  assert.deepEqual(Object.keys(ASSETS.dialogueBg), chapters.map((c) => c.id));
  const npcIds = [...new Set(chapters.flatMap((c) => c.npcs.map((n) => n.id)))];
  assert.deepEqual(Object.keys(ASSETS.npcs).sort(), [...npcIds].sort());
  for (const id of npcIds) assert.ok(ASSETS.busts[id], `상반신 ${id}`);
  const itemIds = chapters.flatMap((c) => c.quests.map((q) => q.item?.id)).filter(Boolean);
  assert.deepEqual(Object.keys(ASSETS.items).sort(), [...itemIds].sort());
  assert.deepEqual(Object.keys(ASSETS.walk).sort(), ['f', 'm']);
  assert.deepEqual(Object.keys(ASSETS.battleHero).sort(), ['f', 'm']);
  assert.deepEqual(Object.keys(ASSETS.busts.dodam).sort(), ['base', 'laugh', 'worry']);
  assert.deepEqual(Object.keys(ASSETS.busts.hero_f).sort(), ['base', 'joy', 'surprise']);
  assert.deepEqual(Object.keys(ASSETS.busts.hero_m).sort(), ['base', 'joy', 'surprise']);
  const actNos = ACTS.map((a) => String(a.id));
  for (const key of ['small', 'bossPixel', 'battleBg', 'monster']) assert.deepEqual(Object.keys(ASSETS[key]), actNos, key);
  assert.ok('title' in ASSETS);
});

test('UI 키트: ASSETS.ui는 assets/ui/<이름>.v1.png이고 UI_KIT과 키가 같다', () => {
  assert.ok(ASSETS.ui && UI_KIT, 'ASSETS.ui·UI_KIT 없음');
  assert.deepEqual(Object.keys(ASSETS.ui).sort(), Object.keys(UI_KIT).sort());
  for (const [key, path] of Object.entries(ASSETS.ui)) assert.match(path, /^assets\/ui\/[a-z0-9_]+\.v1\.png$/, `ui.${key}`);
  for (const [key, kit] of Object.entries(UI_KIT)) {
    assert.ok(Number.isInteger(kit.w) && Number.isInteger(kit.h), `${key} 크기`);
    for (const f of ['slice', 'border']) if (kit[f]) assert.equal(kit[f].length, 4, `${key}.${f}`);
  }
});

test('대본의 인물·표정이 상반신 틀에 있다', () => {
  const lines = [];
  const walk = (n) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') { if (n.who) lines.push(n); else Object.values(n).forEach(walk); }
  };
  walk(ACTS);
  assert.ok(lines.length > 20);
  for (const l of lines) {
    if (l.who === 'npc' && l.npc) assert.ok(ASSETS.busts[l.npc], `인물 ${l.npc}`); // 표정 그림이 없으면 base로 대신한다
    if (l.who === 'hero' && l.face) assert.ok(l.face in ASSETS.busts.hero_f && l.face in ASSETS.busts.hero_m, `hero.${l.face}`);
  }
});

test('bustFor: 그 표정, 없으면 base, 그것도 없으면 null', () => {
  const saved = ASSETS.busts.dodam;
  try {
    ASSETS.busts.dodam = { base: null, worry: null, laugh: null };
    assert.equal(bustFor('dodam', 'laugh'), null);
    ASSETS.busts.dodam = { base: 'assets/illust/a.webp', worry: null, laugh: 'assets/illust/b.webp' };
    assert.equal(bustFor('dodam', 'laugh'), 'assets/illust/b.webp');
    assert.equal(bustFor('dodam', 'worry'), 'assets/illust/a.webp'); // 표정 그림이 아직 없으면 base
    assert.equal(bustFor('dodam', 'nope'), 'assets/illust/a.webp');
    assert.equal(bustFor('dodam'), 'assets/illust/a.webp');
    assert.equal(bustFor('nobody', 'base'), null);
    assert.equal(bustFor(undefined, 'base'), null);
  } finally {
    ASSETS.busts.dodam = saved;
  }
});

test('loadImage·getLoaded: 경로가 없거나 브라우저가 아니면 null이고 거부하지 않는다', async () => {
  assert.equal(await loadImage(null), null);
  assert.equal(await loadImage(undefined), null);
  assert.equal(getLoaded(null), null);
  assert.equal(await loadImage('assets/pixel/none_404.png'), null);
  assert.equal(getLoaded('assets/pixel/none_404.png'), null);
  await preloadChapter('1-1', 'f'); // 그림이 없어도 끝난다
  await preloadChapter('9-9', 'f'); // 모르는 장도 오류 없이
  const off = onImageLoaded(() => {});
  assert.equal(typeof off, 'function');
  off();
});
