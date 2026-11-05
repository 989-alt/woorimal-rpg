import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMeaningQuestion, createReview, answerReview } from '../js/rules/review.js';
import { makeRng } from '../js/rules/rng.js';
import { WORDS } from '../data/words.js';

test('뜻 고르기 문제: 보기 4개 서로 다름, 정답 뜻이 정답 자리에', () => {
  for (let s = 1; s < 30; s++) {
    const q = makeMeaningQuestion('어스름', 1, makeRng(s));
    assert.equal(q.prompt, "'어스름'의 뜻은?");
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.equal(q.options[q.answer], WORDS.find(w => w.id === '어스름').meaning);
    const act1 = WORDS.filter(w => w.act === 1).map(w => w.meaning);
    for (const o of q.options) assert.ok(act1.includes(o));
  }
});

test('3개 맞히면 승리, 틀려도 끝나지 않는다', () => {
  const rng = makeRng(5);
  let r = createReview({ pool: ['어스름', '아침나절', '해거름'], act: 1, seed: 3 });
  assert.equal(r.need, 3);
  r = answerReview(r, false, rng);
  assert.equal(r.correct, 0); assert.equal(r.result, null);
  r = answerReview(r, true, rng); r = answerReview(r, true, rng);
  assert.equal(r.result, null);
  r = answerReview(r, true, rng);
  assert.equal(r.result, 'win'); assert.equal(r.correct, 3);
  assert.equal(answerReview(r, false, rng), r);
});

test('얻은 낱말이 2개뿐이면 번갈아 낸다', () => {
  const rng = makeRng(9);
  let r = createReview({ pool: ['어스름', '아침나절'], act: 1, seed: 2 });
  for (let i = 0; i < 6 && !r.result; i++) {
    const prev = r.word;
    r = answerReview(r, i % 2 === 0, rng);
    if (!r.result) { assert.notEqual(r.word, prev); assert.equal(r.last, prev); }
  }
});

test('낱말 1개면 그대로, 비면 오류', () => {
  const rng = makeRng(1);
  let r = createReview({ pool: ['어스름'], act: 1, seed: 1 });
  r = answerReview(r, false, rng);
  assert.equal(r.word, '어스름');
  assert.throws(() => createReview({ pool: [], act: 1, seed: 1 }));
});
