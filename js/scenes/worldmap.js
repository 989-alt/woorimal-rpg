// 세계 지도: 막을 마치고 다음 막으로 넘어갈 때만 나온다(막 클리어의 "세계 지도로").
// 마친 곳은 놋쇠 고리와 체크, 이번에 갈 곳은 깜박이는 흰 고리, 먼 곳은 잿빛 고리. 주인공이 점선 길을 따라 걸어간 뒤 "떠나기".
// 지도 그림(ASSETS.worldmap)이 없으면 한지 바탕에 그린 임시 지도를 보인다.
import { ACTS } from '../../data/acts/index.js';
import { WORLD } from '../../data/world.js';
import { ASSETS } from '../../data/assets.js';
import { setArt } from '../ui/images.js';
import { prefersReducedMotion } from '../ui/word-glow.js';
import { chapterOf, enterNextAct } from '../rules/game.js';
import { travelOf, worldMarks } from '../rules/world.js';

const WALK_MS = 1200;
const WALK_DELAY_MS = 400;
const MARK_LABEL = { done: '마침', next: '가는 곳', far: '아직' };

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const svgEl = (tag, attrs) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const pct = (v, total) => `${(v / total) * 100}%`;

// 임시 지도 그림(그림이 생기면 감춘다): 종이 결, 구릉·나무·냇물·고개·탑 낙서, 위쪽 안개, 나침반.
// 위쪽으로 갈수록 잿빛이 되는 바탕색은 CSS(.world-map)에 있다.
const PLACEHOLDER_ART = `
<svg viewBox="0 0 1536 864" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>
    <filter id="world-paper" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="4"/>
      <feColorMatrix values="0 0 0 0 .35  0 0 0 0 .24  0 0 0 0 .12  0 0 0 .55 0"/>
    </filter>
    <radialGradient id="world-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FFF3C8" stop-opacity=".85"/>
      <stop offset="1" stop-color="#FFF3C8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="world-cloud" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#E9EAEC" stop-opacity=".8"/>
      <stop offset="1" stop-color="#E9EAEC" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1536" height="864" filter="url(#world-paper)" opacity=".35"/>
  <ellipse cx="300" cy="740" rx="330" ry="170" fill="url(#world-glow)"/>
  <g fill="none" stroke="#6E3211" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity=".5">
    <path d="M60 800q50-60 110-8M150 820q60-70 130-10M470 830q50-50 100-6M980 830q60-60 120-8M1250 790q50-50 110-6M90 560q60-70 130-6M460 360q70-80 150-8M60 330q50-50 110-6"/>
    <path d="M150 640v-26l22-16 22 16v26zM360 790v-22l20-14 20 14v22zM250 600v-20l18-12 18 12v20zM440 690v-18l16-12 16 12v18z"/>
    <path d="M520 700l22-34 22 34zM568 716l18-28 18 28zM690 690l-10-30m10 30l-34 6m34-6l30-30M730 740l22-34 22 34zM640 650l-10-30m10 30l-30 6m30-6l26-26"/>
    <path d="M770 610q40-20 80 0t80 0t80 0t80 0" stroke="#4E7C8F" stroke-width="5" opacity=".9"/>
    <path d="M1010 760q-70-40-30-110t-30-120t30-110t100-60" stroke="#4E7C8F" stroke-width="6" opacity=".7"/>
    <path d="M300 430q40-30 90-10t60 40-40 40-90-10-20-60zM330 450q30-12 60 0" stroke="#4E7C8F" stroke-width="4" opacity=".7"/>
    <path d="M820 560l24-36 24 36zM870 580l20-30 20 30zM1180 330l30-52 30 52zM1230 350l24-40 24 40zM1000 280l26-44 26 44zM1030 252l16-22M1060 220l24-40 24 40zM1330 360l26-44 26 44z"/>
    <path d="M590 520v-16m0 16l-12 8m12-8l12 8M640 540v-16m0 16l-12 8m12-8l12 8M420 560v-16m0 16l-12 8m12-8l12 8M780 400v-16m0 16l-12 8m12-8l12 8M830 420v-16m0 16l-12 8m12-8l12 8M740 450v-16m0 16l-12 8m12-8l12 8"/>
  </g>
  <g transform="translate(-60 -92)" fill="#5E6266" fill-opacity=".6" stroke="#3E4145" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" opacity=".8">
    <path d="M1404 316V196h-10v-26h12v10h10v-10h12v10h10v-10h12v26h-10v120z"/>
    <path d="M1418 232h8v22h-8zM1414 316v-16q6-10 12 0v16" fill="#3E4145" fill-opacity=".5" stroke-width="3"/>
  </g>
  <g>
    <ellipse cx="1190" cy="210" rx="300" ry="90" fill="url(#world-cloud)"/>
    <ellipse cx="860" cy="130" rx="260" ry="80" fill="url(#world-cloud)"/>
    <ellipse cx="420" cy="170" rx="300" ry="80" fill="url(#world-cloud)" opacity=".8"/>
    <ellipse cx="1030" cy="330" rx="200" ry="60" fill="url(#world-cloud)" opacity=".7"/>
  </g>
  <g transform="translate(110 120)" fill="none" stroke="#6E3211" stroke-width="3" stroke-linejoin="round" opacity=".5">
    <circle r="44"/><circle r="30" stroke-dasharray="3 6"/>
    <path d="M0-62l9 44h-18zM0 62l9-44h-18zM-62 0l44-9v18zM62 0l-44-9v18z" fill="#C9963F"/>
  </g>
  <rect x="14" y="14" width="1508" height="836" rx="8" fill="none" stroke="#8A5E2A" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" opacity=".65"/>
</svg>`;

// 두 곳 사이의 길: 살짝 휘어진 곡선(번갈아 오른쪽·왼쪽으로).
function roadPath(a, b, i) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const bend = (i % 2 ? -1 : 1) * len * 0.16;
  const cx = mx + (-dy / len) * bend, cy = my + (dx / len) * bend;
  return `M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`;
}

function placeEl(place, mark) {
  const e = el('div', `world-place mark-${mark}`);
  e.setAttribute('role', 'img');
  e.setAttribute('aria-label', `${place.name} ${MARK_LABEL[mark]}`);
  e.style.left = pct(place.x, WORLD.size.w);
  e.style.top = pct(place.y, WORLD.size.h);
  const ring = el('span', 'world-ring');
  if (mark === 'done') ring.appendChild(el('span', 'icon icon-check'));
  e.append(ring, el('span', 'world-name', place.name));
  return e;
}

export const worldmap = {
  mount(root, params, ctx) {
    const state = ctx.getState();
    if (!state) return () => {};
    const travel = travelOf(state);
    const scene = el('section', 'end-scene worldmap-scene');
    scene.dataset.scene = 'worldmap';
    root.appendChild(scene);

    // 갈 곳이 없으면(잘못 들어옴) 지도를 그리지 않고 탐험으로 돌려보낸다.
    if (!travel) {
      let alive = true;
      queueMicrotask(() => { if (alive) ctx.router.show('explore'); });
      return () => { alive = false; scene.remove(); };
    }

    const { from, to } = travel;
    const toAct = ACTS.find((a) => a.id === to);
    const { w, h } = WORLD.size;

    // ── 지도 ──
    const frame = el('div', 'world-frame frame-plate');
    const map = el('div', 'world-map');
    setArt(map, ASSETS.worldmap, 'world-map-img art');
    const deco = el('div', 'world-deco');
    deco.innerHTML = PLACEHOLDER_ART; // 고정 그림이다(글자 입력이 들어가지 않는다)
    map.appendChild(deco);

    const roads = svgEl('svg', { class: 'world-roads', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
    const segs = WORLD.places.slice(0, -1).map((a, i) => {
      const b = WORLD.places[i + 1];
      const kind = b.act <= from ? 'done' : b.act === to ? 'next' : 'far';
      const path = svgEl('path', { class: `world-road road-${kind}`, d: roadPath(a, b, i) });
      roads.appendChild(path);
      return path;
    });
    map.appendChild(roads);

    const marks = worldMarks(state, to);
    WORLD.places.forEach((p, i) => map.appendChild(placeEl(p, marks[i].mark)));

    const hero = el('div', 'world-hero');
    hero.setAttribute('aria-hidden', 'true');
    const pin = el('div', 'world-hero-pin');
    pin.append(el('span', 'world-hero-initial', Array.from(state.nickname ?? '')[0] ?? ''));
    hero.appendChild(pin);
    const at = (x, y) => { hero.style.left = pct(x, w); hero.style.top = pct(y, h); };
    const placeOf = (act) => WORLD.places.find((p) => p.act === act);
    at(placeOf(from).x, placeOf(from).y);
    map.appendChild(hero);
    frame.appendChild(map);
    scene.appendChild(frame);

    // ── 카드 ──
    const card = el('div', 'world-card frame-panel');
    const text = el('div', 'world-card-text');
    const title = el('h2', 'world-title', `${to}막 `);
    title.appendChild(el('span', 'quote', `「${toAct.title}」`));
    text.append(title, el('p', 'world-travel', toAct.travel));
    const go = el('button', 'btn btn-green', '떠나기');
    go.type = 'button';
    card.append(text, go);
    scene.appendChild(card);

    // ── 걷기: 점선 길을 따라 from → to ──
    const segment = segs[from - 1]; // from → from + 1 (= to)
    const arrived = () => { at(placeOf(to).x, placeOf(to).y); scene.dataset.walked = 'true'; };
    let walk = null;
    if (prefersReducedMotion() || !hero.animate || !segment.getPointAtLength) {
      arrived();
    } else {
      const length = segment.getTotalLength();
      const steps = 24;
      const frames = Array.from({ length: steps + 1 }, (_, k) => {
        const p = segment.getPointAtLength((length * k) / steps);
        return { left: pct(p.x, w), top: pct(p.y, h), offset: k / steps };
      });
      scene.dataset.walking = 'true';
      walk = hero.animate(frames, { duration: WALK_MS, delay: WALK_DELAY_MS, easing: 'ease-in-out', fill: 'both' });
      walk.finished.then(() => { delete scene.dataset.walking; arrived(); walk.cancel(); }, () => {});
    }

    // ── 떠나기(한 번만) ──
    let leaving = false;
    go.addEventListener('click', () => {
      if (leaving) return;
      leaving = true;
      const now = ctx.getState();
      if (!travelOf(now)) { ctx.router.show('explore'); return; } // 이미 떠났다
      const next = enterNextAct(now);
      ctx.setState(next);
      const first = chapterOf(ACTS.find((a) => a.id === next.act), next.chapter);
      ctx.router.show('dialogue', { script: first.intro, words: [], from: '', next: 'explore' });
    });
    go.focus();

    return () => {
      leaving = true;
      walk?.cancel();
      scene.remove();
    };
  },
};
