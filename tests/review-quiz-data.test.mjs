// 마무리 퀴즈 상황 빈칸 문장 검사(Task 11b): 50개 모두, 빈칸 하나, 길이, 보이는 꼴, 다른 글과 겹치지 않음.
// 글꼴 서브셋이 이 글자들을 담는지는 tests/fonts.test.mjs가 data/ 전체로 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_SITUATIONS, CLOSE_WORDS } from '../data/review-quiz.js';
import { WORDS } from '../data/words.js';
import { ACTS } from '../data/acts/index.js';
import ENDING from '../data/ending.js';
import { allLines, shownText } from './lines.mjs';

const BLANK = '___';
const WINDOW = 8;
const formOf = (s) => s.answerForm ?? WORDS.find((w) => w.id === s.word).word;
const fill = (s) => s.situation.replace(BLANK, formOf(s));
const squash = (t) => t.replace(/[\s.,!?'"“”‘’…~]/g, '');

// 견줄 글: 도감 예문, 모든 막 대사(보이는 꼴), 엔딩 대사, 보스 문제 문장과 보기
function sources() {
  const out = WORDS.map((w) => w.example);
  for (const act of ACTS) {
    for (const ch of act.chapters) for (const l of allLines(ch)) out.push(shownText(l.text, '하늘'));
    for (const q of Object.values(act.bossQuizzes)) {
      out.push(q.prompt, ...q.options);
      if (q.type === 'blank') out.push(q.prompt.replace(BLANK, q.options[q.answer]));
    }
  }
  for (const sc of ENDING.scenes) for (const l of sc.lines) out.push(shownText(l.text, '하늘'));
  return out;
}

test('낱말 50개마다 문장 하나, id는 WORDS에 있다(차례도 WORDS와 같다)', () => {
  assert.equal(REVIEW_SITUATIONS.length, 50);
  assert.deepEqual(REVIEW_SITUATIONS.map((s) => s.word), WORDS.map((w) => w.id));
  for (const s of REVIEW_SITUATIONS) assert.deepEqual(Object.keys(s).filter((k) => !['word', 'situation', 'answerForm'].includes(k)), [], s.word);
});

test('빈칸 ___이 정확히 하나, 채운 문장 50자 이하, 마침표 등으로 끝난다, [[ ]]·{ } 없음', () => {
  for (const s of REVIEW_SITUATIONS) {
    assert.equal(s.situation.split(BLANK).length - 1, 1, `빈칸 하나: ${s.situation}`);
    assert.doesNotMatch(s.situation, /_{4,}|\[\[|\{/, s.situation);
    assert.ok(fill(s).length <= 50, `50자 초과(${fill(s).length}): ${fill(s)}`);
    assert.match(s.situation, /[.!?]$/, s.situation);
    assert.equal(s.situation.trim(), s.situation);
  }
});

test('보이는 꼴(answerForm)은 낱말과 다르고 같은 글자로 시작한다. 꼴이 바뀌는 -다 낱말이 문장 끝이 아니면 answerForm이 있다', () => {
  for (const s of REVIEW_SITUATIONS) {
    const w = WORDS.find((x) => x.id === s.word).word;
    if (s.answerForm !== undefined) {
      assert.notEqual(s.answerForm, w, s.word);
      assert.equal(s.answerForm[0], w[0], `${s.word} → ${s.answerForm}`);
    }
    if (w.endsWith('다') && s.answerForm === undefined) assert.ok(s.situation.endsWith(`${BLANK}.`), `${s.word}: 문장 끝이 아니면 활용 꼴이 필요하다`);
  }
});

test('도감 예문·막 대사·엔딩 대사·보스 문제와 문장이 같지 않고, 빈칸 앞뒤 8자도 같지 않다', () => {
  const src = sources();
  assert.ok(src.length > 500, `견줄 글 ${src.length}개`);
  const squashed = src.map(squash);
  for (const s of REVIEW_SITUATIONS) {
    const filled = fill(s);
    assert.ok(!squashed.includes(squash(filled)), `같은 문장: ${filled}`);
    const [before, after] = s.situation.split(BLANK);
    const form = formOf(s);
    const left = before.slice(-WINDOW);
    const right = after.slice(0, WINDOW);
    for (const t of src) {
      if (left.length === WINDOW) assert.ok(!t.includes(left + form), `빈칸 앞 8자가 같다: ${filled} / ${t}`);
      if (right.length === WINDOW) assert.ok(!t.includes(form + right), `빈칸 뒤 8자가 같다: ${filled} / ${t}`);
      assert.ok(!t.includes(left + form + right), `빈칸 둘레가 같다: ${filled} / ${t}`);
    }
  }
});

test('가까운 낱말 묶음: 낱말 id가 WORDS에 있고, 한 낱말은 한 묶음에만', () => {
  const ids = new Set(WORDS.map((w) => w.id));
  const seen = new Set();
  for (const group of CLOSE_WORDS) {
    assert.ok(group.length >= 2);
    for (const id of group) {
      assert.ok(ids.has(id), id);
      assert.ok(!seen.has(id), `두 묶음에 있음: ${id}`);
      seen.add(id);
    }
  }
});
