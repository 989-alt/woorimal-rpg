// 소리: 스피커 단추(타이틀·HUD·M 키)와 그 설정이 남는 곳, 장면마다 바라는 음악, 진짜 소리 길과 소리 파일이 없을 때.
// ?test=1에서는 소리를 내지 않고 요청만 적는다(window.__test.audio()). 진짜 소리 길은 ?test=1 없이 연다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, startFromTitle } from './browser.mjs';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const probe = (page) => page.evaluate(() => window.__test.audio());
const pressed = (page, scope) => page.locator(`${scope} .sound-toggle`).getAttribute('aria-pressed');
const saved = (page, name) => page.evaluate((n) => JSON.parse(localStorage.getItem(`malbit:save:${n}`)), name);

test('스피커 단추: 타이틀·HUD에 있고(이름 "소리 켜기/끄기", 48px 이상), 처음엔 켜짐, 끄면 새로 고침 뒤에도 꺼짐', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  const btn = page.getByRole('button', { name: '소리 켜기/끄기' });
  assert.equal(await btn.count(), 1);
  const box = await btn.boundingBox();
  assert.ok(box.width >= 48 && box.height >= 48, `단추 ${box.width}×${box.height}`);
  assert.ok(box.x + box.width <= 1366 && box.y >= 0, '화면 안');
  assert.equal(await pressed(page, '[data-scene="title"]'), 'true');
  assert.equal((await probe(page)).on, true);
  await btn.click();
  assert.equal(await pressed(page, '[data-scene="title"]'), 'false');
  assert.equal((await probe(page)).on, false);
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await pressed(page, '[data-scene="title"]'), 'false', '기기 기본값으로 남는다');
  // 탐험 HUD에도 같은 단추. M 키로도 켜고 끈다
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await page.waitForSelector('[data-scene="explore"]');
  assert.equal(await pressed(page, '.hud'), 'false', '새 게임은 지금 설정 그대로');
  const hudBox = await page.locator('.hud .sound-toggle').boundingBox();
  assert.ok(hudBox.width >= 48 && hudBox.height >= 48);
  await page.keyboard.press('KeyM');
  assert.equal(await pressed(page, '.hud'), 'true');
  assert.deepEqual((await saved(page, '하늘')).sound, { on: true, volume: 0.6 }, '게임 중에 바꾸면 학생 저장에 바로 남는다');
  await page.locator('.hud .sound-toggle').click();
  assert.equal(await pressed(page, '.hud'), 'false');
  assert.equal((await saved(page, '하늘')).sound.on, false);
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('sound-toggle')), false, '누른 뒤 초점이 단추에 남지 않는다(Space가 말 걸기로 쓰이게)');
  assert.deepEqual((await probe(page)).toggles, [true, false], '새로 고침 뒤의 켜기·끄기');
  assert.deepEqual(errors, []);
  await page.close();
});

test('소리 설정은 학생마다: 이어하면 그 학생 설정, 타이틀은 기기 기본값', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  // 가람: 소리를 끄고 저장
  await page.evaluate(() => window.__test.newGame('가람', 'm'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('KeyM');
  assert.equal((await saved(page, '가람')).sound.on, false);
  // 다음 학생이 타이틀에서 소리를 켬(기기 기본값 켬)
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await pressed(page, '[data-scene="title"]'), 'false');
  await page.locator('[data-scene="title"] .sound-toggle').click();
  assert.equal(await pressed(page, '[data-scene="title"]'), 'true');
  // 가람이 이어하면 가람의 설정(끔)
  await startFromTitle(page, { name: '가람', mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
  assert.equal(await pressed(page, '.hud'), 'false', '가람의 저장대로 꺼짐');
  assert.equal((await probe(page)).on, false);
  assert.equal((await saved(page, '가람')).sound.on, false, '불러오면서 덮어쓰지 않는다');
  // 다시 타이틀: 기기 기본값(켬)
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  assert.equal(await pressed(page, '[data-scene="title"]'), 'true');
  assert.deepEqual(errors, []);
  await page.close();
});

test('장면마다 바라는 음악과 효과음 요청(검사 흉내)', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  assert.equal((await probe(page)).want, 'title');
  await page.evaluate(() => { window.__test.fastText(true); window.__test.newGame('나리', 'f'); });
  await page.waitForSelector('[data-scene="explore"]');
  assert.equal((await probe(page)).want, 'act1');
  // 걸음
  await page.keyboard.press('ArrowRight');
  assert.ok((await probe(page)).sfx.includes('step'));
  // 대화: 낱말이 빛나면 chime, 뜻풀이 카드 card, 넘기면 talk
  await page.evaluate(() => window.__test.dialogue([{ who: 'narration', text: '[[윤슬]]이 반짝인다.' }, { who: 'narration', text: '좋다.' }], ['윤슬'], '시험'));
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.equal((await probe(page)).want, 'act1', '대화는 그 막 음악 그대로');
  await finishDialogue(page);
  const s1 = (await probe(page)).sfx;
  for (const k of ['chime', 'card', 'talk']) assert.ok(s1.includes(k), `${k}: ${s1}`);
  // 도감 열고 닫기
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.overlay.codex');
  await page.keyboard.press('Escape');
  assert.equal((await probe(page)).sfx.filter((k) => k === 'codex').length, 2);
  // 복습전: 정답이면 correct + hit
  await page.evaluate(() => window.__test.startBattle('review', 7));
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"]');
  assert.equal((await probe(page)).want, 'review');
  const i = await page.evaluate(() => window.__test.answerIndex());
  await page.keyboard.press(`Digit${i + 1}`);
  await page.waitForFunction(() => window.__test.audio().sfx.includes('hit'));
  assert.ok((await probe(page)).sfx.includes('correct'));
  // 보스전(1막) → boss, 5막 → final
  await page.evaluate(() => window.__test.startBattle('boss', 3));
  await page.waitForSelector('[data-scene="battle"][data-mode="boss"]');
  assert.equal((await probe(page)).want, 'boss');
  const wrong = (await page.evaluate(() => window.__test.answerIndex()) + 1) % 4;
  await page.keyboard.press(`Digit${wrong + 1}`);
  await page.waitForFunction(() => window.__test.audio().sfx.includes('heart'));
  assert.ok((await probe(page)).sfx.includes('wrong'));
  await page.evaluate(() => window.__test.goChapter('5-1'));
  await page.waitForSelector('[data-scene="explore"]');
  assert.equal((await probe(page)).want, 'act5');
  await page.evaluate(() => window.__test.startBattle('boss', 3));
  await page.waitForSelector('[data-scene="battle"][data-mode="boss"]');
  assert.equal((await probe(page)).want, 'final');
  // 마무리 퀴즈 → quiz
  await page.evaluate(() => window.__test.openQuiz(5));
  await page.waitForSelector('[data-scene="review-quiz"]');
  assert.equal((await probe(page)).want, 'quiz');
  const music = (await probe(page)).music;
  for (const k of ['title', 'act1', 'review', 'boss', 'act5', 'final', 'quiz']) assert.ok(music.includes(k), `${k}: ${music}`);
  assert.deepEqual(errors, []);
  await page.close();
});

test('진짜 소리 길(?test=1 없음): 첫 누름 뒤 타이틀 음악이 나고, 다른 곡은 그 장면에서 받는다, 오류 없음', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  const asked = [];
  page.on('request', (r) => { if (r.url().includes('/assets/audio/')) asked.push(r.url().split('/').pop()); });
  await page.goto(server.url + '/');
  await page.waitForSelector('[data-scene="title"]');
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => e.name.includes('music_title')));
  assert.deepEqual(asked.filter((n) => n.startsWith('music_')), ['music_title.v1.mp3'], '처음에는 타이틀 음악만');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.music), undefined, '누르기 전에는 소리를 내지 않는다');
  await page.mouse.click(40, 700); // 빈 곳 누름: AudioContext를 연다
  await page.waitForFunction(() => document.documentElement.dataset.music === 'title', null, { timeout: 15000 });
  assert.ok(asked.some((n) => n.startsWith('sfx_')), '효과음은 첫 누름 뒤 받는다');
  // 끄면 음악이 멈춘다
  await page.locator('[data-scene="title"] .sound-toggle').click();
  await page.waitForFunction(() => document.documentElement.dataset.music === undefined);
  await page.locator('[data-scene="title"] .sound-toggle').click();
  await page.waitForFunction(() => document.documentElement.dataset.music === 'title', null, { timeout: 15000 });
  // 게임을 시작하면 1막 음악을 그때 받는다
  await startFromTitle(page, { name: '소리', avatar: 'f' });
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.waitForFunction(() => document.documentElement.dataset.music === 'act1', null, { timeout: 15000 });
  assert.ok(asked.includes('music_act1.v1.mp3'));
  assert.ok(!asked.includes('music_act2.v1.mp3'), '다른 막 음악은 받지 않는다');
  assert.deepEqual(errors, []);
  await page.close();
});

test('소리 파일을 못 받아도 게임은 그대로(오류 없이 조용히)', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.route('**/assets/audio/**', (route) => route.fulfill({ status: 404, body: '' }));
  const errors = collectErrors(page, { allow: /\/assets\/audio\// });
  await page.goto(server.url + '/');
  await page.waitForSelector('[data-scene="title"]');
  await page.mouse.click(40, 700);
  await page.keyboard.press('KeyM');
  await page.keyboard.press('KeyM');
  await startFromTitle(page, { name: '조용', avatar: 'm' });
  await page.waitForSelector('[data-scene="dialogue"]');
  await finishDialogue(page);
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.music), undefined);
  assert.deepEqual(errors, []);
  await page.close();
});
