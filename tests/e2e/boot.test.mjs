import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors } from './browser.mjs';

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
  await page.waitForSelector('#app [data-scene="boot"]');
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
