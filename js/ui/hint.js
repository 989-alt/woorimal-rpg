// 안내 말풍선: 한 번에 하나, 앵커(요소 또는 자리를 돌려주는 함수) 곁에 꼬리 달린 나무 명판으로 뜬다.
// 무엇을 언제 띄울지는 js/rules/tutorial.js가 정하고, 여기서는 그리기만 한다. seenTips 기록(markTip)은 부르는 쪽 몫이므로
// 이 층은 저장과 무관하게 어디서든(다음 목표 길잡이 등) 쓸 수 있다. 클릭은 가로채지 않는다(pointer-events: none).

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// anchor {x,y,w,h}(층 안 CSS px), size {w,h}, box {w,h} → { x, y, place, arrowX }
// 앵커 가운데가 화면 위 절반이면 앵커 아래에, 아니면 위에 놓는다. arrowX는 말풍선 왼쪽 끝에서 꼬리 가운데까지.
// force('above'|'below')를 주면 자리를 그쪽으로 정한다(앵커 위쪽에 가리면 안 되는 글이 있을 때).
export function placeHint(anchor, size, box, gap = 12, margin = 16, force = null) {
  const cx = anchor.x + anchor.w / 2;
  const cy = anchor.y + anchor.h / 2;
  const below = force ? force === 'below' : cy < box.h / 2;
  const x = clamp(cx - size.w / 2, margin, box.w - size.w - margin);
  const y = below ? anchor.y + anchor.h + gap : anchor.y - size.h - gap;
  return { x, y, place: below ? 'below' : 'above', arrowX: clamp(cx - x, 16, size.w - 16) };
}

// 눈에 띄게 할 낱말(조작 이름·숫자). 긴 것부터 찾는다.
const EMPHASIS = /방향키|화살표|Space|말하기 버튼|할 일 버튼|할 일\(Q\)|도감\(E\)|도감|글 상자|1~4|하트 5개|몬스터 HP 6칸|3번|6번|금빛|확인/g;

// 글을 { text, em } 조각으로 나눈다(조각을 이으면 원래 글).
export function splitEmphasis(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(EMPHASIS)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), em: false });
    out.push({ text: m[0], em: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), em: false });
  return out;
}

function buildHint(hint) {
  const root = document.createElement('div');
  root.className = 'hint';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.dataset.tip = hint.id;
  const float = document.createElement('div'); // 이 묶음이 둥실 떠오른다(자리를 정하는 root와 움직임을 나눈다)
  float.className = 'hint-float';
  const plate = document.createElement('div');
  plate.className = 'hint-plate frame-plate';
  const body = document.createElement('div');
  body.className = 'hint-body';
  for (const line of hint.text.split('\n')) {
    const p = document.createElement('p');
    p.className = 'hint-line';
    for (const part of splitEmphasis(line)) {
      if (!part.em) { p.append(part.text); continue; }
      const b = document.createElement('b');
      b.className = 'hint-em';
      b.textContent = part.text;
      p.append(b);
    }
    body.append(p);
  }
  const tail = document.createElement('span');
  tail.className = 'hint-tail';
  tail.setAttribute('aria-hidden', 'true');
  plate.append(body);
  float.append(plate, tail);
  root.append(float);
  return root;
}

// container 안에 안내 층을 만든다. 돌려주는 것:
//  show(hint, anchor, { place }) — hint는 dueHint가 준 { id, text, until, ms }. anchor는 요소 또는 () => {x,y,w,h} | null (층 안 CSS px).
//                       앵커가 아직 없으면(null) 자리가 잡힐 때까지 숨겨 둔다. place('above'|'below')는 자리를 정해 줄 때만 준다.
//  done(reason) — 지금 안내의 until이 reason일 때만 닫는다. 닫았으면 true.
//  reposition() — 앵커가 움직였을 수 있을 때(그릴 때마다, 창 크기가 바뀔 때) 다시 놓는다.
//  clear() — 무조건 닫는다.   dispose() — 층을 지운다.   current — 지금 안내 또는 null.
export function createHintLayer(container) {
  const layer = document.createElement('div');
  layer.className = 'hint-layer';
  layer.setAttribute('aria-live', 'off');
  container.appendChild(layer);
  let node = null;
  let anchor = null;
  let force = null;
  let timer = 0;
  const api = { current: null };

  const rectOf = () => {
    if (!anchor) return null;
    if (typeof anchor === 'function') return anchor();
    const a = anchor.getBoundingClientRect();
    const l = layer.getBoundingClientRect();
    if (!a.width && !a.height) return null; // 지워졌거나 숨겨진 요소
    return { x: a.left - l.left, y: a.top - l.top, w: a.width, h: a.height };
  };

  api.reposition = () => {
    if (!node) return;
    const rect = rectOf();
    if (!rect) { node.style.visibility = 'hidden'; return; }
    const size = { w: node.offsetWidth, h: node.offsetHeight };
    const box = { w: layer.clientWidth, h: layer.clientHeight };
    const p = placeHint(rect, size, box, 12, 16, force);
    node.style.left = `${Math.round(p.x)}px`;
    node.style.top = `${Math.round(p.y)}px`;
    node.style.setProperty('--arrow-x', `${Math.round(p.arrowX)}px`);
    node.dataset.place = p.place;
    node.style.visibility = 'visible';
    node.dataset.ready = ''; // 처음 자리가 잡힌 때부터 나타나기를 시작한다
  };

  api.clear = () => {
    clearTimeout(timer);
    timer = 0;
    node?.remove();
    node = null;
    anchor = null;
    force = null;
    api.current = null;
  };

  api.show = (hint, anchorOf, { place = null } = {}) => {
    api.clear();
    api.current = hint;
    anchor = anchorOf;
    force = place;
    node = buildHint(hint);
    node.style.visibility = 'hidden';
    layer.appendChild(node);
    if (hint.ms) timer = window.setTimeout(api.clear, hint.ms);
    if (window.__test) {
      const scene = container.dataset?.scene ?? container.closest?.('[data-scene]')?.dataset.scene ?? null;
      (window.__test.hints ??= []).push({ id: hint.id, scene });
    }
    // 자리는 다음 그림 틀에서 잡는다. 장면을 만드는 도중에 배치·글꼴 정보를 건드리면(강제 배치) 방금 단 클래스가
    // 바뀜 효과(transition)로 번져 어두워지는 인물 그림이 번쩍인다. 글꼴이 늦게 와서 글 자리가 바뀌면 한 번 더 놓는다.
    const mine = node;
    requestAnimationFrame(() => {
      if (node !== mine) return;
      api.reposition();
      document.fonts?.ready.then(() => { if (node === mine) api.reposition(); });
    });
  };

  api.done = (reason) => {
    if (!api.current || api.current.until !== reason) return false;
    api.clear();
    return true;
  };

  api.dispose = () => {
    api.clear();
    layer.remove();
  };

  return api;
}
