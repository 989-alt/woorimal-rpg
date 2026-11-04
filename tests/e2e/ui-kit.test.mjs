// UI 부품 견본(tests/fixtures/ui-kit.html): 그림이 오면 그림 틀, 못 받으면(전부·일부) CSS 바탕 모습, 글꼴.
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

const UI_ASSETS = /\/assets\/ui\//;

// 견본 페이지를 연다. block(주소 일부 정규식)에 걸리는 그림 요청은 막는다. loadUiKit()이 끝날 때까지 기다린다.
async function openKit(block = null) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page, { allow: block ? UI_ASSETS : null });
  if (block) await page.route(block, (route) => route.abort());
  await page.goto(server.url + '/tests/fixtures/ui-kit.html');
  const kit = await page.evaluate(() => window.__kit);
  return { page, errors, kit };
}
const uiClasses = (page) => page.evaluate(() => [...document.documentElement.classList].filter((c) => c.startsWith('ui-')));
const look = (page, selector) =>
  page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      image: cs.borderImageSource,
      style: cs.borderTopStyle,
      width: cs.borderTopWidth,
      radius: cs.borderTopLeftRadius,
      height: el.getBoundingClientRect().height,
      width2: el.getBoundingClientRect().width,
      color: cs.color,
    };
  });

test('그림이 오면 <html>에 ui-* 클래스 17개, .btn-green의 borderImageSource에 btn_green', async () => {
  const { page, errors, kit } = await openKit();
  assert.equal(kit.ok.length, 17);
  assert.deepEqual(kit.failed, []);
  assert.equal((await uiClasses(page)).length, 17);
  assert.match((await look(page, '.btn-green')).image, /btn_green/);
  assert.match((await look(page, '.btn-wood')).image, /btn_wood/);
  assert.match((await look(page, '.frame-panel')).image, /frame_panel/);
  assert.match((await look(page, '.frame-plate')).image, /frame_panel/);
  assert.match((await look(page, '.frame-dialogue')).image, /frame_dialogue/);
  assert.match((await look(page, '.frame-card')).image, /frame_card/);
  assert.match((await look(page, '.frame-scroll')).image, /frame_scroll/);
  assert.match((await look(page, '.btn-icon')).image, /btn_icon/);
  // 틀의 나무 밑으로 한지가 깔린다: 테두리 영역까지 칠하는 바탕이 있고, 단추는 48px 이상
  const panel = await page.locator('.frame-panel').evaluate((el) => getComputedStyle(el).backgroundClip);
  assert.equal(panel, 'border-box');
  for (const sel of ['.btn-green', '.btn-wood', '.btn-sm', '.btn-lg', '.btn-icon']) {
    assert.ok(Math.round((await look(page, sel)).height) >= 48, `${sel} 높이`);
  }
  assert.equal((await look(page, '.btn-green')).height, 64);
  assert.equal((await look(page, '.btn-lg')).height, 76);
  assert.equal((await look(page, '.btn-sm')).height, 48);
  const icon = await look(page, '.btn-icon');
  assert.deepEqual([icon.width2, icon.height], [72, 80]);
  assert.deepEqual(errors, []);
  await page.close();
});

test('assets/ui/** 를 모두 막으면 ui-* 클래스 0개, .btn-green은 2px solid 테두리·높이 ≥ 48, 페이지 오류 없음', async () => {
  const { page, errors, kit } = await openKit('**/assets/ui/**');
  assert.deepEqual(kit.ok, []);
  assert.equal(kit.failed.length, 17);
  assert.deepEqual(await uiClasses(page), []);
  const green = await look(page, '.btn-green');
  assert.equal(green.style, 'solid');
  assert.equal(green.width, '2px');
  assert.equal(green.image, 'none');
  assert.ok(Math.round(green.height) >= 48, `높이 ${green.height}`);
  assert.notEqual(green.color, 'rgb(255, 255, 255)', '그림 없는 단추는 흰 글자가 아니다');
  const panel = await look(page, '.frame-panel');
  assert.equal(panel.style, 'solid');
  assert.equal(panel.width, '2px');
  assert.equal(panel.radius, '12px');
  // 글자는 그대로 읽힌다
  assert.equal(await page.locator('#b-green').innerText(), '처음부터');
  assert.equal(await page.locator('.frame-panel').innerText(), '패널 틀입니다.');
  assert.deepEqual(errors, []);
  await page.close();
});

test('btn_green만 막으면 .btn-green만 CSS 모습, .frame-panel은 그림', async () => {
  const { page, errors, kit } = await openKit('**/assets/ui/btn_green*');
  assert.deepEqual(kit.failed, ['btnGreen']);
  assert.equal((await uiClasses(page)).length, 16);
  const green = await look(page, '.btn-green');
  assert.equal(green.image, 'none');
  assert.equal(green.style, 'solid');
  assert.equal(green.width, '2px');
  assert.ok(Math.round(green.height) >= 48);
  assert.equal(await page.locator('#b-green').innerText(), '처음부터');
  assert.match((await look(page, '.btn-wood')).image, /btn_wood/);
  assert.match((await look(page, '.frame-panel')).image, /frame_panel/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('단추 상태: 못 누름은 흐리고, 누르면 2px 내려가고, 초점은 쪽빛 테두리', async () => {
  const { page, errors } = await openKit();
  const disabled = await page.locator('#b-disabled').evaluate((el) => getComputedStyle(el).filter);
  assert.match(disabled, /saturate\(0\.4\)/);
  assert.match(disabled, /opacity\(0\.6\)/);
  const box = await page.locator('#b-green').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // 80ms 전환이 끝날 때까지 기다린다
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#b-green')).filter.includes('brightness(1.08)'));
  await page.mouse.down();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#b-green')).transform === 'matrix(1, 0, 0, 1, 0, 2)');
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return { color: cs.outlineColor, width: cs.outlineWidth, offset: cs.outlineOffset };
  });
  assert.deepEqual(focus, { color: 'rgb(59, 91, 165)', width: '3px', offset: '2px' });
  assert.deepEqual(errors, []);
  await page.close();
});

test('글꼴: 고운돋움과 주아가 직접 올린 파일로 불러와진다(Google Fonts 요청 없음)', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(server.url + '/tests/fixtures/ui-kit.html');
  await page.evaluate(() => window.__kit);
  const fonts = await page.evaluate(async () => {
    await Promise.all([document.fonts.load('20px "Gowun Dodum"', '대사'), document.fonts.load('20px "Jua"', '낱말')]);
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replaceAll('"', ''));
    return { gowun: document.fonts.check('20px "Gowun Dodum"'), jua: document.fonts.check('20px "Jua"'), loaded };
  });
  assert.equal(fonts.gowun, true);
  assert.equal(fonts.jua, true);
  assert.deepEqual(fonts.loaded.sort(), ['Gowun Dodum', 'Jua']);
  assert.ok(requests.some((u) => u.endsWith('/assets/fonts/gowun-dodum.v1.woff2')));
  assert.ok(requests.some((u) => u.endsWith('/assets/fonts/jua.v1.woff2')));
  assert.deepEqual(requests.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), []);
  assert.deepEqual(errors, []);
  await page.close();
});
