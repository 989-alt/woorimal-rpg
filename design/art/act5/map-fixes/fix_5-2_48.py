# 5-2 48px 다듬기(색표 안에서만 바꾼다, 색 수 그대로). 5-1(fix_5-1_48.py)과 같은 판석 고르기:
# 걸을 수 있는 칸 둘레 8px 안에서 판석 색들을 밝은 판석 한 색으로, 줄눈 색들을 옅은 줄눈 한 색으로 모은다.
# 벽 앞면 아래의 그림자는 바로 아래 칸 위쪽 11px만 남기고(그 아래 4px는 줄눈 색, 나머지는 판석), 성긴 잔점을 뿌린다.
# 벽 속 검은 잔점(색표로 줄이며 생긴 줄눈 노이즈)은 짙은 먹색으로 바꾼다.
# 사용: $PY fix_5-2_48.py raw/map_5-2_2k_px.png raw/map_5-2_48.png
import sys, json, subprocess
import numpy as np
from PIL import Image
src, out = sys.argv[1:3]
im = Image.open(src)
a = np.array(im)
pal = im.getpalette()
hexes = ['#%02X%02X%02X' % tuple(pal[i*3:i*3+3]) for i in range(len(pal) // 3)]
idx = lambda h: hexes.index(h.upper())
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '5-2'], capture_output=True, text=True).stdout)
T = a.shape[1] // len(rows[0])
walk = lambda x, y: 0 <= x < 32 and 0 <= y < 24 and (rows[y][x] != '#' and not rows[y][x].isdigit() or (x, y) == (31, 10))
rng = np.random.default_rng(7)

m = np.zeros(a.shape, bool)
for y in range(24):
    for x in range(32):
        if walk(x, y):
            m[y * T:(y + 1) * T, x * T:(x + 1) * T] = True

def shift_all(mm, r, fn):
    H, W = mm.shape
    p = np.pad(mm, r, constant_values=(fn is np.logical_and))
    o = mm.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o = fn(o, p[r + dy:r + dy + H, r + dx:r + dx + W])
    return o
zone = shift_all(m, 8, np.logical_or)
SLAB, JOINT, SPECK = idx('#C9BFAE'), idx('#B0A69C'), idx('#B5ABA1')
before = a.copy()
for h in ('#AA9F96', '#A49A92', '#B5ABA1', '#A09C98'):
    a[(before == idx(h)) & zone] = SLAB
for h in ('#9F948D', '#9A9089', '#949597'):
    a[(before == idx(h)) & zone] = JOINT
# 그림자 색: 벽 바로 아래 칸의 위 11px 안에서만 그대로
keep = np.zeros(a.shape, bool)
soft = np.zeros(a.shape, bool)
for y in range(24):
    for x in range(32):
        if walk(x, y) and not walk(x, y - 1):
            keep[y * T:y * T + 11, x * T:(x + 1) * T] = True
            soft[y * T + 11:y * T + 15, x * T:(x + 1) * T] = True
for h in ('#938A84', '#8E8680', '#88807C', '#837C79'):
    sh = (before == idx(h)) & m & ~keep
    a[sh & soft] = JOINT
    a[sh & ~soft] = SLAB
# 벽의 검은 잔점: 5×5 둘레에서 검정이 60% 미만인 검정 점은 짙은 먹색으로(틈 창 안처럼 큰 검정 덩이는 그대로)
BLACK, INK = idx('#2B2622'), idx('#40434F')
bk = (a == BLACK).astype(int)
p5 = np.pad(bk, 2)
dens = sum(p5[2 + dy:2 + dy + bk.shape[0], 2 + dx:2 + dx + bk.shape[1]] for dy in range(-2, 3) for dx in range(-2, 3)) / 25
a[(a == BLACK) & (dens < 0.6) & ~zone] = INK
# 줄눈 색 얼룩: 5×5 둘레의 반 넘게 줄눈 색인 점(가는 줄이 아닌 덩이)은 판석으로
jk = (a == JOINT).astype(int)
pj = np.pad(jk, 2)
jd = sum(pj[2 + dy:2 + dy + jk.shape[0], 2 + dx:2 + dx + jk.shape[1]] for dy in range(-2, 3) for dx in range(-2, 3)) / 25
a[(a == JOINT) & (jd > 0.5) & m & ~keep & ~soft] = SLAB
# 0 위쪽 빈 등잔걸이: 8px 아래로(위 칸 (15,2)에 판석이 남게). 비는 위 8줄은 왼쪽 옆 바닥을 옮겨 채운다.
x0, x1, y0, y1 = 15 * T - 4, 16 * T + 4, 2 * T + 11, 4 * T - 8
blk = a[y0:y1, x0:x1].copy()
a[y0 + 8:y1 + 8, x0:x1] = blk
a[y0:y0 + 8, x0:x1] = a[y0:y0 + 8, x0 - (x1 - x0):x0]  # 왼쪽 옆 같은 줄(그늘 띠가 이어지게)
band = a[2 * T + 15:2 * T + 27, x0:x1]                # 함께 내려온 그늘 끝 띠는 판석으로
a[2 * T + 15:2 * T + 27, x0:x1] = np.where(band == JOINT, SLAB, band)
# (28,2) 바깥 고리 북동 모퉁이의 마른 풀·얼룩은 판석으로(위 그늘 띠는 그대로)
PAVE = [SLAB, JOINT, SPECK]
t = a[2 * T + 11:3 * T, 28 * T:29 * T]
a[2 * T + 11:3 * T, 28 * T:29 * T] = np.where(np.isin(t, PAVE), t, SLAB)
inner = shift_all(m, 4, np.logical_and) & (a == SLAB)
ys, xs = np.nonzero(inner)
for y0, x0 in zip(*(v[rng.random(len(ys)) < 0.006] for v in (ys, xs))):
    w, h = [(1, 1), (2, 1), (1, 2), (3, 1)][rng.integers(4)]
    sl = (slice(y0, y0 + h), slice(x0, x0 + w))
    a[sl] = np.where(a[sl] == SLAB, SPECK, a[sl])
o = Image.fromarray(a, 'P'); o.putpalette(pal)
o.save(out, optimize=True)
print('saved', out)
