// 낱말 뜻풀이 카드. '확인'을 눌러야만 닫힌다.
import { WORDS } from '../../data/words.js';

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

// 카드를 parent에 열고 { confirmByKey } 를 돌려준다. 확인되면 카드를 지우고 onConfirm을 한 번 부른다.
// 마우스·터치로 '확인'을 누르는 것은 바로 받고, 키보드로 일어난 누름(detail 0)은 기다림 시간 안이면 무시한다.
export function openMeaningCard(parent, wordId, onConfirm, now = () => performance.now()) {
  const info = WORDS.find((x) => x.id === wordId);
  const openedAt = now();
  const overlay = el('div', 'word-card-overlay');
  const card = el('div', 'word-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  const ok = el('button', 'btn btn-green', '확인');
  ok.type = 'button';
  card.append(el('p', 'word-card-title', '새 낱말을 찾았다!'), el('p', 'word-card-word', info?.word ?? wordId),
    el('p', 'word-card-meaning', info?.meaning ?? ''));
  if (info?.example) card.append(el('p', 'word-card-example', info.example));
  card.append(ok);
  overlay.appendChild(card);
  parent.appendChild(overlay);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    onConfirm();
  };
  ok.addEventListener('click', (e) => {
    if (e.detail === 0 && !keyConfirmAllowed(openedAt, now())) return; // 열릴 때 누른 키의 keyup 클릭
    close();
  });
  ok.focus();
  return {
    confirmByKey() { if (keyConfirmAllowed(openedAt, now())) close(); },
    get closed() { return closed; },
  };
}
