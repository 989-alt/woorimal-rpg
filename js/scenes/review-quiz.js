// 마무리 퀴즈(엔딩 뒤 · 처음 화면). params = { next = 'title', nextParams, seed? }
// 낱말 10개: 뜻 고르기 4 · 초성 3 · 상황 빈칸 3(규칙은 js/rules/review-quiz.js). 하트·게임 오버·시간 제한 없음.
// 답하면 바로 맞음/틀림과 뜻을 보이고 "다음". 끝나면 결과(맞힌 수, 낱말별 ○/×, 틀린 낱말 뜻)와 "다시 풀기"·"계속".
// 모습은 전투의 문제 말풍선·보기 카드(UI 키트)를 그대로 쓴다.
import { WORDS } from '../../data/words.js';
import { buildQuiz, checkChosung, QUIZ_SIZE } from '../rules/review-quiz.js';
import { makeRng } from '../rules/rng.js';
import { buildOptions, markOptions, moveFocus, renderPrompt } from '../ui/battle-layout.js';
import { shouldSubmit } from './select.js';
import { sfx } from '../ui/audio.js';

const TYPE_LABEL = { meaning: '뜻 고르기', chosung: '초성 퀴즈', situation: '알맞은 낱말 넣기' };
const OPTION_LAYOUT = { meaning: 'meaning', situation: 'blank' }; // 보기 모양: 뜻 카드, 낱말 카드(퀴즈에서는 둘 다 2×2로 놓는다)
const COLS = 2;
const DIGIT = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };

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
// ○ × 표: 모양은 CSS가 그리고, 읽어 주는 프로그램에는 "맞음"/"틀림"
const markEl = (ok) => {
  const m = el('span', `quiz-mark ${ok ? 'right' : 'wrong'}`);
  m.append(el('span', 'sr-only', ok ? '맞음' : '틀림'));
  return m;
};
const wordOf = (id) => WORDS.find((w) => w.id === id);
const newSeed = () => (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;

let probe = null;
// 검사용(?test=1): 지금 문제와 정답
export function reviewQuizProbe() { return probe; }

export const reviewQuiz = {
  mount(root, params, ctx) {
    const next = params.next ?? 'title';
    const seed = params.seed ?? newSeed();
    const quiz = buildQuiz(WORDS, makeRng(seed));
    const results = []; // { word, ok, typed? }
    let qn = 0;
    let answered = false;
    let leaving = false;
    let buttons = [];
    let input = null;

    const scene = el('section', 'end-scene quiz-scene');
    scene.dataset.scene = 'review-quiz';
    const bg = el('div', 'ending-bg');
    bg.setAttribute('aria-hidden', 'true');
    const panel = el('div', 'quiz frame-panel');
    scene.append(bg, panel);
    root.appendChild(scene);

    const go = (name, p) => {
      if (leaving) return;
      leaving = true;
      ctx.router.show(name, p);
    };

    // ── 문제 ──
    function head() {
      const top = el('div', 'quiz-head');
      const steps = el('ol', 'quiz-steps');
      steps.setAttribute('aria-label', `${QUIZ_SIZE}문제 중 ${qn + 1}번째`);
      for (let i = 0; i < QUIZ_SIZE; i++) {
        const r = results[i];
        const li = el('li', `quiz-step${i === qn ? ' now' : ''}${r ? (r.ok ? ' right' : ' wrong') : ''}`);
        li.setAttribute('aria-hidden', 'true');
        steps.appendChild(li);
      }
      top.append(el('h2', 'quiz-title frame-plate', '마무리 퀴즈'), steps, el('p', 'quiz-count', `${qn + 1} / ${QUIZ_SIZE}`));
      return top;
    }

    function showQuestion() {
      const q = quiz[qn];
      const w = wordOf(q.word);
      answered = false;
      buttons = [];
      input = null;
      scene.dataset.phase = 'ask';
      scene.dataset.qn = String(qn);
      scene.dataset.type = q.type;

      const question = el('div', 'quiz-question frame-panel');
      question.append(el('span', 'quiz-type', TYPE_LABEL[q.type]));
      const prompt = el('p', 'quiz-prompt');
      prompt.setAttribute('aria-live', 'polite');
      question.appendChild(prompt);
      const area = el('div', 'quiz-area');
      const feedback = el('div', 'quiz-feedback frame-plate');
      feedback.setAttribute('role', 'status');
      const hint = el('p', 'quiz-hint');
      feedback.appendChild(hint);
      let fill = null;

      const finish = (ok, typed) => {
        answered = true;
        sfx(ok ? 'correct' : 'wrong');
        scene.dataset.phase = 'feedback';
        results.push({ word: q.word, ok, typed });
        fill?.(q.fill);
        const verdict = el('p', 'quiz-verdict');
        verdict.append(markEl(ok), ok ? '맞았어요!' : '아쉬워요! 정답은 ');
        if (!ok) verdict.append(el('b', 'quiz-answer', w.word));
        const meaning = el('p', 'quiz-meaning');
        meaning.append(el('b', 'quiz-meaning-word', w.word), `: ${w.meaning}`);
        const last = qn === quiz.length - 1;
        const nextBtn = button('btn btn-green quiz-next', last ? '결과 보기' : '다음');
        nextBtn.addEventListener('click', () => {
          if (leaving) return;
          qn += 1;
          if (qn < quiz.length) showQuestion(); else showResult();
        });
        const body = el('div', 'quiz-feedback-body');
        body.append(verdict, meaning);
        if (!ok && typed) body.append(el('p', 'quiz-typed', `내가 쓴 답: ${typed}`));
        feedback.replaceChildren(body, nextBtn);
        feedback.classList.add(ok ? 'right' : 'wrong');
        nextBtn.focus();
      };

      if (q.type === 'chosung') {
        prompt.append('초성과 뜻을 보고 낱말을 써 보세요.');
        question.append(el('p', 'quiz-clue', `뜻: ${q.meaning}`));
        const tiles = el('div', 'quiz-jamo');
        tiles.setAttribute('aria-label', `초성 ${[...q.chosung].join(' ')}`);
        for (const c of q.chosung) {
          const t = el('span', 'quiz-tile', c);
          t.setAttribute('aria-hidden', 'true');
          tiles.appendChild(t);
        }
        const form = el('div', 'quiz-write');
        const label = el('label', 'sr-only', '낱말 쓰기');
        label.htmlFor = 'quiz-input';
        input = el('input', 'quiz-input');
        input.id = 'quiz-input';
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('enterkeyhint', 'done');
        input.maxLength = 12;
        input.placeholder = '여기에 낱말을 써요';
        const ok = button('btn btn-green quiz-submit', '확인');
        const submit = () => {
          if (answered || !input.value.trim()) return; // 빈 답은 기회를 쓰지 않는다
          const right = checkChosung(input.value, w.word);
          input.disabled = true;
          ok.disabled = true;
          form.classList.add(right ? 'right' : 'wrong');
          finish(right, input.value.trim());
        };
        input.addEventListener('keydown', (e) => {
          if (shouldSubmit({ key: e.key, isComposing: e.isComposing || e.keyCode === 229 })) { e.preventDefault(); submit(); }
        });
        ok.addEventListener('click', submit);
        form.append(label, input, ok);
        area.append(tiles, form);
        hint.textContent = '한 번만 쓸 수 있어요. 띄어쓰기는 상관없어요.';
      } else {
        fill = renderPrompt(prompt, { type: q.type === 'situation' ? 'blank' : 'meaning', prompt: q.prompt }).fill;
        const opts = buildOptions(OPTION_LAYOUT[q.type], q.options, (i) => {
          if (answered) return;
          markOptions(opts.buttons, i, q.answer);
          finish(i === q.answer);
        });
        buttons = opts.buttons;
        area.appendChild(opts.el);
        hint.textContent = '번호 키 1~4로도 고를 수 있어요.';
      }

      panel.replaceChildren(head(), question, area, feedback);
      (input ?? buttons[0])?.focus();
    }

    // ── 결과 ──
    function showResult() {
      scene.dataset.phase = 'result';
      delete scene.dataset.type;
      const right = results.filter((r) => r.ok).length;
      const title = el('h2', 'quiz-title frame-plate', '마무리 퀴즈 결과');
      const score = el('p', 'quiz-score', `${QUIZ_SIZE}문제 중 ${right}개 맞힘`);
      const cheer = el('p', 'quiz-cheer', right === QUIZ_SIZE ? '모두 맞혔어요! 낱말이 모두 반짝여요.' : '틀린 낱말은 뜻을 한 번 더 읽어 봐요.');
      const list = el('ul', 'quiz-results');
      for (const r of results) {
        const w = wordOf(r.word);
        const li = el('li', `quiz-result frame-card ${r.ok ? 'right' : 'wrong'}`);
        const line = el('p', 'quiz-result-line');
        line.append(markEl(r.ok), el('b', 'quiz-result-word', w.word));
        li.appendChild(line);
        if (!r.ok) li.appendChild(el('p', 'quiz-result-meaning', w.meaning));
        list.appendChild(li);
      }
      const again = button('btn btn-wood', '다시 풀기');
      again.addEventListener('click', () => go('review-quiz', { next, nextParams: params.nextParams, seed: newSeed() }));
      const cont = button('btn btn-green', '계속');
      cont.addEventListener('click', () => go(next, params.nextParams));
      const actions = el('div', 'end-actions quiz-actions');
      actions.append(again, cont);
      const top = el('div', 'quiz-result-head');
      top.append(title, score, cheer);
      panel.replaceChildren(top, list, actions);
      cont.focus();
    }

    // 보기: 번호 키로 고르기, 방향키로 초점 옮기기
    const onKey = (e) => {
      if (e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return; } // 꾹 누름이 다음 단추까지 누르지 않게
      if (scene.dataset.phase !== 'ask' || buttons.length === 0) return;
      if (e.code in DIGIT) {
        e.preventDefault();
        buttons[DIGIT[e.code]]?.click();
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        moveFocus(buttons, e.key, COLS);
      }
    };
    window.addEventListener('keydown', onKey, true);

    probe = {
      snapshot: () => {
        const q = quiz[qn];
        return {
          phase: scene.dataset.phase, qn, total: quiz.length, type: q?.type, word: q?.word,
          answerIndex: q && q.type !== 'chosung' ? q.answer : -1,
          answerText: q?.type === 'chosung' ? q.answerText : null,
        };
      },
    };
    showQuestion();

    return () => {
      leaving = true;
      probe = null;
      window.removeEventListener('keydown', onKey, true);
      scene.remove();
    };
  },
};
