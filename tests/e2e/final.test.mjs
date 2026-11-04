// 5막 마지막 문제 '나래': 해설 한 줄(.final-cue)과 숄 밝힘(.shawl-lit), 틀려도 같은 문제, 이기면 마지막 장면, 재도전에도 마지막.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser } from './browser.mjs';
import { openGame, state, answerRight, answerWrong, playDialogue } from './play.mjs';
import { ACTS } from '../../data/acts/index.js';

const ACT5 = ACTS[4];
let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const snap = (page) => page.evaluate(() => window.__test.battle());
const startBoss = async (page, seed) => {
  await page.evaluate((s) => window.__test.startBattle('boss', s), seed);
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
};

test('5-2 보스전: 나래 차례에만 해설 한 줄과 숄 밝힘, 틀려도 하나, 이기면 마지막 장면과 나래', async () => {
  const { page, errors } = await openGame(browser, server);
  await page.evaluate(() => window.__test.goChapter('5-2'));
  await page.waitForSelector('[data-scene="explore"] .hud');
  await startBoss(page, 7);
  for (let i = 0; i < 9; i++) {
    assert.notEqual((await snap(page)).current, '나래');
    assert.equal(await page.locator('.final-cue').count(), 0, `${i + 1}번째 문제에는 해설이 없다`);
    assert.equal(await page.locator('.battle-monster.shawl-lit').count(), 0);
    await answerRight(page);
  }
  const s = await snap(page);
  assert.equal(s.current, '나래');
  assert.equal(s.hp, 1);
  const cue = page.locator('.final-cue');
  assert.equal(await cue.count(), 1);
  assert.equal(await cue.innerText(), ACT5.finalCue);
  assert.equal(await cue.getAttribute('role'), 'status');
  assert.ok(parseFloat(await cue.evaluate((e) => getComputedStyle(e).fontSize)) >= 20);
  const cb = await cue.boundingBox();
  const qb = await page.locator('.battle-question').boundingBox();
  assert.ok(cb.y + cb.height <= qb.y + 1, '해설은 문제 말풍선 위에 있다');
  assert.ok(cb.x >= 0 && cb.x + cb.width <= 1366);
  assert.equal(await page.locator('.battle-monster.shawl-lit').count(), 1);
  assert.match(await page.locator('.battle-prompt').innerText(), /아기 새가 처음으로/);
  // 틀려도 같은 문제, 해설은 하나
  await answerWrong(page);
  const t = await snap(page);
  assert.equal(t.hearts, 4);
  assert.equal(t.current, '나래');
  assert.equal(await page.locator('.final-cue').count(), 1);
  assert.match(await page.locator('.battle-prompt').innerText(), /아기 새가 처음으로/);
  // 맞히면 이긴다 → 마지막 장면
  const idx = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${idx + 1}`);
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.waitForFunction(() => document.querySelector('.dialogue-text')?.textContent.length > 3);
  assert.equal(await page.locator('.dialogue-text').innerText(), '하늘이 힘껏 이름을 부르자 그림자 한가운데에서 빛이 터져 나왔다.');
  await playDialogue(page);
  await page.waitForSelector('[data-scene="explore"] .hud');
  await page.evaluate(() => window.__test.teleportTo('narae'));
  assert.equal(await page.locator('.hud-companion[data-npc="narae"]').count(), 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test('5-2 보스전: 앞에서 5번 틀려 게임 오버가 되어도 다시 도전하면 나래가 마지막', async () => {
  const { page, errors } = await openGame(browser, server);
  await page.evaluate(() => window.__test.goChapter('5-2'));
  await page.waitForSelector('[data-scene="explore"] .hud');
  await startBoss(page, 7);
  for (let i = 0; i < 4; i++) await answerWrong(page);
  const idx = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${((idx + 1) % 4) + 1}`);
  await page.waitForSelector('.battle-feedback .battle-next');
  await page.locator('.battle-next').click();
  await page.waitForSelector('[data-scene="gameover"]');
  await page.getByRole('button', { name: /다시 도전/ }).click();
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
  const s = await snap(page);
  assert.equal(s.order[9], '나래');
  assert.equal(s.hearts, 5);
  assert.equal(await page.locator('.final-cue').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});
