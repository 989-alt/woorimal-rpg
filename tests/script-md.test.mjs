// 선생님 확인용 대본 Markdown(tools/script-md.mjs) 검사.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTS } from '../data/acts/index.js';
import ENDING from '../data/ending.js';
import { REVIEW_SITUATIONS } from '../data/review-quiz.js';
import { actScriptMd, endingScriptMd } from '../tools/script-md.mjs';

const leftovers = (md) => ['[[', '{이름', ']]'].filter((s) => md.includes(s));

test('actScriptMd 4막: 보이는 꼴, 뾰로통, 보스 뒤 장면, chatAfter, show, 세계 지도 카드', () => {
  const md = actScriptMd(ACTS[3], '하늘');
  for (const s of [
    '**살갑구나**', '(뾰로통)', '(쓸쓸함)', '### 보스를 이긴 뒤 한 번 나오는 장면', '(보스를 이기기 전에만 보임)',
    '해솔(동료)', '**해솔** (부탁 「', '을 끝낸 뒤)', '세계 지도 카드: 나래의 길잡이를 따라 안개 낀 고개로',
    '알려 주는 인물: 가람',
  ]) assert.ok(md.includes(s), s);
  assert.deepEqual(leftovers(md), []);
});

test('actScriptMd 5막: 나래는 늘 마지막 문제, finalCue 한 줄, 빛 표정, 보스를 이긴 뒤에만 보이는 나래', () => {
  const md = actScriptMd(ACTS[4], '하늘');
  const boss = md.slice(md.indexOf('## 막 보스전'));
  const items = boss.split('\n').filter((l) => /^\d+\. /.test(l));
  assert.equal(items.length, 10);
  assert.match(items.at(-1), /^10\. \*\*나래\*\* · 빈칸 채우기 \(늘 마지막 문제\)/);
  assert.equal(items.filter((l) => l.includes('(늘 마지막 문제)')).length, 1);
  assert.ok(boss.includes(`마지막 문제 앞에 나오는 한 줄: *${ACTS[4].finalCue}*`));
  assert.ok(md.includes('(빛)'));
  assert.ok(md.includes('(보스를 이긴 뒤에만 보임)'));
  assert.deepEqual(leftovers(md), []);
});

test('actScriptMd 2·3막: 머리에 세계 지도 카드, 숨은 낱말마다 알려 주는 인물', () => {
  for (const act of ACTS.slice(1)) {
    const md = actScriptMd(act, '하늘');
    assert.ok(md.includes(`세계 지도 카드: ${act.travel}`), `${act.id}막 travel`);
    for (const ch of act.chapters) {
      const giver = ch.npcs.find((n) => n.id === ch.hidden.revealedBy).name;
      assert.ok(md.includes(`알려 주는 인물: ${giver}`), `${ch.id} ${giver}`);
    }
    assert.deepEqual(leftovers(md), [], `${act.id}막`);
  }
});

test('endingScriptMd: 장면 여덟(되찾은 마을 넷), 한 장 그림, 마지막 말, 주머니, 마무리 퀴즈, 만든 이, 인사', () => {
  const md = endingScriptMd(ENDING, '하늘');
  for (let i = 1; i <= ENDING.scenes.length; i++) assert.ok(md.includes(`## 장면 ${i}`), `장면 ${i}`);
  assert.ok(!md.includes(`## 장면 ${ENDING.scenes.length + 1}`));
  for (const s of [
    '배경: 2-1', '배경: 3-2', '배경: 4-1', '배경: 5-1', '(새벽빛으로 물든 그림)', '배경: ending03 (한 장 그림, 상반신 없음)',
    '**사과 장수 아저씨** (기쁨): 오늘은 문을 열자마자 마수걸이를 했다네!',
    '우리가 쓰면 말은 살아난다.', '하늘의 말빛 주머니', '## 마무리 퀴즈', '끝까지 길을 걸은 하늘',
    '하늘아, 끝까지 함께해 줘서 고마워!',
  ]) assert.ok(md.includes(s), s);
  // 상황 빈칸 문장 50개가 모두 빈칸·채운 꼴과 함께 나온다
  for (const s of REVIEW_SITUATIONS) assert.ok(md.includes(s.situation), s.word);
  assert.ok(md.includes('**데면데면하게**'));
  // 마지막 말 → 주머니 → 퀴즈 → 만든 이 차례
  const at = ['## 마지막 말', '## 말빛 주머니', '## 마무리 퀴즈', '## 만든 이'].map((h) => md.indexOf(h));
  assert.ok(at.every((p, i) => p > 0 && (i === 0 || p > at[i - 1])), at.join(','));
  assert.deepEqual(leftovers(md), []);
});

test('actScriptMd 1막: 지금 docs/review/act1-script.md의 줄이 모두 차례대로 남는다(더해지기만 한다)', () => {
  const before = readFileSync(new URL('../docs/review/act1-script.md', import.meta.url), 'utf8').split('\n');
  const after = actScriptMd(ACTS[0], '하늘').split('\n');
  let j = 0;
  for (const line of before) {
    while (j < after.length && after[j] !== line) j++;
    assert.ok(j < after.length, `빠지거나 차례가 바뀐 줄: ${line}`);
    j++;
  }
  assert.ok(after.includes('알려 주는 인물: 텃밭 아저씨'));
  // 숨은 낱말을 알려 주는 인물의 reveal·after 대사도 뽑는다(1막만 따로 둔다)
  assert.ok(after.includes('**텃밭 아저씨** (숨은 낱말을 처음 알려 줄 때)'));
  assert.ok(after.includes('**텃밭 아저씨** (숨은 낱말을 알려 준 뒤)'));
});
