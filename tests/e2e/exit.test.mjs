// 이긴 뒤 제자리에 남기, 출구로 걸어가서 장·막 클리어, 숨은 낱말은 알려 준 뒤에만 반짝이기.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, startFromTitle } from './browser.mjs';
import { pathTo, KEYS } from './helpers.mjs';
import { parseMap } from '../../js/explore/grid.js';
import { chapterWords } from '../../js/rules/game.js';
import ACT1 from '../../data/acts/act1.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const [CH1, CH2] = ACT1.chapters;
const actWordIds = () => ACT1.chapters.flatMap(chapterWords);
const state = (page) => page.evaluate(() => window.__test.state());
const hudTask = (page) => page.locator('.hud-task').innerText();
const toast = async (page) => {
  await page.waitForSelector('.toast:not([hidden])');
  return page.locator('.toast').innerText();
};

async function open(name = '하늘') {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.fastText(true));
  await page.evaluate((n) => window.__test.newGame(n, 'f'), name);
  await page.waitForSelector('[data-scene="explore"] canvas');
  await page.waitForFunction(() => window.__test.view);
  return { page, errors };
}

// 한 장의 낱말을 다 얻은 것으로 한다(부탁은 다 끝낸 것으로)
const completed = (chapter) => (s) => {
  const acquired = { ...s.acquired };
  for (const w of chapterWords(chapter)) acquired[w] = { from: '검사' };
  const quests = { ...s.quests };
  for (const q of chapter.quests) quests[q.id] = { stage: 'done', gathered: [] };
  return { acquired, quests, hiddenFound: { ...s.hiddenFound, [chapter.id]: true } };
};

// 지금 자리에서 출구 칸까지 걷는다. 마지막 걸음은 따로 부른다(그 걸음이 장면을 바꾸므로).
async function walkTo(page, map, to, opts, { last = true } = {}) {
  const s = await state(page);
  const dirs = pathTo(map, s.pos, to, opts);
  assert.ok(dirs.length > 0, `출구까지 길이 있어야 한다: ${JSON.stringify(s.pos)} → ${JSON.stringify(to)}`);
  const stop = last ? dirs.length : dirs.length - 1;
  for (const dir of dirs.slice(0, stop)) await page.keyboard.press(KEYS[dir]);
  return dirs;
}

test('1-1: 낱말을 다 모아도 저절로 넘어가지 않고, 출구 칸으로 걸어 들어서야 장 클리어가 열린다', async () => {
  const { page, errors } = await open();
  const map = parseMap(CH1.map.rows);
  const done = completed(CH1)(await state(page));
  await page.evaluate((p) => window.__test.patchState(p), { ...done, smallGone: { '1-1': true } });
  await page.waitForSelector('[data-scene="explore"] canvas');
  // 한참 기다려도 탐험에 남아 있다
  await page.waitForTimeout(800);
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  assert.equal(await hudTask(page), CH1.exit.goal);
  const before = await state(page);
  assert.equal(before.chapter, '1-1');
  // 출구 바로 앞까지 걸어도(마지막 걸음 전) 그대로
  const dirs = await walkTo(page, map, CH1.exit, { smallMonsterGone: true }, { last: false });
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  // 마지막 걸음: 출구 칸에 들어서면 장 클리어
  await page.keyboard.press(KEYS[dirs.at(-1)]);
  await page.waitForSelector('[data-scene="clear"]');
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /1장 클리어!/);
  await page.getByRole('button', { name: '다음 장으로' }).click();
  await finishDialogue(page);
  assert.equal((await state(page)).chapter, '1-2');
  assert.deepEqual(errors, []);
  await page.close();
});

test('1-1: 낱말이 모자라면 출구 칸에 들어서도 막지 않고 남은 낱말 수만 알려 준다', async () => {
  const { page, errors } = await open();
  const map = parseMap(CH1.map.rows);
  await page.evaluate((p) => window.__test.patchState(p), { smallGone: { '1-1': true } });
  const dirs = await walkTo(page, map, CH1.exit, { smallMonsterGone: true });
  assert.ok(dirs.length > 10);
  const s = await state(page);
  assert.deepEqual(s.pos, { x: CH1.exit.x, y: CH1.exit.y }, '걸을 수 있는 칸이라 막지 않는다');
  assert.equal(await toast(page), '아직 찾지 못한 낱말이 5개 있어.');
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  // 한 걸음 물러났다 다시 들어서도 같은 알림
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  assert.deepEqual((await state(page)).pos, { x: CH1.exit.x, y: CH1.exit.y });
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

async function winBoss(page) {
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
  for (let i = 0; i < 6; i++) {
    const idx = await page.evaluate(() => window.__test.answerIndex());
    const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
    await page.keyboard.press(`Digit${idx + 1}`);
    if (i < 5) {
      await page.waitForFunction((n) => {
        const s = document.querySelector('[data-scene="battle"]');
        return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
      }, qn);
    }
  }
}

test('1-2: 보스를 이기면 그 자리에 남고 보스는 사라지며, 출구로 걸어가야 1막 클리어가 열린다', async () => {
  const { page, errors } = await open();
  const map = parseMap(CH2.map.rows);
  await page.evaluate(() => window.__test.startBattle('boss', 5)); // 1-2 시작 자리, 1막 낱말 10개
  await winBoss(page);
  // 이긴 직후에는 막 클리어가 아니라 탐험으로 돌아온다
  await page.waitForSelector('[data-scene="explore"] canvas');
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  let s = await state(page);
  assert.deepEqual(s.clearedActs, [1]);
  assert.deepEqual(s.pos, { x: map.start.x, y: map.start.y }, '싸우기 전 그 자리에 선다');
  assert.equal(s.chapter, '1-2');
  assert.equal(await hudTask(page), CH2.exit.goal);
  // 이긴 직후 길잡이 한마디
  await page.locator('.hint[data-tip="guide-won"]').waitFor();
  assert.equal(await page.locator('.hint[data-tip="guide-won"]').innerText(), CH2.exit.won);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.deepEqual(saved.clearedActs, [1], '이긴 것은 저장된다');
  // 보스 자리는 이제 길이다: 보스 곁으로 가서 Space를 눌러도 싸우지 않는다
  await page.evaluate(() => window.__test.teleportTo('boss'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-scene="battle"]').count(), 0);
  // 출구까지 걷기(보스가 있던 칸으로도 갈 수 있다)
  const opts = { fogOpen: true, smallMonsterGone: true, bossGone: true };
  const dirs = await walkTo(page, map, CH2.exit, opts, { last: false });
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  await page.keyboard.press(KEYS[dirs.at(-1)]);
  await page.waitForSelector('[data-scene="clear"]');
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /1막 클리어!/);
  assert.equal(await page.locator('.clear-card').count(), 10);
  assert.deepEqual(errors, []);
  await page.close();
});

test('1-2: 보스를 물리치기 전에는 출구 칸에 서도 넘어가지 않고 "그림자" 알림만 뜬다', async () => {
  const { page, errors } = await open();
  const map = parseMap(CH2.map.rows);
  await page.evaluate(() => window.__test.startBattle('boss', 5));
  await page.waitForSelector('[data-scene="battle"]');
  await page.evaluate(() => window.__test.patchState({})); // 싸움을 접고 탐험으로(상태는 그대로: 1-2, 낱말 10개, 보스 전)
  await page.waitForSelector('[data-scene="explore"] canvas');
  assert.deepEqual((await state(page)).clearedActs, []);
  await walkTo(page, map, CH2.exit, { fogOpen: true, smallMonsterGone: true });
  assert.deepEqual((await state(page)).pos, { x: CH2.exit.x, y: CH2.exit.y });
  assert.equal(await toast(page), CH2.exit.closed);
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('옛 저장: 이미 장을 다 모은 저장·이미 보스를 이긴 저장으로 이어 해도 저절로 넘어가지 않고 탐험에 선다', async () => {
  const { page, errors } = await open('구름');
  const cont = async () => {
    await page.reload();
    await page.waitForSelector('[data-scene="title"]');
    await page.evaluate(() => window.__test.fastText(true));
    await startFromTitle(page, { name: '구름', mode: 'continue' });
    await page.waitForSelector('[data-scene="explore"] canvas');
    await page.waitForTimeout(600);
  };
  // 낱말을 다 모은 1-1 저장
  await page.evaluate((p) => window.__test.patchState(p), completed(CH1)(await state(page)));
  await cont();
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  let s = await state(page);
  assert.equal(s.chapter, '1-1');
  assert.deepEqual(s.clearedChapters, []);
  assert.equal(await hudTask(page), CH1.exit.goal);
  // 이미 보스를 이긴 1-2 저장(예전에는 이기자마자 막 클리어가 열렸고, 저장은 보스 곁 자리)
  await page.evaluate(() => window.__test.startBattle('boss', 5));
  await page.waitForSelector('[data-scene="battle"]');
  await page.evaluate((ids) => window.__test.patchState({ clearedActs: [1], askedWordIds: ids }), actWordIds());
  await cont();
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  s = await state(page);
  assert.equal(s.chapter, '1-2');
  assert.deepEqual(s.clearedActs, [1]);
  assert.equal(await hudTask(page), CH2.exit.goal);
  assert.deepEqual(errors, []);
  await page.close();
});

test('숨은 낱말: 텃밭 아저씨가 알려 주기 전에는 장독대를 조사해도 낱말이 없고, 알려 준 뒤에야 반짝이며 낱말을 얻는다', async () => {
  const { page, errors } = await open();
  const glow = () => page.evaluate(async () => {
    const { hiddenGlow } = await import('/js/rules/quests.js');
    const { actOfChapter } = await import('/data/acts/index.js');
    const s = window.__test.state();
    return hiddenGlow(s, actOfChapter(s.chapter).chapters.find((c) => c.id === s.chapter));
  });
  const talk = async (target) => {
    await page.evaluate((t) => window.__test.teleportTo(t), target);
    await page.waitForSelector('[data-scene="explore"]');
    await page.keyboard.press('Space');
  };
  // 첫 부탁(말빛 주머니)만 받은 상태
  await talk('dodam'); await finishDialogue(page);
  assert.equal(await glow(), 'none');
  // 장독대를 조사해도 물건 글만 나오고 낱말은 얻지 못한다
  await talk('장독대');
  assert.equal(await toast(page), '크고 작은 장독들이 가지런히 놓여 있다.');
  assert.equal(await page.locator('[data-scene="dialogue"]').count(), 0);
  let s = await state(page);
  assert.ok(!('오롯이' in s.acquired));
  assert.deepEqual(s.hiddenFound, {});
  // 텃밭 아저씨 이야기를 들으면 반짝이기 시작한다
  await talk('gardener');
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.match(await page.locator('[data-scene="dialogue"]').innerText(), /반짝|어, 그/);
  await finishDialogue(page);
  assert.deepEqual((await state(page)).revealed, { '1-1': true });
  assert.equal(await glow(), 'dim');
  await talk('장독대');
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.deepEqual(await finishDialogue(page), ['오롯이']);
  assert.ok('오롯이' in (await state(page)).acquired);
  assert.deepEqual(errors, []);
  await page.close();
});
