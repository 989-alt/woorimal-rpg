#!/usr/bin/env python3
"""색표에 맞추다 잃은 색을 되살린다(기록용, `sprites.py --act 4 icons` 뒤에 돌린다).
3막 design/art/act3/sprite-fixes/hues.py와 같은 방법이다.

찻잔의 호박빛 차가 색표의 붉은 갈색 잔점으로 갈려 흙탕물처럼 보였다.
sprites.py와 같은 순서(줄이기 → 색표 → 윤곽 → 놓기)로 다시 만들되, 줄인 원본에서
색상·채도·밝기가 정한 범위에 드는 점은 정한 색(sprite-palette.json의 예약 아닌 색)에만 맞춘다.
  icon_warm-tea      찻잔의 차   10°~45°, 채도 0.6 이상, 밝기 0.45 이상 → 호박빛 4색

사용: /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act4/sprite-fixes/hues.py
"""
import colorsys, importlib.util, os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
spec = importlib.util.spec_from_file_location('sprites', os.path.join(ROOT, 'tools', 'art', 'sprites.py'))
sp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sp)

RULES = {
    ('icons', 'warm-tea'): (10, 45, 0.6, ['#D9A55B', '#C98A48', '#B5743A', '#8E5528']),
}
VMIN = 0.45


def hue_mask(small, lo, hi, smin):
    m = np.zeros(small.shape[:2], dtype=bool)
    for y, x in zip(*np.nonzero(small[..., 3] > 0)):
        r, g, b = (small[y, x, :3] / 255.0).tolist()
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        m[y, x] = lo / 360 <= h <= hi / 360 and s >= smin and v >= VMIN
    return m


act = sp.Act(4)
for (kind, nid), (lo, hi, smin, cols) in RULES.items():
    c = act.cfg[kind]
    img = act.load(c['src'])
    box = sp.split_grid(np.array(img)[..., 3], *c['grid'])[c['ids'].index(nid)]
    if kind == 'npcs':
        pal = sp.palette(act.keep(nid))
        scale = min(sp.height(act, nid) / (box[3] - box[1]), 48 / (box[2] - box[0]))
    else:
        pal = sp.palette(['gold'] if 'gold' in act.keep(nid) else [])
        scale = min(46 / (box[2] - box[0]), 46 / (box[3] - box[1]))
    small = sp.shrink(img, box, scale)
    mask = hue_mask(small, lo, hi, smin)
    target = np.array([sp.rgb(x) for x in cols], dtype=np.float64)
    a = sp.quantize(small, pal)
    if mask.any():
        a[mask, :3] = target[sp.nearest_idx(small[mask][:, :3].astype(np.float64), target)].astype(np.uint8)
    a = sp.fix_outline(a, pal, act.cfg.get('outline', {}).get(nid))
    if kind == 'npcs':
        act.save(sp.place(a, 48, 96, cx=sp.body_cx(a)), f'npc_{nid}')
    else:
        act.save(sp.place(a, 48, 48, anchor='center'), f'icon_{nid}')
    print(f'{nid}: {int(mask.sum())} points recoloured')
