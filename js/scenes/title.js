// 시작 화면: 닉네임, 모습 고르기, 저장된 이름, 처음부터/이어하기.
import { validateNickname } from '../rules/josa.js';
import { newGame, chapterOf } from '../rules/game.js';
import { actOfChapter } from '../../data/acts/index.js';
import { blockColor, labelBlockEl } from '../ui/placeholder.js';

// 한글 조합 중의 엔터는 마지막 글자가 아직 확정되지 않았으므로 받지 않는다.
export function shouldSubmit({ key, isComposing }) {
  return key === 'Enter' && !isComposing;
}

export function titleDecision({ nickname, avatar, choice, store }) {
  const v = validateNickname(nickname);
  if (!v.ok) return { action: 'invalid', error: v.error };
  const name = v.value;
  if (choice === 'new') {
    if (store.has(name)) return { action: 'ask-overwrite' };
    return { action: 'start', state: newGame({ nickname: name, avatar }) };
  }
  const r = store.load(name);
  if (r.ok) return { action: 'start', state: r.state };
  if (r.reason === 'corrupt') return { action: 'load-error' };
  return { action: 'start', state: newGame({ nickname: name, avatar }) };
}

const AVATARS = [
  { id: 'f', label: '여' },
  { id: 'm', label: '남' },
];

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
}

export const title = {
  mount(root, params, ctx) {
    const { router, store, setState } = ctx;
    let avatar = 'f';

    const main = el('main', { className: 'title-scene' });
    main.dataset.scene = 'title';

    const h1 = el('h1', { className: 'title-logo', textContent: '말빛 한울' });

    const input = el('input', {
      type: 'text', id: 'nickname', className: 'title-input', maxLength: 12,
      autocomplete: 'off', placeholder: '이름 (1~6글자)',
    });
    input.setAttribute('aria-describedby', 'nick-help nick-error');
    const label = el('label', { htmlFor: 'nickname', className: 'title-label', textContent: '내 이름' });
    const help = el('p', { id: 'nick-help', className: 'title-help', textContent: '1~6글자, 한글·영어·숫자로 적어 주세요.' });
    const error = el('p', { id: 'nick-error', className: 'title-error' });
    error.setAttribute('role', 'alert');
    error.hidden = true;

    const cards = el('div', { className: 'avatar-cards', role: 'radiogroup' });
    cards.setAttribute('aria-label', '모습');
    const cardEls = AVATARS.map((a) => {
      const b = el('button', { type: 'button', className: 'avatar-card' });
      b.dataset.avatar = a.id;
      b.setAttribute('role', 'radio');
      b.append(labelBlockEl(a.label, blockColor(a.id === 'f' ? '여' : '남'), 'avatar-block'));
      b.addEventListener('click', () => select(a.id));
      return b;
    });
    cards.append(...cardEls);
    function select(id) {
      avatar = id;
      for (const c of cardEls) {
        const on = c.dataset.avatar === id;
        c.classList.toggle('selected', on);
        c.setAttribute('aria-checked', String(on));
      }
    }
    select('f');

    const savedWrap = el('div', { className: 'saved-names' });
    for (const name of store.names()) {
      const r = store.load(name);
      const b = el('button', { type: 'button', className: 'saved-name', textContent: name });
      b.addEventListener('click', () => {
        input.value = name;
        if (r.ok && (r.state.avatar === 'f' || r.state.avatar === 'm')) select(r.state.avatar);
        clearError();
      });
      savedWrap.append(b);
    }

    const newBtn = el('button', { type: 'button', className: 'big-button', textContent: '처음부터' });
    const contBtn = el('button', { type: 'button', className: 'big-button', textContent: '이어하기' });
    const actions = el('div', { className: 'title-actions' }, newBtn, contBtn);

    const notice = el('p', { className: 'title-notice', textContent: '이 창에서는 저장되지 않아요' });
    notice.hidden = store.available;

    const confirmBox = el('div', { className: 'title-confirm' });
    confirmBox.setAttribute('role', 'alertdialog');
    confirmBox.hidden = true;

    function showError(msg) {
      error.textContent = '';
      error.append(el('span', { className: 'err-icon', textContent: '×' }), ' ' + msg);
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    }
    function clearError() {
      error.hidden = true;
      error.textContent = '';
      input.removeAttribute('aria-invalid');
    }
    function ask(text, yesLabel, onYes, noLabel, onNo) {
      confirmBox.textContent = '';
      const yes = el('button', { type: 'button', className: 'big-button', textContent: yesLabel });
      const no = el('button', { type: 'button', className: 'big-button', textContent: noLabel });
      yes.addEventListener('click', () => { confirmBox.hidden = true; onYes(); });
      no.addEventListener('click', () => { confirmBox.hidden = true; onNo(); });
      confirmBox.append(el('p', { textContent: text }), el('div', { className: 'title-actions' }, yes, no));
      confirmBox.hidden = false;
      yes.focus();
    }

    function begin(state, fresh) {
      setState(state);
      if (fresh) {
        const chapter = chapterOf(actOfChapter(state.chapter), state.chapter);
        router.show('dialogue', { script: chapter.intro, words: [], from: '', next: 'explore' });
      } else {
        router.show('explore');
      }
    }
    const startFresh = (name) => begin(newGame({ nickname: name, avatar }), true);

    function submit(choice) {
      clearError();
      confirmBox.hidden = true;
      const d = titleDecision({ nickname: input.value, avatar, choice, store });
      const name = input.value.trim();
      if (d.action === 'invalid') { showError(d.error); input.focus(); return; }
      if (d.action === 'ask-overwrite') {
        ask('이미 있는 이름이에요. 이어할까요, 처음부터 할까요?',
          '이어하기', () => submit('continue'), '처음부터', () => startFresh(name));
        return;
      }
      if (d.action === 'load-error') {
        ask('저장을 불러오지 못했어요. 처음부터 할까요?',
          '처음부터', () => startFresh(name), '아니요', () => input.focus());
        return;
      }
      // 이어하기로 저장이 없어 새로 시작하는 경우도 새 게임이다.
      const fresh = choice === 'new' || !store.has(name);
      begin(d.state, fresh);
    }

    newBtn.addEventListener('click', () => submit('new'));
    contBtn.addEventListener('click', () => submit('continue'));
    input.addEventListener('input', clearError);
    input.addEventListener('keydown', (e) => {
      if (shouldSubmit({ key: e.key, isComposing: e.isComposing || e.keyCode === 229 })) {
        e.preventDefault();
        submit('new');
      }
    });

    const form = el('div', { className: 'title-form' }, label, input, help, error);
    main.append(h1, form, cards, savedWrap, actions, confirmBox, notice);
    root.appendChild(main);
    input.focus();
    return () => main.remove();
  },
};
