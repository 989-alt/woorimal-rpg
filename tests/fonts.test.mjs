// 글꼴 직접 올리기 검사: 서브셋 크기, @font-face, index.html 미리 받기, 글자 목록이 글을 다 덮는지.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
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

// 서브셋을 다시 만드는 방법(실패 메시지에 그대로 붙인다)
const REBUILD = [
  '글을 더했거나 고쳤으면 서브셋을 다시 만든다(저장소 뿌리에서):',
  '  /root/.local/share/sprite-gen/.venv/bin/python -I tools/subset-fonts.py \\',
  '    --gowun design/art/ui/raw/fonts-dl-gowun/GowunDodum-Regular.ttf \\',
  '    --jua design/art/ui/raw/fonts-dl-jua/Jua-Regular.ttf \\',
  '    --out assets/fonts --chars-out tools/fonts',
  '원본 글꼴(.ttf)은 저장소에 없다(design/art/ui/raw/는 gitignore). github.com/google/fonts 의',
  'ofl/gowundodum/GowunDodum-Regular.ttf, ofl/jua/Jua-Regular.ttf 를 받아 위 경로에 둔다(각각 빈 새 폴더에).',
  '그 뒤 pip install fonttools brotli(sprite-gen venv)가 필요하다.',
].join('\n');

// tools/subset-fonts.py가 훑는 파일과 같다: data/·js/의 .js, css/의 .css, index.html (주석 포함)
function scanned() {
  const files = ['index.html'];
  for (const [dir, ext] of [['data', '.js'], ['js', '.js'], ['css', '.css']]) {
    for (const f of readdirSync(join(ROOT, dir), { recursive: true })) if (String(f).endsWith(ext)) files.push(join(dir, String(f)));
  }
  return files;
}

test('저장소 글(data/·js/·css/·index.html)의 모든 글자(공백 빼고)가 두 글자 목록에 있다', () => {
  const lists = { 고운돋움: listChars('tools/fonts/gowun-dodum.chars.txt'), 주아: listChars('tools/fonts/jua.chars.txt') };
  const used = new Map(); // 글자 -> 처음 나온 파일
  for (const f of scanned()) {
    for (const c of read(f)) if (!/\s/.test(c) && c.codePointAt(0) >= 0x20 && !used.has(c)) used.set(c, f);
  }
  for (const [name, have] of Object.entries(lists)) {
    const missing = [...used].filter(([c]) => !have.has(c)).map(([c, f]) => `${c} (${f})`);
    assert.deepEqual(missing, [], `${name} 목록에 없는 글자 ${missing.length}개.\n${REBUILD}`);
  }
});

// ── woff2 글자표(cmap) 읽기: 의존성 없이 woff2 표 목록과 brotli 묶음을 풀어 cmap 표만 읽는다 ──
const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function woff2Cmap(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'wOF2');
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  let o = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) { const b = buf[o++]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return v; }
    throw new Error('UIntBase128');
  };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[o++];
    const idx = flags & 0x3f;
    const tag = idx === 63 ? buf.toString('latin1', o, (o += 4)) : WOFF2_TAGS[idx];
    const version = flags >> 6;
    const origLength = base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    tables.push({ tag, length: transformed ? base128() : origLength });
  }
  const data = brotliDecompressSync(buf.subarray(o, o + compressedSize));
  let at = 0;
  let cmap = null;
  for (const t of tables) { if (t.tag === 'cmap') cmap = data.subarray(at, at + t.length); at += t.length; }
  assert.ok(cmap, 'cmap 표');
  const points = new Set();
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const sub = cmap.subarray(cmap.readUInt32BE(4 + i * 8 + 4));
    const format = sub.readUInt16BE(0);
    if (format === 12) {
      for (let g = 0, groups = sub.readUInt32BE(12); g < groups; g++) {
        const start = sub.readUInt32BE(16 + g * 12), end = sub.readUInt32BE(20 + g * 12);
        for (let c = start; c <= end; c++) points.add(c);
      }
    } else if (format === 4) {
      const segs = sub.readUInt16BE(6) / 2;
      const ends = 14, starts = 16 + segs * 2, deltas = starts + segs * 2, ranges = deltas + segs * 2;
      for (let k = 0; k < segs; k++) {
        const end = sub.readUInt16BE(ends + k * 2), start = sub.readUInt16BE(starts + k * 2);
        for (let c = start; c <= end && c < 0xffff; c++) {
          const ro = sub.readUInt16BE(ranges + k * 2);
          const glyph = ro === 0 ? (c + sub.readInt16BE(deltas + k * 2)) & 0xffff : sub.readUInt16BE(ranges + k * 2 + ro + (c - start) * 2);
          if (glyph !== 0) points.add(c);
        }
      }
    }
  }
  return points;
}

// 원본 글꼴에 없어서 서브셋에도 없는 글자. 이런 글자는 다른 글꼴(주아 → 고운돋움 → 시스템)로 대신 보인다.
// 주아로 그리는 글(버튼·제목·명판·보기 낱말·리본)에는 쓰지 않는다 — 쓰게 되면 그 자리에 고운돋움 글꼴을 따로 준다(.x-mark, .opt-mark).
const FALLBACK_OK = {
  'gowun-dodum': new Set('✓✦'), // 모두 주석이거나 고운돋움 글에서 시스템 글꼴로 보이는 체크 표시
  jua: new Set('`·×—…→─▲▶▼◀○✓✦「」힣'), // 위 둘 + 주아에 없는 기호·한자 기호. 주아 글에서 쓰지 않는다
};

test('woff2 글자표가 글자 목록을 덮는다(원본에 없는 글자는 허용 목록에 이름이 있어야 한다)', () => {
  for (const name of ['gowun-dodum', 'jua']) {
    const have = woff2Cmap(readFileSync(join(ROOT, `assets/fonts/${name}.v1.woff2`)));
    assert.ok(have.size > 500 && have.has('한'.codePointAt(0)), `${name} 글자표를 읽었다(${have.size}자)`);
    const missing = [...listChars(`tools/fonts/${name}.chars.txt`)].filter((c) => !have.has(c.codePointAt(0)) && !FALLBACK_OK[name].has(c));
    assert.deepEqual(missing, [], `${name}.v1.woff2에 없는 글자 ${missing.length}개: ${missing.join('')}.\n${REBUILD}`);
  }
});

test('주아 글꼴에 없는 글자(… · × → ○ ✓)는 주아로 그리는 글에 쓰지 않는다', () => {
  // 알려진 자리: 게임 오버 제목, 할 일 창 제목은 글자를 바꿨고, .x-mark·.opt-mark는 고운돋움 글꼴을 준다.
  assert.doesNotMatch(read('js/scenes/gameover.js').replace(/\/\/.*$/gm, ''), /…/);
  assert.doesNotMatch(read('js/scenes/quests.js').replace(/\/\/.*$/gm, ''), /할 일 ·/);
  const css = read('css/game.css');
  for (const sel of ['.x-mark', '.opt-mark']) {
    const body = css.match(new RegExp(`${sel.replace('.', '\\.')}\\s*{([^}]*)}`))?.[1] ?? '';
    assert.match(body, /font-family:\s*var\(--font-body\)/, `${sel}는 고운돋움 글꼴`);
  }
});
