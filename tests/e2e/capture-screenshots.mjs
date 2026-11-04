// 1막 화면 사진을 docs/screenshots/act1/에 남긴다(검사가 아니라 손으로 돌리는 도구).
// 실행: node tests/e2e/capture-screenshots.mjs   (PW_CHROMIUM_PATH로 브라우저 지정 가능)
// 사진은 JPEG 품질 85(저장소 용량을 줄이려고). 1366×768(크롬북 1:1)과 1024×768 @2x(태블릿) 두 가지.
import { mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';
import { launchBrowser } from './browser.mjs';
import ACT1 from '../../data/acts/act1.js';

const OUT = fileURLToPath(new URL('../../docs/screenshots/act1/', import.meta.url));
const SIZES = [
  { name: '1366x768', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  { name: '1024x768@2x', viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 },
];
const NICK = '하늘';
const AVATAR = process.env.AVATAR === 'm' ? 'm' : 'f';

async function fresh(ctx, url) {
  const page = await ctx.newPage();
  await page.goto(url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  await page.evaluate(() => window.__test.fastText(true));
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// 화면의 그림(<img>)이 모두 다 받아졌을 때까지 기다린 뒤 찍는다.
async function shoot(page, size, label) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.waitForTimeout(450); // 패널 나타나기(180ms)·캔버스 다시 그리기
  await page.screenshot({ path: `${OUT}${label}-${size.name}.jpg`, type: 'jpeg', quality: 85 });
}

async function startBattle(page, mode) {
  await page.evaluate((m) => window.__test.startBattle(m, 7), mode);
  await page.waitForSelector('[data-scene="battle"]');
  await page.waitForSelector('.battle-tip button, [data-phase="ask"] .battle-option');
  if (await page.locator('.battle-tip').count()) await page.locator('.battle-tip button').click();
  await page.waitForSelector('[data-phase="ask"] .battle-option');
}

// 대화 첫 줄이 다 보일 때까지
async function openDialogue(page, script, words, from) {
  await page.evaluate(([s, w, f]) => window.__test.dialogue(s, w, f), [script, words, from]);
  await page.waitForSelector('[data-scene="dialogue"] .dialogue-arrow:not([hidden]), .word-card');
}

const server = await startServer();
const browser = await launchBrowser();
await mkdir(OUT, { recursive: true });
for (const f of await readdir(OUT)) if (/\.(png|jpg)$/.test(f)) await rm(OUT + f); // 앞 사진(임시 그림 시절 것 포함)을 지운다
try {
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.deviceScaleFactor });
    let page = await fresh(ctx, server.url);
    await page.locator('#nickname').fill(NICK);
    await shoot(page, size, '01-title');

    await page.evaluate(([n, a]) => window.__test.newGame(n, a), [NICK, AVATAR]);
    await page.waitForSelector('[data-scene="explore"]');
    await page.evaluate(() => window.__test.teleportTo('dodam'));
    await shoot(page, size, '02-explore-1-1');

    // 1-1 대화: 도담 할머니가 첫 부탁을 끝내며 낱말을 알려 준다 → 뜻풀이 카드
    const q1 = ACT1.chapters[0].quests[0];
    await openDialogue(page, q1.done, q1.words, '도담 할머니');
    await shoot(page, size, '04-dialogue-1-1-dodam');
    const READY = '[data-scene="dialogue"][data-ready]';
    for (let i = 0; i < 40; i++) {
      await page.waitForSelector(`.word-card, ${READY}`);
      if (await page.locator('.word-card').count()) break;
      await page.keyboard.press('Space');
      await page.waitForFunction((r) => !document.querySelector(r), READY);
    }
    await shoot(page, size, '06-meaning-card');
    await page.close();

    // 1-2: 장을 넘긴 뒤 탐험과 빵집 아저씨 대화
    page = await fresh(ctx, server.url);
    await page.evaluate(([n, a]) => window.__test.newGame(n, a), [NICK, AVATAR]);
    await page.waitForSelector('[data-scene="explore"]');
    await page.evaluate(() => window.__test.nextChapter());
    await page.evaluate(() => window.__test.teleportTo('baker'));
    await page.waitForSelector('[data-scene="explore"]');
    await shoot(page, size, '03-explore-1-2');
    const q3 = ACT1.chapters[1].quests[0];
    await openDialogue(page, q3.offer, [], '빵집 아저씨');
    await shoot(page, size, '05-dialogue-1-2-baker');
    await page.close();

    page = await fresh(ctx, server.url);
    await page.evaluate(([n, a]) => window.__test.newGame(n, a), [NICK, AVATAR]);
    await startBattle(page, 'review');
    await shoot(page, size, '07-review-battle');
    await page.close();

    // 보스전: 정답을 골라 가며 세 문제 유형(빈칸·뜻·문장)을 하나씩 찍고, 이겨서 막 클리어까지
    page = await fresh(ctx, server.url);
    await page.evaluate(([n, a]) => window.__test.newGame(n, a), [NICK, AVATAR]);
    await startBattle(page, 'boss');
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      const type = await page.locator('.battle-options').getAttribute('data-type');
      if (!seen.has(type)) {
        seen.add(type);
        await shoot(page, size, `08-boss-battle-${type}`);
      }
      const idx = await page.evaluate(() => window.__test.answerIndex());
      const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
      await page.keyboard.press(`Digit${idx + 1}`);
      await page.waitForFunction((n) => {
        const s = document.querySelector('[data-scene="battle"]');
        return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
      }, qn);
    }
    if (seen.size < 3) console.warn(`보스전 문제 유형 ${[...seen]}만 나왔다(씨앗을 바꿔 보세요)`);
    await page.waitForSelector('[data-scene="clear"]');
    await shoot(page, size, '09-act-clear');
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
