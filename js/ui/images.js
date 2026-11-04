// 그림 불러오기: 경로가 null이거나 불러오지 못하면 null. 거부(reject)하지 않는다.
// 불러온 그림은 경로별로 캐시하고, 화면은 getLoaded()로 곧바로 꺼내 쓴다(없으면 임시 그림).
// 불러오지 못한 그림은 그 장면 동안만 null로 두고, 다음 장면을 열 때(forgetFailed) 한 번 더 받아 본다.
import { ASSETS } from '../../data/assets.js';
import { actOfChapter } from '../../data/acts/index.js';

const cache = new Map(); // path -> { img: HTMLImageElement|null, promise, failed }
const listeners = new Set();
const notify = () => { for (const cb of [...listeners]) cb(); };

export function loadImage(path) {
  if (!path || typeof path !== 'string') return Promise.resolve(null);
  const hit = cache.get(path);
  if (hit) return hit.promise;
  const entry = { img: null, promise: null, failed: false };
  cache.set(path, entry);
  entry.promise = new Promise((resolve) => {
    if (typeof Image === 'undefined') { entry.failed = true; resolve(null); return; } // 브라우저가 아닌 곳(검사)
    const img = new Image();
    const finish = (ok) => {
      entry.img = ok ? img : null;
      entry.failed = !ok;
      resolve(entry.img);
      notify();
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = path;
  });
  return entry.promise;
}

// 불러오기에 실패한 경로를 잊는다. 다음에 그 경로를 찾으면 다시 받아 본다.
// 장면을 열 때마다 부른다: 느린 와이파이로 한 번 못 받은 그림을 그 뒤 내내 임시 그림으로 두지 않도록.
// 같은 장면 안에서는 다시 받지 않는다(탐험은 화면마다 getLoaded를 부르므로 실패가 끝없이 되풀이되지 않게).
export function forgetFailed() {
  for (const [path, entry] of cache) if (entry.failed) cache.delete(path);
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

// 한 장에서 쓰는 그림 경로들(용량 검사도 이것으로 장별 합계를 낸다)
export function chapterPaths(act, chapter, avatar) {
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
  // 막 몬스터 그림은 보스전과 (작게) 복습전이 함께 쓰므로 장마다 받는다.
  out.push(ASSETS.small[act.id], ASSETS.bossPixel[act.id], ASSETS.battleBg[act.id], ASSETS.battleHero[hero], ASSETS.monster[act.id]);
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
// 한 host에 A→B→A처럼 빨리 바꾸면 앞서 시작한 A 불러오기가 늦게 끝날 수 있다. 그때는 마지막 부름의 것만 넣는다.
const placed = new WeakMap(); // host -> { path, el }
export function setArt(host, path, className = 'art') {
  const cur = placed.get(host);
  if (cur && cur.path === (path || null)) return;
  cur?.el?.remove();
  const entry = { path: path || null, el: null };
  placed.set(host, entry);
  host.classList.remove('has-art');
  if (!path) return;
  loadImage(path).then((img) => {
    // 그 사이 다른 부름이 host를 차지했거나(앞선 A), 이미 그림을 넣었으면 넣지 않는다.
    if (!img || placed.get(host) !== entry || entry.el || !host.isConnected) return;
    const el = document.createElement('img');
    el.className = className;
    el.alt = '';
    el.draggable = false;
    el.src = img.src;
    entry.el = el;
    host.prepend(el);
    host.classList.add('has-art');
  });
}
