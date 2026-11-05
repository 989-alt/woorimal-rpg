// 전투 연출. 정답 한 번이 HIT_MS(0.8초) 안에 차례로 보인다.
//   0~0.32초  주인공 손끝에서 맞힌 낱말이 금빛으로 떠올라 곡선을 그리며 몬스터에게 날아간다(꼬리 빛 줄).
//   0.32초    맞는 순간: 번쩍 + 금빛 파동 + 빛 알갱이 + 몬스터 흔들림 + 화면 짧은 흔들림 + HP 칸이 깨지며 금 조각.
//   연속 3번 이상이면 파동 2겹, 알갱이 1.5배. 마지막 일격이면 몬스터가 잿빛 안개 조각으로 흩어지고 그 자리에 빛이 퍼진다.
// 움직임 줄이기: 날아가기·흔들림·화면 흔들림 없이 서서히 나타나고 흐려지기만 한다.
// 모든 효과는 무대 층 안에서만 움직이고, 시작할 때 한꺼번에 만들어 지연(delay)으로 순서를 잡는다(끝나면 스스로 지워짐).

export const HIT_MS = 800;
export const IMPACT_MS = 320; // 낱말이 몬스터에 닿는 때

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const SPARKS = 14; // 기본 알갱이 수(12~16)
export const COMBO_FROM = 3; // 이 연속 정답부터 파동 2겹

// 이번 정답의 연출 계획(순수 함수, 숫자는 모두 ms·px). 움직임 줄이기면 흔들림·날아가기 없이 서서히 나타나기만.
export function hitPlan({ streak = 1, lastHit = false, still = false } = {}) {
  const combo = streak >= COMBO_FROM;
  if (still) {
    return {
      still: true, combo, fly: null, rings: [], sparks: 0, flash: null, burst: null, cell: null, mist: null, bloom: null,
      monsterShake: [], screenShake: [],
      glow: { delay: 0, duration: 500 },
      dissolve: lastHit ? { delay: 150, duration: 600 } : null,
    };
  }
  const rings = [{ delay: IMPACT_MS, duration: 440, scale: 2 }];
  if (combo) rings.push({ delay: IMPACT_MS + 90, duration: 390, scale: 2.7 });
  return {
    still: false,
    combo,
    fly: { delay: 0, duration: IMPACT_MS, trail: 7 },
    flash: { delay: IMPACT_MS, duration: 200 },
    burst: { delay: IMPACT_MS, duration: 380 }, // 사방으로 번지는 빛살
    monsterFlash: lastHit ? null : { delay: IMPACT_MS, duration: 240 }, // 맞은 몬스터가 하얗게 번쩍
    rings,
    sparks: combo ? Math.round(SPARKS * 1.5) : SPARKS,
    sparkTrack: { delay: IMPACT_MS, duration: 380, spread: 20 }, // 알갱이마다 시작·길이가 조금씩 다르다
    cell: { delay: IMPACT_MS, duration: 440, shards: 6 },
    monsterShake: lastHit ? [] : [0, -12, 10, -7, 4, 0], // px, 몬스터는 좌우 12
    monsterShakeTrack: { delay: IMPACT_MS, duration: 300 },
    screenShake: [0, -4, 4, -2, 0], // px, 화면은 좌우 4
    screenShakeTrack: { delay: IMPACT_MS, duration: 120 },
    mist: lastHit ? { count: 14, delay: IMPACT_MS, duration: 400, spread: 40 } : null,
    bloom: lastHit ? { delay: IMPACT_MS, duration: 470 } : null,
    dissolve: lastHit ? { delay: IMPACT_MS, duration: 440 } : null,
    glow: null,
  };
}

// 계획에 든 모든 움직임을 {name, delay, duration}으로 펼친다(가장 늦게 끝나는 것을 재기 쉽게, 검사용).
export function planTracks(plan) {
  const t = [];
  const push = (name, o, extra = 0) => { if (o) t.push({ name, delay: o.delay, duration: o.duration + extra }); };
  push('fly', plan.fly);
  plan.fly && push('trail', { delay: plan.fly.delay + plan.fly.trail * TRAIL_STEP, duration: plan.fly.duration });
  push('flash', plan.flash);
  push('burst', plan.burst);
  push('monsterFlash', plan.monsterFlash);
  plan.rings.forEach((r, i) => push(`ring${i}`, r));
  if (plan.sparks) push('sparks', plan.sparkTrack, plan.sparkTrack.spread + SPARK_EXTRA);
  push('cell', plan.cell);
  if (plan.monsterShake.length) push('monsterShake', plan.monsterShakeTrack);
  if (plan.screenShake.length) push('screenShake', plan.screenShakeTrack);
  push('mist', plan.mist, plan.mist?.spread ?? 0);
  push('bloom', plan.bloom);
  push('dissolve', plan.dissolve);
  push('glow', plan.glow);
  return t;
}
const TRAIL_STEP = 22;
const SPARK_EXTRA = 45; // 알갱이마다 길이가 0~45ms 더 길다

const div = (className) => {
  const e = document.createElement('div');
  e.className = className;
  return e;
};

const centerIn = (box, node) => {
  const a = box.getBoundingClientRect();
  const b = node.getBoundingClientRect();
  return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 };
};

const anim = (node, frames, opts) =>
  (typeof node.animate === 'function' ? node.animate(frames, { easing: 'ease-out', fill: 'none', ...opts }) : null);

// 같은 낱말이면 늘 같은 모양이 되게, 난수 대신 번호로 흩뿌린다(0~1)
const scatter = (i, salt = 0) => {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 손끝에서 몬스터까지 위로 불룩한 곡선(2차 베지어)을 따라가는 transform 틀
function flyFrames(from, to, { scaleFrom = 0.7, scaleTo = 1.3, steps = 14, spin = true } = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bulge = Math.max(70, Math.hypot(dx, dy) * 0.3);
  const ctrl = { x: from.x + dx * 0.4, y: Math.min(from.y, to.y) - bulge };
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const u = 1 - t;
    const x = u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x;
    const y = u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y;
    const s = scaleFrom + (scaleTo - scaleFrom) * t;
    return {
      offset: t,
      opacity: Math.min(t / 0.06, (1 - t) / 0.12, 1), // 나타났다가 몬스터에 닿으며 스며든다
      transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})${spin ? ` rotate(${-10 + 16 * t}deg)` : ''}`,
    };
  });
}

// 맞혔을 때. layer는 무대 위 효과 층(.battle-fx), hand는 주인공 손끝, world는 화면 흔들림을 받는 층,
// cell은 방금 잃은 HP 칸(없으면 안 부숨), word는 날아가는 낱말. lastHit이면 몬스터가 흩어진다.
// 돌려주는 값: 연출 계획(검사용).
export function playHit(layer, { hand, monster, world = null, cell = null, word = '', streak = 1, lastHit = false, still = reducedMotion() }) {
  const plan = hitPlan({ streak, lastHit, still });
  const nodes = [];
  const add = (className) => {
    const n = div(className);
    layer.appendChild(n);
    nodes.push(n);
    return n;
  };
  const to = centerIn(layer, monster);
  const monBox = monster.getBoundingClientRect();
  const size = monBox.width || 380;
  const k = size / 380; // 몬스터가 작은 복습전이면 효과도 작게

  // 움직임 줄이기: 금빛이 서서히 켜졌다 꺼지고, 마지막이면 몬스터가 서서히 흐려진다.
  if (plan.still) {
    const glow = add('fx-glow');
    glow.style.cssText = `left:${to.x}px;top:${to.y}px;width:${size}px;height:${size}px`;
    anim(glow, [{ opacity: 0 }, { opacity: 0.8, offset: 0.4 }, { opacity: 0 }], { duration: plan.glow.duration, easing: 'ease-in-out' });
    if (plan.dissolve) anim(monster, [{ opacity: 0 }], { ...plan.dissolve, fill: 'forwards', easing: 'ease-in-out' });
    setTimeout(() => nodes.forEach((n) => n.remove()), HIT_MS - 10);
    return plan;
  }

  // 1) 낱말 날아가기 + 꼬리 빛 줄
  const from = centerIn(layer, hand);
  const target = { x: to.x - 24 * k, y: to.y - 10 * k };
  const fly = add(`fx-word-fly${plan.combo ? ' big' : ''}`);
  fly.textContent = word;
  anim(fly, flyFrames(from, target), { duration: plan.fly.duration, delay: plan.fly.delay, easing: 'cubic-bezier(.45,.05,.75,.5)', fill: 'both' });
  for (let i = 0; i < plan.fly.trail; i++) {
    const dot = add('fx-trail');
    const s = Math.max(6, 16 - i * 1.6);
    dot.style.cssText = `width:${s}px;height:${s}px;--a:${(0.85 - i * 0.09).toFixed(2)}`;
    anim(dot, flyFrames(from, target, { scaleFrom: 0.8, scaleTo: 0.5, spin: false }).map((f) => ({ ...f, opacity: f.opacity * (0.85 - i * 0.09) })), {
      duration: plan.fly.duration, delay: plan.fly.delay + (i + 1) * TRAIL_STEP, easing: 'cubic-bezier(.45,.05,.75,.5)', fill: 'both',
    });
  }

  // 2) 맞는 순간
  const flash = add('fx-flash');
  flash.style.cssText = `left:${to.x}px;top:${to.y}px;width:${150 * k}px;height:${150 * k}px`;
  anim(flash, [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(.3)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(.9)', offset: 0.3 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1.5)' },
  ], { ...plan.flash, fill: 'both' });

  const burst = add('fx-burst');
  burst.style.cssText = `left:${to.x}px;top:${to.y}px;width:${size * 0.95}px;height:${size * 0.95}px`;
  anim(burst, [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(.3) rotate(0deg)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(.75) rotate(10deg)', offset: 0.25 },
    { opacity: 0, transform: `translate(-50%, -50%) scale(${plan.combo ? 1.35 : 1.1}) rotate(22deg)` },
  ], { ...plan.burst, fill: 'both' });
  if (plan.monsterFlash) {
    anim(monster, [{ filter: 'brightness(1)' }, { filter: 'brightness(2.1) saturate(.3)', offset: 0.2 }, { filter: 'brightness(1)' }], { ...plan.monsterFlash, easing: 'ease-out' });
  }

  plan.rings.forEach((r, i) => {
    const ring = add(`fx-ring${i ? ' second' : ''}`);
    const d = size * (i ? 0.32 : 0.4);
    ring.style.cssText = `left:${to.x}px;top:${to.y}px;width:${d}px;height:${d}px`;
    anim(ring, [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(.25)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(.6)', offset: 0.15 },
      { opacity: 0, transform: `translate(-50%, -50%) scale(${r.scale})` },
    ], { delay: r.delay, duration: r.duration, fill: 'both' });
  });

  for (let i = 0; i < plan.sparks; i++) {
    const sp = add('fx-spark');
    const a = (i / plan.sparks) * Math.PI * 2 + scatter(i) * 0.5;
    const dist = (100 + scatter(i, 1) * 130) * k * (plan.combo ? 1.15 : 1);
    const px = 9 + Math.round(scatter(i, 2) * 8);
    sp.style.cssText = `left:${to.x}px;top:${to.y}px;--size:${px}px`;
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist * 0.8;
    anim(sp, [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(.4)' },
      { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.25}px), calc(-50% + ${dy * 0.25}px)) scale(1)`, offset: 0.12 },
      { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.3)` },
    ], {
      delay: plan.sparkTrack.delay + (i % 3) * (plan.sparkTrack.spread / 2),
      duration: plan.sparkTrack.duration + (i % 4) * (SPARK_EXTRA / 3),
      fill: 'both',
    });
  }

  const shake = (node, px, track) => anim(node, px.map((v) => ({ translate: `${v}px 0` })), { ...track, easing: 'linear' });
  if (plan.monsterShake.length) shake(monster, plan.monsterShake, plan.monsterShakeTrack);
  if (world && plan.screenShake.length) shake(world, plan.screenShake, plan.screenShakeTrack);

  // 3) HP 칸이 깨지며 금 조각(칸 자체는 CSS가 둘로 갈라진다)
  if (cell) {
    const c = centerIn(layer, cell);
    for (let i = 0; i < plan.cell.shards; i++) {
      const sh = add('fx-shard');
      const dir = i % 2 ? 1 : -1;
      const dx = dir * (10 + scatter(i, 3) * 30);
      const up = -(14 + scatter(i, 4) * 22);
      const fall = 26 + scatter(i, 5) * 34;
      sh.style.cssText = `left:${c.x}px;top:${c.y}px;--w:${8 + Math.round(scatter(i, 6) * 6)}px`;
      anim(sh, [
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(0deg)' },
        { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% + ${up}px)) rotate(${dir * 90}deg)`, offset: 0.2 },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${fall}px)) rotate(${dir * (200 + i * 40)}deg)` },
      ], { delay: plan.cell.delay, duration: plan.cell.duration, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'both' });
    }
  }

  // 4) 마지막 일격: 몬스터가 잿빛 안개 조각으로 흩어지고, 그 자리에 빛이 퍼진다(무섭지 않게 구해 내는 느낌)
  if (plan.dissolve) {
    anim(monster, [{ opacity: 0, filter: 'blur(9px) brightness(1.5)', transform: 'scale(1.08)' }], { ...plan.dissolve, fill: 'forwards', easing: 'ease-in' });
    for (let i = 0; i < plan.mist.count; i++) {
      const m = add('fx-mist');
      const ang = scatter(i, 7) * Math.PI * 2;
      const r0 = scatter(i, 8) * size * 0.3;
      const x0 = to.x + Math.cos(ang) * r0;
      const y0 = to.y + Math.sin(ang) * r0 * 0.9;
      const d = (70 + scatter(i, 9) * 70) * k;
      m.style.cssText = `width:${d}px;height:${d}px`;
      anim(m, [
        { opacity: 0, transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(.6)` },
        { opacity: 0.85, offset: 0.22 },
        {
          opacity: 0,
          transform: `translate(${x0 + Math.cos(ang) * 120 * k}px, ${y0 + Math.sin(ang) * 60 * k - (40 + scatter(i, 10) * 70) * k}px) translate(-50%, -50%) scale(1.8)`,
        },
      ], { delay: plan.mist.delay + (i % 4) * (plan.mist.spread / 3), duration: plan.mist.duration, fill: 'both' });
    }
    const bloom = add('fx-bloom');
    bloom.style.cssText = `left:${to.x}px;top:${to.y}px;width:${size * 1.3}px;height:${size * 1.3}px`;
    anim(bloom, [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(.2)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(.85)', offset: 0.35 },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(1.5)' },
    ], { ...plan.bloom, fill: 'both' });
  }

  setTimeout(() => nodes.forEach((n) => n.remove()), HIT_MS - 10);
  return plan;
}

// 틀렸을 때. 안개가 주인공 쪽으로 조여 들고(움직임 줄이기면 흐려지기만), 하트가 금 가는 것은 drawFrame이 단다.
// 복습전(하트가 줄지 않음)은 몬스터가 살짝 웃듯 흔들리기만 한다.
export function playMiss(fog, { still = reducedMotion(), monster = null, review = false } = {}) {
  fog.classList.remove('tight', 'dim');
  void fog.offsetWidth; // 같은 효과를 다시 시작하게
  fog.classList.add(still ? 'dim' : 'tight');
  if (still || !monster) return;
  if (review) {
    anim(monster, [{ translate: '0 0' }, { translate: '0 -7px' }, { translate: '0 0' }, { translate: '0 -5px' }, { translate: '0 0' }], { duration: 520, easing: 'ease-in-out' });
  } else {
    anim(monster, [{ translate: '0 0', scale: '1' }, { translate: '-16px 4px', scale: '1.04', offset: 0.35 }, { translate: '0 0', scale: '1' }], { duration: 420, easing: 'ease-out' });
  }
}
