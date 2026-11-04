// 화면 검사에서 같이 쓰는 걷기 도움 함수.
import { isWalkable } from '../../js/explore/grid.js';

export const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// from에서 to까지 걸을 수 있는 칸으로만 가는 방향 목록(가장 짧은 길)
export function pathTo(map, from, to, opts) {
  const prev = new Map([[`${from.x},${from.y}`, null]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift();
    if (p.x === to.x && p.y === to.y) break;
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      const n = { x: p.x + dx, y: p.y + dy };
      const k = `${n.x},${n.y}`;
      if (!prev.has(k) && isWalkable(map, n.x, n.y, opts)) { prev.set(k, { from: p, dir }); queue.push(n); }
    }
  }
  const dirs = [];
  for (let k = `${to.x},${to.y}`; prev.get(k); ) {
    const { from: p, dir } = prev.get(k);
    dirs.unshift(dir);
    k = `${p.x},${p.y}`;
  }
  return dirs;
}
