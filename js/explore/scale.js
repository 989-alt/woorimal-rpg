// 탐험 화면: 세계 좌표는 칸 16, 그림은 칸당 48픽셀(ART=3). 기준 화면은 384×216 세계(1152×648 픽셀)이고,
// 창이 더 크면 키우지 않고 세계를 더 보여 준다(1366×768 크롬북에서 1:1).
export const BASE_W = 384;
export const BASE_H = 216;
export const TILE = 16; // 칸 하나의 세계 크기
export const ART = 3; // 세계 좌표 1 = 그림 3픽셀 (칸 16 → 48픽셀)
export const CANVAS_W = BASE_W * ART;
export const CANVAS_H = BASE_H * ART;

// 창 크기(CSS px)로 탐험 화면의 캔버스 크기와 보이는 세계 크기를 구한다.
// 캔버스는 늘 창을 꽉 채운다(CSS 크기 = 창 크기). 창이 1152×648보다 작으면 factor로 줄여 보이고(캔버스 안쪽은 그만큼 크게),
// 크면 키우지 않고 세계를 더 보여 준다(factor 1이면 1:1, 칸당 48픽셀).
export function computeView(winW, winH) {
  const factor = Math.max(0.01, Math.min(1, winW / CANVAS_W, winH / CANVAS_H));
  const canvasW = Math.round(winW / factor);
  const canvasH = Math.round(winH / factor);
  return { factor, canvasW, canvasH, cssW: winW, cssH: winH, viewW: canvasW / ART, viewH: canvasH / ART };
}
