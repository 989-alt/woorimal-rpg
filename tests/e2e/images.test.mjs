import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors } from './browser.mjs';
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

const FIXTURE = '/tests/fixtures/sprite-16x32.png'; // 16×32 단색 (18,171,52)
const FIXTURE_RGB = [18, 171, 52];
const MISSING = '/assets/pixel/missing_404.png';
const DODAM_RGB = [0x8E, 0x4A, 0x7A]; // 도담 할머니 임시 블록 색

async function openNewGame(avatar = 'f') {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate((a) => window.__test.newGame('하늘', a), avatar);
  await page.waitForSelector('[data-scene="explore"]');
  return { page, errors };
}

// 일부러 없앤 그림 주소의 읽기 실패(브라우저가 콘솔에 남기는 404 한 줄)만 빼고 오류가 없어야 한다.
const unexpected = (errors) => errors.filter((e) => !e.includes('missing_404'));

// 탐험 캔버스에서 월드 좌표(도트) 한 점의 색. 도트 한 칸 = 캔버스 scale 픽셀.
// who: 'dodam' 도담 할머니 칸, 'hero' 주인공 칸, 'left' 주인공 왼쪽 칸 — 각각 칸 왼쪽 위에서 (3,3).
const sample = (page, who) => page.evaluate(async (w) => {
  const { cameraFor, TILE } = await import('/js/explore/render.js');
  const { parseMap } = await import('/js/explore/grid.js');
  const { actOfChapter } = await import('/data/acts/index.js');
  const s = window.__test.state();
  const chapter = actOfChapter(s.chapter).chapters.find((c) => c.id === s.chapter);
  const map = parseMap(chapter.map.rows);
  const p = w === 'dodam' ? map.slots[chapter.npcs.find((n) => n.id === 'dodam').slot]
    : w === 'hero' ? s.pos : { x: s.pos.x - 1, y: s.pos.y };
  const cam = cameraFor(map, s.pos);
  const canvas = document.querySelector('[data-scene="explore"] canvas');
  const scale = canvas.width / 384;
  const x = Math.round((p.x * TILE + 3 - Math.round(cam.x)) * scale + scale / 2);
  const y = Math.round((p.y * TILE + 3 - Math.round(cam.y)) * scale + scale / 2);
  return [...canvas.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3);
}, who);

// 다시 그려져 그 색이 될 때까지 기다린다(그림은 불러온 뒤 다음 화면 갱신에서 그려진다).
async function expectColor(page, who, want) {
  for (let i = 0; i < 100; i++) {
    const got = await sample(page, who);
    if (got.every((v, k) => v === want[k])) return;
    await page.waitForTimeout(50);
  }
  assert.deepEqual(await sample(page, who), want);
}

test('탐험: 도담 그림이 있으면 그림을, 없는 주소면 오류 없이 임시 블록을 그린다', async () => {
  const { page, errors } = await openNewGame();
  await page.evaluate(() => window.__test.teleportTo('dodam')); // 도담 할머니가 화면 안에 오게
  await page.waitForSelector('[data-scene="explore"] canvas');
  await expectColor(page, 'dodam', DODAM_RGB); // 처음엔 그림 경로가 null → 임시 블록
  // 그림을 끼우면 불러온 뒤 다시 그려져 그림 색이 나온다
  assert.equal(await page.evaluate((u) => window.__test.setAsset('npcs.dodam', u), FIXTURE), true);
  await expectColor(page, 'dodam', FIXTURE_RGB);
  // 없는 주소로 바꾸면 임시 블록으로 돌아온다
  assert.equal(await page.evaluate((u) => window.__test.setAsset('npcs.dodam', u), MISSING), false);
  await expectColor(page, 'dodam', DODAM_RGB);
  assert.deepEqual(unexpected(errors), []);
  await page.close();
});

test('탐험: 주인공 걷기 시트가 있으면 시트 그림으로 그린다', async () => {
  const { page, errors } = await openNewGame();
  // 없는 주소면 임시 블록(쪽빛)
  assert.equal(await page.evaluate((u) => window.__test.setAsset('walk.f', u), MISSING), false);
  await expectColor(page, 'hero', [0x3B, 0x5B, 0xA5]);
  assert.equal(await page.evaluate((u) => window.__test.setAsset('walk.f', u), FIXTURE), true);
  await expectColor(page, 'hero', FIXTURE_RGB);
  assert.deepEqual(unexpected(errors), []);
  await page.close();
});

test('탐험: 맵 그림이 있으면 길·벽 타일 색 대신 맵 그림을 깐다, 없는 주소면 타일 색으로 돌아온다', async () => {
  const { page, errors } = await openNewGame();
  const PATH_RGB = [0xD9, 0xA5, 0x5B];
  // 1-1에는 실제 맵 그림이 있다: 시작 칸 왼쪽 점은 맵 그림의 같은 자리 색(그림은 512×384 세계 상자에 맞춰 그린다)
  const artRgb = await page.evaluate(async () => {
    const { ASSETS } = await import('/data/assets.js');
    const s = window.__test.state();
    const img = new Image();
    img.src = '/' + ASSETS.maps['1-1'];
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const k = img.width / 512;
    const x = Math.floor(((s.pos.x - 1) * 16 + 3.5) * k), y = Math.floor((s.pos.y * 16 + 3.5) * k);
    return [...g.getImageData(x, y, 1, 1).data].slice(0, 3);
  });
  assert.notDeepEqual(artRgb, PATH_RGB);
  await expectColor(page, 'left', artRgb);
  // 맵 그림은 크기와 상관없이 세계 상자 전체에 늘려 그리므로 16×32 시험 그림 한 색으로 덮인다
  assert.equal(await page.evaluate((u) => window.__test.setAsset('maps.1-1', u), FIXTURE), true);
  await expectColor(page, 'left', FIXTURE_RGB);
  assert.equal(await page.evaluate((u) => window.__test.setAsset('maps.1-1', u), MISSING), false);
  await expectColor(page, 'left', PATH_RGB);
  assert.deepEqual(unexpected(errors), []);
  await page.close();
});

const dialogueScript = [
  { who: 'hero', face: 'base', text: '할머니, 안녕하세요?' },
  { who: 'npc', npc: 'dodam', face: 'base', text: '어서 오너라.' },
];

test('대화: 상반신이 있으면 <img>를, 없는 주소면 오류 없이 임시 블록을 보인다', async () => {
  const { page, errors } = await openNewGame();
  // 그림 없음: 임시 블록
  await page.evaluate((sc) => window.__test.dialogue(sc), dialogueScript);
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.equal(await page.locator('.bust img').count(), 0);
  assert.ok(await page.locator('.bust-hero').isVisible());
  // 그림 있음
  await page.evaluate((u) => window.__test.setAsset('busts.dodam.base', u), FIXTURE);
  await page.evaluate((u) => window.__test.setAsset('busts.hero_f.base', u), FIXTURE);
  await page.evaluate((sc) => window.__test.dialogue(sc), dialogueScript);
  await page.waitForSelector('.bust-npc img.bust-img');
  await page.waitForSelector('.bust-hero img.bust-img');
  assert.equal(await page.locator('.bust-npc .bust-block').isVisible(), false);
  // 없는 주소: 임시 블록, 오류 없음
  await page.evaluate((u) => window.__test.setAsset('busts.dodam.base', u), MISSING);
  await page.evaluate((u) => window.__test.setAsset('busts.hero_f.base', u), MISSING);
  await page.evaluate((u) => window.__test.setAsset('dialogueBg.1-1', u), MISSING);
  await page.evaluate((sc) => window.__test.dialogue(sc), dialogueScript);
  await page.waitForSelector('[data-scene="dialogue"] .dialogue-arrow:not([hidden])');
  await page.waitForTimeout(300); // 불러오기 실패가 돌아올 시간
  assert.equal(await page.locator('.bust img').count(), 0);
  assert.equal(await page.locator('.dialogue-scene > img').count(), 0);
  assert.ok(await page.locator('.bust-hero').isVisible());
  await page.keyboard.press('Space');
  await page.waitForSelector('.bust-npc .bust-block');
  assert.ok(await page.locator('.bust-npc .bust-block').isVisible());
  assert.deepEqual(unexpected(errors), []);
  await page.close();
});

const BATTLE_ASSETS = ['monster.1', 'battleBg.1', 'battleHero.f'];
async function openBoss(url) {
  const { page, errors } = await openNewGame();
  for (const where of BATTLE_ASSETS) await page.evaluate(([w, u]) => window.__test.setAsset(w, u), [where, url]);
  await page.evaluate(() => window.__test.startBattle('boss', 7));
  await page.waitForSelector('[data-scene="battle"] .battle-monster');
  return { page, errors };
}

test('전투: 그림이 없는 주소면 오류 없이 임시 몬스터·무대·주인공을 보인다', async () => {
  const { page, errors } = await openBoss(MISSING);
  await page.waitForTimeout(300); // 불러오기 실패가 돌아올 시간
  assert.equal(await page.locator('.battle-stage img').count(), 0);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.battle-monster')).backgroundImage);
  assert.match(bg, /gradient/, '임시 몬스터 원이 보인다');
  assert.ok(await page.locator('.battle-hero .battle-hero-face').isVisible());
  assert.deepEqual(unexpected(errors), []);
  await page.close();
});

test('전투: 몬스터·무대·주인공 그림이 있으면 <img>로 보이고 임시 그림은 감춘다', async () => {
  const { page, errors } = await openBoss(FIXTURE);
  await page.waitForSelector('.battle-monster img.battle-monster-img');
  await page.waitForSelector('.battle-bg img.battle-bg-img');
  await page.waitForSelector('.battle-hero img.battle-hero-img');
  assert.equal(await page.locator('.battle-hero .battle-hero-face').isVisible(), false);
  assert.deepEqual(unexpected(errors), []);
  await page.close();
});
