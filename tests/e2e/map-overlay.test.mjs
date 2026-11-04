import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors } from './browser.mjs';
import { ACTS } from '../../data/acts/index.js';
import { ASSETS } from '../../data/assets.js';
import { readFileSync } from 'node:fs';

// 맵 그림과 걷기 칸 겹쳐 보기: 걸을 수 있는 칸(길·시작·인물·안개 문·몬스터 자리)은
// 그림에서도 길 색이 칸의 40% 이상이어야 한다. 길 색 = 길('.'·'S') 칸에서 가장 많이 쓴 색.
// 거꾸로 막힌 칸('#')은 길 색이 65% 미만이어야 한다(빈 땅처럼 그려 놓고 막아 두면 안 된다).
// 집 벽처럼 길과 비슷한 밝은 색을 쓰는 곳, 잎 없는 나무 윗가지처럼 땅이 비쳐 보이는 칸이 있어 절반보다 넉넉히 잡는다.
const WALK = /[.Sa-eFmM]/;
const MIN_PATH_SHARE = 0.4; // 물건 바로 앞 칸은 물건 아랫부분이 조금 걸쳐도 된다(인물이 앞에 서 보임)
const MAX_BLOCKED_PATH_SHARE = 0.65;
const MAX_BYTES = 700 * 1024; // art-bible 8절: 맵 700KB 이하
const MAX_COLORS = 64; // art-bible 8절: 색표 64색 이하

// PNG 머리를 읽는다: 색 방식(3 = 색표)과 PLTE 색 수
function pngInfo(buf) {
  assert.equal(buf.toString('hex', 0, 8), '89504e470d0a1a0a', 'PNG 서명');
  const info = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25], paletteSize: null };
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i), type = buf.toString('latin1', i + 4, i + 8);
    if (type === 'PLTE') info.paletteSize = len / 3;
    if (type === 'IEND') break;
    i += 12 + len;
  }
  return info;
}

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const chapters = ACTS.flatMap((a) => a.chapters).filter((c) => ASSETS.maps[c.id]);

test('맵 그림이 있는 장이 하나 이상 있다', () => {
  assert.ok(chapters.length > 0);
});

for (const ch of chapters) {
  test(`${ch.id}: 맵 그림 크기가 칸 수와 맞고, 걸을 수 있는 칸은 그림에서도 길이다`, async () => {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.goto(server.url + '/?test=1');
    const shares = await page.evaluate(async ({ src, rows }) => {
      const img = new Image();
      img.src = '/' + src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      const at = (x, y) => { const i = (y * c.width + x) * 4; return (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]; };
      const T = Math.floor(c.width / rows[0].length); // 칸 하나의 그림 픽셀 수
      const tile = (tx, ty, fn) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) fn(at(tx * T + x, ty * T + y)); };
      const count = new Map();
      rows.forEach((r, ty) => [...r].forEach((ch, tx) => {
        if (ch === '.' || ch === 'S') tile(tx, ty, (v) => count.set(v, (count.get(v) || 0) + 1));
      }));
      const path = [...count].sort((a, b) => b[1] - a[1])[0][0];
      const out = [];
      rows.forEach((r, ty) => [...r].forEach((ch, tx) => {
        let n = 0;
        tile(tx, ty, (v) => { if (v === path) n++; });
        out.push({ x: tx, y: ty, ch, share: n / (T * T) });
      }));
      return { w: img.width, h: img.height, tiles: out };
    }, { src: ASSETS.maps[ch.id], rows: ch.map.rows });
    assert.equal(shares.w, ch.map.rows[0].length * 48, '그림 너비 (칸당 48픽셀)');
    assert.equal(shares.h, ch.map.rows.length * 48, '그림 높이 (칸당 48픽셀)');
    const bad = shares.tiles.filter((t) => WALK.test(t.ch) && t.share < MIN_PATH_SHARE)
      .map((t) => `(${t.x},${t.y}) '${t.ch}' ${t.share.toFixed(2)}`);
    assert.deepEqual(bad, [], '걸을 수 있는데 그림에서 길이 아닌 칸');
    const open = shares.tiles.filter((t) => t.ch === '#' && t.share >= MAX_BLOCKED_PATH_SHARE)
      .map((t) => `(${t.x},${t.y}) ${t.share.toFixed(2)}`);
    assert.deepEqual(open, [], '막혀 있는데 그림에서 빈 길처럼 보이는 칸');
    assert.deepEqual(errors, []);
    await page.close();
  });
}

for (const ch of chapters) {
  test(`${ch.id}: 맵 파일은 색표 PNG ${MAX_COLORS}색 이하, ${MAX_BYTES / 1024}KB 이하`, () => {
    const buf = readFileSync(new URL(`../../${ASSETS.maps[ch.id]}`, import.meta.url));
    assert.ok(buf.length <= MAX_BYTES, `${buf.length} bytes`);
    const info = pngInfo(buf);
    assert.equal(info.colorType, 3, '색표 PNG');
    assert.ok(info.paletteSize > 0 && info.paletteSize <= MAX_COLORS, `PLTE ${info.paletteSize}색`);
    assert.equal(info.width, ch.map.rows[0].length * 48);
    assert.equal(info.height, ch.map.rows.length * 48);
  });
}
