"""greykid_color.py 다음에 돌린다. 색 흉상의 가장자리에 남은 밝은 테두리와 끊긴 윤곽을 없앤다.

회색 기쁨 흉상과 윤곽이 거의 같으므로(IoU 0.98, 어긋남 0) 그 부드러운 알파를 그대로 쓰고,
가장자리 색은 안쪽(알파를 9px 깎은 확실한 부분) 색을 바깥으로 번지게 채운다.
쓰는 법: python3 -I design/art/act5/illust-fixes/greykid_color_edge.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[4]
color_p = ROOT / 'assets/illust/bust_greykid_color.webp'
grey_p = ROOT / 'assets/illust/bust_greykid_joy.webp'

C = Image.open(color_p).convert('RGBA')
GA = np.array(Image.open(grey_p).convert('RGBA').split()[3])
core = np.array(C.split()[3].filter(ImageFilter.MinFilter(9))) > 220
acc = np.array(C)[..., :3].astype(np.float32) * core[..., None]
known = core.copy()
need = GA > 0
for _ in range(600):
    if not (need & ~known).any():
        break
    w = known.astype(np.float32)
    s = np.zeros_like(acc); n = np.zeros_like(w)
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)]:
        s += np.roll(np.roll(acc * w[..., None], dy, 0), dx, 1)
        n += np.roll(np.roll(w, dy, 0), dx, 1)
    new = (~known) & (n > 0)
    acc[new] = s[new] / n[new][:, None]
    known |= new
Image.fromarray(np.dstack([np.uint8(np.clip(acc, 0, 255)), GA]), 'RGBA').save(color_p, quality=92, method=6)
print('saved', color_p)
