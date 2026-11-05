#!/usr/bin/env python3
"""미루 약초 바구니의 풀잎을 초록으로 되살린다(기록용, `sprites.py --act 3 npcs` 뒤에 돌린다).

줄인 그림에서 어두운 풀색은 색표의 갈색과 더 가까워 바구니가 온통 갈색이 되었다.
sprites.py의 figure()와 같은 순서(줄이기 → 색표 → 윤곽 → 아래 가운데)로 다시 만들되,
줄인 원본에서 색상이 초록(58°~170°, 채도 0.18 이상)인 점은 색표의 초록 4색에만 맞춘다.

사용: /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act3/sprite-fixes/miru_herbs.py
"""
import colorsys, importlib.util, os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
spec = importlib.util.spec_from_file_location('sprites', os.path.join(ROOT, 'tools', 'art', 'sprites.py'))
sp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sp)

GREENS = np.array([sp.rgb(c) for c in ('#8CC97F', '#5FAE5A', '#2F6B3A', '#1F4A2A')], dtype=np.float64)

act = sp.Act(3)
c = act.cfg['npcs']
img = act.load(c['src'])
boxes = sp.split_grid(np.array(img)[..., 3], *c['grid'])
box = boxes[c['ids'].index('miru')]
fit_h = sp.height(act, 'miru')
scale = min(fit_h / (box[3] - box[1]), 48 / (box[2] - box[0]))
pal = sp.palette(act.keep('miru'))

small = sp.shrink(img, box, scale)
green = np.zeros(small.shape[:2], dtype=bool)
for y, x in zip(*np.nonzero(small[..., 3] > 0)):
    r, g, b = (small[y, x, :3] / 255.0).tolist()
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    green[y, x] = 58 / 360 <= h <= 170 / 360 and s >= 0.18 and v >= 0.15

a = sp.quantize(small, pal)
if green.any():
    a[green, :3] = GREENS[sp.nearest_idx(small[green][:, :3].astype(np.float64), GREENS)].astype(np.uint8)
a = sp.fix_outline(a, pal, act.cfg.get('outline', {}).get('miru'))
act.save(sp.place(a, 48, 96, cx=sp.body_cx(a)), 'npc_miru')
print(f'green points {int(green.sum())}')
