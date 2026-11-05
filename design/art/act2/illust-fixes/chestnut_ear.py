#!/usr/bin/env python3
"""밤 장수 할머니 base 원본(bust_chestnut_base_a1)의 오른쪽 귀와 그 둘레 머리카락에 그림이 칠한 주황 빛 번짐을 지운다.
원칙 1(빛은 말에서만): 대화 그림에 빛 번짐을 두지 않는다. 상자 안에서 R−B가 지나치게 큰(주황) 픽셀의 채도를
같은 밝기의 살색 정도(R−B ≈ 100)로 낮춘다. cut 뒤, bust 앞에 한 번 돌린다(원본 좌표, 1776×2368).
  /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act2/illust-fixes/chestnut_ear.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
P = os.path.join(ROOT, 'design/art/act2/raw/illust/bust_chestnut_base_a1_cut.png')
BOX = (980, 780, 1170, 1020)
LIMIT = 100.0

im = Image.open(P).convert('RGBA')
a = np.asarray(im).astype(np.float32).copy()
x0, y0, x1, y1 = BOX
s = a[y0:y1, x0:x1, :3]
lum = (s @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
rb = s[..., 0] - s[..., 2]
k = np.where(rb > LIMIT, LIMIT / np.maximum(rb, 1), 1.0)
k = k[..., None]
a[y0:y1, x0:x1, :3] = lum + (s - lum) * k
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(P)
print('fixed', int((rb > LIMIT).sum()), 'px')
