import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue } from './browser.mjs';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

test('처음 화면이 오류 없이 열린다', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/');
  assert.equal(await page.title(), '말빛 한울');
  assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
  assert.equal(await page.locator('#app').count(), 1);
  await page.waitForSelector('#app [data-scene="title"]');
  assert.deepEqual(errors, []);
  await page.close();
});

test('우리 파일이 없어 생기는 404는 오류로 잡힌다', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/');
  await page.evaluate(
    () =>
      new Promise((done) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/없는파일.css';
        link.onload = link.onerror = done;
        document.head.appendChild(link);
      }),
  );
  assert.ok(errors.length > 0, '로컬 404가 걸러졌다');
  await page.close();
});

test('시작 화면: 제목이 보이고, 하늘로 처음부터 하면 이야기 뒤 탐험에 닿는다', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/');
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await page.locator('.title-logo').textContent(), '말빛 한울');
  assert.equal(await page.locator('.avatar-card.selected').getAttribute('data-avatar'), 'f');
  await page.fill('#nickname', '하늘');
  await page.getByRole('button', { name: '처음부터' }).click();
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  assert.deepEqual(errors, []);
  await page.close();
});

test('이미 있는 이름 확인 창: 이름을 고치면 닫히고, 열릴 때 이름과 다르면 덮어쓰지 않는다', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.evaluate(() => window.__test.acquire(['어스름'], '도담 할머니'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  const confirm = page.locator('.title-confirm');
  // 1) 확인 창이 뜬 뒤 이름을 고치면 창이 닫힌다
  await page.fill('#nickname', '하늘');
  await page.locator('.title-actions').first().getByRole('button', { name: '처음부터' }).click();
  await confirm.waitFor({ state: 'visible' });
  assert.match(await confirm.innerText(), /이미 있는 이름이에요/);
  await page.locator('#nickname').focus();
  await page.keyboard.press('End');
  await page.keyboard.type('2');
  await confirm.waitFor({ state: 'hidden' });
  // 2) 입력 이벤트 없이 이름이 바뀌었어도(방어) 확인 창의 '처음부터'는 다른 이름의 저장을 덮어쓰지 않는다
  await page.fill('#nickname', '하늘');
  await page.locator('.title-actions').first().getByRole('button', { name: '처음부터' }).click();
  await confirm.waitFor({ state: 'visible' });
  await page.evaluate(() => { document.getElementById('nickname').value = '바다'; });
  await confirm.getByRole('button', { name: '처음부터' }).click();
  await confirm.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('[data-scene="title"]').count(), 1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.ok('어스름' in saved.acquired, '하늘의 저장이 덮어써졌다');
  assert.deepEqual(errors, []);
  await page.close();
});
