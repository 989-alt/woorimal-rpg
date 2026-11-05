// 칸 맵: x = 열, y = 행, rows[y][x]
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function parseMap(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('parseMap: 줄이 없습니다');
  const w = rows[0].length;
  const h = rows.length;
  let start = null, boss = null, smallMonster = null;
  const slots = {}, objects = {}, fog = [];
  const count = { S: 0, M: 0, m: 0 };
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`parseMap: 줄 ${y}의 길이(length)가 ${row.length}로 다릅니다 (기준 ${w})`);
    for (let x = 0; x < w; x++) {
      const c = row[x];
      const p = { x, y };
      if (c === 'S') { count.S++; start = p; }
      else if (c === 'M') { count.M++; boss = p; }
      else if (c === 'm') { count.m++; smallMonster = p; }
      else if (c === 'F') fog.push(p);
      else if (c >= 'a' && c <= 'e') {
        if (slots[c]) throw new Error(`parseMap: 인물 '${c}'가 두 번 나옵니다`);
        slots[c] = p;
      } else if (c >= '0' && c <= '9') {
        if (objects[c]) throw new Error(`parseMap: 물건 '${c}'가 두 번 나옵니다`);
        objects[c] = p;
      }
    }
  });
  if (count.S !== 1) throw new Error(`parseMap: 시작 'S'는 정확히 하나여야 합니다 (지금 ${count.S}개)`);
  if (count.M > 1) throw new Error(`parseMap: 보스 'M'은 최대 하나입니다 (지금 ${count.M}개)`);
  if (count.m > 1) throw new Error(`parseMap: 작은 몬스터 'm'은 최대 하나입니다 (지금 ${count.m}개)`);
  return {
    w, h, start, boss, smallMonster, slots, objects, fog,
    tileAt(x, y) {
      if (x < 0 || y < 0 || y >= h || x >= w) return '#';
      return rows[y][x];
    },
  };
}

export function isWalkable(map, x, y, opts = {}) {
  const c = map.tileAt(x, y);
  if (c === 'S' || c === '.') return true;
  if (c === 'F') return !!opts.fogOpen;
  if (c === 'm') return !!opts.smallMonsterGone;
  if (c === 'M') return !!opts.bossGone; // 막 보스를 이기면 그 자리는 길이 된다
  return false;
}

export function step(map, pos, dir, opts = {}) {
  const [dx, dy] = DIRS[dir];
  const nx = pos.x + dx, ny = pos.y + dy;
  if (isWalkable(map, nx, ny, opts)) return { pos: { x: nx, y: ny }, facing: dir };
  return { pos: { x: pos.x, y: pos.y }, facing: dir };
}

export function facingTarget(map, pos, facing, opts = {}) {
  const [dx, dy] = DIRS[facing];
  const x = pos.x + dx, y = pos.y + dy;
  const c = map.tileAt(x, y);
  if (c >= 'a' && c <= 'e') return { kind: 'npc', slot: c };
  if (c >= '0' && c <= '9') return { kind: 'object', slot: c };
  if (c === 'M') return opts.bossGone ? null : { kind: 'boss' };
  if (c === 'm') return opts.smallMonsterGone ? null : { kind: 'small' };
  if (c === 'F') return opts.fogOpen ? null : { kind: 'fog' };
  return null;
}

export function reachable(map, from, opts = {}) {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (!seen.has(k) && isWalkable(map, nx, ny, opts)) {
        seen.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}
