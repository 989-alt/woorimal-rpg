import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasBatchim, attachJosa, formatLine, validateNickname } from '../js/rules/josa.js';

test('받침에 맞는 조사', () => {
  assert.equal(attachJosa('서준', '아'), '서준아');
  assert.equal(attachJosa('서준', '이'), '서준이');
  assert.equal(attachJosa('지우', '아'), '지우야');
  assert.equal(attachJosa('지우', '이'), '지우가');
  assert.equal(attachJosa('하늘', '은'), '하늘은');
  assert.equal(attachJosa('지우', '을'), '지우를');
  assert.equal(attachJosa('Tom', '아'), 'Tom야');
  assert.equal(attachJosa('민수7', '이'), '민수7가');
});
test('hasBatchim', () => {
  assert.equal(hasBatchim('준'), true);
  assert.equal(hasBatchim('우'), false);
  assert.equal(hasBatchim('7'), false);
});
test('대사 서식', () => {
  assert.equal(formatLine('기다렸단다, {이름|아}.', '하늘'), '기다렸단다, 하늘아.');
  assert.equal(formatLine('{이름}의 주머니', '지우'), '지우의 주머니');
  assert.equal(formatLine('{이름|은} {이름|을} {이름|이} {모름}', '지우'), '지우는 지우를 지우가 {모름}');
});
test('닉네임 검사', () => {
  assert.deepEqual(validateNickname('  하늘 '), { ok: true, value: '하늘' });
  for (const bad of ['', '   ', '가나다라마바사', 'ㅎㅎ', '하늘!']) assert.equal(validateNickname(bad).ok, false);
  assert.equal(validateNickname('Sky12').ok, true);
  assert.equal(validateNickname('').error, '이름을 적어 주세요.');
  assert.equal(validateNickname('가나다라마바사').error, '이름은 6글자까지 쓸 수 있어요.');
  assert.equal(validateNickname('하늘!').error, '한글, 영어, 숫자만 쓸 수 있어요.');
});
