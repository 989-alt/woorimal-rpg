// 탐험 장면: 칸 맵을 걷고, 인물에게 말을 걸고, 물건을 조사한다.
import { actOfChapter } from '../../data/acts/index.js';
import { parseMap, step, facingTarget } from '../explore/grid.js';
import { computeScale, BASE_W, BASE_H } from '../explore/scale.js';
import { bindInput, createTouchControls, isCoarsePointer } from '../explore/input.js';
import { drawExplore, cameraFor, animKey } from '../explore/render.js';
import { createHud, createToast, fogMessage, HUD_HEIGHT } from '../explore/hud.js';
import { chapterOf, chapterComplete, fogOpen, setPos, markTip, takeWords } from '../rules/game.js';
import { talkTo, inspect, fightGate } from '../rules/quests.js';
import { openCodex } from './codex.js';
import { openTasks } from './quests.js';
import { formatLine } from '../rules/josa.js';

export const TIP_MOVE = 'move';
export const TIP_FIRST_NPC = 'first-npc';
const TOP_SPACE = HUD_HEIGHT + 8; // HUD 띠 + 캔버스와의 간격

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const explore = {
  mount(root, params, ctx) {
    let state = ctx.getState();
    if (!state) return () => {};
    const actData = actOfChapter(state.chapter);
    const chapter = chapterOf(actData, state.chapter);
    const map = parseMap(chapter.map.rows);
    let leaving = false;

    const el = document.createElement('section');
    el.dataset.scene = 'explore';
    root.appendChild(el);

    // 앞 장의 낱말을 다 모았으면(대화에서 돌아온 때 등) 장 클리어로 넘어간다.
    const isLast = actData.chapters[actData.chapters.length - 1].id === chapter.id;
    if (!isLast && chapterComplete(state, chapter)) {
      leaving = true;
      queueMicrotask(() => { if (el.isConnected) ctx.router.show('clear', { kind: 'chapter' }); });
      return () => el.remove();
    }

    const go = (name, routeParams) => {
      if (leaving) return;
      leaving = true;
      ctx.router.show(name, routeParams);
    };
    const update = (next) => {
      state = next;
      ctx.setState(next);
      hud.update(state, chapter);
    };

    // 도감·할 일 겹침 창: 하나만 열리고, 열려 있는 동안은 걷기·말하기를 멈춘다.
    let overlay = null; // { kind, close }
    const closeOverlay = () => { overlay?.close(); };
    const toggle = (kind, open) => {
      if (leaving) return;
      if (overlay?.kind === kind) { closeOverlay(); return; }
      closeOverlay();
      const entry = { kind };
      entry.close = open(() => { if (overlay === entry) overlay = null; });
      overlay = entry;
    };
    // 겹침 창을 닫을 때 HUD 단추로는 초점을 돌려주지 않는다(Space·Enter가 말하기로 쓰이도록). 지도 쪽으로 준다.
    const focusAfter = (opener) => (opener && hud.el.contains(opener) ? stage : opener);
    const showCodex = () => toggle('codex', (onClose) => openCodex(el, state, { actTab: state.act, onClose, focusAfter }));
    const showTasks = () => toggle('tasks', (onClose) => openTasks(el, state, chapter, { onClose, focusAfter }));

    const hud = createHud({ onCodex: showCodex, onTasks: showTasks });
    const stage = document.createElement('div');
    stage.className = 'explore-stage';
    stage.tabIndex = -1; // 겹침 창을 닫은 뒤 초점을 받을 자리
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `${chapter.title} 지도`);
    stage.appendChild(canvas);
    el.append(hud.el, stage);
    hud.update(state, chapter);
    const toast = createToast(stage);

    let tip = null;
    if (!state.seenTips.includes(TIP_MOVE)) {
      tip = document.createElement('p');
      tip.className = 'explore-tip';
      tip.textContent = '방향키로 걸어 보세요';
      stage.appendChild(tip);
    }
    const firstQuest = chapter.quests[0];
    const firstGiver = chapter.npcs.find((n) => n.id === firstQuest.giver);
    const tipTarget = () =>
      !state.seenTips.includes(TIP_FIRST_NPC) && state.quests[firstQuest.id]?.stage === 'open' && firstGiver
        ? map.slots[firstGiver.slot]
        : null;

    const g = canvas.getContext('2d');
    let size = 0; // 캔버스 크기를 바꿀 때마다 늘린다(크기를 바꾸면 그림이 지워진다)
    const fit = () => {
      size++;
      const dpr = window.devicePixelRatio || 1;
      const { scale, cssWidth, cssHeight } = computeScale(window.innerWidth, Math.max(BASE_H, window.innerHeight - TOP_SPACE), dpr);
      canvas.width = BASE_W * scale;
      canvas.height = BASE_H * scale;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      el.style.width = `${cssWidth}px`;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.imageSmoothingEnabled = false;
    };
    fit();
    window.addEventListener('resize', fit);

    const still = reducedMotion();
    let raf = 0;
    let drawn = null; // 마지막으로 그린 때의 { state, size, anim }
    // 상태(자리·부탁 등)가 바뀌었거나, 화면 안의 움직이는 그림이 바뀌었거나, 캔버스가 지워졌을 때만 다시 그린다.
    // 겹침 창이 열려 있는 동안은 (캔버스가 지워진 때가 아니면) 그리지 않는다.
    const frame = (time) => {
      raf = requestAnimationFrame(frame);
      if (overlay && drawn?.size === size) return;
      const view = { map, state, chapter, camera: cameraFor(map, state.pos), time, tipTarget: tipTarget(), still };
      const anim = animKey(view);
      if (drawn && drawn.state === state && drawn.size === size && drawn.anim === anim) return;
      drawExplore(g, view);
      drawn = { state, size, anim };
    };
    raf = requestAnimationFrame(frame);

    const opts = () => ({ fogOpen: fogOpen(state, chapter), smallMonsterGone: !!state.smallGone?.[chapter.id] });

    function move(dir) {
      if (leaving || overlay) return;
      const r = step(map, state.pos, dir, opts());
      let next = setPos(state, r.pos, r.facing);
      if (tip) {
        next = markTip(next, TIP_MOVE);
        tip.remove();
        tip = null;
      }
      update(next);
    }

    function act() {
      if (leaving || overlay) return;
      const target = facingTarget(map, state.pos, state.facing, opts());
      if (!target) return;
      if (target.kind === 'npc') {
        const npc = chapter.npcs.find((n) => n.slot === target.slot);
        if (!npc) return;
        const r = talkTo(state, chapter, npc.id);
        const got = takeWords(r.state, r.words, npc.name);
        update(npc.id === firstQuest.giver ? markTip(got.state, TIP_FIRST_NPC) : got.state);
        if (r.script.length > 0) go('dialogue', { script: r.script, words: got.fresh, from: npc.name });
      } else if (target.kind === 'object') {
        const obj = chapter.objects.find((o) => o.slot === target.slot);
        if (!obj) return;
        const r = inspect(state, chapter, obj.slot);
        const got = takeWords(r.state, r.words, obj.name);
        update(got.state);
        if (r.script.length === 0) return;
        if (r.script.length === 1 && r.words.length === 0 && r.script[0].who === 'narration') {
          toast.show(formatLine(r.script[0].text, state.nickname));
        } else {
          go('dialogue', { script: r.script, words: got.fresh, from: obj.name });
        }
      } else if (target.kind === 'small' || target.kind === 'boss') {
        const gate = fightGate(state, chapter, target.kind);
        if (gate.ok) go('battle', { mode: target.kind === 'boss' ? 'boss' : 'review' });
        else if (gate.message) toast.show(gate.message);
      } else if (target.kind === 'fog') {
        toast.show(fogMessage(state, chapter));
      }
    }

    const unbind = bindInput(window, { move, act, codex: showCodex, tasks: showTasks });
    const removeTouch = isCoarsePointer() ? createTouchControls(stage, { move, act }) : () => {};

    return () => {
      leaving = true;
      closeOverlay();
      cancelAnimationFrame(raf);
      unbind();
      removeTouch();
      toast.dispose();
      window.removeEventListener('resize', fit);
      el.remove();
    };
  },
};
