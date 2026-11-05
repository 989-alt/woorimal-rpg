import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, startFromTitle } from './browser.mjs';
import { parseMap } from '../../js/explore/grid.js';
import { pathTo, KEYS, walkToExit } from './helpers.mjs';
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

const BOSS_TIP = '하트 5개, 몬스터 HP 6칸이에요';
const REVIEW_TIP = '1~4를 누르거나 보기를 눌러 골라요';

// 전투를 연다. 첫 문제가 바로 나오고, 처음이면 안내 말풍선이 함께 뜬다(그 글을 돌려준다. 없으면 null).
async function startBattle(page, mode, seed = 7) {
  await page.evaluate(([m, s]) => window.__test.startBattle(m, s), [mode, seed]);
  await page.waitForSelector('[data-scene="battle"]');
  await waitAsk(page);
  const tip = page.locator('.hint');
  return (await tip.count()) ? tip.innerText() : null;
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

test('보스전: 첫 안내 말풍선, 정답만 6번 → 이겨도 그 자리에 남고 출구로 걸어가면 1막 클리어, 출제 기록 10개와 막 클리어가 저장된다', async () => {
  const { page, errors } = await openNewGame();
  const tip = await startBattle(page, 'boss');
  assert.ok(tip.includes(BOSS_TIP), tip);
  assert.equal(await page.locator('.hint[data-tip="tip-boss"]').count(), 1);
  const scene = page.locator('[data-scene="battle"]');
  assert.equal(await page.locator('.hp-cell').count(), 6);
  assert.equal(await page.locator('.heart.full').count(), 5);
  assert.match(await scene.innerText(), /안개 덩이/);
  await page.evaluate(() => { // 이겼다는 말은 탐험으로 돌아가면 사라지므로 뜬 글을 적어 둔다
    new MutationObserver(() => { const w = document.querySelector('.battle-win'); if (w) window.__winText = w.innerText; })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  for (let i = 0; i < 6; i++) {
    await answer(page, true);
    if (i === 1) {
      // 연속 2번부터 표가 뜬다(다음 문제가 나온 뒤에도 남는다)
      assert.match(await page.locator('.battle-combo').innerText(), /연속 2번 맞힘!/);
    }
    if (i < 5) assert.equal(await page.locator('.hp-cell.lost').count(), i + 1);
  }
  // 이긴 뒤에는 막 클리어가 바로 열리지 않는다: 이겼다는 말 → 탐험(그 자리)
  await page.waitForSelector('[data-scene="explore"] canvas');
  assert.equal(await page.evaluate(() => window.__winText), '안개 덩이를 물리쳤다!');
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.equal(saved.askedWordIds.length, 10);
  assert.deepEqual(saved.clearedActs, [1]);
  assert.ok(saved.seenTips.includes('tip-boss'));
  // 열린 출구로 걸어가야 막 클리어
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  const text = await page.locator('[data-scene="clear"]').innerText();
  assert.match(text, /1막 클리어!/);
  assert.doesNotMatch(text, /준비 중/);
  assert.equal(await page.locator('.clear-card').count(), 10);
  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
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
  assert.ok(Math.round(nextBox.height) >= 48, `${nextBox.height}`);
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('battle-next')), true);
  assert.equal(await page.locator('.heart.full').count(), 4);
  assert.equal(await page.locator('.battle-option.wrong').count(), 1);
  assert.equal(await page.locator('.battle-option.right').count(), 1);
  await page.locator('.battle-next').click();
  await waitAsk(page);
  for (let i = 0; i < 4; i++) await answer(page, false);
  await page.waitForSelector('[data-scene="gameover"]');
  assert.match(await page.locator('[data-scene="gameover"]').innerText(), /안개에 휩싸였다\.\.\./);
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
  assert.equal(await page.locator('.hint').count(), 0, '안내는 한 번만(두 번째 보스전엔 없음)');
  assert.equal((await page.evaluate(() => window.__test.hints)).filter((h) => h.id === 'tip-boss').length, 1);
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

test('복습전: 첫 안내 말풍선, 오답 2번 뒤 정답 3번 → 꼬마 안개를 쫓아내고 탐험으로, q2는 보고 가능(?)', async () => {
  const { page, errors } = await openNewGame();
  const tip = await startBattle(page, 'review');
  assert.ok(tip.includes(REVIEW_TIP), tip);
  assert.equal(await page.locator('.hint[data-tip="tip-review"]').count(), 1);
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
  assert.equal(seen.get('meaning').rows, 2);
  assert.equal(seen.get('usage').rows, 4);
  // 유형별 보기 높이: 낱말 카드 110, 뜻 72, 문장 48
  for (const [type, h] of [['blank', 110], ['meaning', 72], ['usage', 48]]) {
    assert.ok(Math.abs(seen.get(type).h - h) <= 2, `${type} 보기 높이 ${seen.get(type).h} (기대 ${h}±2)`);
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('움직임 줄이기: 맞혀도 날아가기·파동·빛줄기 없이, 흔들림 움직임도 없고 서서히 나타나기만', async () => {
  const { page, errors } = await openNewGame({ reducedMotion: 'reduce' });
  await startBattle(page, 'boss', 9);
  const idx = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${idx + 1}`);
  await page.waitForSelector('.fx-glow');
  assert.equal(await page.locator('.battle-beam, .fx-word-fly, .fx-ring, .fx-spark, .fx-burst').count(), 0);
  // 무대 안 어떤 움직임도 이동·크기·회전(translate/transform/scale/rotate) 틀을 갖지 않는다
  const moving = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.effect?.target?.closest?.('.battle-stage'))
    .flatMap((a) => a.effect.getKeyframes())
    .filter((k) => ['translate', 'scale', 'rotate'].some((p) => p in k) || (k.transform && k.transform !== 'none')).length);
  assert.equal(moving, 0, '움직임 줄이기에서 이동·크기 변화 프레임이 없다');
  assert.deepEqual(errors, []);
  await page.close();
});

test('공격 연출: 맞히면 낱말이 날아가고 금빛 파동이 생겼다가 0.8초 안에 지워진다, 모든 움직임은 0.8초 이하', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss', 9);
  // 효과 조각마다 붙은 순간에 그 움직임의 길이(Web Animations: delay + duration + endDelay = endTime)를 재고,
  // 지워졌는지와 다음 문제가 열리기 전에 지워졌는지를 적는다. 벽시계로 재지 않는다(바쁜 기계에서 타이머가 늦게 와도 흔들리지 않게).
  await page.evaluate(() => {
    const KINDS = ['fx-word-fly', 'fx-ring', 'fx-spark'];
    window.__fx = {};
    const scene = document.querySelector('[data-scene="battle"]');
    const asking = () => scene.dataset.phase === 'ask' && !scene.querySelector('.battle-option[aria-disabled]');
    new MutationObserver((list) => {
      for (const m of list) {
        m.addedNodes.forEach((n) => KINDS.forEach((c) => {
          if (!n.classList?.contains(c)) return;
          const ends = n.getAnimations().map((a) => a.effect.getComputedTiming().endTime);
          const f = (window.__fx[c] ??= { count: 0, removed: 0, life: 0, removedWhileAsking: 0 });
          f.count++;
          f.life = Math.max(f.life, ...ends);
          f.animated = (f.animated ?? true) && ends.length > 0;
        }));
        m.removedNodes.forEach((n) => KINDS.forEach((c) => {
          if (!n.classList?.contains(c) || !window.__fx[c]) return;
          window.__fx[c].removed++;
          if (asking()) window.__fx[c].removedWhileAsking++;
        }));
      }
    }).observe(document.querySelector('.battle-fx'), { childList: true });
  });
  const word = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${word + 1}`);
  await page.waitForSelector('.fx-word-fly');
  await page.waitForSelector('.fx-ring');
  assert.ok((await page.locator('.fx-word-fly').innerText()).length >= 1, '맞힌 낱말이 날아간다');
  const lens = await page.evaluate(() => document.getAnimations().map((a) => a.effect.getComputedTiming().endTime).filter(Number.isFinite));
  assert.ok(lens.length > 10 && Math.max(...lens) <= 800, `가장 긴 움직임 ${Math.max(...lens)}ms`);
  await page.waitForSelector('[data-phase="ask"] .battle-option:not([aria-disabled])');
  const fx = await page.evaluate(() => window.__fx);
  for (const c of ['fx-word-fly', 'fx-ring', 'fx-spark']) {
    assert.ok(fx[c]?.count > 0, `${c}가 생긴다`);
    assert.equal(fx[c].animated, true, `${c}는 움직임이 붙은 채 생긴다`);
    assert.ok(fx[c].life > 0 && fx[c].life <= 800, `${c} 움직임 길이 ${fx[c].life}ms`);
    assert.equal(fx[c].removed, fx[c].count, `${c}는 모두 지워진다`);
    assert.equal(fx[c].removedWhileAsking, 0, `${c}는 다음 문제가 열리기 전에 지워진다`);
  }
  assert.equal(await page.locator('.battle-fx > *').count(), 0, '연출이 끝나면 효과 층이 비어 있다');
  assert.deepEqual(errors, []);
  await page.close();
});

test('공격 연출: 연속 정답 3번이면 파동 2겹, 마지막 일격은 안개 조각이 흩어진 뒤 클리어', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss', 9);
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const idx = await page.evaluate(() => window.__test.answerIndex());
    const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
    await page.keyboard.press(`Digit${idx + 1}`);
    await page.waitForSelector('.fx-ring');
    rings.push(await page.locator('.fx-ring').count());
    if (i === 5) {
      assert.ok((await page.locator('.fx-mist').count()) >= 10, '마지막 일격: 안개 조각');
      assert.equal(await page.locator('.fx-bloom').count(), 1, '그 자리에 빛이 퍼진다');
      break;
    }
    await page.waitForFunction((n) => document.querySelector('[data-scene="battle"]')?.dataset.qn !== n, qn);
  }
  assert.deepEqual(rings, [1, 1, 2, 2, 2, 2]);
  await page.waitForSelector('[data-scene="explore"] canvas'); // 이긴 뒤에는 탐험으로 돌아온다(막 클리어는 출구에서)
  assert.deepEqual(errors, []);
  await page.close();
});

test('맞히면 고른 보기에 "맞았어!"와 ○, 틀리면 × 보기와 정답 보기(.right)', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss', 4);
  // 오답
  const idx = await page.evaluate(() => window.__test.answerIndex());
  const wrong = (idx + 1) % 4;
  await page.keyboard.press(`Digit${wrong + 1}`);
  await page.waitForSelector('.battle-feedback');
  const opts = page.locator('.battle-option');
  assert.equal(await opts.nth(wrong).evaluate((b) => b.classList.contains('wrong') && b.classList.contains('picked')), true, '고른 오답 보기는 .wrong + .picked');
  assert.equal(await opts.nth(wrong).locator('.opt-mark').textContent(), '×');
  assert.equal(await opts.nth(idx).evaluate((b) => b.classList.contains('right')), true, '정답 보기는 .right');
  assert.equal(await opts.nth(idx).locator('.opt-mark').textContent(), '○');
  assert.equal(await page.locator('.opt-say').count(), 0, '틀리면 "맞았어!"는 없다');
  assert.equal(await page.locator('.battle-option[aria-disabled="true"]').count(), 4, '풀면 보기는 모두 잠긴다');
  // 오답 보기 색: 글자 #5E6266, 면은 잿빛 쪽
  const look = await opts.nth(wrong).evaluate((b) => { const c = getComputedStyle(b); return { color: c.color, parchment: c.getPropertyValue('--parchment').trim() }; });
  assert.equal(look.color, 'rgb(94, 98, 102)');
  assert.notEqual(look.parchment.toLowerCase(), '#fbf5e6');
  await page.locator('.battle-next').click();
  await waitAsk(page);
  // 정답
  const idx2 = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${idx2 + 1}`);
  const right = page.locator('.battle-option').nth(idx2);
  assert.equal(await right.locator('.opt-say').textContent(), '맞았어!');
  assert.equal(await right.locator('.opt-mark').textContent(), '○');
  assert.equal(await right.evaluate((b) => b.classList.contains('picked') && b.classList.contains('right')), true);
  assert.equal(await page.locator('.opt-say').count(), 1);
  assert.equal(await page.locator('.battle-option.wrong').count(), 0);
  const say = await page.locator('.opt-say').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  assert.equal(say, 20, '"맞았어!"는 주아 20');
  assert.match(await page.locator('.opt-say').evaluate((e) => getComputedStyle(e).fontFamily), /Jua/);
  assert.match(await right.getAttribute('aria-label'), /정답/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('게임 오버: 다시 도전에 처음 초점, 두 단추 48px 이상, 패널은 틀', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss', 11);
  for (let i = 0; i < 5; i++) await answer(page, false);
  await page.waitForSelector('[data-scene="gameover"]');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '다시 도전');
  assert.equal(await page.locator('.end-panel.frame-panel').count(), 1);
  assert.equal(await page.locator('.end-title').evaluate((e) => parseFloat(getComputedStyle(e).fontSize)), 36);
  assert.equal(await page.getByRole('button', { name: '도감 다시 보기' }).evaluate((b) => b.classList.contains('btn-wood')), true);
  assert.equal(await page.getByRole('button', { name: '다시 도전' }).evaluate((b) => b.classList.contains('btn-green')), true);
  for (const name of ['도감 다시 보기', '다시 도전']) {
    const b = await page.getByRole('button', { name }).boundingBox();
    assert.ok(Math.round(b.height) >= 48 && Math.round(b.width) >= 48, `${name} ${b.width}x${b.height}`);
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('클리어: 낱말 카드 틀 + 단추 .btn-green(처음 초점)', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss');
  for (let i = 0; i < 6; i++) await answer(page, true);
  await page.waitForSelector('[data-scene="explore"] canvas');
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  assert.equal(await page.locator('.end-panel.frame-panel').count(), 1);
  assert.equal(await page.locator('.clear-card.frame-card').count(), 10);
  assert.equal(await page.locator('.clear-word').first().evaluate((e) => getComputedStyle(e).backgroundImage.includes('gradient')), true, '낱말에 금빛 띠');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('btn-green')), true);
  assert.deepEqual(errors, []);
  await page.close();
});

test('장 클리어: 낱말을 다 모아도 탐험에 남고, 출구로 걸어가면 1장 클리어! + 낱말 5장 → 다음 장으로 → 2장 첫 이야기 → 탐험(1-2)', async () => {
  const { page, errors } = await openNewGame();
  await page.evaluate(() => window.__test.acquire(['어스름', '아침나절', '매무새', '손사래', '오롯이'], '도담 할머니'));
  await page.evaluate(() => window.__test.patchState({ smallGone: { '1-1': true } }));
  await page.waitForSelector('[data-scene="explore"] canvas');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  await walkToExit(page, { smallMonsterGone: true });
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

test('막 보스: 이긴 뒤 출구로 걸어가 클리어 → 처음 화면 → 이어하기 → 보스 자리는 길이 되어 스페이스를 눌러도 전투는 없다', async () => {
  const { page, errors } = await openNewGame();
  await startBattle(page, 'boss');
  for (let i = 0; i < 6; i++) await answer(page, true);
  await page.waitForSelector('[data-scene="explore"] canvas');
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
  await page.reload(); // 세계 지도에서 닫았다가 다시 연다
  await page.waitForSelector('[data-scene="title"]');
  await startFromTitle(page, { name: '하늘', mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
  const s = await page.evaluate(() => window.__test.state());
  assert.equal(s.chapter, '1-2');
  assert.deepEqual(s.clearedActs, [1]);
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0, '이어 해도 저절로 클리어로 넘어가지 않는다');
  assert.equal(await page.locator('.hud-task').innerText(), ACT1.chapters[1].exit.goal);
  const map = parseMap(ACT1.chapters[1].map.rows);
  // 보스가 서 있던 칸 아래에서 위로 걸으면 그 칸으로 들어서진다(막지 않는다), 스페이스를 눌러도 싸우지 않는다
  const below = { x: map.boss.x, y: map.boss.y + 1 };
  for (const dir of pathTo(map, s.pos, below, { fogOpen: true, bossGone: true })) await page.keyboard.press(KEYS[dir]);
  await page.keyboard.press('ArrowUp');
  assert.deepEqual((await page.evaluate(() => window.__test.state())).pos, { x: map.boss.x, y: map.boss.y });
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.toast:not([hidden])').count(), 0);
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
