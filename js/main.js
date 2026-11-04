import { createRouter } from './router.js';
import { createStore } from './save.js';
import { newGame, acquireWords } from './rules/game.js';
import { explore } from './scenes/explore.js';
import { title } from './scenes/title.js';
import { dialogue } from './scenes/dialogue.js';

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

let state = null;
const store = createStore(safeLocalStorage());
const getState = () => state;
const setState = (next) => { state = next; };

const router = createRouter(document.getElementById('app'), { store, getState, setState });

// 장면이 바뀔 때마다 저장한다(한 칸 걸을 때마다 저장하지는 않는다).
const show = router.show;
router.show = (name, params) => {
  if (state) store.save(state);
  show(name, params);
};
// 창을 닫거나 다른 탭으로 갈 때도 걸어 온 자리를 남긴다.
const saveNow = () => { if (state) store.save(state); };
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });

function startNew(nickname, avatar) {
  state = newGame({ nickname, avatar });
  router.show('explore');
}

// 임시 장면: 받은 값을 글로 보여 주고 탐험으로 돌아간다. 뒤 Task가 진짜 장면으로 바꾼다.
function stub(name) {
  return {
    mount(root, params) {
      const el = document.createElement('main');
      el.dataset.scene = name;
      el.className = 'stub-scene';
      const h = document.createElement('h2');
      h.textContent = name;
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(params, null, 2);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'big-button';
      b.textContent = '탐험으로 돌아가기';
      b.addEventListener('click', () => router.show('explore'));
      el.append(h, pre, b);
      root.appendChild(el);
      return () => el.remove();
    },
  };
}

router.register('title', title);
router.register('explore', explore);
router.register('dialogue', dialogue);
for (const name of ['battle', 'clear']) router.register(name, stub(name));

// 검사용 도움 기능: 주소에 ?test=1이 있을 때만 만든다.
if (new URLSearchParams(location.search).get('test') === '1') {
  window.__test = {
    state: () => state,
    newGame: (nickname, avatar) => startNew(nickname, avatar),
    acquire(wordIds, from) {
      state = acquireWords(state, wordIds, from);
      router.show('explore');
    },
    dialogue: (script, words = [], from = '', next) => router.show('dialogue', { script, words, from, next }),
  };
}

router.show('title');
