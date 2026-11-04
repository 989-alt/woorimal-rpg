import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue } from './browser.mjs';
import { parseMap, isWalkable } from '../../js/explore/grid.js';
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

async function openNewGame(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, ...opts });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"]');
  return { page, errors };
}

const BOSS_TIP = '하트 5개, 몬스터 6칸. 6번 맞히면 이겨요.';
const REVIEW_TIP = '얻은 낱말을 복습해요. 3번 맞히면 이겨요.';

// 전투를 연다. 처음이면 규칙 카드가 뜨고, '시작'을 누르면 첫 문제가 나온다.
async function startBattle(page, mode, seed = 7) {
  await page.evaluate(([m, s]) => window.__test.startBattle(m, s), [mode, seed]);
  await page.waitForSelector('[data-scene="battle"]');
  const tip = page.locator('.battle-tip');
  if (await tip.count()) {
    const text = await tip.innerText();
    await page.locator('.battle-tip button', { hasText: '시작' }).click();
    await waitAsk(page);
    return text;
  }
  await waitAsk(page);
  return null;
}

const waitAsk = (page) => page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
const battle = (page) => page.evaluate(() => window.__test.battle());

// 한 문제에 답한다. 맞히면 연출이 끝날 때까지, 틀리면 '다음'을 누를 때까지 기다린다.
async function answer(page, correct, { via = 'key' } = {}) {
  const idx = await page.evaluate(() => window.__test.answerIndex());
  const pick = correct ? idx : (idx + 1) % 4;
  const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
  if (via === 'key') await page.keyboard.press(`Digit${pick + 1}`);
  else await page.locator('.battle-option').nth(pick).click();
  if (!correct) {
    await page.waitForSelector('.battle-feedback .battle-next');
    await page.locator('.battle-next').click();
  }
  // 다음 문제가 나오거나 다른 장면으로 넘어갈 때까지
  await page.waitForFunction((n) => {
    const s = document.querySelector('[data-scene="battle"]');
    return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n);
  }, qn);
}

test('보스전: 첫 규칙 카드, 정답만 6번 → 1막 클리어, 출제 기록 10개와 막 클리어가 저장된다', async () => {
  const { page, errors } = await openNewGame();
  const tip = await startBattle(page, 'boss');
  assert.match(tip, new RegExp(BOSS_TIP.replace(/\./g, '\\.')));
  const scene = page.locator('[data-scene="battle"]');
  assert.equal(await page.locator('.hp-cell').count(), 6);
  assert.equal(await page.locator('.heart.full').count(), 5);
  assert.match(await scene.innerText(), /안개 덩이/);
  for (let i = 0; i < 6; i++) {
    await answer(page, true);
    if (i === 1) {
      // 연속 2번부터 표가 뜬다(다음 문제가 나온 뒤에도 남는다)
      assert.match(await page.locator('.battle-combo').innerText(), /연속 2번 맞힘!/);
    }
    if (i < 5) assert.equal(await page.locator('.hp-cell.lost').count(), i + 1);
  }
  await page.waitForSelector('[data-scene="clear"]');
  const text = await page.locator('[data-scene="clear"]').innerText();
  assert.match(text, /1막 클리어!/);
  assert.match(text, /다음 막은 준비 중이에요/);
  assert.equal(await page.locator('.clear-card').count(), 10);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.equal(saved.askedWordIds.length, 10);
  assert.deepEqual(saved.clearedActs, [1]);
  assert.ok(saved.seenTips.includes('tip-boss'));
  await page.getByRole('button', { name: '처음 화면으로' }).click();
  await page.waitForSelector('[data-scene="title"]');
  assert.deepEqual(errors, []);
  await page.close();
});

test('보스전: 오답만 5번 → 게임 오버 → 도감 다시 보기 → 다시 도전(초점) → 하트 5, HP 6, 같은 낱말', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss', 11);
  const before = await battle(page);
  // 첫 오답: 정답과 뜻, '다음'
  const idx = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${((idx + 1) % 4) + 1}`);
  await page.waitForSelector('.battle-feedback');
  const fb = await page.locator('.battle-feedback').innerText();
  assert.match(fb, /정답: /);
  const fontSize = await page.locator('.battle-meaning').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  assert.ok(fontSize >= 22, `뜻 글자 ${fontSize}px`);
  const nextBox = await page.locator('.battle-next').boundingBox();
  assert.ok(nextBox.height >= 48);
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('battle-next')), true);
  assert.equal(await page.locator('.heart.full').count(), 4);
  assert.equal(await page.locator('.battle-option.wrong').count(), 1);
  assert.equal(await page.locator('.battle-option.right').count(), 1);
  await page.locator('.battle-next').click();
  await waitAsk(page);
  for (let i = 0; i < 4; i++) await answer(page, false);
  await page.waitForSelector('[data-scene="gameover"]');
  assert.match(await page.locator('[data-scene="gameover"]').innerText(), /안개에 휩싸였다…/);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '다시 도전');
  // 게임 오버에서는 출제 기록이 남지 않는다
  let s = await page.evaluate(() => window.__test.state());
  assert.deepEqual(s.askedWordIds, []);
  await page.getByRole('button', { name: '도감 다시 보기' }).click();
  await page.waitForSelector('.codex');
  assert.equal(await page.locator('.codex-tab.on').innerText(), '1막');
  assert.equal(await page.locator('.codex-card.found').count(), 10);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.codex').count(), 0);
  await page.getByRole('button', { name: '다시 도전' }).click();
  await waitAsk(page);
  assert.equal(await page.locator('.battle-tip').count(), 0, '규칙 카드는 한 번만');
  assert.equal(await page.locator('.heart.full').count(), 5);
  assert.equal(await page.locator('.hp-cell').count(), 6);
  assert.equal(await page.locator('.hp-cell.lost').count(), 0);
  const after = await battle(page);
  assert.deepEqual([...after.order].sort(), [...before.order].sort());
  assert.equal(after.hearts, 5);
  assert.equal(after.hp, 6);
  assert.deepEqual(errors, []);
  await page.close();
});

test('복습전: 규칙 카드, 오답 2번 뒤 정답 3번 → 꼬마 안개를 쫓아내고 탐험으로, q2는 보고 가능(?)', async () => {
  const { page, errors } = await openNewGame();
  const tip = await startBattle(page, 'review');
  assert.match(tip, new RegExp(REVIEW_TIP.replace(/\./g, '\\.')));
  const scene = page.locator('[data-scene="battle"]');
  assert.match(await scene.innerText(), /남은 빛 3\/3/);
  assert.match(await scene.innerText(), /연습/);
  assert.match(await scene.innerText(), /꼬마 안개/);
  assert.match(await page.locator('.battle-type').innerText(), /뜻 고르기/);
  assert.equal(await page.locator('.heart').count(), 0);
  assert.equal(await page.locator('.battle-options.opts-meaning .battle-option').count(), 4);
  await answer(page, false);
  await answer(page, false);
  assert.match(await scene.innerText(), /남은 빛 3\/3/);
  await answer(page, true);
  assert.match(await scene.innerText(), /남은 빛 2\/3/);
  await answer(page, true);
  // 마지막 한 번: 메시지가 뜬 뒤 탐험으로
  const idx = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${idx + 1}`);
  await page.waitForSelector('.battle-win');
  assert.match(await page.locator('.battle-win').innerText(), /꼬마 안개를 쫓아냈다!/);
  await page.waitForSelector('[data-scene="explore"]');
  const s = await page.evaluate(() => window.__test.state());
  assert.equal(s.quests.q2.stage, 'ready');
  assert.equal(s.smallGone['1-1'], true);
  assert.ok(s.seenTips.includes('tip-review'));
  const marker = await page.evaluate(async () => {
    const { npcMarker } = await import('/js/rules/quests.js');
    const { default: ACT1 } = await import('/data/acts/act1.js');
    return npcMarker(window.__test.state(), ACT1.chapters[0], 'daon');
  });
  assert.equal(marker, '?');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.equal(saved.quests.q2.stage, 'ready');
  assert.deepEqual(errors, []);
  await page.close();
});

test('보기를 dblclick하거나 키 1을 연타해도 맞힘+틀림 합이 1만 늘고, ○/×는 바로 뜬다', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss', 3);
  let b = await battle(page);
  assert.equal(b.correct + b.wrong, 0);
  await page.locator('.battle-option').first().dblclick();
  await page.waitForTimeout(100);
  b = await battle(page);
  assert.equal(b.correct + b.wrong, 1);
  // 다음 문제로
  if (await page.locator('.battle-next').count()) await page.locator('.battle-next').click();
  await waitAsk(page);
  // 같은 이벤트 처리 안에서 ○/×가 붙는다(100ms 안)
  const marked = await page.evaluate(() => {
    const t0 = performance.now();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true }));
    const mark = document.querySelector('.battle-option .opt-mark');
    return { mark: mark?.textContent, ms: performance.now() - t0 };
  });
  assert.ok(['○', '×'].includes(marked.mark), `표시: ${marked.mark}`);
  assert.ok(marked.ms < 100);
  b = await battle(page);
  assert.equal(b.correct + b.wrong, 2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('문제 상자 아래 끝과 첫 보기 위 끝 사이는 12±2px (빈칸·뜻·문장 세 유형 모두)', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss', 5);
  const seen = new Map();
  // 4번 틀리고 5번 맞히면 9문제: 10낱말 중 9개가 나오므로 세 유형이 모두 나온다.
  const plan = [false, false, false, false, true, true, true, true, true];
  for (const ok of plan) {
    const m = await page.evaluate(() => {
      const q = document.querySelector('.battle-question').getBoundingClientRect();
      const opts = document.querySelector('.battle-options');
      const first = opts.querySelector('.battle-option').getBoundingClientRect();
      const all = [...opts.querySelectorAll('.battle-option')].map((o) => o.getBoundingClientRect());
      return { type: opts.dataset.type, gap: first.top - q.bottom, h: first.height, rows: new Set(all.map((r) => Math.round(r.top))).size };
    });
    seen.set(m.type, m);
    await answer(page, ok);
  }
  assert.deepEqual([...seen.keys()].sort(), ['blank', 'meaning', 'usage']);
  for (const [type, m] of seen) assert.ok(Math.abs(m.gap - 12) <= 2, `${type} 간격 ${m.gap}`);
  assert.equal(seen.get('blank').rows, 1);
  assert.ok(Math.abs(seen.get('blank').h - 110) <= 1);
  assert.equal(seen.get('meaning').rows, 2);
  assert.ok(seen.get('meaning').h >= 72);
  assert.equal(seen.get('usage').rows, 4);
  assert.ok(seen.get('usage').h >= 48);
  assert.deepEqual(errors, []);
  await page.close();
});

test('움직임 줄이기: 맞혀도 빛줄기 없이 서서히 나타나기만', async () => {
  const { page, errors } = await openNewGame({ reducedMotion: 'reduce' });
  await startBattle(page, 'boss', 9);
  const idx = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${idx + 1}`);
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.battle-beam').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('장 클리어: 1장 클리어! + 낱말 5장 → 다음 장으로 → 2장 첫 이야기 → 탐험(1-2)', async () => {
  const { page, errors } = await openNewGame();
  await page.evaluate(() => window.__test.acquire(['어스름', '아침나절', '매무새', '손사래', '오롯이'], '도담 할머니'));
  await page.waitForSelector('[data-scene="clear"]');
  assert.match(await page.locator('[data-scene="clear"]').innerText(), /1장 클리어!/);
  assert.equal(await page.locator('.clear-card').count(), 5);
  await page.getByRole('button', { name: '다음 장으로' }).click();
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  const s = await page.evaluate(() => window.__test.state());
  assert.equal(s.chapter, '1-2');
  assert.deepEqual(s.clearedChapters, ['1-1']);
  assert.equal(s.quests.q3.stage, 'open');
  assert.deepEqual(errors, []);
  await page.close();
});

// ── 싸움 막기: 부탁 순서와 끝낸 막 ──
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function pathTo(map, from, to, opts) {
  const prev = new Map([[`${from.x},${from.y}`, null]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift();
    if (p.x === to.x && p.y === to.y) break;
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      const n = { x: p.x + dx, y: p.y + dy };
      const k = `${n.x},${n.y}`;
      if (!prev.has(k) && isWalkable(map, n.x, n.y, opts)) { prev.set(k, { from: p, dir }); queue.push(n); }
    }
  }
  const dirs = [];
  for (let k = `${to.x},${to.y}`; prev.get(k); ) {
    const { from: p, dir } = prev.get(k);
    dirs.unshift(dir);
    k = `${p.x},${p.y}`;
  }
  return dirs;
}
// target 칸 아래에 서서 위를 바라보고 스페이스
async function faceFromBelow(page, map, target, opts) {
  const s = await page.evaluate(() => window.__test.state());
  const below = { x: target.x, y: target.y + 1 };
  for (const dir of pathTo(map, s.pos, below, opts)) await page.keyboard.press(KEYS[dir]);
  await page.keyboard.press('ArrowUp');
  const now = await page.evaluate(() => window.__test.state());
  assert.deepEqual(now.pos, below);
  assert.equal(now.facing, 'up');
  await page.keyboard.press('Space');
}

test('꼬마 안개: 다온의 부탁(q2)이 open이면 안내만 뜨고 전투는 없다, 규칙 카드도 쓰지 않는다', async () => {
  const { page, errors } = await openNewGame();
  // q1을 끝내고 q2가 열린 상태(낱말 2개)
  await page.evaluate(() => {
    const s = window.__test.state();
    s.quests.q1 = { stage: 'done', gathered: [] };
    s.quests.q2 = { stage: 'open', gathered: [] };
    window.__test.acquire(['어스름', '아침나절'], '도담 할머니');
  });
  await page.waitForSelector('[data-scene="explore"]');
  const map = parseMap(ACT1.chapters[0].map.rows);
  await faceFromBelow(page, map, map.smallMonster, {});
  await page.waitForSelector('.toast:not([hidden])');
  assert.equal(await page.locator('.toast').innerText(), '꼬마 안개가 길을 막고 있어. 다온에게 먼저 이야기해 보자.');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-scene="battle"]').count(), 0);
  const s = await page.evaluate(() => window.__test.state());
  assert.equal(s.seenTips.includes('tip-review'), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('막 보스: 이긴 뒤 처음 화면 → 이어하기 → 보스 앞에서 스페이스면 안내만 뜨고 전투는 없다', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss');
  for (let i = 0; i < 6; i++) await answer(page, true);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '처음 화면으로' }).click();
  await page.waitForSelector('[data-scene="title"]');
  await page.fill('#nickname', '하늘');
  await page.getByRole('button', { name: '이어하기' }).first().click();
  await page.waitForSelector('[data-scene="explore"]');
  const s = await page.evaluate(() => window.__test.state());
  assert.equal(s.chapter, '1-2');
  assert.deepEqual(s.clearedActs, [1]);
  const map = parseMap(ACT1.chapters[1].map.rows);
  await faceFromBelow(page, map, map.boss, { fogOpen: true });
  await page.waitForSelector('.toast:not([hidden])');
  assert.equal(await page.locator('.toast').innerText(), '1막은 이미 끝냈어. 다음 막은 준비 중이에요.');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-scene="battle"]').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('전투 장면 방어: 낱말을 모두 낸 막의 보스전은 열지 않고 탐험으로 돌아간다', async () => {
  const { page, errors } = await openNewGame();
  await page.evaluate(() => {
    const s = window.__test.state();
    s.askedWordIds = ['어스름', '아침나절', '해거름', '부리나케', '매무새', '짬', '곰비임비', '얼추', '손사래', '오롯이'];
    window.__test.startBattle('boss', 1);
  });
  await page.waitForSelector('[data-scene="explore"]');
  assert.equal(await page.locator('[data-scene="battle"]').count(), 0);
  const s = await page.evaluate(() => window.__test.state());
  assert.equal(s.seenTips.includes('tip-boss'), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('전투 장면 방어: 쫓기 부탁이 진행 중이 아니면 복습전을 이겨도 "쫓아냈다"를 띄우지 않는다', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'review', 2);
  await page.evaluate(() => {
    window.__sawWin = false;
    new MutationObserver(() => { if (document.querySelector('.battle-win')) window.__sawWin = true; })
      .observe(document.body, { childList: true, subtree: true });
    window.__test.state().quests.q2.stage = 'open'; // 전투 도중 부탁 단계가 바뀐 경우
  });
  for (let i = 0; i < 3; i++) await answer(page, true);
  await page.waitForSelector('[data-scene="explore"]');
  assert.equal(await page.evaluate(() => window.__sawWin), false);
  const s = await page.evaluate(() => window.__test.state());
  assert.equal(s.quests.q2.stage, 'open');
  assert.equal(s.smallGone['1-1'], undefined);
  assert.deepEqual(errors, []);
  await page.close();
});
