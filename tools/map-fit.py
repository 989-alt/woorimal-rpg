#!/usr/bin/env python3
"""맵 그림을 장의 걷기 칸(data/acts/act<n>.js 맵 행)에 맞춘다.

사용: /root/.local/share/sprite-gen/.venv/bin/python -I tools/map-fit.py <명령> ...
  score MAP CH           어긋난 칸 수를 'bad n'으로 찍고 칸 목록을 찍는다. n > 0이면 종료 코드 1.
  warp IN CH OUT         축마다 조각 선형 변형으로 길을 걷기 칸에 맞춘다. OUT과 OUT.warp.json
                         {iou_before, iou_after, kx, vx, ky, vy}(그림 px)을 남긴다.
  overlay MAP CH OUT     절반 크기 겹쳐 보기: 칸 선, 걸을 수 있는데 길이 아닌 칸은 빨강, 막혔는데 길 같은 칸은 파랑.
  palette SRC --out JSON [--allow-fog] [--max-sat S]
                         맵 색표(64색 이하): tools/palette.json에서 예약 색을 빼고, 원본을 median-cut으로 줄인 색을
                         많이 쓰인 차례로 채운다(예약 색과 거리 12 안의 색, 채도가 S를 넘는 색은 뺀다).
  scale IN OUT K         최근접 K배(색표 그대로).

판정(tests/e2e/map-overlay.test.mjs와 같은 규칙): 칸 크기 T = 그림 너비 / 열 수.
길 색 = '.'·'S' 칸에서 가장 많이 쓴 색. 걸을 수 있는 칸(/[.Sa-eFmM]/)은 길 색이 40% 이상,
'#' 칸은 65% 미만이어야 한다. 출구 통로(출구 칸 다음 칸부터 exit.dir 쪽으로 맵 끝까지)는
막힌 칸이어도 길처럼 그려도 된다(길이 화면 밖으로 이어지는 곳, 설계 2절).
채도는 HSV 채도 (max − min) / max.
"""
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
WALK = set('.Sabcde' + 'FmM')
MIN_PATH_SHARE = 0.4
MAX_BLOCKED_PATH_SHARE = 0.65
KNOT_EVERY = 4        # 매듭 사이(칸)
SEARCH = 1.5          # 매듭마다 옮겨 보는 범위(칸)
STEP = 1 / 8          # 옮기는 걸음(칸)
RESERVED_NEAR = 12    # 예약 색과 이 거리 안의 색은 맵 색표에 넣지 않는다
OWNED = ['hero', 'dodam', 'haesol', 'narae', 'gold']


def node_json(flag, ch):
    out = subprocess.run(['node', os.path.join(ROOT, 'tools', 'layout-guide.mjs'), flag, ch],
                         cwd=ROOT, capture_output=True, text=True)
    if out.returncode:
        sys.exit(out.stderr.strip() or f'layout-guide {flag} {ch} 실패')
    return json.loads(out.stdout)


def exit_passage(rows, ex):
    """출구 통로 칸 [(x, y)] (tools/layout-guide.mjs exitPassage와 같은 정의)."""
    step = ex and {'up': (0, -1), 'down': (0, 1), 'left': (-1, 0), 'right': (1, 0)}.get(ex.get('dir'))
    if not step:
        return []
    w, h = len(rows[0]), len(rows)
    out, x, y = [], ex['x'] + step[0], ex['y'] + step[1]
    while 0 <= x < w and 0 <= y < h:
        out.append((x, y))
        x, y = x + step[0], y + step[1]
    return out


class Chapter:
    def __init__(self, ch):
        self.id = ch
        self.rows = node_json('--rows', ch)
        self.cols, self.nrows = len(self.rows[0]), len(self.rows)
        self.passage = set(exit_passage(self.rows, node_json('--exit', ch)))

    def tile_size(self, w, h):
        t = w // self.cols
        if t * self.cols != w or t * self.nrows != h:
            sys.exit(f'그림 {w}×{h}가 {self.cols}×{self.nrows}칸과 맞지 않습니다')
        return t

    def masks(self, t):
        """(걸을 수 있는 칸 px 마스크, 출구 통로 px 마스크, 길 색을 셀 칸 px 마스크)"""
        walk = np.array([[c in WALK for c in r] for r in self.rows])
        road = np.array([[c in '.S' for c in r] for r in self.rows])
        pas = np.zeros_like(walk)
        for x, y in self.passage:
            pas[y, x] = True
        up = lambda m: np.kron(m, np.ones((t, t), dtype=bool))
        return up(walk), up(pas), up(road)


def load_rgb(path):
    """(그림, 색 하나를 정수 하나로 묶은 배열)"""
    im = Image.open(path)
    a = np.array(im.convert('RGB')).astype(np.uint32)
    return im, (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]


def path_colour(packed, road):
    vals, counts = np.unique(packed[road], return_counts=True)
    return vals[counts.argmax()]


def judge(path, ch):
    """[(x, y, 글자, 길 비율, 'walk'|'open')] 어긋난 칸들"""
    _, packed = load_rgb(path)
    h, w = packed.shape
    t = ch.tile_size(w, h)
    _, _, road = ch.masks(t)
    is_path = packed == path_colour(packed, road)
    share = is_path.reshape(ch.nrows, t, ch.cols, t).mean(axis=(1, 3))
    bad = []
    for y, row in enumerate(ch.rows):
        for x, c in enumerate(row):
            s = share[y, x]
            if c in WALK and s < MIN_PATH_SHARE:
                bad.append((x, y, c, s, 'walk'))
            elif c == '#' and (x, y) not in ch.passage and s >= MAX_BLOCKED_PATH_SHARE:
                bad.append((x, y, c, s, 'open'))
    return bad


def cmd_score(a):
    bad = judge(a.map, Chapter(a.ch))
    print(f'bad {len(bad)}')
    for x, y, c, s, kind in bad:
        print(f"({x},{y}) '{c}' {s:.2f} {'걸을 수 있는데 길이 아님' if kind == 'walk' else '막혔는데 길처럼 보임'}")
    sys.exit(1 if bad else 0)


def interp(knots, vals, n):
    """출력 좌표 0..n-1마다 원본 좌표(최근접, 그림 안으로 자름)"""
    f = np.interp(np.arange(n) + 0.5, knots, vals) - 0.5
    return np.clip(np.round(f).astype(int), 0, n - 1)


def cmd_warp(a):
    ch = Chapter(a.ch)
    im, packed = load_rgb(a.src)
    h, w = packed.shape
    t = ch.tile_size(w, h)
    walk, pas, road = ch.masks(t)
    is_path = packed == path_colour(packed, road)
    care = ~pas  # 출구 통로는 길이든 아니든 상관없다
    target = walk & care

    kx = np.arange(0, ch.cols + 1, KNOT_EVERY, dtype=float) * t
    if kx[-1] != w:
        kx = np.append(kx, w)
    ky = np.arange(0, ch.nrows + 1, KNOT_EVERY, dtype=float) * t
    if ky[-1] != h:
        ky = np.append(ky, h)
    vx, vy = kx.copy(), ky.copy()

    def iou(vx, vy):
        m = is_path[interp(ky, vy, h)][:, interp(kx, vx, w)] & care
        inter = (m & target).sum()
        union = (m | target).sum()
        return inter / union if union else 1.0

    deltas = np.arange(-SEARCH, SEARCH + 1e-9, STEP) * t
    best = before = iou(vx, vy)
    for _ in range(2):
        for axis in ('x', 'y'):
            vals = vx if axis == 'x' else vy
            # 모든 매듭을 함께 옮겨 보기(통째로 밀린 그림), 다음에 매듭 하나씩
            for idx in [None] + list(range(len(vals))):
                cur = vals.copy()
                for d in sorted(deltas, key=abs):
                    cand = cur + d if idx is None else cur.copy()
                    if idx is not None:
                        cand[idx] = cur[idx] + d
                        if (idx > 0 and cand[idx] < cand[idx - 1]) or (idx < len(cand) - 1 and cand[idx] > cand[idx + 1]):
                            continue
                    s = iou(cand, vy) if axis == 'x' else iou(vx, cand)
                    if s > best + 1e-9:
                        best = s
                        vals[:] = cand
    fy, fx = interp(ky, vy, h), interp(kx, vx, w)
    if im.mode == 'P':
        idx = np.array(im)[fy][:, fx]
        out = Image.fromarray(idx.astype(np.uint8), 'P')
        out.putpalette(im.getpalette())
        kw = {'transparency': im.info['transparency']} if 'transparency' in im.info else {}
        out.save(a.out, optimize=True, **kw)
    else:
        Image.fromarray(np.array(im)[fy][:, fx]).save(a.out, optimize=True)
    r = lambda v: [round(float(x), 2) for x in v]
    rep = {'iou_before': round(float(before), 4), 'iou_after': round(float(best), 4),
           'kx': r(kx), 'vx': r(vx), 'ky': r(ky), 'vy': r(vy)}
    json.dump(rep, open(a.out + '.warp.json', 'w'), indent=1)
    print(f"saved {a.out} iou {rep['iou_before']} -> {rep['iou_after']}")


def cmd_overlay(a):
    ch = Chapter(a.ch)
    im = Image.open(a.map).convert('RGB')
    t = ch.tile_size(*im.size)
    bad = judge(a.map, ch)
    half = im.resize((im.width // 2, im.height // 2), Image.NEAREST).convert('RGBA')
    layer = Image.new('RGBA', half.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = t / 2
    for x, y, _, _, kind in bad:
        col = (230, 30, 30, 140) if kind == 'walk' else (30, 80, 230, 140)
        d.rectangle([x * s, y * s, (x + 1) * s - 1, (y + 1) * s - 1], fill=col)
    for x in range(1, ch.cols):
        d.line([(x * s, 0), (x * s, half.height)], fill=(0, 0, 0, 70))
    for y in range(1, ch.nrows):
        d.line([(0, y * s), (half.width, y * s)], fill=(0, 0, 0, 70))
    Image.alpha_composite(half, layer).convert('RGB').save(a.out, optimize=True)
    print(f'saved {a.out} bad {len(bad)}')


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def sat(c):
    mx, mn = max(c), min(c)
    return (mx - mn) / mx if mx else 0.0


def cmd_palette(a):
    reserved = json.load(open(os.path.join(ROOT, 'design', 'art', 'sprite-palette.json'), encoding='utf-8'))['reserved']
    groups = OWNED + ([] if a.allow_fog else ['fog'])
    banned = [hex_rgb(c) for g in groups for c in reserved[g]]
    near = lambda c, cols, r: any(sum((c[i] - o[i]) ** 2 for i in range(3)) < r * r for o in cols)
    ok = lambda c: not near(c, banned, RESERVED_NEAR) and (a.max_sat is None or sat(c) <= a.max_sat)

    base = [hex_rgb(c) for c in json.load(open(os.path.join(ROOT, 'tools', 'palette.json'), encoding='utf-8'))['colors']]
    chosen = [c for c in base if ok(c)]
    if a.allow_fog:  # 잿빛 3단은 그대로 쓴다(4막 안개)
        chosen += [hex_rgb(c) for c in reserved['fog'] if hex_rgb(c) not in chosen]

    src = Image.open(a.src).convert('RGB')
    q = src.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    for _, i in counts:
        if len(chosen) >= a.max_colors:
            break
        c = tuple(pal[i * 3:i * 3 + 3])
        if ok(c) and not near(c, chosen, 6):
            chosen.append(c)
    cols = ['#%02X%02X%02X' % c for c in chosen]
    note = (f'맵 색표 {len(cols)}색: tools/palette.json에서 예약 색({", ".join(groups)})을 빼고 '
            f'{os.path.basename(a.src)}의 median-cut 색을 많이 쓰인 차례로 더함'
            + (f', 채도 ≤ {a.max_sat}' if a.max_sat is not None else '') + ' (tools/map-fit.py palette)')
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump({'note': note, 'colors': cols}, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'saved {a.out} colors={len(cols)}')


def cmd_scale(a):
    im = Image.open(a.src)
    out = im.resize((im.width * a.k, im.height * a.k), Image.NEAREST)
    kw = {'transparency': im.info['transparency']} if 'transparency' in im.info else {}
    out.save(a.out, optimize=True, **kw)
    print(f'saved {a.out} {out.width}x{out.height}')


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('score'); s.add_argument('map'); s.add_argument('ch'); s.set_defaults(fn=cmd_score)
    s = sub.add_parser('warp'); s.add_argument('src'); s.add_argument('ch'); s.add_argument('out'); s.set_defaults(fn=cmd_warp)
    s = sub.add_parser('overlay'); s.add_argument('map'); s.add_argument('ch'); s.add_argument('out'); s.set_defaults(fn=cmd_overlay)
    s = sub.add_parser('palette'); s.add_argument('src'); s.add_argument('--out', required=True)
    s.add_argument('--allow-fog', action='store_true'); s.add_argument('--max-sat', type=float)
    s.add_argument('--max-colors', type=int, default=64); s.set_defaults(fn=cmd_palette)
    s = sub.add_parser('scale'); s.add_argument('src'); s.add_argument('out'); s.add_argument('k', type=int); s.set_defaults(fn=cmd_scale)
    a = p.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
