// 클리어 화면. kind 'chapter': 장 클리어 → 다음 장 첫 이야기. kind 'act': 막 클리어 → 처음 화면.
import { WORDS } from '../../data/words.js';
import { actOfChapter } from '../../data/acts/index.js';
import { chapterOf, chapterWords, actWords, enterNextChapter } from '../rules/game.js';

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

function wordCards(ids) {
  const list = el('ul', 'clear-cards');
  for (const id of ids) {
    const w = WORDS.find((x) => x.id === id);
    const li = el('li', 'clear-card');
    li.append(el('p', 'clear-word', w?.word ?? id), el('p', 'clear-meaning', w?.meaning ?? ''));
    list.appendChild(li);
  }
  return list;
}

export const clear = {
  mount(root, params, ctx) {
    const state = ctx.getState();
    if (!state) return () => {};
    const act = actOfChapter(state.chapter);
    const chapter = chapterOf(act, state.chapter);
    const isAct = params.kind === 'act';

    const scene = el('section', `end-scene clear-scene ${isAct ? 'clear-act' : 'clear-chapter'}`);
    scene.dataset.scene = 'clear';
    const panel = el('div', 'end-panel panel');
    const actions = el('div', 'end-actions');
    const btn = el('button', 'btn btn-green');
    btn.type = 'button';
    let leaving = false;

    if (isAct) {
      panel.append(el('h2', 'end-title', `${act.id}막 클리어!`), wordCards(actWords(act)), el('p', 'end-text', '다음 막은 준비 중이에요'));
      btn.textContent = '처음 화면으로';
      btn.addEventListener('click', () => {
        if (leaving) return;
        leaving = true;
        ctx.router.show('title');
      });
    } else {
      const n = act.chapters.indexOf(chapter) + 1;
      panel.append(el('h2', 'end-title', `${n}장 클리어!`), wordCards(chapterWords(chapter)));
      btn.textContent = '다음 장으로';
      btn.addEventListener('click', () => {
        if (leaving) return;
        leaving = true;
        const next = enterNextChapter(ctx.getState(), act);
        ctx.setState(next);
        const nextChapter = chapterOf(act, next.chapter);
        ctx.router.show('dialogue', { script: nextChapter.intro, words: [], from: '', next: 'explore' });
      });
    }
    actions.appendChild(btn);
    panel.appendChild(actions);
    scene.appendChild(panel);
    root.appendChild(scene);
    btn.focus();

    return () => {
      leaving = true;
      scene.remove();
    };
  },
};
