import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, startFromTitle } from './browser.mjs';

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

test('타이틀: h1 이름 "말빛 한울", 처음부터에 초점, ↓ 뒤 이어하기에 초점, 단추 높이 ≥ 48', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await page.locator('h1.title-logo').textContent(), '말빛 한울');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), '처음부터');
  // 저장이 있어야 이어하기를 누를 수 있다
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), '이어하기');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), '처음부터');
  for (const b of await page.locator('.title-menu .btn').all()) {
    assert.ok((await b.boundingBox()).height >= 48);
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('저장 없음 → 이어하기 disabled', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/');
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await page.getByRole('button', { name: '이어하기' }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: '처음부터' }).isDisabled(), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('처음부터 → 모습 고르기: 이름 칸은 화면 위 절반, 카드 안 리본에 "여자"·"남자" 글자가 보인다, 뒤로 → 타이틀', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/');
  await page.waitForSelector('[data-scene="title"]');
  await page.getByRole('button', { name: '처음부터' }).click();
  await page.waitForSelector('[data-scene="select"][data-mode="new"]');
  assert.equal(await page.locator('.avatar-card.selected').getAttribute('data-avatar'), 'f');
  const input = await page.locator('#nickname').boundingBox();
  assert.ok(input.y + input.height < 384, '이름 칸은 위 절반');
  assert.ok(await page.locator('.avatar-card .ribbon', { hasText: '여자' }).isVisible());
  assert.ok(await page.locator('.avatar-card .ribbon', { hasText: '남자' }).isVisible());
  await page.locator('.avatar-card[data-avatar="m"]').click();
  assert.equal(await page.locator('.avatar-card.selected').getAttribute('data-avatar'), 'm');
  await page.getByRole('button', { name: '뒤로' }).click();
  await page.waitForSelector('[data-scene="title"]');
  assert.deepEqual(errors, []);
  await page.close();
});

test('시작 화면: 하늘로 처음부터 하면 이야기 뒤 탐험에 닿는다', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/');
  await startFromTitle(page, { name: '하늘' });
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  assert.deepEqual(errors, []);
  await page.close();
});

test('이어하기: 저장된 이름 단추를 누르면 칸에 이름, 이어하기로 탐험. 저장이 없는 이름은 안내', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  await page.getByRole('button', { name: '이어하기' }).click();
  await page.waitForSelector('[data-scene="select"][data-mode="continue"]');
  assert.equal(await page.locator('.avatar-card').count(), 0, '이어하기에는 모습 카드가 없다');
  const saved = page.locator('.saved-name', { hasText: '하늘' });
  assert.ok((await saved.boundingBox()).height >= 48);
  await saved.click();
  assert.equal(await page.locator('#nickname').inputValue(), '하늘');
  // 없는 이름
  await page.fill('#nickname', '구름');
  await page.locator('.select-go').click();
  const nf = page.locator('.select-notfound');
  await nf.waitFor({ state: 'visible' });
  assert.match(await nf.innerText(), /이 이름으로 저장된 게임이 없어요\./);
  await nf.getByRole('button', { name: '처음부터 하기' }).click();
  await page.waitForSelector('[data-scene="select"][data-mode="new"]');
  assert.equal(await page.locator('#nickname').inputValue(), '구름');
  await page.getByRole('button', { name: '뒤로' }).click();
  await page.waitForSelector('[data-scene="title"]');
  await startFromTitle(page, { name: '하늘', mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
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
  await page.getByRole('button', { name: '처음부터' }).click();
  await page.waitForSelector('[data-scene="select"]');
  const confirm = page.locator('.title-confirm');
  const go = page.locator('.select-go');
  // 1) 확인 창이 뜬 뒤 이름을 고치면 창이 닫힌다
  await page.fill('#nickname', '하늘');
  await go.click();
  await confirm.waitFor({ state: 'visible' });
  assert.match(await confirm.innerText(), /이미 있는 이름이에요/);
  await page.locator('#nickname').focus();
  await page.keyboard.press('End');
  await page.keyboard.type('2');
  await confirm.waitFor({ state: 'hidden' });
  // 2) 입력 이벤트 없이 이름이 바뀌었어도(방어) 확인 창의 '처음부터'는 다른 이름의 저장을 덮어쓰지 않는다
  await page.fill('#nickname', '하늘');
  await go.click();
  await confirm.waitFor({ state: 'visible' });
  await page.evaluate(() => { document.getElementById('nickname').value = '바다'; });
  await confirm.getByRole('button', { name: '처음부터' }).click();
  await confirm.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('[data-scene="select"]').count(), 1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.ok('어스름' in saved.acquired, '하늘의 저장이 덮어써졌다');
  assert.deepEqual(errors, []);
  await page.close();
});

test('이어하기에서 저장이 깨졌으면: 처음부터 → 모습 고르기(이름 그대로)로 가서 모습을 고른다', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => { localStorage.setItem('malbit:save:바다', '{깨짐'); localStorage.setItem('malbit:names', JSON.stringify(['바다'])); });
  await page.reload();
  await startFromTitle(page, { name: '바다', mode: 'continue' });
  const confirm = page.locator('.title-confirm');
  await confirm.waitFor({ state: 'visible' });
  assert.match(await confirm.innerText(), /저장을 불러오지 못했어요/);
  await confirm.getByRole('button', { name: '처음부터' }).click();
  // 바로 새 게임을 시작하지 않고 모습 고르기로 간다
  await page.waitForSelector('[data-scene="select"][data-mode="new"]');
  assert.equal(await page.locator('#nickname').inputValue(), '바다');
  assert.equal(await page.locator('[data-scene="dialogue"]').count(), 0);
  await page.locator('.avatar-card[data-avatar="m"]').click();
  await page.locator('.select-go').click();
  await confirm.waitFor({ state: 'visible' }); // 깨진 저장이 남아 있으니 덮어쓸지 묻는다
  await confirm.getByRole('button', { name: '처음부터' }).click();
  await page.waitForSelector('[data-scene="dialogue"]');
  const s = await page.evaluate(() => window.__test.state());
  assert.equal(s.nickname, '바다');
  assert.equal(s.avatar, 'm');
  assert.deepEqual(errors, []);
  await page.close();
});
