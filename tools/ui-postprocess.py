#!/usr/bin/env python3
"""AI가 그린 UI 그림을 자르기(ui-slice.py) 전에 다듬는다. 입력·출력은 RGBA PNG.

사용: /root/.local/share/sprite-gen/.venv/bin/python -I tools/ui-postprocess.py <명령> IN OUT
  brass IN OUT
      놋쇠를 탁하게. 노란 금빛 픽셀(색상 30~58°, 채도 0.45 이상, 명도 0.6 이상, 부드러운 가중치)만 골라
      그 무리의 채도·명도 가운뎃값이 s 0.68, v 0.82(놋쇠 #C9963F + 반짝임)에 오도록 줄이고(키우지는 않음),
      색상을 38° 쪽으로 반만 옮긴다. 나무(색상 ~25°, 어두움)·보석·잎은 그대로. 꿀빛 나무 면이 넓은
      그림(btn_wood, btn_icon)에는 쓰지 않는다(나무 면도 같은 색상이라 어두워진다).
  unchecker IN OUT
      그림에 그려 넣은 회색 바둑판 배경 지우기. 채도 0.18 미만 픽셀 가면을 3×3 최대·최소 필터로 메우고,
      가장자리(8px 간격의 점)에서 흘려 채워 이어진 곳만 배경으로 본다. 배경이 아닌 곳을 3×3 최소 필터로
      1px 줄이고 반지름 0.8 가우스로 가장자리를 부드럽게 한 것이 알파다.
  coinface IN OUT
      동전 가운데의 짙은 갈색 면을 밝은 놋쇠 #E2B86C로. 불투명 상자의 가운데·반지름 R에서 거리 0.78R 안,
      RGB 평균 120 미만인 픽셀만 바꾸고, 명암은 (밝기 / 그 무리의 가운뎃값)을 0.6~1.4로 잘라 곱해 남긴다.
  despill IN OUT
      마젠타 번짐 빼기(sprite-gen cutout 뒤). min(R,B) − G > 4인 픽셀은 빛 색 #FFE7A3으로 바꾸고,
      알파 = 알파 × clip(G/231, 0, 1) × clip(1 − (e − 4)/120, 0.15, 1)  (e = min(R,B) − G).
"""
import argparse

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def brass(im):
    a = np.asarray(im).astype(np.float32)
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(np.float32) / 255
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    w = (np.clip((s - 0.45) / 0.1, 0, 1) * np.clip((v - 0.6) / 0.1, 0, 1)
         * np.clip(1 - np.abs(h - 44) / 14, 0, 1) * (a[..., 3] > 8))
    m = w > 0.5
    if not m.any():
        return im
    ks = min(1, 0.68 / np.median(s[m]))
    kv = min(1, 0.82 / np.median(v[m]))
    s2 = s * (1 - w + w * ks)
    v2 = v * (1 - w + w * kv)
    h2 = h + w * (38 - h) * 0.5
    chans = [Image.fromarray(np.clip(x, 0, 255).astype(np.uint8)) for x in (h2 / 360 * 255, s2 * 255, v2 * 255)]
    o = np.asarray(Image.merge('HSV', chans).convert('RGB').convert('RGBA')).copy()
    o[..., 3] = a[..., 3].astype(np.uint8)
    return Image.fromarray(o)


def unchecker(im):
    rgb = np.asarray(im)[..., :3].astype(np.float32) / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    m = Image.fromarray((sat < 0.18).astype(np.uint8) * 255)
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    w, h = m.size
    seeds = [(x, y) for x in range(0, w, 8) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 8) for x in (0, w - 1)]
    for xy in seeds:
        if m.getpixel(xy) == 255:
            ImageDraw.floodfill(m, xy, 128)
    bg = np.asarray(m) == 128
    alpha = (Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
             .filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8)))
    out = np.asarray(im).copy()
    out[..., 3] = np.asarray(alpha)
    return Image.fromarray(out)


def coinface(im):
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    ys, xs = np.nonzero(a[..., 3] > 8)
    cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
    r = (ys.max() - ys.min()) / 2
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(yy - cy, xx - cx) / r
    lum = a[..., :3].mean(-1)
    face = (d < 0.78) & (lum < 120)
    if face.any():
        tone = np.clip(lum / max(1.0, float(np.median(lum[face]))), 0.6, 1.4)[..., None]
        a[face, :3] = np.clip(np.array([226, 184, 108], np.float32) * tone[face], 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def despill(im):
    a = np.asarray(im).astype(np.float32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    e = np.minimum(r, b) - g
    m = (e > 4) & (al > 0)
    k = np.clip(g / 231, 0, 1)  # r, g, b는 a의 보기(view)이므로 색을 바꾸기 전에 셈한다
    a[m, :3] = np.array([255, 231, 163], np.float32)
    a[m, 3] = al[m] * k[m] * np.clip(1 - (e[m] - 4) / 120, 0.15, 1)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


STEPS = {'brass': brass, 'unchecker': unchecker, 'coinface': coinface, 'despill': despill}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('cmd', choices=sorted(STEPS))
    p.add_argument('src')
    p.add_argument('dst')
    a = p.parse_args()
    STEPS[a.cmd](Image.open(a.src).convert('RGBA')).save(a.dst)


if __name__ == '__main__':
    main()
