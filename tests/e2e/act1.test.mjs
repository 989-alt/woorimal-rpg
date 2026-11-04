// 1막 끝까지 화면 검사: 시작 화면에서 닉네임을 키보드로 적고, 걷기만 teleportTo로 줄이고
// 나머지는 스페이스·엔터·누르기로 1막 클리어까지 간다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, startFromTitle } from './browser.mjs';
import { pathTo, KEYS } from './helpers.mjs';
import { parseMap } from '../../js/explore/grid.js';
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

const state = (page) => page.evaluate(() => window.__test.state());
const hudCount = (page) => page.locator('.hud-count').innerText();
const hudTask = (page) => page.locator('.hud-task').innerText();

// 화면이 그리는 것과 같은 규칙 함수로 인물 표시를 읽는다.
const marker = (page, npcId) => page.evaluate(async (id) => {
  const { npcMarker } = await import('/js/rules/quests.js');
  const { actOfChapter } = await import('/data/acts/index.js');
  const s = window.__test.state();
  const chapter = actOfChapter(s.chapter).chapters.find((c) => c.id === s.chapter);
  return npcMarker(s, chapter, id);
}, npcId);

// 처음 화면이 뜨면 타자 효과를 끈다(새로 고침 뒤에도 다시 부른다).
async function boot(page) {
  await page.waitForSelector('[data-scene="title"]');
  await page.evaluate(() => window.__test.fastText(true));
}

// 대화를 끝까지 넘긴다(카드는 '확인', 줄은 스페이스·엔터를 번갈아). 확인한 뜻풀이 카드의 낱말 목록을 돌려준다.
async function playDialogue(page, until = 'explore') {
  await page.waitForSelector('[data-scene="dialogue"]');
  return finishDialogue(page, until);
}

// 대상 옆으로 옮긴 뒤 스페이스로 말 걸기·조사하기
async function interact(page, target) {
  await page.evaluate((t) => window.__test.teleportTo(t), target);
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('Space');
}

async function talkThrough(page, target, until = 'explore') {
  await interact(page, target);
  return playDialogue(page, until);
}

async function toast(page) {
  await page.waitForSelector('.toast:not([hidden])');
  return page.locator('.toast').innerText();
}

const waitAsk = (page) => page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');

// 전투를 연다(첫 문제가 바로 나온다)
async function enterBattle(page, target) {
  await interact(page, target);
  await page.waitForSelector('[data-scene="battle"]');
  await waitAsk(page);
}

async function answerRight(page) {
  const idx = await page.evaluate(() => window.__test.answerIndex());
  assert.ok(idx >= 0);
  const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
  await page.keyboard.press(`Digit${idx + 1}`);
  await page.waitForFunction((n) => {
    const s = document.querySelector('[data-scene="battle"]');
    return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
  }, qn);
}

async function continueAs(page, name) {
  await boot(page);
  await startFromTitle(page, { name, mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
}

test('일반 주소에서는 검사용 도움 기능이 없다', async () => {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.goto(server.url + '/');
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await page.evaluate(() => typeof window.__test), 'undefined');
  assert.deepEqual(errors, []);
  await page.close();
});

test('teleportTo: 맞닿은 칸에서 대상을 보고, 이 장에 없거나 갈 수 없는 대상은 오류', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await boot(page);
  await page.evaluate(() => window.__test.newGame('바다', 'm'));
  await page.waitForSelector('[data-scene="explore"]');
  const map = parseMap(ACT1.chapters[0].map.rows);
  await page.evaluate(() => window.__test.teleportTo('우물'));
  let s = await state(page);
  assert.deepEqual(s.pos, { x: map.objects['0'].x, y: map.objects['0'].y + 1 });
  assert.equal(s.facing, 'up');
  const missing = await page.evaluate(() => { try { window.__test.teleportTo('빨랫줄'); return null; } catch (e) { return e.message; } });
  assert.match(missing, /빨랫줄/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('1막 끝까지: 시작 화면 → 부탁 4개 → 숨은 낱말 2개 → 안개 문 → 보스(중간 새로 고침) → 1막 클리어', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await boot(page);

  // ── 시작 화면: 키보드로 이름 적기 → 여 → 처음부터 ──
  await startFromTitle(page, { name: '하늘', avatar: 'f' });
  await playDialogue(page); // 인트로
  let s = await state(page);
  assert.equal(s.nickname, '하늘');
  assert.equal(s.avatar, 'f');
  assert.equal(s.chapter, '1-1');
  assert.match(await hudCount(page), /0\/5/);

  // ── q1: 도담 할머니 → 우물 → 할머니 ──
  assert.equal(await marker(page, 'dodam'), '!');
  assert.match(await hudTask(page), /우물에서 물 길어 오기/);
  await talkThrough(page, 'dodam');
  assert.equal(await marker(page, 'dodam'), '…');
  await interact(page, '우물');
  assert.equal(await toast(page), '물동이를 가방에 넣었다.');
  assert.equal(await marker(page, 'dodam'), '?');
  assert.deepEqual((await state(page)).bag, ['water']);
  const q1Cards = await talkThrough(page, 'dodam');
  assert.deepEqual(q1Cards, ['어스름', '아침나절']);
  assert.match(await hudCount(page), /2\/5/);
  s = await state(page);
  assert.deepEqual(s.bag, []);
  assert.equal(s.quests.q1.stage, 'done');
  assert.equal(await marker(page, 'dodam'), null);
  assert.equal(await marker(page, 'daon'), '!');

  // ── 새로 고침 → "하늘" → 이어하기: 낱말 2/5, 같은 자리, 다온 '!' ──
  const before = { pos: s.pos, facing: s.facing };
  await page.reload();
  await continueAs(page, '하늘');
  s = await state(page);
  assert.deepEqual(s.pos, before.pos);
  assert.match(await hudCount(page), /2\/5/);
  assert.equal(await marker(page, 'daon'), '!');

  // ── q2: 다온 → 꼬마 안개 복습전 → 다온 ──
  await talkThrough(page, 'daon');
  assert.equal(await marker(page, 'daon'), '…');
  await enterBattle(page, 'small');
  for (let i = 0; i < 3; i++) await answerRight(page);
  await page.waitForSelector('[data-scene="explore"]');
  assert.equal(await marker(page, 'daon'), '?');
  assert.deepEqual(await talkThrough(page, 'daon'), ['매무새', '손사래']);
  assert.match(await hudCount(page), /4\/5/);
  assert.match(await hudTask(page), /숨은 낱말을 찾아라/);

  // ── 숨은 낱말: 장독대 → 1장 클리어 → 2장 ──
  assert.deepEqual(await talkThrough(page, '장독대', 'clear'), ['오롯이']);
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /1장 클리어!/);
  await page.getByRole('button', { name: '다음 장으로' }).click();
  await playDialogue(page); // 2장 인트로
  s = await state(page);
  assert.equal(s.chapter, '1-2');
  assert.match(await hudCount(page), /0\/5/);

  // ── q3: 빵집 → 마른 나무 3그루 → 빵집 ──
  assert.equal(await marker(page, 'baker'), '!');
  await talkThrough(page, 'baker');
  assert.equal(await marker(page, 'baker'), '…');
  await interact(page, '빵집 옆 마른 나무');
  assert.equal(await toast(page), '장작을 모았다. (1/3)');
  await interact(page, '냇가 마른 나무');
  assert.equal(await toast(page), '장작을 모았다. (2/3)');
  await interact(page, '아랫마을 마른 나무');
  assert.equal(await toast(page), '장작을 다 모아서 가방에 넣었다.');
  assert.equal(await marker(page, 'baker'), '?');
  assert.deepEqual(await talkThrough(page, 'baker'), ['부리나케', '짬']);
  assert.match(await hudCount(page), /2\/5/);

  // ── q4: 빨래터 → 어귀 할아버지 ──
  assert.equal(await marker(page, 'laundry'), '!');
  await talkThrough(page, 'laundry');
  assert.equal(await marker(page, 'laundry'), '…');
  assert.equal(await marker(page, 'gate'), '?');
  assert.deepEqual((await state(page)).bag, ['letter']);
  assert.deepEqual(await talkThrough(page, 'gate'), ['곰비임비', '얼추']);
  assert.match(await hudCount(page), /4\/5/);

  // ── 안개 문: 낱말 4개일 때는 막혀 있다 ──
  const map2 = parseMap(ACT1.chapters[1].map.rows);
  const fog = map2.fog[0];
  s = await state(page);
  for (const dir of pathTo(map2, s.pos, { x: fog.x, y: fog.y + 1 }, {})) await page.keyboard.press(KEYS[dir]);
  await page.keyboard.press('ArrowUp');
  s = await state(page);
  assert.deepEqual(s.pos, { x: fog.x, y: fog.y + 1 });
  await page.keyboard.press('Space');
  assert.equal(await toast(page), '아직 찾지 못한 낱말이 1개 있어.');
  const blocked = await page.evaluate(() => { try { window.__test.teleportTo('boss'); return null; } catch (e) { return e.message; } });
  assert.ok(blocked, '안개가 막고 있으면 보스 옆으로 옮길 수 없다');

  // ── 숨은 낱말: 빨랫줄 → 5/5, 할 일 "그림자를 물리쳐라" ──
  assert.deepEqual(await talkThrough(page, '빨랫줄'), ['해거름']);
  assert.match(await hudCount(page), /5\/5/);
  assert.equal(await hudTask(page), '그림자를 물리쳐라');

  // ── 보스전: 2문제 푼 뒤 새로 고침 → 이어하기 → 탐험, 출제 기록 없음 ──
  await enterBattle(page, 'boss');
  await answerRight(page);
  await answerRight(page);
  assert.equal((await page.evaluate(() => window.__test.battle())).hp, 4);
  const beforeBoss = (await state(page)).pos;
  await page.reload();
  await continueAs(page, '하늘');
  s = await state(page);
  assert.deepEqual(s.askedWordIds, []);
  assert.deepEqual(s.clearedActs, []);
  assert.deepEqual(s.pos, beforeBoss);
  assert.equal(s.chapter, '1-2');

  // ── 다시 보스: 하트 5, HP 6에서 처음부터 → 정답 6번 → 1막 클리어 ──
  await enterBattle(page, 'boss');
  const fresh = await page.evaluate(() => window.__test.battle());
  assert.equal(fresh.hearts, 5);
  assert.equal(fresh.hp, 6);
  assert.equal(fresh.correct + fresh.wrong, 0);
  assert.equal(await page.locator('.heart.full').count(), 5);
  assert.equal(await page.locator('.hp-cell').count(), 6);
  assert.equal(await page.locator('.hp-cell.lost').count(), 0);
  for (let i = 0; i < 6; i++) await answerRight(page);
  await page.waitForSelector('[data-scene="clear"]');
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /1막 클리어!/);
  assert.equal(await page.locator('.clear-card').count(), 10);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.deepEqual(saved.clearedActs, [1]);
  assert.equal(saved.askedWordIds.length, 10);
  assert.equal(Object.keys(saved.acquired).length, 10);

  // ── 막을 마친 뒤: 처음 화면 → 이어하기 → 할 일 "1막을 마쳤어요", 보스는 막는다 ──
  await page.getByRole('button', { name: '처음 화면으로' }).click();
  await page.waitForSelector('[data-scene="title"]');
  await startFromTitle(page, { name: '하늘', mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
  assert.equal(await hudTask(page), '1막을 마쳤어요');
  await interact(page, 'boss');
  assert.equal(await toast(page), '1막을 마쳤어요. 다음 막은 준비 중이에요.');
  assert.equal(await page.locator('[data-scene="battle"]').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});
