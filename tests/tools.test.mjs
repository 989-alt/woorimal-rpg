import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
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

test('ui-slice mask: 흰색 + 알파, 좌우 대칭', (t) => {
  const s = uiSliceSetup(t); if (!s) return;
  const out = join(s.dir, 'mask.png');
  execFileSync(VENV_PY, ['-I', 'tools/ui-slice.py', 'mask', s.src, out, '--size', '160x80', '--slice', '20,40,20,40', '--src-corner', '60']);
  const r = inspectFrame(out, `
px = im.convert('RGBA').load(); w, h = im.size
white = all(px[x, y][:3] == (255, 255, 255) for y in range(h) for x in range(w) if px[x, y][3])
sym = all(px[x, y] == px[w - 1 - x, y] for y in range(h) for x in range(w))
opaque = sum(1 for y in range(h) for x in range(w) if px[x, y][3])
print(im.size, im.mode, white, sym, opaque > 0)
`);
  assert.equal(r, '(160, 80) P True True True');
});
