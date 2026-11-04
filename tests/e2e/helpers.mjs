// 화면 검사에서 같이 쓰는 걷기 도움 함수.
import { isWalkable, parseMap } from '../../js/explore/grid.js';
import ACT1 from '../../data/acts/act1.js';

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

// 탐험 화면에서 지금 자리부터 출구 칸까지 키보드로 걷는다(마지막 걸음이 장·막 클리어를 연다).
// opts: 걸을 수 있는 칸을 정하는 규칙(기본은 몬스터·안개·보스가 모두 사라진 뒤)
export async function walkToExit(page, opts = { fogOpen: true, smallMonsterGone: true, bossGone: true }) {
  const s = await page.evaluate(() => window.__test.state());
  const chapter = ACT1.chapters.find((c) => c.id === s.chapter);
  const dirs = pathTo(parseMap(chapter.map.rows), s.pos, chapter.exit, opts);
  if (dirs.length === 0) throw new Error(`walkToExit: ${s.chapter}의 출구까지 길이 없다 (${JSON.stringify(s.pos)})`);
  for (const dir of dirs) await page.keyboard.press(KEYS[dir]);
}
