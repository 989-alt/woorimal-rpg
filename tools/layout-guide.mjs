#!/usr/bin/env node
// 장 맵 격자를 칸당 16px 색 밑그림 PNG로 그린다 (이미지 생성의 배치 참고용).
// 사용: node tools/layout-guide.mjs <chapterId> <out.png>
//       node tools/layout-guide.mjs --rows <chapterId>   맵 행을 JSON으로(tools/map-fit.py가 읽는다)
//       node tools/layout-guide.mjs --exit <chapterId>   출구 { x, y, dir }를 JSON으로(없으면 null)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { ACTS } from '../data/acts/index.js';
import { parseMap } from '../js/explore/grid.js';

const TILE = 16;
const PATH = [0xE8, 0xC8, 0x8A];
const COLORS = {
  block: [0x3E, 0x7A, 0x3A],
  object: [0x8B, 0x5A, 0x2B],
  npc: [0xF2, 0xF2, 0xF2],
  fog: [0xB9, 0xBB, 0xBE],
  monster: [0x5E, 0x62, 0x66],
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function renderGuide(rows) {
  const map = parseMap(rows);
  const W = map.w * TILE, H = map.h * TILE;
  const buf = Buffer.alloc(W * H * 3);
  const fill = (x0, y0, size, c) => {
    for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) buf.set(c, (y * W + x) * 3);
  };
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const ch = map.tileAt(tx, ty);
      const px = tx * TILE, py = ty * TILE;
      if (ch === '#') { fill(px, py, TILE, COLORS.block); continue; }
      if (ch === 'F') { fill(px, py, TILE, COLORS.fog); continue; }
      if (ch === 'm' || ch === 'M') { fill(px, py, TILE, COLORS.monster); continue; }
      fill(px, py, TILE, PATH);
      if (ch >= 'a' && ch <= 'e') fill(px + 2, py + 2, TILE - 4, COLORS.npc);
      else if (ch >= '0' && ch <= '9') fill(px + 2, py + 2, TILE - 4, COLORS.object);
    }
  }
  return encodePng(W, H, buf);
}

// 출구 통로: 출구 칸 다음 칸부터 exit.dir 쪽으로 맵 끝까지의 칸 [[x, y], …].
// 길이 화면 밖으로 이어지는 곳이라 막힌 칸('#')이어도 맵 그림에 길처럼 그려도 된다(설계 2절).
// tools/map-fit.py의 exit_passage와 같은 정의.
export function exitPassage(rows, exit) {
  const step = exit && { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[exit.dir];
  if (!step) return [];
  const w = rows[0].length, h = rows.length, out = [];
  for (let x = exit.x + step[0], y = exit.y + step[1]; x >= 0 && y >= 0 && x < w && y < h; x += step[0], y += step[1]) out.push([x, y]);
  return out;
}

const findChapter = (id) => ACTS.flatMap((a) => a.chapters).find((c) => c.id === id);

if (import.meta.url === `file://${process.argv[1]}`) {
  const [flag, cid] = process.argv.slice(2);
  if (flag === '--rows' || flag === '--exit') {
    const ch = findChapter(cid);
    if (!ch) { console.error(`알 수 없는 장 '${cid}'`); process.exit(1); }
    console.log(JSON.stringify(flag === '--rows' ? ch.map.rows : ch.exit ?? null));
    process.exit(0);
  }
  const [id, out] = process.argv.slice(2);
  if (!id || !out) { console.error('사용: node tools/layout-guide.mjs <chapterId> <out.png>'); process.exit(2); }
  const chapter = findChapter(id);
  if (!chapter) { console.error(`알 수 없는 장 '${id}'`); process.exit(1); }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderGuide(chapter.map.rows));
  console.log(`saved ${out}`);
}
