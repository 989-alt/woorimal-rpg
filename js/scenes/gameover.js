// 게임 오버: "안개에 휩싸였다…" → 도감(그 막 탭) 다시 보기 → "다시 도전"(처음부터 초점).
// 다시 도전은 같은 낱말 묶음으로 순서만 섞어 새 보스전을 연다. 도감·부탁 진행은 그대로다.
import { openCodex } from './codex.js';

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

export const gameover = {
  mount(root, params, ctx) {
    const state = ctx.getState();
    const scene = el('section', 'end-scene gameover-scene');
    scene.dataset.scene = 'gameover';
    const panel = el('div', 'end-panel panel');
    const title = el('h2', 'end-title', '안개에 휩싸였다…');
    const help = el('p', 'end-text', '낱말을 다시 살펴보고 한 번 더 겨뤄 보자.');
    const actions = el('div', 'end-actions');
    const codexBtn = el('button', 'big-button', '도감 다시 보기');
    codexBtn.type = 'button';
    const retryBtn = el('button', 'big-button primary', '다시 도전');
    retryBtn.type = 'button';
    actions.append(codexBtn, retryBtn);
    panel.append(title, help, actions);
    scene.appendChild(panel);
    root.appendChild(scene);

    let closeCodex = null;
    let leaving = false;
    codexBtn.addEventListener('click', () => {
      if (closeCodex || !state) return;
      closeCodex = openCodex(scene, state, { actTab: state.act, onClose: () => { closeCodex = null; } });
    });
    retryBtn.addEventListener('click', () => {
      if (leaving) return;
      leaving = true;
      closeCodex?.();
      ctx.router.show('battle', { mode: 'boss', retryOf: params.retryOf });
    });
    retryBtn.focus();

    return () => {
      leaving = true;
      closeCodex?.();
      scene.remove();
    };
  },
};
