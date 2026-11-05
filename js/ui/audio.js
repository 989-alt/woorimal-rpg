// 소리: 배경음악(장면마다 하나, 서로 겹쳐 바뀜)과 효과음. AudioContext는 하나만 쓰고, 첫 사용자 동작(누름·키)에서 연다
// (브라우저는 사용자 동작 전에는 소리를 내지 못하게 막는다).
// 소리 파일이 없거나 못 받거나 못 풀어도 게임은 멈추지 않는다: 조용히 넘어가고, 효과음은 코드로 만든 소리로 대신한다.
// 검사(?test=1)에서는 소리를 내지 않고 요청만 적어 둔다(audioProbe). node에서는 아무것도 하지 않는다.
// 켜기·끄기와 크기는 이 기기의 localStorage(전역, 처음 화면의 기본값)와 학생 저장(이름별)에 함께 남는다.
import { ASSETS } from '../../data/assets.js';
import { ACTS, actOfChapter } from '../../data/acts/index.js';

export const PREF_KEY = 'malbit:sound';
export const DEFAULT_PREF = Object.freeze({ on: true, volume: 0.6 }); // 처음에는 켜져 있고 작게
export const MUSIC_LEVEL = 0.75; // 음악(-20 LUFS)과 효과음(-17 LUFS쯤)의 차이는 파일 음량으로 맞췄다
export const SFX_LEVEL = 0.75;
export const FADE_S = 1.2; // 음악이 바뀔 때 겹쳐 바뀌는 시간
// 같은 효과음을 너무 잦게 내지 않는다(ms). 걸음은 꾹 누르고 걸을 때 한 칸 건너 한 번쯤.
export const SFX_GAP_MS = { step: 200, talk: 70, click: 60 };
const DEFAULT_GAP_MS = 45;
// 효과음마다 크기(파일은 모두 비슷한 크기로 맞췄다. 자주 나는 소리는 더 작게)
export const SFX_GAIN = { step: 0.35, talk: 0.5, click: 0.5 };

// ── 순수 함수 ─────────────────────────────

// 장면 이름·매개변수·상태 → 음악 키. undefined: 지금 음악 그대로, null: 음악을 멈춘다.
export function musicFor(scene, params = {}, state = null) {
  const actMusic = () => {
    if (!state?.chapter) return undefined;
    try { return `act${actOfChapter(state.chapter).id}`; } catch { return undefined; }
  };
  switch (scene) {
    case 'title':
    case 'select':
      return 'title';
    case 'explore':
      return actMusic();
    case 'dialogue':
      return params && 'bg' in params ? undefined : actMusic(); // 엔딩 장면 대화(제 배경)는 엔딩 음악 그대로
    case 'battle': {
      if (params?.mode !== 'boss') return 'review';
      const act = state?.chapter ? actOfChapter(state.chapter) : null;
      return act && act.id === ACTS[ACTS.length - 1].id ? 'final' : 'boss';
    }
    case 'gameover':
      return null;
    case 'worldmap':
      return 'world';
    case 'ending':
      return 'ending';
    case 'review-quiz':
      return 'quiz';
    default:
      return undefined; // clear 등: 하던 음악 그대로
  }
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// 풀어 둔 음악 가운데 내려놓을 것. 음악 한 곡은 풀면 수십 MB라, 지금 나는 곡과 곧 날 곡(바라는 곡)만 남긴다.
// cached: 풀어 두었거나 푸는 중인 경로들, musicPaths: 음악 파일 경로들, keep: 남길 경로들(null은 건너뜀). 효과음은 건드리지 않는다.
export function musicToRelease(cached, musicPaths, keep) {
  const music = new Set(musicPaths);
  const kept = new Set(keep.filter(Boolean));
  return [...cached].filter((p) => music.has(p) && !kept.has(p));
}

// 저장된 글(JSON) → { on, volume }. 깨졌거나 없으면 기본값.
export function parsePref(raw) {
  let p = null;
  try { p = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { p = null; }
  if (!p || typeof p !== 'object') return { ...DEFAULT_PREF };
  return {
    on: typeof p.on === 'boolean' ? p.on : DEFAULT_PREF.on,
    volume: Number.isFinite(p.volume) ? clamp01(p.volume) : DEFAULT_PREF.volume,
  };
}

export function loadPref(storage) {
  try { return parsePref(storage?.getItem(PREF_KEY) ?? null); } catch { return { ...DEFAULT_PREF }; }
}

export function savePref(storage, pref) {
  try { storage?.setItem(PREF_KEY, JSON.stringify({ on: !!pref.on, volume: clamp01(pref.volume) })); return true; } catch { return false; }
}

// 학생 저장의 소리 설정. 없으면(옛 저장·새 게임) null.
export function prefOfSave(state) {
  const s = state?.sound;
  if (!s || typeof s !== 'object' || typeof s.on !== 'boolean') return null;
  return parsePref(s);
}

// 저장할 상태에 지금 소리 설정을 얹는다(상태는 바꾸지 않고 새 것을 돌려준다).
export function withSoundPref(state, pref) {
  if (!state) return state;
  return { ...state, sound: { on: !!pref.on, volume: clamp01(pref.volume) } };
}

// 부탁 상태가 바뀐 소리: 끝난 부탁이 생기면 'done', 새로 받았거나(진행 중) 조건을 채웠으면(돌아가 알릴 차례) 'accept', 그 밖에는 null.
export function questSfx(before, after) {
  const a = before?.quests ?? {};
  let out = null;
  for (const [id, q] of Object.entries(after?.quests ?? {})) {
    const was = a[id]?.stage;
    if (!q || q.stage === was) continue;
    if (q.stage === 'done') return 'done';
    if (q.stage === 'active' || q.stage === 'ready') out = 'accept';
  }
  return out;
}

// 출구나 안개 문이 막 열렸는가. prev·cur: { chapter, exit, fog } (같은 장에서 닫혀 있다가 열린 때만 참)
export function gateOpened(prev, cur) {
  return !!prev && !!cur && prev.chapter === cur.chapter && ((!prev.exit && !!cur.exit) || (!prev.fog && !!cur.fog));
}

// 이 효과음을 지금 내도 되는가(같은 소리를 너무 잦게 내지 않기). last: Map(key → ms)
export function allowSfx(last, key, now) {
  const gap = SFX_GAP_MS[key] ?? DEFAULT_GAP_MS;
  const prev = last.get(key);
  if (prev !== undefined && now - prev < gap) return false;
  last.set(key, now);
  return true;
}

// 소리 자료 앞뒤에 붙은 무음(MP3 인코더 여백 등)을 걷어 낸 되풀이 구간 [start, end) (표본 번호).
// 되풀이 음악 파일은 처음부터 끝까지가 한 바퀴이므로, 디코더가 여백을 남겨도 이음매에 틈이 생기지 않게 한다.
export function edgeTrim(channels, { threshold = 1e-3, maxSkip = 4096 } = {}) {
  const len = channels[0]?.length ?? 0;
  const loud = (i) => channels.some((c) => Math.abs(c[i]) > threshold);
  let start = 0;
  while (start < Math.min(maxSkip, len) && !loud(start)) start++;
  if (start >= Math.min(maxSkip, len)) start = 0;
  let end = len;
  while (end > Math.max(start, len - maxSkip) && !loud(end - 1)) end--;
  if (end <= Math.max(start, len - maxSkip)) end = len;
  return { start, end };
}

// ── 코드로 만드는 효과음(파일이 없거나 못 받았을 때, 그리고 아주 짧은 소리) ─────

// notes: [[주파수 Hz, 시작(초), 길이(초), 크기, 파형]]
function tones(ac, dest, t, notes) {
  for (const [freq, at, dur, level = 0.2, type = 'sine', toFreq] of notes) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t + at);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + at + dur);
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(level, t + at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    o.connect(g).connect(dest);
    o.start(t + at);
    o.stop(t + at + dur + 0.02);
  }
}

let noise = null;
function noiseBuffer(ac) {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  noise = ac.createBuffer(1, Math.round(ac.sampleRate * 0.2), ac.sampleRate);
  const d = noise.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
  return noise;
}

let stepFoot = 0;
export const SYNTH = {
  // 부드러운 흙길 걸음: 낮게 거른 짧은 바스락(왼발·오른발 높이를 조금 다르게)
  step(ac, dest, t) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = (stepFoot++ % 2) ? 520 : 640;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.09);
  },
  // 대사 넘김: 작은 나무 '톡'
  talk(ac, dest, t) { tones(ac, dest, t, [[620, 0, 0.06, 0.25, 'sine', 470]]); },
  // 단추 누름
  click(ac, dest, t) { tones(ac, dest, t, [[880, 0, 0.045, 0.2, 'triangle', 700]]); },
  // 아래는 파일을 못 받았을 때 대신하는 소리
  chime(ac, dest, t) { tones(ac, dest, t, [[1047, 0, 0.6, 0.18], [1319, 0.08, 0.6, 0.15], [1568, 0.16, 0.8, 0.14], [2093, 0.24, 0.9, 0.08]]); },
  card(ac, dest, t) { tones(ac, dest, t, [[660, 0, 0.12, 0.15, 'triangle', 990]]); },
  codex(ac, dest, t) { tones(ac, dest, t, [[392, 0, 0.12, 0.15, 'triangle', 330]]); },
  accept(ac, dest, t) { tones(ac, dest, t, [[587, 0, 0.14, 0.2, 'triangle'], [784, 0.11, 0.2, 0.2, 'triangle']]); },
  done(ac, dest, t) { tones(ac, dest, t, [[523, 0, 0.18, 0.2, 'triangle'], [659, 0.12, 0.18, 0.2, 'triangle'], [784, 0.24, 0.4, 0.2, 'triangle']]); },
  correct(ac, dest, t) { tones(ac, dest, t, [[784, 0, 0.14, 0.2], [1047, 0.09, 0.3, 0.2]]); },
  wrong(ac, dest, t) { tones(ac, dest, t, [[330, 0, 0.16, 0.2, 'triangle'], [262, 0.13, 0.26, 0.2, 'triangle']]); },
  hit(ac, dest, t) { tones(ac, dest, t, [[300, 0, 0.12, 0.25, 'sine', 140]]); },
  streak(ac, dest, t) { tones(ac, dest, t, [[300, 0, 0.12, 0.25, 'sine', 140], [1319, 0.04, 0.3, 0.1]]); },
  defeat(ac, dest, t) { tones(ac, dest, t, [[784, 0, 0.3, 0.12], [988, 0.1, 0.3, 0.12], [1319, 0.2, 0.5, 0.12], [1568, 0.3, 0.7, 0.1]]); },
  heart(ac, dest, t) { tones(ac, dest, t, [[196, 0, 0.18, 0.3, 'sine', 120], [494, 0.14, 0.2, 0.1], [392, 0.3, 0.3, 0.1]]); },
  exit(ac, dest, t) { tones(ac, dest, t, [[523, 0, 0.3, 0.1], [659, 0.08, 0.3, 0.1], [784, 0.16, 0.3, 0.1], [1047, 0.24, 0.6, 0.1]]); },
  travel(ac, dest, t) { tones(ac, dest, t, [[440, 0, 0.18, 0.15, 'triangle', 660], [880, 0.15, 0.35, 0.12, 'triangle']]); },
};

// ── 소리 엔진 ─────────────────────────────

let mode = 'off'; // 'web': 진짜 소리, 'stub': 검사(요청만 적음), 'off': 소리 없음
let storage = null;
let onChange = () => {};
let pref = { ...DEFAULT_PREF };
let ac = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let wantMusic = null; // 지금 장면이 바라는 음악 키(null: 없음)
let playing = null; // { key, src, gain }
let musicToken = 0;
const bytes = new Map(); // 경로 → Promise<ArrayBuffer|null>
const buffers = new Map(); // 경로 → Promise<AudioBuffer|null>
const ready = new Map(); // 경로 → AudioBuffer (다 풀린 것)
const regions = new WeakMap(); // AudioBuffer → { start, end }
const lastSfx = new Map();
const log = { music: [], sfx: [], toggles: [] };

const musicPath = (key) => (key ? ASSETS.audio?.music?.[key] ?? null : null);
const sfxPath = (key) => ASSETS.audio?.sfx?.[key] ?? null;

// 파일을 미리 받아 둔다(풀기는 AudioContext가 생긴 뒤에). 실패하면 null.
function fetchBytes(path) {
  if (!path) return Promise.resolve(null);
  if (!bytes.has(path)) {
    bytes.set(path, fetch(path)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null));
  }
  return bytes.get(path);
}

// retry: 못 받으면 잊어서 다음에 한 번 더 받아 본다(음악은 장면이 바뀔 때만 다시 바라므로 retry, 효과음은 한 번 못 받으면 코드 소리로)
function decode(path, { retry = false } = {}) {
  if (!path || !ac) return Promise.resolve(null);
  if (!buffers.has(path)) {
    const job = fetchBytes(path).then((buf) => {
      if (!buf) return null;
      // 옛 Safari는 promise를 돌려주지 않는다: 콜백 꼴로 부른다
      return new Promise((resolve) => {
        try {
          const p = ac.decodeAudioData(buf.slice(0), resolve, () => resolve(null));
          if (p && typeof p.catch === 'function') p.catch(() => resolve(null));
        } catch { resolve(null); }
      });
    }).then((ab) => {
      if (buffers.get(path) !== job) return ab; // 푸는 사이 내려놓은 음악: 붙들지 않는다
      if (ab) ready.set(path, ab);
      else if (retry) { bytes.delete(path); buffers.delete(path); } // 다음 장면에서 한 번 더 받아 본다
      return ab;
    });
    buffers.set(path, job);
  }
  return buffers.get(path);
}

function regionOf(buf) {
  if (!regions.has(buf)) {
    const chans = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
    regions.set(buf, edgeTrim(chans));
  }
  return regions.get(buf);
}

function applyVolume() {
  if (!master || !ac) return;
  const now = ac.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(pref.on ? pref.volume : 0, now + 0.15);
}

// <html data-music="키">: 지금 나는 음악(화면 검사가 진짜 소리 길을 확인할 때 본다). 나는 음악이 없으면 지운다.
function markPlaying() {
  if (typeof document === 'undefined') return;
  if (playing) document.documentElement.dataset.music = playing.key;
  else delete document.documentElement.dataset.music;
}

// 더는 나지 않는 음악의 풀린 소리를 놓는다(받아 둔 파일은 남겨 다시 풀 수 있게 한다).
// 사라지며 작아지는 곡은 재생 중인 소리 노드가 끝날 때까지 붙들고 있다가 놓는다.
function releaseMusic() {
  const keep = [musicPath(playing?.key), musicPath(pref.on ? wantMusic : null)];
  for (const p of musicToRelease(buffers.keys(), Object.values(ASSETS.audio?.music ?? {}), keep)) {
    buffers.delete(p);
    const buf = ready.get(p);
    ready.delete(p);
    if (buf) regions.delete(buf);
  }
}

function fadeOutMusic() {
  const p = playing;
  playing = null;
  markPlaying();
  if (!p || !ac) return;
  const now = ac.currentTime;
  try {
    p.gain.gain.cancelScheduledValues(now);
    p.gain.gain.setValueAtTime(p.gain.gain.value, now);
    p.gain.gain.linearRampToValueAtTime(0, now + FADE_S);
    p.src.stop(now + FADE_S + 0.05);
  } catch { /* 이미 멈춤 */ }
}

function startMusic(key, buf) {
  const now = ac.currentTime;
  const { start, end } = regionOf(buf);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = start / buf.sampleRate;
  src.loopEnd = end / buf.sampleRate;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + FADE_S);
  src.connect(gain).connect(musicBus);
  src.start(now, src.loopStart);
  fadeOutMusic();
  playing = { key, src, gain };
  markPlaying();
  releaseMusic();
}

// 바라는 음악과 지금 나는 음악을 맞춘다. 꺼져 있으면 음악을 멈춘다(켜면 다시 처음부터).
function syncMusic() {
  if (mode !== 'web' || !ac) return;
  const key = pref.on ? wantMusic : null;
  if ((playing?.key ?? null) === key) { musicToken++; return; }
  const token = ++musicToken;
  if (!key) { fadeOutMusic(); releaseMusic(); return; }
  decode(musicPath(key), { retry: true }).then((buf) => {
    if (token !== musicToken || !ac) { releaseMusic(); return; } // 그사이 다른 음악을 바랐다
    if (!buf) { fadeOutMusic(); releaseMusic(); return; } // 못 받았으면 조용히
    try { startMusic(key, buf); } catch { /* 소리가 게임을 막지 않는다 */ }
  });
}

function ensureContext() {
  if (mode !== 'web') return;
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = pref.on ? pref.volume : 0;
      master.connect(ac.destination);
      musicBus = ac.createGain();
      musicBus.gain.value = MUSIC_LEVEL;
      musicBus.connect(master);
      sfxBus = ac.createGain();
      sfxBus.gain.value = SFX_LEVEL;
      sfxBus.connect(master);
      for (const p of Object.values(ASSETS.audio?.sfx ?? {})) decode(p); // 효과음은 작아서 한꺼번에 받는다
      syncMusic();
    }
    if (ac.state === 'suspended' && document.visibilityState !== 'hidden') ac.resume().then(syncMusic, () => {});
  } catch {
    mode = 'off'; // AudioContext를 만들 수 없는 브라우저: 소리 없이
  }
}

// 처음 한 번 부른다. test: 검사용(소리를 내지 않고 요청만 적는다). onChange: 켜고 끌 때마다(학생 저장에 남기려고).
export function initAudio({ storage: s = null, test = false, onChange: changed = null } = {}) {
  storage = s;
  if (changed) onChange = changed;
  pref = loadPref(storage);
  const hasAC = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  mode = test ? 'stub' : hasAC ? 'web' : 'off';
  if (mode !== 'web') return;
  const unlock = () => ensureContext();
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.visibilityState === 'hidden') ac.suspend().catch(() => {});
    else ac.resume().catch(() => {});
  });
}

// 장면이 바뀔 때(main.js): 그 장면의 음악을 바란다.
export function playMusic(key) {
  if (key === undefined) return;
  if (mode === 'stub') log.music.push(key);
  if (key !== null && !musicPath(key)) key = null; // 모르는 키·파일 없음: 조용히
  wantMusic = key;
  if (mode !== 'web') return;
  if (key) fetchBytes(musicPath(key)); // 첫 누름 전에도 받아 둔다(풀기는 나중에)
  syncMusic();
}

export function sfx(key) {
  if (mode === 'stub') { log.sfx.push(key); return; }
  if (mode !== 'web' || !pref.on || !ac || ac.state !== 'running') return;
  try {
    if (!allowSfx(lastSfx, key, performance.now())) return;
    const path = sfxPath(key);
    const buf = path ? ready.get(path) : null;
    const g = ac.createGain();
    g.gain.value = SFX_GAIN[key] ?? 1;
    g.connect(sfxBus);
    if (buf) {
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      src.start();
    } else if (SYNTH[key]) {
      SYNTH[key](ac, g, ac.currentTime + 0.005);
      if (path) decode(path); // 아직 받는 중이면 다음을 위해 기다린다(못 받은 것은 다시 받지 않는다)
    }
  } catch { /* 소리가 게임을 막지 않는다 */ }
}

export const isSoundOn = () => pref.on;
export const soundPref = () => ({ ...pref });

// 켜기·끄기: 전역 기본값(처음 화면)에도 남긴다. 학생 저장에는 main.js가 저장할 때 얹는다.
export function setSoundOn(on) {
  pref = { ...pref, on: !!on };
  savePref(storage, pref);
  if (mode === 'stub') log.toggles.push(pref.on);
  applyVolume();
  syncMusic();
  refreshButtons();
  try { onChange(pref); } catch { /* 저장 실패는 소리와 상관없다 */ }
}
export const toggleSound = () => setSoundOn(!pref.on);

// 학생 저장을 불러올 때: 그 학생의 설정을 쓴다(없으면 지금 설정 그대로). 전역 기본값은 바꾸지 않는다.
export function useSavePref(state) {
  const p = prefOfSave(state);
  if (!p) return;
  pref = p;
  applyVolume();
  syncMusic();
  refreshButtons();
}
// 처음 화면으로 돌아오면 이 기기의 기본값을 쓴다.
export function useGlobalPref() {
  pref = loadPref(storage);
  applyVolume();
  syncMusic();
  refreshButtons();
}

// 검사용: 지금까지의 요청과 상태
export function audioProbe() {
  return { mode, on: pref.on, volume: pref.volume, want: wantMusic, playing: playing?.key ?? null, music: [...log.music], sfx: [...log.sfx], toggles: [...log.toggles] };
}

// ── 스피커 단추 ─────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
function speakerIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'sound-icon');
  svg.setAttribute('aria-hidden', 'true');
  const part = (tag, attrs) => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    svg.appendChild(e);
    return e;
  };
  part('path', { class: 'body', d: 'M7 18h8l11-9v30l-11-9H7z' });
  part('path', { class: 'wave', d: 'M32 17c3 4 3 10 0 14' });
  part('path', { class: 'wave', d: 'M37 12c6 7 6 17 0 24' });
  part('path', { class: 'cross', d: 'M31 16l13 16M44 16L31 32' });
  return svg;
}

function refreshButtons() {
  if (typeof document === 'undefined') return;
  for (const b of document.querySelectorAll('.sound-toggle')) syncButton(b);
}
function syncButton(b) {
  b.setAttribute('aria-pressed', String(pref.on));
  b.classList.toggle('muted', !pref.on);
  b.title = pref.on ? '소리 끄기 (M)' : '소리 켜기 (M)';
}

// 스피커 단추(아이콘 단추 72×80, 이름 '소리', 키 배지 M). 누르면 켜고 끈다.
export function createSoundButton(extraClass = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn-icon sound-toggle ${extraClass}`.trim();
  b.setAttribute('aria-label', '소리 켜기/끄기');
  const icon = document.createElement('span');
  icon.className = 'icon icon-sound';
  icon.setAttribute('aria-hidden', 'true');
  icon.appendChild(speakerIcon());
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = '소리';
  const badge = document.createElement('span');
  badge.className = 'key-badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = 'M';
  b.append(icon, name, badge);
  syncButton(b);
  b.addEventListener('click', () => {
    toggleSound();
    // 마우스로 누른 뒤 단추에 초점이 남으면 Space·Enter가 말하기 대신 단추를 다시 누른다(HUD 단추와 같다)
    if (document.activeElement === b && b.closest('.hud')) b.blur();
  });
  return b;
}

// M 키로 어디서든 켜고 끈다(글을 쓰는 칸에서는 받지 않는다).
export function isSoundKey(e) {
  if (e.code !== 'KeyM' || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return false;
  const t = e.target;
  const tag = t?.tagName;
  return !(tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable);
}
