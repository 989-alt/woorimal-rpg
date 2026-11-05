import { createRouter } from './router.js';
import { createStore } from './save.js';
import { newGame, acquireWords, takeWords, actWords, chapterWords, enterNextChapter, chapterOf, setPos, fogOpen, bossGone, fastForward } from './rules/game.js';
import { actOfChapter } from '../data/acts/index.js';
import { visibleNpcs } from './rules/quests.js';
import { parseMap, isWalkable, reachable } from './explore/grid.js';
import { explore } from './scenes/explore.js';
import { title } from './scenes/title.js';
import { select } from './scenes/select.js';
import { dialogue, setTypeSpeed } from './scenes/dialogue.js';
import { battle, battleProbe } from './scenes/battle.js';
import { gameover } from './scenes/gameover.js';
import { clear } from './scenes/clear.js';
import { worldmap } from './scenes/worldmap.js';
import { ending, setEndingDelay, MESSAGE_DELAY_MS } from './scenes/ending.js';
import { reviewQuiz, reviewQuizProbe } from './scenes/review-quiz.js';
import { ASSETS } from '../data/assets.js';
import { loadImage, forgetFailed } from './ui/images.js';
import { loadUiKit } from './ui/ui-kit.js';

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

let state = null;
const store = createStore(safeLocalStorage());
const getState = () => state;
const setState = (next) => { state = next; };

const router = createRouter(document.getElementById('app'), { store, getState, setState });

// 장면이 바뀔 때마다 저장한다(한 칸 걸을 때마다 저장하지는 않는다).
// 앞 장면에서 못 받은 그림은 새 장면에서 한 번 더 받아 본다(UI 그림 틀도 같다. 첫 화면도 이 감싼 곳을 지나므로 시작할 때 불러온다).
const show = router.show;
router.show = (name, params) => {
  if (state) store.save(state);
  forgetFailed();
  loadUiKit(); // 앞서 못 받은 UI 그림도 한 번 더 받아 본다(받으면 그때부터 그림 틀)
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

// 검사용: 대상(인물 id, 물건 이름, 'small', 'boss') 옆의 걸을 수 있는 칸으로 옮기고 대상을 보게 한다.
// 지금 자리에서 걸어서 갈 수 없는 칸(안개 너머 등)으로는 옮기지 않는다.
function teleportTo(target) {
  if (!state) throw new Error('teleportTo: 게임이 시작되지 않았습니다');
  const chapter = chapterOf(actOfChapter(state.chapter), state.chapter);
  const map = parseMap(chapter.map.rows);
  const npc = visibleNpcs(state, chapter).find((n) => n.id === target); // 안 보이는 인물은 지도에 없는 것과 같다
  const obj = chapter.objects.find((o) => o.name === target);
  const spot = npc ? map.slots[npc.slot]
    : obj ? map.objects[obj.slot]
    : target === 'small' ? map.smallMonster
    : target === 'boss' ? map.boss
    : null;
  if (!spot) throw new Error(`teleportTo: ${state.chapter} 장 지도에 '${target}'이(가) 없습니다`);
  const opts = { fogOpen: fogOpen(state, chapter), smallMonsterGone: !!state.smallGone?.[chapter.id], bossGone: bossGone(state, chapter) };
  const canReach = reachable(map, state.pos, opts);
  const sides = [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']];
  for (const [dx, dy, facing] of sides) {
    const x = spot.x + dx, y = spot.y + dy;
    if (isWalkable(map, x, y, opts) && canReach.has(`${x},${y}`)) {
      state = setPos(state, { x, y }, facing);
      router.show('explore');
      return { x, y, facing };
    }
  }
  throw new Error(`teleportTo: '${target}' 옆에 지금 걸어서 갈 수 있는 칸이 없습니다`);
}

router.register('title', title);
router.register('select', select);
router.register('explore', explore);
router.register('dialogue', dialogue);
router.register('battle', battle);
router.register('gameover', gameover);
router.register('clear', clear);
router.register('worldmap', worldmap);
router.register('ending', ending);
router.register('review-quiz', reviewQuiz);

// 검사용 도움 기능: 주소에 ?test=1이 있을 때만 만든다.
if (new URLSearchParams(location.search).get('test') === '1') {
  window.__test = {
    state: () => state,
    newGame: (nickname, avatar) => startNew(nickname, avatar),
    acquire(wordIds, from) {
      state = acquireWords(state, wordIds, from);
      router.show('explore');
    },
    // 탐험 장면처럼 낱말을 먼저 얻고 대화를 연다. 이미 얻은 낱말은 카드 없이 띠만 보인다.
    dialogue(script, words = [], from = '', next, nextParams) {
      const got = takeWords(state, words, from);
      state = got.state;
      router.show('dialogue', { script, words: got.fresh, from, next, nextParams });
    },
    // 필요한 낱말을 얻은 상태로 전투를 연다(지금 막 기준).
    // review: 지금 막에서 쫓기 부탁이 있는 첫 장으로 가서 그 앞 부탁들을 끝내고(낱말 얻음) 쫓기 부탁 진행 중 / boss: 그 막 낱말 10개 + 앞 장이면 뒷 장
    startBattle(mode, seed) {
      const act = actOfChapter(state.chapter);
      if (mode === 'boss') {
        state = acquireWords(state, actWords(act), '검사');
        if (state.chapter !== act.chapters[act.chapters.length - 1].id) state = enterNextChapter(state, act);
      } else {
        const chaseChapter = act.chapters.find((c) => c.quests.some((q) => q.kind === 'chase'));
        if (state.chapter !== chaseChapter.id) {
          const { x, y } = parseMap(chaseChapter.map.rows).start;
          state = { ...state, chapter: chaseChapter.id, pos: { x, y }, facing: 'down' };
        }
        const quests = { ...state.quests };
        for (const ch of act.chapters) {
          for (const q of ch.quests) {
            if (q.kind === 'chase') {
              quests[q.id] = { stage: 'active', gathered: [] };
              break;
            }
            state = acquireWords(state, q.words, '검사');
            quests[q.id] = { stage: 'done', gathered: [] };
          }
          if (ch.id === chaseChapter.id) break;
        }
        state = { ...state, quests };
      }
      router.show('battle', seed === undefined ? { mode } : { mode, seed });
    },
    // 그 장 앞의 모든 장을 끝낸 것으로 하고 그 장 시작에서 탐험을 연다(fastForward).
    goChapter(chapterId) {
      state = fastForward(state, chapterId);
      router.show('explore');
    },
    // 상태의 일부를 바꾸고 탐험을 다시 연다(걸어가기 긴 상황을 빨리 만들 때). 바꾼 상태는 장면이 바뀔 때 저장된다.
    patchState(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      router.show('explore');
    },
    // 지금 장의 낱말을 모두 얻은 것으로 하고 다음 장 첫 자리에서 탐험을 연다(화면 사진용).
    nextChapter() {
      const act = actOfChapter(state.chapter);
      state = enterNextChapter(acquireWords(state, chapterWords(chapterOf(act, state.chapter)), '검사'), act);
      router.show('explore');
    },
    // 마무리 퀴즈를 정한 씨앗으로 연다(끝나면 처음 화면). 같은 씨앗 → 같은 10문제.
    openQuiz: (seed) => router.show('review-quiz', { next: 'title', seed }),
    answerIndex: () => battleProbe()?.answerIndex() ?? -1,
    // 마무리 퀴즈의 지금 문제: { phase, qn, type, word, answerIndex, answerText }
    quiz: () => reviewQuizProbe()?.snapshot() ?? null,
    battle: () => battleProbe()?.snapshot() ?? null,
    teleportTo,
    // 타자 효과와 엔딩 마지막 말의 '다음' 기다림을 끈다(false면 되돌린다)
    fastText: (on) => { setTypeSpeed(on ? 0 : 30); setEndingDelay(on ? 0 : MESSAGE_DELAY_MS); },
    // 그림 경로를 바꿔 끼운다(예: setAsset('npcs.dodam', url)). 경로는 ASSETS 안의 점 표기이며 url은 null도 된다.
    setAsset(where, url) {
      const keys = where.split('.');
      const last = keys.pop();
      let node = ASSETS;
      for (const k of keys) node = node?.[k];
      if (!node || !(last in node)) throw new Error(`setAsset: ASSETS에 '${where}'이(가) 없습니다`);
      node[last] = url;
      return loadImage(url).then((img) => !!img);
    },
  };
}

router.show('title');
