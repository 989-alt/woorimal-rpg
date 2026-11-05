// 이름 리본 글자색: 리본 색이 밝으면 먹색, 어두우면 흰색(먹색 윤곽을 함께 둔다).
// 상대 휘도(WCAG)가 0.45를 넘으면 밝은 리본으로 본다.
const INK = '#2B2622';
const WHITE = '#FFFFFF';
const THRESHOLD = 0.45;

export function relativeLuminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function ribbonInk(hex) {
  return relativeLuminance(hex) > THRESHOLD ? INK : WHITE;
}
