// 주인공이 한 칸을 걷는 동안의 그려지는 자리. 규칙(state.pos)은 칸 단위 그대로 두고, 그림만 미끄러진다.
import { TILE, ART } from './scale.js';
import { HOLD_MS } from './input.js';

export const MOVE_MS = HOLD_MS; // 방향키를 누르고 있을 때 걸음이 이어지는 간격과 같아야 끊김이 없다
const GRACE_MS = 34; // 다음 걸음이 이만큼(약 두 프레임) 안에 늦게 와도 끊기지 않고 이어 붙인다
const PX = TILE * ART; // 한 칸 = 그림 48픽셀

// 칸 단위 값을 그림 픽셀(세계 1/3)에 맞춘다.
export const snapTile = (v) => Math.round(v * PX) / PX;

const lerp = (a, b, t) => a + (b - a) * t;

// from → to(칸 좌표)를 startedAt부터 ms 동안 곧게 걸었을 때 now의 자리. 그림 픽셀에 맞춘다.
export function glidePos(from, to, startedAt, now, ms = MOVE_MS) {
  const t = ms > 0 ? Math.min(1, Math.max(0, (now - startedAt) / ms)) : 1;
  return { x: snapTile(lerp(from.x, to.x, t)), y: snapTile(lerp(from.y, to.y, t)) };
}

// 지금 그려지는 자리. glide가 없거나 끝났거나, 상태의 자리(pos)와 목적지가 다르면(순간이동 등) 그냥 pos.
export function drawnPos(glide, pos, now) {
  if (!glide || glide.to.x !== pos.x || glide.to.y !== pos.y || now >= glide.startedAt + glide.ms) return { x: pos.x, y: pos.y };
  return glidePos(glide.from, glide.to, glide.startedAt, now, glide.ms);
}

export const glideEnd = (glide) => glide.startedAt + glide.ms;

// 걸음을 뗄 때의 새 미끄러짐. 앞 걸음이 막 끝났거나(늦게 온 때) 아직 진행 중(일찍 온 때)이면 끊기지 않게 잇는다.
export function nextGlide(prev, fromPos, toPos, now, ms = MOVE_MS) {
  let from = { x: fromPos.x, y: fromPos.y };
  let startedAt = now;
  if (prev && prev.to.x === fromPos.x && prev.to.y === fromPos.y) {
    const end = glideEnd(prev);
    if (now < end) from = drawnPos(prev, fromPos, now); // 일찍 온 때: 지금 보이는 자리에서 이어 간다
    else if (now - end <= GRACE_MS) startedAt = end; // 조금 늦게 온 때: 앞 걸음이 끝난 때부터 이어 붙인다
  }
  return { from, to: { x: toPos.x, y: toPos.y }, startedAt, ms };
}
