// 이름·모습 고르기 장면. params = { mode: 'new' | 'continue', name?: string }
// 처음부터(new): 이름 + 모습 카드 → 시작하기. 이어하기(continue): 이름(저장된 이름 단추) → 이어하기.
import { validateNickname } from '../rules/josa.js';
import { newGame, chapterOf } from '../rules/game.js';
import { actOfChapter } from '../../data/acts/index.js';
import { blockColor, labelBlockEl } from '../ui/placeholder.js';
import { bustFor } from '../../data/assets.js';
import { setArt } from '../ui/images.js';
import { ASSETS } from '../../data/assets.js';

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
  return { action: 'not-found' };
}

// 확인 창을 연 뒤 이름 칸이 바뀌었으면, 창의 단추는 열 때 잡아 둔 이름으로 아무것도 하지 않는다.
export function stillSameName(captured, current) {
  const v = validateNickname(current);
  return v.ok && v.value === captured;
}

const AVATARS = [
  { id: 'f', label: '여', name: '여자 주인공', plate: '여자', color: '#B5486B' },
  { id: 'm', label: '남', name: '남자 주인공', plate: '남자', color: '#3B5BA5' },
];

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
}

export const select = {
  mount(root, params, ctx) {
    const { router, store, setState } = ctx;
    const mode = params?.mode === 'continue' ? 'continue' : 'new';
    let avatar = 'f';

    const main = el('main', { className: `select-scene select-${mode}` });
    main.dataset.scene = 'select';
    main.dataset.mode = mode;

    const heading = el('h1', { className: 'select-title frame-plate', textContent: mode === 'new' ? '캐릭터 선택' : '이어하기' });

    // ── 이름 패널 ──
    const input = el('input', {
      type: 'text', id: 'nickname', className: 'title-input', maxLength: 12,
      autocomplete: 'off', placeholder: '이름 (1~6글자)', value: params?.name || '',
    });
    input.setAttribute('aria-describedby', 'nick-help nick-error');
    const label = el('label', { htmlFor: 'nickname', className: 'title-label', textContent: '내 이름' });
    const help = el('p', { id: 'nick-help', className: 'title-help', textContent: '1~6글자, 한글·영어·숫자로 적어 주세요.' });
    const error = el('p', { id: 'nick-error', className: 'title-error' });
    error.setAttribute('role', 'alert');
    error.hidden = true;
    const panel = el('div', { className: 'select-name frame-panel' },
      el('div', { className: 'select-name-inner' }, el('div', { className: 'select-name-row' }, label, input), help, error));

    // ── 모습 카드(처음부터만) ──
    let cardsWrap = null;
    const cardEls = [];
    function pick(id) {
      avatar = id;
      for (const c of cardEls) {
        const on = c.dataset.avatar === id;
        c.classList.toggle('selected', on);
        c.setAttribute('aria-checked', String(on));
        c.parentElement.classList.toggle('picked', on);
      }
    }
    if (mode === 'new') {
      cardsWrap = el('div', { className: 'avatar-cards', role: 'radiogroup' });
      cardsWrap.setAttribute('aria-label', '모습');
      for (const a of AVATARS) {
        const b = el('button', { type: 'button', className: 'avatar-card frame-card' });
        b.dataset.avatar = a.id;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', a.name); // 그림이 글자 블록을 가려도 이름이 남게
        // 그림(또는 임시 글자 블록)은 아치 모양 안쪽 상자에 넣고, 이름은 카드 아래쪽 리본에 둔다.
        const art = el('span', { className: 'avatar-art' });
        art.append(labelBlockEl(a.label, blockColor(a.id === 'f' ? '여' : '남'), 'avatar-block'));
        setArt(art, bustFor(`hero_${a.id}`, 'base'), 'avatar-img art');
        const ribbon = el('span', { className: 'ribbon avatar-ribbon', textContent: a.plate });
        ribbon.style.setProperty('--speaker-color', a.color);
        b.append(art, ribbon);
        b.addEventListener('click', () => pick(a.id));
        const badge = el('span', { className: 'avatar-badge' }, el('span', { className: 'icon icon-check' }));
        badge.setAttribute('aria-hidden', 'true');
        cardEls.push(b);
        cardsWrap.append(el('div', { className: 'avatar-col' }, b, badge));
      }
      pick('f');
    }

    // ── 저장된 이름(이어하기만) ──
    let savedWrap = null;
    if (mode === 'continue') {
      savedWrap = el('div', { className: 'saved-names' });
      for (const name of store.names()) {
        const b = el('button', { type: 'button', className: 'saved-name btn btn-wood btn-sm', textContent: name });
        b.addEventListener('click', () => { input.value = name; clearError(); });
        savedWrap.append(b);
      }
    }

    const notFound = el('div', { className: 'select-notfound frame-plate' });
    notFound.setAttribute('role', 'alert');
    notFound.hidden = true;
    const confirmBox = el('div', { className: 'title-confirm frame-plate' });
    confirmBox.setAttribute('role', 'alertdialog');
    confirmBox.hidden = true;

    const backBtn = el('button', { type: 'button', className: 'btn btn-wood btn-lg select-back', textContent: '뒤로' });
    const goBtn = el('button', { type: 'button', className: 'btn btn-green btn-lg select-go', textContent: mode === 'new' ? '시작하기' : '이어하기' });
    const actions = el('div', { className: 'select-actions' }, backBtn, goBtn);

    function showError(msg) {
      error.textContent = '';
      error.append(el('span', { className: 'err-icon', textContent: '×' }), ' ' + msg);
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    }
    function clearError() {
      error.hidden = true;
      error.textContent = '';
      notFound.hidden = true;
      input.removeAttribute('aria-invalid');
    }
    function ask(text, yesLabel, onYes, noLabel, onNo) {
      confirmBox.textContent = '';
      const yes = el('button', { type: 'button', className: 'btn btn-wood btn-sm', textContent: yesLabel });
      const no = el('button', { type: 'button', className: 'btn btn-wood btn-sm', textContent: noLabel });
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
    // 이미 있는 이름에서 '이어하기'를 고른 경우: 저장을 불러온다(못 불러오면 새로 시작할지 묻는다).
    function continueSaved(name) {
      const r = store.load(name);
      if (r.ok) { begin(r.state, false); return; }
      ask('저장을 불러오지 못했어요. 처음부터 할까요?',
        '처음부터', () => (mode === 'new' ? startFresh(name) : router.show('select', { mode: 'new', name })),
        '아니요', () => input.focus());
    }
    const startFresh = (name) => begin(newGame({ nickname: name, avatar }), true);

    function submit() {
      clearError();
      confirmBox.hidden = true;
      const choice = mode;
      const d = titleDecision({ nickname: input.value, avatar, choice, store });
      const name = validateNickname(input.value).value;
      if (d.action === 'invalid') { showError(d.error); input.focus(); return; }
      // 창을 연 뒤 이름이 바뀌었으면 단추는 아무것도 하지 않는다(다른 이름의 저장을 덮어쓰지 않도록).
      const guard = (fn) => () => { if (stillSameName(name, input.value)) fn(); else input.focus(); };
      if (d.action === 'ask-overwrite') {
        ask('이미 있는 이름이에요. 이어할까요, 처음부터 할까요?',
          '이어하기', guard(() => continueSaved(name)),
          '처음부터', guard(() => startFresh(name)));
        return;
      }
      if (d.action === 'load-error') {
        // 모습을 고르지 않고 새 게임을 시작하지 않는다: 모습 고르기로 보낸다(이름은 그대로).
        ask('저장을 불러오지 못했어요. 처음부터 할까요?',
          '처음부터', guard(() => router.show('select', { mode: 'new', name })), '아니요', () => input.focus());
        return;
      }
      if (d.action === 'not-found') {
        notFound.textContent = '';
        const again = el('button', { type: 'button', className: 'btn btn-green btn-sm', textContent: '처음부터 하기' });
        again.addEventListener('click', () => router.show('select', { mode: 'new', name }));
        notFound.append(el('p', { textContent: '이 이름으로 저장된 게임이 없어요.' }), again);
        notFound.hidden = false;
        again.focus();
        return;
      }
      begin(d.state, mode === 'new');
    }

    goBtn.addEventListener('click', submit);
    backBtn.addEventListener('click', () => router.show('title'));
    // 이름을 고치면 앞 이름으로 연 확인 창은 닫는다.
    input.addEventListener('input', () => { clearError(); confirmBox.hidden = true; });
    input.addEventListener('keydown', (e) => {
      if (shouldSubmit({ key: e.key, isComposing: e.isComposing || e.keyCode === 229 })) {
        e.preventDefault();
        submit();
      }
    });

    main.append(heading, panel);
    if (cardsWrap) main.append(cardsWrap);
    if (savedWrap) main.append(savedWrap);
    main.append(notFound, confirmBox, actions);
    root.appendChild(main);
    setArt(main, ASSETS.title, 'title-bg art');
    input.focus();
    return () => main.remove();
  },
};
