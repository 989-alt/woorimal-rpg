// 엔딩(설계 6절). params = { step }, n = 장면 수.
//  step < n   : 그 장면의 대화(엔딩 인물·배경 그림, 마지막 장면은 상반신 없는 한 장 그림)를 열고, 끝나면 step + 1
//  step = n   : 마지막 말 — 한지 패널 가운데 큰 글 한 줄, 2초 뒤 "다음"(저절로 넘어가지 않는다)
//  step = n+1 : 말빛 주머니 — 막마다 한 줄에 낱말 카드 10장, 누르면 옆 칸에 뜻·예문·만난 곳 → 마무리 퀴즈(review-quiz) → 만든 이
//  step = n+2 : 만든 이 — 한지 패널에 제목과 줄, 끝에 인사 한 줄과 "처음 화면으로"
// 엔딩은 상태를 바꾸지 않는다(엔딩을 본 저장은 clearedActs에 5가 있고, 5-2 출구로 가면 다시 본다).
import ENDING from '../../data/ending.js';
import { WORDS } from '../../data/words.js';
import { ACTS } from '../../data/acts/index.js';
import { ASSETS, endingBg } from '../../data/assets.js';
import { formatLine } from '../rules/josa.js';
import { setArt } from '../ui/images.js';
import { prefersReducedMotion } from '../ui/word-glow.js';
import { codexCardEl, showWordDetail } from './codex.js';

export const MESSAGE_DELAY_MS = 2000;
const LIGHT_STEP_MS = 240; // 주머니 카드가 막 한 줄씩 금빛 테두리를 켜는 간격(5줄 = 1.2초)
let messageDelay = MESSAGE_DELAY_MS;
// 마지막 말 화면에서 "다음"이 나타나기까지 기다리는 시간(ms). 검사용(?test=1) fastText만 바꾼다.
export function setEndingDelay(ms) { messageDelay = ms; }

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const button = (className, text) => {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
};

// 마지막 말 화면: 새벽 그림(없으면 새벽 금빛 그라데이션) 위 불투명 한지 패널
function messagePart(scene, done) {
  const card = el('div', 'ending-card frame-panel');
  const body = el('div', 'ending-card-body');
  body.append(el('p', 'ending-message', ENDING.message));
  card.append(body);
  const actions = el('div', 'ending-actions');
  const next = button('btn btn-green ending-next', '다음');
  next.hidden = true;
  next.addEventListener('click', done);
  actions.appendChild(next);
  scene.append(card, actions);
  const timer = window.setTimeout(() => {
    next.hidden = false;
    next.focus();
  }, messageDelay);
  return () => clearTimeout(timer);
}

// 말빛 주머니 50장: 막마다 한 줄(줄머리 + 카드 10장), 옆에 상세 칸과 "마무리 퀴즈"
function pouchPart(scene, state, done) {
  const acquired = state?.acquired ?? {};
  const got = WORDS.filter((w) => acquired[w.id]).length;
  const panel = el('div', 'pouch frame-panel');
  const title = el('h2', 'pouch-title frame-plate', `${state?.nickname ?? ''}의 말빛 주머니 ${got}/${WORDS.length}`);
  const acts = el('div', 'pouch-acts');
  const detail = el('div', 'codex-detail pouch-detail frame-plate');
  detail.setAttribute('aria-live', 'polite');
  detail.append(el('p', 'detail-meaning pouch-hint', '카드를 고르면 뜻이 보여요.'));
  const cards = [];
  const select = (card, w) => {
    for (const c of cards) c.classList.toggle('selected', c === card);
    showWordDetail(detail, w, acquired[w.id]);
  };
  const rows = ACTS.map((act) => {
    const row = el('section', 'pouch-act');
    row.setAttribute('aria-label', `${act.id}막 ${act.title}`);
    const head = el('h3', 'pouch-head');
    head.append(el('span', 'pouch-act-no', `${act.id}막`), ' ', el('span', 'pouch-act-name', act.title));
    const list = el('div', 'pouch-cards');
    for (const w of WORDS.filter((x) => x.act === act.id)) {
      const card = codexCardEl(w, acquired[w.id]);
      card.addEventListener('click', () => select(card, w));
      card.addEventListener('focus', () => select(card, w));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(card, w); }
      });
      cards.push(card);
      list.appendChild(card);
    }
    row.append(head, list);
    acts.appendChild(row);
    return row;
  });
  const side = el('div', 'pouch-side');
  const next = button('btn btn-green pouch-next', '마무리 퀴즈');
  next.addEventListener('click', done);
  side.append(detail, next);
  const body = el('div', 'pouch-body');
  body.append(acts, side);
  panel.append(title, body);
  scene.appendChild(panel);

  // 처음 열 때 줄마다 차례로 금빛 테두리를 한 번 켠다(움직임 줄이기면 모두 바로 켠 모습).
  const timers = [];
  const allLit = () => { scene.dataset.lit = 'true'; };
  if (prefersReducedMotion()) {
    rows.forEach((r) => r.classList.add('lit', 'calm'));
    allLit();
  } else {
    rows.forEach((r, i) => timers.push(window.setTimeout(() => {
      r.classList.add('lit');
      if (i === rows.length - 1) allLit();
    }, i * LIGHT_STEP_MS)));
  }
  cards[0]?.focus({ preventScroll: true });
  return () => timers.forEach(clearTimeout);
}

// 만든 이: 제목과 줄(저절로 흐르지 않음, 길면 패널 안에서 스크롤), 끝에 인사와 "처음 화면으로"
function creditsPart(scene, state, done) {
  const nickname = state?.nickname ?? '';
  const panel = el('div', 'credits frame-panel');
  const roll = el('div', 'credits-roll');
  for (const c of ENDING.credits) {
    const block = el('section', 'credit');
    block.append(el('h3', 'credit-title', c.title), ...c.lines.map((line) => el('p', 'credit-line', formatLine(line, nickname))));
    roll.appendChild(block);
  }
  roll.appendChild(el('p', 'ending-thanks', formatLine(ENDING.thanks, nickname)));
  const actions = el('div', 'ending-actions');
  const home = button('btn btn-green', '처음 화면으로');
  home.addEventListener('click', done);
  actions.appendChild(home);
  panel.append(el('h2', 'credits-title frame-plate', '만든 이'), roll, actions);
  scene.appendChild(panel);
  home.focus();
  return () => {};
}

export const ending = {
  mount(root, params, ctx) {
    const step = Number(params.step) || 0;
    const n = ENDING.scenes.length;
    const state = ctx.getState();
    let alive = true;

    // 장면 대화: 바로 대화 장면으로 넘긴다(이 장면은 아무것도 그리지 않는다).
    if (step < n) {
      const sc = ENDING.scenes[step];
      queueMicrotask(() => {
        if (!alive) return;
        ctx.router.show('dialogue', {
          script: sc.lines, words: [], from: '', cast: ENDING.cast,
          bg: endingBg(sc.bg), still: !!sc.still, warm: !!sc.warm,
          next: 'ending', nextParams: { step: step + 1 },
        });
      });
      return () => { alive = false; };
    }

    const part = step === n ? 'message' : step === n + 1 ? 'pouch' : 'credits';
    const scene = el('section', 'end-scene ending-scene');
    scene.dataset.scene = 'ending';
    scene.dataset.part = part;
    const bg = el('div', 'ending-bg');
    bg.setAttribute('aria-hidden', 'true');
    setArt(bg, ASSETS.ending.ending03, 'ending-bg-img art');
    scene.appendChild(bg);
    root.appendChild(scene);
    // Enter를 꾹 누르고 있으면 다음 화면의 단추까지 눌리지 않게 되풀이 누름은 받지 않는다
    scene.addEventListener('keydown', (e) => {
      if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
    }, true);

    // 다음 걸음으로 한 번만 넘어간다(두 번 누르거나 Enter를 꾹 눌러도)
    let leaving = false;
    const go = (name, p) => () => {
      if (leaving) return;
      leaving = true;
      ctx.router.show(name, p);
    };
    const dispose = part === 'message' ? messagePart(scene, go('ending', { step: n + 1 }))
      : part === 'pouch' ? pouchPart(scene, state, go('review-quiz', { next: 'ending', nextParams: { step: n + 2 } }))
      : creditsPart(scene, state, go('title'));

    return () => {
      alive = false;
      leaving = true;
      dispose();
      scene.remove();
    };
  },
};
