// 선생님 확인용 대본 Markdown을 만든다(파일을 쓰지 않는 순수 함수). 쓰는 곳: tools/export-act-script.mjs
//   actScriptMd(act, nickname)       → 막 하나의 대본
//   endingScriptMd(ending, nickname) → 엔딩 대본(장면, 마지막 말, 말빛 주머니, 마무리 퀴즈, 만든 이)
import { WORDS } from '../data/words.js';
import { ACTS } from '../data/acts/index.js';
import { REVIEW_SITUATIONS, CLOSE_WORDS } from '../data/review-quiz.js';
import { formatLine, attachJosa } from '../js/rules/josa.js';
import { wordMark } from '../js/rules/game.js';
import { QUIZ_TYPES, QUIZ_SIZE } from '../js/rules/review-quiz.js';

const KIND = { fetch: '가져오기', gather: '모으기', deliver: '전하기', find: '찾기', chase: '그림자 쫓기' };
const TYPE = { meaning: '뜻 고르기', blank: '빈칸 채우기', usage: '알맞게 쓴 문장 고르기' };
const FACE = { base: '', joy: '기쁨', surprise: '놀람', worry: '걱정', laugh: '웃음', pout: '뾰로통', sad: '쓸쓸함', light: '빛' };
const SHOW = { beforeBoss: '(보스를 이기기 전에만 보임)', afterBoss: '(보스를 이긴 뒤에만 보임)' };
const wordById = Object.fromEntries(WORDS.map((w) => [w.id, w]));

// 조사만 돌려준다(받침에 맞게). 예: josaOf('전하기', '을') → '를'
const josaOf = (word, kind) => attachJosa(word, kind).slice(word.length);

const textOf = (nickname) => (t) =>
  formatLine(t, nickname).replace(/\[\[(.+?)\]\]/g, (_, inner) => `**${wordMark(inner).form}**`);

// 대사 줄 목록 → Markdown 목록. nameOf(npc id) → 이름
function linesMd(list, nameOf, nickname) {
  const text = textOf(nickname);
  return list.map((l) => {
    const face = l.face && FACE[l.face] ? ` (${FACE[l.face]})` : '';
    if (l.who === 'narration') return `- *(해설)* ${text(l.text)}`;
    const who = l.who === 'hero' ? `주인공(${nickname})` : nameOf(l.npc);
    return `- **${who}**${face}: ${text(l.text)}`;
  }).join('\n');
}

function personLabel(n) {
  let s = n.name;
  if (n.companion) s += '(동료)';
  if (n.show) s += ` ${SHOW[n.show]}`;
  return s;
}

export function actScriptMd(act, nickname = '하늘') {
  const text = textOf(nickname);
  const quests = act.chapters.flatMap((c) => c.quests);
  const out = [];
  out.push(`# ${act.id}막 「${act.title}」 대본 (선생님 확인용)`);
  out.push('');
  out.push(`> \`node tools/export-act-script.mjs ${act.id}\`로 \`data/acts/act${act.id}.js\`에서 뽑은 글입니다. 고칠 곳은 이 파일이 아니라 데이터 파일에서 고칩니다.`);
  out.push(`> 주인공 닉네임은 예시로 '${nickname}'을 넣었습니다(조사는 닉네임 받침에 맞게 바뀝니다). **굵은 글씨**는 금빛 띠로 강조되며 처음 나와 도감에 들어가는 낱말입니다.`);
  out.push('');
  out.push(`막 보스: ${act.boss.name} · 작은 몬스터: ${act.small.name}`);
  out.push('');
  if (act.travel) {
    out.push(`세계 지도 카드: ${act.travel}`);
    out.push('');
  }
  out.push('## 이 막의 낱말');
  out.push('');
  out.push('| 낱말 | 뜻 | 도감 예문 | 얻는 곳 |');
  out.push('|---|---|---|---|');
  for (const ch of act.chapters) {
    for (const q of ch.quests) {
      for (const w of q.words) out.push(`| ${w} | ${wordById[w].meaning} | ${wordById[w].example} | ${ch.id} ${q.title} |`);
    }
    const hw = ch.hidden.word;
    const obj = ch.objects.find((o) => o.slot === ch.hidden.object);
    out.push(`| ${hw} | ${wordById[hw].meaning} | ${wordById[hw].example} | ${ch.id} 숨은 낱말(${obj.name}) |`);
  }
  out.push('');

  for (const ch of act.chapters) {
    const nameOf = (id) => ch.npcs.find((n) => n.id === id)?.name ?? id;
    const lines = (list) => linesMd(list, nameOf, nickname);
    out.push(`## ${ch.id} ${ch.title}`);
    out.push('');
    out.push(`인물: ${ch.npcs.map(personLabel).join(', ')}`);
    out.push('');
    out.push('### 시작 글');
    out.push('');
    out.push(lines(ch.intro));
    out.push('');
    ch.quests.forEach((q, i) => {
      out.push(`### 부탁 ${i + 1}: ${q.title}`);
      out.push('');
      let how = `${nameOf(q.giver)} · ${KIND[q.kind]}`;
      if (q.kind === 'deliver') {
        const to = ch.npcs.find((n) => n.id === q.targets[0]);
        how += ` · ${attachJosa(q.item.name, '을')} ${to.name}${to.honorific ? '께' : '에게'}`; // 께는 어르신께만
      }
      else if (q.targets.length) how += ` · 조사할 곳: ${q.targets.map((s) => ch.objects.find((o) => o.slot === s).name).join(', ')}`;
      else if (q.kind === 'chase') how += ` · ${act.small.name}와 복습전`;
      if (q.item && q.kind !== 'deliver') how += ` · 얻는 물건: ${q.item.name}`;
      out.push(`${how} · 낱말: ${q.words.join(', ')}`);
      out.push('');
      out.push('**부탁할 때**');
      out.push('');
      out.push(lines(q.offer));
      out.push('');
      out.push('**일하는 중에 다시 말을 걸면**');
      out.push('');
      out.push(lines(q.waiting));
      out.push('');
      out.push(q.kind === 'deliver' ? '**받는 사람에게 전하면 (완료)**' : '**돌아가 보고하면 (완료)**');
      out.push('');
      out.push(lines(q.done));
      out.push('');
    });
    const obj = ch.objects.find((o) => o.slot === ch.hidden.object);
    out.push(`### 숨은 낱말: ${ch.hidden.word} (${obj.name})`);
    out.push('');
    if (ch.hidden.revealedBy) {
      out.push(`알려 주는 인물: ${nameOf(ch.hidden.revealedBy)}`);
      out.push('');
    }
    out.push(lines(ch.hidden.lines));
    out.push('');
    if (ch.afterBoss) {
      out.push('### 보스를 이긴 뒤 한 번 나오는 장면');
      out.push('');
      out.push(lines(ch.afterBoss));
      out.push('');
    }
    out.push('### 부탁과 상관없을 때 하는 말');
    out.push('');
    for (const n of ch.npcs) {
      out.push(`**${n.name}**`);
      out.push('');
      out.push(lines(n.chat));
      out.push('');
      // 숨은 낱말을 알려 주는 인물의 따로 둔 대사(없으면 chat이 알려 주는 대사)
      if (n.reveal) {
        out.push(`**${n.name}** (숨은 낱말을 처음 알려 줄 때)`);
        out.push('');
        out.push(lines(n.reveal));
        out.push('');
      }
      if (n.after) {
        out.push(`**${n.name}** (숨은 낱말을 알려 준 뒤)`);
        out.push('');
        out.push(lines(n.after));
        out.push('');
      }
      if (n.chatAfter) {
        const q = quests.find((x) => x.id === n.chatAfter.quest);
        out.push(`**${n.name}** (부탁 「${q.title}」${josaOf(q.title, '을')} 끝낸 뒤)`);
        out.push('');
        out.push(lines(n.chatAfter.lines));
        out.push('');
      }
    }
    out.push('### 물건을 조사하면 (부탁과 상관없을 때)');
    out.push('');
    for (const o of ch.objects) out.push(`- **${o.name}**: ${text(o.text)}`);
    out.push('');
  }

  out.push(`## 막 보스전: ${act.boss.name}`);
  out.push('');
  out.push('보기 순서는 전투에서 섞여 나옵니다. **(정답)** 표시가 정답입니다.');
  out.push('');
  // finalWordId 문제는 전투에서 늘 마지막에 나오므로 목록에서도 맨 끝에 둔다.
  const entries = Object.entries(act.bossQuizzes);
  const ordered = [...entries.filter(([id]) => id !== act.finalWordId), ...entries.filter(([id]) => id === act.finalWordId)];
  ordered.forEach(([id, q], i) => {
    const last = id === act.finalWordId ? ' (늘 마지막 문제)' : '';
    out.push(`${i + 1}. **${id}** · ${TYPE[q.type]}${last}  `);
    out.push(`   ${q.prompt}`);
    q.options.forEach((o, k) => out.push(`   - ${o}${k === q.answer ? ' **(정답)**' : ''}`));
    out.push('');
  });
  if (act.finalCue) {
    out.push(`마지막 문제 앞에 나오는 한 줄: *${act.finalCue}*`);
    out.push('');
  }
  return out.join('\n');
}

// 엔딩 장면의 bg: 엔딩 그림 키(ending01~03) 또는 장 id(그 장의 대화 배경 그림)
function bgLabel(scene) {
  const ch = ACTS.flatMap((a) => a.chapters).find((c) => c.id === scene.bg);
  let s = `배경: ${scene.bg}`;
  if (ch) s += ` (${ch.id} 「${ch.title}」의 대화 배경 그림)`;
  if (scene.warm) s += ' (새벽빛으로 물든 그림)';
  if (scene.still) s += ' (한 장 그림, 상반신 없음)';
  return s;
}

export function endingScriptMd(ending, nickname = '하늘') {
  const text = textOf(nickname);
  const nameOf = (id) => ending.cast.find((c) => c.id === id)?.name ?? id;
  const out = [];
  out.push('# 엔딩 대본 (선생님 확인용)');
  out.push('');
  out.push('> `node tools/export-act-script.mjs ending`으로 `data/ending.js`와 `data/review-quiz.js`에서 뽑은 글입니다. 고칠 곳은 이 파일이 아니라 데이터 파일에서 고칩니다.');
  out.push(`> 주인공 닉네임은 예시로 '${nickname}'을 넣었습니다(조사는 닉네임 받침에 맞게 바뀝니다).`);
  out.push('');
  out.push(`5막 보스를 이긴 뒤 5-2 출구로 나가면 "엔딩 보기"로 들어옵니다. 차례: 장면 ${ending.scenes.length}개 → 마지막 말 → 말빛 주머니 → 마무리 퀴즈 → 만든 이.`);
  out.push('장면 2~5는 색과 말을 되찾은 마을들입니다(선생님 요청).');
  out.push('');
  ending.scenes.forEach((scene, i) => {
    out.push(`## 장면 ${i + 1}`);
    out.push('');
    out.push(bgLabel(scene));
    out.push('');
    out.push(linesMd(scene.lines, nameOf, nickname));
    out.push('');
  });

  out.push('## 마지막 말');
  out.push('');
  out.push('한지 패널 가운데에 크게 한 줄만 띄웁니다. 2초 뒤 "다음" 버튼이 나옵니다(저절로 넘어가지 않습니다).');
  out.push('');
  out.push(`> ${text(ending.message)}`);
  out.push('');

  out.push('## 말빛 주머니');
  out.push('');
  out.push(`제목: ${nickname}의 말빛 주머니 ${WORDS.length}/${WORDS.length}`);
  out.push('');
  out.push('막마다 한 줄에 낱말 카드 10장이 놓이고, 카드를 누르면 옆 칸에 뜻·예문·만난 곳이 나옵니다. 버튼: "마무리 퀴즈"');
  out.push('');
  for (const act of ACTS) {
    out.push(`- ${act.id}막 ${act.title}: ${WORDS.filter((w) => w.act === act.id).map((w) => w.word).join(', ')}`);
  }
  out.push('');

  out.push('## 마무리 퀴즈');
  out.push('');
  out.push(`낱말 ${WORDS.length}개 가운데 ${QUIZ_SIZE}개를 무작위로 골라 뜻 고르기 ${QUIZ_TYPES.meaning}문제, 초성 ${QUIZ_TYPES.chosung}문제, 상황 빈칸 ${QUIZ_TYPES.situation}문제를 섞어 냅니다. 하트·시간 제한은 없습니다. 처음 화면의 "마무리 퀴즈" 버튼으로도 다시 풀 수 있습니다(엔딩을 본 저장이 있을 때).`);
  out.push('');
  out.push(`- **뜻 고르기**: "'낱말'의 뜻은?" 보기 넷 가운데 하나는 그 낱말 뜻, 셋은 다른 낱말 뜻입니다.`);
  out.push('- **초성**: 초성 글자(예: ㅇㅅㄹ)와 뜻을 보고 낱말을 직접 칩니다.');
  out.push('- **상황 빈칸**: 아래 문장의 빈칸에 들어갈 낱말을 넷 가운데 고릅니다. 오답 보기에는 뜻이 가까운 낱말(맨 아래 묶음)을 넣지 않고, 하나는 다른 막 낱말입니다.');
  out.push('');
  out.push('끝나면 "10문제 중 n개 맞힘"과 낱말별 ○/×, 틀린 낱말의 뜻이 나오고 "다시 풀기"·"계속" 버튼이 있습니다.');
  out.push('');
  out.push('### 상황 빈칸 문장 (낱말마다 하나, 굵은 글씨가 빈칸에 들어가는 꼴)');
  out.push('');
  for (const act of ACTS) {
    out.push(`**${act.id}막 ${act.title}**`);
    out.push('');
    for (const s of REVIEW_SITUATIONS.filter((x) => wordById[x.word].act === act.id)) {
      out.push(`- ${s.word}: ${s.situation} → **${s.answerForm ?? s.word}**`);
    }
    out.push('');
  }
  out.push('### 뜻이 가까워 서로 오답 보기로 내지 않는 낱말 묶음');
  out.push('');
  for (const g of CLOSE_WORDS) out.push(`- ${g.join(', ')}`);
  out.push('');

  out.push('## 만든 이');
  out.push('');
  for (const c of ending.credits) {
    out.push(`**${c.title}**`);
    out.push('');
    for (const l of c.lines) out.push(`- ${text(l)}`);
    out.push('');
  }
  out.push(`인사: ${text(ending.thanks)}`);
  out.push('');
  out.push('버튼: "처음 화면으로"');
  out.push('');
  return out.join('\n');
}
