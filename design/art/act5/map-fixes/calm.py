# 5막 맵 공용 다듬기(색표 안에서만 바꾼다, 색 수 그대로).
# 걸을 수 있는 칸(과 출구 통로)은 길 색(가장 많은 판석 색)이 칸마다 SHARE 넘게 되도록, 길 색과 가장 가까운 점부터
# 길 색으로 바꾼다(금·잔돌·풀·얼룩 같은 또렷한 무늬는 끝까지 남는다). 3-2 디딤돌처럼 길 바탕 위에 무늬를 얹는 방식.
#   calm(a, pal, rows, exit_cells, path_hex, near_hexes, share)
#     near_hexes: 길 칸 둘레 8px 안에서 먼저 길 색으로 모을 판석 색(같은 판석의 밝기 차이)
import numpy as np


def shift_all(mm, r, fn):
    H, W = mm.shape
    p = np.pad(mm, r, constant_values=(fn is np.logical_and))
    o = mm.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o = fn(o, p[r + dy:r + dy + H, r + dx:r + dx + W])
    return o


def walk_mask(a, rows, extra=()):
    T = a.shape[1] // len(rows[0])
    m = np.zeros(a.shape, bool)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if (c != '#' and not c.isdigit()) or (x, y) in extra:
                m[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    return m, T


def calm(a, pal, rows, extra, path_hex, near_hexes, share=0.46):
    hexes = ['#%02X%02X%02X' % tuple(pal[i*3:i*3+3]) for i in range(len(pal) // 3)]
    rgb = np.array(pal[:len(hexes) * 3]).reshape(-1, 3).astype(float)
    P = hexes.index(path_hex)
    m, T = walk_mask(a, rows, extra)
    zone = shift_all(m, 8, np.logical_or)
    before = a.copy()
    for h in near_hexes:
        a[(before == hexes.index(h)) & zone] = P
    dist = np.sqrt(((rgb - rgb[P]) ** 2).sum(axis=1))
    need = int(np.ceil(share * T * T))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if not ((c != '#' and not c.isdigit()) or (x, y) in extra):
                continue
            t = a[y * T:(y + 1) * T, x * T:(x + 1) * T]
            have = int((t == P).sum())
            if have >= need:
                continue
            # 길 색과 가까운 색부터, 같은 색 안에서는 칸 가운데에서 먼 점부터 바꾼다
            yy, xx = np.nonzero(t != P)
            d = dist[t[yy, xx]]
            edge = -np.maximum(np.abs(yy - T / 2), np.abs(xx - T / 2))
            order = np.lexsort((edge, d))[:need - have]
            t[yy[order], xx[order]] = P
    return a
