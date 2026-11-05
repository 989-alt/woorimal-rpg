// 세계 지도: 막을 마치고 다음 막으로 넘어갈 때만 나온다(막 클리어의 "세계 지도로").
// 마친 곳은 놋쇠 고리와 체크, 이번에 갈 곳은 깜박이는 흰 고리, 먼 곳은 잿빛 고리. 주인공이 점선 길을 따라 걸어간 뒤 "떠나기".
// 지도 그림(ASSETS.worldmap)이 없으면(불러오지 못하면) 아래 밝고 위로 갈수록 잿빛인 바탕색(CSS)만 보인다.
import { ACTS } from '../../data/acts/index.js';
import { WORLD } from '../../data/world.js';
import { ASSETS } from '../../data/assets.js';
import { setArt } from '../ui/images.js';
import { prefersReducedMotion } from '../ui/word-glow.js';
import { chapterOf, enterNextAct } from '../rules/game.js';
import { sfx } from '../ui/audio.js';
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
    // 고른 모습의 걷기 도트(아래 보고 선 칸). 그림이 없으면 쪽빛 핀이 보인다.
    setArt(hero, ASSETS.walk[state.avatar === 'm' ? 'm' : 'f'], 'world-hero-art');
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
      sfx('travel');
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
