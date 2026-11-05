import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, startFromTitle } from './browser.mjs';
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

const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// 가장 짧은 길을 방향 목록으로 찾는다.
function pathTo(map, from, to) {
  const prev = new Map([[`${from.x},${from.y}`, null]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift();
    if (p.x === to.x && p.y === to.y) break;
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      const n = { x: p.x + dx, y: p.y + dy };
      const k = `${n.x},${n.y}`;
      if (!prev.has(k) && isWalkable(map, n.x, n.y)) {
        prev.set(k, { from: p, dir });
        queue.push(n);
      }
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

async function openGame(query = '?test=1') {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/' + query);
  return { page, errors };
}

test('새 게임을 열면 1366×768에서 캔버스가 화면을 꽉 채우고 HUD에 낱말 수와 첫 부탁이 보인다', async () => {
  const { page, errors } = await openGame();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  const box = await page.locator('[data-scene="explore"] canvas').boundingBox();
  assert.equal(box.width, 1366);
  assert.equal(box.height, 768);
  const hud = page.locator('[data-scene="explore"] .hud');
  assert.match(await hud.innerText(), /이 장의 낱말 0\/5/);
  assert.match(await hud.innerText(), /도담 할머니에게 말을 걸어 보자/);
  // 처음 하는 학생 안내는 움직이면 사라진다.
  const tip = page.locator('.hint[data-tip="move"]');
  assert.match(await tip.innerText(), /방향키로 걸어 보세요/);
  await page.keyboard.press('ArrowRight');
  await tip.waitFor({ state: 'detached' });
  const s = await page.evaluate(() => window.__test.state());
  assert.deepEqual(s.pos, { x: 6, y: 19 });
  assert.equal(s.facing, 'right');
  assert.ok(s.seenTips.includes('move'));
  // acquire는 HUD를 새로 그린다.
  await page.evaluate(() => window.__test.acquire(['어스름'], '도담 할머니'));
  await page.waitForFunction(() => document.querySelector('.hud').innerText.includes('이 장의 낱말 1/5'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('캔버스는 창을 꽉 채운다: 1366×768에선 1:1 또렷하게, 1024×768에선 1152×864 안쪽을 줄여 부드럽게', async () => {
  const look = async (width, height) => {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = collectErrors(page);
    await page.goto(server.url + '/?test=1');
    await page.waitForFunction(() => window.__test);
    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await page.waitForSelector('[data-scene="explore"] canvas');
    const r = await page.evaluate(() => {
      const c = document.querySelector('[data-scene="explore"] canvas');
      const b = c.getBoundingClientRect();
      return { w: c.width, h: c.height, cssW: b.width, cssH: b.height, rendering: c.style.imageRendering };
    });
    assert.deepEqual(errors, []);
    await page.close();
    return r;
  };
  assert.deepEqual(await look(1366, 768), { w: 1366, h: 768, cssW: 1366, cssH: 768, rendering: 'pixelated' });
  assert.deepEqual(await look(1024, 768), { w: 1152, h: 864, cssW: 1024, cssH: 768, rendering: 'auto' });
});

// 주인공 칸 위끝의 화면 y(CSS px)와 가로 스크롤 여부 등 "꽉 참" 검사에 쓰는 값
const fitProbe = (page) => page.evaluate(() => {
  const c = document.querySelector('[data-scene="explore"] canvas');
  const b = c.getBoundingClientRect();
  const v = window.__test.view;
  const h = window.__test.heroAt;
  return {
    cssW: b.width, cssH: b.height, innerW: innerWidth, innerH: innerHeight,
    scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
    heroTop: (h.y * 16 - v.camera.y) * 3 * v.factor, // 주인공 칸 위끝
    heroBottom: (h.y * 16 + 16 - v.camera.y) * 3 * v.factor,
  };
});

async function expectFilled(page, label) {
  // 크기를 바꾼 뒤 다시 그려져 __test.view가 새 크기가 될 때까지 기다린다
  await page.waitForFunction(() => {
    const v = window.__test.view;
    const c = document.querySelector('[data-scene="explore"] canvas');
    return v && Math.abs(c.getBoundingClientRect().width - innerWidth) < 1 && Math.abs(v.viewW * 3 * v.factor - innerWidth) < 3;
  });
  const p = await fitProbe(page);
  assert.equal(p.cssW, p.innerW, `${label}: 캔버스 폭`);
  assert.equal(p.cssH, p.innerH, `${label}: 캔버스 높이`);
  assert.ok(p.scrollW <= p.innerW, `${label}: 가로 스크롤이 생겼다 ${p.scrollW}>${p.innerW}`);
  assert.ok(p.scrollH <= p.innerH, `${label}: 세로 스크롤이 생겼다`);
  assert.ok(p.heroTop >= 88 - 1e-6, `${label}: 주인공이 HUD 밑에 있다(위끝 ${p.heroTop})`);
  assert.ok(p.heroBottom <= p.innerH, `${label}: 주인공이 화면 아래로 나갔다`);
}

test('창 크기: 1366×768 → 1280×800 → 1366×650 → 1024×768로 바꿔도 캔버스가 화면을 꽉 채우고 주인공이 HUD 밑에 숨지 않는다', async () => {
  const { page, errors } = await openGame();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  await page.waitForFunction(() => window.__test.view);
  for (const [w, h] of [[1366, 768], [1280, 800], [1366, 650], [1024, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    await expectFilled(page, `${w}×${h}`);
    // 맵 위쪽(도담 할머니 집 앞)으로 옮겨도 같다
    await page.evaluate(() => window.__test.teleportTo('dodam'));
    await page.waitForSelector('[data-scene="explore"] canvas');
    await page.waitForFunction(() => window.__test.view);
    await expectFilled(page, `${w}×${h} 도담 앞`);
    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await page.waitForFunction(() => window.__test.view);
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('HUD 겹침: 1024×768, 닉네임 6글자, 1-2장 긴 할 일에서도 두루마리와 낱말 상자가 겹치지 않고 단추는 72×80', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('가나다라마바', 'f'));
  await page.evaluate(() => window.__test.nextChapter());
  await page.waitForSelector('[data-scene="explore"] canvas');
  await page.waitForFunction(() => document.querySelector('.hud-task').innerText.includes('빵집 아저씨에게 말을 걸어 보자'));
  const measure = () => page.evaluate(() => {
    const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const t = document.querySelector('.hud-task-text');
    return {
      task: r('.hud-task'), words: r('.hud-words'), medal: r('.hud-medallion'), codex: r('.hud-button:nth-of-type(1)'),
      tasks: r('.hud-button:nth-of-type(2)'), clipped: t.scrollWidth > t.clientWidth,
      hudH: document.querySelector('.hud').getBoundingClientRect().height, innerW: innerWidth,
    };
  });
  let boxes = await measure();
  assert.ok(boxes.task.r <= boxes.words.l - 4, `두루마리(오른쪽 ${boxes.task.r})와 낱말 상자(왼쪽 ${boxes.words.l})가 겹친다`);
  assert.ok(boxes.words.r <= boxes.codex.l, '낱말 상자와 도감 단추가 겹친다');
  assert.ok(boxes.codex.r <= boxes.tasks.l, '도감과 할 일 단추가 겹친다');
  assert.ok(boxes.tasks.r <= boxes.innerW - 12 + 1e-6, '할 일 단추가 오른쪽 여백을 넘는다');
  for (const k of ['codex', 'tasks']) {
    assert.equal(boxes[k].w, 72, `${k} 폭`);
    assert.equal(boxes[k].h, 80, `${k} 높이`);
  }
  assert.equal(boxes.hudH, 88);
  assert.ok(boxes.words.b <= 88 && boxes.task.b <= 88 && boxes.codex.b <= 88, "상자는 위 88px 안");
  assert.equal(boxes.medal.b, 104, "메달은 (12,8)에서 지름 96");
  assert.equal(boxes.clipped, false, '이 길이의 할 일은 말줄임 없이 다 보여야 한다');
  // 가장 긴 글(모으기 + 개수)도 말줄임 없이 보인다
  await page.evaluate(() => window.__test.teleportTo('baker'));
  await page.keyboard.press('Space');
  await finishDialogue(page);
  await page.waitForFunction(() => document.querySelector('.hud-task').innerText.includes('마른 나무에서 장작을 모으자 (0/3)'));
  boxes = await measure();
  assert.equal(boxes.clipped, false, '장작 모으기 글이 잘린다');
  assert.ok(boxes.task.r <= boxes.words.l - 4, '긴 글에서 두루마리와 낱말 상자가 겹친다');
  assert.deepEqual(errors, []);
  await page.close();
});

test('할머니에게 걸어가 말을 걸면 대화 장면으로 가고, 저장된다', async () => {
  const { page, errors } = await openGame();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  const map = parseMap(ACT1.chapters[0].map.rows);
  const below = { x: map.slots.a.x, y: map.slots.a.y + 1 };
  for (const dir of pathTo(map, map.start, below)) await page.keyboard.press(KEYS[dir]);
  await page.keyboard.press('ArrowUp'); // 할머니를 바라본다(막혀서 제자리)
  let s = await page.evaluate(() => window.__test.state());
  assert.deepEqual(s.pos, below);
  assert.equal(s.facing, 'up');
  await page.keyboard.press('Space');
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.match(await page.locator('[data-scene="dialogue"]').innerText(), /도담 할머니/);
  s = await page.evaluate(() => window.__test.state());
  assert.equal(s.quests.q1.stage, 'active');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('malbit:save:하늘')));
  assert.equal(saved.quests.q1.stage, 'active');
  assert.deepEqual(saved.pos, below);
  await finishDialogue(page);
  assert.deepEqual(errors, []);
  await page.close();
});

test('앞 장의 낱말 5개를 다 얻어도 장 클리어로 저절로 넘어가지 않고 그 자리에 남는다(출구는 exit.test)', async () => {
  const { page, errors } = await openGame();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.evaluate(() => window.__test.acquire(['어스름', '아침나절', '매무새', '손사래', '오롯이'], '도담 할머니'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('[data-scene="clear"]').count(), 0);
  assert.equal(await page.locator('[data-scene="explore"]').count(), 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test('?test=1이 없으면 __test가 없다', async () => {
  const { page, errors } = await openGame('');
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await page.evaluate(() => typeof window.__test), 'undefined');
  await startFromTitle(page, { name: '하늘' });
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  await page.waitForSelector('[data-scene="explore"] canvas');
  assert.deepEqual(errors, []);
  await page.close();
});

test('탐험 캔버스는 바뀐 것이 없으면 다시 그리지 않고, 겹침 창이 열린 동안에도 그리지 않는다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    window.__fills = 0;
    const orig = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (...a) { window.__fills++; return orig.apply(this, a); };
  });
  // 느린 CI처럼 그림이 늦게 와도 흔들리지 않도록 그림 응답을 늦춘다
  await page.route(/\/assets\/.*\.(png|webp)$/, async (r) => { await new Promise((ok) => setTimeout(ok, 300)); r.continue(); });
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  const fills = () => page.evaluate(() => window.__fills);
  // 그림과 글꼴이 다 와서 한 번 더 그린 뒤를 기준으로 삼는다
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))));
  await page.waitForTimeout(200);
  // 처음 자리: 화면 안에 움직이는 그림이 없다
  let n = await fills();
  assert.ok(n > 0, '한 번은 그렸다');
  const since = await page.evaluate(() => (window.__test.draws ?? []).length);
  await page.waitForTimeout(500);
  const extra = await page.evaluate((k) => (window.__test.draws ?? []).slice(k), since);
  assert.equal(await fills(), n, `바뀐 것이 없는데 다시 그렸다: ${JSON.stringify(extra)}`);
  // 걸으면 다시 그린다
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((k) => window.__fills > k, n);
  // 겹침 창이 열린 동안은 그리지 않는다
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.codex');
  await page.waitForTimeout(100);
  n = await fills();
  await page.waitForTimeout(400);
  assert.equal(await fills(), n);
  assert.deepEqual(errors, []);
  await page.close();
});

test('걸음 한 번은 두 칸 사이를 미끄러져 지나가고, 끝나면 칸에 선다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const start = await page.evaluate(() => window.__test.state().pos);
  // 걸음 하나 동안 매 프레임 그려진 주인공 자리를 모은다
  await page.evaluate(() => {
    window.__seen = [];
    const tick = () => { const h = window.__test.heroAt; if (h) window.__seen.push({ x: h.x, y: h.y }); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  const pos = await page.evaluate(() => window.__test.state().pos);
  assert.equal(pos.x, start.x + 1, '규칙의 자리는 바로 한 칸 옮겨진다');
  const seen = await page.evaluate(() => window.__seen);
  assert.ok(seen.some((p) => p.x > start.x && p.x < start.x + 1), `칸 사이에 그려진 프레임이 없다: ${JSON.stringify(seen.slice(0, 12))}`);
  const last = seen[seen.length - 1];
  assert.deepEqual(last, { x: start.x + 1, y: start.y }, '끝나면 칸에 선다');
  // 칸 사이 자리는 그림 픽셀(칸의 1/48)에 맞는다
  for (const p of seen) assert.ok(Math.abs(p.x * 48 - Math.round(p.x * 48)) < 1e-9);
  assert.deepEqual(errors, []);
  await page.close();
});

// 달리기: 걸음마다 남긴 때(__test.steps, 페이지 안 performance.now)로 같은 거리(6칸)를 가는 시간을 견준다.
// 바쁜 기계에서는 타이머가 조금씩 늦게 오므로 정확한 ms가 아니라 걷기/달리기 비율(약 1.5)을 넓게 본다.
async function timeRow(page, { shift }) {
  const from = { x: 3, y: 9 }; // 1-1 9줄: x 2~29가 막힘 없이 트인 길
  const N = 6;
  await page.evaluate((pos) => window.__test.patchState({ pos, facing: 'right' }), from);
  await page.waitForFunction((x) => window.__test.heroAt?.x === x, from.x);
  await page.evaluate(() => { window.__test.steps = []; });
  if (shift) await page.keyboard.down('Shift');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((x) => window.__test.state().pos.x >= x, from.x + N);
  await page.keyboard.up('ArrowRight');
  if (shift) await page.keyboard.up('Shift');
  const steps = (await page.evaluate(() => window.__test.steps)).slice(0, N);
  assert.equal(steps.length, N);
  return { ms: steps.map((s) => s.ms), took: steps[N - 1].t - steps[0].t };
}

test('달리기: Shift를 누르고 있으면 같은 거리를 약 1.5배 빨리 가고, 떼면 다시 걷는다', async (t) => {
  const { page, errors } = await openGame();
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"] canvas');
  assert.equal(await page.locator('.touch-run').count(), 0, '마우스 기기에는 달리기 버튼이 없다');
  const walk = await timeRow(page, { shift: false });
  const run = await timeRow(page, { shift: true });
  assert.deepEqual(walk.ms, Array(6).fill(250), '걷기: 한 칸 250ms');
  assert.deepEqual(run.ms, Array(6).fill(167), '달리기: 한 칸 167ms');
  const ratio = walk.took / run.took;
  t.diagnostic(`6칸: 걷기 ${Math.round(walk.took)}ms, 달리기 ${Math.round(run.took)}ms, 비율 ${ratio.toFixed(2)}`);
  assert.ok(ratio > 1.3 && ratio < 1.75, `6칸 걷기 ${Math.round(walk.took)}ms / 달리기 ${Math.round(run.took)}ms = ${ratio.toFixed(2)}`);
  assert.equal(await page.evaluate(() => window.__test.running()), false, 'Shift를 떼면 달리기가 풀린다');
  const again = await timeRow(page, { shift: false });
  assert.deepEqual(again.ms, Array(6).fill(250), '다시 걷기');
  assert.deepEqual(errors, []);
  await page.close();
});
