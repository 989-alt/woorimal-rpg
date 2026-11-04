// 길잡이 규칙: "지금 할 한 가지"와 "끝내러 돌아가지 않고 떠나는 걸음". 모두 순수 함수.
// 말풍선을 띄우고 화살표를 그리는 일은 탐험 장면이 하고, 여기서는 무엇을 가리킬지와 글만 정한다.
import { actOfChapter } from '../../data/acts/index.js';
import { reachable, isWalkable } from '../explore/grid.js';
import { chapterComplete, fogOpen } from './game.js';
import { actCleared, actDoneText, hiddenGlow, hiddenFound, hiddenRevealed } from './quests.js';
import { attachJosa } from './josa.js';

// 길잡이 말풍선 id(안내 말풍선과 같은 층을 쓰지만 seenTips에는 넣지 않는다: 언제든 다시 뜰 수 있는 도움말)
export const GUIDE = { WON: 'guide-won', LEAVE: 'guide-leave', IDLE: 'guide-idle' };
export const isGuideId = (id) => typeof id === 'string' && id.startsWith('guide-');
export const GUIDE_MS = {
  IDLE: 30000, // 할 일이 이만큼 진전되지 않으면 길을 알려 준다
  REPEAT: 20000, // 같은 말은 이 안에 다시 띄우지 않는다
  WON: 3000, // 이긴 직후 한마디
  SAY: 4000, // 떠나려 할 때 한마디
  FLASH: 6000, // 돌아갈 인물 머리 위 표시가 깜박이는 시간
};

const stageOf = (state, quest) => state.quests[quest.id]?.stage ?? 'locked';
const nameOf = (chapter, npcId) => chapter.npcs.find((n) => n.id === npcId)?.name ?? '마을 사람';

// 지금 해야 할 한 가지. 돌려주는 모양:
//  { kind: 'talk'|'find'|'fight'|'hidden'|'boss'|'exit'|'none', npcId?, objectSlot?, objectSlots?, text }
// 우선순위: 1) 끝내러 돌아갈 부탁(물건을 들었거나 몬스터를 이김) → 2) 받은 부탁의 대상 → 3) 아직 받지 않은 부탁
//          → 4) 숨은 낱말(알려 줄 인물 → 반짝이는 곳) → 5) 막 보스 또는 출구. text는 25자 이하.
export function nextGoal(state, chapter) {
  const act = actOfChapter(chapter.id);
  // 막 보스를 이겼다: 출구가 열렸으니 걸어 나가자(출구 글이 없는 장이면 막을 마쳤다는 말)
  if (actCleared(state, act)) return chapter.exit ? { kind: 'exit', text: chapter.exit.goal } : { kind: 'none', text: actDoneText(act) };

  const holds = (q) => q.item && state.bag.includes(q.item.id);
  // 1) 돌아가서 알리거나 물건을 전할 차례
  for (const q of chapter.quests) {
    const stage = stageOf(state, q);
    if (stage === 'ready') {
      return { kind: 'talk', npcId: q.giver, text: `${nameOf(chapter, q.giver)}에게 돌아가 알려 주자` };
    }
    if (q.kind === 'deliver' && stage === 'active' && holds(q)) {
      return { kind: 'talk', npcId: q.targets[0], text: q.goal ?? `${nameOf(chapter, q.targets[0])}에게 전하러 가자` };
    }
  }
  // 2) 받은 부탁
  for (const q of chapter.quests) {
    if (stageOf(state, q) !== 'active') continue;
    const goal = q.goal ?? q.title;
    if (q.kind === 'chase') return { kind: 'fight', text: goal };
    if (q.kind === 'deliver') { // 물건이 가방에 없다(옛 저장 등): 맡긴 사람이 다시 준다
      return { kind: 'talk', npcId: q.giver, text: `${nameOf(chapter, q.giver)}에게 ${attachJosa(q.item.name, '을')} 다시 받자` };
    }
    const gathered = state.quests[q.id]?.gathered ?? [];
    const left = q.targets.filter((t) => !gathered.includes(t));
    const text = q.kind === 'gather' ? `${goal} (${gathered.length}/${q.targets.length})` : goal;
    return { kind: 'find', objectSlot: left[0] ?? q.targets[0], objectSlots: left, text };
  }
  // 3) 아직 받지 않은 부탁
  for (const q of chapter.quests) {
    if (stageOf(state, q) === 'open') {
      return { kind: 'talk', npcId: q.giver, text: `${nameOf(chapter, q.giver)}에게 말을 걸어 보자` };
    }
  }
  // 4) 부탁을 다 끝냈고 숨은 낱말이 남았다: 먼저 알려 주는 인물에게, 알려 준 뒤에는 반짝이는 곳으로
  const by = chapter.hidden.revealedBy;
  if (by && !hiddenFound(state, chapter) && !hiddenRevealed(state, chapter)) {
    return { kind: 'talk', npcId: by, text: chapter.hidden.revealGoal ?? `${nameOf(chapter, by)}에게 말을 걸어 보자` };
  }
  if (hiddenGlow(state, chapter) !== 'none') {
    return { kind: 'hidden', objectSlot: chapter.hidden.object, text: '반짝이는 곳을 찾아 조사해 보자' };
  }
  // 5) 장 보스 또는 다음 장
  if (!chapterComplete(state, chapter)) return { kind: 'none', text: '아직 못 찾은 낱말을 찾아보자' };
  const last = act.chapters[act.chapters.length - 1].id === chapter.id;
  if (last) return { kind: 'boss', text: `${attachJosa(act.boss.name, '와')} 맞서자` };
  return chapter.exit ? { kind: 'exit', text: chapter.exit.goal } : { kind: 'none', text: '다음 장으로 가자' };
}

// 걸어서 giver 옆 칸들에서 각 칸까지의 걸음 수(giver 칸 자체는 걸을 수 없으므로 옆 칸이 1)
function walkDistances(map, spot, opts) {
  const dist = new Map();
  const queue = [];
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    const p = { x: spot.x + dx, y: spot.y + dy };
    if (isWalkable(map, p.x, p.y, opts)) { dist.set(`${p.x},${p.y}`, 1); queue.push(p); }
  }
  while (queue.length) {
    const { x, y } = queue.shift();
    const d = dist.get(`${x},${y}`);
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (!dist.has(k) && isWalkable(map, x + dx, y + dy, opts)) { dist.set(k, d + 1); queue.push({ x: x + dx, y: y + dy }); }
    }
  }
  return dist;
}

// 아직 돌아가 알릴 부탁(ready)이 있는데, 주는 인물에게서 멀어지면서 막혀 있던 곳(작은 몬스터·안개 문 너머)으로 들어서는 걸음인가.
// 걸음을 막지는 않는다. 부르는 쪽이 길잡이 말풍선만 띄운다.
export function leavingTooSoon(state, chapter, fromPos, toPos, map) {
  const ready = chapter.quests.find((q) => stageOf(state, q) === 'ready');
  if (!ready) return false;
  const giver = chapter.npcs.find((n) => n.id === ready.giver);
  const spot = giver && map.slots[giver.slot];
  if (!spot) return false;
  // 시작 자리에서 몬스터와 안개 문을 지나지 않고 갈 수 있는 곳 밖이 "막혀 있던 곳 너머"
  const open = reachable(map, map.start, { fogOpen: false, smallMonsterGone: false });
  if (open.has(`${toPos.x},${toPos.y}`)) return false;
  const dist = walkDistances(map, spot, { fogOpen: fogOpen(state, chapter), smallMonsterGone: true });
  const from = dist.get(`${fromPos.x},${fromPos.y}`);
  const to = dist.get(`${toPos.x},${toPos.y}`);
  return from !== undefined && to !== undefined && to > from;
}
