// 학생이 읽는 모든 글(낱말, 막·엔딩 대본, 튜토리얼 안내, 마무리 퀴즈 문장)을 한 파일로 모은다(검수용).
// 먼저 `node tools/export-act-script.mjs all`로 막·엔딩 대본을 만든 뒤 쓴다.
// 쓰는 법: node tools/export-all-text.mjs   → docs/review/all-text.md
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => resolve(root, p);
const { REVIEW_SITUATIONS } = await import(at('data/review-quiz.js'));
const { TIP, hintText } = await import(at('js/rules/tutorial.js'));
const { WORDS } = await import(at('data/words.js'));

let out = '# 말빛 한울 — 학생이 읽는 모든 글 (검수용)\n\n';
out += '검수 기준: 초등 6학년이 읽기 쉬운 우리말인가, 맞춤법·띄어쓰기, 고유어 뜻이 표준국어대사전과 맞는가, 문장이 어색하지 않은가.\n\n';
out += '## 낱말 50개 (뜻·예문)\n\n';
for (const w of WORDS) out += `- **${w.word}**: ${w.meaning} / 예문: ${w.example}\n`;
for (const f of ['act1', 'act2', 'act3', 'act4', 'act5', 'ending']) out += '\n\n' + readFileSync(at(`docs/review/${f}-script.md`), 'utf8');
out += '\n\n## 튜토리얼 안내\n\n';
for (const id of Object.values(TIP)) {
  try { hintText(id); } catch { continue; }
  out += `- ${id}: ${hintText(id).replace(/\n/g, ' / ')} (터치: ${hintText(id, { touch: true }).replace(/\n/g, ' / ')})\n`;
}
out += '\n## 마무리 퀴즈 상황 문장\n\n';
for (const s of REVIEW_SITUATIONS) out += `- ${s.word}: ${s.situation}\n`;
writeFileSync(at('docs/review/all-text.md'), out);
console.log(`wrote ${at('docs/review/all-text.md')}`);
