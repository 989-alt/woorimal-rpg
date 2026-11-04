// 탐험 화면: 세계 좌표는 384×216(칸 16), 그림은 칸당 48픽셀이라 캔버스 안쪽 크기는 그 3배인 1152×648로 고정한다.
// 화면에 보이는 크기는 1152×648을 넘지 않게 줄이기만 한다(1366×768 크롬북에서 1:1).
export const BASE_W = 384;
export const BASE_H = 216;
export const TILE = 16; // 칸 하나의 세계 크기
export const ART = 3; // 세계 좌표 1 = 그림 3픽셀 (칸 16 → 48픽셀)
export const CANVAS_W = BASE_W * ART;
export const CANVAS_H = BASE_H * ART;

// availW·availH: 캔버스를 놓을 수 있는 CSS 크기(HUD 높이는 이미 뺀 값).
// factor가 1이면 1:1(도트를 또렷하게), 1보다 작으면 줄여 보인다.
export function computeScale(availW, availH) {
  const factor = Math.max(0.01, Math.min(1, availW / CANVAS_W, availH / CANVAS_H));
  return { factor, cssWidth: CANVAS_W * factor, cssHeight: CANVAS_H * factor };
}
