// 엔딩 화면 검사: 5-2 출구 → 막 클리어 "엔딩 보기" → 장면 대화 8개(되찾은 마을들 포함) → 마지막 말 → 말빛 주머니 50장 → 마무리 퀴즈 → 만든 이 → 처음 화면.
// 엔딩 뒤 이어하기(Review Focus 4)와 여섯 글자 닉네임 1024×768(Review Focus 5)도 본다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, dialogueStep } from './browser.mjs';
import { openGame, state, continueAs, atEndingExit, answerQuiz } from './play.mjs';
import { walkToExit, KEYS } from './helpers.mjs';
import { ACTS } from '../../data/acts/index.js';
import ENDING from '../../data/ending.js';
import { endingBg } from '../../data/assets.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const FIXTURE = '/tests/fixtures/sprite-16x32.png';

// 엔딩 장면 대화를 끝까지 넘기며 줄마다 글·이름표·한 장 그림 여부·보이는 상반신 수를 모은다.
async function playEndingScenes(page, { beforeLast } = {}) {
  const seen = [];
  const total = ENDING.scenes.reduce((n, s) => n + s.lines.length, 0);
  for (let i = 0; i < 200; i++) {
    await page.waitForSelector('[data-scene="ending"], [data-scene="dialogue"][data-ready]');
    if (await page.locator('[data-scene="ending"]').count()) break;
    seen.push(await page.evaluate(() => {
      const s = document.querySelector('.dialogue-scene');
      const tag = s.querySelector('.name-tag');
      return {
        text: s.querySelector('.dialogue-text').textContent,
        tag: tag.hidden ? '' : tag.textContent,
        still: s.classList.contains('still'),
        warm: s.classList.contains('warm'),
        busts: [...s.querySelectorAll('.bust')].filter((b) => b.checkVisibility()).length,
        bg: s.querySelector('img.dialogue-bg')?.getAttribute('src') ?? null,
      };
    }));
    if (seen.length === total && beforeLast) await beforeLast();
    await dialogueStep(page, 'ending', i % 2 ? 'Enter' : 'Space');
  }
  return seen;
}

const exitIsOpen = (page) => page.evaluate(async () => {
  const { exitOpen } = await import('/js/rules/game.js');
  const { actOfChapter } = await import('/data/acts/index.js');
  const st = window.__test.state();
  return exitOpen(st, actOfChapter(st.chapter).chapters.find((c) => c.id === st.chapter));
});

// 지금 장 지도에 서 있는 인물 id(보이는 인물 규칙 그대로)
const visibleNpcIds = (page) => page.evaluate(async () => {
  const { visibleNpcs } = await import('/js/rules/quests.js');
  const { actOfChapter } = await import('/data/acts/index.js');
  const st = window.__test.state();
  return visibleNpcs(st, actOfChapter(st.chapter).chapters.find((c) => c.id === st.chapter)).map((n) => n.id);
});

test('5-2 출구 → 엔딩 보기 → 장면 8개 → 마지막 말 → 말빛 주머니 50장 → 마무리 퀴즈 → 만든 이 → 처음 화면, 그 뒤 이어하기', async () => {
  const { page, errors } = await openGame(browser, server);
  // 엔딩 그림은 5-2에서 미리 받는다(그림 칸에 경로를 넣어 두고 요청이 가는지 본다)
  const requested = [];
  page.on('request', (r) => { if (r.url().includes('sprite-16x32.png?ending01')) requested.push(r.url()); });
  await page.evaluate(async (url) => {
    const { ASSETS } = await import('/data/assets.js');
    ASSETS.ending.ending01 = url;
  }, `${FIXTURE}?ending01`);
  await atEndingExit(page);
  await page.waitForTimeout(200);
  assert.equal(requested.length, 1, '5-2에서 엔딩 그림을 미리 받는다');

  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /5막 클리어!/);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), '엔딩 보기');
  await page.getByRole('button', { name: '엔딩 보기' }).click();

  const seen = await playEndingScenes(page, {
    // 마지막 줄에서 타자 효과를 되돌려, 마지막 말 화면의 "다음"이 2초 뒤에 나타나는지 본다
    beforeLast: () => page.evaluate(() => window.__test.fastText(false)),
  });
  const counts = ENDING.scenes.map((s) => s.lines.length);
  assert.equal(seen.length, counts.reduce((a, b) => a + b, 0), '모든 줄이 나왔다');
  const sceneOf = (i) => { let k = 0; for (let n = i; n >= counts[k]; k++) n -= counts[k]; return k; };
  assert.equal(seen[0].text, '하늘은 해솔, 나래와 함께 새벽골로 돌아왔다.');
  assert.ok(seen[0].bg?.endsWith(`${FIXTURE}?ending01`), `장면 1은 ending01 그림 (${seen[0].bg})`);
  // 되찾은 마을들(장면 2~5): 그 막 주민 이름표, 잿빛 탑 장면은 따뜻한 빛깔
  const tagsOf = (k) => seen.filter((_, i) => sceneOf(i) === k).map((l) => l.tag);
  assert.ok(tagsOf(1).includes('사과 장수 아저씨'), tagsOf(1).join(','));
  assert.ok(tagsOf(2).includes('나룻배 사공'), tagsOf(2).join(','));
  assert.ok(tagsOf(3).includes('찻집 아주머니'), tagsOf(3).join(','));
  assert.ok(tagsOf(4).includes('잿빛 아이'), tagsOf(4).join(','));
  assert.equal(seen[0].text, ENDING.scenes[0].lines[0].text.replace('{이름|은}', '하늘은'));
  for (const [i, l] of seen.entries()) assert.equal(l.warm, sceneOf(i) === 4, `${i}째 줄 warm`);
  const grandma = ENDING.scenes.findIndex((sc) => sc.bg === 'ending02'); // 할머니와 나래
  const tags2 = tagsOf(grandma);
  assert.ok(tags2.includes('도담 할머니'), tags2.join(','));
  assert.ok(tags2.includes('나래'), tags2.join(','));
  for (const [i, l] of seen.entries()) {
    const still = sceneOf(i) === ENDING.scenes.length - 1;
    assert.equal(l.still, still, `${i}째 줄 still`);
    if (still) assert.equal(l.busts, 0, `${i}째 줄: 한 장 그림에는 상반신이 없다`);
    if (sceneOf(i) !== 0) {
      // 그림이 있으면 그 그림, 없으면 임시 바탕(null). 그림은 막마다 차례로 들어온다.
      const want = endingBg(ENDING.scenes[sceneOf(i)].bg);
      if (want) assert.ok(l.bg?.endsWith(want), `${i}째 줄 바탕: ${l.bg} ≠ ${want}`);
      else assert.equal(l.bg, null, `${i}째 줄: 그림이 없으면 임시 바탕`);
    }
  }
  assert.ok(seen.some((l) => !l.still && l.busts > 0), '다른 장면에는 상반신이 보인다');

  // 마지막 말
  const message = page.locator('[data-scene="ending"][data-part="message"]');
  await message.waitFor();
  assert.equal(await message.evaluate((e) => e.classList.contains('end-scene') && e.classList.contains('ending-scene')), true);
  assert.equal(await page.locator('p.ending-message').textContent(), '우리가 쓰면 말은 살아난다.');
  assert.equal(await page.locator('p.ending-message').evaluate((e) => getComputedStyle(e).fontSize), '40px');
  const next = page.getByRole('button', { name: '다음' });
  await page.waitForTimeout(400);
  assert.equal(await next.isVisible(), false, '2초 전에는 "다음"이 없다');
  await next.waitFor({ state: 'visible', timeout: 4000 });
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), '다음');
  await page.waitForTimeout(300);
  assert.equal(await message.count(), 1, '저절로 넘어가지 않는다');
  await page.evaluate(() => window.__test.fastText(true));
  await page.keyboard.press('Enter');

  // 말빛 주머니
  await page.waitForSelector('[data-scene="ending"][data-part="pouch"]');
  assert.equal(await page.locator('.pouch-title').innerText(), '하늘의 말빛 주머니 50/50');
  assert.equal(await page.locator('.pouch .codex-card').count(), 50);
  assert.equal(await page.locator('.pouch .codex-card.found').count(), 50);
  const heads = await page.locator('.pouch-head').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(heads, ACTS.map((a) => `${a.id}막 ${a.title}`));
  assert.equal(heads[0], '1막 새벽골');
  assert.equal(heads[4], '5막 잿빛 탑');
  await page.waitForSelector('[data-scene="ending"][data-part="pouch"][data-lit]');
  await page.locator('.pouch-title').click(); // 초점 시작점을 제목으로 옮긴 뒤 Tab
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '어스름');
  await page.keyboard.press('Enter');
  const detail = await page.locator('.pouch .codex-detail').innerText();
  assert.match(detail, /해 뜨기 전이나 해 진 뒤의 조금 어둑한 때/);
  assert.match(detail, /만난 곳:/);
  // 다른 막 카드를 누르면 그 낱말
  await page.locator('.pouch .codex-card', { hasText: '도담도담' }).click();
  assert.match(await page.locator('.pouch .codex-detail').innerText(), /아이가 탈 없이 잘 자라는 모양/);
  await page.getByRole('button', { name: '마무리 퀴즈' }).click();
  await answerQuiz(page); // 퀴즈 화면은 tests/e2e/review-quiz.test.mjs에서 자세히 본다
  await page.getByRole('button', { name: '계속' }).click();

  // 만든 이
  await page.waitForSelector('[data-scene="ending"][data-part="credits"]');
  const credits = await page.locator('[data-part="credits"]').innerText();
  assert.match(credits, /고운돋움, 주아 \(SIL 오픈 폰트 라이선스\)/);
  assert.match(credits, /끝까지 길을 걸은 하늘/);
  assert.equal(await page.locator('.credits h3').count(), ENDING.credits.length);
  assert.equal(await page.locator('p.ending-thanks').textContent(), '하늘아, 끝까지 함께해 줘서 고마워!');
  await page.getByRole('button', { name: '처음 화면으로' }).click();
  await page.waitForSelector('[data-scene="title"]');

  // Review Focus 4: 이어하기 → 5-2, 마지막 장면은 다시 안 나오고, 출구가 열렸고, 나래가 서 있다 → 출구 → 엔딩을 다시 본다
  await continueAs(page, '하늘');
  await page.waitForSelector('[data-scene="explore"] .hud');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('[data-scene="dialogue"]').count(), 0, '마지막 장면이 다시 나오지 않는다');
  const s = await state(page);
  assert.equal(s.chapter, '5-2');
  assert.equal(await exitIsOpen(page), true);
  // 출구 안쪽 한 칸에서 출구를 보고 선다(출구 칸에 서 있어 비켜 섰다 다시 들어설 필요가 없다)
  const ch52 = ACTS[4].chapters[1];
  assert.deepEqual(s.pos, { x: ch52.exit.x - 1, y: ch52.exit.y });
  assert.equal(s.facing, ch52.exit.dir);
  assert.deepEqual(await visibleNpcIds(page), ch52.npcs.map((n) => n.id), '꼭대기에 나래가 서 있다');
  await page.keyboard.press(KEYS[ch52.exit.dir]);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '엔딩 보기' }).click();
  await page.waitForSelector('[data-scene="dialogue"][data-ready]');
  assert.equal(await page.locator('.dialogue-text').textContent(), '하늘은 해솔, 나래와 함께 새벽골로 돌아왔다.');
  assert.deepEqual(errors, []);
  await page.close();
});

test('여섯 글자 이름(가나다라마바) 1024×768: 주머니 제목과 인사 줄이 잘리거나 넘치지 않는다', async () => {
  const { page, errors } = await openGame(browser, server, { name: '가나다라마바', size: { width: 1024, height: 768 } });
  await atEndingExit(page);
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '엔딩 보기' }).click();
  await playEndingScenes(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.waitForSelector('[data-scene="ending"][data-part="pouch"][data-lit]');
  const fits = (sel) => page.locator(sel).evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, text: e.textContent }));
  const title = await fits('.pouch-title');
  assert.equal(title.text, '가나다라마바의 말빛 주머니 50/50');
  assert.ok(title.sw <= title.cw, `제목 ${title.sw} > ${title.cw}`);
  const noPageScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.equal(await noPageScroll(), true);
  // 카드 낱말이 칸 안에 들어간다(가장 긴 낱말 포함)
  const overflow = await page.locator('.pouch .codex-card').evaluateAll((els) => els.filter((e) => e.querySelector('.codex-word').getBoundingClientRect().width > e.clientWidth).map((e) => e.textContent));
  assert.deepEqual(overflow, []);
  // 쪽 안에 다 보인다(세로로도 넘치지 않음)
  assert.equal(await page.locator('[data-part="pouch"]').evaluate((e) => e.scrollHeight <= e.clientHeight), true, '주머니 화면이 768 안에 들어간다');
  await page.getByRole('button', { name: '마무리 퀴즈' }).click();
  await answerQuiz(page);
  const result = await page.locator('[data-phase="result"] .quiz').evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
  assert.ok(result.sw <= result.cw, '퀴즈 결과가 가로로 넘치지 않는다');
  assert.equal(await noPageScroll(), true);
  await page.getByRole('button', { name: '계속' }).click();
  await page.waitForSelector('[data-scene="ending"][data-part="credits"]');
  const thanks = await fits('p.ending-thanks');
  assert.equal(thanks.text, '가나다라마바야, 끝까지 함께해 줘서 고마워!');
  assert.ok(thanks.sw <= thanks.cw, `인사 ${thanks.sw} > ${thanks.cw}`);
  assert.equal(await noPageScroll(), true);
  assert.deepEqual(errors, []);
  await page.close();
});
