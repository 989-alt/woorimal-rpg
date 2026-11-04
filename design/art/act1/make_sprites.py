#!/usr/bin/env python3
"""Task 4: AI 시트(마젠타를 sprite-gen cutout으로 지운 RGBA)를 게임용 도트로 바꾼다.

사용: /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act1/make_sprites.py JOB [JOB...]
JOB: hero_f hero_m npcs monsters icons  (입력은 design/art/act1/raw/<원본>_cut.png)

과정(아트 바이블 8절 다듬기):
1. 알파로 그림 덩어리를 찾아 격자 칸마다 자른다(빈 줄·빈 칸 기준, 안 되면 같은 크기로 나눔).
2. 시트 하나는 같은 배율로 줄인다(걷기 프레임 크기가 흔들리지 않게). BOX 평균 → 알파 0/255.
3. 그림마다 허용 색표(대표색·말빛 금·잿빛을 뺀 design/art/act1/sprite-palette.json)로 맞춘다.
4. 바깥 윤곽의 검정에 가까운 점을 그 옆 색을 어둡게 한 색으로 바꾼다(검정 윤곽 금지).
5. 48×96 칸 아래 가운데에 발을 맞춰 놓는다(아이콘 48×48 가운데, 보스 96×96 아래 가운데).
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(ROOT, 'assets', 'pixel')

PAL = json.load(open(os.path.join(HERE, 'sprite-palette.json'), encoding='utf-8'))['colors']
INDIGO = ['#3B5BA5', '#2A4278', '#5A78C2', '#1E2F5A']
PLUM = ['#8E4A7A', '#6A3558', '#A9648F', '#4F2840']
ORANGE = ['#F08A3C']
NARAE = ['#A9C9D6', '#9FD3E8']
GOLD = ['#F2C14E', '#FFE7A3']
FOG = ['#B9BBBE', '#8A8D91', '#5E6266']
GREENS = ['#5FAE5A', '#8CC97F', '#2F6B3A', '#1F4A2A']
SKIN = ['#F7D7BA', '#E9B794', '#C98D6E', '#8F5A45']
WATER = ['#3FA7C9', '#A6DDEB', '#1E5A73']
NEAR_BLACK = '#2B2622'


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def palette(exclude=(), only=None):
    cols = only if only else [c for c in PAL if c.upper() not in {e.upper() for e in exclude}]
    return np.array([rgb(c) for c in cols], dtype=np.float64), cols


def nearest_idx(px, pal):
    # redmean 거리(사람 눈에 가까운 RGB 거리)
    r = (px[:, None, 0] + pal[None, :, 0]) / 2
    d = px[:, None, :] - pal[None, :, :]
    dist = (2 + r / 256) * d[..., 0] ** 2 + 4 * d[..., 1] ** 2 + (2 + (255 - r) / 256) * d[..., 2] ** 2
    return dist.argmin(axis=1)


def runs(profile, min_gap):
    """profile>0 인 구간들 [(a,b)], 사이의 빈칸이 min_gap보다 짧으면 이어 붙인다."""
    on = np.flatnonzero(profile > 0)
    if not len(on):
        return []
    out = [[on[0], on[0]]]
    for v in on[1:]:
        if v - out[-1][1] <= min_gap:
            out[-1][1] = v
        else:
            out.append([v, v])
    return [(a, b + 1) for a, b in out]


def split_grid(alpha, cols, rows):
    """알파 덩어리를 rows×cols 상자로 자른다. 줄은 빈 가로줄, 칸은 그 줄 안의 빈 세로줄로 나눈다."""
    H, W = alpha.shape
    m = alpha > 128
    rws = runs(m.sum(axis=1) > 2, 12)
    rws = [r for r in rws if r[1] - r[0] > H * 0.05]
    if len(rws) != rows:
        rws = [(int(i * H / rows), int((i + 1) * H / rows)) for i in range(rows)]
    boxes = []
    for (y0, y1) in rws:
        cs = runs(m[y0:y1].sum(axis=0) > 1, 12)
        cs = [c for c in cs if c[1] - c[0] > W * 0.03]
        if len(cs) != cols:
            cs = [(int(i * W / cols), int((i + 1) * W / cols)) for i in range(cols)]
        for (x0, x1) in cs:
            sub = m[y0:y1, x0:x1]
            ys, xs = np.nonzero(sub)
            boxes.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1))
    return boxes


def shrink(img, box, scale):
    """box를 잘라 scale로 줄인다(색은 알파를 곱해 평균, 알파는 0/255로)."""
    crop = img.crop(box)
    w = max(1, round(crop.width * scale))
    h = max(1, round(crop.height * scale))
    small = crop.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
    a = np.array(small)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return a


def quantize(arr, pal):
    out = arr.copy()
    op = out[..., 3] > 0
    px = out[op][:, :3].astype(np.float64)
    idx = nearest_idx(px, pal)
    out[op, :3] = pal[idx].astype(np.uint8)
    return out


def fix_outline(arr, pal, cols):
    """바깥 가장자리(투명과 닿은 점) 중 아주 어두운 무채색 점을 안쪽 이웃 색을 어둡게 한 색으로 바꾼다."""
    H, W = arr.shape[:2]
    op = arr[..., 3] > 0
    out = arr.copy()
    dark = lambda c: max(c) < 70 and (max(c) - min(c)) < 30
    for y in range(H):
        for x in range(W):
            if not op[y, x]:
                continue
            nb = [(y + dy, x + dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))]
            edge = any(not (0 <= yy < H and 0 <= xx < W) or not op[yy, xx] for yy, xx in nb)
            c = tuple(int(v) for v in arr[y, x, :3])
            if not edge or not dark(c):
                continue
            inner = []
            for dy in (-2, -1, 0, 1, 2):
                for dx in (-2, -1, 0, 1, 2):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and op[yy, xx]:
                        cc = tuple(int(v) for v in arr[yy, xx, :3])
                        if not dark(cc):
                            inner.append(cc)
            if not inner:
                continue
            base = max(set(inner), key=inner.count)
            target = np.array([[v * 0.42 for v in base]])
            out[y, x, :3] = pal[nearest_idx(target, pal)[0]].astype(np.uint8)
    return out


def place(arr, cw, ch, anchor='bottom', cx=None):
    cell = np.zeros((ch, cw, 4), dtype=np.uint8)
    h, w = arr.shape[:2]
    if h > ch or w > cw:
        raise SystemExit(f'그림 {w}×{h}가 칸 {cw}×{ch}보다 큽니다')
    if cx is None:
        cx = w / 2
    x = int(round(cw / 2 - cx))
    x = min(max(x, 0), cw - w)
    y = ch - h if anchor == 'bottom' else (ch - h) // 2
    cell[y:y + h, x:x + w] = arr
    return cell


def body_cx(arr):
    """아래쪽 1/3(다리)의 가운데. 지팡이처럼 한쪽으로 뻗은 것 때문에 몸이 칸 가운데서 밀리지 않게."""
    h = arr.shape[0]
    op = arr[h * 2 // 3:, :, 3] > 0
    xs = np.nonzero(op)[1]
    return (xs.min() + xs.max() + 1) / 2 if len(xs) else arr.shape[1] / 2


def save_png(arr, path):
    im = Image.fromarray(arr, 'RGBA')
    cols = {tuple(c) for c in arr[arr[..., 3] > 0][:, :3].tolist()}
    if len(cols) > 64:
        raise SystemExit(f'{path}: 색 {len(cols)}개 > 64')
    # 색표 PNG: 0번 칸 투명
    pal_list = sorted(cols)
    lut = {c: i + 1 for i, c in enumerate(pal_list)}
    idx = np.zeros(arr.shape[:2], dtype=np.uint8)
    op = arr[..., 3] > 0
    for (y, x) in zip(*np.nonzero(op)):
        idx[y, x] = lut[tuple(int(v) for v in arr[y, x, :3])]
    p = Image.fromarray(idx, 'P')
    flat = [0, 0, 0] + [v for c in pal_list for v in c]
    p.putpalette(flat)
    p.save(path, transparency=0, optimize=True)
    print(f'saved {os.path.relpath(path, ROOT)} {arr.shape[1]}x{arr.shape[0]} colors={len(cols)}')


def load(name):
    return Image.open(os.path.join(RAW, name)).convert('RGBA')


def frame(img, box, scale, pal, anchor_cx=True):
    a = shrink(img, box, scale)
    a = quantize(a, pal)
    a = fix_outline(a, pal, None)
    return a


def hero(sex, raw, target_h=70):
    img = load(raw)
    alpha = np.array(img)[..., 3]
    boxes = split_grid(alpha, 3, 4)
    # 줄마다 같은 배율: 그 줄의 서기(가운데 칸) 키를 target_h로(AI가 방향마다 크기를 조금씩 다르게 그려서)
    widest = max(b[2] - b[0] for b in boxes)
    pal, _ = palette(exclude=PLUM + ORANGE + NARAE + GOLD + FOG + GREENS + WATER)
    sheet = np.zeros((384, 144, 4), dtype=np.uint8)
    frames, scales = [], []
    for r in range(4):
        ref = boxes[r * 3 + 1]
        scale = min(target_h / (ref[3] - ref[1]), 46 / widest)
        scales.append(round(scale, 4))
        frames += [frame(img, b, scale, pal) for b in boxes[r * 3:r * 3 + 3]]
    # AI 시트 칸 순서는 왼발·서기·오른발. 게임 시트(아트 바이블 8절, render.js)는 서기·왼발·오른발이다.
    order = [1, 0, 2]
    for i, f in enumerate(frames):
        r, c = divmod(i, 3)
        c = order.index(c)
        cell = place(f, 48, 96, cx=body_cx(f))
        sheet[r * 96:(r + 1) * 96, c * 48:(c + 1) * 48] = cell
    save_png(sheet, os.path.join(OUT, f'walk_hero_{sex}.png'))
    print(f'  row scales {scales}, heights', [f.shape[0] for f in frames])


NPC_IDS = ['dodam', 'daon', 'gardener', 'baker', 'laundry', 'gate']
NPC_H = {'dodam': 76, 'daon': 60, 'gardener': 74, 'baker': 78, 'laundry': 70, 'gate': 70}


def npcs(raw):
    img = load(raw)
    boxes = split_grid(np.array(img)[..., 3], 3, 2)
    for nid, box in zip(NPC_IDS, boxes):
        h, w = box[3] - box[1], box[2] - box[0]
        scale = min(NPC_H[nid] / h, 48 / w)
        if nid == 'dodam':
            pal, _ = palette(exclude=INDIGO + ORANGE + NARAE + GOLD + FOG + GREENS + WATER)
        else:
            pal, _ = palette(exclude=INDIGO + PLUM + ORANGE + NARAE + GOLD + FOG + GREENS + WATER)
        f = frame(img, box, scale, pal)
        cell = place(f, 48, 96, cx=body_cx(f))
        save_png(cell, os.path.join(OUT, f'npc_{nid}.png'))


def dither_edges(arr, pal_fog):
    """윤곽 대신 가장자리 2px 띠를 바둑판 무늬로 성기게(투명 섞기) 흐린다."""
    op = arr[..., 3] > 0
    H, W = op.shape
    dist = np.full(op.shape, 99)
    dist[~op] = 0
    for _ in range(3):
        d2 = dist.copy()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            sh = np.full(op.shape, 0)
            ys = slice(max(dy, 0), H + min(dy, 0)); yd = slice(max(-dy, 0), H + min(-dy, 0))
            xs = slice(max(dx, 0), W + min(dx, 0)); xd = slice(max(-dx, 0), W + min(-dx, 0))
            sh[yd, xd] = dist[ys, xs]
            d2 = np.minimum(d2, sh + 1)
        dist = np.where(op, d2, 0)
    yy, xx = np.mgrid[0:H, 0:W]
    checker = (yy + xx) % 2 == 0
    out = arr.copy()
    out[(dist == 1) & checker, 3] = 0
    return out


BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32


def grey_dither(arr, lift=12):
    """잿빛 3단 사이를 4×4 바둑판(Bayer) 디더링으로 이어 부드럽게 칠한다(안개라서 디더링 허용, 아트 바이블 6절).
    lift만큼 밝혀 안개가 무겁게 보이지 않게 한다."""
    levels = [rgb(c) for c in ['#5E6266', '#8A8D91', '#B9BBBE']]
    lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    lv = np.array([lum(c) for c in levels])
    out = arr.copy()
    H, W = arr.shape[:2]
    L = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2] + lift
    L = np.clip(L, lv[0], lv[-1])
    k = np.clip(np.searchsorted(lv, L, side='right') - 1, 0, len(lv) - 2)
    frac = (L - lv[k]) / (lv[k + 1] - lv[k])
    yy, xx = np.mgrid[0:H, 0:W]
    pick = np.where(frac > BAYER4[yy % 4, xx % 4], k + 1, k)
    cols = np.array(levels, dtype=np.uint8)
    op = arr[..., 3] > 0
    out[op, :3] = cols[pick[op]]
    return out


def monsters(raw):
    img = load(raw)
    alpha = np.array(img)[..., 3]
    m = alpha > 128
    # 두 덩어리: 빈 세로줄로 나눈다(흩날린 조각은 가까운 덩어리에 붙인다)
    cs = runs(m.sum(axis=0) > 0, 40)
    cs = sorted(cs, key=lambda c: c[1] - c[0], reverse=True)[:2]
    cs.sort()
    pal, _ = palette(only=FOG)
    out = []
    for (x0, x1), (cw, ch, fit) in zip(cs, [(48, 96, (48, 72)), (96, 96, (96, 96))]):
        ys = np.nonzero(m[:, x0:x1])[0]
        box = (x0, ys.min(), x1, ys.max() + 1)
        scale = min(fit[0] / (box[2] - box[0]), fit[1] / (box[3] - box[1]))
        a = shrink(img, box, scale)
        a = grey_dither(a)
        a = dither_edges(a, pal)
        out.append(place(a, cw, ch, cx=body_cx(a)))
    save_png(out[0], os.path.join(OUT, 'monster_small_act1.png'))
    save_png(out[1], os.path.join(OUT, 'monster_boss_act1.png'))


def icons(raw):
    img = load(raw)
    boxes = split_grid(np.array(img)[..., 3], 3, 1)
    base = INDIGO + PLUM + ORANGE + NARAE + GOLD + FOG + GREENS + SKIN
    REDS = ['#E0584F', '#B04038']
    for nid, box in zip(['water', 'firewood', 'letter'], boxes):
        # 나무 물건은 빨강을 빼야 나뭇결이 붉게 바뀌지 않는다. 편지는 빨간 봉인을 남긴다.
        pal, _ = palette(exclude=base + (REDS if nid != 'letter' else WATER))
        scale = min(46 / (box[2] - box[0]), 46 / (box[3] - box[1]))
        f = frame(img, box, scale, pal)
        save_png(place(f, 48, 48, anchor='center'), os.path.join(OUT, f'icon_{nid}.png'))


JOBS = {
    'hero_f': lambda src: hero('f', src or 'walk_hero_f_a1_cut.png', 74),
    'hero_m': lambda src: hero('m', src or 'walk_hero_m_a1_cut.png', 71),
    'npcs': lambda src: npcs(src or 'npcs_a1_cut.png'),
    'monsters': lambda src: monsters(src or 'monsters_a2_cut.png'),
    'icons': lambda src: icons(src or 'icons_a1_cut.png'),
}

if __name__ == '__main__':
    for arg in sys.argv[1:]:
        job, _, src = arg.partition('=')
        JOBS[job](src or None)
