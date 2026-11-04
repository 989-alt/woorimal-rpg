// 전투 화면 틀: 위 무대(배경·안개·주인공·몬스터·HP 명판) + 아래 묶음(주인공 명판, 문제 말풍선과 이름·유형 표, 보기).
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
// 무대: world(배경·안개·주인공·몬스터, 화면 흔들림은 이 층이 움직임) < fx(날아가는 낱말·파동·알갱이) 위에 명판들.
export function buildFrame({ mode, nickname, monsterName, hearts: heartCount = 5, hp = 6 }) {
  const stage = el('div', 'battle-stage');
  const world = el('div', 'battle-world');
  const fog = el('div', 'battle-fog');
  const hero = el('div', 'battle-hero');
  const hand = el('span', 'battle-hero-hand'); // 낱말이 날아오르는 손끝
  hero.append(el('span', 'battle-hero-face', initial(nickname)), hand);
  hero.setAttribute('aria-hidden', 'true');
  const monster = el('div', 'battle-monster');
  monster.setAttribute('aria-hidden', 'true');
  const bg = el('div', 'battle-bg');
  world.append(bg, fog, hero, monster);
  const mhp = el('div', 'battle-mhp frame-plate');
  mhp.append(el('span', 'mhp-name', monsterName));
  const cells = el('span', 'hp-cells');
  const lightLeft = el('span', 'light-left');
  if (mode === 'boss') {
    for (let i = 0; i < hp; i++) cells.appendChild(el('i', 'hp-cell'));
    mhp.appendChild(cells);
  } else {
    mhp.appendChild(lightLeft); // 복습전은 HP 대신 "남은 빛 n/3"
  }
  const combo = el('div', 'battle-combo frame-plate');
  combo.hidden = true;
  combo.setAttribute('aria-live', 'polite');
  const fx = el('div', 'battle-fx');
  fx.setAttribute('aria-hidden', 'true');
  stage.append(world, mhp, combo, fx);

  const bottom = el('div', 'battle-bottom');
  const status = el('div', 'battle-status frame-plate');
  status.append(el('span', 'status-name', nickname));
  const hearts = el('span', 'hearts');
  if (mode === 'boss') {
    for (let i = 0; i < heartCount; i++) hearts.appendChild(el('span', 'heart full', '♥'));
    status.appendChild(hearts);
  } else {
    status.appendChild(el('span', 'practice-tag', '연습')); // 복습전은 하트 대신 "연습"
  }
  const question = el('div', 'battle-question frame-panel');
  const tail = el('span', 'battle-tail'); // 말풍선 꼬리: 몬스터 쪽으로(layoutTail이 자리를 잡는다)
  tail.setAttribute('aria-hidden', 'true');
  const who = el('span', 'battle-who frame-plate', monsterName);
  const typeTag = el('span', 'battle-type');
  const prompt = el('p', 'battle-prompt');
  prompt.setAttribute('aria-live', 'polite');
  question.appendChild(prompt);
  bottom.append(status, who, typeTag, tail, question);
  return { stage, world, bg, fog, hero, hand, monster, fx, combo, cells, hearts, lightLeft, bottom, status, question, tail, typeTag, prompt, monsterName };
}

// 말풍선 꼬리를 몬스터 상자 가운데 x에 놓는다(묶음 왼쪽 끝 기준 px, --tail-x). 창 크기가 바뀌면 다시 부른다.
const TAIL_EDGE = 120; // 꼬리 가운데가 묶음 양 끝에서 이만큼은 안쪽에 있게(이름 표·유형 표와 겹치지 않게)
export function layoutTail(f) {
  const box = f.bottom.getBoundingClientRect();
  const mon = f.monster.getBoundingClientRect();
  if (!box.width || !mon.width) return;
  const x = mon.left + mon.width / 2 - box.left;
  const clamped = Math.min(Math.max(x, TAIL_EDGE), Math.max(TAIL_EDGE, box.width - TAIL_EDGE));
  f.bottom.style.setProperty('--tail-x', `${Math.round(clamped)}px`);
}

// 하트·HP 칸·남은 빛·연속 표를 다시 그린다. crack*은 방금 잃은 칸에 금 가는 효과를 단다.
export function drawFrame(f, { hearts, hp, maxHp, light, need, streak = 0, crackHeart = false, crackCell = false }) {
  if (hp !== undefined) {
    [...f.cells.children].forEach((c, i) => {
      c.classList.toggle('lost', i >= hp);
      c.classList.toggle('crack', crackCell && i === hp); // 방금 잃은 칸만(앞서 깨진 칸의 조각은 치운다)
    });
    [...f.hearts.children].forEach((h, i) => {
      const full = i < hearts;
      h.className = `heart ${full ? 'full' : 'empty'}${crackHeart && i === hearts ? ' crack' : ''}`;
      h.textContent = full ? '♥' : '♡';
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
    const b = el('button', 'battle-option frame-card');
    b.type = 'button';
    const num = el('b', 'opt-num coin', String(i + 1));
    num.setAttribute('aria-hidden', 'true');
    b.append(num, el('span', 'opt-text', text));
    b.setAttribute('aria-label', `${i + 1}번 ${text}`);
    b.addEventListener('click', (e) => onPick(i, e));
    box.appendChild(b);
    return b;
  });
  return { el: box, buttons };
}

// 고른 보기(.picked)와 정답에 ○/×를 단다. 색 + 모양 + 글자(정답/오답)로 알린다.
// 맞혔으면 그 보기에 "맞았어!" 표가 붙는다.
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
  if (picked === answer) buttons[answer].appendChild(el('span', 'opt-say', '맞았어!'));
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
  const panel = el('div', 'battle-feedback frame-panel');
  panel.setAttribute('role', 'status');
  const head = el('p', 'battle-answer');
  head.append(el('span', 'x-mark', '×'), ` 정답: ${answer}`);
  const m = el('p', 'battle-meaning');
  m.append(el('b', 'battle-meaning-word', word), `: ${meaning}`);
  const nextBtn = el('button', 'btn btn-wood battle-next', '다음');
  nextBtn.type = 'button';
  const body = el('div', 'battle-feedback-body');
  body.append(head, m, nextBtn);
  panel.appendChild(body);
  return { el: panel, nextBtn };
}
