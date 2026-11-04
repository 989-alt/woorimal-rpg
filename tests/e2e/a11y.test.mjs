// 화면을 모두 다시 만든 뒤의 접근성 훑기(1366×768): 화면마다
//  - 보이는 글자가 있는 요소의 글자 크기 18px 이상(키 배지·번호 동전 포함)
//  - 보이는 button·[role=button]·[role=radio]·[role=tab]의 상자 48×48 이상
//  - Tab으로 초점을 옮긴 요소의 outline이 3px solid rgb(59, 91, 165)
// UI 그림이 있을 때와 assets/ui/** 를 막았을 때(대체 모습) 모두 지킨다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors, finishDialogue } from './browser.mjs';
import ACT1 from '../../data/acts/act1.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const FOCUS = { style: 'solid', width: '3px', color: 'rgb(59, 91, 165)' };
const SELECTOR = (e) => {
  const id = e.id ? `#${e.id}` : '';
  const cls = typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/).join('.')}` : '';
  return `${e.tagName.toLowerCase()}${id}${cls}`;
};

// 한 화면을 훑는다. 문제가 있으면 문장 목록으로 돌려준다.
async function scan(page, label, { tabs = 14 } = {}) {
  await page.evaluate(() => document.fonts.ready);
  const found = await page.evaluate(() => {
    const out = { small: [], tiny: [] };
    const sel = (e) => {
      const id = e.id ? `#${e.id}` : '';
      const cls = typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/).join('.')}` : '';
      return `${e.tagName.toLowerCase()}${id}${cls}`;
    };
    const shown = (e) => {
      for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
        const c = getComputedStyle(n);
        if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0 || n.hidden) return false;
      }
      const r = e.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    for (const e of document.body.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE'].includes(e.tagName)) continue;
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && shown(e)) {
        const fs = parseFloat(getComputedStyle(e).fontSize);
        // font-size 0은 그림이 대신하는 글자(하트 ♥ 대체 글자)라서 눈에 보이는 글자가 아니다
        if (fs > 0 && fs < 18) out.small.push(`${sel(e)} ${fs}px "${e.textContent.trim().slice(0, 12)}"`);
      }
      if (e.matches('button, [role="button"], [role="radio"], [role="tab"]') && shown(e)) {
        const r = e.getBoundingClientRect();
        if (Math.round(r.width) < 48 || Math.round(r.height) < 48) out.tiny.push(`${sel(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  });
  const problems = [
    ...found.small.map((s) => `${label}: 글자 18px 미만 ${s}`),
    ...found.tiny.map((s) => `${label}: 누르는 것이 48px 미만 ${s}`),
  ];
  // Tab 초점 고리
  await page.evaluate(() => document.activeElement?.blur?.());
  const seen = new Set();
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const c = getComputedStyle(e);
      const id = e.id ? `#${e.id}` : '';
      const cls = typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/).join('.')}` : '';
      return { name: `${e.tagName.toLowerCase()}${id}${cls}`, style: c.outlineStyle, width: c.outlineWidth, color: c.outlineColor, key: `${e.tagName}${id}${cls}${e.textContent.trim().slice(0, 8)}` };
    });
    if (!f) continue;
    if (seen.has(f.key)) break; // 한 바퀴
    seen.add(f.key);
    if (f.style !== FOCUS.style || f.width !== FOCUS.width || f.color !== FOCUS.color) {
      problems.push(`${label}: 초점 고리 ${f.name} → ${f.style} ${f.width} ${f.color}`);
    }
  }
  return problems;
}

async function newPage(blocked) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page, blocked ? { allow: /\/assets\/ui\// } : {});
  if (blocked) await page.route('**/assets/ui/**', (r) => r.abort());
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.fastText(true));
  return { page, errors };
}
const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity));
};

const SCRIPT = [
  { who: 'hero', face: 'base', text: '할머니, 안녕하세요?' },
  { who: 'npc', npc: 'dodam', face: 'base', text: '어서 오너라.' },
];

async function askType(page, want) {
  for (let i = 0; i < 12 && (await page.locator('.battle-options').getAttribute('data-type')) !== want; i++) {
    const idx = await page.evaluate(() => window.__test.answerIndex());
    const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
    await page.keyboard.press(`Digit${idx + 1}`);
    await page.waitForFunction((n) => { const s = document.querySelector('[data-scene="battle"]'); return !s || (s.dataset.phase === 'ask' && s.dataset.qn !== n); }, qn);
  }
  assert.equal(await page.locator('.battle-options').getAttribute('data-type'), want);
}
async function battle(page, mode, seed = 7) {
  await page.evaluate(([m, s]) => window.__test.startBattle(m, s), [mode, seed]);
  await page.waitForSelector('[data-scene="battle"]');
  if (await page.locator('.battle-tip').count()) {
    await settle(page);
    await page.locator('.battle-tip button').click();
  }
  await page.waitForSelector('[data-phase="ask"] .battle-option');
}

for (const blocked of [false, true]) {
  test(`접근성 훑기 1366×768 (${blocked ? 'UI 그림 막음' : 'UI 그림 있음'})`, async () => {
    const { page, errors } = await newPage(blocked);
    const problems = [];
    const check = async (label, opts) => { await settle(page); problems.push(...(await scan(page, label, opts))); };

    // 타이틀 → 모습 고르기 → 탐험
    await page.waitForSelector('[data-scene="title"]');
    // 훑기 자체가 잘 잡는지: 일부러 어긴 단추를 하나 얹어 세 가지가 모두 잡히는지 본다
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'canary';
      b.textContent = '작게';
      b.style.cssText = 'position:fixed;left:0;top:0;width:20px;height:20px;font-size:10px;outline:none;z-index:99';
      document.body.prepend(b);
    });
    const caught = await scan(page, '카나리아', { tabs: 3 });
    assert.equal(caught.filter((p) => /글자 18px 미만/.test(p)).length, 1, caught.join('\n'));
    assert.equal(caught.filter((p) => /48px 미만/.test(p)).length, 1, caught.join('\n'));
    assert.equal(caught.filter((p) => /초점 고리/.test(p)).length, 1, caught.join('\n'));
    await page.evaluate(() => document.getElementById('canary').remove());
    await check('타이틀');
    await page.locator('.title-menu').getByRole('button', { name: '처음부터' }).click();
    await page.waitForSelector('[data-scene="select"]');
    await check('모습 고르기');
    await page.fill('#nickname', '하늘');
    await page.locator('.avatar-card[data-avatar="f"]').click();
    await page.locator('.select-go').click();
    await finishDialogue(page); // 첫 이야기
    await check('탐험(HUD)');

    // 이어하기
    await page.reload();
    await page.waitForFunction(() => window.__test);
    await page.evaluate(() => window.__test.fastText(true));
    await page.waitForSelector('[data-scene="title"]');
    await page.locator('.title-menu').getByRole('button', { name: '이어하기' }).click();
    await page.waitForSelector('[data-scene="select"][data-mode="continue"]');
    await check('이어하기');
    await page.fill('#nickname', '하늘');
    await page.locator('.select-go').click();
    await page.waitForSelector('[data-scene="explore"]');

    // 대화, 뜻풀이 카드
    await page.evaluate((s) => window.__test.dialogue(s), SCRIPT);
    await page.waitForSelector('[data-scene="dialogue"] .dialogue-arrow:not([hidden])');
    await check('대화');
    await page.evaluate((s) => window.__test.dialogue(s, ['어스름', '아침나절'], '도담 할머니'), ACT1.chapters[0].quests[0].done);
    // 카드가 뜰 때까지 줄을 넘긴다
    for (let i = 0; i < 40 && !(await page.locator('.word-card').count()); i++) {
      await page.waitForSelector('.word-card, [data-scene="dialogue"][data-ready], [data-scene="dialogue"] .dialogue-arrow:not([hidden])');
      if (await page.locator('.word-card').count()) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(60);
    }
    await page.waitForSelector('.word-card.lit');
    await check('뜻풀이 카드');
    await page.locator('.word-card button').click();

    // 도감, 할 일
    await page.evaluate(() => window.__test.acquire(['어스름'], '도담 할머니'));
    await page.waitForSelector('[data-scene="explore"]');
    await page.keyboard.press('KeyE');
    await page.waitForSelector('.codex');
    await check('도감');
    await page.keyboard.press('KeyQ');
    await page.waitForSelector('.tasks');
    await check('할 일');
    await page.keyboard.press('Escape');

    // 복습전(새 게임에서)
    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await page.waitForSelector('[data-scene="explore"]');
    await battle(page, 'review');
    await check('복습전');

    // 보스전: 세 유형 + 오답 풀이 → 오답만 계속해서 게임 오버 → 다시 도전 → 클리어
    await page.evaluate(() => window.__test.newGame('하늘', 'f'));
    await page.waitForSelector('[data-scene="explore"]');
    await battle(page, 'boss');
    for (const type of ['meaning', 'blank', 'usage']) {
      await askType(page, type);
      await check(`보스전 ${type}`);
    }
    for (let i = 0; i < 5; i++) {
      const j = await page.evaluate(() => window.__test.answerIndex());
      await page.keyboard.press(`Digit${((j + 1) % 4) + 1}`);
      await page.waitForSelector('.battle-feedback .battle-next');
      if (i === 0) await check('오답 풀이');
      await page.locator('.battle-next').click();
    }
    await page.waitForSelector('[data-scene="gameover"]');
    await check('게임 오버');

    await page.getByRole('button', { name: '다시 도전' }).click();
    await page.waitForSelector('[data-phase="ask"] .battle-option');
    for (let i = 0; i < 6; i++) {
      const j = await page.evaluate(() => window.__test.answerIndex());
      const qn = await page.locator('[data-scene="battle"]').getAttribute('data-qn');
      await page.keyboard.press(`Digit${j + 1}`);
      if (i < 5) await page.waitForFunction((n) => document.querySelector('[data-scene="battle"]')?.dataset.qn !== n, qn);
    }
    await page.waitForSelector('[data-scene="clear"]');
    await check('클리어');

    assert.deepEqual(problems, []);
    assert.deepEqual(errors, []);
    await page.close();
  });
}
