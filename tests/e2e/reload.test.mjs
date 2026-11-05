// 대화 도중 새로 고침: 부탁을 끝낸 대사·숨은 낱말 대사 중간에 창을 다시 열어도 낱말을 잃지 않는다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, startFromTitle, dialogueStep } from './browser.mjs';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const state = (page) => page.evaluate(() => window.__test.state());

async function openNewGame(name) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.fastText(true));
  await page.evaluate((n) => window.__test.newGame(n, 'f'), name);
  await page.waitForSelector('[data-scene="explore"]');
  return { page, errors };
}

async function interact(page, target) {
  await page.evaluate((t) => window.__test.teleportTo(t), target);
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('Space');
}

async function continueAs(page, name) {
  await startFromTitle(page, { name, mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
}

// 도담 할머니 부탁을 받고 우물에서 물을 길어 온 데까지
async function getWater(page) {
  await interact(page, 'dodam');
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  await interact(page, '우물');
  await page.waitForSelector('.toast:not([hidden])');
  assert.deepEqual((await state(page)).bag, ['water']);
}

test('부탁을 끝내는 대사 도중 새로 고침해도 그 부탁의 낱말 2개가 남는다', async () => {
  const { page, errors } = await openNewGame('하늘');
  await getWater(page);
  await interact(page, 'dodam');
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.reload();
  await continueAs(page, '하늘');
  const s = await state(page);
  assert.equal(s.quests.q1.stage, 'done');
  assert.ok('어스름' in s.acquired, '어스름을 잃었다');
  assert.ok('아침나절' in s.acquired, '아침나절을 잃었다');
  assert.match(await page.locator('.hud-count').innerText(), /2\/5/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('숨은 낱말 대사 도중 새로 고침해도 숨은 낱말이 남는다', async () => {
  const { page, errors } = await openNewGame('바다');
  await getWater(page);
  await interact(page, 'dodam');
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  await interact(page, 'gardener'); // 텃밭 아저씨가 알려 준 뒤에야 장독대에서 낱말을 얻는다
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  await interact(page, '장독대');
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.reload();
  await continueAs(page, '바다');
  const s = await state(page);
  assert.equal(s.hiddenFound['1-1'], true);
  assert.ok('오롯이' in s.acquired, '오롯이를 잃었다');
  assert.match(await page.locator('.hud-count').innerText(), /3\/5/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('대화에서는 이번에 얻은 낱말마다 카드가 한 번씩 뜬다(미리 얻어 두었어도)', async () => {
  const { page, errors } = await openNewGame('구름');
  await getWater(page);
  await interact(page, 'dodam');
  await page.waitForSelector('[data-scene="dialogue"]');
  // 대화가 열린 순간 이미 상태에 들어 있다
  const s = await state(page);
  assert.ok('어스름' in s.acquired && '아침나절' in s.acquired);
  assert.deepEqual(await finishDialogue(page), ['어스름', '아침나절']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('장 시작 이야기 도중 새로 고침하면 이어 할 때 이야기가 처음부터 다시 나오고, 끝까지 보면 다시 나오지 않는다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.fastText(true));
  const line = async () => {
    await page.waitForFunction(() => document.querySelector('.dialogue-text')?.textContent.length > 3);
    return page.locator('.dialogue-text').innerText();
  };
  await startFromTitle(page, { name: '이야기', mode: 'new' });
  await page.waitForSelector('[data-scene="dialogue"]');
  const first = await line();
  assert.match(first, /새벽골의 작은 집에서 눈을 떴다/);
  await dialogueStep(page);
  assert.notEqual(await line(), first);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:이야기')));
  assert.equal(saved.introPending, '1-1', '이야기를 여는 순간 저장에 남는다');
  await page.reload();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.fastText(true));
  await startFromTitle(page, { name: '이야기', mode: 'continue' });
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.equal(await line(), first, '이야기가 처음부터 다시 나온다');
  await finishDialogue(page);
  await page.waitForSelector('[data-scene="explore"] .hud');
  assert.equal((await state(page)).introPending, null);
  await page.reload();
  await page.waitForFunction(() => window.__test);
  await continueAs(page, '이야기');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-scene="dialogue"]').count(), 0, '다 본 이야기는 다시 나오지 않는다');
  assert.deepEqual(errors, []);
  await page.close();
});
