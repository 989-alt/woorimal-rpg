// 그림이 화면에 놓이는 자리(art-bible 7절, 시안 dialogue2·b3a): 1366×768 기준.
// - 대화: 두 상반신은 같은 높이(약 620px), 아래는 대사 상자 뒤, 듣는 쪽은 어둡게.
// - 전투: 주인공 그림 상자 약 614px·몬스터 약 380px, 복습전은 같은 몬스터 그림 70%. 그림이 보기를 가리지 않는다.
// - 고른 모습(f/m)의 그림만 나온다. 타이틀 글자는 한지 패널 위.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launchBrowser, collectErrors } from './browser.mjs';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function open(avatar = 'f') {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForFunction(() => window.__test);
  await page.evaluate(() => window.__test.fastText(true));
  await page.evaluate((a) => window.__test.newGame('하늘', a), avatar);
  await page.waitForSelector('[data-scene="explore"]');
  return { page, errors };
}
const box = (page, sel) => page.locator(sel).first().boundingBox();
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got} (기대 ${want}±${tol})`);

const script = [
  { who: 'hero', face: 'base', text: '할머니, 안녕하세요?' },
  { who: 'npc', npc: 'dodam', face: 'base', text: '어서 오너라.' },
];

for (const avatar of ['f', 'm']) {
  test(`대화(${avatar}): 두 상반신은 같은 높이 약 620px, 아래는 상자 뒤, 고른 모습의 그림`, async () => {
    const { page, errors } = await open(avatar);
    await page.evaluate((s) => window.__test.dialogue(s), script);
    await page.waitForSelector('.bust-hero img.bust-img');
    await page.waitForSelector('.bust-npc img.bust-img');
    const hero = await box(page, '.bust-hero');
    const npc = await box(page, '.bust-npc');
    const dlg = await box(page, '.dialogue-box');
    near(hero.height, 620, 10, '주인공 높이');
    assert.equal(hero.height, npc.height, '두 인물 같은 높이');
    assert.equal(hero.y, npc.y, '두 인물 같은 자리 높이');
    near(dlg.width, 1366 - 80, 1, '상자 폭(좌우 40px)');
    near(dlg.height, 190, 1, '상자 높이');
    assert.ok(hero.y + hero.height > dlg.y + 40, '상반신 아래는 상자 뒤로 가려진다');
    assert.ok(hero.x < 683 && npc.x > 683, '주인공 왼쪽, 마을 사람 오른쪽');
    // 상자가 그림 위에 그려진다(상자 안 한 점을 누르면 상자)
    const onBox = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.dialogue-box'), [hero.x + hero.width / 2, dlg.y + 20]);
    assert.ok(onBox, '상자가 상반신 위');
    // 고른 모습의 그림
    const src = await page.locator('.bust-hero img').getAttribute('src');
    assert.match(src, new RegExp(`bust_hero_${avatar}_`));
    // 첫 줄은 주인공이 말한다: 마을 사람이 듣는 쪽(어둡게)
    const filter = await page.evaluate(() => getComputedStyle(document.querySelector('.bust-npc')).filter);
    assert.match(filter, /brightness\(0\.62\).*saturate\(0\.7\)/);
    assert.deepEqual(errors, []);
    await page.close();
  });
}

async function battle(page, mode) {
  await page.evaluate((m) => window.__test.startBattle(m, 7), mode);
  await page.waitForSelector('.battle-tip button');
  await page.click('.battle-tip button');
  await page.waitForSelector('[data-phase="ask"] .battle-option');
  await page.waitForSelector('.battle-hero img.battle-hero-img');
  await page.waitForSelector('.battle-monster img.battle-monster-img');
}

// 보기 단추 가운데 점이 그 단추 자신이다(무대 그림이 보기를 가리지 않는다)
async function optionsUncovered(page) {
  return page.evaluate(() => [...document.querySelectorAll('.battle-option')].every((b) => {
    const r = b.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.battle-option') === b;
  }));
}

for (const avatar of ['f', 'm']) {
  test(`보스전(${avatar}): 주인공 약 614px(아래는 묶음 뒤), 몬스터 약 380px, 보기는 가리지 않는다`, async () => {
    const { page, errors } = await open(avatar);
    await battle(page, 'boss');
    const hero = await box(page, '.battle-hero');
    const mon = await box(page, '.battle-monster');
    const stage = await box(page, '.battle-stage');
    near(hero.height, 614, 8, '주인공 상자 높이');
    near(mon.height, 380, 8, '몬스터 높이');
    assert.ok(hero.y + hero.height > stage.y + stage.height + 100, '주인공 하체는 무대 아래(묶음 뒤)');
    assert.ok(mon.x > 683, '몬스터는 오른쪽');
    assert.ok(await optionsUncovered(page), '보기가 가려지지 않는다');
    assert.match(await page.locator('.battle-hero img').getAttribute('src'), new RegExp(`battle_hero_${avatar}\\.`));
    const bgFilter = await page.evaluate(() => getComputedStyle(document.querySelector('.battle-bg')).filter);
    assert.match(bgFilter, /grayscale\(0\.9\)/, '무대 배경은 무채색 잿빛');
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('복습전: 막 몬스터 그림을 보스의 70%로, 이름표는 꼬마 안개', async () => {
  const { page, errors } = await open('f');
  await battle(page, 'review');
  const mon = await box(page, '.battle-monster');
  near(mon.height, 380 * 0.7, 8, '꼬마 안개 높이');
  assert.match(await page.locator('.battle-monster img').getAttribute('src'), /monster_act1\.webp/);
  assert.equal(await page.locator('.mhp-name').innerText(), '꼬마 안개');
  assert.ok(await optionsUncovered(page));
  assert.deepEqual(errors, []);
  await page.close();
});

test('타이틀: 글자는 한지 패널 위, 모습 카드는 그림이 떠도 이름이 있다', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('.title-scene .title-bg');
  for (const sel of ['.title-logo', '.title-label', '.title-help', '.title-error', '.title-notice', '.title-confirm', '.avatar-cards', '.title-actions']) {
    assert.equal(await page.locator(`.title-panel ${sel}`).count(), 1, `${sel}는 패널 안`);
  }
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.title-panel')).backgroundColor);
  assert.match(bg, /rgba?\(251, 245, 230/);
  await page.waitForSelector('.avatar-card.has-art img');
  assert.ok(await page.getByRole('radio', { name: '여자 주인공' }).isVisible());
  assert.ok(await page.getByRole('radio', { name: '남자 주인공' }).isVisible());
  // 닉네임 칸은 화면 위쪽 절반
  const input = await box(page, '#nickname');
  assert.ok(input.y + input.height < 384);
  assert.deepEqual(errors, []);
  await page.close();
});
