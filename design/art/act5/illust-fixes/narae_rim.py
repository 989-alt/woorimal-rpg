#!/usr/bin/env python3
"""나래 빛 모습: 몸 둘레에 얇은 금빛 테두리 선만 두른다(원칙 1, 아트 바이블 4절 "엔딩에서 금빛 테두리가 생긴다").

그림 모델은 금빛을 그리면 빛 번짐·알갱이를 함께 그리기 쉬워서, 나래는 금빛 없이 그리고 테두리는 여기서 얹는다.
테두리는 실루엣 바깥으로 WIDTH px 띠(말빛 금 #F2C14E): 실루엣을 부드럽게 넓힌 모양을 그림 뒤에 깔고 그림을 위에 얹는다.
바깥 가장자리는 1~2px만 부드럽고 그 밖으로 번지지 않는다. `illust.py --act 5 bust narae light bust_narae_light_a1` 바로 뒤에 한 번 돌린다.
사용: /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act5/illust-fixes/narae_rim.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
PATH = os.path.join(ROOT, 'assets', 'illust', 'bust_narae_light.webp')
GOLD = (242, 193, 78)
WIDTH = 6  # 1080×1440에서 띠 두께(대화 화면 620px 높이에서 약 2.5px)

im = Image.open(PATH).convert('RGBA')
mask = im.getchannel('A').point(lambda v: 255 if v > 128 else 0)
# 부드럽게 넓히기: 흐린 마스크를 문턱으로 다시 자르면 둘레가 고르게 WIDTH만큼 커진다
blur = np.asarray(mask.filter(ImageFilter.GaussianBlur(WIDTH))).astype(np.float32) / 255
grown = np.clip((blur - 0.04) / 0.06, 0, 1)
# 작은 구멍(머리카락 사이 틈)은 메워 테두리가 몸 둘레 한 줄로만 남게 한다
ring = Image.new('RGBA', im.size, GOLD + (0,))
ring.putalpha(Image.fromarray((grown * 255).astype(np.uint8)))
ring.alpha_composite(im)
ring.save(PATH, 'WEBP', quality=85, method=6)
print(os.path.relpath(PATH, ROOT), os.path.getsize(PATH) // 1024, 'KB')
