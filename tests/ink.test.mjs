import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ribbonInk, relativeLuminance } from '../js/ui/ink.js';

test('리본 글자색: 밝은 리본은 먹색, 어두운 리본은 흰색', () => {
  assert.equal(ribbonInk('#3B5BA5'), '#FFFFFF'); // 주인공 쪽빛
  assert.equal(ribbonInk('#C9A97E'), '#FFFFFF'); // 빨래터 아주머니(휘도 약 0.42)
  assert.equal(ribbonInk('#EDE6D6'), '#2B2622'); // 빵집 아저씨
  assert.equal(ribbonInk('#A9C9D6'), '#2B2622'); // 나래
});

test('휘도: 검정 0, 흰색 1, 형식이 틀리면 0', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#FFFFFF'), 1);
  assert.equal(relativeLuminance('nope'), 0);
  assert.equal(ribbonInk('nope'), '#FFFFFF');
});
