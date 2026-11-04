import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors } from './browser.mjs';
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
  await page.locator('[data-scene="dialogue"] button').click();
  await page.waitForSelector('[data-scene="explore"]');
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
  await page.fill('#nickname', '하늘');
  await page.getByRole('button', { name: '처음부터' }).click();
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.getByRole('button', { name: '탐험으로 돌아가기' }).click();
  await page.waitForSelector('[data-scene="explore"] canvas');
  assert.deepEqual(errors, []);
  await page.close();
});
