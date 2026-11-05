#!/usr/bin/env python3
"""막 번호를 받는 도트 다듬기(design/art/act1/make_sprites.py의 일반화) + 참고 그림 띠.

사용: /root/.local/share/sprite-gen/.venv/bin/python -I tools/art/sprites.py --act N JOB [JOB...]
JOB:
  npcs | monsters | icons      design/art/act<N>/sprites.json의 같은 이름 항목대로 시트를 잘라 assets/pixel/에 쓴다.
                               입력은 design/art/act<N>/raw/<src>(마젠타를 sprite-gen cutout으로 지운 RGBA).
  refstrip:OUT:PATH[,PATH…]    각 PNG의 첫 칸(걷기 시트 144×384는 아래 보고 선 48×96 칸, 그 밖은 그림 전체)을
                               8배 최근접으로 키워 마젠타 바탕에 48px 사이를 두고 가로로 놓는다(생성 참고 그림).

sprites.json:
  npcs     { src, grid: [열, 줄], ids: [id | null, …] }         인물 48×96
  monsters { src, order: ['small' | 'boss' | 'npc:<id>', …] }  덩어리를 왼쪽부터 차례로
           small 48×96(그림 48×72 안) · boss 96×96 · npc:<id> 48×96 인물로 저장(잿빛만·디더링·윤곽 없음)
  icons    { src, grid: [열, 줄], ids: [id | null, …] }         아이콘 48×48 가운데
  height   { id: 그림 높이 px }   48×96 칸 안의 그림 전체 높이(머리 위 특징 포함)
  keep     { id: 묶음 | [묶음, …] }  그 id가 써도 되는 예약 색 묶음(hero|dodam|haesol|narae|gold)
  outline  { id: '#RRGGBB' }      바깥 윤곽 색(없으면 옆 색을 어둡게)

다듬기(아트 바이블 8절, 1막과 같음): 덩어리 자르기 → 줄이기(BOX, 알파 0/255) →
design/art/sprite-palette.json에서 예약 색(reserved)을 뺀 색표로 맞추기 → 검정 윤곽 바꾸기 → 칸 아래 가운데.
몬스터·npc: 칸은 잿빛 3단 Bayer 디더링과 가장자리 바둑판 흐림. 저장마다 raw/preview/<이름>.png(4배).
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'pixel')
PALETTE = json.load(open(os.path.join(ROOT, 'design', 'art', 'sprite-palette.json'), encoding='utf-8'))
PAL = PALETTE['colors']
RESERVED = PALETTE['reserved']
FOG = RESERVED['fog']
OWNED = ['hero', 'dodam', 'haesol', 'narae', 'gold']


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def palette(keep=()):
    """예약 색(대표색·음영·말빛 금·잿빛)을 뺀 색표. keep 묶음은 남긴다."""
    banned = {c.upper() for g in OWNED + ['fog'] if g not in keep for c in RESERVED[g]}
    cols = [c for c in PAL if c.upper() not in banned]
    return np.array([rgb(c) for c in cols], dtype=np.float64)


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
    """알파 덩어리를 rows×cols 상자로 자른다(빈 가로줄로 줄, 그 줄 안의 빈 세로줄로 칸, 안 되면 같은 크기로).
    빈 칸은 None."""
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
            ys, xs = np.nonzero(m[y0:y1, x0:x1])
            boxes.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1) if len(xs) else None)
    return boxes


def shrink(img, box, scale):
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
    out[op, :3] = pal[nearest_idx(out[op][:, :3].astype(np.float64), pal)].astype(np.uint8)
    return out


def fix_outline(arr, pal, colour=None):
    """바깥 가장자리(투명과 닿은 점) 중 아주 어두운 무채색 점을 바꾼다:
    colour가 있으면 그 색(색표의 가장 가까운 색), 없으면 안쪽 이웃 색을 어둡게 한 색."""
    H, W = arr.shape[:2]
    op = arr[..., 3] > 0
    out = arr.copy()
    dark = lambda c: max(c) < 70 and (max(c) - min(c)) < 30
    fixed = pal[nearest_idx(np.array([rgb(colour)], dtype=np.float64), pal)[0]].astype(np.uint8) if colour else None
    for y in range(H):
        for x in range(W):
            if not op[y, x]:
                continue
            nb = [(y + dy, x + dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))]
            edge = any(not (0 <= yy < H and 0 <= xx < W) or not op[yy, xx] for yy, xx in nb)
            c = tuple(int(v) for v in arr[y, x, :3])
            if not edge or not dark(c):
                continue
            if fixed is not None:
                out[y, x, :3] = fixed
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
            out[y, x, :3] = pal[nearest_idx(np.array([[v * 0.42 for v in base]]), pal)[0]].astype(np.uint8)
    return out


def place(arr, cw, ch, anchor='bottom', cx=None):
    cell = np.zeros((ch, cw, 4), dtype=np.uint8)
    h, w = arr.shape[:2]
    if h > ch or w > cw:
        raise SystemExit(f'그림 {w}×{h}가 칸 {cw}×{ch}보다 큽니다')
    if cx is None:
        cx = w / 2
    x = min(max(int(round(cw / 2 - cx)), 0), cw - w)
    y = ch - h if anchor == 'bottom' else (ch - h) // 2
    cell[y:y + h, x:x + w] = arr
    return cell


def body_cx(arr):
    """아래쪽 1/3(다리)의 가운데. 지팡이처럼 한쪽으로 뻗은 것 때문에 몸이 칸 가운데서 밀리지 않게."""
    h = arr.shape[0]
    xs = np.nonzero(arr[h * 2 // 3:, :, 3] > 0)[1]
    return (xs.min() + xs.max() + 1) / 2 if len(xs) else arr.shape[1] / 2


def dither_edges(arr):
    """윤곽 대신 가장자리 1px 띠를 바둑판 무늬로 성기게(투명 섞기) 흐린다."""
    op = arr[..., 3] > 0
    H, W = op.shape
    edge = np.zeros_like(op)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        sh = np.zeros_like(op)
        ys = slice(max(dy, 0), H + min(dy, 0)); yd = slice(max(-dy, 0), H + min(-dy, 0))
        xs = slice(max(dx, 0), W + min(dx, 0)); xd = slice(max(-dx, 0), W + min(-dx, 0))
        sh[yd, xd] = ~op[ys, xs]
        edge |= sh
    edge |= np.pad(np.zeros((H - 2, W - 2), dtype=bool), 1, constant_values=True)
    edge &= op
    yy, xx = np.mgrid[0:H, 0:W]
    out = arr.copy()
    out[edge & ((yy + xx) % 2 == 0), 3] = 0
    return out


BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32


def grey_dither(arr, lift=12):
    """잿빛 3단 사이를 4×4 Bayer 디더링으로 잇는다(안개라서 디더링 허용, 아트 바이블 6절)."""
    levels = [rgb(c) for c in ['#5E6266', '#8A8D91', '#B9BBBE']]
    lv = np.array([0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] for c in levels])
    out = arr.copy()
    H, W = arr.shape[:2]
    L = np.clip(0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2] + lift, lv[0], lv[-1])
    k = np.clip(np.searchsorted(lv, L, side='right') - 1, 0, len(lv) - 2)
    frac = (L - lv[k]) / (lv[k + 1] - lv[k])
    yy, xx = np.mgrid[0:H, 0:W]
    pick = np.where(frac > BAYER4[yy % 4, xx % 4], k + 1, k)
    op = arr[..., 3] > 0
    out[op, :3] = np.array(levels, dtype=np.uint8)[pick[op]]
    return out


class Act:
    def __init__(self, n):
        self.dir = os.path.join(ROOT, 'design', 'art', f'act{n}')
        self.raw = os.path.join(self.dir, 'raw')
        p = os.path.join(self.dir, 'sprites.json')
        self.cfg = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}

    def load(self, name):
        return Image.open(os.path.join(self.raw, name)).convert('RGBA')

    def keep(self, nid):
        k = self.cfg.get('keep', {}).get(nid, [])
        return [k] if isinstance(k, str) else list(k)

    def save(self, arr, name):
        save_png(arr, os.path.join(OUT, name + '.png'))
        prev = os.path.join(self.raw, 'preview')
        os.makedirs(prev, exist_ok=True)
        im = Image.fromarray(arr, 'RGBA')
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(prev, name + '.png'))


def save_png(arr, path):
    cols = sorted({tuple(c) for c in arr[arr[..., 3] > 0][:, :3].tolist()})
    if len(cols) > 64:
        raise SystemExit(f'{path}: 색 {len(cols)}개 > 64')
    lut = {c: i + 1 for i, c in enumerate(cols)}
    idx = np.zeros(arr.shape[:2], dtype=np.uint8)
    for (y, x) in zip(*np.nonzero(arr[..., 3] > 0)):
        idx[y, x] = lut[tuple(int(v) for v in arr[y, x, :3])]
    p = Image.fromarray(idx, 'P')
    p.putpalette([0, 0, 0] + [v for c in cols for v in c])
    p.save(path, transparency=0, optimize=True)
    print(f'saved {os.path.relpath(path, ROOT)} {arr.shape[1]}x{arr.shape[0]} colors={len(cols)}')


def figure(img, box, nid, act, fit_h):
    """인물 하나: 줄이기 → 색표 → 윤곽 → 48×96 아래 가운데"""
    scale = min(fit_h / (box[3] - box[1]), 48 / (box[2] - box[0]))
    pal = palette(act.keep(nid))
    a = quantize(shrink(img, box, scale), pal)
    a = fix_outline(a, pal, act.cfg.get('outline', {}).get(nid))
    return place(a, 48, 96, cx=body_cx(a))


def height(act, nid):
    h = act.cfg.get('height', {}).get(nid)
    if not h:
        sys.exit(f'sprites.json height에 {nid}가 없습니다')
    return h


def job_npcs(act):
    c = act.cfg['npcs']
    img = act.load(c['src'])
    boxes = split_grid(np.array(img)[..., 3], *c['grid'])
    for nid, box in zip(c['ids'], boxes):
        if nid is None or box is None:
            continue
        act.save(figure(img, box, nid, act, height(act, nid)), f'npc_{nid}')


def job_monsters(act):
    c = act.cfg['monsters']
    img = act.load(c['src'])
    m = np.array(img)[..., 3] > 128
    n = len(c['order'])
    cs = runs(m.sum(axis=0) > 0, 40)
    cs = sorted(sorted(cs, key=lambda r: r[1] - r[0], reverse=True)[:n])
    if len(cs) != n:
        sys.exit(f'몬스터 덩어리 {len(cs)}개, order는 {n}개')
    for (x0, x1), kind in zip(cs, c['order']):
        ys = np.nonzero(m[:, x0:x1])[0]
        box = (x0, ys.min(), x1, ys.max() + 1)
        if kind == 'small':
            cw, ch, fit, name = 48, 96, (48, 72), f'monster_small_act{act.n}'
        elif kind == 'boss':
            cw, ch, fit, name = 96, 96, (96, 96), f'monster_boss_act{act.n}'
        elif kind.startswith('npc:'):
            nid = kind[4:]
            cw, ch, fit, name = 48, 96, (48, height(act, nid)), f'npc_{nid}'
        else:
            sys.exit(f'알 수 없는 monsters.order 값 {kind}')
        scale = min(fit[0] / (box[2] - box[0]), fit[1] / (box[3] - box[1]))
        a = dither_edges(grey_dither(shrink(img, box, scale)))
        act.save(place(a, cw, ch, cx=body_cx(a)), name)


def job_icons(act):
    c = act.cfg['icons']
    img = act.load(c['src'])
    boxes = split_grid(np.array(img)[..., 3], *c['grid'])
    for nid, box in zip(c['ids'], boxes):
        if nid is None or box is None:
            continue
        pal = palette(['gold'] if 'gold' in act.keep(nid) else [])
        scale = min(46 / (box[2] - box[0]), 46 / (box[3] - box[1]))
        a = quantize(shrink(img, box, scale), pal)
        a = fix_outline(a, pal, act.cfg.get('outline', {}).get(nid))
        act.save(place(a, 48, 48, anchor='center'), f'icon_{nid}')


def refstrip(out, paths, k=8, gap=48):
    cells = []
    for p in paths:
        p = p if os.path.isabs(p) or os.path.exists(p) else os.path.join(ROOT, p)
        im = Image.open(p).convert('RGBA')
        if im.size == (144, 384):  # 걷기 시트: 아래 보고 선 칸
            im = im.crop((0, 0, 48, 96))
        cells.append(im.resize((im.width * k, im.height * k), Image.NEAREST))
    W = sum(c.width for c in cells) + gap * (len(cells) + 1)
    H = max(c.height for c in cells) + gap * 2
    strip = Image.new('RGBA', (W, H), (255, 0, 255, 255))
    x = gap
    for c in cells:
        strip.alpha_composite(c, (x, H - gap - c.height))
        x += c.width + gap
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    strip.convert('RGB').save(out)
    print(f'saved {out} {W}x{H}')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--act', type=int, required=True)
    p.add_argument('jobs', nargs='+')
    a = p.parse_args()
    act = Act(a.act)
    act.n = a.act
    for job in a.jobs:
        if job.startswith('refstrip:'):
            _, out, paths = job.split(':', 2)
            refstrip(out, [q if os.path.dirname(q) else os.path.join('assets', 'pixel', q) for q in paths.split(',')])
        elif job in ('npcs', 'monsters', 'icons'):
            globals()['job_' + job](act)
        else:
            sys.exit(f'알 수 없는 JOB {job}')


if __name__ == '__main__':
    main()
