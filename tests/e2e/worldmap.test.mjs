// 세계 지도 화면 검사(1366×768, 1024×768): 막 클리어 → 세계 지도 → 떠나기 → 새 막 시작 글 → 탐험.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser } from './browser.mjs';
import { openGame, state, playDialogue, continueAs } from './play.mjs';
import { walkToExit, KEYS } from './helpers.mjs';
import { ACTS } from '../../data/acts/index.js';
import { WORLD } from '../../data/world.js';
import { actWords, exitOpen } from '../../js/rules/game.js';

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
const MISSING = '/assets/illust/missing_404.webp';

// 그 막 뒷 장에서 보스까지 이긴 상태(낱말을 다 얻고 막을 마침, 보스 뒤 장면은 이미 봄)로 세운다. 걷기만 남는다.
async function atActEnd(page, act = 1) {
  const ids = actWords(ACTS[act - 1]);
  await page.evaluate((a) => window.__test.goChapter(`${a}-2`), act);
  await page.evaluate(([a, words]) => window.__test.patchState((s) => ({
    clearedActs: Array.from({ length: a }, (_, i) => i + 1),
    seenScenes: a > 1 ? [...(s.seenScenes ?? []), `${a}-2:afterBoss`] : (s.seenScenes ?? []), // 1막에는 보스 뒤 장면이 없다
    acquired: { ...s.acquired, ...Object.fromEntries(words.map((w) => [w, { from: '검사' }])) },
  })), [act, ids]);
  await page.waitForSelector('[data-scene="explore"] canvas');
}

// 막 클리어 → "세계 지도로" 까지 간다.
async function toWorldMap(page) {
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
}

const focusedText = (page) => page.evaluate(() => document.activeElement?.textContent.trim());

test('1막 끝 → 세계 지도 → 떠나기 → 2막 시작 글 → 탐험 2-1', async () => {
  const { page, errors } = await openGame(browser, server);
  await atActEnd(page);
  await walkToExit(page);
  await page.waitForSelector('[data-scene="clear"]');
  const clearText = await page.locator('[data-scene="clear"]').innerText();
  assert.match(clearText, /1막 클리어!/);
  assert.doesNotMatch(clearText, /준비 중/);
  assert.equal(await focusedText(page), '세계 지도로');

  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
  assert.equal(await page.locator('[data-scene="worldmap"]').evaluate((e) => e.classList.contains('end-scene')), true);
  assert.equal(await page.locator('.world-title').innerText(), '2막 「너울장」');
  assert.equal(await page.locator('.world-travel').innerText(), '안개가 내려오는 북쪽, 북적이는 장터로');
  assert.equal(await focusedText(page), '떠나기');
  assert.equal(await page.locator('.world-place.mark-done').count(), 1);
  assert.equal(await page.locator('.world-place.mark-next').count(), 1);
  assert.equal(await page.locator('.world-place.mark-far').count(), 3);
  assert.equal(await page.locator('.world-place.mark-done').getAttribute('aria-label'), '새벽골 마침');
  assert.equal(await page.locator('.world-place.mark-next').getAttribute('aria-label'), '너울장 가는 곳');
  assert.deepEqual(
    await page.locator('.world-place.mark-far').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))),
    ['윤슬내 아직', '안개 고개 아직', '잿빛 탑 아직'],
  );
  assert.equal(await page.locator('.world-place.mark-done .icon-check').count(), 1, '마친 곳은 체크');
  assert.equal(await page.locator('.world-hero-initial').innerText(), '하');
  // 걷기가 끝나면 data-walked
  await page.waitForSelector('[data-scene="worldmap"][data-walked]');

  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.waitForFunction(() => document.querySelector('.dialogue-text')?.textContent.length > 4);
  assert.equal(await page.evaluate(() => window.__test.state().chapter), '2-1');
  await page.waitForFunction(() => document.querySelector('.dialogue-text')?.textContent.startsWith('하늘은 새벽골을 떠나 북쪽 장터 너울장에 닿았다.'));
  await playDialogue(page);
  const s = await state(page);
  assert.equal(s.act, 2);
  assert.equal(s.chapter, '2-1');
  assert.deepEqual(s.clearedActs, [1]);
  assert.equal(s.quests.q5.stage, 'open');
  assert.deepEqual(errors, []);
  await page.close();
});

test('떠나기를 두 번 빨리 누르거나 Enter를 꾹 눌러도 한 막만 넘어간다', async () => {
  for (const how of ['double', 'hold', 'sync']) {
    const { page, errors } = await openGame(browser, server);
    await atActEnd(page);
    await toWorldMap(page);
    if (how === 'double') await page.locator('.world-card .btn').dblclick();
    else if (how === 'hold') { for (let i = 0; i < 6; i++) await page.keyboard.down('Enter'); await page.keyboard.up('Enter'); }
    else await page.evaluate(() => { const b = document.querySelector('.world-card .btn'); b.click(); b.click(); b.click(); });
    await page.waitForSelector('[data-scene="dialogue"], [data-scene="explore"]');
    const s = await state(page);
    assert.equal(s.chapter, '2-1', how);
    assert.equal(s.act, 2, how);
    assert.deepEqual(s.clearedChapters.filter((c) => c === '1-2'), ['1-2'], how); // 기록이 두 번 쌓이지 않는다
    assert.deepEqual(errors, [], how);
    await page.close();
  }
});

test('세계 지도에서 새로 고침 → 이어하기: 1-2 출구가 열린 채 탐험 → 다시 출구 → 막 클리어 → 세계 지도 → 떠나기 → 2-1', async () => {
  const { page, errors } = await openGame(browser, server);
  await atActEnd(page);
  await toWorldMap(page);
  await page.reload();
  await continueAs(page, '하늘');
  let s = await state(page);
  assert.equal(s.chapter, '1-2');
  assert.equal(s.act, 1);
  assert.deepEqual(s.clearedActs, [1]);
  const exitIsOpen = await page.evaluate(async () => {
    const { exitOpen } = await import('/js/rules/game.js');
    const { actOfChapter } = await import('/data/acts/index.js');
    const st = window.__test.state();
    return exitOpen(st, actOfChapter(st.chapter).chapters.find((c) => c.id === st.chapter));
  });
  assert.equal(exitIsOpen, true);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-scene="clear"], [data-scene="worldmap"]').count(), 0, '저절로 넘어가지 않는다');

  // 출구 칸이 아니라 그 안쪽 한 칸에서 출구를 보고 선다: 비켜 섰다 다시 들어설 필요 없이 한 걸음이면 막 클리어
  const chapter = ACTS[0].chapters[1];
  assert.deepEqual(s.pos, { x: chapter.exit.x, y: chapter.exit.y + 1 });
  assert.equal(s.facing, chapter.exit.dir);
  await page.keyboard.press(KEYS[chapter.exit.dir]);
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
  await page.getByRole('button', { name: '떠나기' }).click();
  await playDialogue(page);
  s = await state(page);
  assert.equal(s.chapter, '2-1');
  assert.equal(s.act, 2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('움직임 줄이기: 세계 지도가 뜨자마자 data-walked, 주인공은 가는 곳에 서 있다', async () => {
  const { page, errors } = await openGame(browser, server, { reducedMotion: 'reduce' });
  await atActEnd(page);
  await toWorldMap(page);
  assert.equal(await page.locator('[data-scene="worldmap"][data-walked]').count(), 1);
  const to = WORLD.places[1];
  const left = await page.locator('.world-hero').evaluate((e) => e.style.left);
  assert.equal(parseFloat(left).toFixed(3), ((to.x / WORLD.size.w) * 100).toFixed(3));
  assert.equal(await page.locator('.mark-next .world-ring').evaluate((e) => getComputedStyle(e).animationName), 'none');
  assert.deepEqual(errors, []);
  await page.close();
});

test('걷기: 처음에는 마친 곳에 있다가 1.2초쯤 걸어 가는 곳에 닿고 data-walked가 붙는다', async () => {
  const { page, errors } = await openGame(browser, server);
  await atActEnd(page);
  await toWorldMap(page);
  assert.equal(await page.locator('[data-scene="worldmap"][data-walked]').count(), 0);
  const [from, to] = WORLD.places;
  const pct = (v, total) => ((v / total) * 100).toFixed(2);
  const heroAt = () => page.locator('.world-hero').evaluate((e) => ({ x: e.getBoundingClientRect().x, y: e.getBoundingClientRect().y }));
  const place = (n) => page.locator('.world-place').nth(n).evaluate((e) => { const r = e.querySelector('.world-ring').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const start = await heroAt();
  const p0 = await place(0);
  assert.ok(Math.abs(start.x - p0.x) < 3 && Math.abs(start.y - p0.y) < 3, `처음은 새벽골: ${JSON.stringify(start)} ${JSON.stringify(p0)}`);
  await page.waitForSelector('[data-scene="worldmap"][data-walked]');
  const end = await heroAt();
  const p1 = await place(1);
  assert.ok(Math.abs(end.x - p1.x) < 3 && Math.abs(end.y - p1.y) < 3, `끝은 너울장: ${JSON.stringify(end)} ${JSON.stringify(p1)}`);
  assert.equal(pct(to.x, WORLD.size.w), parseFloat(await page.locator('.world-hero').evaluate((e) => e.style.left)).toFixed(2));
  assert.notEqual(pct(from.x, WORLD.size.w), pct(to.x, WORLD.size.w));
  assert.deepEqual(errors, []);
  await page.close();
});

test('3막을 마치면 4막 「안개 고개」로: 표시 done 3 · next 1 · far 1, 여섯 글자 닉네임', async () => {
  const { page, errors } = await openGame(browser, server, { name: '가나다라마바' });
  await atActEnd(page, 3);
  await toWorldMap(page);
  assert.equal(await page.locator('.world-title').innerText(), '4막 「안개 고개」');
  assert.equal(await page.locator('.world-travel').innerText(), '나래의 길잡이를 따라 안개 낀 고개로');
  assert.equal(await page.locator('.world-place.mark-done').count(), 3);
  assert.equal(await page.locator('.world-place.mark-next').count(), 1);
  assert.equal(await page.locator('.world-place.mark-far').count(), 1);
  assert.equal(await page.locator('.world-hero-initial').innerText(), '가');
  await page.getByRole('button', { name: '떠나기' }).click();
  await playDialogue(page);
  assert.equal((await state(page)).chapter, '4-1');
  assert.deepEqual(errors, []);
  await page.close();
});

for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
  test(`배치 ${size.width}×${size.height}: 지도와 카드가 겹치지 않고 모두 화면 안, 곳 이름이 지도 안`, async () => {
    const { page, errors } = await openGame(browser, server, { size });
    await atActEnd(page);
    await toWorldMap(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.effect.getComputedTiming().iterations === Infinity || a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
    const m = await page.evaluate(() => {
      const box = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const map = box('.world-map');
      const names = [...document.querySelectorAll('.world-name, .world-ring')].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
      return { map, frame: box('.world-frame'), card: box('.world-card'), btn: box('.world-card .btn'), names, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, scrollable: document.querySelector('[data-scene="worldmap"]').scrollHeight > document.querySelector('[data-scene="worldmap"]').clientHeight };
    });
    assert.ok(m.frame.b <= m.card.t, `지도 틀(${m.frame.b})이 카드(${m.card.t}) 위에 있다`);
    assert.ok(m.frame.t >= 0 && m.card.b <= m.vh, '세로로 화면 안');
    assert.ok(m.frame.l >= 0 && m.frame.r <= m.vw && m.card.l >= 0 && m.card.r <= m.vw, '가로로 화면 안');
    assert.equal(m.sw, m.vw, '가로로 넘치지 않는다');
    assert.equal(m.scrollable, false, '세로로 넘치지 않는다');
    for (const n of m.names) assert.ok(n.l >= m.map.l && n.r <= m.map.r && n.t >= m.map.t && n.b <= m.map.b, `이름·고리가 지도 안: ${JSON.stringify(n)} ${JSON.stringify(m.map)}`);
    assert.ok(m.btn.r - m.btn.l >= 48 && m.btn.b - m.btn.t >= 48);
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('지도 그림(ASSETS.worldmap)이 있으면 그림을 깐다, 없는 주소면 오류 없이 바탕색만(임시 그림 없음)', async () => {
  const { page, errors } = await openGame(browser, server);
  await atActEnd(page);
  assert.equal(await page.evaluate((u) => window.__test.setAsset('worldmap', u), MISSING), false);
  await toWorldMap(page);
  assert.equal(await page.locator('.world-map.has-art').count(), 0);
  assert.equal(await page.locator('.world-map svg:not(.world-roads)').count(), 0, '임시 그림(SVG)은 없다');
  assert.notEqual(await page.locator('.world-map').evaluate((e) => getComputedStyle(e).backgroundImage), 'none', '바탕색은 남는다');
  assert.equal(await page.locator('.world-place').count(), 5);

  assert.equal(await page.evaluate((u) => window.__test.setAsset('worldmap', u), FIXTURE), true);
  await page.evaluate(() => window.__test.patchState({})); // 탐험으로 돌아가 다시 지도를 연다
  await toWorldMapAgain(page);
  await page.waitForSelector('.world-map.has-art .world-map-img');
  assert.equal(await page.locator('.world-map').evaluate((e) => getComputedStyle(e).backgroundImage), 'none');
  assert.equal(await page.locator('.world-place').count(), 5, '표시는 그림 위에도 있다');
  await page.evaluate(() => window.__test.setAsset('worldmap', null));
  assert.deepEqual(errors.filter((e) => !e.includes('missing_404')), []);
  await page.close();
});

for (const avatar of ['m', 'f']) {
  test(`세계 지도의 주인공은 고른 모습(${avatar})의 걷기 도트다`, async () => {
    const { page, errors } = await openGame(browser, server, { avatar });
    await atActEnd(page);
    await toWorldMap(page);
    await page.waitForSelector('.world-hero.has-art img.world-hero-art');
    const src = await page.locator('.world-hero.has-art img.world-hero-art').getAttribute('src');
    assert.match(src, new RegExp(`walk_hero_${avatar}\\.png`));
    assert.doesNotMatch(src, new RegExp(`walk_hero_${avatar === 'm' ? 'f' : 'm'}`));
    assert.equal(await page.locator('.world-hero-pin').isVisible(), false, '그림이 있으면 핀은 숨는다');
    assert.deepEqual(errors, []);
    await page.close();
  });
}

async function toWorldMapAgain(page) {
  await walkToExit(page); // 출구에 들어서며 저장된 자리는 출구 안쪽 한 칸이다
  await page.waitForSelector('[data-scene="clear"]');
  await page.getByRole('button', { name: '세계 지도로' }).click();
  await page.waitForSelector('[data-scene="worldmap"]');
}
