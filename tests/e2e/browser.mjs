import { chromium } from 'playwright';

// 로컬에 설치된 브라우저 버전이 다르면 PW_CHROMIUM_PATH로 실행 파일을 지정한다.
export function launchBrowser() {
  return chromium.launch(
    process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  );
}

// 글꼴 서버(Google Fonts)가 막혀서 생기는 읽기 실패만 무시한다.
// 그 밖의 자바스크립트 오류·콘솔 오류(우리 파일의 404 포함)는 모두 모은다.
const FONT_HOST = /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//;

export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (FONT_HOST.test(m.location().url || '')) return;
    errors.push(`console: ${m.text()} (${m.location().url})`);
  });
  return errors;
}

// 대화를 끝까지 넘긴다: 카드가 뜨면 '확인'을 누르고, 아니면 스페이스. 끝나면 `until` 장면에서 멈춘다.
export async function finishDialogue(page, until = 'explore') {
  for (let i = 0; i < 120; i++) {
    if (await page.locator(`[data-scene="${until}"]`).count()) return;
    const ok = page.locator('.word-card button');
    if (await ok.count()) await ok.click();
    else await page.keyboard.press('Space');
    await page.waitForTimeout(220);
  }
  throw new Error('대화가 끝나지 않았다');
}
