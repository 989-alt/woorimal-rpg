#!/usr/bin/env python3
"""그림을 게임용 도트로 줄인다: 줄이기 -> 색표 맞추기 -> 투명 0/255.

사용: /root/.local/share/sprite-gen/.venv/bin/python -I tools/pixelize.py IN OUT --size 512x384 \
        [--palette tools/palette.json] [--max-colors 32] [--alpha-threshold 128]
- 2배보다 크게 줄일 때는 BOX로 먼저 줄인 뒤 NEAREST로 맞춘다.
- 색표 PNG(P 모드)로 쓴다. 색이 --max-colors보다 많으면 오류로 끝낸다.
"""
import argparse, json, os, sys
from PIL import Image


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--size", required=True, help="WxH")
    p.add_argument("--palette", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "palette.json"))
    p.add_argument("--max-colors", type=int, default=32)
    p.add_argument("--alpha-threshold", type=int, default=128)
    a = p.parse_args()
    try:
        w, h = (int(v) for v in a.size.lower().split("x"))
    except ValueError:
        sys.exit("--size는 WxH 모양이어야 합니다")
    pal = [hex_rgb(c) for c in json.load(open(a.palette, encoding="utf-8"))["colors"]]

    im = Image.open(a.src).convert("RGBA")
    if im.width > 2 * w or im.height > 2 * h:
        im = im.resize((max(w, min(im.width, w * 2)), max(h, min(im.height, h * 2))), Image.BOX)
    im = im.resize((w, h), Image.NEAREST)

    cache = {}
    def nearest(rgb):
        if rgb not in cache:
            cache[rgb] = min(range(len(pal)), key=lambda i: sum((pal[i][k] - rgb[k]) ** 2 for k in range(3)))
        return cache[rgb]

    used = {}  # palette index -> output index
    out = Image.new("P", (w, h), 0)
    opx = out.load()
    transparent = False
    src = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, al = src[x, y]
            if al < a.alpha_threshold:
                opx[x, y] = 0  # 임시: 투명은 0번 칸
                transparent = True
                continue
            i = nearest((r, g, b))
            used.setdefault(i, len(used) + 1)
            opx[x, y] = used[i]
    n = len(used)
    if n > a.max_colors:
        sys.exit(f"색이 {n}개로 --max-colors {a.max_colors}보다 많습니다")
    flat = [0, 0, 0]
    for i in sorted(used, key=used.get):
        flat += list(pal[i])
    out.putpalette(flat)
    if transparent:
        out.info["transparency"] = 0
        out.save(a.dst, transparency=0, optimize=True)
    else:
        out.save(a.dst, optimize=True)
    print(f"saved {a.dst} {w}x{h} colors={n}{' +alpha' if transparent else ''}")


if __name__ == "__main__":
    main()
