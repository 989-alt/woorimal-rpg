// 보스 뒤 장면(afterBoss): 막 보스를 이기고 탐험으로 돌아오면 한 번 나오고, 끝까지 보기 전에 새로 고침하면 다시 나온다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, dialogueStep, startFromTitle } from './browser.mjs';
import { openGame, state, hudTask, playDialogue, answerRight, continueAs, boot } from './play.mjs';
import { ACTS } from '../../data/acts/index.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const companions = (page) => page.locator('.hud-companion').evaluateAll((els) => els.map((e) => e.dataset.npc));
const lineText = async (page) => {
  await page.waitForFunction(() => document.querySelector('.dialogue-text')?.textContent.length > 3);
  return page.locator('.dialogue-text').innerText();
};

// goChapter로 그 장에 서서 보스전을 열고 6문제를 모두 맞힌다. 이긴 뒤에는 대화가 열린다.
async function winBossAt(page, chapterId) {
  await page.evaluate((c) => window.__test.goChapter(c), chapterId);
  await page.waitForSelector('[data-scene="explore"] .hud');
  await page.evaluate(() => window.__test.startBattle('boss', 7));
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
  for (let i = 0; i < 5; i++) await answerRight(page);
  const idx = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${idx + 1}`); // 여섯째
}

test('2-2: 보스를 이기면 마무리 대화가 먼저 나오고, 끝까지 보면 기록되고 길잡이가 출구를 가리킨다', async () => {
  const { page, errors } = await openGame(browser, server);
  const ch = ACTS[1].chapters[1];
  await winBossAt(page, '2-2');
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.equal(await page.locator('.hint[data-tip="guide-won"]').count(), 0, '대화보다 길잡이가 먼저 나오지 않는다');
  assert.equal(await lineText(page), '흐린 저울을 든 그림자가 빛 알갱이로 흩어졌다.');
  assert.deepEqual((await state(page)).seenScenes.filter((k) => k === '2-2:afterBoss'), [], '끝까지 보기 전에는 기록이 없다');
  await playDialogue(page);
  await page.waitForSelector('[data-scene="explore"] .hud');
  const s = await state(page);
  assert.ok(s.seenScenes.includes('2-2:afterBoss'));
  assert.deepEqual(s.clearedActs.slice(-1), [2]);
  assert.equal(await hudTask(page), '북문을 지나 북쪽 숲으로 가자');
  assert.equal(await hudTask(page), ch.exit.goal);
  await page.locator('.hint[data-tip="guide-won"]').waitFor(); // 대화 뒤에 길잡이
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.ok(saved.seenScenes.includes('2-2:afterBoss'), '본 것은 저장된다');
  assert.deepEqual(errors, []);
  await page.close();
});

test('4-2: 반전과 나래가 끌려가는 장면은 끝까지 봐야 기록되고, 본 뒤 나래는 HUD와 지도에서 사라진다', async () => {
  const { page, errors } = await openGame(browser, server);
  const script = ACTS[3].chapters[1].afterBoss;
  await winBossAt(page, '4-2');
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.equal(await lineText(page), script[0].text);
  // 두 줄 넘긴 뒤 새로 고침
  for (let i = 0; i < 2; i++) await dialogueStep(page, 'explore', i % 2 ? 'Enter' : 'Space');
  assert.equal(await lineText(page), script[2].text.replace('{이름|아}', '하늘아'));
  await page.reload();
  await boot(page);
  await startFromTitle(page, { name: '하늘', mode: 'continue' });
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.equal(await lineText(page), script[0].text, '처음부터 다시 나온다');
  assert.equal((await state(page)).seenScenes.includes('4-2:afterBoss'), false);
  // 끝까지: 대사를 하나도 건너뛰지 않고 본다
  const seen = [];
  for (let i = 0; i < script.length; i++) {
    seen.push(await lineText(page));
    await dialogueStep(page, 'explore', i % 2 ? 'Enter' : 'Space');
  }
  assert.equal(seen.length, script.length, '모든 줄이 나왔다');
  assert.equal(seen.at(-1), script.at(-1).text);
  await page.waitForSelector('[data-scene="explore"] .hud');
  assert.ok((await state(page)).seenScenes.includes('4-2:afterBoss'));
  assert.deepEqual(await companions(page), ['haesol'], '나래 초상이 사라졌다');
  const err = await page.evaluate(() => { try { window.__test.teleportTo('narae'); return null; } catch (e) { return e.message; } });
  assert.match(err, /지도에 'narae'이\(가\) 없습니다/);
  assert.equal(await hudTask(page), ACTS[3].chapters[1].exit.goal);
  await page.locator('.hint[data-tip="guide-won"]').waitFor();
  // 다시 새로 고침하면 대화 없이 탐험
  await page.reload();
  await continueAs(page, '하늘');
  await page.waitForSelector('[data-scene="explore"] .hud');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('[data-scene="dialogue"]').count(), 0);
  assert.deepEqual(await companions(page), ['haesol']);
  assert.deepEqual(errors, []);
  await page.close();
});
