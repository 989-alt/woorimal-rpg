// 전체 화면과 가로 고정, 그리고 아이폰 사파리의 "홈 화면에 추가" 안내.
// - 터치 기기에서는 처음 화면의 첫 누름(처음부터·이어하기 또는 화면 아무 곳)에 전체 화면을 켜 본다(되는 브라우저만).
//   전체 화면이 되면 가로로 고정해 본다(안 되면 조용히 넘어간다).
// - 전체 화면 단추(소리 단추 옆)는 Fullscreen API가 되는 곳에만 만든다. F 키로도 켜고 끈다.
// - 아이폰 사파리는 요소 전체 화면이 없다: 처음 화면에 한 번만 "홈 화면에 추가" 안내를 띄운다(닫으면 다시 안 뜬다).

const TIP_KEY = 'woorimal.iosTipSeen';

function doc() { return typeof document === 'undefined' ? null : document; }

// Fullscreen API(표준 또는 webkit 접두사)가 되는가
export function fullscreenSupported(d = doc()) {
  if (!d) return false;
  const el = d.documentElement;
  const enabled = d.fullscreenEnabled ?? d.webkitFullscreenEnabled ?? false;
  return !!enabled && typeof (el.requestFullscreen ?? el.webkitRequestFullscreen) === 'function';
}

export function isFullscreen(d = doc()) {
  return !!(d && (d.fullscreenElement ?? d.webkitFullscreenElement));
}

// 거부·오류는 모두 삼킨다(게임은 전체 화면이 아니어도 된다).
function quiet(fn) {
  try {
    const p = fn();
    if (p && typeof p.then === 'function') return p.then(() => true, () => false);
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

// 가로로 고정해 본다(전체 화면이거나 홈 화면 앱일 때만 되는 브라우저가 많다).
export function lockLandscape() {
  const o = typeof screen === 'undefined' ? null : screen.orientation;
  if (!o || typeof o.lock !== 'function') return Promise.resolve(false);
  return quiet(() => o.lock('landscape'));
}

export function enterFullscreen(d = doc()) {
  if (!fullscreenSupported(d) || isFullscreen(d)) return lockLandscape();
  const el = d.documentElement;
  const req = el.requestFullscreen ? () => el.requestFullscreen({ navigationUI: 'hide' }) : () => el.webkitRequestFullscreen();
  return quiet(req).then(() => lockLandscape());
}

export function exitFullscreen(d = doc()) {
  if (!isFullscreen(d)) return Promise.resolve(false);
  return quiet(() => (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen()));
}

export function toggleFullscreen(d = doc()) {
  return isFullscreen(d) ? exitFullscreen(d) : enterFullscreen(d);
}

// 손가락으로 쓰는 기기인가(탐험의 터치 조작과 같은 기준)
export function isTouchDevice() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

// 아이폰·아이팟 사파리(홈 화면 앱이 아닐 때). 아이패드는 요소 전체 화면이 되므로 빼고,
// 크롬·파이어폭스 등 iOS의 다른 브라우저(CriOS, FxiOS, EdgiOS)는 홈 화면에 추가가 공유 메뉴에 없을 수 있어 뺀다.
export function isIphoneSafari(nav = typeof navigator === 'undefined' ? null : navigator) {
  if (!nav) return false;
  const ua = nav.userAgent ?? '';
  if (!/iPhone|iPod/.test(ua)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
  return nav.standalone !== true;
}

// 홈 화면에서 연 앱(전체 화면·단독 화면)인가
export function isStandalone() {
  if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
  return typeof matchMedia === 'function' && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches);
}

// 처음 화면에서 한 번만: 터치 기기에서 첫 누름에 전체 화면을 켠다. 쪽을 새로 열기 전까지 다시 하지 않는다.
let firstTapArmed = true;
export function armFirstTap(target) {
  if (!firstTapArmed || !isTouchDevice() || isStandalone()) return () => {};
  const onTap = () => {
    if (!firstTapArmed) return;
    firstTapArmed = false;
    target.removeEventListener('click', onTap, true);
    enterFullscreen();
  };
  target.addEventListener('click', onTap, true); // 단추보다 먼저(같은 누름 안에서 불러야 브라우저가 허락한다)
  return () => target.removeEventListener('click', onTap, true);
}

// 전체 화면 단추: 네 귀퉁이 꺾쇠(켜기) / 안으로 꺾인 꺾쇠(끄기). 소리 단추와 같은 아이콘 단추 모양.
function cornersIcon() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('class', 'fs-icon');
  const path = (cls, d) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', cls);
    p.setAttribute('d', d);
    svg.appendChild(p);
  };
  path('open', 'M6 15V6h9M25 6h9v9M34 25v9h-9M15 34H6v-9');
  path('close', 'M15 6v9H6M34 15h-9V6M25 34v-9h9M6 25h9v9');
  return svg;
}

const buttons = new Set();
function sync() {
  const on = isFullscreen();
  for (const b of buttons) b.setAttribute('aria-pressed', String(on));
}
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
}

// 단추를 만든다. Fullscreen API가 없는 곳(아이폰 사파리 등)에서는 null.
export function createFullscreenButton(extraClass = '') {
  if (!fullscreenSupported()) return null;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn-icon fs-toggle ${extraClass}`.trim();
  b.setAttribute('aria-label', '전체 화면 켜기/끄기');
  const icon = document.createElement('span');
  icon.className = 'icon icon-fs';
  icon.setAttribute('aria-hidden', 'true');
  icon.appendChild(cornersIcon());
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = '전체';
  const badge = document.createElement('span');
  badge.className = 'key-badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = 'F';
  b.append(icon, name, badge);
  b.addEventListener('click', () => {
    toggleFullscreen();
    if (document.activeElement === b && b.closest('.hud')) b.blur(); // 초점이 남아 Space가 단추를 다시 누르지 않게(소리 단추와 같다)
  });
  buttons.add(b);
  sync();
  return b;
}
export function forgetFullscreenButton(b) { buttons.delete(b); }

// F 키(글을 쓰는 칸 빼고)
export function isFullscreenKey(e) {
  if (e.code !== 'KeyF' || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return false;
  const t = e.target;
  const tag = t?.tagName;
  return !(tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable);
}

// 아이폰 사파리 안내를 이미 봤는가(닫으면 기록한다)
function tipSeen(storage) {
  try { return storage?.getItem(TIP_KEY) === '1'; } catch { return false; }
}
function markTipSeen(storage) {
  try { storage?.setItem(TIP_KEY, '1'); } catch { /* 저장이 안 되는 창: 이번만 닫힌다 */ }
}

// 처음 화면의 "홈 화면에 추가" 안내(아이폰 사파리에서 한 번만). 띄우지 않으면 null.
export function createIosTip(storage) {
  if (!isIphoneSafari() || tipSeen(storage)) return null;
  const box = document.createElement('div');
  box.className = 'ios-tip frame-plate';
  box.setAttribute('role', 'note');
  const text = document.createElement('div');
  text.className = 'ios-tip-text';
  const title = document.createElement('p');
  title.className = 'ios-tip-title';
  title.textContent = '홈 화면에 추가하면 전체 화면으로 할 수 있어요';
  const how = document.createElement('p');
  how.className = 'ios-tip-how';
  const share = document.createElement('span');
  share.className = 'ios-share';
  share.setAttribute('aria-hidden', 'true');
  how.append('아래쪽 ', share, ' 공유 단추를 누르고 "홈 화면에 추가"를 고르세요.');
  text.append(title, how);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-wood btn-sm ios-tip-close';
  close.textContent = '알겠어요';
  close.addEventListener('click', (e) => {
    e.stopPropagation();
    markTipSeen(storage);
    box.remove();
  });
  box.append(text, close);
  return box;
}
