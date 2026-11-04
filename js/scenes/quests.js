// 할 일: 이 장의 부탁, 숨은 낱말, (막의 마지막 장이면) 그림자.
import { actOfChapter } from '../../data/acts/index.js';
import { questList } from '../rules/quests.js';
import { mountOverlay } from '../ui/overlay.js';

const LABEL = { locked: '?', open: '받기 전', active: '하는 중', ready: '돌아가서 알리기', done: '완료' };

function row(title, label, done) {
  const li = document.createElement('li');
  li.className = `task-row${done ? ' done' : ''}`;
  li.tabIndex = 0;
  const name = document.createElement('span');
  name.className = 'task-title';
  name.textContent = title;
  const st = document.createElement('span');
  st.className = 'task-stage';
  if (done) {
    const check = document.createElement('span');
    check.className = 'task-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';
    st.append(check, ' ');
  }
  st.append(label);
  li.append(name, st);
  return li;
}

export function openTasks(root, state, chapter, { onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'overlay tasks';
  const panel = document.createElement('div');
  panel.className = 'overlay-panel';
  const head = document.createElement('div');
  head.className = 'overlay-head';
  const title = document.createElement('h2');
  title.textContent = `할 일 · ${chapter.title}`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'big-button tasks-close';
  closeBtn.textContent = '닫기';
  head.append(title, closeBtn);

  const list = document.createElement('ul');
  list.className = 'task-list';
  for (const q of questList(state, chapter)) {
    list.appendChild(row(q.stage === 'locked' ? '?' : q.title, LABEL[q.stage], q.stage === 'done'));
  }
  const found = !!state.hiddenFound?.[chapter.id];
  list.appendChild(row('숨은 낱말', found ? '찾음' : '못 찾음', false));
  const { chapters } = actOfChapter(chapter.id);
  if (chapters[chapters.length - 1].id === chapter.id) list.appendChild(row('그림자를 물리쳐라', '', false));
  // 이름과 상태를 한 줄로 읽히게: "숨은 낱말: 찾음"
  const hiddenRow = list.children[list.children.length - (chapters[chapters.length - 1].id === chapter.id ? 2 : 1)];
  hiddenRow.querySelector('.task-title').textContent = `숨은 낱말: ${found ? '찾음' : '못 찾음'}`;
  hiddenRow.querySelector('.task-stage').textContent = '';

  panel.append(head, list);
  el.appendChild(panel);
  const close = mountOverlay(root, el, { label: '할 일', onClose });
  closeBtn.addEventListener('click', close);
  closeBtn.focus();
  return close;
}
