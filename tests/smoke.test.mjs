import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../js/router.js';

test('show는 이전 장면을 치운 뒤 다음 장면을 붙인다', () => {
  const log = [];
  const fake = (name) => ({
    mount() {
      log.push(`${name}:mount`);
      return () => log.push(`${name}:unmount`);
    },
  });
  const router = createRouter({});
  router.register('a', fake('a'));
  router.register('b', fake('b'));
  router.show('a');
  assert.equal(router.current, 'a');
  router.show('b');
  assert.deepEqual(log, ['a:mount', 'a:unmount', 'b:mount']);
  assert.equal(router.current, 'b');
});

test('없는 장면은 오류를 던지고 현재 장면을 건드리지 않는다', () => {
  const log = [];
  const router = createRouter({});
  router.register('a', { mount() { log.push('a:mount'); return () => log.push('a:unmount'); } });
  router.show('a');
  assert.throws(() => router.show('nope'), /nope/);
  assert.equal(router.current, 'a');
  assert.deepEqual(log, ['a:mount']);
});

test('mount는 root, params, ctx(router 포함)를 받는다', () => {
  const root = {};
  let got;
  const router = createRouter(root);
  router.register('a', { mount(r, p, c) { got = [r, p, c]; } });
  router.show('a', { x: 1 });
  assert.equal(got[0], root);
  assert.deepEqual(got[1], { x: 1 });
  assert.equal(got[2].router, router);
  assert.equal(got[2].store, null);
  assert.equal(got[2].getState(), null);
});

test('mount가 실패하면 그 장면을 지금 장면으로 삼지 않는다', () => {
  const router = createRouter({});
  router.register('a', { mount() { return () => {}; } });
  router.register('bad', { mount() { throw new Error('그리기 실패'); } });
  router.show('a');
  assert.throws(() => router.show('bad'), /그리기 실패/);
  assert.equal(router.current, null);
  router.show('a');
  assert.equal(router.current, 'a');
});
