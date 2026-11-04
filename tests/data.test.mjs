import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import ACT from '../data/acts/act1.js';
import { parseMap, reachable } from '../js/explore/grid.js';
import { formatLine } from '../js/rules/josa.js';

const LONG_NAME = '가나다라마바';
const BRACKET = /\[\[(.+?)\]\]/g;
const brackets = (text) => [...text.matchAll(BRACKET)].map((m) => m[1]);
const plain = (text) => text.replace(BRACKET, '');
const shown = (text) => formatLine(text, LONG_NAME).replace(BRACKET, '$1');
const ACT1_IDS = WORDS.filter((w) => w.act === 1).map((w) => w.id);
const wordById = Object.fromEntries(WORDS.map((w) => [w.id, w]));

// 설계 5-3 표 그대로
const ASSIGN = {
  '1-1': { q1: ['dodam', 'fetch', ['어스름', '아침나절']], q2: ['daon', 'chase', ['매무새', '손사래']], hidden: '오롯이' },
  '1-2': { q3: ['baker', 'gather', ['부리나케', '짬']], q4: ['laundry', 'deliver', ['곰비임비', '얼추']], hidden: '해거름' },
};
const QUIZ_TYPES = {
  meaning: ['어스름', '아침나절', '해거름', '짬'],
  blank: ['얼추', '부리나케', '매무새'],
  usage: ['손사래', '오롯이', '곰비임비'],
};
// 아트 바이블 5절: 표정 묶음
const HERO_FACES = ['base', 'surprise', 'joy'];
const DODAM_FACES = ['base', 'worry', 'laugh'];
const VILLAGER_FACES = ['base', 'joy'];
const RESERVED_COLORS = ['#3B5BA5', '#8E4A7A', '#F08A3C', '#A9C9D6'];

/** 장의 모든 대사 묶음: [이름표, Line[]] */
function lineGroups(ch) {
  const groups = [[`${ch.id} intro`, ch.intro, 'before']];
  for (const n of ch.npcs) groups.push([`${ch.id} ${n.id}.chat`, n.chat, 'before']);
  for (const q of ch.quests) {
    groups.push([`${q.id}.offer`, q.offer, 'before']);
    groups.push([`${q.id}.waiting`, q.waiting, 'before']);
    groups.push([`${q.id}.done`, q.done, 'done']);
  }
  groups.push([`${ch.id} hidden`, ch.hidden.lines, 'done']);
  return groups;
}
const allLines = (ch) => lineGroups(ch).flatMap(([, lines]) => lines);
const objectTexts = (ch) => ch.objects.map((o) => o.text);

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
  assert.equal(wordById['나래'].meaning, '날개를 문학적으로 이르는 말');
  assert.equal(wordById['짜장'], undefined);
  assert.deepEqual(ACT1_IDS, ['어스름', '아침나절', '해거름', '부리나케', '매무새', '짬', '곰비임비', '얼추', '손사래', '오롯이']);
  assert.equal(wordById['어스름'].meaning, '해 뜨기 전이나 해 진 뒤의 조금 어둑한 때');
  assert.equal(wordById['오롯이'].example, '이 주머니를 오롯이 너에게 맡기마.');
  assert.equal(wordById['도담도담'].meaning, '아이가 탈 없이 잘 자라는 모양');
});

test('1막 머리: id, 제목, 보스 이름', () => {
  assert.equal(ACT.id, 1);
  assert.equal(ACT.title, '새벽골');
  assert.equal(ACT.boss.name, '안개 덩이');
  assert.equal(ACT.small.name, '꼬마 안개');
  assert.deepEqual(ACT.chapters.map((c) => c.id), ['1-1', '1-2']);
  assert.deepEqual(ACT.chapters.map((c) => c.title), ['새벽골의 아침', '마을 어귀로']);
});

test('1막 장마다 낱말 5개: 부탁 2개 × 2 + 숨은 1 = 그 장 5개, 두 장 합 = 1막 10개', () => {
  const all = [];
  for (const ch of ACT.chapters) {
    const a = ASSIGN[ch.id];
    assert.equal(ch.quests.length, 2);
    const words = [];
    for (const q of ch.quests) {
      const [giver, kind, qw] = a[q.id];
      assert.equal(q.giver, giver, q.id);
      assert.equal(q.kind, kind, q.id);
      assert.deepEqual(q.words, qw, q.id);
      words.push(...q.words);
    }
    assert.equal(ch.hidden.word, a.hidden);
    words.push(ch.hidden.word);
    assert.equal(new Set(words).size, 5, ch.id);
    all.push(...words);
  }
  assert.equal(new Set(all).size, 10);
  assert.deepEqual([...all].sort(), [...ACT1_IDS].sort());
});

test('낱말은 done 또는 hidden.lines에서만 [[ ]]로 나오고, offer·waiting·chat에는 없다', () => {
  const laterWords = new Set(ACT1_IDS);
  for (const ch of ACT.chapters) {
    const mine = [...ch.quests.flatMap((q) => q.words), ch.hidden.word];
    for (const [label, lines, where] of lineGroups(ch)) {
      for (const l of lines) {
        const found = brackets(l.text);
        if (where === 'before') assert.deepEqual(found, [], `${label}: ${l.text}`);
        for (const w of found) assert.ok(wordById[w], `${label}: 없는 낱말 [[${w}]]`);
        // 이 장과 뒤 장의 낱말은 [[ ]] 밖에서 맨글자로 먼저 나오지 않는다
        for (const w of laterWords) assert.ok(!plain(l.text).includes(w), `${label}: '${w}'가 [[ ]] 없이 나옴: ${l.text}`);
      }
    }
    for (const t of objectTexts(ch)) {
      assert.deepEqual(brackets(t), [], t);
      for (const w of laterWords) assert.ok(!t.includes(w), `${ch.id} 물건 글에 '${w}': ${t}`);
    }
    for (const q of ch.quests) {
      const found = q.done.flatMap((l) => brackets(l.text));
      assert.deepEqual([...found].sort(), [...q.words].sort(), `${q.id}.done의 [[ ]]는 그 부탁 낱말 두 개, 한 번씩`);
    }
    assert.deepEqual(ch.hidden.lines.flatMap((l) => brackets(l.text)), [ch.hidden.word], `${ch.id} hidden`);
    for (const w of mine) laterWords.delete(w);
  }
});

test('대사 줄 모양: 말하는 이·표정·한 문장, offer마다 {이름…}', () => {
  for (const ch of ACT.chapters) {
    const npcIds = new Set(ch.npcs.map((n) => n.id));
    for (const [label, lines] of lineGroups(ch)) {
      assert.ok(Array.isArray(lines) && lines.length > 0, `${label} 비어 있음`);
      for (const l of lines) {
        assert.ok(['npc', 'hero', 'narration'].includes(l.who), `${label}: who ${l.who}`);
        assert.ok(typeof l.text === 'string' && l.text.trim() === l.text && l.text.length > 0, `${label}: text`);
        assert.ok(!/[.?!]["'”’]?\s+\S/.test(l.text), `${label}: 한 줄에 한 문장: ${l.text}`);
        assert.ok(!formatLine(l.text, LONG_NAME).includes('{'), `${label}: 바꾸지 못한 {}: ${l.text}`);
        if (l.who === 'npc') {
          assert.ok(npcIds.has(l.npc), `${label}: 없는 인물 ${l.npc}`);
          const faces = l.npc === 'dodam' ? DODAM_FACES : VILLAGER_FACES;
          if (l.face) assert.ok(faces.includes(l.face), `${label}: ${l.npc} 표정 ${l.face}`);
        } else {
          assert.equal(l.npc, undefined, `${label}: ${l.who}에 npc`);
          if (l.who === 'hero' && l.face) assert.ok(HERO_FACES.includes(l.face), `${label}: 주인공 표정 ${l.face}`);
          if (l.who === 'narration') assert.equal(l.face, undefined, `${label}: 해설에 표정`);
        }
      }
    }
    assert.ok(ch.intro.length >= 3 && ch.intro.length <= 5, `${ch.id} intro 3~5줄`);
    for (const q of ch.quests) {
      assert.ok(q.offer.some((l) => l.text.includes('{이름')), `${q.id}.offer에 {이름…} 없음`);
      const speaker = q.kind === 'deliver' ? q.targets[0] : q.giver;
      for (const l of q.offer.concat(q.waiting)) if (l.who === 'npc') assert.equal(l.npc, q.giver, `${q.id} offer/waiting`);
      for (const l of q.done) if (l.who === 'npc') assert.equal(l.npc, speaker, `${q.id}.done은 ${speaker}의 대사`);
      assert.ok(q.done.some((l) => l.who === 'npc'), `${q.id}.done에 인물 대사 없음`);
    }
  }
});

test('인물·물건: 칸 글자 짝, 숨은 낱말 힌트, 색', () => {
  const expectNpcs = { '1-1': ['dodam', 'daon'], '1-2': ['baker', 'laundry', 'gate'] };
  for (const ch of ACT.chapters) {
    const map = parseMap(ch.map.rows);
    assert.ok(ch.npcs.length >= 3 && ch.npcs.length <= 5, `${ch.id} 인물 3~5명`);
    assert.ok(ch.npcs.length <= expectNpcs[ch.id].length + 1, `${ch.id} 덧붙인 인물은 한 명까지`);
    for (const id of expectNpcs[ch.id]) assert.ok(ch.npcs.some((n) => n.id === id), `${ch.id}에 ${id}`);
    assert.equal(new Set(ch.npcs.map((n) => n.id)).size, ch.npcs.length);
    assert.deepEqual(ch.npcs.map((n) => n.slot).sort(), Object.keys(map.slots).sort(), `${ch.id} 인물 칸`);
    for (const n of ch.npcs) {
      assert.ok(n.name && /^#[0-9A-F]{6}$/i.test(n.color), `${n.id} 이름·색`);
      if (n.id !== 'dodam') assert.ok(!RESERVED_COLORS.includes(n.color.toUpperCase()), `${n.id}: 대표색은 마을 사람에게 쓰지 않음`);
    }
    assert.deepEqual(ch.objects.map((o) => o.slot).sort(), Object.keys(map.objects).sort(), `${ch.id} 물건 칸`);
    assert.equal(new Set(ch.objects.map((o) => o.name)).size, ch.objects.length, `${ch.id} 물건 이름은 서로 달라야 함`);
    for (const o of ch.objects) {
      assert.ok(o.name && typeof o.text === 'string' && o.text.length > 0, `${ch.id} 물건 ${o.slot}`);
      assert.ok(!/[.?!]\s+\S/.test(o.text), `물건 글은 한 줄 한 문장: ${o.text}`);
    }
    const hintCount = ch.npcs.filter((n) => n.chat.some((l) => l.text.includes('반짝'))).length;
    assert.ok(hintCount >= 1, `${ch.id}: 숨은 낱말 힌트를 말하는 인물이 없음`);
    assert.ok(ch.objects.some((o) => o.slot === ch.hidden.object), `${ch.id} hidden.object`);
    assert.ok(!ch.quests.some((q) => q.targets.includes(ch.hidden.object)), `${ch.id}: 숨은 낱말 물건은 부탁 대상이 아님`);
  }
});

test('부탁 대상이 맵에 있다: 물건 slot은 objects와 맵에, deliver 받는 이는 npcs에, chase면 맵에 m', () => {
  const ids = [];
  for (const ch of ACT.chapters) {
    const map = parseMap(ch.map.rows);
    const npcIds = ch.npcs.map((n) => n.id);
    const objSlots = ch.objects.map((o) => o.slot);
    for (const q of ch.quests) {
      ids.push(q.id);
      assert.ok(npcIds.includes(q.giver), `${q.id} giver`);
      assert.ok(q.title && q.title.length <= 20, `${q.id} 제목`);
      assert.ok(typeof q.goal === 'string' && q.goal.length > 0 && q.goal.length <= 20, `${q.id} 지금 할 일 한 줄(개수 덧붙임 여유 5자)`);
      assert.ok(Array.isArray(q.targets), `${q.id} targets`);
      if (['fetch', 'find', 'gather'].includes(q.kind)) {
        const n = q.kind === 'gather' ? q.targets.length : 1;
        assert.equal(q.targets.length, n);
        if (q.kind === 'gather') assert.ok(n >= 2 && n <= 3, `${q.id} 모으기 2~3곳`);
        assert.equal(new Set(q.targets).size, q.targets.length);
        for (const t of q.targets) {
          assert.ok(objSlots.includes(t), `${q.id}: 물건 ${t}가 objects에 없음`);
          assert.ok(map.objects[t], `${q.id}: 물건 ${t}가 맵에 없음`);
        }
      } else if (q.kind === 'deliver') {
        assert.equal(q.targets.length, 1);
        assert.ok(npcIds.includes(q.targets[0]), `${q.id}: 받는 이`);
        assert.notEqual(q.targets[0], q.giver);
      } else if (q.kind === 'chase') {
        assert.deepEqual(q.targets, []);
        assert.ok(map.smallMonster, `${q.id}: 맵에 m 없음`);
      } else assert.fail(`${q.id}: kind ${q.kind}`);
      // Ruling 1: fetch·find·gather·deliver는 item이 꼭 있다
      if (q.kind === 'chase') assert.equal(q.item, undefined, `${q.id}: chase에는 item 없음`);
      else {
        assert.ok(q.item && /^[a-z]+(-[a-z]+)*$/.test(q.item.id) && q.item.name, `${q.id}: item`);
      }
    }
    for (const o of ch.objects) {
      if (!o.item) continue;
      const q = ch.quests.find((x) => x.targets.includes(o.slot));
      assert.ok(q && ['fetch', 'find'].includes(q.kind), `물건 ${o.slot}의 item은 가져오기·찾기 대상에만`);
      assert.deepEqual(o.item, q.item, `물건 ${o.slot}의 item은 부탁 item과 같음`);
    }
  }
  assert.deepEqual(ids, ['q1', 'q2', 'q3', 'q4']);
  const items = ACT.chapters.flatMap((c) => c.quests).filter((q) => q.item).map((q) => q.item.id);
  assert.deepEqual(items, ['water', 'firewood', 'letter']);
});

test('맵: 32×24, 쓸 수 있는 글자만, 시작 1개, 1-1은 m만, 1-2는 M과 F, 아래 모서리 3×3 비움', () => {
  for (const ch of ACT.chapters) {
    const rows = ch.map.rows;
    assert.equal(rows.length, 24, `${ch.id} 행`);
    rows.forEach((r, y) => {
      assert.equal(r.length, 32, `${ch.id} 줄 ${y} 길이`);
      assert.match(r, /^[#.SFMma-e0-9]+$/, `${ch.id} 줄 ${y}에 쓸 수 없는 글자`);
    });
    for (const x of [0, 31]) for (let y = 0; y < 24; y++) assert.equal(rows[y][x], '#', `${ch.id} 테두리 (${x},${y})`);
    for (const y of [0, 23]) assert.equal(rows[y], '#'.repeat(32), `${ch.id} 테두리 줄 ${y}`);
    const map = parseMap(rows);
    assert.ok(map.start);
    const flat = rows.join('');
    const count = (c) => [...flat].filter((x) => x === c).length;
    if (ch.id === '1-1') {
      assert.equal(count('m'), 1); assert.equal(count('M'), 0); assert.equal(count('F'), 0);
    } else {
      assert.equal(count('M'), 1); assert.ok(count('F') >= 1); assert.equal(count('m'), 0);
    }
    for (let y = 21; y < 24; y++) {
      for (const x of [0, 1, 2, 29, 30, 31]) assert.ok('#.'.includes(rows[y][x]), `${ch.id} 모서리 (${x},${y})에 '${rows[y][x]}'`);
    }
  }
});

test('도달: 시작에서 모든 인물·물건·m 옆 칸에 닿고, M 옆 칸은 F가 열렸을 때만', () => {
  const near = (set, p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(`${p.x + dx},${p.y + dy}`));
  for (const ch of ACT.chapters) {
    const map = parseMap(ch.map.rows);
    const closed = reachable(map, map.start, {});
    for (const [slot, p] of Object.entries(map.slots)) assert.ok(near(closed, p), `${ch.id} 인물 ${slot}`);
    for (const [slot, p] of Object.entries(map.objects)) assert.ok(near(closed, p), `${ch.id} 물건 ${slot}`);
    if (map.smallMonster) {
      assert.ok(near(closed, map.smallMonster), `${ch.id} m`);
      const open = reachable(map, map.start, { smallMonsterGone: true });
      assert.ok(open.size > closed.size + 1, `${ch.id}: m이 아무 길도 막지 않음`);
    }
    if (map.boss) {
      assert.ok(!near(closed, map.boss), `${ch.id}: 안개가 닫혀도 M에 닿음`);
      assert.ok(map.fog.some((f) => near(closed, f)), `${ch.id}: 안개 문 앞에 닿지 못함`);
      assert.ok(near(reachable(map, map.start, { fogOpen: true }), map.boss), `${ch.id}: 안개가 열려도 M에 못 닿음`);
    }
  }
});

test('보스전 문제 10개: 보기 4개 서로 다름, 정답 하나, 예문과 다름, 유형 4·3·3', () => {
  const quizzes = ACT.bossQuizzes;
  assert.deepEqual(Object.keys(quizzes).sort(), [...ACT1_IDS].sort());
  const storyLines = new Set(ACT.chapters.flatMap((ch) => allLines(ch)).map((l) => shown(l.text)));
  for (const [type, ids] of Object.entries(QUIZ_TYPES)) {
    for (const id of ids) assert.equal(quizzes[id].type, type, `${id} 유형`);
  }
  for (const [id, q] of Object.entries(quizzes)) {
    const w = wordById[id];
    assert.ok(typeof q.prompt === 'string' && q.prompt.length > 0 && q.prompt.length <= 56, `${id} 문제 길이`);
    assert.equal(q.options.length, 4, id);
    assert.equal(new Set(q.options).size, 4, `${id} 보기 중복`);
    for (const o of q.options) assert.ok(typeof o === 'string' && o.length > 0 && o.length <= 32, `${id} 보기 길이: ${o}`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, id);
    const example = w.example.replace(/\.$/, '');
    for (const t of [q.prompt, ...q.options]) {
      assert.ok(!t.includes(example), `${id}: 예문을 그대로 씀: ${t}`);
      assert.ok(!storyLines.has(t), `${id}: 이야기 대사를 그대로 씀: ${t}`);
    }
    if (q.type === 'meaning') {
      assert.ok(q.prompt.includes(`'${id}'`), `${id} 뜻 문제에 낱말`);
      assert.equal(q.options[q.answer], w.meaning, `${id} 정답은 도감 뜻`);
    } else if (q.type === 'blank') {
      assert.equal((q.prompt.match(/___/g) || []).length, 1, `${id} 빈칸 하나`);
      assert.equal(q.options[q.answer], id, `${id} 정답 카드`);
      for (const o of q.options) assert.ok(ACT1_IDS.includes(o), `${id}: 보기 '${o}'는 1막 낱말 카드여야 함`);
    } else if (q.type === 'usage') {
      assert.ok(q.prompt.includes(`'${id}'`), `${id} 문장 문제에 낱말`);
      for (const o of q.options) assert.ok(o.includes(id), `${id}: 보기마다 낱말이 들어감: ${o}`);
    } else assert.fail(`${id}: type ${q.type}`);
  }
  const answers = Object.values(quizzes).map((q) => q.answer);
  assert.ok(new Set(answers).size >= 3, '정답 자리가 한쪽에 몰림');
});

test('모든 대사 줄은 닉네임 "가나다라마바"를 넣어도 56자 이하', () => {
  for (const ch of ACT.chapters) {
    for (const [label, lines] of lineGroups(ch)) {
      for (const l of lines) {
        const s = shown(l.text);
        assert.ok(s.length <= 56, `${label} (${s.length}자): ${s}`);
      }
    }
    for (const t of objectTexts(ch)) assert.ok(shown(t).length <= 56, `${ch.id} 물건 글: ${t}`);
  }
});
