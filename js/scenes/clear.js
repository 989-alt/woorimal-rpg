// 클리어 화면. kind 'chapter': 장 클리어 → 다음 장 첫 이야기. kind 'act': 막 클리어 → 세계 지도(마지막 막은 엔딩).
import { WORDS } from '../../data/words.js';
import { actOfChapter } from '../../data/acts/index.js';
import { ASSETS } from '../../data/assets.js';
import { setArt } from '../ui/images.js';
import { chapterOf, chapterWords, actWords, enterNextChapter } from '../rules/game.js';
import { travelOf } from '../rules/world.js';

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
    const li = el('li', 'clear-card frame-card');
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
    // 뒤에 빛을 되찾은 장 풍경(그림이 없으면 금빛 바탕 그대로)
    const bg = el('div', 'end-bg');
    setArt(bg, ASSETS.dialogueBg[chapter.id], 'end-bg-img art');
    scene.appendChild(bg);
    const panel = el('div', 'end-panel frame-panel');
    const body = el('div', 'end-body');
    const actions = el('div', 'end-actions');
    const btn = el('button', 'btn btn-green');
    btn.type = 'button';
    let leaving = false;

    if (isAct) {
      body.append(el('h2', 'end-title', `${act.id}막 클리어!`), wordCards(actWords(act)));
      // 다음 막이 있으면 세계 지도로, 마지막 막은 엔딩으로(엔딩은 몇 번이든 다시 볼 수 있다)
      const toMap = !!travelOf(state);
      btn.textContent = toMap ? '세계 지도로' : '엔딩 보기';
      btn.addEventListener('click', () => {
        if (leaving) return;
        leaving = true;
        if (toMap) ctx.router.show('worldmap');
        else ctx.router.show('ending', { step: 0 });
      });
    } else {
      const n = act.chapters.indexOf(chapter) + 1;
      body.append(el('h2', 'end-title', `${n}장 클리어!`), wordCards(chapterWords(chapter)));
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
    body.appendChild(actions);
    panel.appendChild(body);
    scene.appendChild(panel);
    root.appendChild(scene);
    btn.focus();

    return () => {
      leaving = true;
      scene.remove();
    };
  },
};
