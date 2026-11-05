#!/usr/bin/env python3
"""잿빛 아이 joy: 이름이 다시 불린 순간(원칙 1) — 가슴께에 작은 빛 한 점, 볼에 연한 색.

illust.py의 greyUnmix는 그림을 모두 회색으로 푸므로 색은 여기서 얹는다. `illust.py --act 5 bust greykid joy bust_greykid_joy_a1` 바로 뒤에 한 번 돌린다(두 번 돌리면 볼이 두 번 짙어진다).
빛 점은 번짐 없이 작게: 가운데 #FFE7A3에서 가장자리 #F2C14E(가장자리만 1px 부드럽게). 볼은 알파가 있는 곳에만 옅은 분홍.
사용: /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act5/illust-fixes/greykid_joy.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
PATH = os.path.join(ROOT, 'assets', 'illust', 'bust_greykid_joy.webp')

LIGHT = (450, 806)            # 턱 아래 두 무릎 사이로 보이는 가슴께(1080×1440 좌표)
R_LIGHT = 11                  # 빛 점 반지름(px)
CHEEKS = [(372, 778), (548, 772)]
CHEEK_R = (34, 20)            # 가로·세로 반지름
CHEEK_RGB, CHEEK_A = (232, 160, 160), 0.38

im = np.asarray(Image.open(PATH).convert('RGBA')).astype(np.float32)
H, W = im.shape[:2]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
alpha = im[..., 3:4] / 255

# 볼: 가운데가 가장 짙고 가장자리로 옅어지는 타원, 그림이 있는 곳에만
for cx, cy in CHEEKS:
    d = np.sqrt(((xx - cx) / CHEEK_R[0]) ** 2 + ((yy - cy) / CHEEK_R[1]) ** 2)
    t = (np.clip(1 - d, 0, 1) ** 1.2 * CHEEK_A)[..., None] * alpha
    im[..., :3] = im[..., :3] * (1 - t) + np.array(CHEEK_RGB, np.float32) * t

# 빛 점: 가운데 옅은 금(#FFE7A3)에서 가장자리 말빛 금(#F2C14E)으로. 점 밖으로 번지지 않는다(가장자리 1px만 안티에일리어싱)
d = np.sqrt((xx - LIGHT[0]) ** 2 + (yy - LIGHT[1]) ** 2)
cover = np.clip(R_LIGHT + 0.5 - d, 0, 1)[..., None]
t = np.clip(d / R_LIGHT, 0, 1)[..., None] ** 1.5
col = np.array((255, 231, 163), np.float32) * (1 - t) + np.array((242, 193, 78), np.float32) * t
im[..., :3] = im[..., :3] * (1 - cover) + col * cover
im[..., 3:4] = np.maximum(im[..., 3:4], cover * 255)

out = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8), 'RGBA')
out.save(PATH, 'WEBP', quality=85, method=6)
print(os.path.relpath(PATH, ROOT), os.path.getsize(PATH) // 1024, 'KB')
