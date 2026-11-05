#!/usr/bin/env python3
"""홈 화면·앱 아이콘 만들기: 타이틀 로고(assets/ui/logo_title.v1.png)를 새벽빛 둥근 바탕 가운데에 얹는다.

  /root/.local/share/sprite-gen/.venv/bin/python -I tools/make-app-icons.py

- icons/icon-192.png, icons/icon-512.png (manifest.webmanifest, purpose "any maskable"):
  로고는 가운데 지름 80% 원(마스크 안전 구역) 안에 들어가게 폭 76%로 둔다.
- icons/apple-touch-icon.png (180×180, iOS 홈 화면): 바탕을 꽉 채운다(iOS가 모서리를 둥글게 깎는다).
- icons/는 assets/ 밖에 둔다(assets/의 파일은 모두 data/assets.js가 써야 한다는 검사가 있다).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / 'assets/ui/logo_title.v1.png'
OUT = ROOT / 'icons'

TOP = (255, 231, 163)     # --gold-light: 새벽 금빛
MID = (222, 151, 53)      # --wood-light
EDGE = (110, 50, 17)      # --wood-dark


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def background(size):
    """가운데 위가 밝은 둥근 빛(금빛 → 나무색 → 짙은 나무색)."""
    img = Image.new('RGB', (size, size), EDGE)
    px = img.load()
    cx, cy = size * 0.5, size * 0.42
    r = size * 0.78
    for y in range(size):
        for x in range(size):
            d = min(1.0, ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / r)
            px[x, y] = lerp(TOP, MID, d / 0.55) if d < 0.55 else lerp(MID, EDGE, (d - 0.55) / 0.45)
    return img


def icon(size, logo_frac):
    bg = background(size).convert('RGBA')
    logo = Image.open(LOGO).convert('RGBA')
    w = round(size * logo_frac)
    h = round(logo.height * w / logo.width)
    logo = logo.resize((w, h), Image.LANCZOS)
    x, y = (size - w) // 2, (size - h) // 2
    # 로고 밑 그림자(바탕에서 떠 보이게)
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    alpha = logo.getchannel('A').point(lambda a: a * 0.45)
    shadow.paste((40, 18, 4, 255), (x, y + max(2, size // 64)), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, size // 96)))
    bg.alpha_composite(shadow)
    bg.alpha_composite(logo, (x, y))
    return bg.convert('RGB')


def main():
    OUT.mkdir(exist_ok=True)
    for size in (192, 512):
        icon(size, 0.76).save(OUT / f'icon-{size}.png', optimize=True)
    icon(180, 0.86).save(OUT / 'apple-touch-icon.png', optimize=True)
    for f in sorted(OUT.glob('*.png')):
        print(f.relative_to(ROOT), f.stat().st_size)


if __name__ == '__main__':
    main()
