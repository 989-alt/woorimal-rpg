// 세계 지도 규칙: 순수 함수. 어느 막에서 어느 막으로 가는지, 곳마다 어떤 표시를 달지.
import { ACTS, actOfChapter } from '../../data/acts/index.js';
import { WORLD } from '../../data/world.js';

// 지금 장의 막을 마쳤고 다음 막이 있으면 { from, to }, 아니면 null.
export function travelOf(state) {
  const from = actOfChapter(state.chapter).id;
  if (!(state.clearedActs ?? []).includes(from)) return null;
  const next = ACTS[ACTS.findIndex((a) => a.id === from) + 1];
  return next ? { from, to: next.id } : null;
}

// 곳마다의 표시: 마친 곳 'done', 이번에 갈 곳 'next', 나머지 'far'. WORLD.places 차례.
export function worldMarks(state, to) {
  const cleared = state.clearedActs ?? [];
  return WORLD.places.map((p) => ({
    act: p.act,
    mark: cleared.includes(p.act) ? 'done' : p.act === to ? 'next' : 'far',
  }));
}
