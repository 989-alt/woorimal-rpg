import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, currentWord, answer, retry, optionOrder } from '../js/rules/battle.js';
import { makeRng } from '../js/rules/rng.js';
import { actWords } from '../js/rules/game.js';
import { WORDS } from '../data/words.js';
import ACT from '../data/acts/act1.js';

const ten = actWords(ACT);

test('6개 맞히면 승리', () => {
  let b = createBattle({ wordIds: ten, seed: 1 });
  for (let i = 0; i < 6; i++) b = answer(b, true);
  assert.equal(b.result, 'win');
  assert.equal(b.hp, 0);
});

test('5개 틀리면 게임 오버', () => {
  let b = createBattle({ wordIds: ten, seed: 1 });
  for (let i = 0; i < 4; i++) b = answer(b, false);
  assert.equal(b.result, null);
  b = answer(b, false);
  assert.equal(b.result, 'lose');
  assert.equal(b.hearts, 0);
});

test('어떤 맞힘·틀림 순서든 10문제 안에 승패가 난다', () => {
  for (let mask = 0; mask < 1024; mask++) {
    let b = createBattle({ wordIds: ten, seed: mask });
    for (let i = 0; i < 10 && !b.result; i++) b = answer(b, !!((mask >> i) & 1));
    assert.ok(b.result, `mask ${mask}`);
  }
});

test('각 낱말은 한 번씩만', () => {
  let b = createBattle({ wordIds: ten, seed: 7 });
  const seen = [];
  while (!b.result) { seen.push(currentWord(b)); b = answer(b, seen.length % 2 === 0); }
  assert.equal(new Set(seen).size, seen.length);
  assert.equal(currentWord(b), null);
});

test('answer는 새 객체를 돌려주고 결과 뒤에는 그대로', () => {
  const b0 = createBattle({ wordIds: ten, seed: 1 });
  const b1 = answer(b0, true);
  assert.notEqual(b0, b1);
  assert.equal(b0.hp, 6);
  let b = b1;
  for (let i = 0; i < 5; i++) b = answer(b, true);
  assert.equal(answer(b, false), b);
});

test('연속 정답은 피해를 늘리지 않는다', () => {
  let b = createBattle({ wordIds: ten, seed: 2 });
  for (let i = 0; i < 3; i++) b = answer(b, true);
  assert.equal(b.hp, 3);
  assert.equal(b.streak, 3);
  assert.equal(b.correct, 3);
  b = answer(b, false);
  assert.equal(b.streak, 0);
  assert.equal(b.hearts, 4);
  assert.equal(b.wrong, 1);
});

test('재도전은 같은 낱말 10개, 하트·HP 초기화', () => {
  let b = createBattle({ wordIds: ten, seed: 1 });
  for (let i = 0; i < 5; i++) b = answer(b, false);
  const r = retry(b, 99);
  assert.deepEqual([...r.order].sort(), [...ten].sort());
  assert.equal(r.hearts, 5);
  assert.equal(r.hp, 6);
  assert.equal(r.index, 0);
  assert.equal(r.result, null);
});

test('보스: 나래는 마지막, 그 전엔 HP 1에서 멈춤, 나래를 맞혀야 승리', () => {
  const ids = WORDS.filter(w => w.act === 5).map(w => w.id);
  let b = createBattle({ wordIds: ids, seed: 3, finalWordId: '나래' });
  assert.equal(b.order.at(-1), '나래');
  for (let i = 0; i < 9; i++) b = answer(b, true);
  assert.equal(b.hp, 1);
  assert.equal(b.result, null);
  assert.equal(currentWord(b), '나래');
  b = answer(b, false);
  assert.equal(currentWord(b), '나래');
  assert.equal(b.result, null);
  b = answer(b, true);
  assert.equal(b.result, 'win');
  assert.equal(b.hp, 0);
});

test('보스: 나래를 계속 틀리면 lose, 재도전도 나래가 마지막', () => {
  const ids = WORDS.filter(w => w.act === 5).map(w => w.id);
  let b = createBattle({ wordIds: ids, seed: 3, finalWordId: '나래' });
  for (let i = 0; i < 9; i++) b = answer(b, true);
  for (let i = 0; i < 5; i++) b = answer(b, false);
  assert.equal(b.result, 'lose');
  const r = retry(b, 5);
  assert.equal(r.finalWordId, '나래');
  assert.equal(r.order.at(-1), '나래');
  assert.deepEqual([...r.order].sort(), [...b.order].sort());
});

test('finalWordId가 없으면 던진다', () => {
  assert.throws(() => createBattle({ wordIds: ten, seed: 1, finalWordId: '없는말' }));
});

test('optionOrder는 정답 보기를 따라간다', () => {
  for (const quiz of Object.values(ACT.bossQuizzes)) {
    for (let s = 0; s < 20; s++) {
      const o = optionOrder(quiz, makeRng(s));
      assert.equal(o.options.length, quiz.options.length);
      assert.deepEqual([...o.options].sort(), [...quiz.options].sort());
      assert.equal(o.options[o.answer], quiz.options[quiz.answer]);
    }
  }
});
