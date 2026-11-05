# 길 고르기: 2K 그림을 색표로 줄이면 길이 밝은 흙색과 어두운 흙색의 잔 얼룩으로 갈린다(길 색이 칸마다 40%를 못 넘고,
# 1:1에서 네모난 얼룩으로 보인다). 걸을 수 있는 칸(과 출구 통로) 둘레 8px 안의 어두운 흙색을 모두 밝은 흙색으로 바꾸고,
# 바퀴 자국·돌멩이(다른 색)는 그대로 둔다. 그 위에 어두운 흙색 잔점(1~3px, 칸 가장자리 4px 안쪽)을 성기게 뿌려
# 1~3막 길처럼 고른 흙 질감을 낸다. 같은 색표 안의 바꾸기라 색 수는 그대로다.
# 쓰기: $PY path_calm.py IN.png CH OUT.png LIGHT_HEX DARK_HEX[,DARK_HEX…] [잔점 밀도, 기본 0.012] [씨앗]
import sys, json, subprocess
import numpy as np
from PIL import Image
src, ch, out, light, darks = sys.argv[1:6]
density = float(sys.argv[6]) if len(sys.argv) > 6 else 0.012
rng = np.random.default_rng(int(sys.argv[7]) if len(sys.argv) > 7 else 4)
im = Image.open(src)
a = np.array(im)
pal = im.getpalette()
idx = lambda h: next(i for i in range(len(pal) // 3) if '#%02X%02X%02X' % tuple(pal[i*3:i*3+3]) == h.upper())


def shift_all(m, r, fn):  # (2r+1)² 상자 안 모든 이동을 fn(or/and)으로 모은다
    H, W = m.shape
    p = np.pad(m, r, constant_values=(fn is np.logical_and))
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out = fn(out, p[r + dy:r + dy + H, r + dx:r + dx + W])
    return out


rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', ch], capture_output=True, text=True).stdout)
ex = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--exit', ch], capture_output=True, text=True).stdout)
T = a.shape[1] // len(rows[0])
m = np.zeros(a.shape, bool)
for y, r in enumerate(rows):
    for x, c in enumerate(r):
        if c != '#' and not c.isdigit():
            m[y*T:(y+1)*T, x*T:(x+1)*T] = True
dx, dy = {'up': (0, -1), 'down': (0, 1), 'left': (-1, 0), 'right': (1, 0)}[ex['dir']]
x, y = ex['x'] + dx, ex['y'] + dy
while 0 <= x < len(rows[0]) and 0 <= y < len(rows):  # 출구 통로
    m[y*T:(y+1)*T, x*T:(x+1)*T] = True
    x, y = x + dx, y + dy
zone = shift_all(m, 8, np.logical_or)
L = idx(light)
D = [idx(h) for h in darks.split(',')]
for d in D:
    a[(a == d) & zone] = L
# 잔점: 밝은 흙색 위에만, 걸을 수 있는 칸 가장자리에서 4px 안쪽
inner = shift_all(m, 4, np.logical_and) & (a == L)
ys, xs = np.nonzero(inner)
pick = rng.random(len(ys)) < density
for y0, x0 in zip(ys[pick], xs[pick]):
    w, h = rng.choice([(1, 1), (2, 1), (1, 2), (2, 1), (3, 1)])
    sl = (slice(y0, y0 + h), slice(x0, x0 + w))
    a[sl] = np.where(a[sl] == L, D[0], a[sl])
o = Image.fromarray(a, 'P'); o.putpalette(pal)
o.save(out, optimize=True)
print('saved', out)
