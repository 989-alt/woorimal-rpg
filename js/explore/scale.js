// 384×216 도트 화면을 정수 배율로 키운다.
export const BASE_W = 384;
export const BASE_H = 216;

export function computeScale(vw, vh, dpr) {
  const scale = Math.max(1, Math.floor(Math.min((vw * dpr) / BASE_W, (vh * dpr) / BASE_H)));
  return { scale, cssWidth: (BASE_W * scale) / dpr, cssHeight: (BASE_H * scale) / dpr };
}
