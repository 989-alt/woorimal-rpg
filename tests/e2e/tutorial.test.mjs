// 플레이 안내(말풍선): 첫 몇 분 동안 하나씩 한 번만 뜨고, 클릭을 막지 않고, 다른 장면에 남지 않는다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue, dialogueStep, startFromTitle } from './browser.mjs';
import { pathTo, KEYS } from './helpers.mjs';
import { parseMap } from '../../js/explore/grid.js';
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

// 처음 만나는 차례(반짝임은 말빛 주머니를 받은 뒤 장독대가 보이면 바로 뜨므로 낱말 안내보다 앞선다)
const IDS = ['dialogue', 'move', 'talk', 'quest', 'sparkle', 'tip-word', 'codex', 'tip-review', 'tip-boss'];
const hintOf = (page, id) => page.locator(`.hint[data-tip="${id}"]`);
const shownIds = (page) => page.evaluate(() => (window.__test.hints ?? []).map((h) => h.id));
const state = (page) => page.evaluate(() => window.__test.state());

async function open(page) {
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  await page.evaluate(() => window.__test.fastText(true));
}

const gap = (a, b) => Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), a.y - (b.y + b.height), b.y - (a.y + a.height), 0);

test('키보드: 첫 몇 분 동안 안내가 하나씩 한 번만', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await open(page);

  // 처음 이야기: 넘기는 법
  await startFromTitle(page, { name: '하늘' });
  await hintOf(page, 'dialogue').waitFor();
  assert.match(await hintOf(page, 'dialogue').innerText(), /Space/);
  await page.keyboard.press('Space');
  await hintOf(page, 'dialogue').waitFor({ state: 'detached' });
  await finishDialogue(page);

  // 탐험: 걷는 법 → 첫 걸음에 사라짐
  await hintOf(page, 'move').waitFor();
  assert.match(await hintOf(page, 'move').innerText(), /방향키로 걸어 보세요/);
  await page.keyboard.press('ArrowRight');
  await hintOf(page, 'move').waitFor({ state: 'detached' });

  // 도담 할머니 앞까지 걸어가 바라보면 말 거는 법
  const map = parseMap(ACT1.chapters[0].map.rows);
  const dodam = map.slots.a;
  const s = await state(page);
  for (const dir of pathTo(map, s.pos, { x: dodam.x, y: dodam.y + 1 }, {})) await page.keyboard.press(KEYS[dir]);
  await page.keyboard.press('ArrowUp');
  await hintOf(page, 'talk').waitFor();
  assert.match(await hintOf(page, 'talk').innerText(), /Space/);
  await page.keyboard.press('Space');
  await hintOf(page, 'talk').waitFor({ state: 'detached' });
  await page.waitForSelector('[data-scene="dialogue"]');
  assert.equal(await hintOf(page, 'dialogue').count(), 0, '대화 안내는 다시 뜨지 않는다');
  await finishDialogue(page);

  // 부탁을 받은 뒤: 할 일 단추 곁에서 할 일 보는 법
  await hintOf(page, 'quest').waitFor();
  const quest = await hintOf(page, 'quest').boundingBox();
  const tasksButton = await page.locator('.hud-button[aria-label^="할 일"]').boundingBox();
  assert.ok(gap(quest, tasksButton) <= 200, `quest 안내가 할 일 단추에서 ${gap(quest, tasksButton)}px`);
  assert.ok(quest.y >= tasksButton.y + tasksButton.height, '단추 아래에 놓인다(HUD를 가리지 않는다)');

  // 부탁 안내 다음, 숨은 낱말 반짝임이 화면에 들어오면 한 번 알려 준다(말빛 주머니를 받은 뒤)
  await page.evaluate(() => window.__test.teleportTo('장독대'));
  await hintOf(page, 'sparkle').waitFor();
  assert.match(await hintOf(page, 'sparkle').innerText(), /반짝이는 곳/);

  // 우물 조사 → 할머니에게 돌아가 완료 대화: 새 낱말은 금빛이 된 뒤 안내
  await page.evaluate(() => window.__test.teleportTo('우물'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('Space');
  await page.waitForSelector('.toast:not([hidden])');
  await page.evaluate(() => window.__test.teleportTo('dodam'));
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('Space');
  await page.waitForSelector('[data-scene="dialogue"]');
  for (let i = 0; i < 6 && !(await hintOf(page, 'tip-word').count()); i++) assert.equal(await dialogueStep(page), 'next');
  await hintOf(page, 'tip-word').waitFor();
  assert.match(await hintOf(page, 'tip-word').innerText(), /금빛/);
  assert.ok(await page.locator('.hl.new.word-lit').count() > 0, '낱말이 금빛이 된 뒤에 안내가 뜬다');
  assert.equal(await page.locator('.word-card').count(), 0, '안내를 읽는 동안 카드는 기다린다');
  await page.keyboard.press('Space'); // 누르면 바로 카드

  // 카드: 도감 안내(뜻풀이 글과 뒤의 대사 글줄을 가리지 않게 카드 위)
  await hintOf(page, 'codex').waitFor();
  assert.match(await hintOf(page, 'codex').innerText(), /도감/);
  assert.equal(await hintOf(page, 'tip-word').count(), 0);
  const codex = await hintOf(page, 'codex').boundingBox();
  const ok = await page.locator('.word-card button').boundingBox();
  const card = await page.locator('.word-card').boundingBox();
  assert.ok(codex.y + codex.height <= ok.y, '확인 단추 위에 놓인다');
  assert.ok(codex.y + codex.height <= card.y + 30, `카드 위에 놓여 뜻풀이를 가리지 않는다 (hint 끝 ${codex.y + codex.height}, card 위 ${card.y})`);
  await page.locator('.word-card button').click();
  await hintOf(page, 'codex').waitFor({ state: 'detached' });
  await finishDialogue(page);

  // 복습 전투: 보기 묶음 위
  await page.evaluate(() => window.__test.startBattle('review', 7));
  await hintOf(page, 'tip-review').waitFor();
  const review = await hintOf(page, 'tip-review').boundingBox();
  const options = await page.locator('.battle-options').boundingBox();
  assert.ok(review.y + review.height <= options.y, '보기 묶음 위에 놓인다');
  await page.keyboard.press('Digit1');
  await hintOf(page, 'tip-review').waitFor({ state: 'detached' });

  // 보스 전투
  await page.evaluate(() => window.__test.startBattle('boss', 7));
  await hintOf(page, 'tip-boss').waitFor();

  // 아홉 안내가 정확히 한 번씩
  assert.deepEqual(await shownIds(page), IDS);
  const seen = (await state(page)).seenTips;
  for (const id of IDS) assert.ok(seen.includes(id), `seenTips에 ${id}`);

  // 대화·탐험·전투를 다시 열어도 늘지 않는다
  await page.evaluate(() => window.__test.dialogue([{ who: 'narration', text: '바람이 분다.' }], [], ''));
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.evaluate(() => window.__test.startBattle('review', 8));
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
  await page.evaluate(() => window.__test.acquire([], '검사'));
  await page.waitForSelector('[data-scene="explore"]');
  assert.deepEqual(await shownIds(page), IDS);
  assert.equal(await page.locator('.hint').count(), 0);

  // 새로 고침 → 이어하기: 본 안내는 다시 뜨지 않는다
  await page.reload();
  await page.waitForSelector('[data-scene="title"]');
  await page.evaluate(() => window.__test.fastText(true));
  await startFromTitle(page, { name: '하늘', mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
  await page.waitForTimeout(400);
  assert.deepEqual(await shownIds(page), []);
  await page.evaluate(() => window.__test.dialogue([{ who: 'narration', text: '바람이 분다.' }], [], ''));
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.waitForTimeout(400);
  assert.deepEqual(await shownIds(page), []);
  assert.equal(await page.locator('.hint').count(), 0);

  assert.deepEqual(errors, []);
  await page.close();
});

test('터치(hasTouch, isMobile, 1024×768): move 글에 "화살표", talk 글에 "말하기 버튼"', async () => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await hintOf(page, 'move').waitFor();
  assert.match(await hintOf(page, 'move').innerText(), /화살표/);
  await page.keyboard.press('ArrowRight');
  await hintOf(page, 'move').waitFor({ state: 'detached' });
  await page.evaluate(() => window.__test.teleportTo('dodam'));
  await hintOf(page, 'talk').waitFor();
  assert.match(await hintOf(page, 'talk').innerText(), /말하기 버튼/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('안내가 떠 있어도 HUD 단추를 누를 수 있고, 도감을 열면 안내가 사라진다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(() => window.__test.newGame('하늘', 'f'));
  await hintOf(page, 'move').waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.hint')).pointerEvents), 'none');
  const b = await page.locator('.hud-button[aria-label^="도감"]').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.codex');
  assert.equal(await page.locator('.hint').count(), 0);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.codex', { state: 'detached' });
  assert.equal(await page.locator('.hint[data-tip="move"]').count(), 0, '닫은 뒤에도 다시 뜨지 않는다');
  // 전투로 넘어가면 탐험의 안내가 남지 않는다(전투 자기 안내만 있다)
  await page.evaluate(() => window.__test.startBattle('review', 7));
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
  const scenes = await page.evaluate(() => [...document.querySelectorAll('.hint')].map((h) => h.closest('[data-scene]').dataset.scene));
  assert.deepEqual(scenes, ['battle']);
  assert.equal(await page.locator('.hint[data-tip="move"]').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('옛 저장으로 이어하기: 본 안내는 다시 뜨지 않고, 새 안내만 한 번씩', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  // 옛 저장: 새 게임의 모양에 본 안내 다섯 개만 담는다(게임이 열려 있는 쪽은 나갈 때 저장하므로 다른 쪽에서 만든다)
  const maker = await browser.newPage();
  await open(maker);
  const old = await maker.evaluate(() => {
    window.__test.newGame('하늘', 'f');
    return JSON.stringify({ ...window.__test.state(), seenTips: ['move', 'first-npc', 'tip-word', 'tip-boss', 'tip-review'] });
  });
  await maker.close();
  await open(page);
  await page.evaluate((json) => {
    localStorage.setItem('malbit:save:하늘', json);
    localStorage.setItem('malbit:names', JSON.stringify(['하늘']));
  }, old);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  await page.evaluate(() => window.__test.fastText(true));
  await startFromTitle(page, { name: '하늘', mode: 'continue' });
  await page.waitForSelector('[data-scene="explore"]');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.hint').count(), 0, 'move는 이미 본 안내');
  await page.evaluate(() => window.__test.teleportTo('dodam'));
  await hintOf(page, 'talk').waitFor();
  await page.evaluate(() => window.__test.startBattle('boss', 7));
  await page.waitForSelector('[data-scene="battle"][data-phase="ask"] .battle-option');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.hint').count(), 0, 'tip-boss는 이미 본 안내');
  assert.deepEqual(await shownIds(page), ['talk']);
  assert.deepEqual(errors, []);
  await page.close();
});
