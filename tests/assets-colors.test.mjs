// 그림 색 쓰임 검사(2~5막 그림 계획 Global Constraints, 아트 바이블 4·6절).
// 도트 그림(PNG)의 색표(PLTE)에서 투명(tRNS 알파 0) 칸을 빼고 읽는다.
// 예약 색 묶음은 design/art/sprite-palette.json의 reserved(tools/art/sprites.py, tools/map-fit.py와 같은 값).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, basename } from 'node:path';
import { ASSETS } from '../data/assets.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RESERVED = JSON.parse(readFileSync(join(ROOT, 'design/art/sprite-palette.json'), 'utf8')).reserved;
const GROUPS = ['maps', 'walk', 'npcs', 'items', 'small', 'bossPixel', 'worldmap'];

// PNG 색표에서 보이는 색('#RRGGBB')만
function pngColors(buf) {
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG 서명');
  let plte = null, trns = null;
  for (let o = 8; o + 8 <= buf.length;) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    if (type === 'PLTE') plte = buf.subarray(o + 8, o + 8 + len);
    if (type === 'tRNS') trns = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IDAT' || type === 'IEND') break;
    o += 12 + len;
  }
  assert.ok(plte, '색표 PNG');
  const out = new Set();
  for (let i = 0; i < plte.length / 3; i++) {
    if (trns && i < trns.length && trns[i] === 0) continue;
    out.add('#' + [...plte.subarray(i * 3, i * 3 + 3)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase());
  }
  return out;
}

// [{ group, key, path, colors }]
const FILES = [];
for (const g of GROUPS) {
  const v = ASSETS[g];
  const entries = typeof v === 'string' ? [[g, v]] : v ? Object.entries(v) : [];
  for (const [key, path] of entries) {
    if (path) FILES.push({ group: g, key, path, colors: pngColors(readFileSync(join(ROOT, path))) });
  }
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
const sat = (h) => { const c = rgb(h), mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };

function owner(path) {
  const f = basename(path);
  if (/^walk_hero_/.test(f)) return 'hero';
  const m = f.match(/^npc_(dodam|haesol|narae)\.png$/);
  return m ? m[1] : null;
}

test('그림 목록이 비어 있지 않다', () => {
  assert.ok(FILES.length > 0);
});

test('대표색과 그 음영은 주인 그림에만', () => {
  const bad = [];
  for (const f of FILES) {
    for (const who of ['hero', 'dodam', 'haesol', 'narae']) {
      if (owner(f.path) === who) continue;
      const hit = RESERVED[who].filter((c) => f.colors.has(c));
      if (hit.length) bad.push(`${f.path}: ${who} ${hit.join(' ')}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('말빛 금은 icon_light-shard.png에만', () => {
  const bad = FILES.filter((f) => basename(f.path) !== 'icon_light-shard.png')
    .filter((f) => RESERVED.gold.some((c) => f.colors.has(c)))
    .map((f) => f.path);
  assert.deepEqual(bad, []);
});

test('몬스터 도트와 npc_greykid는 잿빛 3단만', () => {
  const bad = [];
  for (const f of FILES) {
    if (!(f.group === 'small' || f.group === 'bossPixel' || basename(f.path) === 'npc_greykid.png')) continue;
    const other = [...f.colors].filter((c) => !RESERVED.fog.includes(c));
    if (other.length) bad.push(`${f.path}: ${other.join(' ')}`);
  }
  assert.deepEqual(bad, []);
});

test('맵: 잿빛 3단은 4-1·4-2에만, 5막 맵은 모든 색 채도 ≤ 0.25이고 잿빛 3단과 거리 12 안의 색이 없다', () => {
  const bad = [];
  for (const f of FILES.filter((x) => x.group === 'maps')) {
    if (!['4-1', '4-2'].includes(f.key)) {
      const hit = RESERVED.fog.filter((c) => f.colors.has(c));
      if (hit.length) bad.push(`${f.path}: 잿빛 ${hit.join(' ')}`);
    }
    if (f.key.startsWith('5-')) {
      for (const c of f.colors) {
        if (sat(c) > 0.25) bad.push(`${f.path}: 채도 ${sat(c).toFixed(2)} ${c}`);
        if (RESERVED.fog.some((g) => dist(c, g) < 12)) bad.push(`${f.path}: 잿빛에 가까운 ${c}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
