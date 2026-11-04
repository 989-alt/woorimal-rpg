import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('100vh를 쓰는 장면 뿌리는 바로 다음 줄에 100dvh를 둔다(100vh는 대체 값)', () => {
  const lines = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8').split('\n');
  const vh = lines.map((l, i) => [l.trim(), i]).filter(([l]) => /^(min-)?height:\s*100vh;/.test(l));
  assert.ok(vh.length >= 4, '대화·전투·시작·끝 장면');
  for (const [l, i] of vh) {
    const prop = l.split(':')[0];
    assert.match(lines[i + 1].trim(), new RegExp(`^${prop}:\\s*100dvh;`), `${i + 1}째 줄 다음에 ${prop}: 100dvh`);
  }
});
