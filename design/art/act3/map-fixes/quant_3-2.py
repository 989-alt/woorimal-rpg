# 3-2 그림을 색표 PNG(64색 이하)로: 모든 점을 map-palette_3-2.json의 가장 가까운 색으로 맞추고,
# 64색이 넘으면 3막 원래 색표에서 온 색 가운데 (쓴 점 수 × 가장 가까운 다른 색까지 거리)가 가장 작은 색부터 이웃 색에 합친다.
# 새로 더한 물·다리·돌 색과 길 색은 합치지 않는다.
# 사용: $PY quant_3-2.py IN.png OUT.png [--palette design/art/act3/map-palette_3-2.json]
#   IN이 1536x1152보다 크면 tools/pixelize.py와 같게 줄인다(2배 넘으면 BOX, 그다음 NEAREST).
import sys, json
import numpy as np
from PIL import Image

args = sys.argv[1:]
src, dst = args[0], args[1]
pal_path = args[args.index('--palette') + 1] if '--palette' in args else 'design/art/act3/map-palette_3-2.json'
W, H = 1536, 1152
cols = json.load(open(pal_path, encoding='utf-8'))['colors']
base = json.load(open('design/art/act3/map-palette.json', encoding='utf-8'))['colors']
pal = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in cols], np.int32)
protect = {i for i, h in enumerate(cols) if h not in base or h.upper() == '#F5D48F'}

im = Image.open(src).convert('RGB')
if im.width > 2 * W or im.height > 2 * H:
    im = im.resize((max(W, min(im.width, W * 2)), max(H, min(im.height, H * 2))), Image.BOX)
if im.size != (W, H):
    im = im.resize((W, H), Image.NEAREST)
a = np.array(im).astype(np.int32)
flat = a.reshape(-1, 3)
uniq, inv = np.unique(flat, axis=0, return_inverse=True)
d = ((uniq[:, None, :] - pal[None, :, :]) ** 2).sum(-1)
idx = d.argmin(1)[inv.reshape(-1)]
while True:
    used, counts = np.unique(idx, return_counts=True)
    if len(used) <= 64:
        break
    best = None
    for u, c in zip(used, counts):
        if u in protect:
            continue
        others = [v for v in used if v != u]
        dd = np.sqrt(((pal[others] - pal[u]) ** 2).sum(-1))
        j = int(dd.argmin())
        cost = c * dd[j]
        if best is None or cost < best[0]:
            best = (cost, u, others[j])
    _, u, v = best
    idx[idx == u] = v
used = sorted(set(idx.tolist()))
remap = {u: i for i, u in enumerate(used)}
out = Image.fromarray(np.vectorize(remap.get)(idx).reshape(H, W).astype(np.uint8), 'P')
out.putpalette(sum((pal[u].tolist() for u in used), []))
out.save(dst, optimize=True)
print(f'saved {dst} colors={len(used)}')
