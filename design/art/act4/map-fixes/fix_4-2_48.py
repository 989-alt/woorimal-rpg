# 4-2 48px 손질: 고친 길 그림(path_calm 뒤)에 (1) 쉼터 오른쪽 앞 기둥 그림자 걷기 (2) 튀어나온 길 칸 모서리 둥글리기,
# 넓은 맨땅에 밟아 다진 자국
# (3) 짙은 안개: 고갯마루(위쪽 절반) 둘레의 막힌 칸에 짙게, 동쪽 벼랑과 아래 벼랑 밑은 가운데, 서남은 엷게
# (4) 안개 위로 노을 한 줄: 맨 위 막힌 줄 안개 속에 호박빛 줄 하나(가장자리는 장밋빛 디더링).
# 쓰기: $PY design/art/act4/map-fixes/fix_4-2_48.py IN.png OUT.png
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fog as F
src, out = sys.argv[1:3]
im, a, pal, rows, ex = F.load(src, '4-2')
T = 48
# (1) 쉼터 오른쪽 앞 기둥 밑으로 비낀 그림자가 (16,16)을 덮어 길 색이 3%뿐이다. 기둥(770~790열)은 그대로 두고,
#     기둥 오른쪽 길 위의 그림자 색만 밝은 흙색으로 걷는다(그러면 (16,16)의 길 색이 40%를 넘는다).
L = F.idx(pal, '#D7B28B')
box = a[756:820, 788:870]
for h in ('#8B7364', '#987D6D', '#8F7769', '#816B60', '#BE936F', '#CC9C71', '#B48969', '#A9896B', '#A18764'):
    box[box == F.idx(pal, h)] = L
# (2)
F.round_notches(a, rows, T)
# (2b) 넓은 마당과 고갯마루에 밟아 다진 자국: 시작점→쉼터 앞→등성이 틈→고갯마루를 질러 북동 내리막으로, 마당 동쪽으로 한 갈래
wk = F.walk_mask(rows, ex, T)
D = F.idx(pal, '#CC9C71')
F.worn(a, pal, wk, [(15.5, 20.5), (15.2, 18.2), (13.5, 17.6), (15.3, 14.0), (16.0, 12.5), (16.0, 9.0), (17.5, 6.5), (24.0, 3.2), (27.6, 2.0), (28.5, 0.0)], T, L, D)
F.worn(a, pal, wk, [(16.5, 14.5), (22.0, 15.0), (27.0, 14.2)], T, L, D, width=0.7, dens=0.09, seed=9)
F.worn(a, pal, wk, [(7.5, 7.5), (7.5, 11.5)], T, L, D, width=0.6, dens=0.07, seed=10)
# (3)
H, W = a.shape
walk = F.walk_mask(rows, ex, T)
items = [  # (cx, cy, rx, ry, 세기) 칸 단위
    (16, 0.4, 18, 1.9, 1.0),                                   # 맨 위: 고갯마루 너머 안개 바다
    (2.5, 6.5, 3.6, 7.5, 1.0), (30, 7.5, 3.0, 6.5, 1.0),        # 고갯마루 왼쪽·오른쪽
    (11.5, 10.6, 3.2, 1.6, 0.8), (21, 10.6, 3.6, 1.5, 0.75), (28.5, 10.5, 3.0, 1.8, 0.9),  # 바위 등성이
    (1.2, 11.5, 2.0, 2.0, 0.8),
    (31.2, 18.5, 1.5, 6.0, 0.75), (27.5, 20.0, 3.5, 1.2, 0.5),  # 동쪽 벼랑 밑
    (16, 23.6, 17, 1.4, 0.75),                                  # 아래 벼랑 밑
    (3.0, 20.6, 3.4, 1.0, 0.45),                                # 서남 바위
]
clear = [(11.5, 13.4, 17.5, 17), (9.6, 12.4, 11.4, 14), (22.6, 19.4, 24.4, 21), (2.6, 16.4, 4.4, 18), (27.6, 15.4, 29.4, 17.2), (7.6, 19.4, 9.4, 21)]
cov = F.fog(a, pal, walk, F.banks(H, W, T, items, 42, clear), seed=5, top=0.9)
print(f'안개가 깔린 막힌 곳 비율 {cov:.2f}')
# (4) 노을 한 줄: 맨 위 안개의 윗면이 노을을 받는다. 물결진 호박빛 줄(2~8px) 위아래로 장밋빛 디더링이 안개로 스며든다.
xs = np.arange(W)
yc = 15 + 5 * np.sin(xs / 260 + 0.7) + 2 * np.sin(xs / 83 + 2.0)
half = 2.4 + 1.6 * (F.smooth_noise(64, W, 90, 11)[20] - 0.5) * 2   # 줄 굵기도 조금씩(1~4px)
amber, rose = F.idx(pal, '#D9A55B'), F.idx(pal, '#C08F68')
for x in xs:
    for y in range(int(yc[x]) - 14, int(yc[x]) + 15):
        if not (0 <= y < H) or walk[y, x]:
            continue
        dy = abs(y - yc[x])
        th = F.BAYER4[(y // 2) % 4, (x // 2) % 4]
        if dy <= half[x]:
            a[y, x] = amber
        elif dy <= half[x] + 4:
            if th < 0.7: a[y, x] = amber if th < 0.3 else rose
        elif dy <= half[x] + 12 and th < 0.5 * (1 - (dy - half[x] - 4) / 8):
            a[y, x] = rose
F.save(a, pal, out)
