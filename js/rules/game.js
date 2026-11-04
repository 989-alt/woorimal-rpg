// 게임 상태와 장 진행: 모두 순수 함수. 받은 상태를 바꾸지 않고 새 상태를 돌려준다.
import ACT1 from '../../data/acts/act1.js';
import { actOfChapter } from '../../data/acts/index.js';
import { parseMap } from '../explore/grid.js';

export function chapterOf(act, chapterId) {
  const ch = act.chapters.find((c) => c.id === chapterId);
  if (!ch) throw new Error(`chapterOf: 알 수 없는 장 '${chapterId}'`);
  return ch;
}

export function chapterWords(chapter) {
  return [...chapter.quests.flatMap((q) => q.words), chapter.hidden.word];
}

export function actWords(act) {
  return act.chapters.flatMap(chapterWords);
}

function startOf(chapter) {
  return parseMap(chapter.map.rows).start;
}

export function newGame({ nickname, avatar }) {
  const act = ACT1;
  const first = act.chapters[0];
  const quests = {};
  for (const ch of act.chapters) {
    for (const q of ch.quests) quests[q.id] = { stage: 'locked', gathered: [] };
  }
  quests[first.quests[0].id].stage = 'open';
  const { x, y } = startOf(first);
  return {
    version: 1,
    nickname,
    avatar,
    act: act.id,
    chapter: first.id,
    pos: { x, y },
    facing: 'down',
    acquired: {},
    quests,
    bag: [],
    hiddenFound: {},
    revealed: {}, // 장별로 숨은 낱말을 알려 준 인물과 말했는지(옛 저장에는 없다: 없으면 빈 것으로 본다)
    smallGone: {},
    askedWordIds: [],
    clearedChapters: [],
    clearedActs: [],
    seenTips: [],
  };
}

export function acquireWords(state, wordIds, from) {
  const fresh = wordIds.filter((id, i) => !(id in state.acquired) && wordIds.indexOf(id) === i);
  if (fresh.length === 0) return state;
  const acquired = { ...state.acquired };
  for (const id of fresh) acquired[id] = { from };
  return { ...state, acquired };
}

// 대화를 열기 전에 낱말을 한꺼번에 얻는다. fresh는 이번에 새로 얻은 낱말(대화가 카드를 보여 줄 낱말)이다.
// 부탁 완료·숨은 낱말 찾음과 낱말 습득이 한 상태에 같이 들어가므로, 대화 도중 창을 닫아도 낱말을 잃지 않는다.
export function takeWords(state, wordIds, from) {
  const fresh = wordIds.filter((id, i) => !(id in state.acquired) && wordIds.indexOf(id) === i);
  return { state: acquireWords(state, fresh, from), fresh };
}

export function acquiredCount(state, chapter) {
  return chapterWords(chapter).filter((id) => id in state.acquired).length;
}

export function chapterComplete(state, chapter) {
  return acquiredCount(state, chapter) === chapterWords(chapter).length;
}

export function fogOpen(state, chapter) {
  return chapterComplete(state, chapter);
}

export const actCleared = (state, act) => (state.clearedActs ?? []).includes(act.id);

// 막 보스를 이겨 막을 마쳤으면 보스는 그 자리에서 사라진다(막 클리어 화면은 출구에서 연다).
export const bossGone = (state, chapter) => actCleared(state, actOfChapter(chapter.id));

export const wordsLeftText = (state, chapter) =>
  `아직 찾지 못한 낱말이 ${chapterWords(chapter).length - acquiredCount(state, chapter)}개 있어.`;

// 출구(맵 가장자리 길)가 열렸는가. 앞 장은 그 장의 낱말을 다 모았을 때, 뒷(보스) 장은 막 보스를 이긴 뒤.
// 열려 있어도 저절로 넘어가지 않는다: 학생이 그 칸으로 걸어 들어서야 장·막 클리어 화면이 열린다.
export function exitOpen(state, chapter) {
  if (!chapter.exit) return false;
  const act = actOfChapter(chapter.id);
  const last = act.chapters[act.chapters.length - 1].id === chapter.id;
  return last ? actCleared(state, act) : chapterComplete(state, chapter);
}

// 닫힌 출구 칸에 들어섰을 때 띄울 한 줄. 열려 있거나 출구가 없으면 null.
export function exitBlockedText(state, chapter) {
  if (!chapter.exit || exitOpen(state, chapter)) return null;
  const act = actOfChapter(chapter.id);
  const last = act.chapters[act.chapters.length - 1].id === chapter.id;
  return last ? chapter.exit.closed : wordsLeftText(state, chapter);
}

const addOnce = (list, v) => (list.includes(v) ? list : [...list, v]);

export function enterNextChapter(state, act) {
  const i = act.chapters.findIndex((c) => c.id === state.chapter);
  if (i < 0) throw new Error(`enterNextChapter: 알 수 없는 장 '${state.chapter}'`);
  const next = act.chapters[i + 1];
  if (!next) throw new Error('enterNextChapter: 마지막 장입니다');
  const firstQuest = next.quests[0].id;
  const quests = { ...state.quests };
  const cur = quests[firstQuest] ?? { stage: 'locked', gathered: [] };
  quests[firstQuest] = cur.stage === 'locked' ? { ...cur, stage: 'open' } : cur;
  const { x, y } = startOf(next);
  return {
    ...state,
    chapter: next.id,
    pos: { x, y },
    facing: 'down',
    clearedChapters: addOnce(state.clearedChapters, state.chapter),
    quests,
  };
}

export function finishAct(state, act, askedIds) {
  let asked = state.askedWordIds;
  for (const id of askedIds) asked = addOnce(asked, id);
  return {
    ...state,
    askedWordIds: asked,
    clearedChapters: addOnce(state.clearedChapters, state.chapter),
    clearedActs: addOnce(state.clearedActs, act.id),
  };
}

export function setPos(state, pos, facing) {
  return { ...state, pos: { x: pos.x, y: pos.y }, facing };
}

export function markTip(state, tipId) {
  if (state.seenTips.includes(tipId)) return state;
  return { ...state, seenTips: [...state.seenTips, tipId] };
}

// [[낱말]] 또는 [[낱말|보이는 꼴]]의 안쪽 글을 낱말 id와 화면에 보이는 꼴로 나눈다(| 가 없으면 꼴 = id).
export function wordMark(inner) {
  const i = inner.indexOf('|');
  if (i < 0) return { id: inner, form: inner };
  return { id: inner.slice(0, i), form: inner.slice(i + 1) };
}

// 글 속 [[ ]]의 낱말 id 목록(보이는 꼴이 아니라 id).
export function extractWords(text) {
  return [...text.matchAll(/\[\[(.+?)\]\]/g)].map((m) => wordMark(m[1]).id);
}
