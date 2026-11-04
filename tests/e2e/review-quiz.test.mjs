// 마무리 퀴즈 화면 검사(Task 11c): 엔딩(말빛 주머니) → 퀴즈 10문제 → 결과 → 만든 이,
// 처음 화면의 "마무리 퀴즈"(엔딩을 본 저장이 있을 때만) → 다시 풀기 → 계속 → 처음 화면, 터치에서 쓰기 칸.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, finishDialogue } from './browser.mjs';
import { openGame, atEndingExit, answerQuiz, boot } from './play.mjs';
import { walkToExit } from './helpers.mjs';
import { WORDS } from '../../data/words.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const meaningOf = (id) => WORDS.find((w) => w.id === id).meaning;
const wordText = (id) => WORDS.find((w) => w.id === id).word;

test('엔딩: 말빛 주머니 → 마무리 퀴즈 10문제(뜻 4 · 초성 3 · 상황 빈칸 3) → 결과 → 계속 → 만든 이', async () => {
  const { page, errors } = await openGame(browser, server);
  await atEndingExit(page);
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '엔딩 보기' }).click();
  await finishDialogue(page, 'ending');
  await page.getByRole('button', { name: '다음' }).click();
  await page.waitForSelector('[data-part="pouch"]');
  await page.getByRole('button', { name: '마무리 퀴즈' }).click();

  // 첫 문제: 머리와 유형 표, 초점
  await page.waitForSelector('[data-scene="review-quiz"][data-phase="ask"][data-qn="0"]');
  const scene = page.locator('[data-scene="review-quiz"]');
  assert.equal(await scene.evaluate((e) => e.classList.contains('end-scene')), true);
  assert.equal(await page.locator('.quiz-count').innerText(), '1 / 10');
  assert.equal(await page.locator('.quiz-step').count(), 10);
  assert.equal(await page.locator('.hearts, .heart').count(), 0, '하트가 없다');
  const first = await page.evaluate(() => window.__test.quiz());
  const label = { meaning: '뜻 고르기', chosung: '초성 퀴즈', situation: '알맞은 낱말 넣기' }[first.type];
  assert.equal(await page.locator('.quiz-type').innerText(), label);
  if (first.type === 'chosung') {
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'quiz-input');
  } else {
    assert.match(await page.evaluate(() => document.activeElement?.className), /battle-option/);
  }

  // 둘째·다섯째 문제는 일부러 틀린다. 답할 때마다 맞음/틀림과 뜻이 보인다.
  const wrong = [1, 4];
  const asked = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector(`[data-scene="review-quiz"][data-phase="ask"][data-qn="${i}"]`);
    const q = await page.evaluate(() => window.__test.quiz());
    const miss = wrong.includes(i);
    if (q.type === 'chosung') {
      assert.equal(await page.locator('.quiz-tile').count(), [...wordText(q.word)].length, '초성 칸 수 = 글자 수');
      assert.match(await page.locator('.quiz-clue').innerText(), new RegExp(meaningOf(q.word).replace(/[()]/g, '.')));
      // 띄어 써도 맞는다
      await page.locator('.quiz-input').fill(miss ? '모르겠다' : [...q.answerText].join(' '));
      await page.keyboard.press('Enter');
    } else {
      if (q.type === 'situation') assert.equal(await page.locator('.quiz-prompt .battle-blank').count(), 1, '빈칸이 있다');
      if (q.type === 'meaning') assert.equal(await page.locator('.quiz-prompt .battle-hl').innerText(), wordText(q.word));
      assert.equal(await page.locator('.battle-option').count(), 4);
      await page.keyboard.press(`Digit${(miss ? (q.answerIndex + 1) % 4 : q.answerIndex) + 1}`);
    }
    await page.waitForSelector('[data-phase="feedback"] .quiz-next');
    const fb = await page.locator('.quiz-feedback').innerText();
    assert.match(fb, miss ? /아쉬워요! 정답은/ : /맞았어요!/);
    assert.ok(fb.includes(meaningOf(q.word)), `뜻이 보인다: ${fb}`);
    if (q.type === 'situation') assert.ok((await page.locator('.quiz-prompt .battle-blank.filled').innerText()).length > 0, '빈칸이 채워진다');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), i === 9 ? '결과 보기' : '다음');
    asked.push(q);
    await page.keyboard.press('Enter');
  }
  const count = (t) => asked.filter((q) => q.type === t).length;
  assert.deepEqual([count('meaning'), count('chosung'), count('situation')], [4, 3, 3]);
  assert.equal(new Set(asked.map((q) => q.word)).size, 10);

  // 결과
  await page.waitForSelector('[data-scene="review-quiz"][data-phase="result"]');
  assert.equal(await page.locator('.quiz-score').innerText(), '10문제 중 8개 맞힘');
  assert.equal(await page.locator('.quiz-result').count(), 10);
  assert.equal(await page.locator('.quiz-result.wrong').count(), 2);
  assert.deepEqual(
    await page.locator('.quiz-result.wrong .quiz-result-meaning').allInnerTexts(),
    wrong.map((i) => meaningOf(asked[i].word)),
    '틀린 낱말만 뜻을 보인다',
  );
  assert.equal(await page.locator('.quiz-result.right .quiz-result-meaning').count(), 0);
  assert.deepEqual(await page.locator('.quiz-result-word').allInnerTexts(), asked.map((q) => wordText(q.word)));
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '계속');
  await page.getByRole('button', { name: '계속' }).click();
  await page.waitForSelector('[data-scene="ending"][data-part="credits"]');
  assert.deepEqual(errors, []);
  await page.close();
});

test('처음 화면: 엔딩을 본 저장이 있을 때만 "마무리 퀴즈" → 다시 풀기(새 10문제) → 계속 → 처음 화면', async () => {
  const { page, errors } = await openGame(browser, server);
  await page.reload();
  await boot(page);
  assert.equal(await page.getByRole('button', { name: '마무리 퀴즈' }).count(), 0, '엔딩을 본 저장이 없으면 단추가 없다');
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.evaluate(() => window.__test.patchState({ clearedActs: [1, 2, 3, 4, 5] }));
  await page.waitForSelector('[data-scene="explore"]');
  await page.reload();
  await boot(page);
  const quizBtn = page.locator('.title-menu').getByRole('button', { name: '마무리 퀴즈' });
  await quizBtn.waitFor();
  // 방향키로도 닿는다
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '마무리 퀴즈');
  await page.keyboard.press('Enter');

  const firstRound = await answerQuiz(page, { wrong: [0] });
  assert.equal(await page.locator('.quiz-score').innerText(), '10문제 중 9개 맞힘');
  await page.getByRole('button', { name: '다시 풀기' }).click();
  await page.waitForSelector('[data-scene="review-quiz"][data-phase="ask"][data-qn="0"]');
  assert.equal(await page.locator('.quiz-step.right, .quiz-step.wrong').count(), 0, '새로 시작');
  const secondRound = await answerQuiz(page);
  assert.notDeepEqual(secondRound.map((q) => q.word), firstRound.map((q) => q.word), '새 10문제');
  assert.equal(await page.locator('.quiz-score').innerText(), '10문제 중 10개 맞힘');
  await page.getByRole('button', { name: '계속' }).click();
  await page.waitForSelector('[data-scene="title"]');
  assert.deepEqual(errors, []);
  await page.close();
});

test('터치: 초성 문제는 화면 입력란과 "확인" 단추로 답하고, 빈 답은 기회를 쓰지 않는다', async () => {
  const { page, errors } = await openGame(browser, server, { hasTouch: true, isMobile: true, size: { width: 1024, height: 768 } });
  await page.evaluate(() => window.__test.patchState({ clearedActs: [1, 2, 3, 4, 5] }));
  await page.waitForSelector('[data-scene="explore"]');
  await page.reload();
  await boot(page);
  await page.locator('.title-menu').getByRole('button', { name: '마무리 퀴즈' }).tap();
  // 초성 문제가 나올 때까지 맞히며 넘긴다
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector(`[data-scene="review-quiz"][data-phase="ask"][data-qn="${i}"]`);
    const q = await page.evaluate(() => window.__test.quiz());
    if (q.type === 'chosung') {
      const input = page.locator('.quiz-input');
      assert.equal(await input.isVisible(), true);
      const box = await input.boundingBox();
      assert.ok(box.height >= 48, `입력란 높이 ${box.height}`);
      await page.locator('.quiz-submit').tap(); // 빈 답
      assert.equal(await page.locator('[data-phase="ask"]').count(), 1, '빈 답은 넘어가지 않는다');
      await input.tap();
      await input.fill(q.answerText);
      await page.locator('.quiz-submit').tap();
      await page.waitForSelector('[data-phase="feedback"] .quiz-write.right');
      break;
    }
    await page.locator('.battle-option').nth(q.answerIndex).tap();
    await page.locator('.quiz-next').tap();
  }
  assert.deepEqual(errors, []);
  await page.close();
});
