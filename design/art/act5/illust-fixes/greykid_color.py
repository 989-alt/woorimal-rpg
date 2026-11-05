#!/usr/bin/env python3
"""잿빛 아이 color(엔딩 "나도 색을 찾았어!"): 가장자리에 남은 마젠타 기운을 걷는다.

크림색 안개 자락과 하늘색 옷 가장자리가 마젠타 바탕과 섞여 불투명한 분홍 테로 남는다(sprite-gen cutout도 못 지움).
그림 가장자리(투명한 곳에서 24px 안)에서만 spill = min(R,B) − G를 R·B에서 빼고, 분홍이 짙던 만큼 알파를 줄인다.
남은 연분홍은 크림색 쪽으로 돌린다. 볼의 분홍은 가장자리에서 멀어 그대로 남는다.
만든 차례(2026-11-05, 출시 검토, 1K 6크레딧): 저장소 뿌리에서 PY=/root/.local/share/sprite-gen/.venv/bin/python
  $PY -I tools/art/illust.py --act 5 refpng assets/illust/bust_greykid_joy.webp design/art/act5/raw/illust/ref_greykid_joy.png
  python3 -I tools/kie-gen.py --prompt-file design/art/act5/prompts/illust/bust_greykid_color.txt \
    --out design/art/act5/raw/illust/bust_greykid_color_a1.png --aspect 3:4 --resolution 1K \
    --ref design/art/act5/raw/illust/ref_greykid_joy.png --ledger design/art/credits.tsv --task T9 --cap 1000
  $PY -I tools/art/illust.py --act 5 cut bust_greykid_color_a1
  $PY -I tools/art/illust.py --act 5 bust greykid color bust_greykid_color_a1   (illust.json colorFaces·framed, iou_head 0.9758)
  그 바로 뒤에 이 파일을 한 번 돌린다.
사용: /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act5/illust-fixes/greykid_color.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
PATH = os.path.join(ROOT, 'assets', 'illust', 'bust_greykid_color.webp')
EDGE = 24

im = Image.open(PATH).convert('RGBA')
a = np.asarray(im).astype(np.float32)
r, g, b, al = (a[..., i] for i in range(4))
clear = Image.fromarray(((al < 128) * 255).astype(np.uint8))
near = np.asarray(clear.filter(ImageFilter.MaxFilter(2 * EDGE + 1))) > 0
spill = np.clip(np.minimum(r, b) - g, 0, None) * near
a[..., 0] = r - spill
a[..., 2] = b - spill
a[..., 3] = al * np.clip(1 - spill / 90, 0, 1)
# 남은 연분홍(R>G, B>G: 크림색 자락에는 없는 색)은 크림색 쪽으로: B를 G의 0.88배로 낮춘다(하늘색 옷은 R<G라 그대로)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
pink = near & (r > g) & (b > g * 0.88)
a[..., 2] = np.where(pink, g * 0.88, b)
out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
out.save(PATH, 'WEBP', quality=85, method=6)
print(os.path.relpath(PATH, ROOT), os.path.getsize(PATH) // 1024, 'KB')
