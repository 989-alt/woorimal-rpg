// 대화 장면: 타자 효과, 강조 낱말, 뜻풀이 카드.
// 낱말 습득은 대화를 열기 전에 탐험 장면이 이미 해 둔다(새로 고침해도 낱말을 잃지 않도록).
// 여기서는 params.words의 낱말마다 뜻풀이 카드를 이 대화에서 한 번씩 보여 주기만 한다.
import { actOfChapter } from '../../data/acts/index.js';
import { formatLine } from '../rules/josa.js';
import { extractWords, markTip } from '../rules/game.js';
import { blockColor, initial, labelBlockEl } from '../ui/placeholder.js';
import { openMeaningCard } from '../ui/meaning-card.js';
import { ASSETS, bustFor } from '../../data/assets.js';
import { setArt, preloadChapter } from '../ui/images.js';
import { ribbonInk } from '../ui/ink.js';
import { igniteWord, prefersReducedMotion } from '../ui/word-glow.js';

export const TIP_WORD = 'tip-word';
const HERO_COLOR = '#3B5BA5'; // 쪽빛
const GUARD_MS = 200;
const MS_PER_CHAR = 30;
// 줄이 다 찍힌 뒤 낱말이 잿빛에서 금빛이 되는 것을 눈으로 보게 하는 시간(ms). 이 동안은 누름을 받지 않고, 지나면 뜻풀이 카드가 열린다.
export const GLOW_MS = 700;

// 글자가 나오는 빠르기(ms). 검사용(?test=1) fastText만 바꾼다.
let typeSpeed = MS_PER_CHAR;
export function setTypeSpeed(ms) { typeSpeed = ms; }

// 글을 [[낱말]] 기준으로 나눈다.
export function splitHighlights(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/\[\[(.+?)\]\]/g)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], word: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

// 타자 효과. 시간은 tick(ms)로만 흐른다(화면과 무관한 순수 객체).
export function createTypewriter({ full, msPerChar = MS_PER_CHAR }) {
  const chars = Array.from(full);
  const total = chars.length * msPerChar;
  let elapsed = 0;
  let sinceDone = 0;
  const done = () => elapsed >= total;
  const count = () => (msPerChar > 0 ? Math.floor(Math.min(elapsed, total) / msPerChar) : chars.length);
  return {
    shown: () => chars.slice(0, count()).join(''),
    count,
    done,
    // 다 보였고 200ms 기다림도 지났다: 더 흘려보낼 시간이 없다.
    settled: () => done() && sinceDone >= GUARD_MS,
    press() {
      if (!done()) { elapsed = total; sinceDone = 0; return 'reveal'; }
      return sinceDone < GUARD_MS ? 'ignored' : 'next';
    },
    tick(ms) {
      const before = elapsed;
      elapsed += ms;
      if (elapsed >= total) sinceDone += elapsed - Math.max(before, total);
    },
  };
}

// 말하는 쪽: { side, name, color } 또는 해설이면 null
export function resolveSpeaker(line, npcs, from, nickname) {
  if (line.who === 'hero') return { side: 'hero', name: nickname, color: HERO_COLOR };
  if (line.who !== 'npc') return null;
  const npc = (line.npc && npcs.find((n) => n.id === line.npc)) || npcs.find((n) => n.name === from);
  if (npc) return { side: 'npc', name: npc.name, color: npc.color };
  return { side: 'npc', name: from, color: blockColor(from) };
}

// npc 줄의 인물 id(line.npc, 없으면 from 이름으로 찾기). 알 수 없으면 undefined.
export function npcIdOf(line, npcs, from) {
  return ((line.npc && npcs.find((n) => n.id === line.npc)) || npcs.find((n) => n.name === from))?.id;
}

// 이 줄에서 카드를 보여 줄 낱말(줄 안 차례, 중복 없음): params.words에 있고 이 대화에서 아직 카드를 보이지 않은 것.
// 이미 얻었는지(state.acquired)는 보지 않는다. 탐험 장면이 대화를 열기 전에 낱말을 얻어 두기 때문이다.
export function newWordsOf(rawText, words, shown = new Set()) {
  return [...new Set(extractWords(rawText))].filter((w) => words.includes(w) && !shown.has(w));
}

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

export const dialogue = {
  mount(root, params, ctx) {
    const { script = [], words = [], from = '' } = params;
    const initState = ctx.getState();
    const nickname = initState?.nickname ?? '';
    const chapter = initState ? actOfChapter(initState.chapter).chapters.find((c) => c.id === initState.chapter) : null;
    const npcs = chapter?.npcs ?? [];
    const hasHero = script.some((l) => l.who === 'hero');
    const hasNpc = script.some((l) => l.who === 'npc');

    const scene = el('section', 'dialogue-scene');
    scene.dataset.scene = 'dialogue';
    const heroBust = labelBlockEl(initial(nickname), HERO_COLOR, 'bust bust-hero');
    const npcBust = el('span', 'bust bust-npc');
    const box = el('div', 'dialogue-box frame-dialogue');
    box.setAttribute('role', 'button');
    box.tabIndex = 0;
    const tag = el('div', 'name-tag ribbon');
    const text = el('p', 'dialogue-text');
    const arrow = el('span', 'dialogue-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    box.append(tag, text, arrow);
    scene.append(heroBust, npcBust, box);
    root.appendChild(scene);
    // 그림이 있으면 배경·상반신을 그림으로, 없거나 못 불러오면 지금의 임시 그림 그대로
    const avatar = initState?.avatar === 'm' ? 'm' : 'f';
    if (chapter) {
      setArt(scene, ASSETS.dialogueBg[chapter.id], 'dialogue-bg art');
      preloadChapter(chapter.id, avatar);
    }
    let heroFace = 'base';

    let index = -1;
    let tw = null;
    let card = null; // 열려 있는 뜻풀이 카드
    let busy = false; // 이 줄의 낱말 카드를 다 보여 주는 동안(낱말이 빛나는 동안 포함)
    let glowTimer = 0; // 낱말이 빛을 되찾는 동안(이 동안 누름은 받지 않는다)
    let leaving = false;
    let raf = 0;
    let running = false; // 타자 효과 고리가 도는 중
    let last = 0;
    let spans = [];
    let renderedCount = -1; // 마지막으로 그린 글자 수
    let tipEl = null;
    let lastNpc = null;
    const shownCards = new Set(); // 이 대화에서 이미 카드를 보인 낱말

    // 이 줄에서 보일 인물: 지금 줄 또는 가까운 앞 줄, 없으면 뒤 줄의 말하는 이와 그 줄
    const npcLineFor = (i) => {
      for (let j = i; j >= 0; j--) if (script[j].who === 'npc') return j;
      for (let j = i; j < script.length; j++) if (script[j].who === 'npc') return j;
      return -1;
    };
    const npcFor = (i) => {
      const j = npcLineFor(i);
      return j < 0 ? null : resolveSpeaker(script[j], npcs, from, nickname);
    };

    function render() {
      const shown = tw.count();
      renderedCount = shown;
      let used = 0;
      for (const s of spans) {
        const n = Math.max(0, Math.min(s.len, shown - used));
        s.on.textContent = s.chars.slice(0, n).join('');
        s.off.textContent = s.chars.slice(n).join('');
        used += s.len;
      }
    }

    function showLine(i) {
      index = i;
      const line = script[i];
      const raw = formatLine(line.text, nickname);
      const plain = splitHighlights(raw).map((seg) => seg.text).join('');
      tw = createTypewriter({ full: plain, msPerChar: typeSpeed });
      busy = false;
      clearTimeout(glowTimer);
      glowTimer = 0;
      scene.removeAttribute('data-ready');
      tipEl?.remove();
      tipEl = null;
      arrow.hidden = true;
      text.textContent = '';
      spans = splitHighlights(raw).map((seg) => {
        const on = el('span', 'on');
        const off = el('span', 'off');
        let hl = null;
        const wrap = el('span', seg.word ? 'hl' : 'seg');
        if (seg.word) { hl = wrap; hl.dataset.word = seg.word; }
        wrap.append(on, off);
        text.appendChild(wrap);
        return { on, off, hl, chars: Array.from(seg.text), len: Array.from(seg.text).length };
      });
      const sp = resolveSpeaker(line, npcs, from, nickname);
      const narration = !sp;
      box.classList.toggle('narration', narration);
      tag.hidden = narration;
      heroBust.hidden = narration || !hasHero;
      npcBust.hidden = narration || !hasNpc;
      if (!narration) {
        tag.textContent = sp.name;
        tag.dataset.side = sp.side;
        tag.style.setProperty('--speaker-color', sp.color);
        const ink = ribbonInk(sp.color);
        tag.style.setProperty('--speaker-ink', ink);
        tag.style.setProperty('--speaker-outline', ink === '#FFFFFF' ? '#2B2622' : 'transparent');
        const np = npcFor(i);
        if (np && np !== lastNpc && (!lastNpc || np.name !== lastNpc.name)) {
          lastNpc = np;
          npcBust.replaceChildren(labelBlockEl(initial(np.name), np.color, 'bust-block'));
          npcBust.style.setProperty('--band', np.color);
          setArt(npcBust, null); // replaceChildren이 그림도 치웠으므로 앞 인물 그림 표시를 지운다
        }
        if (sp.side === 'hero') heroFace = line.face ?? 'base';
        const nj = npcLineFor(i);
        const speakerId = np && nj >= 0 ? npcIdOf(script[nj], npcs, from) : undefined;
        setArt(heroBust, bustFor(`hero_${avatar}`, heroFace), 'bust-img art');
        setArt(npcBust, speakerId ? bustFor(speakerId, script[nj].face ?? 'base') : null, 'bust-img art');
        heroBust.classList.toggle('listener', sp.side !== 'hero');
        npcBust.classList.toggle('listener', sp.side !== 'npc');
      }
      // 새 낱말은 잿빛으로 찍힌다(줄이 다 찍히면 금빛). 이미 아는 낱말과 움직임 줄이기에서는 처음부터 금빛.
      const fresh = new Set(newWordsOf(raw, words, shownCards));
      for (const s of spans) {
        if (!s.hl) continue;
        const isNew = fresh.has(s.hl.dataset.word);
        if (isNew) s.hl.classList.add('new');
        s.hl.classList.add(isNew && !prefersReducedMotion() ? 'word-dim' : 'word-lit');
      }
      maybeTip();
      render();
      if (tw.done()) sentenceShown(); // 타자 효과 없이 바로 다 나온 줄
      kick();
    }

    // 처음 보는 새 낱말이 나오면 한 번만 안내한다.
    function maybeTip() {
      const st = ctx.getState();
      const target = spans.find((s) => s.hl?.classList.contains('new'));
      if (!st || !target || st.seenTips.includes(TIP_WORD)) return;
      ctx.setState(markTip(st, TIP_WORD));
      tipEl = el('p', 'word-tip', '반짝이는 낱말을 눌러 보세요');
      text.appendChild(tipEl);
      tipEl.style.left = `${target.hl.offsetLeft}px`;
      tipEl.style.top = `${target.hl.offsetTop - 48}px`;
    }

    function sentenceShown() {
      if (busy) return;
      const raw = formatLine(script[index].text, nickname);
      const pending = newWordsOf(raw, words, shownCards);
      if (pending.length === 0) { arrow.hidden = false; return; }
      busy = true;
      tipEl?.remove();
      tipEl = null;
      const cards = [...pending];
      let ignited = false;
      for (const s of spans) if (s.hl?.classList.contains('word-dim')) { igniteWord(s.hl); ignited = true; }
      const next = () => {
        const w = cards.shift();
        if (!w) { busy = false; arrow.hidden = false; syncReady(); return; }
        glowTimer = 0;
        card = openMeaningCard(scene, w, () => {
          card = null;
          kick(); // 카드가 열린 동안 멈췄던 시간(다음 줄로 넘어가기 전 기다림)을 다시 흘린다
          shownCards.add(w);
          spans.find((x) => x.hl?.dataset.word === w)?.hl.classList.remove('new');
          const st = ctx.getState();
          if (st) ctx.store?.save(st); // 안내를 본 표시(seenTips)까지 남긴다. 낱말은 이미 저장되어 있다.
          next();
        });
      };
      if (ignited) glowTimer = window.setTimeout(next, GLOW_MS);
      else next();
    }

    function press() {
      if (card || leaving || !tw || glowTimer) return;
      const r = tw.press();
      if (r === 'reveal') { render(); sentenceShown(); syncReady(); kick(); }
      else if (r === 'next') advance();
    }

    function advance() {
      if (index + 1 < script.length) { showLine(index + 1); return; }
      leaving = true;
      scene.removeAttribute('data-ready');
      ctx.router.show(params.next || 'explore');
    }

    const onKey = (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (e.repeat) return;
      if (card) card.confirmByKey();
      else press();
    };
    window.addEventListener('keydown', onKey);
    box.addEventListener('click', press);
    text.addEventListener('click', (e) => {
      const hl = e.target.closest?.('.hl.new');
      if (!hl || card || glowTimer || tw.done()) return;
      e.stopPropagation();
      tw.press();
      render();
      sentenceShown();
      kick();
    });

    // 지금 누르면 다음 줄로 넘어가는지(줄이 다 보였고, 카드가 없고, 200ms 기다림이 끝남)를 data-ready로 드러낸다.
    // 화면에는 보이지 않는다. 화면 검사가 정해진 시간을 기다리는 대신 이것을 기다린다.
    function syncReady() {
      scene.toggleAttribute('data-ready', !!tw && !card && !busy && !leaving && tw.settled());
    }

    // 타자 효과 고리: 글자 수가 바뀔 때만 글을 고치고, 줄이 다 보이고 기다림이 끝나면(또는 카드가 열리면) 멈춘다.
    // 다음 줄·카드 닫힘·누름이 kick()으로 다시 돌린다.
    function kick() {
      if (running || leaving || !tw || card || tw.settled()) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    const frame = (now) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (!tw || card || leaving) { running = false; syncReady(); return; }
      const was = tw.done();
      tw.tick(dt);
      if (tw.count() !== renderedCount) render();
      if (!was && tw.done()) sentenceShown();
      syncReady();
      if (card || tw.settled()) { running = false; return; }
      raf = requestAnimationFrame(frame);
    };

    if (script.length === 0) {
      leaving = true;
      queueMicrotask(() => { if (scene.isConnected) ctx.router.show(params.next || 'explore'); });
    } else {
      showLine(0);
    }

    return () => {
      leaving = true;
      clearTimeout(glowTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      scene.remove();
    };
  },
};
