// 도감: 막별 탭과 2×5 낱말 칸.
import { WORDS } from '../../data/words.js';
import { mountOverlay } from '../ui/overlay.js';

export const ACT_COUNT = 5;

export function openCodex(root, state, { actTab = state.act, onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'overlay codex';
  const panel = document.createElement('div');
  panel.className = 'overlay-panel';
  const head = document.createElement('div');
  head.className = 'overlay-head';
  const title = document.createElement('h2');
  title.textContent = '도감';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'big-button codex-close';
  closeBtn.textContent = '닫기';
  head.append(title, closeBtn);

  const tabs = document.createElement('div');
  tabs.className = 'codex-tabs';
  tabs.setAttribute('role', 'tablist');
  const grid = document.createElement('div');
  grid.className = 'codex-grid';
  grid.setAttribute('role', 'tabpanel');
  panel.append(head, tabs, grid);
  el.appendChild(panel);

  let current = actTab;
  const tabBtns = [];
  function show(act) {
    current = act;
    tabBtns.forEach((b, i) => {
      b.setAttribute('aria-selected', String(i + 1 === act));
      b.classList.toggle('on', i + 1 === act);
    });
    grid.replaceChildren();
    const words = WORDS.filter((w) => w.act === act);
    for (let i = 0; i < 10; i++) {
      const w = words[i];
      const got = w && state.acquired[w.id];
      const card = document.createElement('div');
      card.tabIndex = 0;
      if (got) {
        card.className = 'codex-card found';
        const name = document.createElement('p');
        name.className = 'codex-word';
        name.textContent = w.word;
        const meaning = document.createElement('p');
        meaning.className = 'codex-meaning';
        meaning.textContent = w.meaning;
        const ex = document.createElement('p');
        ex.className = 'codex-example';
        ex.textContent = w.example;
        const from = document.createElement('p');
        from.className = 'codex-from';
        from.textContent = `만난 곳: ${got.from}`;
        card.append(name, meaning, ex, from);
      } else {
        card.className = 'codex-card unknown';
        const q = document.createElement('p');
        q.className = 'codex-q';
        q.setAttribute('aria-hidden', 'true');
        q.textContent = '?';
        const t = document.createElement('p');
        t.className = 'codex-meaning';
        t.textContent = '아직 못 찾음';
        card.append(q, t);
      }
      grid.appendChild(card);
    }
  }
  for (let a = 1; a <= ACT_COUNT; a++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'codex-tab';
    b.setAttribute('role', 'tab');
    b.textContent = `${a}막`;
    b.addEventListener('click', () => show(a));
    tabBtns.push(b);
    tabs.appendChild(b);
  }
  show(current);

  const close = mountOverlay(root, el, { label: '도감', onClose });
  closeBtn.addEventListener('click', close);
  tabBtns[current - 1]?.focus();
  return close;
}
