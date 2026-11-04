// 안내 규칙: 어떤 때에 어떤 안내를 띄울지 한곳에서 정한다. 순수 함수. 표시 기록(markTip)은 부르는 쪽이 한다.
import { hiddenGlow } from './quests.js';

// 옛 id 다섯(move, first-npc, tip-word, tip-review, tip-boss)은 그대로 써서 옛 저장이 본 안내를 다시 띄우지 않는다.
export const TIP = {
  MOVE: 'move',
  FIRST_NPC: 'first-npc', // 캔버스 화살표용(말풍선 아님)
  TALK: 'talk',
  DIALOGUE: 'dialogue',
  WORD: 'tip-word',
  CODEX: 'codex',
  QUEST: 'quest',
  SPARKLE: 'sparkle',
  REVIEW: 'tip-review',
  BOSS: 'tip-boss',
};

export const HINT_MS = 8000;

// id -> { key, touch, anchor, until, ms }. 글은 6학년 눈높이로 짧게, 줄은 두 줄까지.
const TABLE = {
  [TIP.MOVE]: {
    anchor: 'hero', until: 'move', ms: null,
    key: '방향키로 걸어 보세요', touch: '왼쪽 아래 화살표를 눌러 걸어 보세요',
  },
  [TIP.TALK]: {
    anchor: 'hero', until: 'talk', ms: HINT_MS,
    key: '사람을 보고 Space를 누르면\n말을 걸 수 있어요',
    touch: '사람을 보고 말하기 버튼을 누르면\n말을 걸 수 있어요',
  },
  [TIP.QUEST]: {
    anchor: 'tasks-button', until: 'tasks', ms: HINT_MS,
    key: '할 일(Q)을 누르면 할 일이 보여요\n머리 위에 ?가 뜨면 돌아가 알려요',
    touch: '할 일 버튼을 누르면 할 일이 보여요\n머리 위에 ?가 뜨면 돌아가 알려요',
  },
  [TIP.SPARKLE]: {
    anchor: 'sparkle', until: 'inspect', ms: HINT_MS,
    key: '반짝이는 곳이 있어요!\n가까이 가서 Space로 살펴봐요',
    touch: '반짝이는 곳이 있어요!\n가까이 가서 말하기 버튼을 눌러요',
  },
  // 새 낱말은 처음에 회색이고, 줄이 끝나면 금빛으로 바뀐다.
  [TIP.WORD]: {
    anchor: 'word', until: 'press', ms: null,
    key: '낱말이 금빛으로 빛나면\n눌러서 뜻을 볼 수 있어요',
    touch: '낱말이 금빛으로 빛나면\n눌러서 뜻을 볼 수 있어요',
  },
  [TIP.DIALOGUE]: {
    anchor: 'dialogue-box', until: 'press', ms: null,
    key: 'Space를 누르거나 글 상자를 누르면\n다음 말로 넘어가요',
    touch: '글 상자를 누르면\n다음 말로 넘어가요',
  },
  [TIP.CODEX]: {
    anchor: 'card-ok', until: 'confirm', ms: null,
    key: '확인을 누르면 도감(E)에 모여요',
    touch: '확인을 누르면 도감에 모여요',
  },
  [TIP.REVIEW]: {
    anchor: 'options', until: 'pick', ms: null,
    key: '1~4를 누르거나 보기를 눌러 골라요\n하트는 줄지 않아요. 3번 맞히면 이겨요',
    touch: '보기를 눌러 골라요\n하트는 줄지 않아요. 3번 맞히면 이겨요',
  },
  [TIP.BOSS]: {
    anchor: 'hearts', until: 'pick', ms: null,
    key: '하트 5개, 몬스터 HP 6칸이에요\n6번 맞히면 이기고, 져도 다시 도전해요',
    touch: '하트 5개, 몬스터 HP 6칸이에요\n6번 맞히면 이기고, 져도 다시 도전해요',
  },
};

export function hintText(id, { touch = false } = {}) {
  const row = TABLE[id];
  if (!row) throw new Error(`알 수 없는 안내: ${id}`);
  return touch ? row.touch : row.key;
}

const hint = (id, opts) => {
  const { anchor, until, ms } = TABLE[id];
  return { id, text: hintText(id, opts), anchor, until, ms };
};

export function dueHint(state, chapter, event, { touch = false } = {}) {
  const seen = (id) => state.seenTips.includes(id);
  const make = (id) => hint(id, { touch });

  switch (event?.type) {
    case 'explore': {
      if (!seen(TIP.MOVE)) return make(TIP.MOVE);
      if (!seen(TIP.TALK) && event.facing === 'npc') return make(TIP.TALK);
      if (!seen(TIP.QUEST) && chapter.quests.some((q) => state.quests[q.id]?.stage === 'active')) return make(TIP.QUEST);
      if (!seen(TIP.SPARKLE) && event.sparkleInView && hiddenGlow(state, chapter) !== 'none') return make(TIP.SPARKLE);
      return null;
    }
    case 'dialogue-line': {
      if (event.newWord && !seen(TIP.WORD)) return make(TIP.WORD);
      // 이 줄에 낱말 안내가 뜨는 경우에는 대화 안내를 미룬다.
      if (!seen(TIP.DIALOGUE) && !(event.newWord && !seen(TIP.WORD))) return make(TIP.DIALOGUE);
      return null;
    }
    case 'word-card':
      return seen(TIP.CODEX) ? null : make(TIP.CODEX);
    case 'battle':
      if (event.mode === 'review') return seen(TIP.REVIEW) ? null : make(TIP.REVIEW);
      if (event.mode === 'boss') return seen(TIP.BOSS) ? null : make(TIP.BOSS);
      return null;
    default:
      return null;
  }
}
