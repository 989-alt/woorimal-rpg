// 탐험 캔버스 그리기(임시 그림). ctx는 이미 배율이 걸려 있어 좌표는 384×216 도트 기준이다.
import { BASE_W, BASE_H } from './scale.js';
import { fogOpen } from '../rules/game.js';
import { npcMarker, hiddenGlow } from '../rules/quests.js';
import { drawLabelBlock, initial, MEOK } from '../ui/placeholder.js';
import { ASSETS } from '../../data/assets.js';
import { getLoaded } from '../ui/images.js';

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

// 그림이 있으면 바닥·벽 색 대신 맵 그림을 깔고, 닫힌 안개 칸만 그 위에 그린다.
function drawTiles(ctx, map, camera, open, hasArt) {
  const x0 = Math.max(0, Math.floor(camera.x / TILE));
  const y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.min(map.w - 1, Math.floor((camera.x + BASE_W) / TILE));
  const y1 = Math.min(map.h - 1, Math.floor((camera.y + BASE_H) / TILE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = map.tileAt(x, y);
      const px = x * TILE, py = y * TILE;
      if (hasArt && !(c === 'F' && !open)) continue;
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

// 발이 칸 아래 줄에 닿게 그린다(그림 크기 그대로, 칸 가운데 맞춤). 16×32 도트는 위 16px이 칸 위로 솟는다.
function drawFeet(ctx, img, tx, ty) {
  ctx.drawImage(img, Math.round(tx * TILE + (TILE - img.width) / 2), ty * TILE + TILE - img.height);
}

// 주인공 걷기 시트: 한 방향 3프레임(서기·왼발·오른발), 줄 순서 아래·왼·오·위. 걸을 때 1-2-1-3 순서로 초당 8장.
const WALK_ROW = { down: 0, left: 1, right: 2, up: 3 };
const WALK_STEPS = [0, 1, 0, 2];
export const walkFrame = (time, moving) => (moving ? WALK_STEPS[Math.floor(time / 125) % 4] : 0);
const heroSheet = (state) => getLoaded(ASSETS.walk[state.avatar === 'm' ? 'm' : 'f']);

// 부탁 물건 칸에 놓을 물건 id(물건 자체의 item 또는 그 칸을 목표로 하는 부탁의 item)
function itemIdOf(chapter, obj) {
  if (obj.item?.id) return obj.item.id;
  return chapter.quests.find((q) => ['fetch', 'gather'].includes(q.kind) && q.targets.includes(obj.slot))?.item?.id;
}

const bobAt = (time, still) => (still ? 0 : Math.round(Math.sin(time / 250)));
const glowOn = (glow, time) => glow !== 'none' && time % (glow === 'bright' ? 1000 : 2000) <= 300;

function drawGlow(ctx, px, py, glow, time) {
  if (!glowOn(glow, time)) return;
  ctx.fillStyle = WHITE;
  ctx.fillRect(px + 4, py + 3, 1, 1);
  if (glow === 'bright') ctx.fillRect(px + 11, py + 10, 1, 1);
}

// 첫 부탁 인물 머리 위 화살표가 화면 안에 그려지는지(그렇지 않으면 가장자리에 멈춘 화살표)
function tipInView(camera, target) {
  const tx = target.x * TILE + TILE / 2;
  const ty = target.y * TILE - 8;
  return tx >= camera.x + 8 && tx <= camera.x + BASE_W - 8 && ty - 20 >= camera.y && ty <= camera.y + BASE_H - 8;
}

// 첫 부탁 인물 쪽 화살표: 화면 안이면 머리 위에서, 밖이면 화면 가장자리에서 그쪽을 가리킨다.
function drawTipArrow(ctx, camera, target, hero, bob) {
  const tx = target.x * TILE + TILE / 2;
  const ty = target.y * TILE - 8;
  if (tipInView(camera, target)) {
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

export function drawExplore(ctx, { map, state, chapter, camera, time = 0, tipTarget = null, still = false, moving = false }) {
  ctx.save();
  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
  const actId = Number(String(chapter.id).split('-')[0]);
  const mapArt = getLoaded(ASSETS.maps[chapter.id]);
  if (mapArt) ctx.drawImage(mapArt, 0, 0);
  drawTiles(ctx, map, camera, fogOpen(state, chapter), !!mapArt);

  const bob = bobAt(time, still);
  const arrows = questObjectSlots(state, chapter);
  const glow = hiddenGlow(state, chapter);

  // 물건
  for (const obj of chapter.objects) {
    const p = map.objects[obj.slot];
    if (!p) continue;
    const px = p.x * TILE, py = p.y * TILE;
    const icon = arrows.includes(obj.slot) ? getLoaded(ASSETS.items[itemIdOf(chapter, obj)]) : null;
    if (icon) drawFeet(ctx, icon, p.x, p.y);
    else if (!mapArt) drawLabelBlock(ctx, px + 1, py + 1, TILE - 2, TILE - 2, EARTH, initial(obj.name));
    if (obj.slot === chapter.hidden.object) drawGlow(ctx, px + 1, py + 1, glow, time);
    if (arrows.includes(obj.slot)) drawArrow(ctx, px + TILE / 2, py + TILE + 2 - bob, -Math.PI / 2, 6);
  }

  // 몬스터
  if (map.smallMonster && !state.smallGone?.[chapter.id]) {
    const { x, y } = map.smallMonster;
    const art = getLoaded(ASSETS.small[actId]);
    if (art) drawFeet(ctx, art, x, y);
    else drawCircle(ctx, x * TILE + 8, y * TILE + 8, 7, '#8A8D91', '#5E6266');
  }
  if (map.boss) {
    const { x, y } = map.boss;
    const art = getLoaded(ASSETS.bossPixel[actId]);
    if (art) drawFeet(ctx, art, x, y);
    else drawCircle(ctx, x * TILE + 8, y * TILE + 4, 14, '#5E6266', MEOK);
  }

  // 인물과 주인공: 아래쪽에 있는 것을 나중에 그린다(16×24, 발이 칸 아래에 닿게)
  const people = [];
  for (const npc of chapter.npcs) {
    const p = map.slots[npc.slot];
    if (p) people.push({ p, color: npc.color, label: initial(npc.name), mark: npcMarker(state, chapter, npc.id), art: getLoaded(ASSETS.npcs[npc.id]) });
  }
  people.push({ p: state.pos, color: HERO, label: initial(state.nickname), hero: true, sheet: heroSheet(state) });
  people.sort((a, b) => a.p.y - b.p.y);
  for (const who of people) {
    const px = who.p.x * TILE, py = who.p.y * TILE - 8;
    if (who.art) {
      drawFeet(ctx, who.art, who.p.x, who.p.y);
    } else if (who.sheet) {
      const row = WALK_ROW[state.facing] ?? 0;
      ctx.drawImage(who.sheet, walkFrame(time, moving && !still) * 16, row * 32, 16, 32, px, who.p.y * TILE + TILE - 32, 16, 32);
    } else {
      drawLabelBlock(ctx, px, py, TILE, 24, who.color, who.label);
    }
    if (who.hero && !who.sheet) {
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

// 시간에 따라 바뀌는 그림(발밑·머리 위 화살표 흔들림, 숨은 낱말 반짝임) 중 화면 안에 있는 것만의 지금 모습.
// 이 값과 상태·카메라가 그대로면 같은 그림이므로 다시 그리지 않아도 된다.
export function animKey({ map, state, chapter, camera, time = 0, tipTarget = null, still = false, moving = false }) {
  // 칸(위로 8px 솟은 인물·화살표 여유 포함)이 화면에 조금이라도 걸치는지
  const inView = (p) => p.x * TILE + TILE > camera.x && p.x * TILE < camera.x + BASE_W
    && p.y * TILE + TILE + 8 > camera.y && p.y * TILE - 8 < camera.y + BASE_H;
  const parts = [];
  if (!still) {
    const arrowSeen = questObjectSlots(state, chapter).some((slot) => map.objects[slot] && inView(map.objects[slot]));
    if (arrowSeen || (tipTarget && tipInView(camera, tipTarget))) parts.push(`b${bobAt(time, still)}`);
  }
  if (moving && !still && heroSheet(state)) parts.push(`w${walkFrame(time, true)}`);
  const glow = hiddenGlow(state, chapter);
  const spot = map.objects[chapter.hidden.object];
  if (glow !== 'none' && spot && inView(spot)) parts.push(`g${glowOn(glow, time) ? 1 : 0}`);
  return parts.join('|');
}
