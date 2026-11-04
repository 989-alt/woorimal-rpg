// 전투 연출: 빛줄기, 몬스터 흔들림, 빛 알갱이, 안개 조이기, 하트 금 가기.
// 모든 효과는 무대 층 안에서만 움직이고, 길어도 HIT_MS(0.8초 이하) 안에 끝난다.
// 움직임 줄이기 설정이면 흔들림·빛줄기 없이 서서히 나타나기(흐려지기)만 한다.

export const HIT_MS = 700;

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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

const anim = (node, frames, ms, fill = 'none') =>
  (typeof node.animate === 'function' ? node.animate(frames, { duration: ms, easing: 'ease-out', fill }) : null);

// 맞혔을 때: 주인공 → 몬스터 빛줄기, 몬스터 흔들림, 빛 알갱이. lastHit이면 몬스터가 흩어진다.
export function playHit(stage, { hero, monster, streak = 1, lastHit = false, still = reducedMotion() }) {
  if (still) {
    if (lastHit) anim(monster, [{ opacity: 1 }, { opacity: 0 }], HIT_MS - 100, 'forwards');
    return;
  }
  const from = centerIn(stage, hero);
  const to = centerIn(stage, monster);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const beam = div(streak >= 2 ? 'battle-beam thick' : 'battle-beam');
  beam.style.left = `${from.x}px`;
  beam.style.top = `${from.y}px`;
  beam.style.width = `${Math.hypot(dx, dy)}px`;
  beam.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  stage.appendChild(beam);
  anim(beam, [
    { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
    { opacity: 1, clipPath: 'inset(0 0 0 0)', offset: 0.45 },
    { opacity: 0, clipPath: 'inset(0 0 0 0)' },
  ], 520);
  setTimeout(() => beam.remove(), 560);

  setTimeout(() => {
    if (!monster.isConnected) return;
    anim(monster, lastHit
      ? [{ transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(1.25)', opacity: 0, filter: 'blur(6px)' }]
      : [{ translate: '0 0' }, { translate: '-8px 0' }, { translate: '8px 0' }, { translate: '-5px 0' }, { translate: '0 0' }], lastHit ? 420 : 300,
      lastHit ? 'forwards' : 'none');
    for (let i = 0; i < (lastHit ? 8 : 3); i++) {
      const s = div('battle-spark');
      s.style.left = `${to.x + (i - 1.5) * 26 + (i % 2) * 9}px`;
      s.style.top = `${to.y + 10 + (i % 3) * 14}px`;
      stage.appendChild(s);
      anim(s, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `0 ${50 + i * 6}px` }], 380);
      setTimeout(() => s.remove(), 400);
    }
  }, 240);
}

// 틀렸을 때: 무대 가장자리 안개가 잠깐 조여 든다(움직임 줄이기면 흐려지기만).
export function playMiss(fog, { still = reducedMotion() } = {}) {
  fog.classList.remove('tight', 'dim');
  void fog.offsetWidth; // 같은 효과를 다시 시작하게
  fog.classList.add(still ? 'dim' : 'tight');
}
