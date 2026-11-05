// 막·엔딩 대본을 선생님 확인용 Markdown으로 뽑는다(글 만들기는 tools/script-md.mjs).
// 쓰는 법: node tools/export-act-script.mjs [1~5 | ending | all = 1] [닉네임=하늘]
//   → docs/review/act<번호>-script.md, docs/review/ending-script.md
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTS } from '../data/acts/index.js';
import ENDING from '../data/ending.js';
import { actScriptMd, endingScriptMd } from './script-md.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const which = process.argv[2] ?? '1';
const nickname = process.argv[3] ?? '하늘';

function write(name, md) {
  const file = resolve(root, 'docs/review', name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, md);
  console.log(`wrote ${file}`);
}

const writeAct = (act) => write(`act${act.id}-script.md`, actScriptMd(act, nickname));
const writeEnding = () => write('ending-script.md', endingScriptMd(ENDING, nickname));

if (which === 'all') {
  ACTS.forEach(writeAct);
  writeEnding();
} else if (which === 'ending') {
  writeEnding();
} else {
  const act = ACTS.find((a) => a.id === Number(which));
  if (!act) {
    console.error(`알 수 없는 막: ${which} (1~${ACTS.length}, ending, all)`);
    process.exit(1);
  }
  writeAct(act);
}
