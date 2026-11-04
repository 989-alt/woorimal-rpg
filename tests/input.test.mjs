import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { bindInput, HOLD_MS } from '../js/explore/input.js';

function key(type, k, extra = {}) {
  const e = new Event(type, { cancelable: true });
  return Object.assign(e, { key: k, code: '', repeat: false, isComposing: false }, extra);
}

function setup() {
  const target = new EventTarget();
  const log = [];
  const unbind = bindInput(target, {
    move: (dir) => log.push(`move:${dir}`),
    act: () => log.push('act'),
    codex: () => log.push('codex'),
    tasks: () => log.push('tasks'),
  });
  const press = (k, extra) => {
    const down = key('keydown', k, extra);
    target.dispatchEvent(down);
    target.dispatchEvent(key('keyup', k, extra));
    return down;
  };
  return { target, log, unbind, press };
}

test('방향키·WASD는 move, 스페이스·엔터는 act, E는 codex, Q는 tasks', () => {
  const { log, press, unbind } = setup();
  press('ArrowUp');
  press('w');
  press('ArrowDown');
  press('s');
  press('ArrowLeft');
  press('a');
  press('ArrowRight');
  press('d');
  press(' ');
  press('Enter');
  press('e');
  press('q');
  assert.deepEqual(log, [
    'move:up', 'move:up', 'move:down', 'move:down', 'move:left', 'move:left', 'move:right', 'move:right',
    'act', 'act', 'codex', 'tasks',
  ]);
  unbind();
});

test('대문자와 한글 자판(code로 판단)도 같은 동작이다', () => {
  const { log, press, unbind } = setup();
  press('W');
  press('ㅈ', { code: 'KeyW' });
  press('Process', { code: 'KeyE' });
  press('ㅂ', { code: 'KeyQ' });
  assert.deepEqual(log, ['move:up', 'move:up', 'codex', 'tasks']);
  unbind();
});

test('다룬 키는 기본 동작을 막고, 모르는 키·조합 키·입력 조합 중은 무시한다', () => {
  const { log, press, unbind } = setup();
  assert.equal(press('ArrowUp').defaultPrevented, true);
  assert.equal(press('x').defaultPrevented, false);
  press('w', { ctrlKey: true });
  press('Enter', { isComposing: true });
  assert.deepEqual(log, ['move:up']);
  unbind();
});

test('누르고 있으면 150ms마다 한 칸씩, 떼면 멈춘다', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { target, log, unbind } = setup();
    assert.equal(HOLD_MS, 150);
    target.dispatchEvent(key('keydown', 'ArrowRight'));
    assert.deepEqual(log, ['move:right']);
    // 브라우저가 보내는 자동 반복 keydown은 칸 수를 늘리지 않는다.
    target.dispatchEvent(key('keydown', 'ArrowRight', { repeat: true }));
    mock.timers.tick(149);
    assert.equal(log.length, 1);
    mock.timers.tick(1);
    assert.equal(log.length, 2);
    mock.timers.tick(150);
    assert.deepEqual(log, ['move:right', 'move:right', 'move:right']);
    target.dispatchEvent(key('keyup', 'ArrowRight'));
    mock.timers.tick(600);
    assert.equal(log.length, 3);
    unbind();
  } finally {
    mock.timers.reset();
  }
});

test('다른 방향을 누르면 그 방향으로 바뀌고, 그 키를 떼면 아직 누른 방향으로 돌아간다', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { target, log, unbind } = setup();
    target.dispatchEvent(key('keydown', 'ArrowUp'));
    target.dispatchEvent(key('keydown', 'ArrowLeft'));
    mock.timers.tick(150);
    assert.deepEqual(log, ['move:up', 'move:left', 'move:left']);
    target.dispatchEvent(key('keyup', 'ArrowLeft'));
    mock.timers.tick(150);
    assert.deepEqual(log.slice(3), ['move:up']);
    target.dispatchEvent(key('keyup', 'ArrowUp'));
    mock.timers.tick(450);
    assert.equal(log.length, 4);
    unbind();
  } finally {
    mock.timers.reset();
  }
});

test('창이 초점을 잃거나 unbind하면 반복이 멈추고 더는 듣지 않는다', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { target, log, unbind, press } = setup();
    target.dispatchEvent(key('keydown', 'ArrowDown'));
    target.dispatchEvent(new Event('blur'));
    mock.timers.tick(450);
    assert.equal(log.length, 1);
    target.dispatchEvent(key('keydown', 'ArrowDown'));
    unbind();
    mock.timers.tick(450);
    press('e');
    assert.equal(log.length, 2);
  } finally {
    mock.timers.reset();
  }
});

test('버튼에 초점이 있을 때 Space·Enter는 가로채지 않는다', () => {
  const { log, target, unbind } = setup();
  for (const k of [' ', 'Enter']) {
    const e = key('keydown', k, { code: k === ' ' ? 'Space' : 'Enter' });
    Object.defineProperty(e, 'target', { value: { tagName: 'BUTTON' } });
    target.dispatchEvent(e);
    assert.equal(e.defaultPrevented, false);
  }
  assert.deepEqual(log, []);
  unbind();
});
