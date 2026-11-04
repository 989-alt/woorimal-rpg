// 낱말 뜻풀이 카드. '확인'을 눌러야만 닫힌다.
import { WORDS } from '../../data/words.js';
import { igniteWord, prefersReducedMotion } from './word-glow.js';

// 카드가 열린 직후 연타로 닫히지 않도록, 키보드 확인은 이 시간 뒤부터 받는다.
export const CARD_GUARD_MS = 300;

export function keyConfirmAllowed(openedAt, now, guardMs = CARD_GUARD_MS) {
  return now - openedAt >= guardMs;
}

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

// 카드의 낱말이 잿빛으로 보이는 시간 뒤에 금빛이 된다(ms). 뜻 줄은 낱말이 빛난 뒤 떠오른다(CSS).
export const CARD_DIM_MS = 220;

// 카드를 parent에 열고 { confirmByKey, okButton, closed } 를 돌려준다. 확인되면 카드를 지우고 onConfirm을 한 번 부른다.
// 마우스·터치로 '확인'을 누르는 것은 바로 받고, 키보드로 일어난 누름(detail 0)은 기다림 시간 안이면 무시한다.
export function openMeaningCard(parent, wordId, onConfirm, now = () => performance.now()) {
  let closed = false;
  const info = WORDS.find((x) => x.id === wordId);
  const openedAt = now();
  const overlay = el('div', 'word-card-overlay');
  const card = el('div', 'word-card frame-panel');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  const ok = el('button', 'btn btn-green word-card-ok', '확인');
  ok.type = 'button';
  const reduced = prefersReducedMotion();
  const word = el('p', `word-card-word ${reduced ? 'word-lit' : 'word-dim'}`, info?.word ?? wordId);
  const body = el('div', 'word-card-body');
  const meaning = el('div', 'word-card-meaning-box');
  meaning.append(el('p', 'word-card-meaning', info?.meaning ?? ''));
  if (info?.example) meaning.append(el('p', 'word-card-example', info.example));
  body.append(word, meaning, ok);
  card.append(el('p', 'word-card-title ribbon', '새 낱말을 찾았다!'), body);
  overlay.appendChild(card);
  parent.appendChild(overlay);
  // 낱말이 빛을 되찾은 뒤 뜻이 아래에서 떠오른다. 움직임 줄이기에서는 처음부터 다 보인다.
  card.classList.toggle('lit', reduced);
  const lightTimer = reduced ? 0 : window.setTimeout(() => {
    if (closed) return;
    igniteWord(word);
    card.classList.add('lit');
  }, CARD_DIM_MS);

  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(lightTimer);
    overlay.remove();
    onConfirm();
  };
  ok.addEventListener('click', (e) => {
    if (e.detail === 0 && !keyConfirmAllowed(openedAt, now())) return; // 열릴 때 누른 키의 keyup 클릭
    close();
  });
  ok.focus();
  return {
    okButton: ok,
    confirmByKey() { if (keyConfirmAllowed(openedAt, now())) close(); },
    get closed() { return closed; },
  };
}
