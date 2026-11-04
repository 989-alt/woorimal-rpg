import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { ACTS } from '../data/acts/index.js';
import { parseMap } from '../js/explore/grid.js';

const VENV_PY = '/root/.local/share/sprite-gen/.venv/bin/python';

function decodePng(buf) {
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let pos = 8, w = 0, h = 0, colorType = 0, plte = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
    if (type === 'PLTE') plte = data;
    if (type === 'tRNS') trns = data;
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  return { w, h, colorType, plte, trns, raw: inflateSync(Buffer.concat(idat)) };
}

function rgbPixel(png, x, y) {
  assert.equal(png.colorType, 2);
  const stride = 1 + png.w * 3;
  assert.equal(png.raw[y * stride], 0, 'filter 0 expected');
  const o = y * stride + 1 + x * 3;
  return [...png.raw.subarray(o, o + 3)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

test('layout-guide: 512x384 and tile colours follow the 1-1 grid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lg-'));
  const out = join(dir, 'g.png');
  execFileSync('node', ['tools/layout-guide.mjs', '1-1', out]);
  const png = decodePng(readFileSync(out));
  assert.equal(png.w, 512);
  assert.equal(png.h, 384);
  const chapter = ACTS.flatMap((a) => a.chapters).find((c) => c.id === '1-1');
  const map = parseMap(chapter.map.rows);
  const at = (x, y) => rgbPixel(png, x * 16 + 8, y * 16 + 8);
  assert.equal(at(0, 0), '3E7A3A');
  assert.equal(at(8, 8), 'E8C88A');
  assert.equal(at(map.start.x, map.start.y), 'E8C88A');
  assert.equal(at(map.slots.a.x, map.slots.a.y), 'F2F2F2');
  assert.equal(at(map.objects['1'].x, map.objects['1'].y), '8B5A2B');
  // NPC square sits over a path background (tile corner is path colour)
  assert.equal(rgbPixel(png, map.slots.a.x * 16, map.slots.a.y * 16), 'E8C88A');
  assert.equal(at(map.smallMonster.x, map.smallMonster.y), '5E6266');
});

test('pixelize: <=32 colours and alpha only 0/255', (t) => {
  if (!existsSync(VENV_PY)) return t.skip(`sprite-gen venv python missing (${VENV_PY})`);
  const dir = mkdtempSync(join(tmpdir(), 'px-'));
  const src = join(dir, 'in.png'), dst = join(dir, 'out.png');
  const mk = `
from PIL import Image
im = Image.new('RGBA', (160, 120))
px = im.load()
for y in range(120):
    for x in range(160):
        px[x, y] = ((x * 5) % 256, (y * 7) % 256, (x * y) % 256, 255 if x > 20 else (x * 12) % 256)
im.save(${JSON.stringify(src)})
`;
  execFileSync(VENV_PY, ['-I', '-c', mk]);
  execFileSync(VENV_PY, ['-I', 'tools/pixelize.py', src, dst, '--size', '40x30', '--palette', 'tools/palette.json', '--max-colors', '32']);
  const check = `
from PIL import Image
im = Image.open(${JSON.stringify(dst)})
assert im.size == (40, 30), im.size
rgba = im.convert('RGBA')
cols = set(); alphas = set()
for r, g, b, a in rgba.getdata():
    alphas.add(a)
    if a: cols.add((r, g, b))
print(len(cols), sorted(alphas), im.mode)
`;
  const out = execFileSync(VENV_PY, ['-I', '-c', check]).toString().trim();
  const m = out.match(/^(\d+) (\[.*\]) (\w+)$/);
  assert.ok(m, out);
  assert.ok(Number(m[1]) <= 32, `colours ${m[1]}`);
  assert.ok(JSON.parse(m[2].replaceAll("'", '"')).every((a) => a === 0 || a === 255), m[2]);
  assert.equal(m[3], 'P');
});

test('pixelize: fails when palette exceeds --max-colors', (t) => {
  if (!existsSync(VENV_PY)) return t.skip(`sprite-gen venv python missing (${VENV_PY})`);
  const dir = mkdtempSync(join(tmpdir(), 'px-'));
  const src = join(dir, 'in.png');
  execFileSync(VENV_PY, ['-I', '-c', `
from PIL import Image
im = Image.new('RGB', (30, 1))
for x in range(30): im.putpixel((x, 0), (x * 8, 255 - x * 8, 100))
im.save(${JSON.stringify(src)})`]);
  const r = spawnSync(VENV_PY, ['-I', 'tools/pixelize.py', src, join(dir, 'o.png'), '--size', '30x1', '--max-colors', '2']);
  assert.notEqual(r.status, 0);
});

// --- ui-slice ---------------------------------------------------------------

function pyRun(code) {
  return execFileSync(VENV_PY, ['-I', '-c', code]).toString().trim();
}

// 일부러 비대칭인 원본: 가장자리에 투명 여백 10px, 안쪽 200x200은 왼쪽 위 빨강·오른쪽 위 파랑·나머지 초록
function makeAsymmetricSource(path) {
  pyRun(`
from PIL import Image
im = Image.new('RGBA', (220, 220), (0, 0, 0, 0))
inner = Image.new('RGBA', (200, 200), (40, 160, 60, 255))
for y in range(200):
    for x in range(200):
        if x < 60 and y < 60: inner.putpixel((x, y), (230, 20, 20, 255))
        elif x >= 140 and y < 60: inner.putpixel((x, y), (20, 30, 230, 255))
        elif y < 60: inner.putpixel((x, y), (230, 200, 40, 255))
        elif x < 60: inner.putpixel((x, y), (150, 40, 200, 255))
im.paste(inner, (10, 10))
im.save(${JSON.stringify(path)})
`);
}

function uiSliceSetup(t) {
  if (!existsSync(VENV_PY)) { t.skip(`sprite-gen venv python missing (${VENV_PY})`); return null; }
  const dir = mkdtempSync(join(tmpdir(), 'ui-'));
  const src = join(dir, 'src.png');
  makeAsymmetricSource(src);
  return { dir, src };
}

function inspectFrame(path, checks) {
  return pyRun(`
from PIL import Image
im = Image.open(${JSON.stringify(path)})
${checks}
`);
}

test('ui-slice frame: 크기·색표·좌우와 위아래 대칭·가운데 투명', (t) => {
  const s = uiSliceSetup(t); if (!s) return;
  const out = join(s.dir, 'frame.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'frame', s.src, out, '--size', '144x144', '--slice', '48,48,48,48', '--src-corner', '60']);
  const r = inspectFrame(out, `
rgba = im.convert('RGBA'); px = rgba.load()
sym = all(px[x, y] == px[143 - x, y] == px[x, 143 - y] for y in range(144) for x in range(144))
print(im.size, im.mode, 'transparency' in im.info, sym, px[72, 72][3], px[0, 0][3], px[5, 5][3])
`);
  const m = r.match(/^\((\d+), (\d+)\) (\w+) (True|False) (True|False) (\d+) (\d+) (\d+)$/);
  assert.ok(m, r);
  assert.deepEqual([m[1], m[2], m[3], m[4], m[5], m[6]], ['144', '144', 'P', 'True', 'True', '0']);
  assert.equal(m[8], '255', '모서리 안쪽은 불투명');
});

test('ui-slice frame --fill: 가운데가 채워진다', (t) => {
  const s = uiSliceSetup(t); if (!s) return;
  const out = join(s.dir, 'fill.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'frame', s.src, out, '--size', '144x144', '--slice', '48,48,48,48', '--src-corner', '60', '--fill']);
  assert.equal(inspectFrame(out, `print(im.convert('RGBA').getpixel((72, 72))[3])`), '255');
});

test('ui-slice frame --asym-right: 오른쪽은 원본 오른쪽에서 온다', (t) => {
  const s = uiSliceSetup(t); if (!s) return;
  const out = join(s.dir, 'asym.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'frame', s.src, out, '--size', '144x144', '--slice', '48,48,48,48', '--src-corner', '60', '--asym-right']);
  // 왼쪽 위는 빨강, 오른쪽 위는 파랑(대칭이었다면 빨강)
  const r = inspectFrame(out, `
px = im.convert('RGBA').load()
print(px[4, 4][0] > 150, px[139, 4][2] > 150)
`);
  assert.equal(r, 'True True');
});

test('ui-slice bar: 높이에 맞춰 줄이고 왼 끝을 거울로, 위아래는 뒤집지 않는다(버튼 윤기·아랫단)', (t) => {
  if (!existsSync(VENV_PY)) { t.skip(`sprite-gen venv python missing (${VENV_PY})`); return; }
  const dir = mkdtempSync(join(tmpdir(), 'ui-'));
  const src = join(dir, 'pill.png');
  // 600x200 알약(여백 10, 네 귀퉁이 투명): 왼 끝 60px 빨강, 오른 끝 60px 파랑, 가운데는 위 밝은 초록 → 아래 짙은 초록
  pyRun(`
from PIL import Image
im = Image.new('RGBA', (620, 220), (0, 0, 0, 0))
for y in range(200):
    g = 230 - y
    for x in range(600):
        if (x < 20 or x >= 580) and (y < 20 or y >= 180): continue  # 둥근 끝 흉내: 네 귀퉁이는 투명
        c = (230, 20, 20, 255) if x < 60 else (20, 30, 230, 255) if x >= 540 else (40, g, 60, 255)
        im.putpixel((x + 10, y + 10), c)
im.save(${JSON.stringify(src)})
`);
  const out = join(dir, 'bar.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'bar', src, out, '--size', '192x144', '--slice', '48,64,32,64']);
  const r = inspectFrame(out, `
px = im.convert('RGBA').load()
sym = all(px[x, y] == px[191 - x, y] for y in range(144) for x in range(192))
print(im.size, im.mode, 'transparency' in im.info, sym, px[4, 72][0] > 150, px[96, 4][1] > px[96, 139][1] + 60)
`);
  assert.equal(r, '(192, 144) P True True True True');
  // --asym-right: 오른쪽 끝은 원본 오른쪽(파랑)에서 온다
  const asym = join(dir, 'bar-asym.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'bar', src, asym, '--size', '192x144', '--slice', '48,64,32,64', '--asym-right']);
  assert.equal(inspectFrame(asym, `px = im.convert('RGBA').load(); print(px[4, 72][0] > 150, px[187, 72][2] > 150)`), 'True True');
  // --mask: 위아래 조각이 0이어도 된다. RGB는 흰색, 귀퉁이는 투명으로 모양이 남는다
  const mask = join(dir, 'bar-mask.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'bar', src, mask, '--size', '300x104', '--slice', '0,80,0,80', '--mask']);
  assert.equal(inspectFrame(mask, `
rgba = im.convert('RGBA')
print(im.size, all(p[:3] == (255, 255, 255) for p in rgba.getdata() if p[3] > 0), rgba.getpixel((0, 0))[3], rgba.getpixel((40, 52))[3] > 250)
`), '(300, 104) True 0 True');
  // --flat-middle: 가운데 띠가 왼 끝 맨 오른쪽 열(63)의 되풀이라 끝 조각과 이음매가 없다. 기본은 원본 가운데 띠
  const flat = join(dir, 'bar-flat.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'bar', src, flat, '--size', '192x144', '--slice', '48,64,32,64', '--flat-middle']);
  assert.equal(inspectFrame(flat, `
px = im.convert('RGBA').load()
same = all(px[x, y] == px[63, y] for y in range(30, 110) for x in range(64, 128))
print(same, px[4, 72][0] > 150, px[187, 72][0] > 150)
`), 'True True True');
});

test('ui-slice mask: 위·아래 조각이 0이면 알아볼 수 있는 말로 멈춘다', (t) => {
  const s = uiSliceSetup(t); if (!s) return;
  const r = spawnSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'mask', s.src, join(s.dir, 'm.png'), '--size', '400x104', '--slice', '0,80,0,80', '--src-corner', '60']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr.toString(), /bar --mask/);
  assert.doesNotMatch(r.stderr.toString(), /Traceback/);
});

test('ui-slice sheet: 덩어리 셋을 이름 순서대로', (t) => {
  const s = uiSliceSetup(t); if (!s) return;
  const sheet = join(s.dir, 'sheet.png');
  pyRun(`
from PIL import Image, ImageDraw
im = Image.new('RGBA', (300, 200), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rectangle([10, 10, 60, 50], fill=(220, 30, 30, 255))      # a: 위 왼쪽
d.rectangle([150, 20, 230, 90], fill=(30, 200, 30, 255))    # b: 위 오른쪽
d.rectangle([40, 130, 120, 190], fill=(30, 30, 220, 255))   # c: 아래
im.save(${JSON.stringify(sheet)})
`);
  const outDir = join(s.dir, 'parts');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'sheet', sheet, outDir, '--names', 'a,b,c', '--size', '40x40']);
  const want = { a: '(220, 30, 30)', b: '(30, 200, 30)', c: '(30, 30, 220)' };
  for (const [name, color] of Object.entries(want)) {
    const r = pyRun(`
from PIL import Image
from collections import Counter
im = Image.open(${JSON.stringify(join(outDir, name + '.png'))})
c = Counter(p[:3] for p in im.convert('RGBA').getdata() if p[3] == 255)
print(im.size, im.mode, c.most_common(1)[0][0])
`);
    assert.equal(r, `(40, 40) P ${color}`, name);
  }
});

test('ui-slice mask: 흰색 + 알파, 좌우 대칭, 구멍은 투명', (t) => {
  const s = uiSliceSetup(t); if (!s) return;
  // 원본 가운데에 투명 구멍을 뚫는다(모양이 알파로 남아야 한다)
  const holed = join(s.dir, 'holed.png');
  pyRun(`
from PIL import Image
im = Image.open(${JSON.stringify(s.src)})
for y in range(100, 120):
    for x in range(0, 220):
        im.putpixel((x, y), (0, 0, 0, 0))
im.save(${JSON.stringify(holed)})
`);
  const out = join(s.dir, 'mask.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'mask', holed, out, '--size', '160x80', '--slice', '20,40,20,40', '--src-corner', '60']);
  const r = inspectFrame(out, `
px = im.convert('RGBA').load(); w, h = im.size
white = all(px[x, y][:3] == (255, 255, 255) for y in range(h) for x in range(w) if px[x, y][3])
sym = all(px[x, y] == px[w - 1 - x, y] for y in range(h) for x in range(w))
alphas = {px[x, y][3] for y in range(h) for x in range(w)}
print(im.size, im.mode, white, sym, 'transparency' in im.info, len(alphas) > 1, px[80, 40][3], px[2, 2][3] > 200)
`);
  assert.match(r, /^\(160, 80\) P True True True True 0 True$/, r);
});

// --- layout-guide --rows · map-fit · kie-gen 장부 ---------------------------

const chapterById = (id) => ACTS.flatMap((a) => a.chapters).find((c) => c.id === id);
const WALK_RE = /[.Sa-eFmM]/;

// 장 행대로 칸당 16px 합성 맵: 걸을 수 있는 칸과 출구 통로는 길 색, 나머지는 풀색. (dx, dy)칸만큼 민다.
async function synthMap(id, dir, { dx = 0, dy = 0, passageAsPath = true } = {}) {
  const { encodePng, exitPassage } = await import('../tools/layout-guide.mjs');
  const ch = chapterById(id);
  const rows = ch.map.rows;
  const T = 16, W = rows[0].length * T, H = rows.length * T;
  const passage = new Set(exitPassage(rows, ch.exit).map(([x, y]) => `${x},${y}`));
  const PATH = [0xE8, 0xC8, 0x8A], BLOCK = [0x3E, 0x7A, 0x3A];
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x - dx * T, sy = y - dy * T;
      let c = BLOCK;
      if (sx >= 0 && sy >= 0 && sx < W && sy < H) {
        const tx = Math.floor(sx / T), ty = Math.floor(sy / T);
        if (WALK_RE.test(rows[ty][tx]) || (passageAsPath && passage.has(`${tx},${ty}`))) c = PATH;
      }
      buf.set(c, (y * W + x) * 3);
    }
  }
  const out = join(dir, `synth_${id}_${dx}_${dy}.png`);
  writeFileSync(out, encodePng(W, H, buf));
  return out;
}

const mapFit = (...args) => spawnSync(VENV_PY, ['-I', 'tools/map-fit.py', ...args], { encoding: 'utf8' });

test('layout-guide --rows: 장 행을 JSON으로', () => {
  const out = execFileSync('node', ['tools/layout-guide.mjs', '--rows', '2-1']).toString();
  assert.deepEqual(JSON.parse(out), ACTS[1].chapters[0].map.rows);
});

test('map-fit score: 행대로 그린 맵은 bad 0, 두 칸 밀면 bad > 0', async (t) => {
  if (!existsSync(VENV_PY)) return t.skip(`sprite-gen venv python missing (${VENV_PY})`);
  const dir = mkdtempSync(join(tmpdir(), 'fit-'));
  const ok = mapFit('score', await synthMap('2-1', dir), '2-1');
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /^bad 0$/m);
  const shifted = mapFit('score', await synthMap('2-1', dir, { dx: 2 }), '2-1');
  assert.equal(shifted.status, 1, shifted.stdout + shifted.stderr);
  const n = Number(shifted.stdout.match(/^bad (\d+)$/m)?.[1]);
  assert.ok(n > 0, shifted.stdout);
});

test('map-fit warp: 두 칸 민 맵을 되돌린다(iou_after ≥ 0.95, score bad 0)', async (t) => {
  if (!existsSync(VENV_PY)) return t.skip(`sprite-gen venv python missing (${VENV_PY})`);
  const dir = mkdtempSync(join(tmpdir(), 'fit-'));
  const src = await synthMap('2-1', dir, { dx: 2 });
  const out = join(dir, 'warped.png');
  const r = mapFit('warp', src, '2-1', out);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const rep = JSON.parse(readFileSync(out + '.warp.json', 'utf8'));
  for (const k of ['iou_before', 'iou_after', 'kx', 'vx', 'ky', 'vy']) assert.ok(k in rep, k);
  assert.ok(rep.iou_after >= 0.95, `iou_after ${rep.iou_after}`);
  assert.ok(rep.iou_after > rep.iou_before);
  const s = mapFit('score', out, '2-1');
  assert.equal(s.status, 0, s.stdout);
});

test('map-fit score: 출구 통로(3-2의 (22..31,1))는 길처럼 그려도 bad가 아니다', async (t) => {
  if (!existsSync(VENV_PY)) return t.skip(`sprite-gen venv python missing (${VENV_PY})`);
  const { exitPassage } = await import('../tools/layout-guide.mjs');
  const ch = chapterById('3-2');
  assert.deepEqual(exitPassage(ch.map.rows, ch.exit), Array.from({ length: 10 }, (_, i) => [22 + i, 1]));
  const dir = mkdtempSync(join(tmpdir(), 'fit-'));
  const r = mapFit('score', await synthMap('3-2', dir), '3-2');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

const SPRITE_PAL = JSON.parse(readFileSync('design/art/sprite-palette.json', 'utf8'));
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };

test('map-fit palette(원본 assets/pixel/map_ch1-1_saebyeokgol.png): 64색 이하, 예약 색(대표색·말빛 금) 없음, --max-sat 0.25면 모든 색 채도 ≤ 0.25, --allow-fog 없으면 잿빛 3단 없음', (t) => {
  if (!existsSync(VENV_PY)) return t.skip(`sprite-gen venv python missing (${VENV_PY})`);
  const dir = mkdtempSync(join(tmpdir(), 'fit-'));
  const src = 'assets/pixel/map_ch1-1_saebyeokgol.png';
  const res = SPRITE_PAL.reserved;
  const owned = ['hero', 'dodam', 'haesol', 'narae', 'gold'].flatMap((k) => res[k]).map(hexRgb);
  const fog = res.fog.map(hexRgb);
  for (const [extra, check] of [
    [[], (cols) => {
      for (const c of cols) assert.ok(fog.every((f) => dist(c, f) >= 12), `잿빛 가까운 색 ${c}`);
    }],
    [['--max-sat', '0.25'], (cols) => {
      for (const c of cols) assert.ok(sat(c) <= 0.25 + 1e-9, `채도 ${sat(c).toFixed(3)} ${c}`);
    }],
    [['--allow-fog'], () => {}],
  ]) {
    const out = join(dir, `pal${extra.join('')}.json`);
    const r = mapFit('palette', src, '--out', out, ...extra);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const cols = JSON.parse(readFileSync(out, 'utf8')).colors.map(hexRgb);
    // 1-1은 채도가 높은 그림이라 --max-sat 0.25면 남는 색이 적다
    assert.ok(cols.length > (extra[0] === '--max-sat' ? 4 : 16) && cols.length <= 64, `${cols.length}색`);
    for (const c of cols) assert.ok(owned.every((o) => dist(c, o) >= 12), `예약 색 가까운 색 ${c}`);
    check(cols);
  }
});

function ledgerWith(dir, rows) {
  const p = join(dir, 'credits.tsv');
  writeFileSync(p, ['taskId\tlabel\tout\tresolution\tcredits\tstatus', ...rows].join('\n') + '\n');
  return p;
}

function kieGen(dir, ledger) {
  const prompt = join(dir, 'p.txt');
  writeFileSync(prompt, 'test');
  const env = { ...process.env };
  delete env.KIE_AI_API_KEY;
  return spawnSync('python3', ['tools/kie-gen.py', '--prompt-file', prompt, '--out', join(dir, 'o.png'),
    '--resolution', '1K', '--ledger', ledger, '--task', 'T0', '--cap', '1000'], { encoding: 'utf8', env });
}

test('kie-gen: 장부 합계 + 예상이 상한을 넘으면 API 전에 종료 3, 장부는 그대로', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kie-'));
  const ledger = ledgerWith(dir, ['abc\tT9\tx.png\t2K\t996\tok']);
  const before = readFileSync(ledger, 'utf8');
  const r = kieGen(dir, ledger);
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /크레딧 상한/);
  assert.equal(readFileSync(ledger, 'utf8'), before);
});

test('kie-gen: 상한 아래면 키 확인으로 넘어간다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kie-'));
  const ledger = ledgerWith(dir, []);
  const r = kieGen(dir, ledger);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /KIE_AI_API_KEY가 없습니다/);
});
