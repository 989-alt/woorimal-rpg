import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

let server, browser;
before(async () => {
  server = await startServer();
  // 로컬에 설치된 브라우저 버전이 다르면 PW_CHROMIUM_PATH로 실행 파일을 지정한다.
  browser = await chromium.launch(
    process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  );
});
after(async () => {
  await browser?.close();
  await server?.close();
});

// 글꼴(Google Fonts)이 막혀서 생기는 네트워크 오류는 무시한다. 자바스크립트 오류는 모두 실패.
const isFontNoise = (text, url = '') =>
  /fonts\.(googleapis|gstatic)\.com/.test(url + text) ||
  /Failed to load resource/.test(text);

test('처음 화면이 오류 없이 열린다', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isFontNoise(m.text(), m.location().url)) errors.push(`console: ${m.text()}`);
  });
  await page.goto(server.url + '/');
  assert.equal(await page.title(), '말빛 한울');
  assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
  assert.equal(await page.locator('#app').count(), 1);
  await page.waitForSelector('#app [data-scene="boot"]');
  assert.deepEqual(errors, []);
  await page.close();
});
