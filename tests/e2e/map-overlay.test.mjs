import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors } from './browser.mjs';
import { ACTS } from '../../data/acts/index.js';
import { ASSETS } from '../../data/assets.js';

// 맵 그림과 걷기 칸 겹쳐 보기: 걸을 수 있는 칸(길·시작·인물·안개 문·몬스터 자리)은
// 그림에서도 길 색이 칸의 40% 이상이어야 한다. 길 색 = 길('.'·'S') 칸에서 가장 많이 쓴 색.
// (막힌 칸은 검사하지 않는다. 집 벽처럼 길과 같은 밝은 색을 쓰는 곳이 있다.)
const WALK = /[.Sa-eFmM]/;
const MIN_PATH_SHARE = 0.4; // 물건 바로 앞 칸은 물건 아랫부분이 조금 걸쳐도 된다(인물이 앞에 서 보임)

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
      const tile = (tx, ty, fn) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) fn(at(tx * 16 + x, ty * 16 + y)); };
      const count = new Map();
      rows.forEach((r, ty) => [...r].forEach((ch, tx) => {
        if (ch === '.' || ch === 'S') tile(tx, ty, (v) => count.set(v, (count.get(v) || 0) + 1));
      }));
      const path = [...count].sort((a, b) => b[1] - a[1])[0][0];
      const out = [];
      rows.forEach((r, ty) => [...r].forEach((ch, tx) => {
        let n = 0;
        tile(tx, ty, (v) => { if (v === path) n++; });
        out.push({ x: tx, y: ty, ch, share: n / 256 });
      }));
      return { w: img.width, h: img.height, tiles: out };
    }, { src: ASSETS.maps[ch.id], rows: ch.map.rows });
    assert.equal(shares.w, ch.map.rows[0].length * 16, '그림 너비');
    assert.equal(shares.h, ch.map.rows.length * 16, '그림 높이');
    const bad = shares.tiles.filter((t) => WALK.test(t.ch) && t.share < MIN_PATH_SHARE)
      .map((t) => `(${t.x},${t.y}) '${t.ch}' ${t.share.toFixed(2)}`);
    assert.deepEqual(bad, [], '걸을 수 있는데 그림에서 길이 아닌 칸');
    assert.deepEqual(errors, []);
    await page.close();
  });
}
