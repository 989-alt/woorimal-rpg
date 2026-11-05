// UI 키트 그림 불러오기. 그림을 받은 키만 <html>에 `ui-<키>` 클래스와 `--ui-<키>` 변수를 달아
// css/ui-kit.css의 그림 규칙(`:root.ui-<키> ...`)을 켠다. 못 받은 키는 클래스를 떼어 두어 CSS 바탕 모습이 보인다.
import { ASSETS } from '../../data/assets.js';
import { loadImage } from './images.js';

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// 'btnGreen' → '--ui-btn-green'
export const uiVarName = (key) => `--ui-${kebab(key)}`;
// 'btnGreen' → 'ui-btn-green'
export const uiClassName = (key) => `ui-${kebab(key)}`;

// 키마다 그림을 받는다. 다시 불러도 된다(불러온 그림은 images.js가 캐시하고, 못 받은 것만 forgetFailed() 뒤에 다시 받는다).
// 돌려주는 값: { ok: 달린 키들, failed: 못 받은 키들 }. 거부(reject)하지 않는다.
export async function loadUiKit(root = document.documentElement) {
  const keys = Object.keys(ASSETS.ui);
  const result = { ok: [], failed: [] };
  await Promise.all(keys.map(async (key) => {
    const path = ASSETS.ui[key];
    const img = await loadImage(path);
    if (img) {
      // 풀 주소(img.src)를 쓴다: 상대 경로는 CSS 변수를 쓰는 css/ui-kit.css 기준으로 풀려 css/assets/…로 간다.
      root.style.setProperty(uiVarName(key), `url("${img.src}")`);
      root.classList.add(uiClassName(key));
      result.ok.push(key);
    } else {
      root.classList.remove(uiClassName(key));
      result.failed.push(key);
    }
  }));
  return result;
}
