// 2~5막과 엔딩을 끝까지 도는 화면 검사(1366×768, 이름 '하늘').
// 2막은 진짜로 끝까지 플레이하고, 3~5막은 장마다 상태를 채워 출구·보스·보스 뒤 장면·세계 지도를 지나 엔딩(되찾은 마을들,
// 마지막 말, 말빛 주머니, 마무리 퀴즈, 만든 이)까지 간다. 도중 새로 고침과 1막만 있던 옛 저장도 본다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, dialogueStep } from './browser.mjs';
import {
  openGame, state, interact, talkThrough, playDialogue, toast, enterBattle, answerRight, waitAsk, continueAs, answerQuiz,
} from './play.mjs';
import { walkToExit, KEYS } from './helpers.mjs';
import { ACTS } from '../../data/acts/index.js';
import ENDING from '../../data/ending.js';
import { WORDS } from '../../data/words.js';
import { parseMap, isWalkable } from '../../js/explore/grid.js';
import { actWords, chapterWords } from '../../js/rules/game.js';
import { formatLine } from '../../js/rules/josa.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const NAME = '하늘';
const chapterById = (id) => ACTS.flatMap((a) => a.chapters).find((c) => c.id === id);
const line = (l, name = NAME) => formatLine(l.text, name).replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1');
const companions = (page) => page.locator('.hud-companion').evaluateAll((els) => els.map((e) => e.dataset.npc));
const wordsOfAct = (n) => WORDS.filter((w) => w.act === n).map((w) => w.word).sort();
const firstText = async (page) => {
  await page.waitForSelector('[data-scene="dialogue"][data-ready]');
  return page.locator('.dialogue-text').textContent();
};

// 대화를 끝까지 넘기며 확인한 카드 낱말과 그 줄의 금빛 띠 글을 모은다.
async function playCards(page, until = 'explore') {
  await page.waitForSelector('[data-scene="dialogue"]');
  const cards = [];
  for (let i = 0; i < 200; i++) {
    const r = await dialogueStep(page, until, i % 2 ? 'Enter' : 'Space');
    if (r === 'done') return cards;
    if (r.card) cards.push(r);
  }
  throw new Error('대화가 끝나지 않았다');
}
const talkCards = async (page, target) => { await interact(page, target); return playCards(page); };

// 전투를 끝까지 맞혀 이기고 전투 화면이 닫힐 때까지
async function winBattle(page) {
  await waitAsk(page);
  while (await page.locator('[data-scene="battle"]').count()) await answerRight(page);
}

// 물건을 조사해 알림만 뜨는 걸음(가져오기·찾기·모으기): 상태가 바뀔 때까지 기다린다.
async function pickUp(page, objectName, done, arg) {
  await interact(page, objectName);
  await page.waitForFunction(done, arg);
  await page.waitForSelector('.toast:not([hidden])');
}

// 장의 낱말·부탁·숨은 낱말을 모두 끝낸 상태로 바꾼다(그 장 출구가 열린다. 뒷 장은 보스를 이겨야 열린다).
const finishChapterState = (page, id) => page.evaluate(([cid, words, qids]) => window.__test.patchState((s) => ({
  acquired: { ...s.acquired, ...Object.fromEntries(words.map((w) => [w, { from: '검사' }])) },
  quests: { ...s.quests, ...Object.fromEntries(qids.map((q) => [q, { stage: 'done', gathered: [] }])) },
  hiddenFound: { ...s.hiddenFound, [cid]: true },
  revealed: { ...s.revealed, [cid]: true },
  smallGone: { ...s.smallGone, [cid]: true },
  bag: [],
})), [id, chapterWords(chapterById(id)), chapterById(id).quests.map((q) => q.id)]);

async function openCodexDetail(page, word) {
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  const tab = await page.locator('.codex-tab[aria-selected="true"]').innerText();
  await page.locator('.codex-card', { hasText: word }).click();
  const detail = await page.locator('.codex-detail').innerText();
  await page.locator('.codex-close').click();
  await page.waitForSelector('.codex', { state: 'detached' });
  return { tab, detail };
}

test('2막 끝까지 실제 플레이: 2-1 부탁·숨은 낱말 → 장 클리어 → 2-2 복습전·모으기·보스 → 보스 뒤 장면 → 막 클리어 → 세계 지도 → 3-1', async () => {
  const { page, errors } = await openGame(browser, server, { name: NAME });
  const [ch1, ch2] = ACTS[1].chapters;
  const cards = [];
  const take = (list) => cards.push(...list.map((c) => c.card));
  await page.evaluate(() => window.__test.goChapter('2-1'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  assert.deepEqual(await companions(page), ['haesol'], '2-1: 해솔 초상');

  // 숨은 낱말: 문지기와 말하기 전에 장터 아치 문을 조사하면 알림만(낱말 없음)
  const arch = ch1.objects.find((o) => o.slot === ch1.hidden.object);
  await interact(page, arch.name);
  assert.equal(await toast(page), arch.text);
  assert.equal(await page.locator('[data-scene="dialogue"]').count(), 0);
  assert.equal('들머리' in (await state(page)).acquired, false);

  // q5 해솔(가져오기: 분수대)
  const [q5, q6] = ch1.quests;
  await talkThrough(page, 'haesol');
  await pickUp(page, '분수대', (id) => window.__test.state().bag.includes(id), q5.item.id);
  take(await talkCards(page, 'haesol'));
  // 도감(E): 처음 탭은 2막, 마수걸이를 만난 곳은 해솔
  const codex = await openCodexDetail(page, '마수걸이');
  assert.equal(codex.tab, '2막');
  assert.match(codex.detail, /만난 곳: 해솔/);

  // q6 사과 장수(찾기: 쌀가게 뒤 항아리)
  await talkThrough(page, 'fruit');
  await pickUp(page, '쌀가게 뒤 항아리', (id) => window.__test.state().bag.includes(id), q6.item.id);
  take(await talkCards(page, 'fruit'));

  // 문지기 → 아치 문 → 들머리
  await talkThrough(page, ch1.hidden.revealedBy);
  take(await talkCards(page, arch.name));
  assert.deepEqual(await companions(page), ['haesol']);
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /1장 클리어!/);
  await page.getByRole('button', { name: '다음 장으로' }).click();
  assert.equal(await firstText(page), line(ch2.intro[0]));
  await playDialogue(page);
  assert.equal((await state(page)).chapter, '2-2');
  assert.deepEqual(await companions(page), ['haesol'], '2-2: 해솔 초상');

  // q7 밤 장수 할머니(꼬마 값 그림자 복습전)
  await talkThrough(page, 'chestnut');
  await enterBattle(page, 'small');
  await winBattle(page);
  await page.waitForSelector('[data-scene="explore"] canvas');
  take(await talkCards(page, 'chestnut'));
  // q8 해솔(모으기 3곳)
  await talkThrough(page, 'haesol');
  const q8 = ch2.quests[1];
  for (const [k, slot] of q8.targets.entries()) {
    const name = ch2.objects.find((o) => o.slot === slot).name;
    await pickUp(page, name, (n) => (window.__test.state().quests.q8.gathered.length === n), k + 1);
  }
  take(await talkCards(page, 'haesol'));
  // 꽃 파는 아이 → 꽃수레
  await talkThrough(page, ch2.hidden.revealedBy);
  take(await talkCards(page, ch2.objects.find((o) => o.slot === ch2.hidden.object).name));
  assert.deepEqual(cards.slice().sort(), wordsOfAct(2), '받은 카드는 2막 낱말 10개');

  // 보스전 → 보스 뒤 장면 → 출구 → 막 클리어
  await enterBattle(page, 'boss');
  let asked = 0;
  while (await page.locator('[data-scene="battle"]').count()) { await answerRight(page); asked++; }
  assert.equal(asked, 6, '보스전은 6문제');
  assert.equal(await firstText(page), line(ch2.afterBoss[0]));
  await playDialogue(page);
  assert.deepEqual(await companions(page), ['haesol']);
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /2막 클리어!/);
  assert.deepEqual((await page.locator('.clear-word').allInnerTexts()).sort(), wordsOfAct(2));
  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
  await page.getByRole('button', { name: '떠나기' }).click();
  assert.equal(await firstText(page), line(ACTS[2].chapters[0].intro[0]));
  await playDialogue(page);
  const s = await state(page);
  assert.equal(s.chapter, '3-1');
  assert.equal(s.act, 3);
  assert.deepEqual(errors, []);
  await page.close();
});

test('보이는 꼴: 3-1 나래의 길 표시 끈 — 금빛 띠는 "아스라하게", 카드와 도감은 "아스라하다"', async () => {
  const { page, errors } = await openGame(browser, server, { name: NAME });
  await page.evaluate(() => window.__test.goChapter('3-1'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  const ch = ACTS[2].chapters[0];
  const q9 = ch.quests[0];
  await talkThrough(page, 'narae');
  for (const [k, slot] of q9.targets.entries()) {
    await pickUp(page, ch.objects.find((o) => o.slot === slot).name, (n) => window.__test.state().quests.q9.gathered.length === n, k + 1);
  }
  const cards = await talkCards(page, 'narae');
  const far = cards.find((c) => c.card === '아스라하다');
  assert.ok(far, cards.map((c) => c.card).join(','));
  assert.deepEqual(far.bands, ['아스라하게']);
  assert.deepEqual(cards.find((c) => c.card === '물꼬').bands, ['물꼬']);
  const codex = await openCodexDetail(page, '아스라하다');
  assert.equal(codex.tab, '3막');
  assert.match(codex.detail, /^아스라하다/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('3~5막: 앞 장 출구 → 장 클리어 → 뒷 장 → 보스 → 보스 뒤 장면 → 막 클리어 → 세계 지도 … 엔딩(되찾은 마을들 → 마지막 말 → 주머니 → 마무리 퀴즈 → 만든 이) → 이어하기', async () => {
  const { page, errors } = await openGame(browser, server, { name: NAME });
  for (const n of [3, 4, 5]) {
    const act = ACTS[n - 1];
    const [front, back] = act.chapters;
    // 앞 장 출구
    await page.evaluate((id) => window.__test.goChapter(id), front.id);
    await page.waitForSelector('[data-scene="explore"] canvas');
    await finishChapterState(page, front.id);
    await walkToExit(page);
    await page.waitForSelector('[data-scene="clear"]');
    assert.match(await page.locator('[data-scene="clear"]').innerText(), /1장 클리어!/, `${front.id}`);
    await page.getByRole('button', { name: '다음 장으로' }).click();
    assert.equal(await firstText(page), line(back.intro[0]), `${back.id} 시작 글`);
    await playDialogue(page);
    assert.equal((await state(page)).chapter, back.id);
    // 뒷 장: 보스 → 보스 뒤 장면 → 출구
    await page.evaluate((id) => window.__test.goChapter(id), back.id);
    await page.waitForSelector('[data-scene="explore"] canvas');
    await finishChapterState(page, back.id);
    await page.waitForSelector('[data-scene="explore"] canvas');
    await page.evaluate(() => window.__test.startBattle('boss', 7));
    await winBattle(page);
    assert.equal(await firstText(page), line(back.afterBoss[0]), `${back.id} 보스 뒤 장면`);
    await playDialogue(page);
    await walkToExit(page);
    await page.waitForSelector('[data-scene="clear"]');
    assert.match(await page.locator('[data-scene="clear"]').innerText(), new RegExp(`${n}막 클리어!`));
    assert.equal(await page.locator('.clear-card').count(), 10);
    if (n < 5) {
      await page.getByRole('button', { name: '세계 지도로' }).click();
      await page.waitForSelector('[data-scene="worldmap"]');
      await page.getByRole('button', { name: '떠나기' }).click();
      assert.equal(await firstText(page), line(ACTS[n].chapters[0].intro[0]), `${n + 1}막 시작 글`);
      await playDialogue(page);
      assert.equal((await state(page)).act, n + 1);
    }
  }

  // 엔딩: 장면마다 모든 줄(되찾은 마을들 넷 포함)이 차례대로
  await page.getByRole('button', { name: '엔딩 보기' }).click();
  const seen = [];
  for (let i = 0; i < 200; i++) {
    await page.waitForSelector('[data-scene="ending"], [data-scene="dialogue"][data-ready]');
    if (await page.locator('[data-scene="ending"]').count()) break;
    seen.push(await page.evaluate(() => {
      const tag = document.querySelector('.dialogue-scene .name-tag');
      return { text: document.querySelector('.dialogue-text').textContent, tag: tag.hidden ? '' : tag.textContent };
    }));
    await dialogueStep(page, 'ending', i % 2 ? 'Enter' : 'Space');
  }
  assert.deepEqual(seen.map((l) => l.text), ENDING.scenes.flatMap((sc) => sc.lines.map((l) => line(l))));
  const castName = (id) => ENDING.cast.find((c) => c.id === id).name;
  const montageTags = ENDING.scenes.slice(1, 5).flatMap((sc) => sc.lines.filter((l) => l.who === 'npc').map((l) => castName(l.npc)));
  for (const t of ['사과 장수 아저씨', '나룻배 사공', '찻집 아주머니', '잿빛 아이']) assert.ok(montageTags.includes(t), t);
  assert.ok(montageTags.every((t) => seen.some((l) => l.tag === t)), '되찾은 마을 주민 이름표가 모두 나온다');

  await page.waitForSelector('[data-scene="ending"][data-part="message"]');
  assert.equal(await page.locator('p.ending-message').textContent(), ENDING.message);
  await page.getByRole('button', { name: '다음' }).click();
  await page.waitForSelector('[data-scene="ending"][data-part="pouch"]');
  assert.equal(await page.locator('.pouch-title').innerText(), `${NAME}의 말빛 주머니 50/50`);
  await page.getByRole('button', { name: '마무리 퀴즈' }).click();
  const quiz = await answerQuiz(page, { wrong: [3] });
  assert.equal(quiz.length, 10);
  assert.equal(new Set(quiz.map((q) => q.word)).size, 10, '낱말 10개가 서로 다르다');
  assert.deepEqual(['meaning', 'chosung', 'situation'].map((t) => quiz.filter((q) => q.type === t).length), [4, 3, 3]);
  assert.equal(await page.locator('.quiz-score').textContent(), '10문제 중 9개 맞힘');
  await page.getByRole('button', { name: '계속' }).click();
  await page.waitForSelector('[data-scene="ending"][data-part="credits"]');
  assert.equal(await page.locator('p.ending-thanks').textContent(), formatLine(ENDING.thanks, NAME));
  await page.getByRole('button', { name: '처음 화면으로' }).click();

  // 엔딩 뒤 이어하기: 5-2 출구 안쪽 한 칸에서 출구를 보고 선다 → 한 걸음이면 막 클리어 → 엔딩 보기
  await continueAs(page, NAME);
  const s = await state(page);
  const exit = ACTS[4].chapters[1].exit;
  assert.equal(s.chapter, '5-2');
  assert.deepEqual(s.pos, { x: exit.x - 1, y: exit.y });
  assert.equal(s.facing, exit.dir);
  await page.keyboard.press(KEYS[exit.dir]);
  await page.waitForSelector('[data-scene="clear"]');
  assert.equal(await page.getByRole('button', { name: '엔딩 보기' }).count(), 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test('3막 도중 새로 고침: 나래의 부탁을 받고 한 칸 걸은 뒤 → 이어하기 → 3-1, 부탁 진행 중, 같은 자리', async () => {
  const { page, errors } = await openGame(browser, server, { name: NAME });
  await page.evaluate(() => window.__test.goChapter('3-1'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  await talkThrough(page, 'narae');
  assert.equal((await state(page)).quests.q9.stage, 'active');
  const map = parseMap(ACTS[2].chapters[0].map.rows);
  const here = (await state(page)).pos;
  const [dir] = Object.entries({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] })
    .find(([, [dx, dy]]) => isWalkable(map, here.x + dx, here.y + dy, {}));
  await page.keyboard.press(KEYS[dir]);
  await page.waitForFunction((p) => { const q = window.__test.state().pos; return q.x !== p.x || q.y !== p.y; }, here);
  const before = await state(page);
  await page.reload();
  await continueAs(page, NAME);
  const s = await state(page);
  assert.equal(s.chapter, '3-1');
  assert.equal(s.act, 3);
  assert.equal(s.quests.q9.stage, 'active');
  assert.deepEqual(s.pos, before.pos);
  assert.equal(s.facing, before.facing);
  assert.deepEqual(errors, []);
  await page.close();
});

test('옛 저장(1막만, seenScenes·revealed 없음, 1-2 출구 옆): 이어하기 → 출구 → 1막 클리어 → 세계 지도 → 떠나기 → 2-1', async () => {
  const { page, errors } = await openGame(browser, server, { name: null });
  const ch = ACTS[0].chapters[1];
  const ids = actWords(ACTS[0]);
  const old = {
    version: 1, nickname: '옛날', avatar: 'm', act: 1, chapter: '1-2',
    pos: { x: ch.exit.x, y: ch.exit.y + 1 }, facing: 'down',
    acquired: Object.fromEntries(ids.map((w) => [w, { from: '옛 저장' }])),
    quests: Object.fromEntries(['q1', 'q2', 'q3', 'q4'].map((q) => [q, { stage: 'done', gathered: [] }])),
    bag: [], hiddenFound: { '1-1': true, '1-2': true }, smallGone: { '1-1': true },
    askedWordIds: ids, clearedChapters: ['1-1'], clearedActs: [1], seenTips: [],
  };
  await page.evaluate((s) => {
    localStorage.setItem('malbit:save:옛날', JSON.stringify(s));
    localStorage.setItem('malbit:names', JSON.stringify(['옛날']));
  }, old);
  await page.reload();
  await continueAs(page, '옛날');
  let s = await state(page);
  assert.equal(s.chapter, '1-2');
  assert.deepEqual(s.seenScenes, []);
  assert.deepEqual(s.revealed, {});
  await page.keyboard.press(KEYS[ch.exit.dir]);
  await page.waitForSelector('[data-scene="clear"]');
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /1막 클리어!/);
  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
  await page.getByRole('button', { name: '떠나기' }).click();
  assert.equal(await firstText(page), line(ACTS[1].chapters[0].intro[0], '옛날'));
  await playDialogue(page);
  s = await state(page);
  assert.equal(s.chapter, '2-1');
  assert.equal(s.act, 2);
  assert.equal(s.quests.q5.stage, 'open');
  assert.deepEqual(errors, []);
  await page.close();
});
