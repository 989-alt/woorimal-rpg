// js/ui/images.js를 가짜 Image·document로 시험한다(브라우저 없이).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// 가짜 Image: src를 넣으면 다음 틈(setTimeout)에 onload 또는 onerror. fail에 든 경로는 실패한다.
const fail = new Set();
const requested = [];
globalThis.Image = class {
  set src(v) {
    this._src = v;
    requested.push(v);
    setTimeout(() => (fail.has(v) ? this.onerror?.() : this.onload?.()), 0);
  }
  get src() { return this._src; }
};
// 가짜 document·host: setArt가 쓰는 것만
globalThis.document = { createElement: (tag) => ({ tag, className: '', remove() { this.removed = true; } }) };
function fakeHost() {
  const classes = new Set();
  const host = {
    isConnected: true,
    children: [],
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    prepend(el) { this.children.unshift(el); el.remove = () => { this.children = this.children.filter((x) => x !== el); }; },
  };
  return host;
}
const tick = () => new Promise((r) => setTimeout(r, 5));

const { loadImage, getLoaded, setArt, forgetFailed } = await import('../js/ui/images.js');

beforeEach(() => { fail.clear(); requested.length = 0; });

test('setArt: A→B→A로 빨리 바꿔도 그림은 하나만, 마지막 경로의 것이 들어간다', async () => {
  const host = fakeHost();
  setArt(host, 'a.webp');
  setArt(host, 'b.webp');
  setArt(host, 'a.webp');
  await tick();
  await tick();
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0].src, 'a.webp');
  assert.ok(host.classList.contains('has-art'));
});

test('setArt: A를 넣은 뒤 B로 바꾸면 A 그림은 치우고 B만 남는다', async () => {
  const host = fakeHost();
  setArt(host, 'c.webp');
  await tick();
  setArt(host, 'd.webp');
  await tick();
  assert.deepEqual(host.children.map((e) => e.src), ['d.webp']);
});

test('setArt: 못 불러오면 그림 없이 임시 그림 그대로(has-art 없음)', async () => {
  fail.add('gone.webp');
  const host = fakeHost();
  setArt(host, 'gone.webp');
  await tick();
  assert.equal(host.children.length, 0);
  assert.equal(host.classList.contains('has-art'), false);
});

test('불러오기 실패: 같은 장면에서는 다시 받지 않고, forgetFailed 뒤에 한 번 더 받는다(거부하지 않는다)', async () => {
  fail.add('flaky.png');
  assert.equal(await loadImage('flaky.png'), null);
  assert.equal(getLoaded('flaky.png'), null);
  assert.equal(await loadImage('flaky.png'), null);
  assert.equal(requested.filter((p) => p === 'flaky.png').length, 1, '같은 장면 안에서는 한 번만');
  // 와이파이가 돌아옴 → 다음 장면을 열 때 다시 받아 본다
  fail.delete('flaky.png');
  forgetFailed();
  const img = await loadImage('flaky.png');
  assert.ok(img);
  assert.equal(getLoaded('flaky.png'), img);
  assert.equal(requested.filter((p) => p === 'flaky.png').length, 2);
  // 성공한 그림은 forgetFailed가 지우지 않는다
  forgetFailed();
  assert.equal(getLoaded('flaky.png'), img);
  assert.equal(requested.filter((p) => p === 'flaky.png').length, 2);
});
