import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors } from './browser.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

async function start() {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.evaluate(() => window.__test.acquire(['어스름'], '도담 할머니'));
  await page.waitForSelector('[data-scene="explore"]');
  return { page, errors };
}

test('도감: 1막 탭에 어스름 카드 1장과 ? 9칸, 닫기와 초점', async () => {
  const { page, errors } = await start();
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  assert.equal(await page.locator('.codex-tab').count(), 5);
  assert.equal(await page.locator('.codex-card.found').count(), 1);
  assert.equal(await page.locator('.codex-card.unknown').count(), 9);
  assert.match(await page.locator('.codex-card.found').innerText(), /어스름/);
  const detail = await page.locator('.codex-detail').innerText();
  assert.match(detail, /해 뜨기 전이나 해 진 뒤의 조금 어둑한 때/);
  assert.match(detail, /새벽 어스름에 닭이 울었다\./);
  assert.match(detail, /만난 곳: 도담 할머니/);
  assert.match(await page.locator('.codex-card.unknown').first().innerText(), /\?[\s\S]*아직 못 찾음/);
  await page.locator('.codex-tab', { hasText: '3막' }).click();
  assert.equal(await page.locator('.codex-card.unknown').count(), 10);
  // 걷기가 멈춘다
  const pos = await page.evaluate(() => JSON.stringify(window.__test.state().pos));
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__test.state().pos)), pos);
  // Q는 도감을 닫고 할 일을 연다
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('.tasks');
  assert.equal(await page.locator('.codex').count(), 0);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.tasks').count(), 0);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  await page.keyboard.press('KeyE');
  assert.equal(await page.locator('.codex').count(), 0);
  // 단추로 열고 닫아도 초점은 HUD 단추로 돌아가지 않는다(Space·Enter가 말하기로 쓰이도록)
  await page.locator('.hud-button', { hasText: '도감' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.codex');
  await page.locator('.codex-close').click();
  assert.equal(await page.locator('.codex').count(), 0);
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('.hud')), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('할 일: 받기 전 / ? / 숨은 낱말 못 찾음', async () => {
  const { page, errors } = await start();
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('.tasks');
  const rows = await page.locator('.task-row').allInnerTexts();
  assert.match(rows[0], /우물에서 물 길어 오기[\s\S]*받기 전/);
  assert.match(rows[1], /\?/);
  assert.match(await page.locator('.tasks').innerText(), /숨은 낱말: 못 찾음/);
  assert.doesNotMatch(await page.locator('.tasks').innerText(), /그림자를 물리쳐라/);
  await page.locator('.tasks-close').click();
  assert.equal(await page.locator('.tasks').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('할 일: 모든 단계 이름, 완료 체크, 찾음, 그림자 줄(1-2에만)', async () => {
  const { page, errors } = await start();
  const texts = await page.evaluate(async () => {
    const { openTasks } = await import('/js/scenes/quests.js');
    const { ACTS } = await import('/data/acts/index.js');
    const [c1, c2] = ACTS[0].chapters;
    const mk = (chapter, stages, found) => {
      const quests = {};
      chapter.quests.forEach((q, i) => { quests[q.id] = { stage: stages[i], gathered: [] }; });
      return { quests, hiddenFound: found ? { [chapter.id]: true } : {}, clearedActs: [] };
    };
    const out = [];
    const run = (chapter, st) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const close = openTasks(host, st, chapter);
      out.push({
        text: host.innerText,
        checks: host.querySelectorAll('.task-row.done .task-check').length,
      });
      close();
      host.remove();
    };
    run(c1, mk(c1, ['active', 'ready'], false));
    run(c1, mk(c1, ['done', 'done'], true));
    run(c2, mk(c2, ['locked', 'locked'], false));
    run(c2, { ...mk(c2, ['done', 'done'], true), clearedActs: [1] });
    return out;
  });
  assert.match(texts[0].text, /하는 중/);
  assert.match(texts[0].text, /돌아가서 알리기/);
  assert.match(texts[1].text, /완료/);
  assert.equal(texts[1].checks, 2);
  assert.match(texts[1].text, /숨은 낱말: 찾음/);
  assert.doesNotMatch(texts[1].text, /그림자를 물리쳐라/);
  assert.match(texts[2].text, /그림자를 물리쳐라/);
  assert.match(texts[3].text, /1막을 마쳤어요/);
  assert.doesNotMatch(texts[3].text, /그림자를 물리쳐라/);
  assert.equal(texts[3].checks, 3);
  assert.deepEqual(errors, []);
  await page.close();
});

test('도감: 칸을 고르면 상세, 단추 크기 48px 이상', async () => {
  const { page } = await start();
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  assert.match(await page.locator('.codex-detail').innerText(), /어스름[\s\S]*해 뜨기 전[\s\S]*만난 곳: 도담 할머니/);
  await page.locator('.codex-card.unknown').first().click();
  assert.match(await page.locator('.codex-detail').innerText(), /아직 못 찾은 낱말이에요\./);
  for (const sel of ['.codex-tab', '.codex-close']) {
    for (const b of await page.locator(sel).all()) { const h = (await b.boundingBox()).height; assert.ok(Math.round(h) >= 48, `${sel} ${h}`); } // 열리는 애니메이션의 소수점 위치 때문에 47.99998처럼 나올 수 있다
  }
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.codex-grid')).gridTemplateColumns.split(' ').length), 5);
  await page.screenshot({ path: '.superpowers/sdd/2026-11-04-act1-playable/task-13-codex.png' });
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('.tasks');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.superpowers/sdd/2026-11-04-act1-playable/task-13-tasks.png' });
  await page.close();
});

test('겹침 창이 열려 있으면 Space로 말을 걸지 않는다', async () => {
  const { page } = await start();
  await page.evaluate(async () => {
    const { parseMap } = await import('/js/explore/grid.js');
    const { ACTS } = await import('/data/acts/index.js');
    const s = window.__test.state();
    const p = parseMap(ACTS[0].chapters[0].map.rows).slots.a;
    s.pos = { x: p.x, y: p.y + 1 };
    s.facing = 'up';
  });
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('.tasks');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-scene="dialogue"]').count(), 0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Space');
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.close();
});

for (const [label, sel, closeSel] of [['도감', '.codex', '.codex-close'], ['할 일', '.tasks', '.tasks-close']]) {
  test(`HUD ${label} 단추를 마우스로 눌러 열고 닫은 뒤 Space는 말 걸기다`, async () => {
    const { page, errors } = await start();
    await page.evaluate(() => window.__test.teleportTo('dodam'));
    await page.waitForSelector('[data-scene="explore"]');
    await page.locator('.hud-button', { hasText: label }).click();
    await page.waitForSelector(sel);
    await page.locator(closeSel).click();
    assert.equal(await page.locator(sel).count(), 0);
    await page.keyboard.press('Space');
    await page.waitForSelector('[data-scene="dialogue"]');
    assert.equal(await page.locator(sel).count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('도감·할 일: 누르는 것은 모두 48px 이상, 찾은 칸 글자 18px 이상, 완료 줄에 글자와 체크', async () => {
  const { page, errors } = await start();
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  await page.waitForTimeout(300);
  const small = await page.evaluate(() => [...document.querySelectorAll('.codex button, .codex .codex-card')]
    .map((b) => { const r = b.getBoundingClientRect(); return [b.className, Math.round(r.width), Math.round(r.height)]; })
    .filter(([, w, h]) => w < 48 || h < 48));
  assert.deepEqual(small, []);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.codex-card *')]
    .filter((n) => n.textContent.trim()).map((n) => parseFloat(getComputedStyle(n).fontSize)));
  assert.ok(sizes.length > 0 && sizes.every((n) => n >= 18), `칸 글자 ${sizes}`);
  const found = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.codex-card.found .codex-word')).fontSize));
  assert.equal(found, 24);
  assert.equal(await page.locator('.codex-card.unknown .coin').count(), 9);
  assert.equal(await page.locator('.codex-tab.on').count(), 1);
  assert.equal(await page.locator('.codex-card.selected').count(), 1);
  assert.equal(await page.locator('.codex-detail.frame-plate').count(), 1);
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('.tasks');
  await page.waitForTimeout(300);
  const small2 = await page.evaluate(() => [...document.querySelectorAll('.tasks button, .tasks .task-row')]
    .map((b) => { const r = b.getBoundingClientRect(); return [b.className, Math.round(r.height)]; }).filter(([, h]) => h < 48));
  assert.deepEqual(small2, []);
  await page.close();
  const p2 = await start();
  const done = await p2.page.evaluate(async () => {
    const { openTasks } = await import('/js/scenes/quests.js');
    const { ACTS } = await import('/data/acts/index.js');
    const c1 = ACTS[0].chapters[0];
    const quests = {};
    c1.quests.forEach((q) => { quests[q.id] = { stage: 'done', gathered: [] }; });
    const host = document.createElement('div');
    document.body.appendChild(host);
    openTasks(host, { quests, hiddenFound: {}, clearedActs: [] }, c1);
    const row = host.querySelector('.task-row.done');
    return { text: row.innerText, icon: !!row.querySelector('.icon-check'), plate: row.classList.contains('frame-plate'), h: row.getBoundingClientRect().height };
  });
  assert.match(done.text, /완료/);
  assert.ok(done.icon && done.plate && done.h >= 48);
  assert.deepEqual(p2.errors, []);
  await p2.page.close();
  assert.deepEqual(errors, []);
});
