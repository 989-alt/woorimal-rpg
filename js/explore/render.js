// 탐험 캔버스 그리기. ctx에는 이미 배율(ART=3)이 걸려 있어 좌표는 384×216 세계 기준(칸 16)이다.
// 그림은 칸당 48픽셀이므로 세계 상자 크기를 정해서 그린다(맵 512×384 상자에 1536×1152 그림이 1:1).
import { BASE_W, BASE_H, TILE, ART } from './scale.js';
import { fogOpen } from '../rules/game.js';
import { npcMarker, hiddenGlow } from '../rules/quests.js';
import { drawLabelBlock, initial, MEOK } from '../ui/placeholder.js';
import { ASSETS } from '../../data/assets.js';
import { getLoaded } from '../ui/images.js';

export { TILE };
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
// view: 보이는 세계 크기 { w, h }. insetTop: 화면 위쪽 HUD가 덮는 세계 높이 — 맵과 주인공은 그 아래 영역의 가운데에 둔다
// (맨 위로 걸어도 맵 윗부분이 HUD 밑으로 들어가지 않는다).
export function cameraFor(map, pos, view = { w: BASE_W, h: BASE_H }, insetTop = 0) {
  const mapH = map.h * TILE;
  const heroY = pos.y * TILE + TILE / 2;
  const y = mapH <= view.h - insetTop
    ? (mapH - view.h - insetTop) / 2
    : Math.min(Math.max(heroY - (view.h + insetTop) / 2, 0 - insetTop), mapH - view.h);
  return { x: clampAxis(pos.x * TILE + TILE / 2, map.w * TILE, view.w), y };
}

// 세계 좌표 점 p({x, y}, 칸 단위가 아니라 세계 픽셀)가 카메라가 보는 상자 안인지(HUD 밑은 가리지 않고 센다)
export function inViewWorld(camera, view, p) {
  return p.x >= camera.x && p.x <= camera.x + view.w && p.y >= camera.y && p.y <= camera.y + view.h;
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
function drawTiles(ctx, map, camera, view, open, hasArt) {
  const x0 = Math.max(0, Math.floor(camera.x / TILE));
  const y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.min(map.w - 1, Math.floor((camera.x + view.w) / TILE));
  const y1 = Math.min(map.h - 1, Math.floor((camera.y + view.h) / TILE));
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
// invert: 깜박일 때 한 번씩 색을 뒤집어(먹색 바탕에 흰 글자) 눈에 띄게 한다.
function drawMarker(ctx, cx, top, mark, invert = false) {
  const w = mark === '…' ? 11 : 9, h = 9;
  const face = invert ? MEOK : WHITE;
  const x = Math.round(cx - w / 2), y = top - h - 3;
  ctx.fillStyle = face;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = invert ? WHITE : MEOK;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.beginPath(); // 꼬리
  ctx.moveTo(cx - 2, y + h - 0.5);
  ctx.lineTo(cx, y + h + 2.5);
  ctx.lineTo(cx + 2, y + h - 0.5);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = invert ? WHITE : MEOK;
  ctx.font = "bold 8px 'Gowun Dodum', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mark, cx, y + h / 2 + 0.5);
}

// 발이 칸 아래 줄에 닿게 놓을 세계 상자 [x, y, w, h](칸 가운데 맞춤). 인물 16×32 상자는 위 16이 칸 위로 솟고,
// 보스 32×32 상자는 칸 가운데를 중심으로 좌우 반 칸씩 넓고 위로 한 칸 솟는다(2×2칸).
export const feetRect = (tx, ty, w, h) => [tx * TILE + (TILE - w) / 2, ty * TILE + TILE - h, w, h];
function drawFeet(ctx, img, tx, ty, w, h) {
  ctx.drawImage(img, ...feetRect(tx, ty, w, h));
}
const NPC_BOX = [16, 32]; // 인물 도트(그림 48×96, 그 안의 인물은 48×72쯤)
const ICON_BOX = [16, 16]; // 물건 아이콘(그림 48×48)
const SMALL_BOX = [16, 32]; // 꼬마 몬스터(그림 48×96)
const BOSS_BOX = [32, 32]; // 보스 도트(그림 96×96, 2×2칸)

// 머리 위 표시(!·…·?)를 붙일 윗선. 도트 그림이 있으면 16×32 상자 위(칸 위 16), 임시 블록이면 블록 위(칸 위 8).
export const headTop = (tileY, hasArt) => tileY * TILE - (hasArt ? 16 : 8);

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

// 이긴 직후 돌아갈 인물 머리 위 표시가 깜박이는 단계(250ms마다 0/1)
export const blinkAt = (time) => Math.floor(time / 250) % 2;
const bobAt = (time, still) => (still ? 0 : Math.round(Math.sin(time / 250)));
// 숨은 낱말 빛무리(빛무리 = 말빛 금빛 둥근 빛이 퍼졌다 사라짐 + 빛 알갱이). 6초마다(부탁을 다 끝낸 뒤에는 3초마다) 1.2초 동안.
// 그림은 50ms 단계로만 바뀌므로, 같은 단계(animKey의 g 값)면 같은 그림이다.
export const HALO_MS = 1200;
export const HALO_STEP_MS = 50;
const HALO_GOLD = '#F2C14E';
const haloPeriod = (glow) => (glow === 'bright' ? 3000 : 6000);
// 지금이 빛무리가 보이는 때면 단계 번호(0부터), 아니면 null
export function haloStep(glow, time) {
  if (glow === 'none') return null;
  const t = time % haloPeriod(glow);
  return t < HALO_MS ? Math.floor(t / HALO_STEP_MS) : null;
}

const SPARKLES = [[-5, 0.0], [3, 0.12], [-1, 0.24], [6, 0.34]]; // [가운데에서 옆으로(세계 단위), 늦게 떠오르는 몫]
function drawSparkle(ctx, x, y, r, alpha) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.28, y - r * 0.28);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.28, y + r * 0.28);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.28, y + r * 0.28);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.28, y - r * 0.28);
  ctx.closePath();
  ctx.fillStyle = HALO_GOLD;
  ctx.fill();
  ctx.fillStyle = '#FFF6D6';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

// (cx, cy): 물건 칸 가운데(세계 좌표). 칸의 1.75배(반지름 14, 지름 28 = 84픽셀)까지 퍼진다. 움직임 줄이기면 퍼지지 않고 같은 크기로 밝아졌다 어두워지기만 한다.
function drawHalo(ctx, cx, cy, step, still) {
  const p = (step * HALO_STEP_MS) / HALO_MS;
  const env = Math.sin(Math.PI * p); // 0 → 1 → 0
  const R = 14;
  const r = still ? R * 0.85 : R * (0.4 + 0.6 * (1 - (1 - p) * (1 - p)));
  ctx.save();
  ctx.globalAlpha = (still ? 0.8 : 1) * env;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255, 246, 214, 1)');
  grad.addColorStop(0.4, 'rgba(242, 193, 78, 0.75)');
  grad.addColorStop(1, 'rgba(242, 193, 78, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (!still) {
    ctx.strokeStyle = HALO_GOLD; // 바깥으로 퍼지는 고리
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.95 * env;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 0.6; // 안쪽 둘째 고리
    ctx.globalAlpha = 0.55 * env;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    for (const [dx, late] of SPARKLES) { // 빛 알갱이: 아래에서 위로 떠오르며 사라진다
      const q = (p - late) / 0.62;
      if (q <= 0 || q >= 1) continue;
      drawSparkle(ctx, cx + dx, cy + 4 - q * 15, 2.4 - 0.7 * q, Math.sin(Math.PI * q));
    }
  }
  ctx.restore();
}

// 첫 부탁 인물 칸에 도트 그림이 그려지면 8(머리 위 표시가 그만큼 높다), 아니면 0
export function tipLift(chapter, map, target) {
  const npc = chapter.npcs.find((n) => { const p = map.slots[n.slot]; return p && p.x === target.x && p.y === target.y; });
  return npc && getLoaded(ASSETS.npcs[npc.id]) ? 8 : 0;
}

// view = { w, h, insetTop? }: 보이는 세계 크기와 위쪽 HUD가 덮는 높이.
// 첫 부탁 인물 머리 위 화살표가 화면 안에 그려지는지(그렇지 않으면 가장자리에 멈춘 화살표).
// lift: 인물 도트 그림이 있으면 머리 위 표시가 8 높아지므로 화살표도 그만큼 올린다.
function tipInView(camera, view, target, lift = 0) {
  const tx = target.x * TILE + TILE / 2;
  const ty = target.y * TILE - 8 - lift;
  return tx >= camera.x + 8 && tx <= camera.x + view.w - 8 && ty - 20 >= camera.y + (view.insetTop ?? 0) && ty <= camera.y + view.h - 8;
}

// 첫 부탁 인물 쪽 화살표: 화면 안이면 머리 위에서, 밖이면 화면 가장자리에서 그쪽을 가리킨다.
function drawTipArrow(ctx, camera, view, target, hero, bob, lift = 0) {
  const tx = target.x * TILE + TILE / 2;
  const ty = target.y * TILE - 8 - lift;
  if (tipInView(camera, view, target, lift)) {
    drawArrow(ctx, tx, ty - 20 + bob, Math.PI / 2, 8);
    return;
  }
  const hx = hero.x * TILE + TILE / 2, hy = hero.y * TILE + TILE / 2;
  const angle = Math.atan2(ty - hy, tx - hx);
  const m = 10;
  const ax = Math.min(Math.max(tx, camera.x + m), camera.x + view.w - m);
  const ay = Math.min(Math.max(ty, camera.y + (view.insetTop ?? 0) + m), camera.y + view.h - m); // 위쪽은 HUD 아래에서 멈춘다
  drawArrow(ctx, ax, ay, angle, 12); // 가장자리 화살표는 눈에 잘 띄게 더 크게
}

// heroAt: 그려지는 주인공 자리(칸 단위, 미끄러지는 중이면 소수). 없으면 state.pos.
// flashNpc: 머리 위 표시를 깜박일 인물 id(없으면 null)
export function drawExplore(ctx, { map, state, chapter, camera, view = { w: BASE_W, h: BASE_H }, time = 0, tipTarget = null, flashNpc = null, still = false, moving = false, heroAt = state.pos }) {
  ctx.save();
  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, view.w + 1, view.h + 1); // 보이는 세계 전체(맵 밖은 숲색). 분수 크기여서 한 칸 더
  ctx.translate(-Math.round(camera.x * ART) / ART, -Math.round(camera.y * ART) / ART); // 그림 픽셀(1/3 세계 단위)에 맞춘다
  const actId = Number(String(chapter.id).split('-')[0]);
  const mapArt = getLoaded(ASSETS.maps[chapter.id]);
  if (mapArt) ctx.drawImage(mapArt, 0, 0, map.w * TILE, map.h * TILE);
  drawTiles(ctx, map, camera, view, fogOpen(state, chapter), !!mapArt);

  const bob = bobAt(time, still);
  const arrows = questObjectSlots(state, chapter);
  const glow = hiddenGlow(state, chapter);

  // 물건
  for (const obj of chapter.objects) {
    const p = map.objects[obj.slot];
    if (!p) continue;
    const px = p.x * TILE, py = p.y * TILE;
    const icon = arrows.includes(obj.slot) ? getLoaded(ASSETS.items[itemIdOf(chapter, obj)]) : null;
    if (icon) drawFeet(ctx, icon, p.x, p.y, ...ICON_BOX);
    else if (!mapArt) drawLabelBlock(ctx, px + 1, py + 1, TILE - 2, TILE - 2, EARTH, initial(obj.name));
    if (obj.slot === chapter.hidden.object) {
      const step = haloStep(glow, time);
      if (step !== null) drawHalo(ctx, px + TILE / 2, py + TILE / 2, step, still);
    }
    if (arrows.includes(obj.slot)) drawArrow(ctx, px + TILE / 2, py + TILE + 2 - bob, -Math.PI / 2, 6);
  }

  // 몬스터
  if (map.smallMonster && !state.smallGone?.[chapter.id]) {
    const { x, y } = map.smallMonster;
    const art = getLoaded(ASSETS.small[actId]);
    if (art) drawFeet(ctx, art, x, y, ...SMALL_BOX);
    else drawCircle(ctx, x * TILE + 8, y * TILE + 8, 7, '#8A8D91', '#5E6266');
  }
  if (map.boss) {
    const { x, y } = map.boss;
    const art = getLoaded(ASSETS.bossPixel[actId]);
    if (art) drawFeet(ctx, art, x, y, ...BOSS_BOX);
    else drawCircle(ctx, x * TILE + 8, y * TILE + 4, 14, '#5E6266', MEOK);
  }

  // 인물과 주인공: 아래쪽에 있는 것을 나중에 그린다(그림은 16×32 상자, 임시 블록은 16×24, 발이 칸 아래에 닿게)
  const people = [];
  for (const npc of chapter.npcs) {
    const p = map.slots[npc.slot];
    if (p) people.push({ p, color: npc.color, label: initial(npc.name), mark: npcMarker(state, chapter, npc.id), art: getLoaded(ASSETS.npcs[npc.id]), flash: flashNpc === npc.id });
  }
  people.push({ p: heroAt, color: HERO, label: initial(state.nickname), hero: true, sheet: heroSheet(state) });
  people.sort((a, b) => a.p.y - b.p.y);
  for (const who of people) {
    const px = who.p.x * TILE, py = who.p.y * TILE - 8;
    if (who.art) {
      drawFeet(ctx, who.art, who.p.x, who.p.y, ...NPC_BOX);
    } else if (who.sheet) {
      const row = WALK_ROW[state.facing] ?? 0;
      // 시트는 3열 × 4줄(48픽셀 그림이면 144×384). 한 칸을 16×32 상자에 그린다.
      const cw = who.sheet.width / 3, ch = who.sheet.height / 4;
      ctx.drawImage(who.sheet, walkFrame(time, moving && !still) * cw, row * ch, cw, ch, px, who.p.y * TILE + TILE - 32, 16, 32);
    } else {
      drawLabelBlock(ctx, px, py, TILE, 24, who.color, who.label);
    }
    if (who.hero && !who.sheet) {
      // 바라보는 쪽에 작은 한지색 점
      const f = { up: [6, 1], down: [6, 19], left: [1, 10], right: [11, 10] }[state.facing] ?? [6, 19];
      ctx.fillStyle = '#FBF5E6';
      ctx.fillRect(px + f[0], py + f[1], 4, 4);
    }
    if (who.mark) drawMarker(ctx, px + TILE / 2, headTop(who.p.y, !!(who.art || who.sheet)), who.mark, who.flash && blinkAt(time) === 1);
  }

  if (tipTarget) drawTipArrow(ctx, camera, view, tipTarget, heroAt, bob, tipLift(chapter, map, tipTarget));
  ctx.restore();
}

// 시간에 따라 바뀌는 그림(발밑·머리 위 화살표 흔들림, 머리 위 표시 깜박임, 숨은 낱말 빛무리) 중 화면 안에 있는 것만의 지금 모습.
// 이 값과 상태·카메라가 그대로면 같은 그림이므로 다시 그리지 않아도 된다.
export function animKey({ map, state, chapter, camera, view = { w: BASE_W, h: BASE_H }, time = 0, tipTarget = null, flashNpc = null, still = false, moving = false, heroAt = state.pos }) {
  // 칸(위로 8px 솟은 인물·화살표 여유 포함)이 화면에 조금이라도 걸치는지
  const inView = (p) => p.x * TILE + TILE > camera.x && p.x * TILE < camera.x + view.w
    && p.y * TILE + TILE + 8 > camera.y && p.y * TILE - 8 < camera.y + view.h;
  const parts = [];
  if (!still) {
    const arrowSeen = questObjectSlots(state, chapter).some((slot) => map.objects[slot] && inView(map.objects[slot]));
    if (arrowSeen || (tipTarget && tipInView(camera, view, tipTarget, tipLift(chapter, map, tipTarget)))) parts.push(`b${bobAt(time, still)}`);
  }
  if (moving && !still && heroSheet(state)) parts.push(`w${walkFrame(time, true)}`);
  if (heroAt.x !== state.pos.x || heroAt.y !== state.pos.y) parts.push(`h${heroAt.x},${heroAt.y}`); // 미끄러지는 중
  if (flashNpc) { // 깜박이는 표시가 화면 안에 있는 동안만 250ms마다 바뀐다
    const npc = chapter.npcs.find((n) => n.id === flashNpc);
    const at = npc && map.slots[npc.slot];
    if (at && inView(at)) parts.push(`k${blinkAt(time)}`);
  }
  const glow = hiddenGlow(state, chapter);
  const spot = map.objects[chapter.hidden.object];
  if (glow !== 'none' && spot && inView(spot)) parts.push(`g${haloStep(glow, time) ?? '-'}`); // 빛무리 단계(쉴 때는 '-'로 그대로)
  return parts.join('|');
}
