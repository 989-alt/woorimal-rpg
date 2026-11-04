// 그림 규격·용량 검사(art-bible 8절). 의존성 없이 파일 머리(PNG IHDR·PLTE, WebP VP8X/VP8/VP8L)만 읽는다.
// - 데이터가 가리키는 그림이 모두 있고, 쓰지 않는 그림 파일이 없다.
// - 종류별 크기(가로×세로)와 파일 상한.
// - 처음 열 때 3MB 이하, 장마다 6MB 이하(학생은 고른 주인공 모습 하나만 받는다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ASSETS, UI_KIT } from '../data/assets.js';
import { ACTS } from '../data/acts/index.js';
import { chapterPaths } from '../js/ui/images.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const KB = 1000;
const MB = 1000 * 1000;
const FIRST_LOAD_MAX = 3 * MB;
const CHAPTER_MAX = 6 * MB;

const abs = (p) => join(ROOT, p);
const bytes = (p) => statSync(abs(p)).size;

// PNG: { w, h, colorType, palette, alpha }  (색 방식 3 = 색표, alpha = 색표 투명(tRNS) 또는 알파 채널)
export function pngInfo(buf) {
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG 서명');
  const info = { w: 0, h: 0, colorType: -1, palette: 0, alpha: false };
  for (let o = 8; o + 8 <= buf.length;) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    if (type === 'IHDR') {
      info.w = buf.readUInt32BE(o + 8); info.h = buf.readUInt32BE(o + 12); info.colorType = buf[o + 17];
      if (info.colorType === 4 || info.colorType === 6) info.alpha = true;
    }
    if (type === 'PLTE') info.palette = len / 3;
    if (type === 'tRNS') info.alpha = true;
    if (type === 'IDAT' || type === 'IEND') break;
    o += 12 + len;
  }
  return info;
}

// WebP: { w, h, alpha }
export function webpInfo(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'RIFF');
  assert.equal(buf.toString('latin1', 8, 12), 'WEBP');
  const kind = buf.toString('latin1', 12, 16);
  if (kind === 'VP8X') {
    return {
      w: 1 + buf.readUIntLE(24, 3),
      h: 1 + buf.readUIntLE(27, 3),
      alpha: (buf[20] & 0x10) !== 0,
    };
  }
  if (kind === 'VP8 ') {
    assert.equal(buf.subarray(23, 26).toString('hex'), '9d012a', 'VP8 시작 부호');
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, alpha: false };
  }
  if (kind === 'VP8L') {
    assert.equal(buf[20], 0x2f, 'VP8L 서명');
    const v = buf.readUInt32LE(21);
    return { w: 1 + (v & 0x3fff), h: 1 + ((v >>> 14) & 0x3fff), alpha: ((v >>> 28) & 1) === 1 };
  }
  throw new Error(`모르는 WebP 형식 ${kind}`);
}

const head = (p) => readFileSync(abs(p)).subarray(0, 4096);
const imageInfo = (p) => (p.endsWith('.png') ? pngInfo(head(p)) : webpInfo(head(p)));

// ASSETS의 갈래마다 규격: 크기, 파일 상한(바이트), 투명이 있어야 하는지(WebP)
const SPEC = {
  maps: { w: 1536, h: 1152, max: 700 * KB },
  walk: { w: 144, h: 384, max: 40 * KB },
  npcs: { w: 48, h: 96, max: 16 * KB },
  items: { w: 48, h: 48, max: 8 * KB },
  small: { w: 48, h: 96, max: 16 * KB },
  bossPixel: { w: 96, h: 96, max: 24 * KB },
  busts: { w: 1080, h: 1440, max: 300 * KB, alpha: true },
  dialogueBg: { w: 2560, h: 1440, max: 700 * KB },
  battleBg: { w: 2560, h: 1440, max: 700 * KB },
  battleHero: { w: 1080, h: 1440, max: 300 * KB, alpha: true },
  monster: { w: 1440, h: 1440, max: 400 * KB, alpha: true },
  title: { w: 2560, h: 1440, max: 700 * KB },
  // UI 키트: 키마다 UI_KIT의 그림 크기. 상한은 틀·버튼·메달·리본 40KB, 로고 200KB, 아이콘 12KB(아트 바이블 8절).
  ui: Object.fromEntries(Object.entries(UI_KIT).map(([key, { w, h }]) => [key, { w, h, max: uiMax(key), alpha: true }])),
};
const UI_ICONS = ['iconBook', 'iconScroll', 'heartFull', 'heartEmpty', 'hpCell', 'coin', 'check'];
function uiMax(key) {
  if (key === 'logo') return 200 * KB;
  return UI_ICONS.includes(key) ? 12 * KB : 40 * KB;
}
const UI_TOTAL_MAX = 500 * KB;
const specFor = (group, where) => (group === 'ui' ? SPEC.ui[where.split('.')[1]] : SPEC[group]);

function* entries(node, trail) {
  if (typeof node === 'string') yield [trail, node];
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* entries(v, `${trail}.${k}`);
}
const all = Object.keys(ASSETS).flatMap((group) => [...entries(ASSETS[group], group)].map(([where, path]) => ({ group, where, path })));

function filesUnder(dir) {
  if (!existsSync(abs(dir))) return [];
  return readdirSync(abs(dir), { recursive: true })
    .map((f) => join(dir, String(f)))
    .filter((f) => statSync(abs(f)).isFile())
    .map((f) => f.split('\\').join('/'));
}

test('그림 경로가 모두 실제 파일이고, assets/의 그림은 모두 데이터가 쓴다', () => {
  assert.ok(all.length > 30);
  for (const { where, path } of all) assert.ok(existsSync(abs(path)), `${where}: ${path} 없음`);
  const used = new Set(all.map((a) => a.path));
  const unused = filesUnder('assets').filter((f) => !used.has(f));
  assert.deepEqual(unused, [], '쓰지 않는 그림 파일');
});

test('갈래마다 크기·파일 상한이 아트 바이블 8절과 맞는다', () => {
  for (const group of Object.keys(ASSETS)) assert.ok(SPEC[group], `규격 없는 갈래: ${group}`);
  for (const { group, where, path } of all) {
    const spec = specFor(group, where);
    assert.ok(spec, `규격 없는 그림: ${where}`);
    const info = imageInfo(path);
    assert.deepEqual([info.w, info.h], [spec.w, spec.h], `${where}: ${path} 크기`);
    assert.ok(bytes(path) <= spec.max, `${where}: ${path} ${bytes(path)}B > ${spec.max}B`);
    if (path.endsWith('.png')) assert.equal(info.colorType, 3, `${where}: 8비트 색표 PNG여야 한다`);
    if (spec.alpha) assert.ok(info.alpha, `${where}: 투명이 있어야 한다`);
    if (group === 'ui') assert.ok(info.colorType === 3 && info.alpha, `${where}: 8비트 색표 + 투명(tRNS) PNG여야 한다`);
  }
});

test(`UI 키트: assets/ui 합계 ${UI_TOTAL_MAX / KB}KB 이하`, () => {
  assert.ok(ASSETS.ui, 'ASSETS.ui 없음');
  const total = sum(filesUnder('assets/ui'));
  console.log(`# ui kit ${(total / KB).toFixed(0)} KB`);
  assert.ok(total <= UI_TOTAL_MAX, `assets/ui ${total}B > ${UI_TOTAL_MAX}B`);
});

test('맵: 64색 이하, 크기 = 칸 수 × 48', () => {
  for (const act of ACTS) {
    for (const ch of act.chapters) {
      const path = ASSETS.maps[ch.id];
      if (!path) continue;
      const info = pngInfo(head(path));
      assert.ok(info.palette > 0 && info.palette <= 64, `${path} ${info.palette}색`);
      assert.deepEqual([info.w, info.h], [ch.map.rows[0].length * 48, ch.map.rows.length * 48], path);
    }
  }
});

const sum = (paths) => [...new Set(paths)].reduce((n, p) => n + bytes(p), 0);
const mb = (n) => (n / MB).toFixed(2);

// 처음 열 때 받는 것(아트 바이블 8절): 코드·데이터 + 글꼴 + UI 키트 + 타이틀 + 모습 카드 상반신 둘 + 1장(1-1) 도트.
// 1-1 도트 = 맵, 여 주인공 걷기, 1-1 인물 도트, 1-1 물건 아이콘, 1막 꼬마 몬스터·보스 도트.
// 대화·전투 일러스트는 장 예산(6MB)에서 센다.
export function firstLoadPaths() {
  const code = ['index.html', ...filesUnder('css'), ...filesUnder('js'), ...filesUnder('data')];
  const act1 = ACTS[0];
  const ch = act1.chapters[0];
  const itemIds = new Set(ch.quests.map((q) => q.item?.id).filter(Boolean));
  for (const obj of ch.objects) if (obj.item?.id) itemIds.add(obj.item.id);
  const art = [
    ...filesUnder('assets/ui'), ...filesUnder('assets/fonts'),
    ASSETS.title, ASSETS.busts.hero_f.base, ASSETS.busts.hero_m.base,
    ASSETS.maps[ch.id], ASSETS.walk.f, ...ch.npcs.map((n) => ASSETS.npcs[n.id]),
    ...[...itemIds].map((id) => ASSETS.items[id]), ASSETS.small[act1.id], ASSETS.bossPixel[act1.id],
  ];
  return [...code, ...art.filter(Boolean)];
}

test(`처음 열 때 ${FIRST_LOAD_MAX / MB}MB 이하`, () => {
  const total = sum(firstLoadPaths());
  console.log(`# first load ${mb(total)} MB`);
  assert.ok(total <= FIRST_LOAD_MAX, `처음 열 때 ${mb(total)}MB`);
});

test(`장마다 ${CHAPTER_MAX / MB}MB 이하(주인공 모습 하나)`, () => {
  for (const act of ACTS) {
    for (const ch of act.chapters) {
      for (const avatar of ['f', 'm']) {
        const paths = chapterPaths(act, ch, avatar);
        const total = sum(paths);
        console.log(`# chapter ${ch.id} (${avatar}) ${mb(total)} MB, ${paths.length} files`);
        assert.ok(total <= CHAPTER_MAX, `${ch.id} (${avatar}) ${mb(total)}MB`);
        // 고른 모습과 다른 주인공 그림이 섞이지 않는다
        const other = avatar === 'f' ? '_m' : '_f';
        assert.deepEqual(paths.filter((p) => p.includes(`hero${other}`)), [], `${ch.id} ${avatar}`);
      }
    }
  }
});

test('헤더 읽기: 시험 그림(16×32 PNG)', () => {
  const info = pngInfo(readFileSync(join(ROOT, 'tests/fixtures/sprite-16x32.png')));
  assert.deepEqual([info.w, info.h], [16, 32]);
});
