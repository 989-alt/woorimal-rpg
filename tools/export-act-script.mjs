// 막 대본을 선생님 확인용 Markdown으로 뽑는다.
// 쓰는 법: node tools/export-act-script.mjs [막 번호=1] [닉네임=하늘]
//   → docs/review/act<번호>-script.md
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORDS } from '../data/words.js';
import { formatLine, attachJosa } from '../js/rules/josa.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const actNo = Number(process.argv[2] ?? 1);
const nickname = process.argv[3] ?? '하늘';
const { default: ACT } = await import(`../data/acts/act${actNo}.js`);

const KIND = { fetch: '가져오기', gather: '모으기', deliver: '전하기', find: '찾기', chase: '그림자 쫓기' };
const TYPE = { meaning: '뜻 고르기', blank: '빈칸 채우기', usage: '알맞게 쓴 문장 고르기' };
const FACE = { base: '', joy: '기쁨', surprise: '놀람', worry: '걱정', laugh: '웃음' };
const wordById = Object.fromEntries(WORDS.map((w) => [w.id, w]));

const text = (t) => formatLine(t, nickname).replace(/\[\[(.+?)\]\]/g, '**$1**');

function lines(ch, list) {
  const name = (id) => ch.npcs.find((n) => n.id === id)?.name ?? id;
  return list.map((l) => {
    const face = l.face && FACE[l.face] ? ` (${FACE[l.face]})` : '';
    if (l.who === 'narration') return `- *(해설)* ${text(l.text)}`;
    const who = l.who === 'hero' ? `주인공(${nickname})` : name(l.npc);
    return `- **${who}**${face}: ${text(l.text)}`;
  }).join('\n');
}

const out = [];
out.push(`# ${ACT.id}막 「${ACT.title}」 대본 (선생님 확인용)`);
out.push('');
out.push(`> \`node tools/export-act-script.mjs ${actNo}\`로 \`data/acts/act${actNo}.js\`에서 뽑은 글입니다. 고칠 곳은 이 파일이 아니라 데이터 파일에서 고칩니다.`);
out.push(`> 주인공 닉네임은 예시로 '${nickname}'을 넣었습니다(조사는 닉네임 받침에 맞게 바뀝니다). **굵은 글씨**는 금빛 띠로 강조되며 처음 나와 도감에 들어가는 낱말입니다.`);
out.push('');
out.push(`막 보스: ${ACT.boss.name} · 작은 몬스터: ${ACT.small.name}`);
out.push('');
out.push('## 이 막의 낱말');
out.push('');
out.push('| 낱말 | 뜻 | 도감 예문 | 얻는 곳 |');
out.push('|---|---|---|---|');
for (const ch of ACT.chapters) {
  for (const q of ch.quests) {
    for (const w of q.words) out.push(`| ${w} | ${wordById[w].meaning} | ${wordById[w].example} | ${ch.id} ${q.title} |`);
  }
  const hw = ch.hidden.word;
  const obj = ch.objects.find((o) => o.slot === ch.hidden.object);
  out.push(`| ${hw} | ${wordById[hw].meaning} | ${wordById[hw].example} | ${ch.id} 숨은 낱말(${obj.name}) |`);
}
out.push('');

for (const ch of ACT.chapters) {
  out.push(`## ${ch.id} ${ch.title}`);
  out.push('');
  out.push(`인물: ${ch.npcs.map((n) => n.name).join(', ')}`);
  out.push('');
  out.push('### 시작 글');
  out.push('');
  out.push(lines(ch, ch.intro));
  out.push('');
  ch.quests.forEach((q, i) => {
    const giver = ch.npcs.find((n) => n.id === q.giver).name;
    out.push(`### 부탁 ${i + 1}: ${q.title}`);
    out.push('');
    let how = `${giver} · ${KIND[q.kind]}`;
    if (q.kind === 'deliver') how += ` · ${attachJosa(q.item.name, '을')} ${ch.npcs.find((n) => n.id === q.targets[0]).name}께`;
    else if (q.targets.length) how += ` · 조사할 곳: ${q.targets.map((s) => ch.objects.find((o) => o.slot === s).name).join(', ')}`;
    else if (q.kind === 'chase') how += ` · ${ACT.small.name}와 복습전`;
    if (q.item && q.kind !== 'deliver') how += ` · 얻는 물건: ${q.item.name}`;
    out.push(`${how} · 낱말: ${q.words.join(', ')}`);
    out.push('');
    out.push('**부탁할 때**');
    out.push('');
    out.push(lines(ch, q.offer));
    out.push('');
    out.push('**일하는 중에 다시 말을 걸면**');
    out.push('');
    out.push(lines(ch, q.waiting));
    out.push('');
    out.push(q.kind === 'deliver' ? '**받는 사람에게 전하면 (완료)**' : '**돌아가 보고하면 (완료)**');
    out.push('');
    out.push(lines(ch, q.done));
    out.push('');
  });
  const obj = ch.objects.find((o) => o.slot === ch.hidden.object);
  out.push(`### 숨은 낱말: ${ch.hidden.word} (${obj.name})`);
  out.push('');
  out.push(lines(ch, ch.hidden.lines));
  out.push('');
  out.push('### 부탁과 상관없을 때 하는 말');
  out.push('');
  for (const n of ch.npcs) {
    out.push(`**${n.name}**`);
    out.push('');
    out.push(lines(ch, n.chat));
    out.push('');
  }
  out.push('### 물건을 조사하면 (부탁과 상관없을 때)');
  out.push('');
  for (const o of ch.objects) out.push(`- **${o.name}**: ${text(o.text)}`);
  out.push('');
}

out.push(`## 막 보스전: ${ACT.boss.name}`);
out.push('');
out.push('보기 순서는 전투에서 섞여 나옵니다. **(정답)** 표시가 정답입니다.');
out.push('');
Object.entries(ACT.bossQuizzes).forEach(([id, q], i) => {
  out.push(`${i + 1}. **${id}** · ${TYPE[q.type]}  `);
  out.push(`   ${q.prompt}`);
  q.options.forEach((o, k) => out.push(`   - ${o}${k === q.answer ? ' **(정답)**' : ''}`));
  out.push('');
});

const file = resolve(root, `docs/review/act${actNo}-script.md`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, out.join('\n'));
console.log(`wrote ${file}`);
