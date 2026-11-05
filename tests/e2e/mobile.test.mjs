// 휴대폰·태블릿 검사(터치 기기처럼 hasTouch·isMobile):
//  - 웹 앱 설명서(manifest)와 전체 화면용 meta가 붙어 있고 바르다
//  - 처음 화면의 첫 누름에 requestFullscreen({ navigationUI: 'hide' })과 가로 고정을 부른다(되는 곳에서만, 가짜로 바꿔 센다)
//  - 전체 화면 단추는 Fullscreen API가 되는 곳에만, 아이폰 사파리에는 "홈 화면에 추가" 안내가 한 번만
//  - 세로로 든 휴대폰·태블릿: "가로로 돌려 주세요" 안내가 덮고, 가로로 돌리면 사라진다
//  - 휴대폰 가로·태블릿 크기마다 주요 장면이 쪽 스크롤 없이 화면 안에 들어가고, 단추는 44px 이상이며 화면 밖으로 나가지 않는다
//  - 탐험: 주인공이 HUD·터치 십자·말하기 단추 밑에 숨지 않는다
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue } from './browser.mjs';
import ACT1 from '../../data/acts/act1.js';

const MAP11 = ACT1.chapters[0].map.rows;
const [MW, MH] = [MAP11[0].length, MAP11.length];

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const TOUCH = { hasTouch: true, isMobile: true };
const PHONES = [[844, 390], [740, 360], [667, 375]];
const TABLETS = [[1180, 820], [1024, 768], [1366, 1024]];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// 전체 화면·가로 고정을 가짜로 바꿔 부른 기록을 남긴다(진짜로 전체 화면이 되지 않게).
function stubFullscreen(supported) {
  window.__fs = { calls: [], locks: [] };
  Object.defineProperty(Document.prototype, 'fullscreenEnabled', { configurable: true, get: () => supported });
  Element.prototype.requestFullscreen = function (opts) { window.__fs.calls.push(opts ?? null); return Promise.resolve(); };
  if (screen.orientation) screen.orientation.lock = (o) => { window.__fs.locks.push(o); return Promise.reject(new Error('NotSupportedError')); };
}

async function openTouch(size, { fullscreen = true, ua, storageReset = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, ...TOUCH, ...(ua ? { userAgent: ua } : {}) });
  await ctx.addInitScript(stubFullscreen, fullscreen);
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  if (storageReset) await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__test.fastText(true));
  return { ctx, page, errors };
}

test('manifest: 링크·meta가 있고, 전체 화면·가로·이름·색·아이콘이 바르다', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/');
  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    viewport: document.querySelector('meta[name="viewport"]')?.content,
    theme: document.querySelector('meta[name="theme-color"]')?.content,
    apple: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    mobile: document.querySelector('meta[name="mobile-web-app-capable"]')?.content,
    bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
    touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
  }));
  assert.equal(head.manifest, 'manifest.webmanifest');
  assert.match(head.viewport, /viewport-fit=cover/);
  assert.match(head.theme, /^#[0-9A-Fa-f]{6}$/);
  assert.equal(head.apple, 'yes');
  assert.equal(head.mobile, 'yes');
  assert.equal(head.bar, 'black-translucent');
  const res = await page.request.get(server.url + '/' + head.manifest);
  assert.equal(res.status(), 200);
  const m = JSON.parse(await res.text());
  assert.equal(m.name, '말빛 한울');
  assert.ok(m.short_name);
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.orientation, 'landscape');
  assert.equal(m.theme_color, head.theme);
  assert.match(m.background_color, /^#[0-9A-Fa-f]{6}$/);
  assert.ok(m.start_url);
  const sizes = new Set();
  for (const icon of m.icons) {
    const r = await page.request.get(server.url + '/' + icon.src);
    assert.equal(r.status(), 200, icon.src);
    const buf = await r.body();
    assert.equal(buf.subarray(1, 4).toString(), 'PNG', icon.src);
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    assert.equal(`${w}x${h}`, icon.sizes, icon.src);
    sizes.add(icon.sizes);
  }
  assert.ok(sizes.has('192x192') && sizes.has('512x512'), '192·512 아이콘');
  assert.ok(m.icons.some((i) => /maskable/.test(i.purpose ?? '')), '마스크 아이콘');
  const touch = await page.request.get(server.url + '/' + head.touchIcon);
  assert.equal(touch.status(), 200);
  assert.deepEqual(errors, []);
  await page.close();
});

test('터치 기기: 처음 화면 첫 누름에 전체 화면(navigationUI hide)과 가로 고정을 한 번 부르고, 전체 화면 단추가 있다', async () => {
  const { ctx, page, errors } = await openTouch([844, 390]);
  await page.waitForSelector('[data-scene="title"]');
  const fsBtn = page.locator('[data-scene="title"] .fs-toggle');
  assert.equal(await fsBtn.count(), 1, '전체 화면 단추');
  assert.equal(await fsBtn.getAttribute('aria-label'), '전체 화면 켜기/끄기');
  const box = await fsBtn.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44);
  const sound = await page.locator('[data-scene="title"] .sound-toggle').boundingBox();
  assert.ok(Math.abs(sound.y - box.y) < 2 && box.x > sound.x, '소리 단추 바로 옆');
  assert.equal(await page.locator('.ios-tip').count(), 0, '아이폰이 아니면 홈 화면 안내가 없다');
  assert.deepEqual(await page.evaluate(() => window.__fs.calls), []);
  await page.tap('.title-logo'); // 화면 아무 곳
  await page.waitForFunction(() => window.__fs.calls.length === 1);
  assert.deepEqual(await page.evaluate(() => window.__fs.calls), [{ navigationUI: 'hide' }]);
  await page.waitForFunction(() => window.__fs.locks.length === 1);
  assert.deepEqual(await page.evaluate(() => window.__fs.locks), ['landscape'], '가로 고정(거절돼도 조용히)');
  // 두 번째 누름(처음부터)에는 다시 부르지 않는다
  await page.locator('.title-menu').getByRole('button', { name: '처음부터' }).tap();
  await page.waitForSelector('[data-scene="select"]');
  assert.equal(await page.evaluate(() => window.__fs.calls.length), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('터치 기기: 처음부터를 첫 누름으로 눌러도 전체 화면을 부른다. Fullscreen API가 없으면 단추도 없다', async () => {
  let { ctx, page, errors } = await openTouch([1180, 820]);
  await page.locator('.title-menu').getByRole('button', { name: '처음부터' }).tap();
  await page.waitForSelector('[data-scene="select"]');
  assert.deepEqual(await page.evaluate(() => window.__fs.calls), [{ navigationUI: 'hide' }]);
  assert.deepEqual(errors, []);
  await ctx.close();
  ({ ctx, page, errors } = await openTouch([844, 390], { fullscreen: false }));
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await page.locator('.fs-toggle').count(), 0);
  await page.tap('.title-logo');
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] .hud');
  assert.equal(await page.locator('.fs-toggle').count(), 0, 'HUD에도 없다');
  assert.deepEqual(await page.evaluate(() => window.__fs.calls), []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('마우스 기기(PC): 첫 누름에 전체 화면을 켜지 않고, 단추와 F 키로만 켠다', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(stubFullscreen, true);
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  await page.mouse.click(200, 200);
  assert.deepEqual(await page.evaluate(() => window.__fs.calls), []);
  await page.locator('[data-scene="title"] .fs-toggle').click();
  await page.keyboard.press('KeyF');
  assert.equal(await page.evaluate(() => window.__fs.calls.length), 2);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] .hud .fs-toggle');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('아이폰 사파리: 홈 화면에 추가 안내가 처음 화면에 한 번만 뜨고, 닫으면 다시 안 뜬다', async () => {
  const { ctx, page, errors } = await openTouch([844, 390], { fullscreen: false, ua: IPHONE_UA });
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  const tip = page.locator('.ios-tip');
  await tip.waitFor();
  assert.match(await tip.innerText(), /홈 화면에 추가하면 전체 화면으로 할 수 있어요/);
  assert.match(await tip.innerText(), /공유/);
  assert.equal(await page.locator('.fs-toggle').count(), 0, '아이폰 사파리에는 전체 화면 단추가 없다');
  // 안내가 메뉴·로고와 겹치지 않고 화면 안에 있다(떠오르는 움직임이 끝난 뒤)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity));
  const t = await tip.boundingBox();
  const menu = await page.locator('.title-menu').boundingBox();
  assert.ok(t.x + t.width <= menu.x || t.y >= menu.y + menu.height, '메뉴와 겹치지 않는다');
  assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.width <= 844 && t.y + t.height <= 390);
  const close = tip.getByRole('button', { name: '알겠어요' });
  assert.ok((await close.boundingBox()).height >= 44);
  await close.tap();
  await tip.waitFor({ state: 'detached' });
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await page.locator('.ios-tip').count(), 0, '한 번 닫으면 다시 안 뜬다');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('세로로 든 휴대폰·태블릿: "가로로 돌려 주세요"가 덮고, 가로로 돌리면 사라진다', async () => {
  for (const [w, h] of [[390, 844], [820, 1180]]) {
    const { ctx, page, errors } = await openTouch([w, h]);
    await page.waitForSelector('[data-scene="title"]', { state: 'attached' });
    const overlay = page.locator('.rotate-overlay');
    assert.ok(await overlay.isVisible(), `${w}×${h}: 안내가 보인다`);
    assert.match(await overlay.innerText(), /가로로 돌려 주세요/);
    const ob = await overlay.boundingBox();
    assert.deepEqual([ob.x, ob.y, ob.width, ob.height].map(Math.round), [0, 0, w, h], '화면 전체를 덮는다');
    assert.equal(await page.locator('[data-scene="title"]').isVisible(), false, '게임은 가려진다');
    await page.setViewportSize({ width: h, height: w }); // 가로로 돌림
    await overlay.waitFor({ state: 'hidden' });
    assert.ok(await page.locator('[data-scene="title"]').isVisible());
    await page.setViewportSize({ width: w, height: h }); // 다시 세로
    await overlay.waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

// 지금 화면: 쪽 스크롤이 없고, 보이는 단추가 모두 44px 이상이며 화면 밖으로 나가지 않는다(패널 안에서 넘기는 목록 속 단추는 빼고).
async function fits(page, label, [w, h]) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250); // 패널 나타나기(180ms)
  const r = await page.evaluate(() => {
    const se = document.scrollingElement;
    const out = { scrollW: se.scrollWidth, scrollH: se.scrollHeight, bad: [], small: [] };
    const scroller = (e) => {
      for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
        const c = getComputedStyle(n);
        if (/(auto|scroll)/.test(c.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
      }
      return null;
    };
    for (const b of document.querySelectorAll('button, [role="button"]')) {
      const c = getComputedStyle(b);
      if (b.closest('[hidden]') || c.visibility === 'hidden' || c.display === 'none') continue;
      const box = b.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      const name = (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 12);
      if (Math.round(box.width) < 44 || Math.round(box.height) < 44) out.small.push(`${name} ${Math.round(box.width)}x${Math.round(box.height)}`);
      if (scroller(b)) continue;
      if (box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) out.bad.push(`${name} [${Math.round(box.left)},${Math.round(box.top)},${Math.round(box.right)},${Math.round(box.bottom)}]`);
    }
    return out;
  });
  const problems = [];
  if (r.scrollW > w) problems.push(`${label}: 가로 쪽 스크롤 ${r.scrollW}>${w}`);
  if (r.scrollH > h) problems.push(`${label}: 세로 쪽 스크롤 ${r.scrollH}>${h}`);
  problems.push(...r.bad.map((b) => `${label}: 화면 밖 단추 ${b}`), ...r.small.map((b) => `${label}: 44px 미만 ${b}`));
  return problems;
}

// 탐험: 주인공(그린 자리)이 HUD 아래에 있고 터치 조작 단추와 겹치지 않는다.
async function heroClear(page, label) {
  await page.waitForFunction(() => window.__test.view && window.__test.heroAt);
  return page.evaluate((label) => {
    const { camera, factor } = window.__test.view;
    const k = 3 * factor;
    const at = window.__test.heroAt;
    const hero = { l: (at.x * 16 - camera.x) * k, t: (at.y * 16 - 16 - camera.y) * k };
    hero.r = hero.l + 16 * k; hero.b = hero.t + 32 * k;
    const out = [];
    const hud = document.querySelector('.hud').getBoundingClientRect();
    if (hero.t < hud.bottom - 1) out.push(`${label}: 주인공이 HUD 밑(위끝 ${Math.round(hero.t)} < ${Math.round(hud.bottom)})`);
    if (hero.b > innerHeight + 1 || hero.l < -1 || hero.r > innerWidth + 1) out.push(`${label}: 주인공이 화면 밖`);
    for (const sel of ['.touch-pad', '.touch-act']) {
      const z = document.querySelector(sel)?.getBoundingClientRect();
      if (z && hero.l < z.right - 1 && z.left < hero.r - 1 && hero.t < z.bottom - 1 && z.top < hero.b - 1) out.push(`${label}: 주인공이 ${sel} 밑`);
    }
    return out;
  }, label);
}

for (const size of [...PHONES, ...TABLETS]) {
  const [w, h] = size;
  test(`${w}×${h} 터치: 주요 장면이 쪽 스크롤 없이 화면 안에, 단추 44px 이상, 주인공은 HUD·터치 단추 밖`, async () => {
    const { ctx, page, errors } = await openTouch(size);
    const problems = [];
    const check = async (label) => problems.push(...(await fits(page, `${w}×${h} ${label}`, size)));
    await page.waitForSelector('[data-scene="title"]');
    await check('타이틀');
    await page.locator('.title-menu').getByRole('button', { name: '처음부터' }).tap();
    await page.waitForSelector('[data-scene="select"]');
    await page.fill('#nickname', '하늘');
    await check('모습 고르기');
    await page.locator('.avatar-card[data-avatar="f"]').tap();
    await page.locator('.select-go').tap();
    await finishDialogue(page);
    await page.waitForSelector('[data-scene="explore"] .touch-pad');
    await check('탐험');
    problems.push(...(await heroClear(page, `${w}×${h} 탐험 시작`)));
    // 맵 네 귀퉁이 쪽으로 옮겨도 주인공이 부품 밑에 숨지 않는다(그다음 처음 자리로 되돌린다)
    const start = await page.evaluate(() => window.__test.state().pos);
    for (const [x, y] of [[1, MH - 2], [MW - 2, MH - 2], [1, 1], [MW - 2, 1]]) {
      await page.evaluate(([x, y]) => window.__test.patchState({ pos: { x, y }, facing: 'down' }), [x, y]);
      await page.waitForSelector('[data-scene="explore"] canvas');
      await page.waitForFunction(([x, y]) => window.__test.heroAt?.x === x && window.__test.heroAt?.y === y, [x, y]);
      problems.push(...(await heroClear(page, `${w}×${h} 탐험 (${x},${y})`)));
    }
    await page.evaluate((pos) => window.__test.patchState({ pos }), start);
    await page.evaluate(() => window.__test.teleportTo('dodam'));
    await page.locator('.touch-act').tap();
    await page.waitForSelector('[data-scene="dialogue"] .dialogue-arrow:not([hidden])');
    await check('대화');
    await finishDialogue(page);
    await page.locator('.hud-button[aria-label^="도감"]').tap();
    await page.waitForSelector('.codex');
    await check('도감');
    await page.locator('.codex-close').tap();
    await page.locator('.hud-button[aria-label^="할 일"]').tap();
    await page.waitForSelector('.tasks');
    await check('할 일');
    await page.locator('.tasks-close').tap();
    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await page.waitForSelector('[data-scene="explore"]');
    await page.evaluate(() => window.__test.startBattle('boss', 7));
    await page.waitForSelector('[data-phase="ask"] .battle-option');
    const seen = new Set();
    for (let i = 0; i < 6 && seen.size < 3; i++) {
      const type = await page.locator('.battle-options').getAttribute('data-type');
      if (!seen.has(type)) {
        seen.add(type);
        await check(`보스전 ${type}`);
        // 문제 말풍선과 보기 사이는 붙어 있다(12px 이하)
        const gap = await page.evaluate(() => document.querySelector('.battle-options').getBoundingClientRect().top - document.querySelector('.battle-question').getBoundingClientRect().bottom);
        if (gap > 12.5 || gap < 0) problems.push(`${w}×${h} 보스전 ${type}: 문제와 보기 사이 ${gap}px`);
      }
      const idx = await page.evaluate(() => window.__test.answerIndex());
      const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
      if (i === 0) {
        await page.keyboard.press(`Digit${((idx + 1) % 4) + 1}`);
        await page.waitForSelector('.battle-feedback .battle-next');
        await check('오답 풀이');
        await page.locator('.battle-next').tap();
      } else {
        await page.keyboard.press(`Digit${idx + 1}`);
      }
      await page.waitForFunction((n) => document.querySelector('[data-scene="battle"]')?.dataset.qn !== n && document.querySelector('[data-phase="ask"]'), qn);
    }
    await page.evaluate(() => window.__test.openQuiz(3));
    await page.waitForSelector('[data-scene="review-quiz"][data-phase="ask"]');
    await check('마무리 퀴즈');
    assert.deepEqual(problems, []);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}
