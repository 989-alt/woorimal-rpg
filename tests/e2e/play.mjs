// 화면 검사가 같이 쓰는 플레이 걸음: 게임 열기, 대화 넘기기, 말 걸기·조사, 전투 답하기, 이어하기.
// 검사 파일이 아니다(이름이 .test.mjs가 아니라서 node --test가 돌리지 않는다).
import assert from 'node:assert/strict';
import { collectErrors, finishDialogue, startFromTitle } from './browser.mjs';
import { ACTS } from '../../data/acts/index.js';
import { actWords } from '../../js/rules/game.js';

export const state = (page) => page.evaluate(() => window.__test.state());
export const hudTask = (page) => page.locator('.hud-task').innerText();

// 새 쪽을 열어 `?test=1` 주소로 가고 타자 효과를 끈다. name이 있으면 그 이름으로 새 게임을 시작해 탐험이 뜰 때까지 기다린다.
// 돌려주는 값: { page, errors } (errors는 자바스크립트·콘솔 오류 모음)
export async function openGame(browser, server, { name = '하늘', avatar = 'f', size = { width: 1366, height: 768 }, ...pageOpts } = {}) {
  const page = await browser.newPage({ viewport: size, ...pageOpts });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.fastText(true));
  if (name) {
    await page.evaluate(([n, a]) => window.__test.newGame(n, a), [name, avatar]);
    await page.waitForSelector('[data-scene="explore"]');
  }
  return { page, errors };
}

// 처음 화면이 뜨면 타자 효과를 끈다(새로 고침 뒤에도 다시 부른다).
export async function boot(page) {
  await page.waitForSelector('[data-scene="title"]');
  await page.evaluate(() => window.__test.fastText(true));
}

// 대화를 끝까지 넘긴다(카드는 '확인', 줄은 스페이스·엔터를 번갈아). 확인한 뜻풀이 카드의 낱말 목록을 돌려준다.
export async function playDialogue(page, until = 'explore') {
  await page.waitForSelector('[data-scene="dialogue"]');
  return finishDialogue(page, until);
}

// 대상 옆으로 옮긴 뒤 스페이스로 말 걸기·조사하기
export async function interact(page, target) {
  await page.evaluate((t) => window.__test.teleportTo(t), target);
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('Space');
}

export async function talkThrough(page, target, until = 'explore') {
  await interact(page, target);
  return playDialogue(page, until);
}

export async function toast(page) {
  await page.waitForSelector('.toast:not([hidden])');
  return page.locator('.toast').innerText();
}

export const waitAsk = (page) => page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');

// 전투를 연다(첫 문제가 바로 나온다)
export async function enterBattle(page, target) {
  await interact(page, target);
  await page.waitForSelector('[data-scene="battle"]');
  await waitAsk(page);
}

export async function answerRight(page) {
  const idx = await page.evaluate(() => window.__test.answerIndex());
  assert.ok(idx >= 0);
  const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
  await page.keyboard.press(`Digit${idx + 1}`);
  await page.waitForFunction((n) => {
    const s = document.querySelector('[data-scene="battle"]');
    return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
  }, qn);
}

// 일부러 틀린 보기를 고르고 풀이의 '다음'을 누른다.
export async function answerWrong(page) {
  const idx = await page.evaluate(() => window.__test.answerIndex());
  assert.ok(idx >= 0);
  const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
  await page.keyboard.press(`Digit${((idx + 1) % 4) + 1}`);
  await page.waitForSelector('.battle-feedback .battle-next');
  await page.locator('.battle-next').click();
  await page.waitForFunction((n) => {
    const s = document.querySelector('[data-scene="battle"]');
    return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
  }, qn);
}

// 처음 화면에서 그 이름으로 이어하기를 눌러 탐험이 뜰 때까지 간다.
export async function continueAs(page, name) {
  await boot(page);
  await startFromTitle(page, { name, mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
}

// 5-2에서 보스를 이기고 마지막 장면까지 본 상태(낱말 50개, 부탁 끝, 5막 마침)로 세운다. 출구로 걷기만 남는다.
export async function atEndingExit(page) {
  const ids = actWords(ACTS[4]);
  await page.evaluate(() => window.__test.goChapter('5-2'));
  await page.evaluate((words) => window.__test.patchState((s) => ({
    clearedActs: [1, 2, 3, 4, 5],
    seenScenes: [...(s.seenScenes ?? []), '5-2:afterBoss'],
    acquired: { ...s.acquired, ...Object.fromEntries(words.map((w) => [w, { from: '검사' }])) },
    quests: { ...s.quests, q19: { stage: 'done', gathered: [] }, q20: { stage: 'done', gathered: [] } },
  })), ids);
  await page.waitForSelector('[data-scene="explore"] canvas');
}
