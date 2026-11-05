# 4막 맵 손질 공용: 칸 고치기, 튀어나온 길 칸의 모서리 둥글리기, 막힌 칸에만 내려앉는 낮은 안개 디더링.
# 모두 그 맵의 색표 안에서만 칠한다(안개는 잿빛 3단, 4막 색표에 들어 있다).
import json, subprocess
import numpy as np
from PIL import Image, ImageFilter

FOG = ['#B9BBBE', '#8A8D91', '#5E6266']
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32


def load(src, ch):
    im = Image.open(src)
    rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', ch], capture_output=True, text=True).stdout)
    ex = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--exit', ch], capture_output=True, text=True).stdout)
    return im, np.array(im), im.getpalette(), rows, ex


def idx(pal, h):
    """그림 색표에서 h의 번호. 없으면(줄인 그림이 아직 안 쓴 맵 색표 색) 색표 끝에 더한다."""
    n = len(pal) // 3
    for i in range(n):
        if '#%02X%02X%02X' % tuple(pal[i*3:i*3+3]) == h.upper():
            return i
    pal += [int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)]
    return n


def walk_mask(rows, ex, T, passage=True):
    m = np.zeros((len(rows) * T, len(rows[0]) * T), bool)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != '#' and not c.isdigit():
                m[y*T:(y+1)*T, x*T:(x+1)*T] = True
    if passage:
        dx, dy = {'up': (0, -1), 'down': (0, 1), 'left': (-1, 0), 'right': (1, 0)}[ex['dir']]
        x, y = ex['x'] + dx, ex['y'] + dy
        while 0 <= x < len(rows[0]) and 0 <= y < len(rows):
            m[y*T:(y+1)*T, x*T:(x+1)*T] = True
            x, y = x + dx, y + dy
    return m


def dist_from(m, cap=64):
    """m(참)에서 떨어진 거리(체비셰프, cap에서 자름)."""
    d = np.where(m, 0, cap).astype(np.int32)
    cur = m.copy()
    H, W = m.shape
    for k in range(1, cap):
        p = np.pad(cur, 1)
        nxt = cur | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
        d[nxt & ~cur] = k
        cur = nxt
        if cur.all():
            break
    return d


def round_notches(a, rows, T, r=11):
    """세 쪽이 막힌 걸을 수 있는 칸(길에서 튀어나온 한 칸)의 바깥 두 모서리를 옆 막힌 칸 무늬로 둥글린다."""
    H, W = len(rows), len(rows[0])
    wk = lambda x, y: 0 <= x < W and 0 <= y < H and rows[y][x] != '#' and not rows[y][x].isdigit()
    yy, xx = np.mgrid[0:T, 0:T]
    for y in range(H):
        for x in range(W):
            if not wk(x, y):
                continue
            n = {(0, -1): wk(x, y - 1), (0, 1): wk(x, y + 1), (-1, 0): wk(x - 1, y), (1, 0): wk(x + 1, y)}
            if sum(n.values()) != 1:
                continue
            (ox, oy), = [k for k, v in n.items() if v]  # 길과 이어진 쪽
            tile = a[y*T:(y+1)*T, x*T:(x+1)*T]
            if ox == 0:  # 위나 아래로 튀어나옴: 왼쪽·오른쪽 바깥 모서리
                far = 0 if oy == 1 else T - 1
                for side, sx in ((-1, x - 1), (1, x + 1)):
                    cx = 0 if side == -1 else T - 1
                    corner = (np.abs(xx - cx) < r) & (np.abs(yy - far) < r)
                    ring = corner & ((np.abs(xx - cx) - r) ** 2 + (np.abs(yy - far) - r) ** 2 > r * r)
                    src = a[y*T:(y+1)*T, sx*T:(sx+1)*T][:, ::-1]
                    tile[ring] = src[ring]
            else:  # 왼쪽이나 오른쪽으로 튀어나옴: 위·아래 바깥 모서리
                far = 0 if ox == 1 else T - 1
                for side, sy in ((-1, y - 1), (1, y + 1)):
                    cy = 0 if side == -1 else T - 1
                    corner = (np.abs(yy - cy) < r) & (np.abs(xx - far) < r)
                    ring = corner & ((np.abs(yy - cy) - r) ** 2 + (np.abs(xx - far) - r) ** 2 > r * r)
                    src = a[sy*T:(sy+1)*T, x*T:(x+1)*T][::-1, :]
                    tile[ring] = src[ring]


def worn(a, pal, walk, pts, T, light, dark, width=0.9, dens=0.13, seed=8):
    """넓은 맨땅에 사람들이 밟아 다진 자국: pts(칸 단위 꺾은선)를 따라 너비 width칸 띠 안에 어두운 흙색 잔점을 더 촘촘히,
    띠 가장자리로 갈수록 성기게. 밝은 흙색 위에만, 걸을 수 있는 칸 안에만 찍는다."""
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W] / T
    d = np.full((H, W), 1e9)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        vx, vy = x1 - x0, y1 - y0
        t = np.clip(((xx - x0) * vx + (yy - y0) * vy) / (vx * vx + vy * vy), 0, 1)
        d = np.minimum(d, np.hypot(xx - x0 - t * vx, yy - y0 - t * vy))
    n = smooth_noise(H, W, 30, seed)
    p = dens * np.clip(1 - d / width, 0, 1) ** 0.7 * (0.5 + n)
    rng = np.random.default_rng(seed)
    hit = (rng.random((H, W)) < p) & walk & (a == light)
    a[hit] = dark
    hit2 = np.zeros_like(hit); hit2[:, 1:] = hit[:, :-1]   # 옆으로 2px짜리도 섞는다
    a[hit2 & (rng.random((H, W)) < 0.5) & walk & (a == light)] = dark


def smooth_noise(H, W, cell, seed):
    rng = np.random.default_rng(seed)
    g = rng.random((H // cell + 3, W // cell + 3))
    im = Image.fromarray((g * 255).astype(np.uint8)).resize(((W // cell + 3) * cell, (H // cell + 3) * cell), Image.BICUBIC)
    return np.array(im).astype(float)[:H, :W] / 255


def banks(H, W, T, items, seed=7, keep_clear=()):
    """안개 둑의 세기(0~1). items = [(cx, cy, rx, ry, 세기)] 칸 단위 타원, 가장자리는 잔물결 잡음으로 흔든다.
    keep_clear = [(x0, y0, x1, y1)] 칸 상자: 상징 소품이 묻히지 않게 그 둘레는 비운다."""
    yy, xx = np.mgrid[0:H, 0:W] / T
    n = smooth_noise(H, W, 40, seed) - 0.5
    n2 = smooth_noise(H, W, 14, seed + 1) - 0.5
    f = np.zeros((H, W))
    for cx, cy, rx, ry, s in items:
        r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) + 0.55 * n + 0.18 * n2
        f = np.maximum(f, s * np.clip(1.35 - r, 0, 1))
    for x0, y0, x1, y1 in keep_clear:
        dx = np.maximum(np.maximum(x0 - xx, xx - x1), 0)
        dy = np.maximum(np.maximum(y0 - yy, yy - y1), 0)
        f *= np.clip(np.maximum(dx, dy) / 0.8, 0, 1)
    return f


def streaks(H, W, seed, cx=150, cy=22):
    """옆으로 길게 늘어진 잡음(0~1): 낮게 흐르는 안개 줄무늬."""
    rng = np.random.default_rng(seed)
    g = rng.random((H // cy + 3, W // cx + 3))
    im = Image.fromarray((g * 255).astype(np.uint8)).resize(((W // cx + 3) * cx, (H // cy + 3) * cy), Image.BICUBIC)
    return np.array(im).astype(float)[:H, :W] / 255


def fog(a, pal, walk, f, seed=3, fade=20, cell=2, top=0.78):
    """안개(막힌 곳에만): 세기 f에 옆으로 흐르는 줄무늬를 곱해 Bayer 디더링으로 덮는다. 가장 짙은 곳도 top(0.78)까지라
    밑의 바위·나무 모양이 비친다. 덮는 점은 밑그림(9px 상자로 고른 밝기)이 밝으면 밝은 잿빛, 어두우면 가운데 잿빛이라 안개가 비쳐 보인다.
    걸을 수 있는 칸에서 fade px 안은 엷어진다."""
    H, W = a.shape
    d = dist_from(walk, fade + 1)
    ramp = np.clip((d - 2) / fade, 0, 1)
    s = streaks(H, W, seed)
    dens = np.clip(f * (0.45 + 0.85 * s), 0, top) * ramp * ramp * (3 - 2 * ramp)
    yy, xx = np.mgrid[0:H, 0:W]
    th = BAYER4[(yy // cell) % 4, (xx // cell) % 4]
    on = (dens > th) & ~walk
    p = np.array(pal[:len(pal) // 3 * 3]).reshape(-1, 3)
    lum = (p[a] * [0.3, 0.59, 0.11]).sum(axis=2)
    lum = np.array(Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(4))).astype(float)  # 밝기 덩어리로
    light, mid = idx(pal, FOG[0]), idx(pal, FOG[1])
    a[on & (lum >= 95)] = light
    a[on & (lum < 95)] = mid
    return (dens > 0.1)[~walk].mean()


def save(a, pal, out):
    o = Image.fromarray(a, 'P'); o.putpalette(pal)
    o.save(out, optimize=True)
    print('saved', out)
