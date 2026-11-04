import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, startFromTitle } from './browser.mjs';
import { parseMap, isWalkable } from '../../js/explore/grid.js';
import ACT1 from '../../data/acts/act1.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// 가장 짧은 길을 방향 목록으로 찾는다.
function pathTo(map, from, to) {
  const prev = new Map([[`${from.x},${from.y}`, null]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift();
    if (p.x === to.x && p.y === to.y) break;
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      const n = { x: p.x + dx, y: p.y + dy };
      const k = `${n.x},${n.y}`;
      if (!prev.has(k) && isWalkable(map, n.x, n.y)) {
        prev.set(k, { from: p, dir });
        queue.push(n);
      }
    }
  }
  const dirs = [];
  for (let k = `${to.x},${to.y}`; prev.get(k); ) {
    const { from: p, dir } = prev.get(k);
    dirs.unshift(dir);
    k = `${p.x},${p.y}`;
  }
  return dirs;
}

async function openGame(query = '?test=1') {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/' + query);
  return { page, errors };
}

test('새 게임을 열면 1366×768에서 캔버스가 1152×648이고 HUD에 낱말 수와 첫 부탁이 보인다', async () => {
  const { page, errors } = await openGame();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  const box = await page.locator('[data-scene="explore"] canvas').boundingBox();
  assert.equal(box.width, 1152);
  assert.equal(box.height, 648);
  const hud = page.locator('[data-scene="explore"] .hud');
  assert.match(await hud.innerText(), /이 장의 낱말 0\/5/);
  assert.match(await hud.innerText(), /우물에서 물 길어 오기/);
  // 처음 하는 학생 안내는 움직이면 사라진다.
  const tip = page.locator('.explore-tip');
  assert.equal(await tip.innerText(), '방향키로 걸어 보세요');
  await page.keyboard.press('ArrowRight');
  await tip.waitFor({ state: 'detached' });
  const s = await page.evaluate(() => window.__test.state());
  assert.deepEqual(s.pos, { x: 6, y: 19 });
  assert.equal(s.facing, 'right');
  assert.ok(s.seenTips.includes('move'));
  // acquire는 HUD를 새로 그린다.
  await page.evaluate(() => window.__test.acquire(['어스름'], '도담 할머니'));
  await page.waitForFunction(() => document.querySelector('.hud').innerText.includes('이 장의 낱말 1/5'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('캔버스 안쪽은 늘 1152×648(칸당 48픽셀): 1366×768에선 1:1 또렷하게, 1024×768에선 줄여 부드럽게', async () => {
  const look = async (width, height) => {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = collectErrors(page);
    await page.goto(server.url + '/?test=1');
    await page.waitForFunction(() => window.__test);
    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await page.waitForSelector('[data-scene="explore"] canvas');
    const r = await page.evaluate(() => {
      const c = document.querySelector('[data-scene="explore"] canvas');
      const b = c.getBoundingClientRect();
      return { w: c.width, h: c.height, cssW: b.width, cssH: b.height, rendering: c.style.imageRendering };
    });
    assert.deepEqual(errors, []);
    await page.close();
    return r;
  };
  assert.deepEqual(await look(1366, 768), { w: 1152, h: 648, cssW: 1152, cssH: 648, rendering: 'pixelated' });
  const small = await look(1024, 768);
  assert.equal(small.w, 1152);
  assert.equal(small.h, 648);
  assert.equal(small.cssW, 1024);
  assert.equal(small.cssH, 576);
  assert.equal(small.rendering, 'auto');
});

test('할머니에게 걸어가 말을 걸면 대화 장면으로 가고, 저장된다', async () => {
  const { page, errors } = await openGame();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  const map = parseMap(ACT1.chapters[0].map.rows);
  const below = { x: map.slots.a.x, y: map.slots.a.y + 1 };
  for (const dir of pathTo(map, map.start, below)) await page.keyboard.press(KEYS[dir]);
  await page.keyboard.press('ArrowUp'); // 할머니를 바라본다(막혀서 제자리)
  let s = await page.evaluate(() => window.__test.state());
  assert.deepEqual(s.pos, below);
  assert.equal(s.facing, 'up');
  await page.keyboard.press('Space');
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.match(await page.locator('[data-scene="dialogue"]').innerText(), /도담 할머니/);
  s = await page.evaluate(() => window.__test.state());
  assert.equal(s.quests.q1.stage, 'active');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.equal(saved.quests.q1.stage, 'active');
  assert.deepEqual(saved.pos, below);
  await finishDialogue(page);
  assert.deepEqual(errors, []);
  await page.close();
});

test('앞 장의 낱말 5개를 다 얻으면 장 클리어로 간다', async () => {
  const { page, errors } = await openGame();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.evaluate(() => window.__test.acquire(['어스름', '아침나절', '매무새', '손사래', '오롯이'], '도담 할머니'));
  await page.waitForSelector('[data-scene="clear"]');
  assert.deepEqual(errors, []);
  await page.close();
});

test('?test=1이 없으면 __test가 없다', async () => {
  const { page, errors } = await openGame('');
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await page.evaluate(() => typeof window.__test), 'undefined');
  await startFromTitle(page, { name: '하늘' });
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  await page.waitForSelector('[data-scene="explore"] canvas');
  assert.deepEqual(errors, []);
  await page.close();
});

test('탐험 캔버스는 바뀐 것이 없으면 다시 그리지 않고, 겹침 창이 열린 동안에도 그리지 않는다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    window.__fills = 0;
    const orig = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (...a) { window.__fills++; return orig.apply(this, a); };
  });
  // 느린 CI처럼 그림이 늦게 와도 흔들리지 않도록 그림 응답을 늦춘다
  await page.route(/\/assets\/.*\.(png|webp)$/, async (r) => { await new Promise((ok) => setTimeout(ok, 300)); r.continue(); });
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  const fills = () => page.evaluate(() => window.__fills);
  // 그림과 글꼴이 다 와서 한 번 더 그린 뒤를 기준으로 삼는다
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))));
  await page.waitForTimeout(200);
  // 처음 자리: 화면 안에 움직이는 그림이 없다
  let n = await fills();
  assert.ok(n > 0, '한 번은 그렸다');
  const since = await page.evaluate(() => (window.__test.draws ?? []).length);
  await page.waitForTimeout(500);
  const extra = await page.evaluate((k) => (window.__test.draws ?? []).slice(k), since);
  assert.equal(await fills(), n, `바뀐 것이 없는데 다시 그렸다: ${JSON.stringify(extra)}`);
  // 걸으면 다시 그린다
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((k) => window.__fills > k, n);
  // 겹침 창이 열린 동안은 그리지 않는다
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  await page.waitForTimeout(100);
  n = await fills();
  await page.waitForTimeout(400);
  assert.equal(await fills(), n);
  assert.deepEqual(errors, []);
  await page.close();
});

test('걸음 한 번은 두 칸 사이를 미끄러져 지나가고, 끝나면 칸에 선다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const start = await page.evaluate(() => window.__test.state().pos);
  // 걸음 하나 동안 매 프레임 그려진 주인공 자리를 모은다
  await page.evaluate(() => {
    window.__seen = [];
    const tick = () => { const h = window.__test.heroAt; if (h) window.__seen.push({ x: h.x, y: h.y }); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  const pos = await page.evaluate(() => window.__test.state().pos);
  assert.equal(pos.x, start.x + 1, '규칙의 자리는 바로 한 칸 옮겨진다');
  const seen = await page.evaluate(() => window.__seen);
  assert.ok(seen.some((p) => p.x > start.x && p.x < start.x + 1), `칸 사이에 그려진 프레임이 없다: ${JSON.stringify(seen.slice(0, 12))}`);
  const last = seen[seen.length - 1];
  assert.deepEqual(last, { x: start.x + 1, y: start.y }, '끝나면 칸에 선다');
  // 칸 사이 자리는 그림 픽셀(칸의 1/48)에 맞는다
  for (const p of seen) assert.ok(Math.abs(p.x * 48 - Math.round(p.x * 48)) < 1e-9);
  assert.deepEqual(errors, []);
  await page.close();
});
