// loadUiKit: 키 이름 규칙, 받은 것만 클래스·변수가 달리고 못 받은 것은 failed로 남는다.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS } from '../data/assets.js';
import { uiVarName, uiClassName, loadUiKit } from '../js/ui/ui-kit.js';
import { forgetFailed } from '../js/ui/images.js';

test('uiVarName·uiClassName은 camelCase 키를 kebab-case로 바꾼다', () => {
  assert.equal(uiVarName('btnGreen'), '--ui-btn-green');
  assert.equal(uiClassName('btnGreen'), 'ui-btn-green');
  assert.equal(uiVarName('panel'), '--ui-panel');
  assert.equal(uiClassName('panel'), 'ui-panel');
  assert.equal(uiClassName('hpCell'), 'ui-hp-cell');
  assert.equal(uiClassName('iconBook'), 'ui-icon-book');
});

// 브라우저가 아닌 곳이라 Image를 흉내 낸다: 경로에 failName이 있으면 onerror, 아니면 onload.
let failName = null;
class FakeImage {
  set src(v) {
    this._src = v;
    queueMicrotask(() => (failName && v.includes(failName) ? this.onerror?.() : this.onload?.()));
  }
  get src() { return this._src; }
}
const fakeRoot = () => {
  const classes = new Set();
  const vars = new Map();
  return {
    classes, vars,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    style: { setProperty: (k, v) => vars.set(k, v) },
  };
};

// images.js는 받은 그림을 경로별로 캐시하므로, 검사마다 경로 뒤에 꼬리표를 붙여 서로 섞이지 않게 한다.
const original = { ...ASSETS.ui };
let tag = 0;
const freshPaths = () => { tag++; for (const k of Object.keys(original)) ASSETS.ui[k] = `${original[k]}?t=${tag}`; };
beforeEach(() => { globalThis.Image = FakeImage; failName = null; forgetFailed(); freshPaths(); });
afterEach(() => { delete globalThis.Image; forgetFailed(); Object.assign(ASSETS.ui, original); });

test('모두 받으면 키마다 클래스와 변수가 달린다', async () => {
  const root = fakeRoot();
  const r = await loadUiKit(root);
  const keys = Object.keys(ASSETS.ui);
  assert.equal(keys.length, 17);
  assert.deepEqual([...r.ok].sort(), [...keys].sort());
  assert.deepEqual(r.failed, []);
  assert.equal(root.classes.size, 17);
  assert.equal(root.vars.get('--ui-btn-green'), `url("${ASSETS.ui.btnGreen}")`);
  assert.match(ASSETS.ui.btnGreen, /^assets\/ui\/btn_green\.v1\.png/);
  assert.ok(root.classes.has('ui-btn-green'));
});

test('heartFull만 못 받으면 failed에 그 키만 있고 나머지는 클래스·변수가 달린다', async () => {
  failName = 'heart_full';
  const root = fakeRoot();
  const r = await loadUiKit(root);
  assert.deepEqual(r.failed, ['heartFull']);
  assert.equal(r.ok.length, 16);
  assert.ok(!root.classes.has('ui-heart-full'));
  assert.ok(!root.vars.has('--ui-heart-full'));
  assert.ok(root.classes.has('ui-heart-empty'));
  assert.ok(root.vars.has('--ui-heart-empty'));
});

test('못 받은 키는 같은 장면 안에서는 다시 받지 않고, forgetFailed() 뒤에 다시 받으면 클래스가 달린다', async () => {
  failName = 'check.v1';
  const root = fakeRoot();
  const bad = await loadUiKit(root);
  assert.deepEqual(bad.failed, ['check']);
  assert.ok(!root.classes.has('ui-check'));
  failName = null;
  assert.deepEqual((await loadUiKit(root)).failed, ['check'], '실패는 캐시에 남아 있다');
  forgetFailed();
  const good = await loadUiKit(root);
  assert.deepEqual(good.failed, []);
  assert.ok(root.classes.has('ui-check'));
  // 다시 불러도 이미 받은 그림은 그대로(캐시)
  assert.deepEqual((await loadUiKit(root)).failed, []);
  assert.equal(root.classes.size, 17);
});

test('이미 달려 있던 클래스도 그림을 못 받게 되면 떼어진다', async () => {
  ASSETS.ui.coin = null;
  const root = fakeRoot();
  root.classes.add('ui-coin');
  await loadUiKit(root);
  assert.ok(!root.classes.has('ui-coin'));
});

test('ASSETS.ui의 경로가 null이면 failed(그림이 아직 없는 키)', async () => {
  ASSETS.ui.coin = null;
  const root = fakeRoot();
  const r = await loadUiKit(root);
  assert.deepEqual(r.failed, ['coin']);
  assert.ok(!root.classes.has('ui-coin'));
});
