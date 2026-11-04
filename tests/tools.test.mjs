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
