// 2~5막과 엔딩 화면 사진을 docs/screenshots/act2~act5/, ending/에 남긴다(검사가 아니라 손으로 돌리는 도구).
// 실행: node tests/e2e/capture-acts.mjs   (PW_CHROMIUM_PATH로 브라우저 지정 가능)
// 일부만 다시 찍으려면 ONLY에 사진 경로의 정규식을 준다. 예: ONLY='act4/' node tests/e2e/capture-acts.mjs
// 1366×768(크롬북 1:1)만, JPEG 품질 85. 그림이 아직 없는 곳은 임시 그림(색 블록·이름 첫 글자)으로 찍힌다.
import { mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';
import { launchBrowser, finishDialogue } from './browser.mjs';
import { walkToExit } from './helpers.mjs';
import { answerRight, answerQuiz } from './play.mjs';
import { ACTS } from '../../data/acts/index.js';
import { actWords } from '../../js/rules/game.js';

const ROOT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
const SIZE = { name: '1366x768', viewport: { width: 1366, height: 768 } };
const NICK = '하늘';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const wanted = (label) => !ONLY || ONLY.test(label);
const READY = '[data-scene="dialogue"][data-ready]';
// 막마다 동료 대사로 찍을 장과 인물(4막은 다툰 해솔의 뾰로통한 얼굴)
const COMPANION = { 2: ['2-1', 'haesol'], 3: ['3-1', 'narae'], 4: ['4-2', 'haesol'], 5: ['5-1', 'haesol'] };

async function shoot(page, label) {
  if (!wanted(label)) return;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.waitForTimeout(450); // 패널 나타나기·캔버스 다시 그리기
  await page.screenshot({ path: `${ROOT}${label}-${SIZE.name}.jpg`, type: 'jpeg', quality: 85 });
}

async function fresh(ctx, url) {
  const page = await ctx.newPage();
  await page.goto(url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  await page.evaluate(() => window.__test.fastText(true));
  await page.evaluate(([n]) => window.__test.newGame(n, 'f'), [NICK]);
  await page.waitForSelector('[data-scene="explore"] canvas');
  return page;
}

async function goChapter(page, id) {
  await page.evaluate((c) => window.__test.goChapter(c), id);
  await page.waitForSelector('[data-scene="explore"] canvas');
}

// 대화의 n번째 줄(0부터)이 다 보일 때까지 넘긴다.
async function toLine(page, n) {
  for (let i = 0; i < n; i++) {
    await page.waitForSelector(READY);
    await page.keyboard.press('Space');
    await page.waitForFunction((r) => !document.querySelector(r), READY);
  }
  await page.waitForSelector(READY);
}

// 그 막을 마친 상태(낱말·부탁 끝, 보스를 이기고 보스 뒤 장면도 봄)로 뒷 장에 세운다.
async function atActEnd(page, act) {
  await goChapter(page, `${act.id}-2`);
  const quests = act.chapters.flatMap((c) => c.quests.map((q) => q.id));
  await page.evaluate(([id, words, qids]) => window.__test.patchState((s) => ({
    clearedActs: Array.from({ length: id }, (_, i) => i + 1),
    seenScenes: [...(s.seenScenes ?? []), `${id}-2:afterBoss`],
    acquired: { ...s.acquired, ...Object.fromEntries(words.map((w) => [w, { from: '사진' }])) },
    quests: { ...s.quests, ...Object.fromEntries(qids.map((q) => [q, { stage: 'done', gathered: [] }])) },
  })), [act.id, actWords(act), quests]);
  await page.waitForSelector('[data-scene="explore"] canvas');
}

const server = await startServer();
const browser = await launchBrowser();
const dirs = [...ACTS.slice(1).map((a) => `act${a.id}/`), 'ending/'];
for (const d of dirs) {
  await mkdir(ROOT + d, { recursive: true });
  for (const f of await readdir(ROOT + d)) if (/\.(png|jpg)$/.test(f) && wanted(d + f)) await rm(ROOT + d + f);
}
try {
  const ctx = await browser.newContext({ viewport: SIZE.viewport, deviceScaleFactor: 1 });
  for (const act of ACTS.slice(1)) {
    const n = act.id;
    const dir = `act${n}/`;
    let page = await fresh(ctx, server.url);
    await goChapter(page, `${n}-1`);
    await shoot(page, `${dir}01-explore-${n}-1`);
    await goChapter(page, `${n}-2`);
    await shoot(page, `${dir}02-explore-${n}-2`);

    // 동료 대사
    const [cid, who] = COMPANION[n];
    await goChapter(page, cid);
    await page.evaluate((t) => window.__test.teleportTo(t), who);
    await page.waitForSelector('[data-scene="explore"] canvas');
    await page.keyboard.press('Space');
    await page.waitForSelector(READY);
    await shoot(page, `${dir}03-dialogue-companion`);
    await page.close();

    // 보스전(5막은 마지막 '나래' 문제의 한 줄까지)
    page = await fresh(ctx, server.url);
    await goChapter(page, `${n}-2`);
    await page.evaluate(() => window.__test.startBattle('boss', 7));
    await page.waitForSelector('[data-phase="ask"] .battle-option');
    await shoot(page, `${dir}04-boss-battle`);
    if (act.finalCue) {
      while (!(await page.locator('.final-cue').count())) await answerRight(page);
      await page.waitForSelector('[data-phase="ask"] .battle-option');
      await shoot(page, `${dir}06-final-cue`);
    }
    // 이겨서 보스 뒤 장면(4막은 반전: 나래가 끌려간다)
    while (await page.locator('[data-scene="battle"]').count()) await answerRight(page);
    await page.waitForSelector('[data-scene="dialogue"]');
    if (n === 4) {
      await toLine(page, 3); // "나도 저 그림자에서 빠져나온 말이야."
      await shoot(page, `${dir}06-after-boss`);
    }
    await finishDialogue(page);
    await page.close();

    // 막 클리어
    page = await fresh(ctx, server.url);
    await atActEnd(page, act);
    await walkToExit(page);
    await page.waitForSelector('[data-scene="clear"]');
    await shoot(page, `${dir}05-act-clear`);
    await page.close();
  }

  // 세계 지도: 4막을 마치고 5막 「잿빛 탑」으로 떠나기 전
  let page = await fresh(ctx, server.url);
  await atActEnd(page, ACTS[3]);
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
  await page.waitForFunction(() => document.getAnimations().every((a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState !== 'running'));
  await shoot(page, 'ending/01-worldmap');
  await page.close();

  // 엔딩: 첫 장면 → 되찾은 마을(너울장) → 마지막 말 → 주머니 → 마무리 퀴즈 → 만든 이
  page = await fresh(ctx, server.url);
  await atActEnd(page, ACTS[4]);
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '엔딩 보기' }).click();
  await page.waitForSelector(READY);
  await shoot(page, 'ending/02-ending-scene');
  await toLine(page, 5); // 장면 2 첫 줄 다음: 사과 장수 아저씨
  await shoot(page, 'ending/06-montage');
  await finishDialogue(page, 'ending');
  await page.getByRole('button', { name: '다음' }).waitFor();
  await shoot(page, 'ending/03-last-message');
  await page.getByRole('button', { name: '다음' }).click();
  await page.waitForSelector('[data-part="pouch"][data-lit]');
  await shoot(page, 'ending/04-pouch');
  await page.getByRole('button', { name: '마무리 퀴즈' }).click();
  await page.waitForSelector('[data-scene="review-quiz"][data-phase="ask"]');
  await shoot(page, 'ending/07-quiz');
  await answerQuiz(page, { wrong: [2, 6] });
  await shoot(page, 'ending/08-quiz-result');
  await page.getByRole('button', { name: '계속' }).click();
  await page.waitForSelector('[data-part="credits"]');
  await shoot(page, 'ending/05-credits');
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}
console.log('사진을 docs/screenshots/act2~act5/, ending/에 남겼다');
