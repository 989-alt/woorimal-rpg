// 임시 그림: 진짜 그림이 오기 전까지 이름 첫 글자를 단 색 블록으로 대신한다.
// 탐험·대화·전투 장면이 함께 쓴다.
export const MEOK = '#2B2622';
export const HANJI = '#FBF5E6';

// 이름마다 늘 같은 색이 나오도록 고르는 차분한 색들
const PALETTE = ['#8E4A7A', '#3B5BA5', '#5FAE5A', '#C9A97E', '#7A5C48', '#E0584F', '#5E6266', '#B07A3A', '#4F8A8B'];

export function blockColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// 배경색 위에 읽히는 글자색(먹 또는 한지)
export function textOn(color) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!m) return MEOK;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? MEOK : HANJI;
}

export const initial = (name) => [...String(name ?? '')][0] ?? '';

// 캔버스에 색 블록 + 가운데 글자. 좌표는 지금 변환(배율) 기준.
export function drawLabelBlock(ctx, x, y, w, h, color, label, { outline = MEOK } = {}) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  if (!label) return;
  const size = Math.max(4, Math.floor(Math.min(w, h) * 0.6));
  ctx.fillStyle = textOn(color);
  ctx.font = `${size}px 'Gowun Dodum', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
}

// HTML 쪽 색 블록(가방 칸, 대화 초상 자리 등)
export function labelBlockEl(label, color, className = 'label-block') {
  const el = document.createElement('span');
  el.className = className;
  el.style.background = color;
  el.style.color = textOn(color);
  el.textContent = label;
  return el;
}
