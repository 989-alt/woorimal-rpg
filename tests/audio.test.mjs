// 소리(js/ui/audio.js)의 순수 부분과 검사용 흉내(stub). 진짜 소리는 브라우저에서만 난다(tests/e2e/audio.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS } from '../data/assets.js';
import { ACTS } from '../data/acts/index.js';
import {
  musicFor, parsePref, loadPref, savePref, prefOfSave, withSoundPref, allowSfx, edgeTrim, questSfx, gateOpened,
  DEFAULT_PREF, PREF_KEY, SFX_GAP_MS, SYNTH, initAudio, playMusic, sfx, setSoundOn, toggleSound, isSoundOn,
  useSavePref, useGlobalPref, audioProbe, isSoundKey, musicToRelease,
} from '../js/ui/audio.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('musicFor: 장면마다 음악 키(undefined는 그대로, null은 멈춤)', () => {
  const at = (chapter) => ({ chapter });
  assert.equal(musicFor('title'), 'title');
  assert.equal(musicFor('select', { mode: 'new' }), 'title');
  for (const act of ACTS) {
    for (const ch of act.chapters) assert.equal(musicFor('explore', {}, at(ch.id)), `act${act.id}`, ch.id);
  }
  assert.equal(musicFor('explore', {}, null), undefined);
  assert.equal(musicFor('dialogue', { script: [] }, at('3-1')), 'act3'); // 장의 이야기 대화는 그 막 음악
  assert.equal(musicFor('dialogue', { script: [], bg: null }, at('5-2')), undefined); // 엔딩 장면 대화는 엔딩 음악 그대로
  assert.equal(musicFor('battle', { mode: 'review' }, at('1-1')), 'review');
  assert.equal(musicFor('battle', { mode: 'boss' }, at('1-2')), 'boss');
  assert.equal(musicFor('battle', { mode: 'boss' }, at('4-2')), 'boss');
  assert.equal(musicFor('battle', { mode: 'boss' }, at('5-2')), 'final');
  assert.equal(musicFor('gameover'), null);
  assert.equal(musicFor('clear', { kind: 'act' }, at('1-2')), undefined);
  assert.equal(musicFor('worldmap', {}, at('1-2')), 'world');
  assert.equal(musicFor('ending', { step: 0 }, at('5-2')), 'ending');
  assert.equal(musicFor('review-quiz', { next: 'title' }), 'quiz');
  assert.equal(musicFor('없는 장면'), undefined);
});

test('musicFor가 고르는 키는 모두 ASSETS.audio.music에 있다', () => {
  const keys = new Set(['title', 'world', 'review', 'boss', 'final', 'ending', 'quiz', ...ACTS.map((a) => `act${a.id}`)]);
  for (const k of keys) assert.ok(ASSETS.audio.music[k], `music.${k}`);
});

test('parsePref·loadPref·savePref: 깨진 값은 기본값, 크기는 0~1', () => {
  assert.deepEqual(DEFAULT_PREF, { on: true, volume: 0.6 });
  assert.ok(DEFAULT_PREF.volume <= 0.6, '처음 크기는 작게');
  assert.deepEqual(parsePref(null), DEFAULT_PREF);
  assert.deepEqual(parsePref('{깨짐'), DEFAULT_PREF);
  assert.deepEqual(parsePref('{"on":false}'), { on: false, volume: DEFAULT_PREF.volume });
  assert.deepEqual(parsePref({ on: 'yes', volume: 7 }), { on: true, volume: 1 });
  assert.deepEqual(parsePref({ on: true, volume: -1 }), { on: true, volume: 0 });
  const st = memoryStorage();
  assert.deepEqual(loadPref(st), DEFAULT_PREF);
  assert.equal(savePref(st, { on: false, volume: 0.3 }), true);
  assert.deepEqual(JSON.parse(st.getItem(PREF_KEY)), { on: false, volume: 0.3 });
  assert.deepEqual(loadPref(st), { on: false, volume: 0.3 });
  const broken = { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } };
  assert.deepEqual(loadPref(broken), DEFAULT_PREF);
  assert.equal(savePref(broken, DEFAULT_PREF), false);
  assert.deepEqual(loadPref(null), DEFAULT_PREF);
});

test('학생 저장의 소리 설정: withSoundPref로 얹고 prefOfSave로 읽는다(옛 저장은 null)', () => {
  const s = { nickname: '하늘', act: 1 };
  const saved = withSoundPref(s, { on: false, volume: 0.4 });
  assert.deepEqual(saved.sound, { on: false, volume: 0.4 });
  assert.equal(s.sound, undefined, '원래 상태는 그대로');
  assert.deepEqual(prefOfSave(saved), { on: false, volume: 0.4 });
  assert.equal(prefOfSave(s), null);
  assert.equal(prefOfSave({ sound: { on: 'x' } }), null);
  assert.equal(prefOfSave(null), null);
  assert.equal(withSoundPref(null, DEFAULT_PREF), null);
});

test('allowSfx: 같은 소리는 정해진 틈보다 잦게 내지 않는다(걸음은 한 칸 250ms에 한 번까지)', () => {
  const last = new Map();
  assert.ok(SFX_GAP_MS.step <= 250 && SFX_GAP_MS.step >= 150);
  assert.equal(allowSfx(last, 'step', 1000), true);
  assert.equal(allowSfx(last, 'step', 1100), false);
  assert.equal(allowSfx(last, 'step', 1000 + SFX_GAP_MS.step), true);
  assert.equal(allowSfx(last, 'chime', 1000), true, '다른 소리는 따로 센다');
  assert.equal(allowSfx(last, 'chime', 1010), false);
  assert.equal(allowSfx(last, 'chime', 1100), true);
});

test('edgeTrim: 앞뒤 무음(인코더 여백)만 걷어 내고, 소리가 바로 시작하면 그대로', () => {
  const a = new Float32Array(100).fill(0.2);
  a.fill(0, 0, 10);
  a.fill(0, 95);
  assert.deepEqual(edgeTrim([a, a]), { start: 10, end: 95 });
  const b = new Float32Array(50).fill(0.1);
  assert.deepEqual(edgeTrim([b]), { start: 0, end: 50 });
  const silent = new Float32Array(30);
  assert.deepEqual(edgeTrim([silent]), { start: 0, end: 30 }, '모두 조용하면 자르지 않는다');
  const longLead = new Float32Array(10000).fill(0.3);
  longLead.fill(0, 0, 6000);
  assert.deepEqual(edgeTrim([longLead], { maxSkip: 4096 }), { start: 0, end: 10000 }, '여백이라기엔 긴 무음은 음악의 일부');
  const right = new Float32Array(20).fill(0.5);
  const left = new Float32Array(20).fill(0.5);
  right.fill(0, 15);
  left.fill(0, 0, 3);
  assert.deepEqual(edgeTrim([left, right]), { start: 0, end: 20 }, '어느 한 채널이라도 소리가 있으면 소리');
});

test('questSfx: 끝난 부탁은 done, 받았거나 조건을 채우면 accept', () => {
  const st = (quests) => ({ quests });
  assert.equal(questSfx(st({ q1: { stage: 'open' } }), st({ q1: { stage: 'active' } })), 'accept');
  assert.equal(questSfx(st({ q1: { stage: 'active' } }), st({ q1: { stage: 'ready' } })), 'accept');
  assert.equal(questSfx(st({ q1: { stage: 'ready' }, q2: { stage: 'locked' } }), st({ q1: { stage: 'done' }, q2: { stage: 'open' } })), 'done');
  assert.equal(questSfx(st({ q1: { stage: 'active' } }), st({ q1: { stage: 'active' } })), null);
  assert.equal(questSfx(st({}), st({ q2: { stage: 'open' } })), null);
  assert.equal(questSfx(null, null), null);
});

test('gateOpened: 같은 장에서 출구나 안개 문이 닫혔다가 열린 때만', () => {
  const g = (chapter, exit, fog) => ({ chapter, exit, fog });
  assert.equal(gateOpened(g('1-1', false, false), g('1-1', true, false)), true);
  assert.equal(gateOpened(g('1-2', false, false), g('1-2', false, true)), true);
  assert.equal(gateOpened(g('1-1', true, true), g('1-1', true, true)), false);
  assert.equal(gateOpened(g('1-1', false, false), g('1-2', true, true)), false, '장이 바뀐 것은 열림이 아니다');
  assert.equal(gateOpened(null, g('1-1', true, true)), false, '처음 본 장면');
});

test('코드에서 내는 효과음 키는 모두 ASSETS.audio.sfx에 있고, 파일이 없으면 코드로 만든 소리가 있다', () => {
  const files = (dir) => readdirSync(join(ROOT, dir), { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => join(ROOT, dir, String(f)));
  const used = new Set();
  for (const f of files('js')) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\bsfx\(\s*'([a-z]+)'/g)) used.add(m[1]);
    for (const m of readFileSync(f, 'utf8').matchAll(/\bsfx\([^)]*\?\s*'([a-z]+)'\s*:\s*'([a-z]+)'/g)) { used.add(m[1]); used.add(m[2]); }
  }
  for (const k of ['step', 'talk', 'chime', 'card', 'codex', 'correct', 'wrong', 'hit', 'streak', 'defeat', 'heart', 'exit', 'travel', 'click', 'done']) {
    assert.ok(used.has(k), `코드가 sfx('${k}')를 낸다`);
  }
  for (const k of [...used, 'accept', 'done']) {
    assert.ok(k in ASSETS.audio.sfx, `ASSETS.audio.sfx.${k}`);
    assert.ok(ASSETS.audio.sfx[k] || SYNTH[k], `sfx.${k}: 파일이나 코드 소리`);
  }
  for (const k of Object.keys(ASSETS.audio.sfx)) assert.equal(typeof SYNTH[k], 'function', `파일을 못 받으면 대신할 소리 SYNTH.${k}`);
});

test('isSoundKey: M(한글 자판 ㅡ 포함, code로 본다)만, 글 쓰는 칸·조합 키·되풀이는 빼고', () => {
  const e = (o) => ({ code: 'KeyM', repeat: false, altKey: false, ctrlKey: false, metaKey: false, target: { tagName: 'BODY' }, ...o });
  assert.equal(isSoundKey(e()), true);
  assert.equal(isSoundKey(e({ code: 'KeyN' })), false);
  assert.equal(isSoundKey(e({ repeat: true })), false);
  assert.equal(isSoundKey(e({ ctrlKey: true })), false);
  assert.equal(isSoundKey(e({ target: { tagName: 'INPUT' } })), false);
  assert.equal(isSoundKey(e({ target: { tagName: 'DIV', isContentEditable: true } })), false);
});

// 아래는 모듈 상태를 쓰므로 순서대로 돈다.
test('검사용 흉내(stub): 요청을 적고, 켜기·끄기는 기기 기본값에 남고, 학생 설정은 기본값을 바꾸지 않는다', () => {
  const st = memoryStorage({ [PREF_KEY]: JSON.stringify({ on: true, volume: 0.6 }) });
  const changes = [];
  initAudio({ storage: st, test: true, onChange: (p) => changes.push(p.on) });
  assert.equal(audioProbe().mode, 'stub');
  playMusic('title');
  playMusic(undefined); // 그대로: 적지 않는다
  playMusic('act1');
  playMusic('없는곡'); // 모르는 키는 멈춤으로
  playMusic(null);
  sfx('chime');
  sfx('step');
  let p = audioProbe();
  assert.deepEqual(p.music, ['title', 'act1', '없는곡', null]);
  assert.equal(p.want, null);
  assert.deepEqual(p.sfx, ['chime', 'step']);
  assert.equal(isSoundOn(), true);
  toggleSound();
  assert.equal(isSoundOn(), false);
  assert.deepEqual(JSON.parse(st.getItem(PREF_KEY)), { on: false, volume: 0.6 });
  assert.deepEqual(changes, [false]);
  // 학생 저장을 쓰면 그 학생 설정. 기기 기본값은 그대로
  useSavePref({ sound: { on: true, volume: 0.6 } });
  assert.equal(isSoundOn(), true);
  assert.deepEqual(JSON.parse(st.getItem(PREF_KEY)), { on: false, volume: 0.6 });
  useSavePref({}); // 소리 설정이 없는 저장: 그대로
  assert.equal(isSoundOn(), true);
  useGlobalPref(); // 처음 화면: 기기 기본값
  assert.equal(isSoundOn(), false);
  setSoundOn(true);
  p = audioProbe();
  assert.deepEqual(p.toggles, [false, true]);
  assert.equal(p.on, true);
});

test('node(브라우저 아님)에서 진짜 소리 모드를 바라도 조용히 아무것도 하지 않는다', () => {
  initAudio({ storage: null, test: false });
  assert.equal(audioProbe().mode, 'off');
  playMusic('title');
  sfx('chime');
  toggleSound();
  toggleSound();
  assert.equal(audioProbe().mode, 'off');
});

test('musicToRelease: 풀어 둔 음악은 지금 곡과 바라는 곡만 남기고, 효과음은 놓지 않는다', () => {
  const music = Object.values(ASSETS.audio.music);
  const sfxPaths = Object.values(ASSETS.audio.sfx);
  assert.ok(music.length >= 3);
  const [a, b, c] = music;
  const cached = [a, b, c, ...sfxPaths];
  assert.deepEqual(musicToRelease(cached, music, [b, null]), [a, c]);
  assert.deepEqual(musicToRelease(cached, music, [b, c]), [a]);
  assert.deepEqual(musicToRelease(cached, music, [null, null]), [a, b, c]);
  assert.deepEqual(musicToRelease(new Map(cached.map((p) => [p, 1])).keys(), music, [a]), [b, c]);
});
