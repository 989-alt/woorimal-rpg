// 도감: 막별 탭과 2×5 낱말 칸.
import { WORDS } from '../../data/words.js';
import { mountOverlay } from '../ui/overlay.js';

export const ACT_COUNT = 5;

export function openCodex(root, state, { actTab = state.act, onClose, focusAfter } = {}) {
  const el = document.createElement('div');
  el.className = 'overlay codex';
  const panel = document.createElement('div');
  panel.className = 'overlay-panel frame-panel';
  const head = document.createElement('div');
  head.className = 'overlay-head';
  const title = document.createElement('h2');
  title.className = 'overlay-title frame-plate';
  title.textContent = '도감';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-wood btn-sm codex-close';
  closeBtn.textContent = '닫기';
  head.append(title, closeBtn);

  const tabs = document.createElement('div');
  tabs.className = 'codex-tabs';
  tabs.setAttribute('role', 'tablist');
  const body = document.createElement('div');
  body.className = 'codex-body';
  const grid = document.createElement('div');
  grid.className = 'codex-grid';
  grid.setAttribute('role', 'tabpanel');
  const detail = document.createElement('div');
  detail.className = 'codex-detail frame-plate';
  detail.setAttribute('aria-live', 'polite');
  body.append(grid, detail);
  panel.append(head, tabs, body);
  el.appendChild(panel);

  let current = actTab;
  const tabBtns = [];
  function showDetail(w, got) {
    detail.replaceChildren();
    const add = (cls, text) => {
      const p = document.createElement('p');
      p.className = cls;
      p.textContent = text;
      detail.appendChild(p);
    };
    if (got) {
      add('detail-word', w.word);
      add('detail-meaning', w.meaning);
      add('detail-example', w.example);
      add('detail-from', `만난 곳: ${got.from}`);
    } else {
      add('detail-meaning', '아직 못 찾은 낱말이에요.');
    }
  }
  function show(act) {
    current = act;
    tabBtns.forEach((b, i) => {
      b.setAttribute('aria-selected', String(i + 1 === act));
      b.classList.toggle('on', i + 1 === act);
      // 고른 탭은 초록 면, 나머지는 나무 면
      b.classList.toggle('btn-green', i + 1 === act);
      b.classList.toggle('btn-wood', i + 1 !== act);
    });
    grid.replaceChildren();
    const words = WORDS.filter((w) => w.act === act);
    const cells = [];
    const select = (i) => {
      cells.forEach((c, j) => c.classList.toggle('selected', i === j));
      const w = words[i];
      showDetail(w, w && state.acquired[w.id]);
    };
    for (let i = 0; i < 10; i++) {
      const w = words[i];
      const got = w && state.acquired[w.id];
      const card = document.createElement('div');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      if (got) {
        card.className = 'codex-card frame-card found';
        const name = document.createElement('p');
        name.className = 'codex-word';
        name.textContent = w.word;
        card.append(name);
      } else {
        card.className = 'codex-card frame-card unknown';
        const q = document.createElement('p');
        q.className = 'codex-q coin';
        q.setAttribute('aria-hidden', 'true');
        q.textContent = '?';
        const t = document.createElement('p');
        t.className = 'codex-meaning';
        t.textContent = '아직 못 찾음';
        card.append(q, t);
      }
      card.addEventListener('click', () => select(i));
      card.addEventListener('focus', () => select(i));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
      });
      cells.push(card);
      grid.appendChild(card);
    }
    const first = words.findIndex((w) => state.acquired[w.id]);
    if (first >= 0) select(first);
    else showDetail(null, null);
  }
  for (let a = 1; a <= ACT_COUNT; a++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'codex-tab btn btn-wood btn-sm';
    b.setAttribute('role', 'tab');
    b.textContent = `${a}막`;
    b.addEventListener('click', () => show(a));
    tabBtns.push(b);
    tabs.appendChild(b);
  }
  show(current);

  const close = mountOverlay(root, el, { label: '도감', onClose, focusAfter });
  closeBtn.addEventListener('click', close);
  tabBtns[current - 1]?.focus();
  return close;
}
