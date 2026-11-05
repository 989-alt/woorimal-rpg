// 작은 몬스터 복습전 규칙: 얻은 낱말로 뜻 고르기 문제를 자동으로 만든다.
import { WORDS } from '../../data/words.js';
import { shuffle } from './rng.js';

export function makeMeaningQuestion(wordId, act, rng) {
  const target = WORDS.find((w) => w.id === wordId);
  if (!target) throw new Error(`모르는 낱말: ${wordId}`);
  const others = WORDS.filter((w) => w.id !== wordId && w.meaning !== target.meaning);
  const seen = new Set([target.meaning]);
  const uniq = (list) => shuffle(list, rng).map((w) => w.meaning).filter((m) => !seen.has(m) && seen.add(m));
  const picks = [...uniq(others.filter((w) => w.act === act)), ...uniq(others.filter((w) => w.act !== act))].slice(0, 3);
  const options = shuffle([target.meaning, ...picks], rng);
  return { prompt: `'${target.word}'의 뜻은?`, options, answer: options.indexOf(target.meaning) };
}

function pick(pool, last, rng) {
  const cands = pool.length > 1 ? pool.filter((id) => id !== last) : pool;
  return cands[Math.floor(rng() * cands.length)];
}

export function createReview({ pool, act, seed }) {
  if (!pool || pool.length === 0) throw new Error('복습할 낱말이 없어요');
  const rng = makeRngLocal(seed);
  const word = pick(pool, null, rng);
  return { pool: [...pool], act, correct: 0, need: 3, last: null, word, question: makeMeaningQuestion(word, act, rng), result: null };
}

export function answerReview(r, isCorrect, rng) {
  if (r.result) return r;
  const correct = r.correct + (isCorrect ? 1 : 0);
  if (correct >= r.need) return { ...r, correct, result: 'win' };
  const word = pick(r.pool, r.word, rng);
  return { ...r, correct, last: r.word, word, question: makeMeaningQuestion(word, r.act, rng) };
}

import { makeRng as makeRngLocal } from './rng.js';
