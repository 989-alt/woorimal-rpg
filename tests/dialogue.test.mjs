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

test('새 낱말: params.words에 있고 아직 못 얻은 것만, 줄 안 차례대로', () => {
  const text = '[[어스름]]과 [[짬]]과 [[해거름]]';
  assert.deepEqual(newWordsOf(text, ['어스름', '해거름', '짬'], { 짬: {} }), ['어스름', '해거름']);
  assert.deepEqual(newWordsOf(text, [], {}), []);
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
