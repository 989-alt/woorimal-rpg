// 전투 장면: 막 보스전(mode 'boss')과 작은 몬스터 복습전(mode 'review').
// 전투 도중 진행은 저장하지 않는다. 결과(이김·짐)만 상태를 바꾼다.
import { WORDS } from '../../data/words.js';
import { actOfChapter } from '../../data/acts/index.js';
import { createBattle, currentWord, answer, retry, optionOrder } from '../rules/battle.js';
import { createReview, answerReview } from '../rules/review.js';
import { actWords, chapterOf, finishAct, markTip } from '../rules/game.js';
import { dueHint } from '../rules/tutorial.js';
import { createHintLayer } from '../ui/hint.js';
import { isCoarsePointer } from '../explore/input.js';
import { winSmall } from '../rules/quests.js';
import { makeRng } from '../rules/rng.js';
import { attachJosa } from '../rules/josa.js';
import {
  TYPE_LABEL, COLUMNS, buildFrame, layoutTail, drawFrame, renderPrompt, buildOptions, markOptions, moveFocus, feedbackPanel,
} from '../ui/battle-layout.js';
import { HIT_MS, playHit, playMiss } from '../ui/battle-fx.js';
import { ASSETS } from '../../data/assets.js';
import { setArt } from '../ui/images.js';

const HEARTS = 5;
const HP = 6;
const KEY_GUARD_MS = 300; // '다음'이 뜬 직후 키 연타로 넘어가지 않게
const WIN_MSG_MS = 1500;

// 검사용(?test=1): 지금 전투의 정답 자리와 요약
let probe = null;
export const battleProbe = () => probe;

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const DIGIT = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export const battle = {
  mount(root, params, ctx) {
    let state = ctx.getState();
    if (!state) return () => {};
    const mode = params.mode === 'boss' ? 'boss' : 'review';
    const act = actOfChapter(state.chapter);
    const chapter = chapterOf(act, state.chapter);
    const seed = params.seed ?? Date.now();
    const rng = makeRng(seed ^ 0x5bd1e995);
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
    let leaving = false;
    const go = (name, p) => { if (!leaving) { leaving = true; ctx.router.show(name, p); } };

    const scene = el('section', `battle-scene mode-${mode}`);
    scene.dataset.scene = 'battle';
    scene.dataset.mode = mode;
    scene.dataset.phase = 'ask';
    scene.dataset.qn = '0';
    root.appendChild(scene);

    // 복습전은 얻은 낱말(어느 막이든)로 문제를 낸다. 얻은 낱말이 없으면 돌아간다.
    const pool = Object.keys(state.acquired);
    if (mode === 'review' && pool.length === 0) {
      const msg = el('div', 'battle-win frame-panel', '아직 복습할 낱말이 없어요.');
      scene.appendChild(msg);
      later(() => go('explore'), WIN_MSG_MS);
      return () => { leaving = true; timers.forEach(clearTimeout); scene.remove(); };
    }

    // 막 낱말을 이미 모두 보스전에 냈으면(막을 끝낸 뒤) 보스전을 열지 않는다.
    const words = actWords(act);
    if (mode === 'boss' && words.every((id) => state.askedWordIds.includes(id))) {
      queueMicrotask(() => { if (scene.isConnected) go('explore'); });
      return () => { leaving = true; scene.remove(); };
    }

    // ── 전투 규칙 상태 ──
    let b = null; // 보스전
    let r = null; // 복습전
    let streak = 0;
    let wrongCount = 0; // 복습전 틀린 수(검사용 요약)
    if (mode === 'boss') {
      b = params.retryOf ? retry(params.retryOf, seed) : createBattle({ wordIds: words, seed, finalWordId: act.finalWordId ?? null });
    } else {
      r = createReview({ pool, act: act.id, seed });
    }
    const monsterName = mode === 'boss' ? act.boss.name : act.small.name;

    const f = buildFrame({ mode, nickname: state.nickname, monsterName, hearts: HEARTS, hp: HP });
    scene.append(f.stage, f.bottom);
    layoutTail(f);
    const hints = createHintLayer(scene);
    const onResize = () => { layoutTail(f); hints.reposition(); };
    window.addEventListener('resize', onResize);
    // 그림이 있으면 무대·주인공·몬스터를 그림으로, 없거나 못 불러오면 임시 그림 그대로
    setArt(f.bg, ASSETS.battleBg[act.id], 'battle-bg-img art');
    const avatar = state.avatar === 'm' ? 'm' : 'f';
    f.hero.dataset.avatar = avatar;
    setArt(f.hero, ASSETS.battleHero[avatar], 'battle-hero-img art');
    // 복습전의 꼬마 안개도 막 몬스터 그림을 쓴다(작게, 이름표는 꼬마 안개 그대로)
    setArt(f.monster, ASSETS.monster[act.id], 'battle-monster-img art');
    let options = null; // { el, buttons }
    const drawHud = (fx = {}) => drawFrame(f, {
      ...fx,
      streak,
      ...(b ? { hearts: b.hearts, hp: b.hp, maxHp: HP } : { light: r.need - r.correct, need: r.need }),
    });

    // ── 문제 ──
    let q = null; // { wordId, type, prompt, options, answer }
    let blank = null;
    let phase = 'ask';
    let qn = 0;
    const setPhase = (p) => { phase = p; scene.dataset.phase = p; };

    function makeQuestion() {
      if (b) {
        const wordId = currentWord(b);
        const raw = act.bossQuizzes[wordId];
        return { wordId, type: raw.type, prompt: raw.prompt, ...optionOrder(raw, rng) };
      }
      return { wordId: r.word, type: 'meaning', ...r.question };
    }

    // 안내 앵커: 보기 묶음은 문제 말풍선 위에, 하트는 주인공 명판에. (보기 묶음 바로 위는 문제 글이므로 말풍선 위로 올려 글을 가리지 않는다)
    const optionsAnchor = () => {
      const l = scene.getBoundingClientRect();
      const o = options.el.getBoundingClientRect();
      const qb = f.question.getBoundingClientRect();
      return { x: o.left - l.left, y: qb.top - l.top, w: o.width, h: qb.height };
    };
    const anchorOf = { options: optionsAnchor, hearts: f.status };

    // 처음 문제가 나올 때 이 전투의 안내를 묻는다(규칙은 tutorial.js). 띄우면 본 것으로 기록한다.
    function pickHint() {
      const hint = dueHint(ctx.getState(), chapter, { type: 'battle', mode }, { touch: isCoarsePointer() });
      if (!hint) return;
      ctx.setState(markTip(ctx.getState(), hint.id));
      hints.show(hint, anchorOf[hint.anchor]);
    }

    function ask() {
      q = makeQuestion();
      qn += 1;
      f.typeTag.textContent = TYPE_LABEL[q.type];
      blank = renderPrompt(f.prompt, q);
      const next = buildOptions(q.type, q.options, pick);
      if (options) options.el.replaceWith(next.el);
      else f.bottom.appendChild(next.el);
      options = next;
      scene.dataset.qn = String(qn);
      setPhase('ask');
      options.el.focus({ preventScroll: true });
      if (qn === 1) pickHint();
    }

    function pick(i) {
      if (phase !== 'ask' || leaving) return; // 한 문제에 한 번만
      hints.done('pick');
      const ok = i === q.answer;
      setPhase(ok ? 'hit' : 'miss');
      markOptions(options.buttons, i, q.answer);
      if (b) b = answer(b, ok);
      else {
        r = answerReview(r, ok, rng);
        if (!ok) wrongCount += 1;
      }
      streak = ok ? streak + 1 : 0;
      if (ok) onHit(i);
      else onMiss();
    }

    function onHit() {
      blank.fill(q.options[q.answer]);
      const won = b ? b.result === 'win' : r.result === 'win';
      drawHud({ crackCell: true });
      const info = WORDS.find((w) => w.id === q.wordId);
      playHit(f.fx, {
        hand: f.hand, monster: f.monster, world: f.world, word: info?.word ?? q.wordId, streak, lastHit: won,
        cell: b ? f.cells.children[b.hp] : f.lightLeft, // 복습전은 "남은 빛" 글자에서 금 조각
      });
      later(() => (won ? win() : ask()), HIT_MS);
    }

    function onMiss() {
      blank.fill(q.options[q.answer]);
      drawHud({ crackHeart: true });
      playMiss(f.fog, { monster: f.monster, review: !b });
      const info = WORDS.find((w) => w.id === q.wordId);
      const { el: panel, nextBtn } = feedbackPanel({ answer: q.options[q.answer], word: info.word, meaning: info.meaning });
      const shownAt = performance.now();
      nextBtn.addEventListener('click', (e) => {
        if (e.detail === 0 && performance.now() - shownAt < KEY_GUARD_MS) return;
        if (phase !== 'miss') return;
        panel.remove();
        f.fog.classList.remove('tight', 'dim');
        if (b && b.result === 'lose') go('gameover', { retryOf: { order: b.order, finalWordId: b.finalWordId } });
        else ask();
      });
      f.stage.appendChild(panel);
      nextBtn.focus({ preventScroll: true });
    }

    function win() {
      if (b) {
        state = finishAct(ctx.getState(), act, b.order);
        ctx.setState(state);
        go('clear', { kind: 'act' });
        return;
      }
      const before = ctx.getState();
      state = winSmall(before, chapter);
      setPhase('won');
      // 쫓기 부탁이 진행 중이 아니었으면(바뀐 것이 없으면) 쫓아냈다는 말 없이 돌아간다.
      if (state === before) { go('explore'); return; }
      ctx.setState(state);
      ctx.store?.save?.(state);
      const msg = el('div', 'battle-win frame-panel', `${attachJosa(act.small.name, '을')} 쫓아냈다!`);
      msg.setAttribute('role', 'status');
      scene.appendChild(msg);
      later(() => go('explore'), WIN_MSG_MS);
    }

    function onKey(e) {
      if (e.repeat || leaving || phase !== 'ask' || !options) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const i = DIGIT[e.code] ?? (['1', '2', '3', '4'].includes(e.key) ? Number(e.key) - 1 : undefined);
      if (i !== undefined) {
        e.preventDefault();
        pick(i);
      } else if (ARROWS.includes(e.key)) {
        e.preventDefault();
        moveFocus(options.buttons, e.key, COLUMNS[q.type]);
      }
    }
    document.addEventListener('keydown', onKey);

    probe = {
      answerIndex: () => q?.answer ?? -1,
      snapshot: () => (b
        ? { mode, order: [...b.order], hearts: b.hearts, hp: b.hp, correct: b.correct, wrong: b.wrong, streak: b.streak }
        : { mode, pool: [...r.pool], correct: r.correct, wrong: wrongCount, need: r.need, streak }),
    };

    drawHud();
    ask();

    return () => {
      leaving = true;
      probe = null;
      hints.dispose();
      timers.forEach(clearTimeout);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      scene.remove();
    };
  },
};
