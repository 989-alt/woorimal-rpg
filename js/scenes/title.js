// 타이틀: 로고와 메뉴(처음부터 · 이어하기 · 엔딩을 본 저장이 있으면 마무리 퀴즈)만. 이름·모습·저장 처리는 select.js.
import { ASSETS } from '../../data/assets.js';
import { ACTS } from '../../data/acts/index.js';
import { setArt } from '../ui/images.js';

// 엔딩을 본 저장(마지막 막을 마침)이 하나라도 있는가. 엔딩은 따로 기록하지 않고 clearedActs로 본다(설계 6절).
export function hasEndingSave(store) {
  const last = ACTS[ACTS.length - 1].id;
  return store.names().some((name) => {
    const r = store.load(name);
    return r.ok && (r.state.clearedActs ?? []).includes(last);
  });
}

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
}

export const title = {
  mount(root, params, ctx) {
    const { router, store } = ctx;
    const main = el('main', { className: 'title-scene' });
    main.dataset.scene = 'title';

    // 로고 그림은 alt=""(setArt). 이름은 글자로 남고, 그림이 붙으면 눈에는 보이지 않게만 한다.
    const text = el('span', { className: 'logo-text', textContent: '말빛 한울' });
    text.dataset.text = '말빛 한울';
    const h1 = el('h1', { className: 'title-logo' }, text);
    setArt(h1, ASSETS.ui.logo, 'logo-img art');

    const newBtn = el('button', { type: 'button', className: 'btn btn-green btn-lg', textContent: '처음부터' });
    const contBtn = el('button', { type: 'button', className: 'btn btn-wood btn-lg', textContent: '이어하기' });
    contBtn.disabled = store.names().length === 0;
    newBtn.addEventListener('click', () => router.show('select', { mode: 'new' }));
    contBtn.addEventListener('click', () => router.show('select', { mode: 'continue' }));
    const menu = el('div', { className: 'title-menu' }, newBtn, contBtn);
    if (hasEndingSave(store)) {
      const quizBtn = el('button', { type: 'button', className: 'btn btn-wood btn-lg title-quiz', textContent: '마무리 퀴즈' });
      quizBtn.addEventListener('click', () => router.show('review-quiz', { next: 'title' }));
      menu.appendChild(quizBtn);
    }
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const btns = [...menu.querySelectorAll('button')].filter((b) => !b.disabled);
      const i = btns.indexOf(document.activeElement);
      const next = btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length];
      e.preventDefault();
      next?.focus();
    });

    main.append(h1, menu);
    if (!store.available) {
      main.append(el('p', { className: 'title-notice frame-plate', textContent: '이 창에서는 저장되지 않아요' }));
    }
    root.appendChild(main);
    setArt(main, ASSETS.title, 'title-bg art');
    newBtn.focus();
    return () => main.remove();
  },
};
