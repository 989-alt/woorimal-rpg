// 탐험 장면: 칸 맵을 걷고, 인물에게 말을 걸고, 물건을 조사한다.
import { actOfChapter } from '../../data/acts/index.js';
import { parseMap, step, facingTarget } from '../explore/grid.js';
import { computeView, ART } from '../explore/scale.js';
import { bindInput, createTouchControls, isCoarsePointer } from '../explore/input.js';
import { drawExplore, cameraFor, animKey } from '../explore/render.js';
import { nextGlide, drawnPos, glideEnd } from '../explore/motion.js';
import { onImageLoaded, preloadChapter } from '../ui/images.js';
import { createHud, createToast, fogMessage, HUD_INSET } from '../explore/hud.js';
import { chapterOf, chapterComplete, fogOpen, setPos, markTip, takeWords } from '../rules/game.js';
import { talkTo, inspect, fightGate } from '../rules/quests.js';
import { openCodex } from './codex.js';
import { openTasks } from './quests.js';
import { formatLine } from '../rules/josa.js';

export const TIP_MOVE = 'move';
export const TIP_FIRST_NPC = 'first-npc';

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

    const hud = createHud({ onCodex: showCodex, onTasks: showTasks, avatar: state.avatar });
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
    let box = { w: 0, h: 0, insetTop: 0 }; // 보이는 세계 크기와 HUD가 덮는 세계 높이
    let scale = 1; // CSS 크기 / 캔버스 안쪽 크기 (1이면 1:1)
    const fit = () => {
      size++;
      const v = computeView(window.innerWidth, window.innerHeight);
      canvas.width = v.canvasW;
      canvas.height = v.canvasH;
      canvas.style.width = `${v.cssW}px`;
      canvas.style.height = `${v.cssH}px`;
      // 1:1이면 도트를 또렷하게, 줄여 보일 때는 부드럽게(최근접으로 줄이면 선이 끊긴다)
      canvas.style.imageRendering = v.factor === 1 ? 'pixelated' : 'auto';
      scale = v.factor;
      box = { w: v.viewW, h: v.viewH, insetTop: HUD_INSET / (v.factor * ART) };
      // 그리는 코드는 세계 좌표(칸 16)를 그대로 쓴다
      g.setTransform(ART, 0, 0, ART, 0, 0);
      g.imageSmoothingEnabled = false;
    };
    fit();
    window.addEventListener('resize', fit);

    const still = reducedMotion();
    let raf = 0;
    let drawn = null; // 마지막으로 그린 때의 { state, size, anim }
    let glide = null; // 마지막 걸음의 { from, to, startedAt, ms }: 그림만 이 길을 미끄러진다(규칙의 state.pos는 바로 바뀐다)
    const WALK_TAIL_MS = 34; // 미끄러짐이 끝난 뒤에도 이 시간 안에 다음 걸음이 오면 계속 걷는 모습(꾹 누른 때)
    // 그림 한 장이 막 도착하면 상태가 그대로여도 다시 그린다.
    let resetBy = 'start'; // 검사용: 마지막으로 다시 그리게 한 까닭
    const stopImages = onImageLoaded(() => { drawn = null; resetBy = 'image'; });
    // 글꼴이 늦게 오면(font-display: swap) 가만히 있는 화면의 캔버스 글자(머리 위 표시 등)가 대신 글꼴로 남는다. 한 번 다시 그린다.
    document.fonts?.ready.then(() => { drawn = null; resetBy = 'fonts'; });
    preloadChapter(state.chapter, state.avatar);
    // 상태(자리·부탁 등)가 바뀌었거나, 화면 안의 움직이는 그림이 바뀌었거나, 캔버스가 지워졌을 때만 다시 그린다.
    // 겹침 창이 열려 있는 동안은 (캔버스가 지워진 때가 아니면) 그리지 않는다.
    const frame = (time) => {
      raf = requestAnimationFrame(frame);
      if (overlay && drawn?.size === size) return;
      const heroAt = drawnPos(glide, state.pos, time); // 상태 자리와 다른 곳으로 옮겨진 때(순간이동·불러오기)는 미끄러지지 않는다
      const moving = !!glide && glide.to.x === state.pos.x && glide.to.y === state.pos.y && time < glideEnd(glide) + WALK_TAIL_MS;
      const camera = cameraFor(map, heroAt, box, box.insetTop);
      const view = { map, state, chapter, camera, view: box, time, tipTarget: tipTarget(), still, moving, heroAt };
      const anim = animKey(view);
      if (drawn && drawn.state === state && drawn.size === size && drawn.anim === anim) return;
      if (window.__test) {
        const why = !drawn ? resetBy : drawn.state !== state ? 'state' : drawn.size !== size ? 'size' : `anim ${drawn.anim}→${anim}`;
        (window.__test.draws ??= []).push([Math.round(time), why]);
      }
      drawExplore(g, view);
      if (window.__test) { // 검사용: 마지막으로 그려진 주인공 자리와 카메라·배율
        window.__test.heroAt = heroAt;
        window.__test.view = { camera, factor: scale, viewW: box.w, viewH: box.h, insetTop: box.insetTop };
      }
      drawn = { state, size, anim };
    };
    raf = requestAnimationFrame(frame);

    const opts = () => ({ fogOpen: fogOpen(state, chapter), smallMonsterGone: !!state.smallGone?.[chapter.id] });

    function move(dir) {
      if (leaving || overlay) return;
      const r = step(map, state.pos, dir, opts());
      if (!still && (r.pos.x !== state.pos.x || r.pos.y !== state.pos.y)) glide = nextGlide(glide, state.pos, r.pos, performance.now());
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
      stopImages();
      unbind();
      removeTouch();
      toast.dispose();
      window.removeEventListener('resize', fit);
      el.remove();
    };
  },
};
