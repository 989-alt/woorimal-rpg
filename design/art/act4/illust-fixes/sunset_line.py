#!/usr/bin/env python3
"""의심 그림자(monster_act4.webp)의 두 무리 사이 틈으로 노을 한 줄을 그린다(설계 4막 막 보스, Task 6 Step 3).
illust.py monster는 회색 풀기(unmix_grey)로 모든 색을 지우므로 노을은 그림이 아니라 코드로 넣는다.
틈(두 무리 사이 알파가 빈 세로 띠)의 가운데를 줄마다 찾아 곧은 선으로 맞추고, 평평한 장밋빛 노을색
(bg_ch4-2 노을 줄과 같은 빛깔) 곧은 세로줄을 그림 **뒤에** 깐다(그림을 그 위에 얹는다). 그래서 줄은 틈으로만
보이고 몸이 겹치는 곳에서는 안개 뒤로 숨는다. 번짐·빛 알갱이 없음: 1px 안티앨리어싱만, 위아래 끝은 가늘어진다.
illust.py --act 4 monster 뒤에 한 번 돌린다:
  /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act4/illust-fixes/sunset_line.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
P = os.path.join(ROOT, 'assets/illust/monster_act4.webp')
COLOR = np.array([212, 154, 134], np.float32)  # #D49A86, bg_ch4-2 노을 줄(#C79693)보다 조금 따뜻하게
WIN = (600, 840)          # 틈을 찾을 가로 범위(1440 그림 좌표)
Y0, Y1 = 470, 1325        # 줄의 위·아래(어깨 높이 ~ 금 간 땅 아래 끝)
HALF = 3.0                # 줄 반폭(px)
TAPER = 90                # 위아래 끝이 가늘어지는 길이(px)

im = Image.open(P).convert('RGBA')
a = np.asarray(im).astype(np.float32).copy()
al = a[..., 3]

xs = np.full(Y1 - Y0, np.nan, np.float32)
for i, y in enumerate(range(Y0, Y1)):
    row = al[y, WIN[0]:WIN[1]] < 20
    best, s = None, None
    for x in range(len(row) + 1):
        v = x < len(row) and row[x]
        if v and s is None:
            s = x
        if not v and s is not None:
            if best is None or x - s > best[1] - best[0]:
                best = (s, x)
            s = None
    if best and best[1] - best[0] >= 6:
        xs[i] = WIN[0] + (best[0] + best[1] - 1) / 2
idx = np.arange(len(xs))
ok = ~np.isnan(xs)
xs = np.interp(idx, idx[ok], xs[ok])
xs = np.polyval(np.polyfit(idx, xs, 1), idx)  # 곧은 선

X = np.arange(a.shape[1], dtype=np.float32)
line = np.zeros_like(a)
line[..., :3] = COLOR
for i, y in enumerate(range(Y0, Y1)):
    t = min(i, len(xs) - 1 - i) / TAPER
    half = HALF * min(1.0, 0.35 + 0.65 * t)
    line[y, :, 3] = np.clip(half + 0.5 - np.abs(X - xs[i]), 0, 1) * 255  # 1px 안티앨리어싱만

out = Image.fromarray(line.astype(np.uint8), 'RGBA')
out.alpha_composite(im)  # 그림이 줄 위에 온다
for q in (85, 80, 75):
    out.save(P, 'WEBP', quality=q, method=6)
    if os.path.getsize(P) <= 400_000:
        break
print('sunset line', Y0, Y1, 'x', round(float(xs[0])), '->', round(float(xs[-1])), os.path.getsize(P) // 1024, 'KB')
