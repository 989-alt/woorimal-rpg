// 길잡이: 이긴 직후 한마디, 그냥 지나가려 할 때, 오래 헤맬 때, 숨은 낱말 빛무리.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue } from './browser.mjs';
import ACT1 from '../../data/acts/act1.js';
import { parseMap } from '../../js/explore/grid.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const hintOf = (page, id) => page.locator(`.hint[data-tip="${id}"]`);
const hintIds = (page) => page.evaluate(() => (window.__test.hints ?? []).map((h) => h.id));
const state = (page) => page.evaluate(() => window.__test.state());

async function open(page) {
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.fastText(true));
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  await page.waitForFunction(() => window.__test.view);
}

async function talk(page, target) {
  await page.evaluate((t) => window.__test.teleportTo(t), target);
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('Space');
}

// 꼬마 안개 앞에서 복습전을 열어 세 문제를 맞히고 탐험으로 돌아온다(진짜 길: 다온의 부탁을 받은 상태).
async function beatSmall(page) {
  await talk(page, 'dodam'); await finishDialogue(page);
  await talk(page, '우물'); await page.waitForSelector('.toast:not([hidden])');
  await talk(page, 'dodam'); await finishDialogue(page);
  await talk(page, 'daon'); await finishDialogue(page);
  await page.evaluate(() => window.__test.teleportTo('small'));
  await page.keyboard.press('Space');
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
  for (let i = 0; i < 3; i++) {
    const idx = await page.evaluate(() => window.__test.answerIndex());
    const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
    await page.keyboard.press(`Digit${idx + 1}`);
    await page.waitForFunction((n) => {
      const s = document.querySelector('[data-scene="battle"]');
      return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
    }, qn);
  }
  await page.waitForSelector('[data-scene="explore"] canvas');
}

test('꼬마 안개를 이기고 돌아오면 "다온에게" 길잡이가 뜨고, 저장의 seenTips에는 들어가지 않는다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await open(page);
  await beatSmall(page);
  await hintOf(page, 'guide-won').waitFor();
  assert.match(await hintOf(page, 'guide-won').innerText(), /다온에게 돌아가 알려 주자/);
  assert.match(await page.locator('.hud-task').innerText(), /다온에게 돌아가 알려 주자/);
  // 3초 뒤에는 사라진다
  await hintOf(page, 'guide-won').waitFor({ state: 'detached', timeout: 6000 });
  const s = await state(page);
  assert.ok(!s.seenTips.some((t) => t.startsWith('guide-')), `seenTips: ${s.seenTips}`);
  assert.deepEqual(errors, []);
  await page.close();
});

test('다온에게 가지 않고 빈터 쪽으로 걸으면 길잡이가 뜨지만 걸음은 막지 않고, 20초 안에 같은 말을 또 띄우지 않는다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await open(page);
  await beatSmall(page);
  await hintOf(page, 'guide-won').waitFor({ state: 'detached', timeout: 6000 });
  const map = parseMap(ACT1.chapters[0].map.rows);
  const m = map.smallMonster; // 골목 입구: 이제 걸을 수 있는 칸
  let s = await state(page);
  assert.deepEqual(s.pos, { x: m.x, y: m.y + 1 });
  // 광장 안에서 다니는 걸음은 아니다
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  assert.equal(await hintOf(page, 'guide-leave').count(), 0);
  // 골목으로 들어서는 걸음: 막히지 않고, 길잡이가 뜬다
  await page.keyboard.press('ArrowUp');
  s = await state(page);
  assert.deepEqual(s.pos, { x: m.x, y: m.y }, '걸음은 막히지 않는다');
  await hintOf(page, 'guide-leave').waitFor();
  assert.match(await hintOf(page, 'guide-leave').innerText(), /다온에게 돌아가 알려 주자/);
  // 더 걸어도 길은 열려 있고, 같은 말은 20초 안에 다시 뜨지 않는다
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  s = await state(page);
  assert.deepEqual(s.pos, { x: m.x, y: m.y - 2 });
  assert.equal((await hintIds(page)).filter((id) => id === 'guide-leave').length, 1);
  assert.ok(!(await state(page)).seenTips.some((t) => t.startsWith('guide-')));
  assert.deepEqual(errors, []);
  await page.close();
});

test('30초 동안 할 일이 나아가지 않으면 말풍선과 가장자리 화살표가 뜨고, 움직이면 사라진다. 안내가 먼저다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await open(page);
  // 처음에는 걷는 법 안내가 떠 있다: 시계를 앞당겨도 길잡이는 비켜 있는다
  await hintOf(page, 'move').waitFor();
  await page.evaluate(() => { window.__test.clockSkew = 31000; });
  await page.waitForTimeout(400);
  assert.equal(await hintOf(page, 'guide-idle').count(), 0, '안내가 떠 있는 동안은 길잡이를 띄우지 않는다');
  assert.equal(await hintOf(page, 'move').count(), 1);
  // 걸으면 안내가 사라지고 30초를 다시 센다
  await page.keyboard.press('ArrowRight');
  await hintOf(page, 'move').waitFor({ state: 'detached' });
  await page.waitForTimeout(300);
  assert.equal(await hintOf(page, 'guide-idle').count(), 0);
  await page.evaluate(() => { window.__test.clockSkew += 31000; });
  await hintOf(page, 'guide-idle').waitFor();
  assert.match(await hintOf(page, 'guide-idle').innerText(), /도담 할머니에게 말을 걸어 보자/);
  const map = parseMap(ACT1.chapters[0].map.rows);
  await page.waitForFunction(() => window.__test.guideArrow);
  assert.deepEqual(await page.evaluate(() => window.__test.guideArrow), map.slots.a, '도담 할머니 칸을 가리킨다');
  // 움직이면(방금 뜬 걸음은 잠깐 봐 준다) 사라진다
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await hintOf(page, 'guide-idle').waitFor({ state: 'detached' });
  await page.waitForFunction(() => window.__test.guideArrow === null);
  assert.deepEqual((await state(page)).seenTips.filter((t) => t.startsWith('guide-')), []);
  assert.deepEqual(errors, []);
  await page.close();
});

test('할 일 두루마리와 할 일 창(Q)은 늘 지금 할 일 한 가지를 보여 준다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await open(page);
  assert.equal(await page.locator('.hud-task').innerText(), '도담 할머니에게 말을 걸어 보자');
  await talk(page, 'dodam'); await finishDialogue(page);
  assert.equal(await page.locator('.hud-task').innerText(), '우물에서 물을 길어 오자');
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('.tasks');
  assert.match(await page.locator('.task-goal').innerText(), /지금 할 일\s*우물에서 물을 길어 오자/);
  assert.deepEqual(errors, []);
  await page.close();
});

// 숨은 낱말이 화면에 보이고 부탁이 쉬는 자리(발밑 화살표가 흔들리지 않는 자리)를 만든다.
async function atJar(page) {
  await talk(page, 'dodam'); await finishDialogue(page);
  await talk(page, '우물'); await page.waitForSelector('.toast:not([hidden])');
  await page.evaluate(() => window.__test.teleportTo('장독대'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))));
}

test('숨은 곳 빛무리는 6초마다 1.2초 동안만 다시 그린다(나머지 때는 그대로)', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await open(page);
  await atJar(page);
  await page.waitForTimeout(300);
  const since = await page.evaluate(() => (window.__test.draws ?? []).length);
  await page.waitForTimeout(7500);
  const draws = await page.evaluate((k) => (window.__test.draws ?? []).slice(k), since);
  const halo = draws.filter(([, why]) => /^anim /.test(why));
  assert.ok(halo.length >= 12, `빛무리 그림이 ${halo.length}번뿐: ${JSON.stringify(draws.slice(0, 5))}`);
  for (const [t, why] of draws) {
    assert.match(why, /^anim /, `빛무리 말고는 다시 그리지 않아야 한다: ${t} ${why}`);
    assert.ok(t % 6000 < 1400, `빛무리 때(6초 주기 처음 1.2초)가 아닌데 그렸다: ${t} ${why}`);
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('움직임 줄이기: 빛무리는 퍼지지 않고 밝아졌다 어두워지기만 한다(오류 없이 그려진다)', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await open(page);
  await atJar(page);
  const since = await page.evaluate(() => (window.__test.draws ?? []).length);
  await page.waitForTimeout(6500);
  const draws = await page.evaluate((k) => (window.__test.draws ?? []).slice(k), since);
  assert.ok(draws.filter(([, why]) => /^anim /.test(why)).length >= 12);
  assert.deepEqual(errors, []);
  await ctx.close();
});
