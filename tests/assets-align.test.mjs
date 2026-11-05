// 표정 정렬 검사(2~5막 그림 계획 Review Focus 2, Task 2).
// 대화 도중 표정 그림이 바뀌어도 머리·어깨가 튀지 않게: base가 아닌 표정 상반신마다
// tools/art/illust.py가 남긴 정렬 기록(design/art/act<n>/align.json)이 있고, 머리·어깨(위 60%) 알파 IoU가 0.95 이상이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ASSETS } from '../data/assets.js';
import { ACTS } from '../data/acts/index.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// 2~5막에서 처음 나오는 인물 id = 2~5막 장들의 npcs id − 1막 npcs id
const npcIds = (act) => new Set(act.chapters.flatMap((c) => c.npcs.map((n) => n.id)));
const ACT1 = npcIds(ACTS[0]);
const NEW = [...new Set(ACTS.slice(1).flatMap((a) => [...npcIds(a)]))].filter((id) => !ACT1.has(id));

// design/art/act2..5/align.json을 합친 기록
const ALIGN = {};
for (let n = 2; n <= 5; n++) {
  const p = join(ROOT, `design/art/act${n}/align.json`);
  if (existsSync(p)) Object.assign(ALIGN, JSON.parse(readFileSync(p, 'utf8')));
}

test('2~5막 새 인물 목록이 있다', () => {
  assert.ok(NEW.includes('haesol') && !NEW.includes('dodam'), NEW.join(' '));
});

test('표정 상반신은 base와 머리·어깨가 겹친다', () => {
  for (const id of NEW) {
    for (const [face, path] of Object.entries(ASSETS.busts[id] ?? {})) {
      if (face === 'base' || path === null) continue;
      const rec = ALIGN[`${id}_${face}`];
      assert.ok(rec, `${id}_${face}: 정렬 기록이 없다`);
      assert.ok(rec.iou_head >= 0.95, `${id}_${face}: iou_head ${rec.iou_head} < 0.95`);
    }
  }
});
