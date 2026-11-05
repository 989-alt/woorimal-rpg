# 3-2 낚시 바위: 48px 그림에서 모래 네모(23~25열 10~11줄)의 물 쪽 가장자리에 돌 테두리를 그려 넓적한 바위로 읽히게 한다.
# 색은 같은 그림의 조약돌 색표 칸(39 밝은 돌, 52 따뜻한 돌, 49 어두운 윤곽)을 쓴다. 칸마다 길 색은 70% 넘게 남는다.
import sys
import numpy as np
from PIL import Image
src, out = sys.argv[1:3]
im = Image.open(src)
a = np.array(im)
LIGHT, WARM, DARK = 39, 52, 49
x0, x1, y0, y1 = 23 * 48, 26 * 48, 10 * 48, 12 * 48   # 바위 윗면
nx0, nx1 = 24 * 48, 25 * 48                          # 아래로 이어지는 디딤돌 목
rng = np.random.default_rng(3)
def band(n):  # 돌 테두리 두께가 돌마다 조금씩 다르다
    w = np.repeat(rng.integers(4, 7, size=n // 8 + 1), 8)[:n]
    return w
# 왼쪽·오른쪽 가장자리
for side in ('l', 'r'):
    w = band(y1 - y0)
    for i, y in enumerate(range(y0 + 6, y1)):
        k = w[i]
        xs = range(x0, x0 + k) if side == 'l' else range(x1 - k, x1)
        for j, x in enumerate(xs):
            edge = (j == 0) if side == 'l' else (j == k - 1)
            a[y, x] = DARK if edge else (WARM if (y // 8) % 3 == 0 else LIGHT)
# 아래 가장자리(목 자리는 빼고)
w = band(x1 - x0)
for i, x in enumerate(range(x0, x1)):
    if nx0 <= x < nx1:
        continue
    k = w[i]
    for j, y in enumerate(range(y1 - k, y1)):
        a[y, x] = DARK if j == k - 1 else (WARM if (x // 8) % 3 == 1 else LIGHT)
o = Image.fromarray(a, 'P'); o.putpalette(im.getpalette())
kw = {'transparency': im.info['transparency']} if 'transparency' in im.info else {}
o.save(out, optimize=True, **kw)
print('saved', out)
