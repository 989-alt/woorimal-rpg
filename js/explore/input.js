// 탐험 조작: 키보드와 (터치 기기에서만) 화면 버튼.
export const HOLD_MS = 250; // 한 칸 걷는 시간(선생님: 150ms는 너무 빨랐다)

// code를 먼저 본다: 한글 자판에서는 W가 'ㅈ'으로 들어오기 때문이다.
const BY_CODE = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Space: 'act', Enter: 'act', NumpadEnter: 'act', KeyE: 'codex', KeyQ: 'tasks',
};
const BY_KEY = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  ' ': 'act', Enter: 'act', e: 'codex', q: 'tasks',
};
const DIRS = new Set(['up', 'down', 'left', 'right']);

function actionOf(e) {
  if (e.code && BY_CODE[e.code]) return BY_CODE[e.code];
  const k = typeof e.key === 'string' && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return BY_KEY[k] ?? null;
}

// 누르고 있는 방향 목록. 마지막에 누른 방향으로 걷고, 떼면 아직 누른 방향으로 돌아간다.
// pace(motion.js createPace, 없으면 늘 걷기): 한 칸 걷는 시간. 달리기가 켜지거나 꺼지면 다음 걸음을 마지막 걸음 + 새 시간에 맞춘다.
function createHold(move, pace = null) {
  const held = [];
  let timer = null; // { id, kind: 'interval' | 'timeout' }
  let lastAt = 0; // 마지막 걸음을 뗀 때(Date.now)
  const msNow = () => pace?.ms() ?? HOLD_MS;
  const stopTimer = () => {
    if (timer?.kind === 'interval') clearInterval(timer.id);
    else if (timer) clearTimeout(timer.id);
    timer = null;
  };
  const stepNow = () => {
    lastAt = Date.now();
    move(held[held.length - 1]);
  };
  const restart = () => {
    stopTimer();
    if (held.length === 0) return;
    timer = { id: setInterval(stepNow, msNow()), kind: 'interval' };
  };
  const retime = () => {
    if (!timer || held.length === 0) return;
    stopTimer();
    const ms = msNow();
    const wait = Math.max(0, lastAt + ms - Date.now());
    timer = {
      kind: 'timeout',
      id: setTimeout(() => {
        timer = { id: setInterval(stepNow, ms), kind: 'interval' };
        stepNow();
      }, wait),
    };
  };
  const unsub = pace?.onChange(retime) ?? (() => {});
  return {
    press(dir) {
      if (held.includes(dir)) return;
      held.push(dir);
      stepNow();
      restart();
    },
    release(dir) {
      const i = held.indexOf(dir);
      if (i < 0) return;
      const wasLast = i === held.length - 1;
      held.splice(i, 1);
      if (wasLast) restart();
    },
    clear() {
      held.length = 0;
      stopTimer();
    },
    dispose() {
      held.length = 0;
      stopTimer();
      unsub();
    },
  };
}

const isShift = (e) => e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';

// pace: 달리기 빠르기(motion.js createPace). Shift를 누르고 있는 동안 달린다.
export function bindInput(target, handlers, pace = null) {
  const hold = createHold((dir) => handlers.move(dir), pace);
  const run = (action) => {
    if (action === 'act') handlers.act();
    else if (action === 'codex') handlers.codex();
    else if (action === 'tasks') handlers.tasks();
  };

  const onDown = (e) => {
    if (isShift(e)) {
      pace?.set('key', true);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const action = actionOf(e);
    if (!action) return;
    // 단추에 초점이 있으면 Space·Enter는 단추를 누르는 데 쓴다.
    if (action === 'act' && tag === 'BUTTON') return;
    e.preventDefault();
    if (DIRS.has(action)) {
      if (!e.repeat) hold.press(action);
    } else if (!e.repeat) {
      run(action);
    }
  };
  const onUp = (e) => {
    if (isShift(e)) {
      pace?.set('key', false);
      return;
    }
    const action = actionOf(e);
    if (DIRS.has(action)) hold.release(action);
  };
  const onBlur = () => {
    hold.clear();
    pace?.set('key', false); // 창 밖에서 Shift를 떼면 keyup이 오지 않는다
  };

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  return () => {
    hold.dispose();
    pace?.set('key', false);
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
  };
}

export function isCoarsePointer() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

// 터치 기기용 방향 십자(왼쪽 아래)와 그 오른쪽 달리기 버튼, 말하기 버튼(오른쪽 아래). 지우는 함수를 돌려준다.
// 달리기 버튼은 누르고 있는 동안만 달린다(다른 손가락으로 화살표를 함께 누른다).
export function createTouchControls(container, handlers, pace = null) {
  const hold = createHold((dir) => handlers.move(dir), pace);
  const wrap = document.createElement('div');
  wrap.className = 'touch-controls';

  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  const labels = { up: '위', down: '아래', left: '왼쪽', right: '오른쪽' };
  const arrows = { up: '▲', down: '▼', left: '◀', right: '▶' };
  for (const dir of ['up', 'left', 'right', 'down']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `touch-dir touch-${dir}`;
    b.setAttribute('aria-label', labels[dir]);
    b.textContent = arrows[dir];
    const end = () => {
      b.classList.remove('pressed');
      hold.release(dir);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture?.(e.pointerId);
      b.classList.add('pressed');
      hold.press(dir);
    });
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    b.addEventListener('lostpointercapture', end);
    pad.appendChild(b);
  }

  const talk = document.createElement('button');
  talk.type = 'button';
  talk.className = 'touch-act';
  talk.textContent = '말하기';
  talk.addEventListener('click', () => handlers.act());

  const run = document.createElement('button');
  run.type = 'button';
  run.className = 'touch-run';
  run.textContent = '달리기';
  const runEnd = () => {
    run.classList.remove('pressed');
    pace?.set('touch', false);
  };
  run.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    run.setPointerCapture?.(e.pointerId);
    run.classList.add('pressed');
    pace?.set('touch', true);
  });
  run.addEventListener('pointerup', runEnd);
  run.addEventListener('pointercancel', runEnd);
  run.addEventListener('lostpointercapture', runEnd);
  run.addEventListener('contextmenu', (e) => e.preventDefault()); // 오래 누르면 뜨는 메뉴를 막는다

  wrap.append(pad, run, talk);
  container.appendChild(wrap);
  return () => {
    hold.dispose();
    pace?.set('touch', false);
    wrap.remove();
  };
}
