import { test } from 'node:test';
import assert from 'node:assert/strict';
import ACT from '../data/acts/act1.js';
import { newGame, chapterOf, markTip, acquireWords } from '../js/rules/game.js';
import { talkTo, inspect } from '../js/rules/quests.js';
import { TIP, HINT_MS, hintText, dueHint } from '../js/rules/tutorial.js';

const ch = chapterOf(ACT, '1-1');
const s0 = newGame({ nickname: '하늘', avatar: 'f' });
const ex = (facing = null, sparkleInView = false) => ({ type: 'explore', facing, sparkleInView });
const pick = ({ id, anchor, until, ms }) => ({ id, anchor, until, ms });
const allSeen = { ...s0, seenTips: Object.values(TIP) };
const EVENTS = [
  ex('npc', true), ex('object', true), { type: 'dialogue-line', newWord: true }, { type: 'dialogue-line', newWord: false },
  { type: 'word-card' }, { type: 'battle', mode: 'review' }, { type: 'battle', mode: 'boss' },
];

test('처음 탐험: move', () => {
  assert.equal(dueHint(s0, ch, ex()).id, 'move');
  assert.equal(dueHint(s0, ch, ex(), { touch: true }).text, '왼쪽 아래 화살표를 눌러 걸어 보세요');
});

test('move를 본 뒤 인물 앞: talk(8초), 아니면 없음', () => {
  const s = markTip(s0, 'move');
  assert.deepEqual(pick(dueHint(s, ch, ex('npc'))), { id: 'talk', anchor: 'hero', until: 'talk', ms: HINT_MS });
  assert.equal(dueHint(s, ch, ex('object')), null);
  assert.equal(dueHint(s0, ch, ex('npc')).id, 'move');
});

test('부탁이 active면 quest, talk보다 뒤', () => {
  let s = markTip(s0, 'move');
  ({ state: s } = talkTo(s, ch, 'dodam'));
  assert.equal(dueHint(s, ch, ex('npc')).id, 'talk');
  s = markTip(s, 'talk');
  const h = dueHint(s, ch, ex());
  assert.deepEqual(pick(h), { id: 'quest', anchor: 'tasks-button', until: 'tasks', ms: HINT_MS });
  assert.equal(dueHint(markTip(s, 'quest'), ch, ex()), null);
});

test('반짝임: 주머니를 받은 뒤 화면 안이면 sparkle, 화면 밖이거나 주머니 전이면 없음', () => {
  const base = markTip(s0, 'move');
  assert.equal(dueHint(base, ch, ex(null, true)), null); // 주머니 전(none)
  let s = base;
  ({ state: s } = talkTo(s, ch, 'dodam'));
  ({ state: s } = inspect(s, ch, '0'));
  ({ state: s } = talkTo(s, ch, 'dodam')); // q1 끝, 주머니 받음
  s = markTip(markTip(s, 'talk'), 'quest');
  assert.deepEqual(pick(dueHint(s, ch, ex(null, true))), { id: 'sparkle', anchor: 'sparkle', until: 'inspect', ms: HINT_MS });
  assert.equal(dueHint(s, ch, ex(null, false)), null);
});

test('대화: 새 낱말 줄이면 tip-word, 아니면 dialogue, 둘 다 한 번', () => {
  const w = { type: 'dialogue-line', newWord: true };
  const n = { type: 'dialogue-line', newWord: false };
  assert.deepEqual(pick(dueHint(s0, ch, w)), { id: 'tip-word', anchor: 'word', until: 'press', ms: null });
  assert.equal(dueHint(s0, ch, n).id, 'dialogue');
  assert.equal(dueHint(markTip(s0, 'tip-word'), ch, w).id, 'dialogue');
  assert.equal(dueHint(markTip(s0, 'tip-word'), ch, n).id, 'dialogue');
  assert.equal(dueHint(markTip(s0, 'dialogue'), ch, w).id, 'tip-word');
  assert.equal(dueHint(markTip(markTip(s0, 'dialogue'), 'tip-word'), ch, w), null);
});

test('낱말 카드: codex / 전투: tip-review, tip-boss', () => {
  assert.deepEqual(pick(dueHint(s0, ch, { type: 'word-card' })), { id: 'codex', anchor: 'card-ok', until: 'confirm', ms: null });
  assert.deepEqual(pick(dueHint(s0, ch, { type: 'battle', mode: 'review' })), { id: 'tip-review', anchor: 'options', until: 'pick', ms: null });
  assert.deepEqual(pick(dueHint(s0, ch, { type: 'battle', mode: 'boss' })), { id: 'tip-boss', anchor: 'hearts', until: 'pick', ms: null });
  assert.equal(dueHint(s0, ch, { type: 'battle', mode: 'small' }), null);
});

test('본 안내는 다시 나오지 않는다(모든 id)', () => {
  for (const e of EVENTS) assert.equal(dueHint(allSeen, ch, e), null, JSON.stringify(e));
  // 하나씩 본 표시를 해도 그 안내는 다시 나오지 않는다
  for (const id of Object.values(TIP)) {
    const s = markTip(s0, id);
    for (const e of EVENTS) assert.notEqual(dueHint(s, ch, e)?.id, id);
  }
});

test('옛 저장(seenTips 옛 id 다섯)이면 새 안내만', () => {
  const old = { ...s0, seenTips: ['move', 'first-npc', 'tip-word', 'tip-boss', 'tip-review'] };
  assert.equal(dueHint(old, ch, ex('npc')).id, 'talk');
  assert.equal(dueHint(old, ch, { type: 'battle', mode: 'boss' }), null);
  assert.equal(dueHint(old, ch, { type: 'dialogue-line', newWord: true }).id, 'dialogue');
});

test('글: id가 서로 다르고, 줄마다 30자 이하, 두 줄까지, 키보드·터치 모두 있음', () => {
  const ids = Object.values(TIP).filter((id) => id !== TIP.FIRST_NPC);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(Object.values(TIP)).size, Object.values(TIP).length);
  for (const id of ids) {
    for (const touch of [false, true]) {
      const t = hintText(id, { touch });
      assert.ok(t.length > 0, id);
      const lines = t.split('\n');
      assert.ok(lines.length <= 2, id);
      for (const l of lines) assert.ok([...l].length <= 30, `${id}: ${l}`);
    }
  }
});

test('낱말 안내는 회색 낱말이 빛나는 것을 말한다', () => {
  assert.match(hintText(TIP.WORD), /빛나/);
  assert.doesNotMatch(hintText(TIP.WORD), /반짝이는 낱말/);
});
