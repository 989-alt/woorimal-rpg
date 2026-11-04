// 그림 불러오기: 경로가 null이거나 불러오지 못하면 null. 거부(reject)하지 않는다.
// 불러온 그림은 경로별로 캐시하고, 화면은 getLoaded()로 곧바로 꺼내 쓴다(없으면 임시 그림).
import { ASSETS } from '../../data/assets.js';
import { actOfChapter } from '../../data/acts/index.js';

const cache = new Map(); // path -> { img: HTMLImageElement|null, promise }
const listeners = new Set();
const notify = () => { for (const cb of [...listeners]) cb(); };

export function loadImage(path) {
  if (!path || typeof path !== 'string') return Promise.resolve(null);
  const hit = cache.get(path);
  if (hit) return hit.promise;
  const entry = { img: null, promise: null };
  cache.set(path, entry);
  entry.promise = new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; } // 브라우저가 아닌 곳(검사)
    const img = new Image();
    const finish = (ok) => {
      entry.img = ok ? img : null;
      resolve(entry.img);
      notify();
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = path;
  });
  return entry.promise;
}

// 이미 불러온 그림(동기). 아직 시작하지 않은 경로면 불러오기를 시작하고 null을 준다.
export function getLoaded(path) {
  if (!path || typeof path !== 'string') return null;
  const hit = cache.get(path);
  if (!hit) { loadImage(path); return null; }
  return hit.img;
}

// 어떤 그림이든 불러오기가 끝나면(성공이든 실패든) 부른다. 돌려주는 함수로 끊는다.
export function onImageLoaded(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const strings = (node, out = []) => {
  if (typeof node === 'string') out.push(node);
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => strings(v, out));
  return out;
};

// 한 장에서 쓰는 그림 경로들
function chapterPaths(act, chapter, avatar) {
  const out = [];
  const hero = avatar === 'm' ? 'm' : 'f';
  out.push(ASSETS.maps[chapter.id], ASSETS.dialogueBg[chapter.id], ASSETS.walk[hero]);
  out.push(...strings(ASSETS.busts[`hero_${hero}`]));
  for (const npc of chapter.npcs) {
    out.push(ASSETS.npcs[npc.id], ...strings(ASSETS.busts[npc.id]));
  }
  const itemIds = new Set(chapter.quests.map((q) => q.item?.id).filter(Boolean));
  for (const obj of chapter.objects) if (obj.item?.id) itemIds.add(obj.item.id);
  for (const id of itemIds) out.push(ASSETS.items[id]);
  out.push(ASSETS.small[act.id], ASSETS.bossPixel[act.id], ASSETS.battleBg[act.id], ASSETS.battleHero[hero]);
  if (chapter === act.chapters[act.chapters.length - 1]) out.push(ASSETS.monster[act.id]);
  return out.filter(Boolean);
}

// 장 그림을 미리 불러온다(끝나면 이행). 같은 막의 다음 장은 뒤에서 이어 시작한다.
export function preloadChapter(chapterId, avatar = 'f') {
  let act;
  try { act = actOfChapter(chapterId); } catch { return Promise.resolve(); }
  const i = act.chapters.findIndex((c) => c.id === chapterId);
  const now = Promise.all(chapterPaths(act, act.chapters[i], avatar).map(loadImage)).then(() => undefined);
  const next = act.chapters[i + 1];
  if (next) now.then(() => { chapterPaths(act, next, avatar).forEach(loadImage); });
  return now;
}

// 자리(host) 안에 그림 <img>를 넣고 host에 has-art를 단다. 경로가 null이거나 불러오기에 실패하면
// 아무것도 하지 않아(또는 앞 그림을 치워) host의 임시 그림이 그대로 보인다.
const placed = new WeakMap(); // host -> { path, el }
export function setArt(host, path, className = 'art') {
  const cur = placed.get(host);
  if (cur && cur.path === (path || null)) return;
  cur?.el?.remove();
  placed.set(host, { path: path || null, el: null });
  host.classList.remove('has-art');
  if (!path) return;
  loadImage(path).then((img) => {
    const now = placed.get(host);
    if (!img || !now || now.path !== path || !host.isConnected) return;
    const el = document.createElement('img');
    el.className = className;
    el.alt = '';
    el.draggable = false;
    el.src = img.src;
    now.el = el;
    host.prepend(el);
    host.classList.add('has-art');
  });
}
