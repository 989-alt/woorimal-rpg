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
function createHold(move) {
  const held = [];
  let timer = null;
  const stopTimer = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const restart = () => {
    stopTimer();
    if (held.length === 0) return;
    timer = setInterval(() => move(held[held.length - 1]), HOLD_MS);
  };
  return {
    press(dir) {
      if (held.includes(dir)) return;
      held.push(dir);
      move(dir);
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
  };
}

export function bindInput(target, handlers) {
  const hold = createHold((dir) => handlers.move(dir));
  const run = (action) => {
    if (action === 'act') handlers.act();
    else if (action === 'codex') handlers.codex();
    else if (action === 'tasks') handlers.tasks();
  };

  const onDown = (e) => {
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
    const action = actionOf(e);
    if (DIRS.has(action)) hold.release(action);
  };
  const onBlur = () => hold.clear();

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  return () => {
    hold.clear();
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
  };
}

export function isCoarsePointer() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

// 터치 기기용 방향 십자(왼쪽 아래)와 말하기 버튼(오른쪽 아래). 지우는 함수를 돌려준다.
export function createTouchControls(container, handlers) {
  const hold = createHold((dir) => handlers.move(dir));
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

  wrap.append(pad, talk);
  container.appendChild(wrap);
  return () => {
    hold.clear();
    wrap.remove();
  };
}
