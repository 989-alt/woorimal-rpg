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
    near(dlg.width, 1366 - 48, 1, '상자 폭(좌우 24px)');
    near(dlg.height, 200, 1, '상자 높이');
    near(768 - (dlg.y + dlg.height), 16, 1, '상자 아래 틈');
    near(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.dialogue-text')).fontSize)), 28, 0.5, '대사 글자');
    // 이름 리본: 상자 위 테에 걸친다(세로 가운데가 상자 위끝 근처), 주인공 줄은 왼쪽 절반
    const tag = await box(page, '.name-tag');
    assert.ok(tag.y < dlg.y && dlg.y < tag.y + tag.height, `리본이 상자 위끝에 걸침 (tag ${tag.y}+${tag.height}, box ${dlg.y})`);
    near(tag.y + tag.height / 2, dlg.y, 12, '리본 세로 가운데');
    assert.ok(tag.x + tag.width < 683, '주인공 줄 리본은 왼쪽 절반');
    near(tag.x, 56, 2, '주인공 리본 왼쪽 자리(x 56)');
    assert.ok(tag.width >= 200 && tag.height >= 52, `리본 크기 ${tag.width}x${tag.height}`);
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
    // 시안 ui-04: 몬스터 명판(위 12·오른쪽 끝 1342), 주인공 명판(묶음 위끝 8 위), 말풍선 꼬리는 몬스터 쪽
    const mhp = await box(page, '.battle-mhp.frame-plate');
    near(mhp.y, 12, 2, '몬스터 명판 위');
    near(mhp.x + mhp.width, 1342, 2, '몬스터 명판 오른쪽 끝');
    near(mhp.width, 440, 2, '몬스터 명판 폭');
    near(mhp.height, 56, 2, '몬스터 명판 높이');
    const status = await box(page, '.battle-status.frame-plate');
    const bundle = await box(page, '.battle-bottom');
    near(status.y + status.height, bundle.y - 8, 2, '주인공 명판 아래끝 = 묶음 위끝 - 8');
    near(status.x, 24, 2, '주인공 명판 왼쪽');
    near(status.width, 300, 2, '주인공 명판 폭');
    near(status.height, 52, 2, '주인공 명판 높이');
    const tail = await box(page, '.battle-tail');
    near(tail.x + tail.width / 2, mon.x + mon.width / 2, 24, '꼬리 가운데 x = 몬스터 상자 가운데 x');
    const q = await box(page, '.battle-question.frame-panel');
    near(q.width, 1318, 2, '말풍선 폭');
    assert.ok(q.height >= 99, `말풍선 높이 ${q.height}`);
    near(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.battle-prompt')).fontSize)), 28, 0.5, '문제 글자');
    assert.equal(await page.locator('.battle-who.frame-plate').count(), 1, '이름 표는 나무 명판');
    assert.equal(await page.locator('.battle-option.frame-card').count(), 4, '보기는 카드 틀');
    assert.equal(await page.locator('.battle-option .opt-num.coin').count(), 4, '번호는 동전');
    // 하트·HP 칸: 그림이 오면 32px · 32×20
    await page.waitForFunction(() => document.documentElement.classList.contains('ui-heart-full') && document.documentElement.classList.contains('ui-hp-cell'));
    const heart = await box(page, '.heart.full');
    near(heart.width, 32, 1, '하트');
    near(heart.height, 32, 1, '하트');
    assert.equal(await page.locator('.hearts').getAttribute('aria-label'), '하트 5개');
    const cell = await box(page, '.hp-cell:not(.lost)');
    near(cell.width, 32, 1, 'HP 칸 폭');
    near(cell.height, 20, 1, 'HP 칸 높이');
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

// 5막 보스(1440×2160): 세로 그림이면 상자가 아래로 1.5배 길어지고(폭·위끝 그대로), 아랫부분은 묶음 뒤로 간다.
// 숄 빛 자리(--shawl-x·--shawl-y, 그림 속 숄 가운데)는 묶음 위에 보여야 마지막 '나래' 문제에서 숄이 밝아지는 것이 보인다.
test('5막 보스: 세로 그림, 상자 380×570, 숄 자리는 묶음 위, 보기를 가리지 않음', async () => {
  const { page, errors } = await open('f');
  await page.evaluate(() => window.__test.goChapter('5-2'));
  await page.waitForSelector('[data-scene="explore"] .hud');
  await battle(page, 'boss');
  await page.waitForSelector('.battle-monster.tall img.battle-monster-img');
  assert.match(await page.locator('.battle-monster.tall img').getAttribute('src'), /monster_act5\.webp/);
  const mon = await box(page, '.battle-monster.tall');
  near(mon.width, 380, 8, '몬스터 상자 폭');
  near(mon.height, 570, 12, '몬스터 상자 높이');
  near(mon.y, 64, 4, '몬스터 상자 위끝(정사각 상자와 같은 자리)');
  const shawl = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.battle-monster.tall'));
    return { x: parseFloat(cs.getPropertyValue('--shawl-x')), y: parseFloat(cs.getPropertyValue('--shawl-y')) };
  });
  assert.ok(shawl.x > 0 && shawl.x < 100 && shawl.y > 0 && shawl.y < 100, `숄 자리 ${JSON.stringify(shawl)}`);
  const sx = mon.x + (mon.width * shawl.x) / 100;
  const sy = mon.y + (mon.height * shawl.y) / 100;
  const bottom = await box(page, '.battle-bottom');
  assert.ok(sy < bottom.y, `숄 자리 y ${sy.toFixed(0)} < 묶음 위끝 ${bottom.y.toFixed(0)}`);
  assert.ok(sx > 683 && sx < 1366, `숄 자리 x ${sx.toFixed(0)}`);
  assert.ok(await optionsUncovered(page), '보기가 가려지지 않는다');
  assert.deepEqual(errors, []);
  await page.close();
});

test('타이틀: 로고 상자 폭 600, 이름은 h1 글자, 메뉴 단추 340×76·첫 단추 위끝 약 470', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('.title-scene .title-bg');
  await page.waitForSelector('.title-logo.has-art img.logo-img');
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running')); // 들어오는 움직임이 끝난 뒤 잰다
  const logo = await box(page, '.title-logo');
  near(logo.width, 600, 20, '로고 폭');
  near(logo.y, 40, 4, '로고 위');
  assert.equal(await page.locator('.title-logo .logo-img').getAttribute('alt'), '');
  const first = await box(page, '.title-menu .btn-green');
  near(first.width, 340, 2, '단추 폭');
  near(first.height, 76, 2, '단추 높이');
  near(first.y, 470, 8, '첫 단추 위끝');
  assert.deepEqual(errors, []);
  await page.close();
});

test('모습 고르기: 글자는 패널·명판 위, 카드 약 260×350(3:4), 이름은 카드 안 리본, 이름 칸은 위 절반', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = collectErrors(page);
  await page.goto(server.url + '/?test=1');
  await page.waitForSelector('[data-scene="title"]');
  await page.getByRole('button', { name: '처음부터' }).click();
  await page.waitForSelector('.select-scene .title-bg');
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  for (const sel of ['.select-name .title-label', '.select-name .title-help', '.select-name .title-error']) {
    assert.equal(await page.locator(sel).count(), 1, `${sel}는 이름 패널 안`);
  }
  assert.equal(await page.locator('.select-title.frame-plate').count(), 1, '제목은 명판');
  assert.equal(await page.locator('.avatar-plate').count(), 0, '따로 떨어진 이름 상자는 없다');
  assert.equal(await page.locator('.avatar-card .ribbon').count(), 2, '이름은 카드 안 리본');
  const card = await box(page, '.avatar-card');
  // 1366×768: 이름 패널·카드·단추 사이 틈(약 31px)을 같게 두고 남는 높이를 카드에 준다
  assert.ok(card.height >= 330 && card.height <= 400, `카드 높이 ${card.height}`);
  near(card.width, card.height * 0.75, 2, '카드는 3:4');
  const bg = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('.select-name')); return c.backgroundColor + c.backgroundImage; });
  assert.ok(bg !== 'rgba(0, 0, 0, 0)none', '이름 패널은 한지 바탕');
  await page.waitForSelector('.avatar-art.has-art img');
  assert.ok(await page.getByRole('radio', { name: '여자 주인공' }).isVisible());
  assert.ok(await page.getByRole('radio', { name: '남자 주인공' }).isVisible());
  const input = await box(page, '#nickname');
  assert.ok(input.y + input.height < 384);
  const go = await box(page, '.select-go');
  assert.ok(go.y + go.height <= 768, '시작하기가 화면 안');
  assert.deepEqual(errors, []);
  await page.close();
});

// 선생님(2026-11-05): 카드가 이름 패널에 붙어 보였다(위 약 15px, 아래 단추까지 약 50px).
// 이름 패널 → 카드 틈과 카드 → 단추 틈이 같고(고른 카드가 떠오른 모습 그대로 잰다), 덩어리 전체가 세로 가운데에 있다.
for (const [w, h] of [[1366, 768], [1180, 820], [1920, 1080]]) {
  test(`모습 고르기 ${w}×${h}: 이름 패널↔카드 틈과 카드↔단추 틈이 같고(4px 안), 덩어리는 세로 가운데`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = collectErrors(page);
    await page.goto(server.url + '/?test=1');
    await page.waitForSelector('[data-scene="title"]');
    await page.getByRole('button', { name: '처음부터' }).click();
    await page.waitForSelector('.select-scene .title-bg');
    await page.locator('.avatar-card[data-avatar="m"]').click(); // 고른 카드를 바꿔도 같다
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    await page.mouse.move(0, 0); // 카드 위에 마우스를 두면 살짝 떠오른다
    await page.waitForTimeout(250); // 떠오름 전환(160ms)
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const cols = [...document.querySelectorAll('.avatar-col')].map((c) => c.getBoundingClientRect());
      const sc = document.querySelector('.select-scene');
      return {
        up: Math.min(...cols.map((c) => c.top)) - r('.select-name').bottom,
        down: r('.select-actions').top - Math.max(...cols.map((c) => c.bottom)),
        above: r('.select-title').top, below: innerHeight - r('.select-actions').bottom,
        scroll: sc.scrollHeight - sc.clientHeight,
      };
    });
    near(m.up, m.down, 4, `이름 패널↔카드 ${m.up.toFixed(1)}px, 카드↔단추 ${m.down.toFixed(1)}px`);
    assert.ok(m.up >= 20, `카드가 이름 패널에 붙지 않는다: ${m.up}`);
    near(m.above, m.below, 4, '위아래 남는 자리');
    assert.equal(m.scroll, 0, '스크롤 없이 다 보인다');
    assert.deepEqual(errors, []);
    await page.close();
  });
}
