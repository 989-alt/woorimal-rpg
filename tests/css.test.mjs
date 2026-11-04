import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gameCss = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');

// 주석을 빼고 { 선택자 목록 → 선언들 } 규칙 목록으로 읽는다(@media 같은 중첩은 안쪽 규칙을 따로 센다).
function rules(css) {
  const out = [];
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of flat.matchAll(re)) {
    out.push({ selectors: m[1].split(',').map((x) => x.trim()), body: m[2] });
  }
  return out;
}
const declared = (css, selector) => rules(css).filter((r) => r.selectors.includes(selector)).map((r) => r.body).join('\n');

test('100vh를 쓰는 곳은 바로 다음 줄에 100dvh를 둔다(100vh는 대체 값)', () => {
  const lines = gameCss.split('\n');
  const vh = lines.map((l, i) => [l.trim(), i]).filter(([l]) => /^(min-)?height:\s*100vh;/.test(l));
  for (const [l, i] of vh) {
    const prop = l.split(':')[0];
    assert.match(lines[i + 1].trim(), new RegExp(`^${prop}:\\s*100dvh;`), `${i + 1}째 줄 다음에 ${prop}: 100dvh`);
  }
});

test('장면 뿌리는 모두 position: fixed; inset: 0 (화면을 꽉 채운다)', () => {
  const roots = ['.title-scene', '.select-scene', "[data-scene='explore']", '.dialogue-scene', '.battle-scene', '.end-scene'];
  for (const sel of roots) {
    const body = declared(gameCss, sel);
    assert.match(body, /position:\s*fixed;/, `${sel}: position: fixed`);
    assert.match(body, /inset:\s*0;/, `${sel}: inset: 0`);
  }
});

test('body 배경에 한지색(--parchment, --hanji)을 쓰지 않는다(여백 없음)', () => {
  const body = rules(gameCss).filter((r) => r.selectors.includes('body') || r.selectors.includes('html')).map((r) => r.body).join('\n');
  assert.match(body, /background:\s*var\(--wood-dark\)/, 'body는 나무 어둠색');
  assert.doesNotMatch(body, /--parchment|--hanji/);
  assert.equal(rules(gameCss).some((r) => r.selectors.includes('#app') && /display:\s*grid|place-items/.test(r.body)), false, '#app 가운데 정렬은 걷어 낸다');
});

test('.big-button은 남아 있지 않다(.btn으로 바뀜)', () => {
  assert.doesNotMatch(gameCss, /big-button/);
});
