// 전투 화면 틀: 위 무대(배경·안개·주인공·몬스터·HP) + 아래 묶음(이름표·하트, 문제 상자, 보기).
// 보기 배치: 빈칸 채우기 = 낱말 카드 4장 가로 · 뜻 고르기 = 2×2 · 알맞은 문장 고르기 = 1열 4줄.
import { initial } from './placeholder.js';

export const TYPE_LABEL = { blank: '빈칸 채우기', meaning: '뜻 고르기', usage: '알맞은 문장 고르기' };
const BLANK = '___';

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

// 화면 틀을 만든다. 보기는 문제마다 buildOptions로 bottom 끝에 붙인다.
export function buildFrame({ mode, nickname, monsterName, hearts: heartCount = 5, hp = 6 }) {
  const stage = el('div', 'battle-stage');
  const fog = el('div', 'battle-fog');
  const hero = el('div', 'battle-hero');
  const hand = el('span', 'battle-hero-hand'); // 빛줄기가 시작하는 손끝
  hero.append(el('span', 'battle-hero-face', initial(nickname)), hand);
  hero.setAttribute('aria-hidden', 'true');
  const monster = el('div', 'battle-monster');
  monster.setAttribute('aria-hidden', 'true');
  const mhp = el('div', 'battle-mhp panel');
  mhp.append(el('span', 'mhp-name', monsterName));
  const cells = el('span', 'hp-cells');
  const lightLeft = el('span', 'light-left');
  if (mode === 'boss') {
    for (let i = 0; i < hp; i++) cells.appendChild(el('i', 'hp-cell'));
    mhp.appendChild(cells);
  } else {
    mhp.appendChild(lightLeft); // 복습전은 HP 대신 "남은 빛 n/3"
  }
  const combo = el('div', 'battle-combo panel');
  combo.hidden = true;
  combo.setAttribute('aria-live', 'polite');
  stage.append(el('div', 'battle-bg'), fog, hero, monster, mhp, combo);

  const bottom = el('div', 'battle-bottom');
  const status = el('div', 'battle-status panel');
  status.append(el('span', 'status-name', nickname));
  const hearts = el('span', 'hearts');
  if (mode === 'boss') {
    for (let i = 0; i < heartCount; i++) hearts.appendChild(el('span', 'heart full', '♥'));
    status.appendChild(hearts);
  } else {
    status.appendChild(el('span', 'practice-tag', '연습')); // 복습전은 하트 대신 "연습"
  }
  const question = el('div', 'battle-question panel');
  const typeTag = el('span', 'battle-type');
  const prompt = el('p', 'battle-prompt');
  prompt.setAttribute('aria-live', 'polite');
  question.append(el('span', 'battle-who', monsterName), typeTag, prompt);
  bottom.append(status, question);
  return { stage, fog, hand, monster, combo, cells, hearts, lightLeft, bottom, typeTag, prompt, monsterName };
}

// 하트·HP 칸·남은 빛·연속 표를 다시 그린다. crack*은 방금 잃은 칸에 금 가는 효과를 단다.
export function drawFrame(f, { hearts, hp, maxHp, light, need, streak = 0, crackHeart = false, crackCell = false }) {
  if (hp !== undefined) {
    [...f.cells.children].forEach((c, i) => {
      c.classList.toggle('lost', i >= hp);
      if (crackCell && i === hp) c.classList.add('crack');
    });
    [...f.hearts.children].forEach((h, i) => {
      const full = i < hearts;
      h.className = `heart ${full ? 'full' : 'empty'}`;
      h.textContent = full ? '♥' : '♡';
      if (crackHeart && i === hearts) h.classList.add('crack');
    });
    f.hearts.setAttribute('aria-label', `하트 ${hearts}개`);
    f.cells.setAttribute('aria-label', `${f.monsterName} 남은 칸 ${hp}`);
    f.monster.style.setProperty('--life', String(hp / maxHp));
  } else {
    f.lightLeft.textContent = `남은 빛 ${light}/${need}`;
    f.monster.style.setProperty('--life', String(light / need));
  }
  f.combo.hidden = streak < 2;
  f.combo.textContent = `연속 ${streak}번 맞힘!`;
}

// 문제 글을 그린다. 빈칸은 밑줄 칸으로, 따옴표 안 낱말은 금빛 띠로.
// 돌려주는 fill(word)는 빈칸에 낱말을 금빛 띠로 채운다(빈칸 문제가 아니면 아무것도 안 함).
export function renderPrompt(target, quiz) {
  target.replaceChildren();
  let blank = null;
  if (quiz.type === 'blank' && quiz.prompt.includes(BLANK)) {
    const [before, after] = quiz.prompt.split(BLANK);
    blank = el('span', 'battle-blank');
    blank.setAttribute('aria-label', '빈칸');
    target.append(`"${before}`, blank, `${after}"`);
  } else {
    const m = /'([^']+)'/.exec(quiz.prompt);
    if (m) {
      const hl = el('span', 'battle-hl', m[1]);
      target.append(quiz.prompt.slice(0, m.index), '"', hl, '"', quiz.prompt.slice(m.index + m[0].length));
    } else {
      target.append(quiz.prompt);
    }
  }
  return {
    fill(word) {
      if (!blank) return;
      blank.textContent = word;
      blank.classList.add('filled');
      blank.removeAttribute('aria-label');
    },
  };
}

// 보기 묶음을 만든다. onPick(i)는 누를 때마다 불리고, 잠금은 부르는 쪽이 맡는다.
export function buildOptions(type, options, onPick) {
  const box = el('div', `battle-options opts-${type}`);
  box.dataset.type = type;
  box.tabIndex = -1;
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', '보기');
  const buttons = options.map((text, i) => {
    const b = el('button', 'battle-option');
    b.type = 'button';
    const num = el('b', 'opt-num', String(i + 1));
    num.setAttribute('aria-hidden', 'true');
    b.append(num, el('span', 'opt-text', text));
    b.setAttribute('aria-label', `${i + 1}번 ${text}`);
    b.addEventListener('click', (e) => onPick(i, e));
    box.appendChild(b);
    return b;
  });
  return { el: box, buttons };
}

// 고른 보기와 정답에 ○/×를 단다. 색 + 모양 + 글자(정답/오답)로 알린다.
export function markOptions(buttons, picked, answer) {
  const mark = (b, ok) => {
    b.classList.add(ok ? 'right' : 'wrong');
    const m = el('span', 'opt-mark', ok ? '○' : '×');
    m.setAttribute('aria-hidden', 'true');
    b.appendChild(m);
    b.setAttribute('aria-label', `${b.getAttribute('aria-label')}, ${ok ? '정답' : '오답'}`);
  };
  buttons.forEach((b) => { b.setAttribute('aria-disabled', 'true'); });
  buttons[picked]?.classList.add('picked');
  if (picked !== answer) mark(buttons[picked], false);
  mark(buttons[answer], true);
}

export const COLUMNS = { blank: 4, meaning: 2, usage: 1 };

// 방향키로 보기 사이 초점을 옮긴다(좌우 한 칸, 위아래 한 줄). 초점이 보기 밖이면 첫 보기로.
export function moveFocus(buttons, key, cols = 1) {
  const i = buttons.indexOf(document.activeElement);
  const n = buttons.length;
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[key] ?? 0;
  const next = i < 0 ? 0 : (i + step + n) % n;
  buttons[next]?.focus();
}

// 오답 뒤: 정답과 낱말 뜻, '다음' 단추
export function feedbackPanel({ answer, word, meaning }) {
  const panel = el('div', 'battle-feedback panel');
  panel.setAttribute('role', 'status');
  const head = el('p', 'battle-answer');
  head.append(el('span', 'x-mark', '×'), ` 정답: ${answer}`);
  const m = el('p', 'battle-meaning');
  m.append(el('b', 'battle-meaning-word', word), `: ${meaning}`);
  const nextBtn = el('button', 'big-button battle-next', '다음');
  nextBtn.type = 'button';
  panel.append(head, m, nextBtn);
  return { el: panel, nextBtn };
}

// 처음 하는 전투 앞의 규칙 한 장
export function tipCard(title, text) {
  const card = el('div', 'battle-tip');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', '전투 규칙');
  const inner = el('div', 'battle-tip-card panel');
  const start = el('button', 'big-button', '시작');
  start.type = 'button';
  inner.append(el('p', 'battle-tip-title', title), el('p', 'battle-tip-text', text), start);
  card.appendChild(inner);
  return { el: card, start };
}
