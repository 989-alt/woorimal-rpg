import { createRouter } from './router.js';
import { createStore } from './save.js';
import { newGame, acquireWords, actWords, enterNextChapter } from './rules/game.js';
import ACT1 from '../data/acts/act1.js';
import { explore } from './scenes/explore.js';
import { title } from './scenes/title.js';
import { dialogue } from './scenes/dialogue.js';
import { battle, battleProbe } from './scenes/battle.js';
import { gameover } from './scenes/gameover.js';
import { clear } from './scenes/clear.js';

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

router.register('title', title);
router.register('explore', explore);
router.register('dialogue', dialogue);
router.register('battle', battle);
router.register('gameover', gameover);
router.register('clear', clear);

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
    // 필요한 낱말을 얻은 상태로 전투를 연다.
    // review: 1-1 첫 부탁 낱말 2개 + 꼬마 안개 부탁 진행 중 / boss: 1막 낱말 10개 + 1-2 장
    startBattle(mode, seed) {
      const [first, chase] = ACT1.chapters[0].quests;
      if (mode === 'boss') {
        state = enterNextChapter(acquireWords(state, actWords(ACT1), '검사'), ACT1);
      } else {
        state = acquireWords(state, first.words, '도담 할머니');
        state = { ...state, quests: { ...state.quests, [first.id]: { stage: 'done', gathered: [] }, [chase.id]: { stage: 'active', gathered: [] } } };
      }
      router.show('battle', seed === undefined ? { mode } : { mode, seed });
    },
    answerIndex: () => battleProbe()?.answerIndex() ?? -1,
    battle: () => battleProbe()?.snapshot() ?? null,
  };
}

router.show('title');
