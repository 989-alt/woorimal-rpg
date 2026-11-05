import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import ACT from '../data/acts/act1.js';
import { parseMap, reachable } from '../js/explore/grid.js';

// 막마다 도는 검사(대사 모양, 낱말 배정, 맵, 출구, 보스전 문제)는 tests/acts.test.mjs에 있다.
// 여기에는 낱말 50개와 1막에만 있는 것만 둔다.
const ACT1_IDS = WORDS.filter((w) => w.act === 1).map((w) => w.id);
const wordById = Object.fromEntries(WORDS.map((w) => [w.id, w]));

test('낱말 50개, 막마다 10개, 중복 없음, 나래 있음·짜장 없음', () => {
  assert.equal(WORDS.length, 50);
  for (let act = 1; act <= 5; act++) assert.equal(WORDS.filter((w) => w.act === act).length, 10, `막 ${act}`);
  assert.equal(new Set(WORDS.map((w) => w.id)).size, 50);
  for (const w of WORDS) {
    assert.equal(w.id, w.word);
    assert.ok(w.meaning && typeof w.meaning === 'string', w.id);
    assert.ok(w.example && w.example.endsWith('.'), w.id);
  }
  assert.ok(wordById['나래']);
  assert.equal(wordById['나래'].act, 5);
  assert.equal(wordById['나래'].meaning, "'날개'를 시나 노래에서 아름답게 이르는 말");
  assert.equal(wordById['짜장'], undefined);
  assert.deepEqual(ACT1_IDS, ['어스름', '아침나절', '해거름', '부리나케', '매무새', '짬', '곰비임비', '얼추', '손사래', '오롯이']);
  assert.equal(wordById['어스름'].meaning, '해 뜨기 전이나 해 진 뒤의 조금 어둑한 때');
  assert.equal(wordById['오롯이'].example, '할머니의 마음이 주머니에 오롯이 담겨 있다.');
  assert.equal(wordById['도담도담'].meaning, '아이가 탈 없이 잘 자라는 모양');
});

test('1막 숨은 낱말 알려 주기: 알려 주는 인물은 reveal·after를 갖고, 알려 주기 전 chat에는 반짝임 힌트가 없다', () => {
  for (const ch of ACT.chapters) {
    const who = ch.npcs.find((n) => n.id === ch.hidden.revealedBy);
    assert.ok(Array.isArray(who.reveal) && who.reveal.some((l) => l.text.includes('반짝')), `${ch.id}: ${who.id}의 reveal에 반짝임 힌트`);
    assert.ok(who.chat.every((l) => !l.text.includes('반짝')), `${ch.id}: 알려 주기 전 chat에는 힌트가 없다`);
    // 말 거는 인물이 아닌 사람은 reveal·after를 갖지 않는다
    for (const n of ch.npcs) if (n.id !== who.id) assert.ok(!n.reveal && !n.after, `${n.id}: reveal·after는 알려 주는 인물만`);
  }
  assert.equal(ACT.chapters[0].hidden.revealedBy, 'gardener');
  const g = ACT.chapters[0].npcs.find((n) => n.id === 'gardener');
  assert.ok(Array.isArray(g.after) && g.after.some((l) => l.text.includes('장독대')), '알려 준 뒤 아저씨는 장독대를 일러 준다');
});

test('1막 출구: 몬스터·안개가 닫혀 있을 때는 닿지 못하고, 뒷 장은 won·closed 글이 있다', () => {
  ACT.chapters.forEach((ch, i) => {
    const e = ch.exit;
    const map = parseMap(ch.map.rows);
    assert.ok(!reachable(map, map.start, {}).has(`${e.x},${e.y}`), `${ch.id}: 닫혀 있을 때는 출구에 닿지 못함`);
    if (i === ACT.chapters.length - 1) {
      assert.ok(e.won && e.won.length <= 25, `${ch.id} exit.won`);
      assert.ok(e.closed && e.closed.length > 0, `${ch.id} exit.closed`);
      assert.ok(reachable(map, map.start, { fogOpen: true }).has(`${e.x},${e.y}`), `${ch.id}: 안개가 열리면 보스 앞 출구 칸에 닿는다(닫힌 알림)`);
    }
  });
});
