// 마무리 퀴즈 규칙(순수 함수): 낱말 50개에서 10개를 골라 뜻 고르기 4 · 초성 3 · 상황 빈칸 3문제를 섞어 낸다.
// 하트·시간 제한은 없다. 문제는 받은 rng로만 정해진다(같은 시드 → 같은 퀴즈).
import { shuffle } from './rng.js';
import { REVIEW_SITUATIONS, CLOSE_WORDS } from '../../data/review-quiz.js';

export const QUIZ_TYPES = { meaning: 4, chosung: 3, situation: 3 };
export const QUIZ_SIZE = Object.values(QUIZ_TYPES).reduce((a, b) => a + b, 0);

// ── 한글 자모 ─────────────────────────
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const PAIR_V = { ㅗㅏ: 'ㅘ', ㅗㅐ: 'ㅙ', ㅗㅣ: 'ㅚ', ㅜㅓ: 'ㅝ', ㅜㅔ: 'ㅞ', ㅜㅣ: 'ㅟ', ㅡㅣ: 'ㅢ' };
const PAIR_T = { ㄱㅅ: 'ㄳ', ㄴㅈ: 'ㄵ', ㄴㅎ: 'ㄶ', ㄹㄱ: 'ㄺ', ㄹㅁ: 'ㄻ', ㄹㅂ: 'ㄼ', ㄹㅅ: 'ㄽ', ㄹㅌ: 'ㄾ', ㄹㅍ: 'ㄿ', ㄹㅎ: 'ㅀ', ㅂㅅ: 'ㅄ' };
const SYL_FIRST = 0xac00;
const SYL_LAST = 0xd7a3;
const isVowel = (c) => c !== undefined && JUNG.includes(c);
const isFinal = (c) => c !== undefined && JONG.indexOf(c) > 0;

// 음절마다 첫소리(한글 음절이 아닌 글자는 그대로)
export function chosungOf(word) {
  return [...word].map((c) => {
    const code = c.codePointAt(0);
    return code >= SYL_FIRST && code <= SYL_LAST ? CHO[Math.floor((code - SYL_FIRST) / 588)] : c;
  }).join('');
}

// 낱자(ㅇㅓㅅㅡㄹㅡㅁ)로 친 글을 음절로 모은다. 받침 뒤에 모음이 오면 그 자음은 다음 음절의 첫소리가 된다.
function composeJamo(text) {
  const c = [...text];
  let out = '';
  let i = 0;
  while (i < c.length) {
    const L = CHO.indexOf(c[i]);
    if (L < 0 || !isVowel(c[i + 1])) { out += c[i]; i++; continue; }
    let j = i + 1;
    let v = c[j++];
    if (PAIR_V[v + c[j]]) v = PAIR_V[v + c[j++]];
    let t = '';
    if (isFinal(c[j]) && !isVowel(c[j + 1])) {
      const pair = PAIR_T[c[j] + c[j + 1]];
      if (pair && !isVowel(c[j + 2])) { t = pair; j += 2; } else { t = c[j]; j += 1; }
    }
    out += String.fromCharCode(SYL_FIRST + (L * 21 + JUNG.indexOf(v)) * 28 + JONG.indexOf(t));
    i = j;
  }
  return out;
}

// 초성 문제의 답 맞추기: 공백을 무시하고, 풀어 쓴 한글(NFD)과 낱자로 친 글도 음절로 모아 견준다.
export function checkChosung(input, word) {
  const target = typeof word === 'string' ? word : word.word;
  const typed = composeJamo(String(input ?? '').normalize('NFC').replace(/\s+/g, ''));
  return typed.length > 0 && typed === target.normalize('NFC');
}

// ── 문제 만들기 ─────────────────────────
// 그 낱말과 뜻이 가까운 낱말들(그 낱말 포함)
const nearOf = (id, close) => [id, ...close.filter((g) => g.includes(id)).flat()];

// 오답 뜻 셋: 정답 낱말과 뜻이 가까운 낱말의 뜻은 빼고, 오답끼리도 뜻이 가까운 것은 하나만
function meaningQuestion(w, words, rng, close) {
  const blocked = new Set(nearOf(w.id, close));
  const seen = new Set([w.meaning]);
  const wrong = [];
  for (const x of shuffle(words.filter((y) => !blocked.has(y.id)), rng)) {
    if (wrong.length === 3) break;
    if (blocked.has(x.id) || seen.has(x.meaning)) continue;
    seen.add(x.meaning);
    wrong.push(x.meaning);
    nearOf(x.id, close).forEach((id) => blocked.add(id));
  }
  const options = shuffle([w.meaning, ...wrong], rng);
  return { type: 'meaning', word: w.id, prompt: `'${w.word}'의 뜻은?`, options, answer: options.indexOf(w.meaning) };
}

function chosungQuestion(w) {
  return { type: 'chosung', word: w.id, chosung: chosungOf(w.word), meaning: w.meaning, answerText: w.word };
}

// 오답 보기 셋: 뜻이 가까운 낱말은 빼고 무작위로, 그중 하나는 꼭 다른 막 낱말
function situationQuestion(w, words, rng, situations, close) {
  const s = situations.find((x) => x.word === w.id);
  if (!s) throw new Error(`상황 빈칸 문장이 없는 낱말: ${w.id}`);
  const near = new Set(nearOf(w.id, close));
  const pool = shuffle(words.filter((x) => x.id !== w.id && !near.has(x.id)), rng);
  const wrong = pool.slice(0, 3);
  if (!wrong.some((x) => x.act !== w.act)) wrong[2] = pool.find((x) => x.act !== w.act);
  const options = shuffle([w.word, ...wrong.map((x) => x.word)], rng);
  return { type: 'situation', word: w.id, prompt: s.situation, fill: s.answerForm ?? w.word, options, answer: options.indexOf(w.word) };
}

// words(낱말 목록)에서 겹치지 않게 10개를 골라 유형을 섞어 붙인다. 낱말과 유형이 모두 섞이므로 문제 차례도 섞인다.
export function buildQuiz(words, rng, situations = REVIEW_SITUATIONS, close = CLOSE_WORDS) {
  const picked = shuffle(words, rng).slice(0, QUIZ_SIZE);
  const types = shuffle(Object.entries(QUIZ_TYPES).flatMap(([t, n]) => Array(n).fill(t)), rng);
  return picked.map((w, i) => (
    types[i] === 'meaning' ? meaningQuestion(w, words, rng, close)
      : types[i] === 'chosung' ? chosungQuestion(w)
      : situationQuestion(w, words, rng, situations, close)
  ));
}
