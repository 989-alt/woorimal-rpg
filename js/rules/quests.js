// 부탁 규칙: 말 걸기, 물건 조사, 가방, 숨은 낱말, 인물 표시, 현재 할 일. 모두 순수 함수.
// 낱말 습득 자체는 화면이 acquireWords로 한다. 여기서는 바뀐 상태와 줄 낱말만 돌려준다.
import { actOfChapter } from '../../data/acts/index.js';
import { chapterComplete } from './game.js';
import { attachJosa } from './josa.js';

const BAG_SIZE = 3;
const BAG_FULL = '가방이 가득 찼어.';

const note = (text) => [{ who: 'narration', text }];
const stageOf = (state, quest) => state.quests[quest.id]?.stage ?? 'locked';
const bagFull = (state) => state.bag.length >= BAG_SIZE;

function setQuest(state, id, patch) {
  const cur = state.quests[id] ?? { stage: 'locked', gathered: [] };
  return { ...state, quests: { ...state.quests, [id]: { ...cur, ...patch } } };
}

function withoutOne(bag, id) {
  const i = bag.indexOf(id);
  return i < 0 ? bag : [...bag.slice(0, i), ...bag.slice(i + 1)];
}

// 부탁을 끝낸다: 물건을 가방에서 빼고, 같은 장의 다음 부탁을 연다.
function completeQuest(state, chapter, quest) {
  let next = setQuest(state, quest.id, { stage: 'done' });
  if (quest.item) next = { ...next, bag: withoutOne(next.bag, quest.item.id) };
  const i = chapter.quests.indexOf(quest);
  const following = chapter.quests[i + 1];
  if (following && stageOf(next, following) === 'locked') next = setQuest(next, following.id, { stage: 'open' });
  return next;
}

// 숨은 낱말은 그 막의 첫 부탁을 받은 뒤(말빛 주머니를 찬 뒤)에야 찾을 수 있다.
function holdsPouch(state, chapter) {
  const first = actOfChapter(chapter.id).chapters[0].quests[0];
  const stage = state.quests[first.id]?.stage ?? 'locked';
  return stage !== 'locked' && stage !== 'open';
}

const hiddenFound = (state, chapter) => state.hiddenFound?.[chapter.id] === true;
const questsDone = (state, chapter) => chapter.quests.every((q) => stageOf(state, q) === 'done');

export function talkTo(state, chapter, npcId) {
  const npc = chapter.npcs.find((n) => n.id === npcId);
  const chat = { state, script: npc ? npc.chat : [], event: 'chat', words: [] };

  // 받는 인물: 전하기 부탁이 active이고 물건이 가방에 있으면 완료 (주는 인물 일보다 먼저)
  const delivery = chapter.quests.find((q) =>
    q.kind === 'deliver' && q.targets[0] === npcId && stageOf(state, q) === 'active' && state.bag.includes(q.item.id));
  if (delivery) {
    return { state: completeQuest(state, chapter, delivery), script: delivery.done, event: 'done', words: delivery.words };
  }

  const quest = chapter.quests.find((q) => q.giver === npcId && ['open', 'active', 'ready'].includes(stageOf(state, q)));
  if (!quest) return chat;

  const stage = stageOf(state, quest);
  if (stage === 'ready') {
    return { state: completeQuest(state, chapter, quest), script: quest.done, event: 'done', words: quest.words };
  }
  if (stage === 'active') {
    return { state, script: quest.waiting, event: 'waiting', words: [] };
  }
  // open: 부탁을 받는다. 전하기는 물건을 가방에 받는다.
  if (quest.kind === 'deliver') {
    if (bagFull(state)) return { state, script: note(BAG_FULL), event: 'chat', words: [] };
    const next = setQuest({ ...state, bag: [...state.bag, quest.item.id] }, quest.id, { stage: 'active' });
    return { state: next, script: quest.offer, event: 'offer', words: [] };
  }
  return { state: setQuest(state, quest.id, { stage: 'active' }), script: quest.offer, event: 'offer', words: [] };
}

export function inspect(state, chapter, objectSlot) {
  const obj = chapter.objects.find((o) => o.slot === objectSlot);
  if (!obj) return { state, script: [], event: 'nothing', words: [] };
  const flavour = { state, script: note(obj.text), event: 'nothing', words: [] };

  const quest = chapter.quests.find((q) =>
    ['fetch', 'find', 'gather'].includes(q.kind) && q.targets.includes(objectSlot) && stageOf(state, q) === 'active');
  if (quest) {
    const full = { state, script: note(BAG_FULL), event: 'bag-full', words: [] };
    const getsItem = attachJosa(quest.item.name, '을');
    if (quest.kind === 'gather') {
      const gathered = state.quests[quest.id].gathered ?? [];
      if (gathered.includes(objectSlot)) return flavour;
      const all = gathered.length + 1 === quest.targets.length;
      if (all && bagFull(state)) return full;
      let next = setQuest(state, quest.id, { gathered: [...gathered, objectSlot] });
      if (all) {
        next = setQuest({ ...next, bag: [...next.bag, quest.item.id] }, quest.id, { stage: 'ready' });
        return { state: next, script: note(`${getsItem} 다 모아서 가방에 넣었다.`), event: 'gathered', words: [] };
      }
      return {
        state: next,
        script: note(`${getsItem} 모았다. (${gathered.length + 1}/${quest.targets.length})`),
        event: 'gathered',
        words: [],
      };
    }
    if (bagFull(state)) return full;
    const next = setQuest({ ...state, bag: [...state.bag, quest.item.id] }, quest.id, { stage: 'ready' });
    return { state: next, script: note(`${getsItem} 가방에 넣었다.`), event: 'item', words: [] };
  }

  if (objectSlot === chapter.hidden.object && !hiddenFound(state, chapter) && holdsPouch(state, chapter)) {
    return {
      state: { ...state, hiddenFound: { ...state.hiddenFound, [chapter.id]: true } },
      script: chapter.hidden.lines,
      event: 'hidden',
      words: [chapter.hidden.word],
    };
  }
  return flavour;
}

export function winSmall(state, chapter) {
  const chase = chapter.quests.find((q) => q.kind === 'chase' && stageOf(state, q) === 'active');
  if (!chase) return state;
  const next = setQuest(state, chase.id, { stage: 'ready' });
  return { ...next, smallGone: { ...next.smallGone, [chapter.id]: true } };
}

export function npcMarker(state, chapter, npcId) {
  let marker = null;
  for (const q of chapter.quests) {
    const stage = stageOf(state, q);
    if (q.kind === 'deliver' && q.targets[0] === npcId && stage === 'active' && state.bag.includes(q.item.id)) return '?';
    if (q.giver !== npcId) continue;
    if (stage === 'ready') return '?';
    if (stage === 'open') marker = '!';
    else if (stage === 'active' && marker === null) marker = '…';
  }
  return marker;
}

export function currentTask(state, chapter) {
  const doing = chapter.quests.find((q) => ['active', 'open', 'ready'].includes(stageOf(state, q)));
  if (doing) return doing.title;
  if (!hiddenFound(state, chapter)) return '숨은 낱말을 찾아라';
  // 낱말 5개가 다 모이기 전(화면이 낱말을 등록하는 사이)에는 마지막 부탁 제목을 그대로 둔다.
  if (!chapterComplete(state, chapter)) return chapter.quests[chapter.quests.length - 1].title;
  const { chapters } = actOfChapter(chapter.id);
  return chapter.id === chapters[chapters.length - 1].id ? '그림자를 물리쳐라' : '다음 장으로';
}

export function hiddenGlow(state, chapter) {
  if (hiddenFound(state, chapter) || !holdsPouch(state, chapter)) return 'none';
  return questsDone(state, chapter) ? 'bright' : 'dim';
}

export function questList(state, chapter) {
  return chapter.quests.map((q) => ({ id: q.id, title: q.title, stage: stageOf(state, q) }));
}
