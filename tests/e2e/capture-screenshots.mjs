// 1막 화면 사진을 docs/screenshots/act1/에 남긴다(검사가 아니라 손으로 돌리는 도구).
// 실행: node tests/e2e/capture-screenshots.mjs   (PW_CHROMIUM_PATH로 브라우저 지정 가능)
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';
import { launchBrowser } from './browser.mjs';
import ACT1 from '../../data/acts/act1.js';

const OUT = fileURLToPath(new URL('../../docs/screenshots/act1/', import.meta.url));
const SIZES = [
  { name: '1366x768', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  { name: '1024x768@2x', viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 },
];

async function fresh(ctx, url) {
  const page = await ctx.newPage();
  await page.goto(url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  await page.evaluate(() => window.__test.fastText(true));
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function shoot(page, size, label) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${label}-${size.name}.png` });
}

async function startBattle(page, mode) {
  await page.evaluate((m) => window.__test.startBattle(m, 7), mode);
  await page.waitForSelector('[data-scene="battle"]');
  await page.waitForSelector('.battle-tip button, [data-phase="ask"] .battle-option');
  if (await page.locator('.battle-tip').count()) await page.locator('.battle-tip button').click();
  await page.waitForSelector('[data-phase="ask"] .battle-option');
}

const server = await startServer();
const browser = await launchBrowser();
await mkdir(OUT, { recursive: true });
try {
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.deviceScaleFactor });
    let page = await fresh(ctx, server.url);
    await page.locator('#nickname').fill('하늘');
    await shoot(page, size, '1-title');

    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await page.waitForSelector('[data-scene="explore"]');
    await page.evaluate(() => window.__test.teleportTo('dodam'));
    await shoot(page, size, '2-explore-1-1');

    const q1 = ACT1.chapters[0].quests[0];
    await page.evaluate(([script, words]) => window.__test.dialogue(script, words, '도담 할머니'), [q1.done, q1.words]);
    await page.waitForSelector('[data-scene="dialogue"]');
    await shoot(page, size, '3-dialogue');
    // 카드가 뜰 때까지 줄을 넘긴다: 넘어갈 준비(data-ready)를 기다려 스페이스, 줄이 바뀔 때까지 기다린다.
    const READY = '[data-scene="dialogue"][data-ready]';
    for (let i = 0; i < 40; i++) {
      await page.waitForSelector(`.word-card, ${READY}`);
      if (await page.locator('.word-card').count()) break;
      await page.keyboard.press('Space');
      await page.waitForFunction((r) => !document.querySelector(r), READY);
    }
    await shoot(page, size, '4-meaning-card');
    await page.close();

    page = await fresh(ctx, server.url);
    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await startBattle(page, 'review');
    await shoot(page, size, '5-review-battle');
    await page.close();

    page = await fresh(ctx, server.url);
    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await startBattle(page, 'boss');
    await shoot(page, size, '6-boss-battle');
    for (let i = 0; i < 6; i++) {
      const idx = await page.evaluate(() => window.__test.answerIndex());
      const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
      await page.keyboard.press(`Digit${idx + 1}`);
      await page.waitForFunction((n) => {
        const s = document.querySelector('[data-scene="battle"]');
        return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
      }, qn);
    }
    await page.waitForSelector('[data-scene="clear"]');
    await shoot(page, size, '7-act-clear');
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
