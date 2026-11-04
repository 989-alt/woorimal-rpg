import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors } from './browser.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

async function start() {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.evaluate(() => window.__test.acquire(['어스름'], '도담 할머니'));
  await page.waitForSelector('[data-scene="explore"]');
  return { page, errors };
}

test('도감: 1막 탭에 어스름 카드 1장과 ? 9칸, 닫기와 초점', async () => {
  const { page, errors } = await start();
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  assert.equal(await page.locator('.codex-tab').count(), 5);
  assert.equal(await page.locator('.codex-card.found').count(), 1);
  assert.equal(await page.locator('.codex-card.unknown').count(), 9);
  const card = await page.locator('.codex-card.found').innerText();
  assert.match(card, /어스름/);
  assert.match(card, /해 뜨기 전이나 해 진 뒤의 조금 어둑한 때/);
  assert.match(card, /새벽 어스름에 닭이 울었다\./);
  assert.match(card, /만난 곳: 도담 할머니/);
  assert.match(await page.locator('.codex-card.unknown').first().innerText(), /\?[\s\S]*아직 못 찾음/);
  await page.locator('.codex-tab', { hasText: '3막' }).click();
  assert.equal(await page.locator('.codex-card.unknown').count(), 10);
  // 걷기가 멈춘다
  const pos = await page.evaluate(() => JSON.stringify(window.__test.state().pos));
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__test.state().pos)), pos);
  // Q는 도감을 닫고 할 일을 연다
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('.tasks');
  assert.equal(await page.locator('.codex').count(), 0);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.tasks').count(), 0);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  await page.keyboard.press('KeyE');
  assert.equal(await page.locator('.codex').count(), 0);
  // 단추로 열고 닫으면 초점이 단추로 돌아온다
  await page.locator('.hud-button', { hasText: '도감' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.codex');
  await page.locator('.codex-close').click();
  assert.equal(await page.locator('.codex').count(), 0);
  assert.match(await page.evaluate(() => document.activeElement.textContent), /도감/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('할 일: 받기 전 / ? / 숨은 낱말 못 찾음', async () => {
  const { page, errors } = await start();
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('.tasks');
  const rows = await page.locator('.task-row').allInnerTexts();
  assert.match(rows[0], /우물에서 물 길어 오기[\s\S]*받기 전/);
  assert.match(rows[1], /\?/);
  assert.match(await page.locator('.tasks').innerText(), /숨은 낱말: 못 찾음/);
  assert.doesNotMatch(await page.locator('.tasks').innerText(), /그림자를 물리쳐라/);
  await page.locator('.tasks-close').click();
  assert.equal(await page.locator('.tasks').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});
