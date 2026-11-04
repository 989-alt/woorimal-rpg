// 탐험 HUD: 위쪽 한지 띠(현재 할 일, 이 장의 낱말 n/5, 가방 3칸)와 도감·할 일 버튼, 토스트.
import { ACTS } from '../../data/acts/index.js';
import { acquiredCount, chapterWords } from '../rules/game.js';
import { currentTask } from '../rules/quests.js';
import { blockColor, initial, labelBlockEl } from '../ui/placeholder.js';

export const BAG_SLOTS = 3;
export const HUD_HEIGHT = 48;

export function fogMessage(state, chapter) {
  const left = chapterWords(chapter).length - acquiredCount(state, chapter);
  return `아직 찾지 못한 낱말이 ${left}개 있어.`;
}

export function itemName(itemId) {
  for (const act of ACTS) {
    for (const ch of act.chapters) {
      for (const q of ch.quests) if (q.item?.id === itemId) return q.item.name;
      for (const o of ch.objects) if (o.item?.id === itemId) return o.item.name;
    }
  }
  return itemId;
}

function button(label, key, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hud-button';
  b.append(label, ' ');
  const k = document.createElement('kbd');
  k.textContent = key;
  b.append(k);
  b.addEventListener('click', onClick);
  return b;
}

export function createHud({ onCodex, onTasks }) {
  const el = document.createElement('div');
  el.className = 'explore-top';

  const band = document.createElement('div');
  band.className = 'hud';
  const task = document.createElement('p');
  task.className = 'hud-task';
  const dot = document.createElement('span');
  dot.className = 'hud-dot';
  dot.setAttribute('aria-hidden', 'true');
  const taskText = document.createElement('span');
  task.append(dot, taskText);

  const count = document.createElement('p');
  count.className = 'hud-count';

  const bag = document.createElement('ul');
  bag.className = 'hud-bag';
  bag.setAttribute('aria-label', '가방');

  band.append(task, count, bag);
  el.append(band, button('도감', 'E', onCodex), button('할 일', 'Q', onTasks));

  return {
    el,
    update(state, chapter) {
      taskText.textContent = currentTask(state, chapter);
      count.textContent = `이 장의 낱말 ${acquiredCount(state, chapter)}/${chapterWords(chapter).length}`;
      bag.replaceChildren();
      for (let i = 0; i < BAG_SLOTS; i++) {
        const li = document.createElement('li');
        const id = state.bag[i];
        if (id) {
          const name = itemName(id);
          li.title = name;
          li.setAttribute('aria-label', name);
          li.append(labelBlockEl(initial(name), blockColor(name), 'bag-item'));
        } else {
          li.className = 'empty';
          li.setAttribute('aria-label', '빈칸');
        }
        bag.append(li);
      }
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
