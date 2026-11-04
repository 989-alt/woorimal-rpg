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
// 정해진 시간 대신 화면 상태를 기다린다: 글이 다 보임(화살표·카드), 넘어갈 준비(data-ready), 줄이 바뀜.
const READY = '[data-scene="dialogue"][data-ready]';
const reveal = async (page) => {
  await page.keyboard.press('Space');
  await page.waitForSelector('.dialogue-arrow:not([hidden]), .word-card');
};
const advance = async (page) => {
  await page.waitForSelector(READY);
  await page.keyboard.press('Space');
  await page.waitForFunction((r) => !document.querySelector(r), READY);
};
// 카드가 뜰 때까지 줄을 넘긴다(카드는 누르지 않는다)
const untilCard = async (page) => {
  for (let i = 0; i < 40; i++) {
    await page.waitForSelector(`.word-card, ${READY}`);
    if (await page.locator('.word-card').count()) return;
    await advance(page);
  }
  throw new Error('카드가 뜨지 않았다');
};

test('끝난 부탁 대사: 대화를 열 때 이미 낱말을 얻어 저장했고, 낱말 카드가 한 번씩 뜬다', async () => {
  const { page, errors } = await openNewGame();
  await page.evaluate(([s]) => window.__test.dialogue(s, ['어스름', '아침나절'], '도담 할머니'), [doneScript]);
  await page.waitForSelector('[data-scene="dialogue"]');
  // 대화를 열기 전에 낱말을 얻고 저장한다(대화 도중 창을 닫아도 잃지 않는다).
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.deepEqual(saved.acquired['어스름'], { from: '도담 할머니' });
  assert.deepEqual(saved.acquired['아침나절'], { from: '도담 할머니' });
  // 줄 1(주인공), 줄 2(할머니): 이름표와 말하는 쪽
  assert.equal(await page.locator('.name-tag').innerText(), '하늘');
  await reveal(page); // 문장 다 보이기
  await advance(page); // 다음 줄
  assert.equal(await page.locator('.name-tag').innerText(), '도담 할머니');
  await reveal(page);
  await advance(page); // 카드가 있는 줄로
  assert.equal(await page.locator('.name-tag').innerText(), '도담 할머니');
  // '새벽 [[어스름]]' 줄이 다 보이면 카드
  await reveal(page);
  await page.waitForSelector('.word-card');
  const card = await page.locator('.word-card').innerText();
  assert.match(card, /새 낱말을 찾았다!/);
  assert.match(card, /어스름/);
  assert.match(card, /해 뜨기 전이나 해 진 뒤의 조금 어둑한 때/);
  // 처음 보는 낱말: 안내
  let s = await page.evaluate(() => window.__test.state());
  assert.ok(s.seenTips.includes('tip-word'));
  // 카드가 열린 동안 상자 누름은 무시
  await page.locator('.dialogue-box').click({ force: true });
  assert.equal(await page.locator('.word-card').count(), 1);
  // 연타: 카드가 열린 직후의 키 누름은 카드를 닫지 못한다
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.word-card').count(), 1, '연타로 카드가 닫히면 안 된다');
  await page.waitForTimeout(350); // 카드의 키보드 확인 기다림(300ms) 자체를 검사한다
  await page.keyboard.press('Enter'); // 확인
  await page.waitForSelector('.word-card', { state: 'detached' });
  // 얻은 뒤에는 '새 낱말' 표시가 사라져, 그 낱말을 눌러도 상자 누름(넘어가기)을 막지 않는다
  assert.equal(await page.locator('.hl.new').count(), 0);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.ok(saved.seenTips.includes('tip-word'), '카드를 확인하면 안내 본 표시도 저장');
  // 다음 카드(아침나절)도 이 대화에서 한 번 뜬다
  await untilCard(page);
  assert.match(await page.locator('.word-card-word').innerText(), /아침나절/);
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
  await untilCard(page);
  if (process.env.DIALOGUE_SHOT) await page.screenshot({ path: process.env.DIALOGUE_SHOT });
  await page.close();
});

test('대화: 줄이 다 보이고 기다림이 끝나면 화면 고리(requestAnimationFrame)가 멈추고, 다음 줄에서 다시 돈다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript(() => {
    window.__rafs = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { window.__rafs++; return orig(cb); };
  });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.dialogue([
    { who: 'narration', text: '첫 줄이다.' }, { who: 'narration', text: '둘째 줄이다.' }]));
  await page.waitForSelector(READY); // 200ms 기다림까지 끝났다
  const n = await page.evaluate(() => window.__rafs);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__rafs), n, '다 보인 줄에서 고리가 돌고 있다');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('.dialogue-text')?.textContent.includes('둘째'));
  await page.waitForSelector('.dialogue-arrow:not([hidden])');
  assert.ok(await page.evaluate(() => window.__rafs) > n, '다음 줄에서 다시 돌지 않았다');
  assert.equal(await page.locator('.dialogue-text').innerText(), '둘째 줄이다.');
  assert.deepEqual(errors, []);
  await page.close();
});
