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
