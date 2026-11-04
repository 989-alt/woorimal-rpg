// 글꼴 직접 올리기 검사: 서브셋 크기, @font-face, index.html 미리 받기, 글자 목록이 글을 다 덮는지.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const KB = 1000;

test('서브셋 크기: 고운돋움 320KB, 주아 120KB 이하', () => {
  assert.ok(statSync(join(ROOT, 'assets/fonts/gowun-dodum.v1.woff2')).size <= 320 * KB, '고운돋움');
  assert.ok(statSync(join(ROOT, 'assets/fonts/jua.v1.woff2')).size <= 120 * KB, '주아');
});

test('woff2 파일이다(머리 4바이트 wOF2)', () => {
  for (const f of ['gowun-dodum', 'jua']) {
    const head = readFileSync(join(ROOT, `assets/fonts/${f}.v1.woff2`)).subarray(0, 4).toString('latin1');
    assert.equal(head, 'wOF2', f);
  }
});

test('ui-kit.css의 @font-face 둘이 올린 파일을 가리키고 font-display: swap', () => {
  const css = read('css/ui-kit.css');
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  assert.equal(faces.length, 2);
  const want = { 'Gowun Dodum': 'assets/fonts/gowun-dodum.v1.woff2', Jua: 'assets/fonts/jua.v1.woff2' };
  for (const [family, path] of Object.entries(want)) {
    const body = faces.find((f) => f.includes(`'${family}'`));
    assert.ok(body, `${family} @font-face`);
    const url = body.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1];
    // css/ 기준 상대 경로
    assert.equal(relative(ROOT, join(ROOT, 'css', url)), path, `${family} url`);
    assert.match(body, /font-display:\s*swap/, `${family} font-display`);
    assert.match(body, /font-weight:\s*400/, `${family} 굵기`);
  }
  assert.match(css, /font-synthesis:\s*none/, '가짜 굵게 금지');
});

test('index.html: 고운돋움 preload(as=font, crossorigin), Google Fonts 없음', () => {
  const html = read('index.html');
  assert.match(html, /<link[^>]*rel="preload"[^>]*as="font"[^>]*crossorigin[^>]*>/);
  assert.match(html, /<link[^>]*gowun-dodum\.v1\.woff2[^>]*>/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  for (const f of ['css/ui-kit.css', 'css/game.css']) assert.doesNotMatch(read(f), /fonts\.googleapis\.com|fonts\.gstatic\.com/, f);
});

const listChars = (file) => new Set([...read(file)].filter((c) => !/\s/.test(c)));

test('고운돋움 글자 목록이 KS X 1001 한글 2,350자를 모두 담는다', () => {
  const dec = new TextDecoder('euc-kr');
  const want = [];
  for (let lead = 0xb0; lead <= 0xc8; lead++) {
    for (let trail = 0xa1; trail <= 0xfe; trail++) want.push(dec.decode(Uint8Array.of(lead, trail)));
  }
  assert.equal(want.length, 2350);
  assert.ok(want.every((c) => /\p{Script=Hangul}/u.test(c)), 'EUC-KR 해독이 한글이어야 한다');
  const have = listChars('tools/fonts/gowun-dodum.chars.txt');
  assert.deepEqual(want.filter((c) => !have.has(c)), []);
});

function jsFiles(dir) {
  return readdirSync(join(ROOT, dir), { recursive: true })
    .filter((f) => String(f).endsWith('.js'))
    .map((f) => join(dir, String(f)));
}

test('data/·js/의 모든 .js에 나오는 글자(공백 빼고)가 두 글자 목록에 모두 있다', () => {
  const lists = { 고운돋움: listChars('tools/fonts/gowun-dodum.chars.txt'), 주아: listChars('tools/fonts/jua.chars.txt') };
  const used = new Map(); // 글자 -> 처음 나온 파일
  for (const f of [...jsFiles('data'), ...jsFiles('js')]) {
    for (const c of read(f)) if (!/\s/.test(c) && !used.has(c)) used.set(c, f);
  }
  for (const [name, have] of Object.entries(lists)) {
    const missing = [...used].filter(([c]) => !have.has(c)).map(([c, f]) => `${c} (${f})`);
    assert.deepEqual(missing, [], `${name} 목록에 없는 글자: tools/subset-fonts.py를 다시 돌린다`);
  }
});
