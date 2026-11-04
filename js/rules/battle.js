// 막 보스전 규칙 (순수 함수)
import { makeRng, shuffle } from './rng.js';

const HEARTS = 5;
const HP = 6;

function makeOrder(wordIds, seed, finalWordId) {
  const rng = makeRng(seed);
  if (finalWordId == null) return shuffle(wordIds, rng);
  if (!wordIds.includes(finalWordId)) {
    throw new Error(`finalWordId not in wordIds: ${finalWordId}`);
  }
  return [...shuffle(wordIds.filter(id => id !== finalWordId), rng), finalWordId];
}

export function createBattle({ wordIds, seed, finalWordId = null }) {
  return {
    order: makeOrder(wordIds, seed, finalWordId),
    index: 0, hearts: HEARTS, hp: HP,
    correct: 0, wrong: 0, streak: 0,
    result: null, finalWordId,
  };
}

export function currentWord(b) {
  if (b.result) return null;
  return b.order[b.index] ?? null;
}

export function answer(b, isCorrect) {
  if (b.result) return b;
  const hasFinal = b.finalWordId != null;
  const onFinal = hasFinal && b.order[b.index] === b.finalWordId;
  const n = { ...b };
  if (isCorrect) {
    n.correct += 1;
    n.streak += 1;
    n.hp = hasFinal && !onFinal ? Math.max(1, b.hp - 1) : Math.max(0, b.hp - 1);
    if (n.hp === 0) n.result = 'win';
    n.index += 1;
  } else {
    n.wrong += 1;
    n.streak = 0;
    n.hearts = Math.max(0, b.hearts - 1);
    if (n.hearts === 0) n.result = 'lose';
    if (!onFinal) n.index += 1;
  }
  return n;
}

export function retry(b, seed) {
  return createBattle({ wordIds: b.order, seed, finalWordId: b.finalWordId });
}

export function optionOrder(quiz, rng) {
  const idx = shuffle(quiz.options.map((_, i) => i), rng);
  return { options: idx.map(i => quiz.options[i]), answer: idx.indexOf(quiz.answer) };
}
