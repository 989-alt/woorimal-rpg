import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSubmit, titleDecision, stillSameName } from '../js/scenes/select.js';
import { createStore } from '../js/save.js';
import { newGame } from '../js/rules/game.js';

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

test('조합 중 엔터는 받지 않는다', () => {
  assert.equal(shouldSubmit({ key: 'Enter', isComposing: true }), false);
  assert.equal(shouldSubmit({ key: 'Enter', isComposing: false }), true);
  assert.equal(shouldSubmit({ key: 'a', isComposing: false }), false);
});

test('같은 닉네임으로 처음부터 → 덮어쓰기 확인', () => {
  const store = createStore(memStorage());
  store.save(newGame({ nickname: '하늘', avatar: 'f' }));
  assert.deepEqual(titleDecision({ nickname: '하늘', avatar: 'f', choice: 'new', store }), { action: 'ask-overwrite' });
});

test('없는 닉네임으로 처음부터 → start', () => {
  const store = createStore(memStorage());
  const r = titleDecision({ nickname: '하늘', avatar: 'm', choice: 'new', store });
  assert.equal(r.action, 'start');
  assert.equal(r.state.nickname, '하늘');
  assert.equal(r.state.avatar, 'm');
});

test('이어하기: 저장 있음 → start, 깨짐 → load-error', () => {
  const storage = memStorage();
  const store = createStore(storage);
  const saved = { ...newGame({ nickname: '하늘', avatar: 'f' }), chapter: '1-2' };
  store.save(saved);
  const r = titleDecision({ nickname: '하늘', avatar: 'm', choice: 'continue', store });
  assert.equal(r.action, 'start');
  assert.equal(r.state.chapter, '1-2');
  assert.equal(r.state.avatar, 'f');
  storage.setItem('malbit:save:바다', '{깨짐');
  assert.deepEqual(titleDecision({ nickname: '바다', avatar: 'f', choice: 'continue', store }), { action: 'load-error' });
});

test('이어하기: 저장이 없으면 not-found', () => {
  const store = createStore(memStorage());
  assert.deepEqual(titleDecision({ nickname: '구름', avatar: 'm', choice: 'continue', store }), { action: 'not-found' });
});

test('잘못된 닉네임 → invalid', () => {
  const store = createStore(memStorage());
  for (const choice of ['new', 'continue']) {
    const r = titleDecision({ nickname: '  ', avatar: 'f', choice, store });
    assert.equal(r.action, 'invalid');
    assert.ok(r.error);
  }
  assert.equal(titleDecision({ nickname: '일곱글자이름이다', avatar: 'f', choice: 'new', store }).action, 'invalid');
});

test('확인 창 단추: 창을 열 때 이름과 지금 이름 칸이 같을 때만 움직인다', () => {
  assert.equal(stillSameName('하늘', '하늘'), true);
  assert.equal(stillSameName('하늘', ' 하늘 '), true);
  assert.equal(stillSameName('하늘', '하늘2'), false);
  assert.equal(stillSameName('하늘', '바다'), false);
  assert.equal(stillSameName('하늘', ''), false);
});
