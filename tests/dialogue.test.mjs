import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitHighlights, createTypewriter, resolveSpeaker, newWordsOf } from '../js/scenes/dialogue.js';

test('강조 조각 나누기', () => {
  assert.deepEqual(splitHighlights('새벽 [[어스름]]부터'), [{ text: '새벽 ' }, { text: '어스름', word: '어스름' }, { text: '부터' }]);
  assert.deepEqual(splitHighlights('그냥 글'), [{ text: '그냥 글' }]);
  assert.deepEqual(splitHighlights('[[짬]]'), [{ text: '짬', word: '짬' }]);
  assert.deepEqual(splitHighlights('[[가]] 와 [[나]]'), [
    { text: '가', word: '가' }, { text: ' 와 ' }, { text: '나', word: '나' }]);
});

test('splitHighlights: [[id|꼴]]은 꼴을 보이고 낱말 id를 단다', () => {
  assert.deepEqual(splitHighlights('넌 참 [[살갑다|살갑구나]]!'), [{ text: '넌 참 ' }, { text: '살갑구나', word: '살갑다' }, { text: '!' }]);
});

test('타자 효과: 첫 누름은 다 보이기, 200ms 안은 무시, 그 뒤는 다음', () => {
  const t = createTypewriter({ full: '가나다', msPerChar: 30 });
  assert.equal(t.press(), 'reveal'); assert.equal(t.shown(), '가나다');
  t.tick(100); assert.equal(t.press(), 'ignored');
  t.tick(150); assert.equal(t.press(), 'next');
});

test('타자 효과: 시간이 지나면 한 글자씩 나온다', () => {
  const t = createTypewriter({ full: '가나다', msPerChar: 30 });
  assert.equal(t.shown(), '');
  t.tick(30); assert.equal(t.shown(), '가');
  t.tick(35); assert.equal(t.shown(), '가나');
  assert.equal(t.done(), false);
  t.tick(30); assert.equal(t.done(), true);
});

test('타자 효과: 저절로 다 보인 뒤에도 200ms 안의 누름은 무시', () => {
  const t = createTypewriter({ full: '가나', msPerChar: 30 });
  t.tick(100); // 60ms에 끝나고 40ms 지남
  assert.equal(t.done(), true);
  assert.equal(t.press(), 'ignored');
  t.tick(170);
  assert.equal(t.press(), 'next');
});

test('타자 효과: 빈 글은 곧바로 다 보임', () => {
  const t = createTypewriter({ full: '', msPerChar: 30 });
  assert.equal(t.done(), true);
});

const NPCS = [{ id: 'dodam', name: '도담 할머니', color: '#8E4A7A' }, { id: 'daon', name: '다온', color: '#C9A97E' }];

test('말하는 사람: npc 줄은 line.npc, 없으면 from 이름', () => {
  assert.deepEqual(resolveSpeaker({ who: 'npc', npc: 'daon', text: 'a' }, NPCS, '도담 할머니', '하늘'),
    { side: 'npc', name: '다온', color: '#C9A97E' });
  assert.deepEqual(resolveSpeaker({ who: 'npc', text: 'a' }, NPCS, '도담 할머니', '하늘'),
    { side: 'npc', name: '도담 할머니', color: '#8E4A7A' });
});

test('말하는 사람: 주인공은 닉네임과 쪽빛, 해설은 없음', () => {
  assert.deepEqual(resolveSpeaker({ who: 'hero', text: 'a' }, NPCS, '', '하늘'),
    { side: 'hero', name: '하늘', color: '#3B5BA5' });
  assert.equal(resolveSpeaker({ who: 'narration', text: 'a' }, NPCS, '', '하늘'), null);
});

test('카드 낱말: params.words에 있고 이 대화에서 아직 카드를 보이지 않은 것만, 줄 안 차례대로', () => {
  const text = '[[어스름]]과 [[짬]]과 [[해거름]]과 [[어스름]]';
  assert.deepEqual(newWordsOf(text, ['어스름', '해거름', '짬'], new Set(['짬'])), ['어스름', '해거름']);
  assert.deepEqual(newWordsOf(text, ['어스름', '해거름', '짬']), ['어스름', '짬', '해거름']);
  // params.words에 없는 [[ ]](앞 대화에서 얻은 낱말 등)는 띠만
  assert.deepEqual(newWordsOf(text, ['해거름'], new Set()), ['해거름']);
  assert.deepEqual(newWordsOf(text, [], new Set()), []);
});

import { keyConfirmAllowed, CARD_GUARD_MS } from '../js/ui/meaning-card.js';

test('낱말 카드: 열린 뒤 300ms 안의 키보드 확인은 막고, 그 뒤는 받는다', () => {
  assert.equal(CARD_GUARD_MS, 300);
  assert.equal(keyConfirmAllowed(1000, 1000), false);
  assert.equal(keyConfirmAllowed(1000, 1299), false);
  assert.equal(keyConfirmAllowed(1000, 1300), true);
});

test('타자 효과 0ms: 처음부터 다 보이고, 다 나온 뒤 200ms 동안은 넘어가지 않는다', () => {
  const t = createTypewriter({ full: '가나다', msPerChar: 0 });
  assert.equal(t.done(), true);
  assert.equal(t.shown(), '가나다');
  assert.equal(t.press(), 'ignored');
  t.tick(150); assert.equal(t.press(), 'ignored');
  t.tick(60); assert.equal(t.press(), 'next');
});

test('타자 효과 settled: 다 보이고 200ms가 지나야 참(그때 고리를 멈춘다), count는 보인 글자 수', () => {
  const t = createTypewriter({ full: '가나', msPerChar: 30 });
  assert.equal(t.count(), 0);
  t.tick(30); assert.equal(t.count(), 1); assert.equal(t.settled(), false);
  t.tick(30); assert.equal(t.done(), true); assert.equal(t.settled(), false);
  t.tick(199); assert.equal(t.settled(), false);
  t.tick(1); assert.equal(t.settled(), true);
  const r = createTypewriter({ full: '가나다라', msPerChar: 30 });
  r.press(); // 다 보이기: 기다림은 그때부터
  assert.equal(r.count(), 4);
  assert.equal(r.settled(), false);
  r.tick(200); assert.equal(r.settled(), true);
});
