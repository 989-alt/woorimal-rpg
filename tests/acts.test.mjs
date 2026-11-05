// 모든 막의 데이터 검사(설계 9절 1~12). 막마다 같은 검사를 돈다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';
import { ACTS } from '../data/acts/index.js';
import ENDING from '../data/ending.js';
import { parseMap, reachable } from '../js/explore/grid.js';
import { formatLine } from '../js/rules/josa.js';
import { newGame, exitOpen } from '../js/rules/game.js';
import {
  BUILT_ACTS, EXPECT, FACES, RESERVED, brackets, plain, shownText, lineGroups, allLines, gainedWordIds, questItemIds,
} from './lines.mjs';

const LONG_NAME = '가나다라마바';
const wordById = Object.fromEntries(WORDS.map((w) => [w.id, w]));
const actWordIds = (act) => WORDS.filter((w) => w.act === act.id).map((w) => w.id);
const objectTexts = (ch) => ch.objects.map((o) => o.text);
const near = (set, p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(`${p.x + dx},${p.y + dy}`));
const COMPANIONS = ['haesol', 'narae'];

test('ACTS는 만든 막(BUILT_ACTS)과 같다', () => {
  assert.deepEqual(ACTS.map((a) => a.id), BUILT_ACTS);
});

for (const act of ACTS) {
  const ids = actWordIds(act);

  test(`${act.id}막 머리: 제목·보스·작은 몬스터·장 id와 제목`, () => {
    const e = EXPECT.acts[act.id];
    assert.equal(act.title, e.title);
    assert.equal(act.boss.name, e.boss);
    assert.equal(act.small.name, e.small);
    if (act.id >= 2) assert.equal(act.travel, e.travel);
    assert.deepEqual(act.chapters.map((c) => c.id), [`${act.id}-1`, `${act.id}-2`]);
    assert.deepEqual(act.chapters.map((c) => c.title), e.chapters);
  });

  test(`${act.id}막 낱말: 장마다 부탁 2개 × 2 + 숨은 1, 두 장 합 = 그 막 10개`, () => {
    const all = [];
    for (const ch of act.chapters) {
      const a = EXPECT.chapters[ch.id];
      assert.equal(ch.quests.length, 2, ch.id);
      const words = [];
      for (const q of ch.quests) {
        const [giver, kind, qw] = a[q.id];
        assert.equal(q.giver, giver, q.id);
        assert.equal(q.kind, kind, q.id);
        assert.deepEqual(q.words, qw, q.id);
        words.push(...q.words);
      }
      assert.equal(ch.hidden.word, a.hidden[0], `${ch.id} 숨은 낱말`);
      assert.equal(ch.hidden.revealedBy, a.hidden[1], `${ch.id} 알려 주는 인물`);
      words.push(ch.hidden.word);
      assert.equal(new Set(words).size, 5, ch.id);
      all.push(...words);
    }
    assert.equal(new Set(all).size, 10);
    assert.deepEqual([...all].sort(), [...ids].sort());
  });

  test(`${act.id}막 [[ ]]: done·hidden.lines에서만, 부탁 낱말 둘을 한 번씩`, () => {
    for (const ch of act.chapters) {
      for (const [label, lines, where] of lineGroups(ch)) {
        for (const l of lines) {
          const found = brackets(l.text);
          if (where !== 'done') assert.deepEqual(found, [], `${label}: ${l.text}`);
          for (const w of found) assert.ok(wordById[w], `${label}: 없는 낱말 [[${w}]]`);
        }
      }
      for (const t of objectTexts(ch)) assert.deepEqual(brackets(t), [], t);
      for (const q of ch.quests) {
        const found = q.done.flatMap((l) => brackets(l.text));
        assert.deepEqual([...found].sort(), [...q.words].sort(), `${q.id}.done의 [[ ]]는 그 부탁 낱말 두 개, 한 번씩`);
      }
      assert.deepEqual(ch.hidden.lines.flatMap((l) => brackets(l.text)), [ch.hidden.word], `${ch.id} hidden`);
    }
  });

  test(`${act.id}막 대사 줄 모양: 말하는 이·표정·한 문장·56자·시작 글 3~5줄`, () => {
    for (const ch of act.chapters) {
      const npcIds = new Set(ch.npcs.map((n) => n.id));
      for (const [label, lines] of lineGroups(ch)) {
        assert.ok(Array.isArray(lines) && lines.length > 0, `${label} 비어 있음`);
        for (const l of lines) {
          assert.ok(['npc', 'hero', 'narration'].includes(l.who), `${label}: who ${l.who}`);
          assert.ok(typeof l.text === 'string' && l.text.trim() === l.text && l.text.length > 0, `${label}: text`);
          assert.ok(!/[.?!]["'”’]?\s+\S/.test(l.text), `${label}: 한 줄에 한 문장: ${l.text}`);
          assert.ok(!formatLine(l.text, LONG_NAME).includes('{'), `${label}: 바꾸지 못한 {}: ${l.text}`);
          const s = shownText(l.text);
          assert.ok(s.length <= 56, `${label} (${s.length}자): ${s}`);
          if (l.who === 'npc') {
            assert.ok(npcIds.has(l.npc), `${label}: 없는 인물 ${l.npc}`);
            if (l.face) assert.ok((FACES[l.npc] ?? FACES.other).includes(l.face), `${label}: ${l.npc} 표정 ${l.face}`);
          } else {
            assert.equal(l.npc, undefined, `${label}: ${l.who}에 npc`);
            if (l.who === 'hero' && l.face) assert.ok(FACES.hero.includes(l.face), `${label}: 주인공 표정 ${l.face}`);
            if (l.who === 'narration') assert.equal(l.face, undefined, `${label}: 해설에 표정`);
          }
        }
      }
      for (const t of objectTexts(ch)) assert.ok(shownText(t).length <= 56, `${ch.id} 물건 글: ${t}`);
      assert.ok(ch.intro.length >= 3 && ch.intro.length <= 5, `${ch.id} intro 3~5줄`);
    }
  });

  test(`${act.id}막 부탁 대사: offer {이름}, 말하는 이는 주는(받는) 인물이나 동료`, () => {
    for (const ch of act.chapters) {
      const companions = ch.npcs.filter((n) => n.companion).map((n) => n.id);
      for (const q of ch.quests) {
        assert.ok(q.offer.some((l) => l.text.includes('{이름')), `${q.id}.offer에 {이름…} 없음`);
        const speaker = q.kind === 'deliver' ? q.targets[0] : q.giver;
        const ok = (l, who) => l.who !== 'npc' || l.npc === who || companions.includes(l.npc);
        for (const l of q.offer) assert.ok(ok(l, q.giver), `${q.id}.offer: ${l.npc}`);
        for (const l of q.waiting) assert.ok(ok(l, q.giver), `${q.id}.waiting: ${l.npc}`);
        for (const l of q.done) assert.ok(ok(l, speaker), `${q.id}.done: ${l.npc}은 ${speaker}나 동료가 아님`);
        assert.ok(q.offer.some((l) => l.npc === q.giver), `${q.id}.offer에 ${q.giver}의 줄이 없음`);
        assert.ok(q.waiting.some((l) => l.npc === q.giver), `${q.id}.waiting에 ${q.giver}의 줄이 없음`);
        assert.ok(q.done.some((l) => l.npc === speaker), `${q.id}.done에 ${speaker}의 줄이 없음`);
      }
    }
  });

  test(`${act.id}막 인물: 3~5명, 칸 짝, 색, 동료·show·chatAfter`, () => {
    act.chapters.forEach((ch, i) => {
      const map = parseMap(ch.map.rows);
      const last = i === act.chapters.length - 1;
      assert.ok(ch.npcs.length >= 3 && ch.npcs.length <= 5, `${ch.id} 인물 3~5명`);
      assert.equal(new Set(ch.npcs.map((n) => n.id)).size, ch.npcs.length);
      assert.deepEqual(ch.npcs.map((n) => n.slot).sort(), Object.keys(map.slots).sort(), `${ch.id} 인물 칸`);
      const questIds = ch.quests.map((q) => q.id);
      for (const n of ch.npcs) {
        assert.ok(n.name && /^#[0-9A-F]{6}$/i.test(n.color), `${n.id} 이름·색`);
        const owner = RESERVED[n.color.toUpperCase()];
        if (owner) assert.equal(n.id, owner, `${ch.id} ${n.id}: 대표색은 ${owner}만`);
        const reservedColor = Object.keys(RESERVED).find((c) => RESERVED[c] === n.id);
        if (reservedColor) assert.equal(n.color.toUpperCase(), reservedColor, `${ch.id} ${n.id}: 대표색만 쓴다`);
        assert.equal(!!n.companion, COMPANIONS.includes(n.id), `${ch.id} ${n.id}: companion은 해솔·나래만, 나올 때마다`);
        if (n.show !== undefined) {
          assert.ok(['beforeBoss', 'afterBoss'].includes(n.show), `${n.id}.show ${n.show}`);
          assert.ok(last, `${ch.id} ${n.id}: show는 그 막 뒷 장에만`);
        }
        if (n.chatAfter) {
          assert.ok(questIds.includes(n.chatAfter.quest), `${n.id}.chatAfter.quest ${n.chatAfter.quest}`);
          assert.ok(Array.isArray(n.chatAfter.lines) && n.chatAfter.lines.length > 0, `${n.id}.chatAfter.lines`);
        }
      }
    });
  });

  test(`${act.id}막 물건: 칸 짝, 이름 서로 다름, 한 문장, item은 가져오기·찾기 대상에만`, () => {
    for (const ch of act.chapters) {
      const map = parseMap(ch.map.rows);
      assert.deepEqual(ch.objects.map((o) => o.slot).sort(), Object.keys(map.objects).sort(), `${ch.id} 물건 칸`);
      assert.equal(new Set(ch.objects.map((o) => o.name)).size, ch.objects.length, `${ch.id} 물건 이름은 서로 달라야 함`);
      for (const o of ch.objects) {
        assert.ok(o.name && typeof o.text === 'string' && o.text.length > 0, `${ch.id} 물건 ${o.slot}`);
        assert.ok(!/[.?!]\s+\S/.test(o.text), `물건 글은 한 줄 한 문장: ${o.text}`);
        if (!o.item) continue;
        const q = ch.quests.find((x) => x.targets.includes(o.slot));
        assert.ok(q && ['fetch', 'find'].includes(q.kind), `물건 ${o.slot}의 item은 가져오기·찾기 대상에만`);
        assert.deepEqual(o.item, q.item, `물건 ${o.slot}의 item은 부탁 item과 같음`);
      }
    }
  });

  test(`${act.id}막 부탁: 제목·goal 20자 이하, 대상이 데이터와 맵에, 쫓기가 있는 장에만 m`, () => {
    for (const ch of act.chapters) {
      const map = parseMap(ch.map.rows);
      const npcIds = ch.npcs.map((n) => n.id);
      const objSlots = ch.objects.map((o) => o.slot);
      for (const q of ch.quests) {
        assert.ok(npcIds.includes(q.giver), `${q.id} giver`);
        assert.ok(q.title && q.title.length <= 20, `${q.id} 제목`);
        assert.ok(typeof q.goal === 'string' && q.goal.length > 0 && q.goal.length <= 20, `${q.id} 지금 할 일 한 줄`);
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
        if (q.kind === 'chase') assert.equal(q.item, undefined, `${q.id}: chase에는 item 없음`);
        else assert.ok(q.item && /^[a-z]+(-[a-z]+)*$/.test(q.item.id) && q.item.name, `${q.id}: item`);
      }
      assert.equal(!!map.smallMonster, ch.quests.some((q) => q.kind === 'chase'), `${ch.id}: m은 쫓기 부탁이 있는 장에만`);
    }
  });

  test(`${act.id}막 숨은 낱말: 물건은 부탁 대상 아님, 알려 주는 인물, 힌트, revealGoal`, () => {
    for (const ch of act.chapters) {
      const h = ch.hidden;
      assert.ok(ch.objects.some((o) => o.slot === h.object), `${ch.id} hidden.object`);
      assert.ok(!ch.quests.some((q) => q.targets.includes(h.object)), `${ch.id}: 숨은 낱말 물건은 부탁 대상이 아님`);
      const who = ch.npcs.find((n) => n.id === h.revealedBy);
      assert.ok(who, `${ch.id}: revealedBy '${h.revealedBy}' 인물이 없음`);
      assert.ok((who.reveal ?? who.chat).some((l) => l.text.includes('반짝')), `${ch.id}: ${who.id}가 반짝임 힌트를 말함`);
      assert.ok(typeof h.revealGoal === 'string' && h.revealGoal.length > 0 && h.revealGoal.length <= 25, `${ch.id} revealGoal`);
      assert.ok(h.revealGoal.includes(who.name), `${ch.id}: revealGoal에 인물 이름`);
      // 1막 빨래터 아주머니는 q4를 주지만(설계 2절: 1막 데이터는 고치지 않는다), 2막부터는 알려 주는 인물이 부탁을 주지 않는다
      if (act.id >= 2) assert.ok(!ch.quests.some((q) => q.giver === who.id), `${ch.id}: 알려 주는 ${who.id}는 부탁을 주지 않음`);
    }
  });

  test(`${act.id}막 맵: 32×24, 쓸 수 있는 글자, 테두리, 모서리, 앞 장 M·F 없음, 뒷 장 M 하나·F`, () => {
    act.chapters.forEach((ch, i) => {
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
      assert.equal(count('S'), 1);
      if (i < act.chapters.length - 1) {
        assert.equal(count('M'), 0, `${ch.id}: 앞 장에 M`);
        assert.equal(count('F'), 0, `${ch.id}: 앞 장에 F`);
      } else {
        assert.equal(count('M'), 1, `${ch.id}: 뒷 장 M`);
        assert.ok(count('F') >= 1, `${ch.id}: 뒷 장 F`);
      }
      for (let y = 21; y < 24; y++) {
        for (const x of [0, 1, 2, 29, 30, 31]) assert.ok('#.'.includes(rows[y][x]), `${ch.id} 모서리 (${x},${y})에 '${rows[y][x]}'`);
      }
    });
  });

  test(`${act.id}막 도달: 시작에서 모든 인물·물건·m 옆 칸에 닿고, M 옆 칸은 안개가 열렸을 때만`, () => {
    for (const ch of act.chapters) {
      const map = parseMap(ch.map.rows);
      const closed = reachable(map, map.start, {});
      const afterBossOpen = reachable(map, map.start, { fogOpen: true, smallMonsterGone: true });
      for (const n of ch.npcs) {
        const set = n.show === 'afterBoss' ? afterBossOpen : closed;
        assert.ok(near(set, map.slots[n.slot]), `${ch.id} 인물 ${n.id}`);
      }
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

  test(`${act.id}막 출구: 길 칸, 가리키는 쪽은 맵 끝까지 벽, 다 열리면 닿음, 뒷 장은 보스를 이겨야 열림`, () => {
    const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    act.chapters.forEach((ch, i) => {
      const e = ch.exit;
      assert.ok(e, `${ch.id}: exit`);
      const map = parseMap(ch.map.rows);
      assert.ok(Number.isInteger(e.x) && Number.isInteger(e.y), `${ch.id} exit 칸`);
      assert.equal(map.tileAt(e.x, e.y), '.', `${ch.id}: 출구는 길 칸`);
      assert.ok(e.dir in STEP, `${ch.id}: dir`);
      const [dx, dy] = STEP[e.dir];
      for (let x = e.x + dx, y = e.y + dy; x >= 0 && y >= 0 && x < map.w && y < map.h; x += dx, y += dy) {
        assert.equal(map.tileAt(x, y), '#', `${ch.id}: 출구에서 ${e.dir} 쪽 (${x},${y})은 벽`);
      }
      assert.ok(typeof e.goal === 'string' && e.goal.length > 0 && e.goal.length <= 25, `${ch.id} exit.goal`);
      const opts = { fogOpen: true, smallMonsterGone: true, bossGone: true };
      assert.ok(reachable(map, map.start, opts).has(`${e.x},${e.y}`), `${ch.id}: 출구에 닿지 못함`);
      if (i === act.chapters.length - 1) {
        const s = { ...newGame({ nickname: '하늘', avatar: 'f' }), chapter: ch.id, clearedActs: [] };
        assert.equal(exitOpen(s, ch), false, `${ch.id}: 보스를 이기기 전에는 출구가 닫힘`);
        assert.equal(exitOpen({ ...s, clearedActs: [act.id] }, ch), true, `${ch.id}: 보스를 이기면 출구가 열림`);
      }
    });
  });

  test(`${act.id}막 보스전 문제 10개: 유형, 보기 4개, 정답 하나, 예문·대사와 다름`, () => {
    const quizzes = act.bossQuizzes;
    assert.deepEqual(Object.keys(quizzes).sort(), [...ids].sort());
    const storyLines = new Set(act.chapters.flatMap((ch) => allLines(ch)).map((l) => shownText(l.text)));
    const types = EXPECT.quizTypes[act.id];
    for (const [type, list] of Object.entries(types)) {
      for (const id of list) assert.equal(quizzes[id].type, type, `${id} 유형`);
    }
    assert.equal(Object.values(types).flat().length, 10);
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
        for (const o of q.options) assert.ok(ids.includes(o), `${id}: 보기 '${o}'는 ${act.id}막 낱말 카드여야 함`);
      } else if (q.type === 'usage') {
        assert.ok(q.prompt.includes(`'${id}'`), `${id} 문장 문제에 낱말`);
        for (const o of q.options) assert.ok(o.includes(id), `${id}: 보기마다 낱말이 들어감: ${o}`);
      } else assert.fail(`${id}: type ${q.type}`);
    }
    const answers = Object.values(quizzes).map((q) => q.answer);
    assert.ok(new Set(answers).size >= 3, '정답 자리가 한쪽에 몰림');
  });
}

test('낱말은 게임 차례대로 한 번씩 얻고, 얻기 전에는 어떤 글에도 맨글자로 나오지 않는다', () => {
  // 막을 넘어 이어서 본다. '윤슬내'는 지우고 보고, 이름 '나래'는 뺀다. afterBoss는 그 장 낱말을 써도 된다.
  const later = new Set(WORDS.map((w) => w.id).filter((id) => id !== '나래'));
  const bare = (t) => plain(t).replaceAll('윤슬내', '');
  const check = (label, text) => {
    for (const w of later) assert.ok(!bare(text).includes(w), `${label}: '${w}'가 [[ ]] 없이 먼저 나옴: ${text}`);
  };
  for (const act of ACTS) {
    for (const ch of act.chapters) {
      const mine = [...ch.quests.flatMap((q) => q.words), ch.hidden.word];
      for (const [label, lines, where] of lineGroups(ch)) {
        if (where === 'after') continue;
        for (const l of lines) check(label, l.text);
      }
      for (const o of ch.objects) { check(`${ch.id} 물건 이름`, o.name); check(`${ch.id} 물건 글`, o.text); }
      for (const q of ch.quests) { check(`${q.id} 제목`, q.title); check(`${q.id} goal`, q.goal); }
      check(`${ch.id} revealGoal`, ch.hidden.revealGoal);
      for (const w of mine) later.delete(w);
      check(`${ch.id} exit.goal`, ch.exit.goal);
      if (ch.exit.won) check(`${ch.id} exit.won`, ch.exit.won);
      if (ch.exit.closed) check(`${ch.id} exit.closed`, ch.exit.closed);
      for (const [label, lines, where] of lineGroups(ch)) {
        if (where !== 'after') continue;
        for (const l of lines) check(label, l.text);
      }
    }
  }
  const built = WORDS.filter((w) => BUILT_ACTS.includes(w.act)).map((w) => w.id);
  assert.deepEqual(gainedWordIds().sort(), built.sort(), '만든 막의 낱말을 정확히 한 번씩');
});

test('인물: 같은 id는 모든 장에서 같은 이름·색', () => {
  const seen = new Map();
  for (const act of ACTS) {
    for (const ch of act.chapters) {
      for (const n of ch.npcs) {
        const prev = seen.get(n.id);
        if (prev) assert.deepEqual({ name: n.name, color: n.color }, prev, `${ch.id} ${n.id}`);
        else seen.set(n.id, { name: n.name, color: n.color });
      }
    }
  }
});

test('부탁 id는 q1부터 빈틈없이 차례대로, 물건 id는 게임 전체에서 하나씩', () => {
  const qs = ACTS.flatMap((a) => a.chapters.flatMap((c) => c.quests.map((q) => q.id)));
  assert.deepEqual(qs, Array.from({ length: qs.length }, (_, i) => `q${i + 1}`));
  const items = questItemIds();
  assert.deepEqual(items, EXPECT.items.slice(0, items.length));
  assert.equal(new Set(items).size, items.length);
});

test('게임 전체: 막 1~5, 낱말 50개를 한 번씩, 부탁 q1~q20, 물건 15개', () => {
  assert.deepEqual(ACTS.map((a) => a.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(gainedWordIds().sort(), WORDS.map((w) => w.id).sort()); // gainedWordIds: done·hidden.lines의 [[ ]] id(중복 포함)
  assert.deepEqual(ACTS.flatMap((a) => a.chapters.flatMap((c) => c.quests.map((q) => q.id))), Array.from({ length: 20 }, (_, i) => `q${i + 1}`));
  assert.deepEqual(questItemIds(), EXPECT.items);
});

test('5막: 나래는 마지막 문제(빈칸)이고 finalCue가 있다', () => {
  const act5 = ACTS[4];
  assert.equal(act5.finalWordId, '나래');
  assert.equal(act5.bossQuizzes['나래'].type, 'blank');
  assert.equal(act5.bossQuizzes['나래'].prompt, '아기 새가 처음으로 ___를 펴고 둥지를 떠났다.');
  assert.equal(act5.finalCue, '그림자 한가운데에서 하늘색 망토 자락이 희미하게 펄럭인다.');
});

test('엔딩: cast가 말하는 인물을 덮고, 줄 규칙, [[ ]] 없음, 마지막 말', () => {
  // cast의 id·name·color는 막 데이터의 같은 id와 같다.
  const npcs = new Map(ACTS.flatMap((a) => a.chapters.flatMap((c) => c.npcs)).map((n) => [n.id, n]));
  for (const c of ENDING.cast) {
    const n = npcs.get(c.id);
    assert.ok(n, `cast ${c.id}가 막 데이터에 없음`);
    assert.deepEqual({ name: c.name, color: c.color }, { name: n.name, color: n.color }, `cast ${c.id}`);
  }
  const castIds = new Set(ENDING.cast.map((c) => c.id));
  assert.equal(castIds.size, ENDING.cast.length);
  assert.equal(ENDING.scenes.length, 8);
  const chapterIds = ACTS.flatMap((a) => a.chapters.map((c) => c.id));
  ENDING.scenes.forEach((sc, i) => {
    assert.ok(['ending01', 'ending02', 'ending03'].includes(sc.bg) || chapterIds.includes(sc.bg), `장면 ${i + 1} bg ${sc.bg}`);
    assert.equal(sc.still === true, i === ENDING.scenes.length - 1, `still은 마지막 장면에만 (장면 ${i + 1})`);
    assert.ok(Array.isArray(sc.lines) && sc.lines.length > 0, `장면 ${i + 1} 줄`);
    for (const l of sc.lines) {
      assert.ok(['npc', 'hero', 'narration'].includes(l.who), l.text);
      assert.ok(typeof l.text === 'string' && l.text.trim() === l.text && l.text.length > 0, l.text);
      assert.deepEqual(brackets(l.text), [], `엔딩에는 [[ ]]가 없음: ${l.text}`);
      assert.ok(!/[.?!]["'”’]?\s+\S/.test(l.text), `한 줄에 한 문장: ${l.text}`);
      assert.ok(!formatLine(l.text, LONG_NAME).includes('{'), `바꾸지 못한 {}: ${l.text}`);
      assert.ok(shownText(l.text).length <= 56, `56자 초과: ${l.text}`);
      if (l.who === 'npc') {
        assert.ok(castIds.has(l.npc), `cast에 없는 인물 ${l.npc}`);
        if (l.face) assert.ok((FACES[l.npc] ?? FACES.other).includes(l.face), `${l.npc} 표정 ${l.face}`);
      } else {
        assert.equal(l.npc, undefined);
        if (l.who === 'hero' && l.face) assert.ok(FACES.hero.includes(l.face), `주인공 표정 ${l.face}`);
        if (l.who === 'narration') assert.equal(l.face, undefined);
      }
    }
  });
  assert.equal(ENDING.message, '우리가 쓰면 말은 살아난다.');
});

test('엔딩 되찾은 마을들(장면 2~5): 2~5막 차례, 그 막 장 배경, 해설로 시작, 그 막 주민 2~3명이 그 막 낱말을 쓴다', () => {
  const montage = ENDING.scenes.slice(1, 5);
  const companions = new Set(['haesol', 'narae']);
  montage.forEach((sc, k) => {
    const act = ACTS[k + 1];
    assert.ok(act.chapters.some((c) => c.id === sc.bg), `${act.id}막 장면 bg ${sc.bg}`);
    assert.equal(sc.lines[0].who, 'narration', `${act.id}막 장면은 해설로 시작`);
    const actNpcs = new Set(act.chapters.flatMap((c) => c.npcs.map((n) => n.id)));
    const residents = sc.lines.filter((l) => l.who === 'npc' && !companions.has(l.npc));
    assert.ok(residents.length >= 2 && residents.length <= 3, `${act.id}막 주민 ${residents.length}명`);
    assert.equal(new Set(residents.map((l) => l.npc)).size, residents.length, `${act.id}막 주민은 한 줄씩`);
    for (const l of residents) assert.ok(actNpcs.has(l.npc), `${l.npc}는 ${act.id}막 인물`);
    const actWordForms = WORDS.filter((w) => w.act === act.id).map((w) => w.word.replace(/하다$|다$/, ''));
    for (const l of residents) assert.ok(actWordForms.some((stem) => l.text.includes(stem)), `${act.id}막 낱말을 쓴다: ${l.text}`);
    assert.ok(sc.lines.filter((l) => l.who === 'npc' && companions.has(l.npc)).length <= 1, '동료 줄은 많아야 하나');
  });
  assert.equal(ENDING.scenes[4].warm, true, '잿빛 탑 장면은 따뜻한 빛깔로');
  assert.equal(formatLine(ENDING.thanks, '하늘'), '하늘아, 끝까지 함께해 줘서 고마워!');
});
