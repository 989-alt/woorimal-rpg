// 동료 화면 검사: HUD 동료 초상(1366×768, 1024×768), 4-2 다툼과 화해의 말, 보스 뒤 나래가 사라짐·5-2 나래가 나타남.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser } from './browser.mjs';
import { openGame, state, playDialogue } from './play.mjs';
import { ACTS } from '../../data/acts/index.js';
import { actWords } from '../../js/rules/game.js';
import { attachJosa } from '../../js/rules/josa.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const companions = (page) => page.locator('.hud-companion').evaluateAll((els) => els.map((e) => e.dataset.npc));

// 인물 옆으로 가서 말을 걸고 첫 줄을 읽은 뒤 끝까지 넘긴다.
async function firstLine(page, npcId) {
  await page.evaluate((t) => window.__test.teleportTo(t), npcId);
  await page.waitForSelector('[data-scene="explore"]');
  await page.keyboard.press('Space');
  await page.waitForSelector('[data-scene="dialogue"]');
  await page.waitForFunction(() => document.querySelector('.dialogue-text')?.textContent.length > 3);
  const text = await page.locator('.dialogue-text').innerText();
  await playDialogue(page);
  return text;
}

// 장에 들어서면 시작 글이 먼저 나오므로 끝까지 넘긴다.
async function enterChapter(page, id) {
  await page.evaluate((c) => window.__test.goChapter(c), id);
  await page.waitForSelector('[data-scene="dialogue"], [data-scene="explore"]');
  if (await page.locator('[data-scene="dialogue"]').count()) await playDialogue(page);
  await page.waitForSelector('[data-scene="explore"] .hud');
}

const boxOf = (page, sel) => page.locator(sel).boundingBox();
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('2-1: HUD에 해솔 초상 하나, 이름표는 "동료 해솔"', async () => {
  const { page, errors } = await openGame(browser, server);
  await page.evaluate(() => window.__test.setAsset('busts.haesol.base', null)); // 그림이 없을 때의 모습
  await enterChapter(page, '2-1');
  assert.deepEqual(await companions(page), ['haesol']);
  const badge = page.locator('.hud-companion[data-npc="haesol"]');
  assert.equal(await badge.getAttribute('aria-label'), '동료 해솔');
  const box = await badge.boundingBox();
  assert.equal(Math.round(box.width), 48);
  assert.equal(Math.round(box.height), 48);
  assert.equal(await badge.locator('.hud-companion-initial').innerText(), '해'); // 그림이 없으면 이름 첫 글자
  assert.equal(await page.locator('.hud-companion-initial').evaluate((e) => getComputedStyle(e).display), 'grid');
  // 1막에는 동료가 없다
  await enterChapter(page, '1-1');
  assert.deepEqual(await companions(page), []);
  assert.equal(await page.locator('.hud-companions').evaluate((e) => getComputedStyle(e).display), 'none');
  assert.deepEqual(errors, []);
  await page.close();
});

test('그림이 있으면 얼굴 쪽을 둥글게 잘라 쓰고 글자는 숨는다', async () => {
  const { page, errors } = await openGame(browser, server);
  await page.evaluate(() => window.__test.setAsset('busts.haesol.base', '/tests/fixtures/sprite-16x32.png'));
  await enterChapter(page, '2-1');
  await page.waitForSelector('.hud-companion .hud-companion-face');
  const style = await page.locator('.hud-companion-face').evaluate((e) => {
    const cs = getComputedStyle(e);
    return { fit: cs.objectFit, pos: cs.objectPosition };
  });
  assert.equal(style.fit, 'cover');
  assert.equal(style.pos, '50% 40%'); // 기본은 50% 15%, 해솔 상반신은 얼굴이 낮아 40%(css/game.css)
  assert.equal(await page.locator('.hud-companion-initial').evaluate((e) => getComputedStyle(e).display), 'none');
  assert.deepEqual(errors, []);
  await page.close();
});

for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
  test(`HUD 동료 초상은 두루마리·낱말 명판과 겹치지 않는다 (${size.width}×${size.height})`, async () => {
    const { page, errors } = await openGame(browser, server, { size });
    for (const ch of ['2-1', '3-2']) { // 3-2는 동료 둘
      await enterChapter(page, ch);
      const comp = await boxOf(page, '.hud-companions');
      assert.equal((await companions(page)).length, ch === '2-1' ? 1 : 2);
      for (const sel of ['.hud-task', '.hud-words', '.hud-medallion']) {
        assert.equal(overlap(comp, await boxOf(page, sel)), false, `${ch} ${sel}`);
      }
      assert.ok(comp.x + comp.width <= size.width, '화면 밖으로 나가지 않는다');
      const hud = await boxOf(page, '.hud');
      assert.ok(comp.y >= hud.y && comp.y + comp.height <= hud.y + hud.height, 'HUD 높이 안');
      // 가로로 넘치지 않는다
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      // 두루마리 글이 보인다
      assert.ok((await page.locator('.hud-task-text').innerText()).length > 0);
    }
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('4-2: 다툼 중의 말, q15·q16을 끝낸 뒤 바뀐 말', async () => {
  const { page, errors } = await openGame(browser, server);
  await enterChapter(page, '4-2');
  assert.deepEqual(await companions(page), ['haesol', 'narae']);
  assert.match(await firstLine(page, 'haesol'), /^흥, 난 지금 나래랑 말하기 싫어\./);
  assert.match(await firstLine(page, 'narae'), /^…지금은 혼자 있고 싶어\./);
  await page.evaluate(() => window.__test.patchState((s) => ({
    quests: { ...s.quests, q15: { stage: 'done', gathered: [] }, q16: { stage: 'done', gathered: [] } },
  })));
  await page.waitForSelector('[data-scene="explore"]');
  assert.match(await firstLine(page, 'haesol'), /^나래랑 다시 이야기하니까 속이 시원해\./);
  assert.match(await firstLine(page, 'narae'), /^고마워, 하늘아, 해솔이랑 다시 웃을 수 있어서 좋아\./);
  assert.deepEqual(errors, []);
  await page.close();
});

test('4-2 보스 뒤: 나래 초상이 사라지고 나래는 지도에 없다', async () => {
  const { page, errors } = await openGame(browser, server);
  await enterChapter(page, '4-2');
  await page.evaluate(() => window.__test.patchState((s) => ({
    clearedActs: [...s.clearedActs, 4], seenScenes: [...(s.seenScenes ?? []), '4-2:afterBoss'],
  })));
  await page.waitForSelector('[data-scene="explore"] .hud');
  assert.deepEqual(await companions(page), ['haesol']);
  const err = await page.evaluate(() => { try { window.__test.teleportTo('narae'); return null; } catch (e) { return e.message; } });
  assert.match(err, /지도에 'narae'이\(가\) 없습니다/);
  // 해솔은 그대로 말을 건다
  await page.evaluate(() => window.__test.teleportTo('haesol'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('5-2: 나래는 보스 뒤에야 초상과 지도에 나타난다', async () => {
  const { page, errors } = await openGame(browser, server);
  await enterChapter(page, '5-2');
  assert.deepEqual(await companions(page), ['haesol']);
  const err = await page.evaluate(() => { try { window.__test.teleportTo('narae'); return null; } catch (e) { return e.message; } });
  assert.match(err, /지도에 'narae'이\(가\) 없습니다/);
  // 막을 마친 상태: 낱말을 다 얻고(안개 문이 열린다) 작은 몬스터도 이겼다
  const ids = actWords(ACTS[4]);
  await page.evaluate(([words]) => window.__test.patchState((s) => ({
    clearedActs: [...s.clearedActs, 5], seenScenes: [...(s.seenScenes ?? []), '5-2:afterBoss'],
    acquired: { ...s.acquired, ...Object.fromEntries(words.map((w) => [w, { from: '검사' }])) },
    smallGone: { ...s.smallGone, '5-2': true },
  })), [ids]);
  await page.waitForSelector('[data-scene="explore"] .hud');
  assert.deepEqual(await companions(page), ['haesol', 'narae']);
  assert.equal(await page.locator('.hud-companion[data-npc="narae"]').getAttribute('aria-label'), '동료 나래');
  const at = await page.evaluate(() => window.__test.teleportTo('narae'));
  assert.ok(at && typeof at.x === 'number');
  assert.equal((await state(page)).act, 5);
  assert.deepEqual(errors, []);
  await page.close();
});

// 길잡이 글(nextGoal)이 될 수 있는 모든 글: 부탁 목표, 돌아가 알리기·다시 받기, 숨은 낱말 안내, 출구, 보스.
function allGoalTexts() {
  const out = new Set(['반짝이는 곳을 찾아 조사해 보자', '아직 못 찾은 낱말을 찾아보자']);
  for (const act of ACTS) {
    out.add(`${attachJosa(act.boss.name, '와')} 맞서자`);
    for (const ch of act.chapters) {
      const nameOf = (id) => ch.npcs.find((n) => n.id === id)?.name ?? '마을 사람';
      if (ch.exit) out.add(ch.exit.goal);
      if (ch.hidden.revealGoal) out.add(ch.hidden.revealGoal);
      if (ch.hidden.revealedBy) out.add(`${nameOf(ch.hidden.revealedBy)}에게 말을 걸어 보자`);
      for (const q of ch.quests) {
        const goal = q.goal ?? q.title;
        out.add(goal);
        if (q.kind === 'gather') out.add(`${goal} (${q.targets.length - 1}/${q.targets.length})`);
        out.add(`${nameOf(q.giver)}에게 돌아가 알려 주자`);
        out.add(`${nameOf(q.giver)}에게 말을 걸어 보자`);
        if (q.item) out.add(`${nameOf(q.giver)}에게 ${attachJosa(q.item.name, '을')} 다시 받자`);
        if (q.kind === 'deliver') out.add(q.goal ?? `${nameOf(q.targets[0])}에게 전하러 가자`);
      }
    }
  }
  return [...out];
}

for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
  test(`할 일 두루마리 글은 어떤 길잡이 글이든 잘리지 않고 두 줄 안에 다 보인다 (${size.width}×${size.height})`, async () => {
    const goals = allGoalTexts();
    const longest = goals.reduce((a, b) => ([...b].length > [...a].length ? b : a));
    assert.ok([...longest].length >= 22, '가장 긴 글을 포함한다');
    const { page, errors } = await openGame(browser, server, { size });
    for (const ch of ['1-1', '2-1', '3-2', '4-2']) { // 동료 0·1·2·2
      await enterChapter(page, ch);
      const bad = await page.evaluate((list) => {
        const text = document.querySelector('.hud-task-text');
        const cs = getComputedStyle(text);
        const problems = [];
        if (parseFloat(cs.fontSize) < 18) problems.push(`글자 ${cs.fontSize}`);
        if (cs.textOverflow === 'ellipsis') problems.push('줄임표');
        for (const g of list) {
          text.textContent = g;
          const lines = Math.round(text.getBoundingClientRect().height / parseFloat(cs.lineHeight));
          if (text.scrollWidth > text.clientWidth) problems.push(`가로로 넘침: ${g}`);
          if (lines > 2) problems.push(`${lines}줄: ${g}`);
        }
        return problems;
      }, goals);
      assert.deepEqual(bad, [], `${ch} ${size.width}`);
      // 가장 긴 글을 두고도 두루마리가 동료 초상·낱말 명판과 겹치지 않고 화면 안에 있다
      await page.evaluate((g) => { document.querySelector('.hud-task-text').textContent = g; }, longest);
      const task = await boxOf(page, '.hud-task');
      for (const sel of ['.hud-words']) assert.equal(overlap(task, await boxOf(page, sel)), false, `${ch} ${sel}`);
      if ((await companions(page)).length) assert.equal(overlap(task, await boxOf(page, '.hud-companions')), false, `${ch} 동료`);
      assert.ok(task.x >= 0 && task.x + task.width <= size.width && task.y + task.height <= size.height);
    }
    assert.deepEqual(errors, []);
    await page.close();
  });
}
