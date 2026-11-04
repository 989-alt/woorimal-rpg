// 마무리 퀴즈 규칙(Task 11c): 10문제 만들기, 초성, 초성 답 맞추기.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuiz, chosungOf, checkChosung, QUIZ_TYPES } from '../js/rules/review-quiz.js';
import { makeRng } from '../js/rules/rng.js';
import { WORDS } from '../data/words.js';
import { REVIEW_SITUATIONS, CLOSE_WORDS } from '../data/review-quiz.js';

const wordOf = (id) => WORDS.find((w) => w.id === id);
const closeTo = (id) => new Set(CLOSE_WORDS.find((g) => g.includes(id)) ?? []);

test('buildQuiz: 겹치지 않는 낱말 10개, 뜻 고르기 4 · 초성 3 · 상황 빈칸 3', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const quiz = buildQuiz(WORDS, makeRng(seed));
    assert.equal(quiz.length, 10);
    assert.equal(new Set(quiz.map((q) => q.word)).size, 10, '낱말이 겹치지 않는다');
    const count = (t) => quiz.filter((q) => q.type === t).length;
    assert.deepEqual([count('meaning'), count('chosung'), count('situation')], [4, 3, 3]);
    for (const q of quiz) assert.ok(wordOf(q.word), q.word);
  }
  assert.deepEqual(Object.keys(QUIZ_TYPES), ['meaning', 'chosung', 'situation']);
});

test('buildQuiz: 보기 문제는 보기 4개, 정답이 보기에 꼭 하나', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const q of buildQuiz(WORDS, makeRng(seed))) {
      const w = wordOf(q.word);
      if (q.type === 'chosung') {
        assert.equal(q.chosung, chosungOf(w.word));
        assert.equal(q.meaning, w.meaning);
        assert.equal(q.answerText, w.word);
        continue;
      }
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4, '보기가 겹치지 않는다');
      const right = q.type === 'meaning' ? w.meaning : w.word;
      assert.equal(q.options.filter((o) => o === right).length, 1);
      assert.equal(q.options[q.answer], right);
      if (q.type === 'meaning') assert.equal(q.prompt, `'${w.word}'의 뜻은?`);
    }
  }
});

test('buildQuiz 상황 빈칸: 그 낱말 문장, 보이는 꼴, 오답에 가까운 낱말은 없고 다른 막 낱말이 하나는 있다', () => {
  let situations = 0;
  for (let seed = 1; seed <= 80; seed++) {
    for (const q of buildQuiz(WORDS, makeRng(seed)).filter((x) => x.type === 'situation')) {
      situations++;
      const s = REVIEW_SITUATIONS.find((x) => x.word === q.word);
      const w = wordOf(q.word);
      assert.equal(q.prompt, s.situation);
      assert.equal(q.fill, s.answerForm ?? w.word);
      const wrong = q.options.filter((_, i) => i !== q.answer).map((o) => WORDS.find((x) => x.word === o));
      for (const x of wrong) assert.ok(!closeTo(q.word).has(x.id), `${q.word}의 오답에 가까운 낱말 ${x.id}`);
      assert.ok(wrong.some((x) => x.act !== w.act), `${q.word}: 다른 막 낱말이 오답에 있다`);
    }
  }
  assert.ok(situations >= 200);
});

test('buildQuiz: 시드마다 낱말과 문제 차례가 달라진다(차례도 섞는다)', () => {
  const a = buildQuiz(WORDS, makeRng(1));
  const b = buildQuiz(WORDS, makeRng(2));
  assert.notDeepEqual(a.map((q) => q.word), b.map((q) => q.word));
  const firstTypes = new Set(Array.from({ length: 30 }, (_, i) => buildQuiz(WORDS, makeRng(i + 1))[0].type));
  assert.equal(firstTypes.size, 3, '첫 문제 유형도 섞인다');
  // 같은 시드는 같은 퀴즈
  assert.deepEqual(buildQuiz(WORDS, makeRng(9)), buildQuiz(WORDS, makeRng(9)));
});

test('chosungOf: 음절마다 첫소리', () => {
  assert.equal(chosungOf('어스름'), 'ㅇㅅㄹ');
  assert.equal(chosungOf('가뭇없다'), 'ㄱㅁㅇㄷ');
  assert.equal(chosungOf('짬'), 'ㅉ');
  assert.equal(chosungOf('도담도담'), 'ㄷㄷㄷㄷ');
  for (const w of WORDS) assert.equal([...chosungOf(w.word)].length, [...w.word].length, w.word);
});

test('checkChosung: 공백 무시, 자모 조합(NFD·낱자), 틀린 답과 빈 답은 틀림', () => {
  assert.equal(checkChosung('어스름', '어스름'), true);
  assert.equal(checkChosung('  어 스 름 ', '어스름'), true);
  assert.equal(checkChosung('어스름'.normalize('NFD'), '어스름'), true, '풀어 쓴 한글(NFD)');
  assert.equal(checkChosung('ㅇㅓㅅㅡㄹㅡㅁ', '어스름'), true, '낱자로 친 것');
  assert.equal(checkChosung('ㄱㅏㅁㅜㅅㅇㅓㅂㅅㄷㅏ', '가뭇없다'), true, '겹받침 ㅄ');
  assert.equal(checkChosung('ㅎㅏㅁㅊㅗㄹㅗㅁㅎㅏㄷㅏ', '함초롬하다'), true);
  assert.equal(checkChosung('ㄴㅓㅇㅜㄹㄱㅏㅈㅣ', '너울가지'), true, '받침이 다음 모음으로 넘어가지 않는다');
  assert.equal(checkChosung('ㅁㅏㄸㅡㄱㅈㅏㄶㄷㅏ', '마뜩잖다'), true, '겹받침 ㄶ 낱자');
  assert.equal(checkChosung('ㅁㅏㄸㅡㄱㅈㅏㄴㅎㄷㅏ', '마뜩잖다'), true, 'ㄴ+ㅎ 겹받침');
  assert.equal(checkChosung('ㅇㅘ', '와'), true, '겹모음');
  assert.equal(checkChosung('어스럼', '어스름'), false);
  assert.equal(checkChosung('', '어스름'), false);
  assert.equal(checkChosung('   ', '어스름'), false);
  assert.equal(checkChosung('어스름이', '어스름'), false);
  assert.equal(checkChosung('어스름', { word: '어스름' }), true, '낱말 객체도 받는다');
});
