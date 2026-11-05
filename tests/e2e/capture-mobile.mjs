// 휴대폰·태블릿 화면 사진을 docs/screenshots/mobile/에 남긴다(검사가 아니라 손으로 돌리는 도구).
// 실행: node tests/e2e/capture-mobile.mjs   (PW_CHROMIUM_PATH로 브라우저 지정 가능)
// OUT=폴더 로 다른 곳에 찍을 수 있고, ONLY=정규식 으로 일부 사진만 찍는다. SIZES=844x390,1180x820 처럼 크기를 고른다.
// 터치 기기처럼(hasTouch·isMobile) 연다. 사진은 JPEG 품질 80.
import { mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { startServer } from './server.mjs';
import { launchBrowser, finishDialogue } from './browser.mjs';
import { walkToExit } from './helpers.mjs';
import { atEndingExit } from './play.mjs';
import ACT1 from '../../data/acts/act1.js';

const OUT = process.env.OUT ? resolve(process.env.OUT) + '/' : fileURLToPath(new URL('../../docs/screenshots/mobile/', import.meta.url));
const ALL = {
  '844x390': { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 },
  '740x360': { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2 },
  '667x375': { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2 },
  '1180x820': { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 },
  '1024x768': { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 },
  '1366x1024': { viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 1 },
};
const SIZES = (process.env.SIZES ?? '844x390,1180x820').split(',').map((name) => ({ name, ...ALL[name] }));
const NICK = '하늘';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const wanted = (label) => !ONLY || ONLY.test(label);

async function fresh(ctx, url) {
  const page = await ctx.newPage();
  await page.goto(url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]', { state: 'attached' }); // 세로 화면에서는 안내에 가려 보이지 않는다
  await page.evaluate(() => window.__test.fastText(true));
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function shoot(page, size, label) {
  if (!wanted(label)) return;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}${label}-${size.name}.jpg`, type: 'jpeg', quality: 80 });
}

async function startBattle(page, mode, seed = 7) {
  await page.evaluate(([m, s]) => window.__test.startBattle(m, s), [mode, seed]);
  await page.waitForSelector('[data-scene="battle"]');
  await page.waitForSelector('[data-phase="ask"] .battle-option');
}
async function answer(page, right = true) {
  const idx = await page.evaluate(() => window.__test.answerIndex());
  const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
  await page.keyboard.press(`Digit${(right ? idx : (idx + 1) % 4) + 1}`);
  if (!right) {
    await page.waitForSelector('.battle-feedback .battle-next');
    return;
  }
  await page.waitForFunction((n) => {
    const s = document.querySelector('[data-scene="battle"]');
    return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
  }, qn);
}
async function newGame(page) {
  await page.evaluate((n) => window.__test.newGame(n, 'f'), NICK);
  await page.waitForSelector('[data-scene="explore"]');
}

const server = await startServer();
const browser = await launchBrowser();
await mkdir(OUT, { recursive: true });
for (const f of await readdir(OUT)) if (/\.(png|jpg)$/.test(f) && wanted(f) && SIZES.some((s) => f.includes(s.name))) await rm(OUT + f);
try {
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.deviceScaleFactor, hasTouch: true, isMobile: true });
    let page = await fresh(ctx, server.url);
    await shoot(page, size, '01-title');
    await page.locator('.title-menu').getByRole('button', { name: '처음부터' }).click();
    await page.waitForSelector('[data-scene="select"]');
    await page.locator('#nickname').fill(NICK);
    await page.locator('.avatar-card[data-avatar="f"]').click();
    await shoot(page, size, '02-select');
    await page.locator('.select-go').click();
    await finishDialogue(page);
    await page.locator('.hint').first().waitFor().catch(() => {});
    await shoot(page, size, '03-explore-1-1');

    await page.evaluate(() => window.__test.teleportTo('dodam'));
    const q1 = ACT1.chapters[0].quests[0];
    await page.evaluate(([s, w, f]) => window.__test.dialogue(s, w, f), [q1.done, q1.words, '도담 할머니']);
    await page.waitForSelector('[data-scene="dialogue"] .dialogue-arrow:not([hidden]), .word-card');
    await shoot(page, size, '05-dialogue');
    const READY = '[data-scene="dialogue"][data-ready]';
    for (let i = 0; i < 40; i++) {
      await page.waitForSelector(`.word-card, ${READY}`);
      if (await page.locator('.word-card').count()) break;
      await page.keyboard.press('Space');
      await page.waitForFunction((r) => !document.querySelector(r), READY);
    }
    await page.waitForSelector('.word-card.lit');
    await shoot(page, size, '06-meaning-card');
    await page.locator('.word-card button').click();
    await finishDialogue(page);
    await page.keyboard.press('KeyE');
    await page.waitForSelector('.codex');
    await shoot(page, size, '07-codex');
    await page.keyboard.press('KeyQ');
    await page.waitForSelector('.tasks');
    await shoot(page, size, '08-tasks');
    await page.close();

    // 동료가 있는 HUD(2-1 해솔)
    page = await fresh(ctx, server.url);
    await newGame(page);
    await page.evaluate(() => window.__test.goChapter('2-1'));
    await page.waitForSelector('[data-scene="dialogue"], [data-scene="explore"]');
    if (await page.locator('[data-scene="dialogue"]').count()) await finishDialogue(page);
    await page.waitForSelector('[data-scene="explore"] .hud-companion');
    await shoot(page, size, '04-explore-companion');
    await page.close();

    page = await fresh(ctx, server.url);
    await newGame(page);
    await startBattle(page, 'review');
    await shoot(page, size, '09-review-battle');
    await page.close();

    page = await fresh(ctx, server.url);
    await newGame(page);
    await startBattle(page, 'boss');
    const seen = new Set();
    for (let i = 0; i < 7; i++) {
      const type = await page.locator('.battle-options').getAttribute('data-type');
      if (!seen.has(type)) { seen.add(type); await shoot(page, size, `10-boss-${type}`); }
      if (i === 0) {
        await answer(page, false);
        await shoot(page, size, '11-wrong-feedback');
        await page.locator('.battle-next').click();
        await page.waitForSelector('[data-phase="ask"] .battle-option');
        continue;
      }
      await answer(page, true);
    }
    await page.waitForSelector('.battle-win').catch(() => {});
    await shoot(page, size, '12-battle-win');
    await page.waitForSelector('[data-scene="explore"] canvas');
    await walkToExit(page);
    await page.waitForSelector('[data-scene="clear"]');
    await shoot(page, size, '14-clear');
    await page.getByRole('button', { name: '세계 지도로' }).click();
    await page.waitForSelector('[data-scene="worldmap"][data-walked]');
    await shoot(page, size, '15-worldmap');
    await page.close();

    page = await fresh(ctx, server.url);
    await newGame(page);
    await startBattle(page, 'boss');
    for (let i = 0; i < 5; i++) {
      await answer(page, false);
      await page.locator('.battle-next').click();
    }
    await page.waitForSelector('[data-scene="gameover"]');
    await shoot(page, size, '13-gameover');
    await page.close();

    // 5막 마지막 문제(세로 보스 + 해설 한 줄)
    page = await fresh(ctx, server.url);
    await newGame(page);
    await page.evaluate(() => window.__test.goChapter('5-2'));
    await page.waitForSelector('[data-scene="explore"] .hud');
    await startBattle(page, 'boss');
    for (let i = 0; i < 9; i++) await answer(page, true);
    await page.waitForSelector('.final-cue');
    await shoot(page, size, '16-final-battle');
    await page.close();

    // 엔딩: 마지막 말 → 주머니 → 퀴즈 → 만든 이
    page = await fresh(ctx, server.url);
    await newGame(page);
    await atEndingExit(page);
    await walkToExit(page);
    await page.waitForSelector('[data-scene="clear"]');
    await page.getByRole('button', { name: '엔딩 보기' }).click();
    await page.waitForSelector('[data-scene="dialogue"]');
    await shoot(page, size, '17-ending-dialogue');
    await finishDialogue(page, 'ending');
    await page.waitForSelector('.ending-next:not([hidden])');
    await shoot(page, size, '18-ending-message');
    await page.locator('.ending-next').click();
    await page.waitForSelector('[data-part="pouch"][data-lit]');
    await page.locator('.pouch .codex-card').nth(3).click();
    await shoot(page, size, '19-pouch');
    await page.getByRole('button', { name: '마무리 퀴즈' }).click();
    const quizSeen = new Set();
    for (let i = 0; i < 10; i++) {
      await page.waitForSelector(`[data-scene="review-quiz"][data-phase="ask"][data-qn="${i}"]`);
      const q = await page.evaluate(() => window.__test.quiz());
      if (!quizSeen.has(q.type)) { quizSeen.add(q.type); await shoot(page, size, `20-quiz-${q.type}`); }
      const miss = i < 2;
      if (q.type === 'chosung') {
        await page.locator('.quiz-input').fill(miss ? '모르겠다' : q.answerText);
        await page.locator('.quiz-input').press('Enter');
      } else {
        await page.keyboard.press(`Digit${(miss ? (q.answerIndex + 1) % 4 : q.answerIndex) + 1}`);
      }
      await page.waitForSelector('[data-phase="feedback"] .quiz-next');
      if (i === 0) await shoot(page, size, '21-quiz-feedback');
      await page.locator('.quiz-next').click();
    }
    await page.waitForSelector('[data-scene="review-quiz"][data-phase="result"]');
    await shoot(page, size, '22-quiz-result');
    await page.getByRole('button', { name: '계속' }).click();
    await page.waitForSelector('[data-part="credits"]');
    await shoot(page, size, '23-credits');
    await page.close();
    await ctx.close();

    // 세로로 든 기기: 돌려 달라는 안내
    const portrait = await browser.newContext({ viewport: { width: size.viewport.height, height: size.viewport.width }, deviceScaleFactor: size.deviceScaleFactor, hasTouch: true, isMobile: true });
    page = await fresh(portrait, server.url);
    await shoot(page, size, '24-portrait');
    await portrait.close();
  }
  // 아이폰 사파리: 홈 화면에 추가 안내(한 번만)
  if (wanted('25-ios-tip')) {
    const ios = await browser.newContext({
      viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    });
    const page = await fresh(ios, server.url);
    await page.waitForSelector('.ios-tip').catch(() => {});
    await shoot(page, { name: '844x390' }, '25-ios-tip');
    await ios.close();
  }
} finally {
  await browser.close();
  await server.close();
}
