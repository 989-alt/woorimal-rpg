// 낱말이 빛을 되찾는 순간: 잿빛(.word-dim) → 말빛 금색(.word-lit)과 위로 흩어지는 빛 알갱이.
// 아트 바이블 원칙 1: 빛은 말이 살아나는 순간에만 쓴다. 움직임 줄이기에서는 알갱이 없이 바로 금빛.
export const MOTE_COUNT = 10;

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 알갱이 하나의 자리와 움직임(0~1 사이 값 하나로 정해 같은 낱말이면 늘 같은 모양). 검사하기 쉽게 순수 함수로 둔다.
export function motePlan(i, count = MOTE_COUNT) {
  const t = count <= 1 ? .5 : i / (count - 1);
  return {
    left: Math.round(8 + t * 84), // 낱말 가로 8~92%
    dx: Math.round((t - .5) * 36 + (i % 2 ? 6 : -6)), // 좌우로 조금 흩어짐(px)
    rise: 34 + (i % 3) * 16, // 위로 오르는 길이(px)
    delay: i * 50, // ms
    size: 6 + (i % 3) * 2, // px
  };
}

// el의 잿빛 표시를 금빛으로 바꾼다. 알갱이는 el 안에 붙었다가 끝나면 스스로 지워진다.
export function igniteWord(el) {
  el.classList.remove('word-dim');
  el.classList.add('word-lit');
  if (prefersReducedMotion()) return;
  el.classList.add('ignite');
  for (let i = 0; i < MOTE_COUNT; i++) {
    const m = motePlan(i);
    const d = document.createElement('span');
    d.className = 'word-mote';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = `left:${m.left}%;--dx:${m.dx}px;--rise:${m.rise}px;--size:${m.size}px;animation-delay:${m.delay}ms`;
    d.addEventListener('animationend', () => d.remove(), { once: true });
    el.appendChild(d);
  }
}
