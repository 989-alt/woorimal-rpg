// 탐험 장면: 칸 맵을 걷고, 인물에게 말을 걸고, 물건을 조사한다.
import { actOfChapter } from '../../data/acts/index.js';
import { parseMap, step, facingTarget } from '../explore/grid.js';
import { computeView, ART } from '../explore/scale.js';
import { bindInput, createTouchControls, isCoarsePointer } from '../explore/input.js';
import { drawExplore, cameraFor, animKey, inViewWorld } from '../explore/render.js';
import { nextGlide, drawnPos, glideEnd } from '../explore/motion.js';
import { onImageLoaded, preloadChapter } from '../ui/images.js';
import { createHud, createToast, fogMessage, HUD_INSET } from '../explore/hud.js';
import { chapterOf, chapterComplete, fogOpen, setPos, markTip, takeWords } from '../rules/game.js';
import { talkTo, inspect, fightGate } from '../rules/quests.js';
import { openCodex } from './codex.js';
import { openTasks } from './quests.js';
import { formatLine } from '../rules/josa.js';
import { TIP, dueHint } from '../rules/tutorial.js';
import { createHintLayer } from '../ui/hint.js';

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
      hints.clear();
      ctx.router.show(name, routeParams);
    };
    // 상태를 바꾸고 HUD를 고친다. 장면을 떠날 참이면 check=false로 불러(떠나는 장면에서 안내를 띄우고 본 것으로 기록하지 않게) 부르는 쪽이 정한다.
    const update = (next, check = true) => {
      state = next;
      ctx.setState(next);
      hud.update(state, chapter);
      if (check) checkHint();
    };

    // 도감·할 일 겹침 창: 하나만 열리고, 열려 있는 동안은 걷기·말하기를 멈춘다.
    let overlay = null; // { kind, close }
    const closeOverlay = () => { overlay?.close(); };
    const toggle = (kind, open) => {
      if (leaving) return;
      if (overlay?.kind === kind) { closeOverlay(); return; }
      closeOverlay();
      hints.clear(); // 겹침 창이 열리면 안내는 걷어 낸다(닫은 뒤 다시 띄우지 않는다: 이미 본 것으로 기록했다)
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

    const hints = createHintLayer(stage);
    const firstQuest = chapter.quests[0];
    const firstGiver = chapter.npcs.find((n) => n.id === firstQuest.giver);
    const tipTarget = () =>
      !state.seenTips.includes(TIP.FIRST_NPC) && state.quests[firstQuest.id]?.stage === 'open' && firstGiver
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

    // 안내 앵커: 세계 좌표 → 화면 CSS px(__test.view와 같은 식). 그린 적이 없으면 null.
    let shot = null; // 마지막으로 그린 때의 { camera, heroAt }
    const toCss = (wx, wy) => ({ x: (wx - shot.camera.x) * ART * scale, y: (wy - shot.camera.y) * ART * scale });
    const tileRect = (tx, ty, up = 0) => { // 칸(위로 up 세계 단위 솟은 키)을 화면 사각형으로
      const a = toCss(tx * 16, ty * 16 - up);
      return { x: a.x, y: a.y, w: 16 * ART * scale, h: (16 + up) * ART * scale };
    };
    const heroAnchor = () => {
      if (!shot) return null;
      const r = tileRect(shot.heroAt.x, shot.heroAt.y, 16); // 키가 칸의 두 배
      if (state.facing !== 'up') return r;
      const above = tileRect(state.pos.x, state.pos.y - 1, 16); // 위를 보고 서 있으면 위쪽 사람 머리도 가리지 않게 함께 감싼다
      return { x: r.x, y: above.y, w: r.w, h: r.y + r.h - above.y };
    };
    const hiddenSpot = map.objects[chapter.hidden.object];
    const sparkleAnchor = () => {
      if (!shot || !hiddenSpot) return null;
      const r = tileRect(hiddenSpot.x, hiddenSpot.y);
      const h = shot.heroAt;
      if (Math.abs(h.x - hiddenSpot.x) > 1 || Math.abs(h.y - hiddenSpot.y) > 1) return r;
      const me = tileRect(h.x, h.y, 16); // 바로 곁에 서 있으면 주인공도 함께 감싸 꼬리가 주인공을 덮지 않게 한다
      const x = Math.min(r.x, me.x), y = Math.min(r.y, me.y);
      return { x, y, w: Math.max(r.x + r.w, me.x + me.w) - x, h: Math.max(r.y + r.h, me.y + me.h) - y };
    };
    const anchorOf = { hero: heroAnchor, sparkle: sparkleAnchor, 'tasks-button': hud.tasksButton };

    // 지금 띄울 안내를 묻고(규칙은 tutorial.js), 띄우면 본 것으로 기록한다. 같은 안내가 이미 떠 있으면 다시 띄우지 않는다.
    function checkHint() {
      if (leaving || overlay) return;
      const facing = facingTarget(map, state.pos, state.facing, opts())?.kind ?? null;
      if (hints.current?.id === TIP.TALK && facing !== 'npc') hints.clear();
      const spot = hiddenSpot && { x: hiddenSpot.x * 16 + 8, y: hiddenSpot.y * 16 + 8 };
      const sparkleInView = !!(shot && spot && inViewWorld(shot.camera, box, spot) && spot.y >= shot.camera.y + box.insetTop);
      const hint = dueHint(state, chapter, { type: 'explore', facing, sparkleInView }, { touch: isCoarsePointer() });
      if (!hint || hint.id === hints.current?.id) return;
      state = markTip(state, hint.id);
      ctx.setState(state);
      hints.show(hint, anchorOf[hint.anchor]);
    }

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
      shot = { camera, heroAt };
      if (window.__test) { // 검사용: 마지막으로 그려진 주인공 자리와 카메라·배율
        window.__test.heroAt = heroAt;
        window.__test.view = { camera, factor: scale, viewW: box.w, viewH: box.h, insetTop: box.insetTop };
      }
      drawn = { state, size, anim };
      if (first) { first = false; checkHint(); } // 첫 그림이 나온 뒤에야 앵커가 정해진다
      hints.reposition();
    };
    let first = true;
    raf = requestAnimationFrame(frame);

    const opts = () => ({ fogOpen: fogOpen(state, chapter), smallMonsterGone: !!state.smallGone?.[chapter.id] });

    function move(dir) {
      if (leaving || overlay) return;
      const r = step(map, state.pos, dir, opts());
      if (!still && (r.pos.x !== state.pos.x || r.pos.y !== state.pos.y)) glide = nextGlide(glide, state.pos, r.pos, performance.now());
      hints.done('move');
      update(setPos(state, r.pos, r.facing));
    }

    function act() {
      if (leaving || overlay) return;
      const target = facingTarget(map, state.pos, state.facing, opts());
      if (!target) return;
      if (target.kind === 'npc') {
        const npc = chapter.npcs.find((n) => n.slot === target.slot);
        if (!npc) return;
        hints.done('talk');
        const r = talkTo(state, chapter, npc.id);
        const got = takeWords(r.state, r.words, npc.name);
        update(npc.id === firstQuest.giver ? markTip(got.state, TIP.FIRST_NPC) : got.state, false);
        if (r.script.length > 0) go('dialogue', { script: r.script, words: got.fresh, from: npc.name });
        else checkHint();
      } else if (target.kind === 'object') {
        const obj = chapter.objects.find((o) => o.slot === target.slot);
        if (!obj) return;
        hints.done('inspect');
        const r = inspect(state, chapter, obj.slot);
        const got = takeWords(r.state, r.words, obj.name);
        const stays = r.script.length === 0 || (r.script.length === 1 && r.words.length === 0 && r.script[0].who === 'narration');
        update(got.state, stays);
        if (r.script.length === 0) return;
        if (stays) {
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
      hints.dispose();
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
