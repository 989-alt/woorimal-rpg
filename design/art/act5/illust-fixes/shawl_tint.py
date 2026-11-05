#!/usr/bin/env python3
"""5막 보스: 무리 속에 숨은 나래의 숄 두 자락에 아주 옅은 회청색(#B4C0C6 쪽)을 얹는다.

illust.py monster의 회색 풀기(unmix_grey)는 모든 빛깔을 지우므로, 그림 모델이 숄에 칠한 옅은 회청색도 사라진다.
설계는 "잿빛만(숄도 회색에 가까운 아주 옅은 회청색)"이라, 숄 자락 자리(1440×2160 좌표의 다각형, 가장자리는 흐리게)에만
밝기는 그대로 두고 빛깔만 아주 조금 푸르게 민다. 첫눈에는 회색으로 보이고 두 번째 볼 때 천 자락이 따로 읽히는 정도.
`illust.py --act 5 monster monster_act5_a2` 바로 뒤에 한 번 돌린다(두 번 돌리면 두 번 짙어진다).
숄 가운데(두 자락 사이)는 css/game.css .battle-monster.tall의 --shawl-x·--shawl-y와 같다.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
PATH = os.path.join(ROOT, 'assets', 'illust', 'monster_act5.webp')

# 숄 자락(왼쪽은 어깨에서 아래로 늘어진 자락, 오른쪽은 위로 들린 자락)
LEFT = [(470, 1000), (570, 1060), (550, 1130), (515, 1200), (500, 1300), (400, 1310), (430, 1270), (480, 1230), (505, 1150), (495, 1070)]
RIGHT = [(860, 1140), (990, 1100), (990, 1190), (940, 1280), (900, 1340), (860, 1350), (830, 1240), (860, 1200)]
SHIFT = np.array([-5.0, 0.5, 4.5], np.float32)  # 회색에서 #B4C0C6 쪽으로(밝기는 거의 그대로)

im = np.asarray(Image.open(PATH).convert('RGBA')).astype(np.float32)
m = Image.new('L', (im.shape[1], im.shape[0]), 0)
d = ImageDraw.Draw(m)
d.polygon(LEFT, fill=255)
d.polygon(RIGHT, fill=255)
m = np.asarray(m.filter(ImageFilter.GaussianBlur(14))).astype(np.float32)[..., None] / 255
im[..., :3] = im[..., :3] + SHIFT * m
out = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8), 'RGBA')
out.save(PATH, 'WEBP', quality=85, method=6)
print(os.path.relpath(PATH, ROOT), os.path.getsize(PATH) // 1024, 'KB')
