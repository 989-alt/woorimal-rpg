import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue } from './browser.mjs';
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

async function openNewGame() {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"]');
  return { page, errors };
}

const doneScript = ACT1.chapters[0].quests[0].done;
const press = async (page) => { await page.keyboard.press('Space'); await page.waitForTimeout(260); };

test('끝난 부탁 대사: 낱말 카드가 뜨고 확인하면 낱말을 얻고 저장된다', async () => {
  const { page, errors } = await openNewGame();
  await page.evaluate(([s]) => window.__test.dialogue(s, ['어스름', '아침나절'], '도담 할머니'), [doneScript]);
  await page.waitForSelector('[data-scene="dialogue"]');
  // 줄 1(주인공), 줄 2(할머니): 이름표와 말하는 쪽
  assert.equal(await page.locator('.name-tag').innerText(), '하늘');
  await press(page); // 문장 다 보이기
  await press(page); // 다음 줄
  assert.equal(await page.locator('.name-tag').innerText(), '도담 할머니');
  await press(page);
  await press(page); // 카드가 있는 줄로
  assert.equal(await page.locator('.name-tag').innerText(), '도담 할머니');
  // '새벽 [[어스름]]' 줄이 다 보이면 카드
  await page.keyboard.press('Space');
  await page.waitForSelector('.word-card');
  const card = await page.locator('.word-card').innerText();
  assert.match(card, /새 낱말을 찾았다!/);
  assert.match(card, /어스름/);
  assert.match(card, /해 뜨기 전이나 해 진 뒤의 조금 어둑한 때/);
  // 처음 보는 낱말: 안내
  let s = await page.evaluate(() => window.__test.state());
  assert.ok(s.seenTips.includes('tip-word'));
  assert.equal('어스름' in s.acquired, false, '확인 전에는 얻지 않는다');
  // 카드가 열린 동안 상자 누름은 무시
  await page.locator('.dialogue-box').click({ force: true });
  assert.equal(await page.locator('.word-card').count(), 1);
  // 연타: 카드가 열린 직후의 키 누름은 카드를 닫지 못한다
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.word-card').count(), 1, '연타로 카드가 닫히면 안 된다');
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter'); // 확인
  await page.waitForSelector('.word-card', { state: 'detached' });
  // 얻은 뒤에는 '새 낱말' 표시가 사라져, 그 낱말을 눌러도 상자 누름(넘어가기)을 막지 않는다
  assert.equal(await page.locator('.hl.new').count(), 0);
  s = await page.evaluate(() => window.__test.state());
  assert.deepEqual(s.acquired['어스름'], { from: '도담 할머니' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.ok('어스름' in saved.acquired, '낱말을 얻는 즉시 저장');
  await finishDialogue(page);
  s = await page.evaluate(() => window.__test.state());
  assert.ok('아침나절' in s.acquired);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.word-card')].length), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('이미 얻은 낱말은 카드 없이 띠만, params.words에 없는 [[ ]]도 띠만', async () => {
  const { page, errors } = await openNewGame();
  await page.evaluate(() => window.__test.acquire(['어스름'], '도담 할머니'));
  await page.waitForSelector('[data-scene="explore"]');
  const script = [{ who: 'npc', npc: 'dodam', text: '새벽 [[어스름]]에 [[짬]]을 냈다.' }];
  await page.evaluate((sc) => window.__test.dialogue(sc, ['어스름'], '도담 할머니'), script);
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.waitForSelector('.dialogue-arrow:not([hidden])');
  assert.equal(await page.locator('.hl').count(), 2);
  assert.equal(await page.locator('.word-card').count(), 0);
  await finishDialogue(page);
  const s = await page.evaluate(() => window.__test.state());
  assert.equal('짬' in s.acquired, false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('낱말을 누르면 문장이 다 보이기 전에도 카드가 뜨고, 한 줄에 새 낱말 둘이면 카드가 차례로 뜬다', async () => {
  const { page, errors } = await openNewGame();
  const script = [{ who: 'narration', text: '[[짬]]이 나서 [[얼추]] 끝냈다. 그리고 한참 더 긴 글이 이어진다, 아주 길게 길게 이어진다.' }];
  await page.evaluate((sc) => window.__test.dialogue(sc, ['짬', '얼추'], '우물'), script);
  await page.waitForSelector('.hl');
  assert.equal(await page.locator('.word-tip').innerText(), '반짝이는 낱말을 눌러 보세요');
  await page.locator('.hl').first().click();
  await page.waitForSelector('.word-card');
  assert.match(await page.locator('.word-card-word').innerText(), /짬/);
  await page.locator('.word-card button').click();
  await page.waitForFunction(() => document.querySelector('.word-card-word')?.textContent === '얼추');
  await page.locator('.word-card button').click();
  await page.waitForSelector('.word-card', { state: 'detached' });
  const s = await page.evaluate(() => window.__test.state());
  assert.deepEqual(Object.keys(s.acquired).sort(), ['얼추', '짬']);
  assert.equal(await page.locator('.word-tip').count(), 0);
  await finishDialogue(page);
  assert.deepEqual(errors, []);
  await page.close();
});

test('낱말 카드를 연 채 스크린샷', async () => {
  const { page } = await openNewGame();
  const script = [
    { who: 'hero', face: 'joy', text: '할머니, 우물에서 물 길어 왔어요!' },
    { who: 'npc', npc: 'dodam', face: 'base', text: '나는 날마다 새벽 [[어스름]]에 물을 긷는단다.' },
  ];
  await page.evaluate((sc) => window.__test.dialogue(sc, ['어스름'], '도담 할머니'), script);
  await page.waitForSelector('[data-scene="dialogue"]');
  await press(page); await press(page);
  await page.waitForSelector('.word-card');
  if (process.env.DIALOGUE_SHOT) await page.screenshot({ path: process.env.DIALOGUE_SHOT });
  await page.close();
});
