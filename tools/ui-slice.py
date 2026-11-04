#!/usr/bin/env python3
"""AI가 그린 UI 그림을 게임용 부품으로 자른다. 모든 출력은 8비트 색표 PNG(256색 이하) + 투명(알파 8 이하는 0).

사용: /root/.local/share/sprite-gen/.venv/bin/python -I tools/ui-slice.py <명령> ...
  frame IN OUT --size WxH --slice T,R,B,L --src-corner PX [--asym-right] [--fill]
      대칭 9조각 시트. 알파 상자로 자른 원본에서 왼쪽 위 PX×PX를 L×T 모서리로, 위쪽 가운데 PX×PX 띠를 위 변으로,
      왼쪽 가운데 PX×PX 띠를 왼 변으로 줄인다. 오른쪽은 왼쪽의 거울, 아래는 위의 상하 뒤집기다.
      --asym-right: 오른쪽 모서리·변을 원본 오른쪽에서 같은 방법으로 떼어 온다(두루마리 축. 좌우 대칭 아님).
      --fill: 가운데를 원본 가운데 PX×PX 띠로 채운다(없으면 투명).
  fit IN OUT --size WxH
      알파 상자로 자르고 비율을 지켜 맞춘다(남는 곳 투명). 메달, 로고, 아이콘 하나.
  sheet IN OUTDIR --names a,b,c --size WxH
      연결된 덩어리를 위→아래, 왼→오 순서로 나눠 OUTDIR/<name>.png로 쓴다(각각 fit).
  mask IN OUT --size WxH --slice T,R,B,L --src-corner PX
      리본 가면: frame --fill과 같되 RGB는 모두 흰색, 알파만 모양. 좌우 대칭.
  bar IN OUT --size WxH --slice T,R,B,L [--asym-right] [--mask]
      버튼(가로 3조각, 가운데 채움): 알파 상자로 자른 원본을 높이 H에 맞춰 비율대로 줄이고, 왼쪽 L열을 왼 끝,
      가운데 W-L-R열을 가운데 띠로 쓴다. 오른쪽은 왼쪽의 거울이다. 위아래는 뒤집지 않는다(윤기 띠·아랫단 유지).
      --asym-right: 오른쪽 R열을 원본 오른쪽 끝에서 떼어 온다(두루마리 나무 축).
      --flat-middle: 가운데 띠를 왼 끝 맨 오른쪽 열의 되풀이로 채운다(원본 가운데 띠가 끝 조각과 안 맞아 이음매가 보일 때).
      --mask: RGB를 모두 흰색으로, 알파만 모양(리본 가면. 위아래 조각이 0이라 mask 명령 대신 쓴다).
      T·B는 CSS 조각 값이라 그림에는 쓰지 않는다. 줄인 원본의 너비가 W보다 좁으면 멈춘다.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

ALPHA_CUT = 8


def parse_size(text):
    try:
        w, h = (int(v) for v in text.lower().split("x"))
    except ValueError:
        sys.exit("--size는 WxH 모양이어야 합니다")
    if w < 1 or h < 1:
        sys.exit("--size는 1 이상이어야 합니다")
    return w, h


def parse_slice(text):
    try:
        t, r, b, l = (int(v) for v in text.split(","))
    except ValueError:
        sys.exit("--slice는 T,R,B,L 모양이어야 합니다")
    return t, r, b, l


def load_cropped(path):
    im = Image.open(path).convert("RGBA")
    box = Image.fromarray((np.asarray(im)[:, :, 3] > ALPHA_CUT).astype(np.uint8) * 255).getbbox()
    if box is None:
        sys.exit(f"{path}: 불투명한 곳이 없습니다")
    return im.crop(box)


def save_palette_png(im, path, white=False):
    """RGBA를 256색 이하 색표 PNG로 쓴다. 알파 8 이하는 0."""
    arr = np.array(im.convert("RGBA"))
    arr[arr[:, :, 3] <= ALPHA_CUT] = 0
    if white:
        arr[:, :, :3] = 255  # RGB는 모두 흰색, 알파만 모양
    q = Image.fromarray(arr, "RGBA").quantize(256, Image.Quantize.FASTOCTREE)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    q.save(path, optimize=True)


def piece(src, box, size):
    return src.crop(box).resize(size, Image.Resampling.LANCZOS)


def build_frame(src, size, sl, px, asym_right, fill):
    w, h = size
    t, r, b, l = sl
    sw, sh = src.size
    if px * 2 > min(sw, sh):
        sys.exit(f"--src-corner {px}가 원본({sw}x{sh})에 비해 너무 큽니다")
    inner_w, inner_h = w - l - r, h - t - b
    if inner_w < 0 or inner_h < 0:
        sys.exit("--slice가 --size보다 큽니다")
    cx, cy = sw // 2, sh // 2
    half = px // 2
    out = Image.new("RGBA", size, (0, 0, 0, 0))

    def put(img, xy):
        out.alpha_composite(img, xy)

    if fill and inner_w and inner_h:
        put(piece(src, (cx - half, cy - half, cx - half + px, cy - half + px), (inner_w, inner_h)), (l, t))
    if inner_w:
        put(piece(src, (cx - half, 0, cx - half + px, px), (inner_w, t)), (l, 0))
    if inner_h:
        put(piece(src, (0, cy - half, px, cy - half + px), (l, inner_h)), (0, t))
    put(piece(src, (0, 0, px, px), (l, t)), (0, 0))
    if asym_right:
        if inner_h:
            put(piece(src, (sw - px, cy - half, sw, cy - half + px), (r, inner_h)), (w - r, t))
        put(piece(src, (sw - px, 0, sw, px), (r, t)), (w - r, 0))
    else:
        out = mirror_left_to_right(out)
    # 위쪽 절반을 뒤집어 아래쪽을 만든다(높이가 홀수면 가운데 줄은 그대로)
    top = out.crop((0, 0, w, h // 2))
    out.paste(top.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, h - h // 2))
    return out


def mirror_left_to_right(im):
    w, h = im.size
    left = im.crop((0, 0, (w + 1) // 2, h))
    flipped = left.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    out = im.copy()
    if w % 2 == 0:
        out.paste(flipped, (w - left.width, 0))
    else:
        out.paste(flipped.crop((1, 0, flipped.width, h)), (left.width, 0))
    return out


def fit(src, size):
    w, h = size
    s = min(w / src.width, h / src.height)
    nw, nh = max(1, round(src.width * s)), max(1, round(src.height * s))
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(src.resize((nw, nh), Image.Resampling.LANCZOS), ((w - nw) // 2, (h - nh) // 2))
    return out


def components(alpha):
    """연결된 덩어리(8방향)의 (상자, 면적) 목록."""
    mask = alpha > ALPHA_CUT
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    found = []
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            x1 = x2 = x0
            y1 = y2 = y0
            area = 0
            while stack:
                y, x = stack.pop()
                area += 1
                x1, x2, y1, y2 = min(x1, x), max(x2, x), min(y1, y), max(y2, y)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            found.append(((x1, y1, x2 + 1, y2 + 1), area))
    return found


def reading_order(boxes):
    """위→아래 줄로 묶고 줄 안에서 왼→오."""
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    heights = sorted(b[3] - b[1] for b in boxes)
    tol = heights[len(heights) // 2] / 2
    rows, first_cy = [], None
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if first_cy is None or cy - first_cy > tol:
            rows.append([])
            first_cy = cy
        rows[-1].append(b)
    return [b for row in rows for b in sorted(row, key=lambda b: b[0])]


def build_bar(src, size, sl, asym_right=False, flat_middle=False):
    w, h = size
    _, r, _, l = sl
    sw = round(src.width * h / src.height)
    if sw < w:
        sys.exit(f"높이 {h}에 맞춘 원본 너비 {sw}가 --size 너비 {w}보다 좁습니다")
    scaled = src.resize((sw, h), Image.Resampling.LANCZOS)
    mid = w - l - r
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(scaled.crop((0, 0, l, h)), (0, 0))
    if mid > 0 and flat_middle:
        # 가운데 띠를 왼 끝 맨 오른쪽 한 열의 되풀이로 채운다: 끝 조각과 이음매 없이 이어지고(오른 끝은 거울이라 같은 열),
        # border-image가 가운데를 가로로 늘려도 그대로다. 원본 가운데 띠의 윤기·무늬가 끝 조각과 안 맞을 때 쓴다.
        col = scaled.crop((l - 1, 0, l, h))
        out.alpha_composite(col.resize((mid, h), Image.Resampling.NEAREST), (l, 0))
    elif mid > 0:
        x0 = (sw - mid) // 2
        out.alpha_composite(scaled.crop((x0, 0, x0 + mid, h)), (l, 0))
    if asym_right:
        out.alpha_composite(scaled.crop((sw - r, 0, sw, h)), (w - r, 0))
        return out
    return mirror_left_to_right(out)


def cmd_frame(a, white=False):
    sl = parse_slice(a.slice)
    if min(sl) <= 0:
        sys.exit(f"{a.cmd}: --slice의 네 값은 모두 1 이상이어야 합니다(위·아래가 0인 리본 가면은 bar --mask)")
    src = load_cropped(a.src)
    size = parse_size(a.size)
    out = build_frame(src, size, sl, a.src_corner, getattr(a, "asym_right", False), a.fill or white)
    save_palette_png(out, a.dst, white=white)


def cmd_bar(a):
    save_palette_png(build_bar(load_cropped(a.src), parse_size(a.size), parse_slice(a.slice), a.asym_right,
                               a.flat_middle), a.dst, white=a.mask)


def cmd_fit(a):
    save_palette_png(fit(load_cropped(a.src), parse_size(a.size)), a.dst)


def cmd_sheet(a):
    im = Image.open(a.src).convert("RGBA")
    names = [n for n in a.names.split(",") if n]
    size = parse_size(a.size)
    found = components(np.asarray(im)[:, :, 3])
    if not found:
        sys.exit("덩어리가 없습니다")
    biggest = max(area for _, area in found)
    boxes = [box for box, area in found if area >= biggest * 0.01]  # 먼지 조각은 버린다
    if len(boxes) != len(names):
        sys.exit(f"덩어리 {len(boxes)}개, 이름 {len(names)}개: 수가 맞지 않습니다")
    for name, box in zip(names, reading_order(boxes)):
        save_palette_png(fit(im.crop(box), size), os.path.join(a.outdir, f"{name}.png"))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("frame")
    f.add_argument("src"); f.add_argument("dst")
    f.add_argument("--size", required=True)
    f.add_argument("--slice", required=True)
    f.add_argument("--src-corner", type=int, required=True)
    f.add_argument("--asym-right", action="store_true")
    f.add_argument("--fill", action="store_true")

    m = sub.add_parser("mask")
    m.add_argument("src"); m.add_argument("dst")
    m.add_argument("--size", required=True)
    m.add_argument("--slice", required=True)
    m.add_argument("--src-corner", type=int, required=True)

    b = sub.add_parser("bar")
    b.add_argument("src"); b.add_argument("dst")
    b.add_argument("--size", required=True)
    b.add_argument("--slice", required=True)
    b.add_argument("--asym-right", action="store_true")
    b.add_argument("--mask", action="store_true")
    b.add_argument("--flat-middle", action="store_true")

    t = sub.add_parser("fit")
    t.add_argument("src"); t.add_argument("dst")
    t.add_argument("--size", required=True)

    s = sub.add_parser("sheet")
    s.add_argument("src"); s.add_argument("outdir")
    s.add_argument("--names", required=True)
    s.add_argument("--size", required=True)

    a = p.parse_args()
    if a.cmd == "frame":
        cmd_frame(a)
    elif a.cmd == "mask":
        a.fill = True
        cmd_frame(a, white=True)
    elif a.cmd == "bar":
        cmd_bar(a)
    elif a.cmd == "fit":
        cmd_fit(a)
    else:
        cmd_sheet(a)


if __name__ == "__main__":
    main()
