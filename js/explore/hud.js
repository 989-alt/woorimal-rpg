// 탐험 HUD: 메달·할 일 두루마리, 낱말 n/5와 가방 3칸 명판, 도감·할 일 아이콘 단추, 토스트.
import { ACTS } from '../../data/acts/index.js';
import { acquiredCount, chapterWords, wordsLeftText } from '../rules/game.js';
import { nextGoal } from '../rules/guide.js';
import { visibleNpcs } from '../rules/quests.js';
import { ASSETS, bustFor } from '../../data/assets.js';
import { setArt } from '../ui/images.js';
import { blockColor, initial, labelBlockEl, textOn } from '../ui/placeholder.js';

export const BAG_SLOTS = 3;

export const fogMessage = wordsLeftText;

export function itemName(itemId) {
  for (const act of ACTS) {
    for (const ch of act.chapters) {
      for (const q of ch.quests) if (q.item?.id === itemId) return q.item.name;
      for (const o of ch.objects) if (o.item?.id === itemId) return o.item.name;
    }
  }
  return itemId;
}

// 위쪽 HUD가 덮는 높이(CSS px). 카메라는 이 아래 영역의 가운데에 주인공을 둔다.
export const HUD_INSET = 88;

// 도감·할 일 아이콘 단추(72×80): 아이콘 + 이름 + 모서리의 키 배지
function button(label, key, iconClass, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-icon hud-button';
  b.setAttribute('aria-label', `${label} (${key})`);
  const icon = document.createElement('span');
  icon.className = `icon ${iconClass}`;
  icon.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = label;
  const badge = document.createElement('span');
  badge.className = 'key-badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = key;
  b.append(icon, name, badge);
  b.addEventListener('click', () => {
    onClick();
    // 마우스로 누른 뒤 단추에 초점이 남으면 Space·Enter가 말하기 대신 단추를 다시 누른다.
    if (document.activeElement === b) b.blur();
  });
  return b;
}

// 가방 칸 하나: 물건 그림(32px)이 있으면 그림, 없으면 이름 첫 글자 블록
function bagSlot(id) {
  const li = document.createElement('li');
  if (!id) {
    li.className = 'empty';
    li.setAttribute('aria-label', '빈칸');
    return li;
  }
  const name = itemName(id);
  li.title = name;
  li.setAttribute('aria-label', name);
  const block = labelBlockEl(initial(name), blockColor(name), 'bag-item');
  setArt(block, ASSETS.items[id], 'bag-art');
  li.append(block);
  return li;
}

// 동료 초상 하나(지름 48): 상반신 그림을 얼굴 쪽으로 잘라 쓰고, 그림이 없으면 인물 색 바탕에 이름 첫 글자
function companionBadge(npc) {
  const el = document.createElement('span');
  el.className = 'medallion hud-companion';
  el.dataset.npc = npc.id;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `동료 ${npc.name}`);
  el.title = npc.name;
  const clip = document.createElement('span');
  clip.className = 'hud-companion-clip';
  const face = document.createElement('span');
  face.className = 'hud-companion-initial';
  face.setAttribute('aria-hidden', 'true');
  face.textContent = initial(npc.name);
  face.style.background = npc.color;
  face.style.color = textOn(npc.color);
  el.append(clip, face);
  setArt(clip, bustFor(npc.id, 'base'), 'hud-companion-face');
  return el;
}

// 위쪽 HUD(캔버스 위의 HTML 층): 왼쪽 메달 + 지금 할 일 두루마리, 오른쪽 낱말·가방 명판과 도감·할 일 단추.
// 두루마리 글은 setTaskText 한 곳에서만 바꾸고, 늘 지금 할 일(nextGoal)을 보여 준다.
export function createHud({ onCodex, onTasks, avatar = 'f' }) {
  const el = document.createElement('div');
  el.className = 'hud';

  const medallion = document.createElement('div');
  medallion.className = 'medallion hud-medallion';
  const face = document.createElement('span'); // 그림이 없을 때 이름 첫 글자
  face.className = 'hud-initial';
  face.setAttribute('aria-hidden', 'true');
  const clip = document.createElement('span'); // 얼굴 그림을 둥글게 자르는 창(확대한 그림이 메달 밖으로 새지 않게)
  clip.className = 'hud-face-clip';
  medallion.append(clip, face);
  setArt(clip, bustFor(`hero_${avatar === 'm' ? 'm' : 'f'}`, 'base'), 'hud-face');

  const companions = document.createElement('div'); // 함께 다니는 동료(지금 맵에 서 있는 동료만)
  companions.className = 'hud-companions';

  const task = document.createElement('p');
  task.className = 'hud-task frame-scroll';
  const dot = document.createElement('span');
  dot.className = 'hud-dot';
  dot.setAttribute('aria-hidden', 'true');
  const taskText = document.createElement('span');
  taskText.className = 'hud-task-text';
  task.append(dot, taskText);

  const words = document.createElement('div');
  words.className = 'hud-words frame-plate';
  const count = document.createElement('p');
  count.className = 'hud-count';
  const bag = document.createElement('ul');
  bag.className = 'hud-bag';
  bag.setAttribute('aria-label', '가방');
  words.append(count, bag);

  const codexButton = button('도감', 'E', 'icon-book', onCodex);
  const tasksButton = button('할 일', 'Q', 'icon-scroll', onTasks);
  el.append(medallion, companions, task, words, codexButton, tasksButton);

  let bagKey = null;
  let companionKey = null;
  const setTaskText = (text) => { if (taskText.textContent !== text) taskText.textContent = text; };

  return {
    el,
    codexButton,
    tasksButton,
    setTaskText,
    update(state, chapter) {
      setTaskText(nextGoal(state, chapter).text);
      face.textContent = initial(state.nickname);
      face.style.background = blockColor(state.nickname);
      face.style.color = textOn(blockColor(state.nickname));
      count.textContent = `이 장의 낱말 ${acquiredCount(state, chapter)}/${chapterWords(chapter).length}`;
      // 걸을 때마다 불리므로, 동료와 가방은 바뀐 때만 칸을 다시 만든다(그림이 깜박이지 않게).
      const here = visibleNpcs(state, chapter).filter((n) => n.companion);
      const cKey = here.map((n) => n.id).join(',');
      if (cKey !== companionKey) {
        companionKey = cKey;
        companions.replaceChildren(...here.map(companionBadge));
      }
      const key = Array.from({ length: BAG_SLOTS }, (_, i) => state.bag[i] ?? '').join(',');
      if (key === bagKey) return;
      bagKey = key;
      bag.replaceChildren(...Array.from({ length: BAG_SLOTS }, (_, i) => bagSlot(state.bag[i])));
    },
  };
}

// 화면 가운데 아래에 잠깐 뜨는 한 줄 안내
export function createToast(container) {
  const el = document.createElement('p');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.hidden = true;
  container.appendChild(el);
  let timer = null;
  return {
    show(text, ms = 2000) {
      clearTimeout(timer);
      el.textContent = text;
      el.hidden = false;
      timer = setTimeout(() => { el.hidden = true; }, ms);
    },
    dispose() {
      clearTimeout(timer);
      el.remove();
    },
  };
}
