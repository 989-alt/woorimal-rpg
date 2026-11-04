// 탐험 캔버스 그리기(임시 그림). ctx는 이미 배율이 걸려 있어 좌표는 384×216 도트 기준이다.
import { BASE_W, BASE_H } from './scale.js';
import { fogOpen } from '../rules/game.js';
import { npcMarker, hiddenGlow } from '../rules/quests.js';
import { drawLabelBlock, initial, MEOK } from '../ui/placeholder.js';

export const TILE = 16;
const WALL = '#2F6B3A';
const PATH = '#D9A55B';
const FOG = ['#B9BBBE', '#8A8D91'];
const EARTH = '#8B5E34';
const HERO = '#3B5BA5';
const WHITE = '#FFFFFF';

function clampAxis(center, mapPx, viewPx) {
  if (mapPx <= viewPx) return (mapPx - viewPx) / 2;
  return Math.min(Math.max(center - viewPx / 2, 0), mapPx - viewPx);
}

// 주인공을 가운데 두되 맵 밖은 보이지 않게 한다. 맵이 화면보다 작으면 가운데 놓는다.
export function cameraFor(map, pos) {
  return {
    x: clampAxis(pos.x * TILE + TILE / 2, map.w * TILE, BASE_W),
    y: clampAxis(pos.y * TILE + TILE / 2, map.h * TILE, BASE_H),
  };
}

const stageOf = (state, q) => state.quests[q.id]?.stage ?? 'locked';

// 지금 조사해야 하는 부탁 물건 칸(발밑 화살표)
export function questObjectSlots(state, chapter) {
  const slots = [];
  for (const q of chapter.quests) {
    if (!['fetch', 'find', 'gather'].includes(q.kind) || stageOf(state, q) !== 'active') continue;
    const gathered = state.quests[q.id]?.gathered ?? [];
    for (const t of q.targets) if (!gathered.includes(t) && !slots.includes(t)) slots.push(t);
  }
  return slots;
}

function drawTiles(ctx, map, camera, open) {
  const x0 = Math.max(0, Math.floor(camera.x / TILE));
  const y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.min(map.w - 1, Math.floor((camera.x + BASE_W) / TILE));
  const y1 = Math.min(map.h - 1, Math.floor((camera.y + BASE_H) / TILE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = map.tileAt(x, y);
      const px = x * TILE, py = y * TILE;
      if (c === '#') {
        ctx.fillStyle = WALL;
        ctx.fillRect(px, py, TILE, TILE);
      } else if (c === 'F' && !open) {
        for (let cy = 0; cy < 4; cy++) {
          for (let cx = 0; cx < 4; cx++) {
            ctx.fillStyle = FOG[(cx + cy) % 2];
            ctx.fillRect(px + cx * 4, py + cy * 4, 4, 4);
          }
        }
      } else {
        ctx.fillStyle = PATH;
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
}

function drawCircle(ctx, cx, cy, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// 흰 삼각 화살표. dir: 화살 끝이 가리키는 쪽의 각도(라디안, 0 = 오른쪽)
function drawArrow(ctx, x, y, angle, size = 6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(-size / 2, -size / 2);
  ctx.lineTo(-size / 2, size / 2);
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = MEOK;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// 인물 머리 위 말풍선 표시: 흰 바탕 + 먹색 1px 윤곽
function drawMarker(ctx, cx, top, mark) {
  const w = mark === '…' ? 11 : 9, h = 9;
  const x = Math.round(cx - w / 2), y = top - h - 3;
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = MEOK;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.beginPath(); // 꼬리
  ctx.moveTo(cx - 2, y + h - 0.5);
  ctx.lineTo(cx, y + h + 2.5);
  ctx.lineTo(cx + 2, y + h - 0.5);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = MEOK;
  ctx.font = "bold 8px 'Gowun Dodum', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mark, cx, y + h / 2 + 0.5);
}

function drawGlow(ctx, px, py, glow, time) {
  if (glow === 'none') return;
  const period = glow === 'bright' ? 1000 : 2000;
  if (time % period > 300) return;
  ctx.fillStyle = WHITE;
  ctx.fillRect(px + 4, py + 3, 1, 1);
  if (glow === 'bright') ctx.fillRect(px + 11, py + 10, 1, 1);
}

// 첫 부탁 인물 쪽 화살표: 화면 안이면 머리 위에서, 밖이면 화면 가장자리에서 그쪽을 가리킨다.
function drawTipArrow(ctx, camera, target, hero, bob) {
  const tx = target.x * TILE + TILE / 2;
  const ty = target.y * TILE - 8;
  const inView = tx >= camera.x + 8 && tx <= camera.x + BASE_W - 8 && ty - 20 >= camera.y && ty <= camera.y + BASE_H - 8;
  if (inView) {
    drawArrow(ctx, tx, ty - 20 + bob, Math.PI / 2, 8);
    return;
  }
  const hx = hero.x * TILE + TILE / 2, hy = hero.y * TILE + TILE / 2;
  const angle = Math.atan2(ty - hy, tx - hx);
  const m = 10;
  const ax = Math.min(Math.max(tx, camera.x + m), camera.x + BASE_W - m);
  const ay = Math.min(Math.max(ty, camera.y + m), camera.y + BASE_H - m);
  drawArrow(ctx, ax, ay, angle, 8);
}

export function drawExplore(ctx, { map, state, chapter, camera, time = 0, tipTarget = null, still = false }) {
  ctx.save();
  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
  drawTiles(ctx, map, camera, fogOpen(state, chapter));

  const bob = still ? 0 : Math.round(Math.sin(time / 250));
  const arrows = questObjectSlots(state, chapter);
  const glow = hiddenGlow(state, chapter);

  // 물건
  for (const obj of chapter.objects) {
    const p = map.objects[obj.slot];
    if (!p) continue;
    const px = p.x * TILE, py = p.y * TILE;
    drawLabelBlock(ctx, px + 1, py + 1, TILE - 2, TILE - 2, EARTH, initial(obj.name));
    if (obj.slot === chapter.hidden.object) drawGlow(ctx, px + 1, py + 1, glow, time);
    if (arrows.includes(obj.slot)) drawArrow(ctx, px + TILE / 2, py + TILE + 2 - bob, -Math.PI / 2, 6);
  }

  // 몬스터
  if (map.smallMonster && !state.smallGone?.[chapter.id]) {
    const { x, y } = map.smallMonster;
    drawCircle(ctx, x * TILE + 8, y * TILE + 8, 7, '#8A8D91', '#5E6266');
  }
  if (map.boss) {
    const { x, y } = map.boss;
    drawCircle(ctx, x * TILE + 8, y * TILE + 4, 14, '#5E6266', MEOK);
  }

  // 인물과 주인공: 아래쪽에 있는 것을 나중에 그린다(16×24, 발이 칸 아래에 닿게)
  const people = [];
  for (const npc of chapter.npcs) {
    const p = map.slots[npc.slot];
    if (p) people.push({ p, color: npc.color, label: initial(npc.name), mark: npcMarker(state, chapter, npc.id) });
  }
  people.push({ p: state.pos, color: HERO, label: initial(state.nickname), hero: true });
  people.sort((a, b) => a.p.y - b.p.y);
  for (const who of people) {
    const px = who.p.x * TILE, py = who.p.y * TILE - 8;
    drawLabelBlock(ctx, px, py, TILE, 24, who.color, who.label);
    if (who.hero) {
      // 바라보는 쪽에 작은 한지색 점
      const f = { up: [6, 1], down: [6, 19], left: [1, 10], right: [11, 10] }[state.facing] ?? [6, 19];
      ctx.fillStyle = '#FBF5E6';
      ctx.fillRect(px + f[0], py + f[1], 4, 4);
    }
    if (who.mark) drawMarker(ctx, px + TILE / 2, py, who.mark);
  }

  if (tipTarget) drawTipArrow(ctx, camera, tipTarget, state.pos, bob);
  ctx.restore();
}
