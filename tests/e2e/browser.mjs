import { chromium } from 'playwright';

// 로컬에 설치된 브라우저 버전이 다르면 PW_CHROMIUM_PATH로 실행 파일을 지정한다.
export function launchBrowser() {
  return chromium.launch(
    process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  );
}

// 자바스크립트 오류·콘솔 오류(우리 파일의 404 포함)를 모두 모은다.
// allow: 일부러 막은 파일처럼 오류가 나도 되는 주소의 정규식(그 주소를 가리키는 콘솔 오류만 건너뛴다).
export function collectErrors(page, { allow = null } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (allow?.test(m.location().url || '')) return;
    errors.push(`console: ${m.text()} (${m.location().url})`);
  });
  return errors;
}

// 대화 한 걸음: 카드가 있으면 '확인'을 마우스로 누르고(사라질 때까지 기다림), 줄이 넘어갈 준비가 됐으면
// 스페이스(또는 key)를 누르고 그 줄이 바뀔 때까지 기다린다. 글이 나오는 중이면 스페이스로 다 보이게 하고
// 준비될 때까지 기다린다. 정해진 시간만큼 쉬지 않고, 화면에 드러난 상태(data-ready, 카드)를 기다린다.
// 돌려주는 값: 'done'(until 장면에 닿음) | { card: 낱말, bands: 그 줄의 금빛 띠 글 } | 'next' | 'reveal'
export async function dialogueStep(page, until = 'explore', key = 'Space') {
  const any = `[data-scene="${until}"], .word-card button, [data-scene="dialogue"][data-ready]`;
  if (!(await page.locator(any).count())) {
    if (await page.locator('[data-scene="dialogue"] .dialogue-arrow[hidden]').count()) await page.keyboard.press(key);
    await page.waitForSelector(any);
  }
  if (await page.locator(`[data-scene="${until}"]`).count()) return 'done';
  const card = await page.$('.word-card');
  if (card) {
    const word = await page.locator('.word-card-word').innerText();
    const bands = await page.locator('.dialogue-text .hl').allTextContents(); // 그 줄의 금빛 띠 글(보이는 꼴)
    await page.locator('.word-card button').click();
    await card.waitForElementState('hidden');
    return { card: word, bands };
  }
  // 다음 줄로 넘어갔거나(준비 표시가 지워짐) 장면이 바뀔 때까지. 누르기 전에 지켜보기를 걸어 둔다:
  // 바쁜 기계에서는 누른 뒤 기다리기를 거는 사이(200ms 넘게)에 다음 줄이 벌써 준비되어, 지워진 순간을 놓칠 수 있다.
  await page.evaluate(() => {
    const scene = document.querySelector('[data-scene="dialogue"]');
    window.__dialogueMoved = false;
    const mo = new MutationObserver(() => {
      if (scene.hasAttribute('data-ready')) return;
      window.__dialogueMoved = true;
      mo.disconnect();
    });
    mo.observe(scene, { attributes: true, attributeFilter: ['data-ready'] });
  });
  await page.keyboard.press(key);
  await page.waitForFunction(() => window.__dialogueMoved || !document.querySelector('[data-scene="dialogue"][data-ready]'));
  return 'next';
}

// 대화를 끝까지 넘긴다. 끝나면 `until` 장면에서 멈춘다. 확인한 뜻풀이 카드의 낱말 목록을 돌려준다.
export async function finishDialogue(page, until = 'explore') {
  const cards = [];
  for (let i = 0; i < 200; i++) {
    const r = await dialogueStep(page, until, i % 2 ? 'Enter' : 'Space');
    if (r === 'done') return cards;
    if (r.card) cards.push(r.card);
  }
  throw new Error('대화가 끝나지 않았다');
}

// 타이틀 단추 → 이름 입력 → (처음부터면 모습 카드) → 시작하기/이어하기.
// mode 'new'는 '처음부터', 'continue'는 '이어하기'. 타이틀 화면에서 불러야 한다.
export async function startFromTitle(page, { name, avatar = 'f', mode = 'new' }) {
  await page.waitForSelector('[data-scene="title"]');
  await page.locator('.title-menu').getByRole('button', { name: mode === 'new' ? '처음부터' : '이어하기' }).click();
  await page.waitForSelector(`[data-scene="select"][data-mode="${mode}"]`);
  await page.fill('#nickname', name);
  if (mode === 'new') await page.locator(`.avatar-card[data-avatar="${avatar}"]`).click();
  await page.locator('.select-go').click();
}
