#!/usr/bin/env python3
"""1막 일러스트 후처리 (Task 5). sprite-gen venv의 파이썬으로 실행한다:
  /root/.local/share/sprite-gen/.venv/bin/python -I design/art/act1/make_illust.py STEP [이름 ...]

STEP
  cut NAME...       raw/illust/NAME.png(마젠타 배경) → sprite-gen cutout(--key magenta --decontam auto) → NAME_cut.png
  bust WHO FACE SRC 상반신: SRC_cut.png를 base에 맞춰(표정이면) 정렬하고 1080×1440 WebP로 저장
  battle WHO SRC    전투 자세: SRC_cut.png → assets/illust/battle_hero_WHO.webp (1080×1440)
  monster SRC       몬스터: SRC_cut.png → assets/illust/monster_act1.webp (1440×1440)
  bg NAME SRC [blur] 배경: SRC.png → assets/illust/NAME.webp (2560×1440, 가운데 맞춰 자름, blur 반지름)
  battlebg SRC      전투 배경: 장 배경 원본을 잿빛(채도 15%)·흐림·위쪽 안개로 바꿔 battle_bg_act1.webp

원본(raw/)은 저장소에 없다. 결과 파일과 이 스크립트만 남긴다.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
RAW = os.path.join(ROOT, 'design/art/act1/raw/illust')
OUT = os.path.join(ROOT, 'assets/illust')
SPRITE_GEN = '/root/.local/share/sprite-gen/.venv/bin/sprite-gen'
ALIGN = os.path.join(RAW, 'align.json')  # 표정별 정렬 값 기록

BUST = (1080, 1440)
BG = (2560, 1440)
MONSTER = (1440, 1440)
# 상반신 틀: 원본(1776×2368, 머리~허리)을 FIT배로 줄여 아래 끝을 맞추면 눈높이가 위에서 약 1/3에 온다.
FIT = {'default': 0.92}
LIMITS = {'bust': 300_000, 'bg': 700_000, 'monster': 400_000}


def raw(name):
    return os.path.join(RAW, name)


def cut(name):
    src, dst = raw(f'{name}.png'), raw(f'{name}_cut.png')
    subprocess.run([SPRITE_GEN, 'cutout', src, '--out', dst, '--key', 'magenta', '--decontam', 'auto'],
                   check=True, stdout=subprocess.DEVNULL)
    # 머리카락 사이처럼 둘러싸인 배경 구멍은 cutout이 남기거나 다른 색으로 칠할 수 있다:
    # 원본에서 마젠타에 가까운 픽셀은 투명으로 만든다.
    r = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)
    key = (r[..., 0] > 200) & (r[..., 2] > 200) & (r[..., 1] < 70)
    c = np.asarray(Image.open(dst).convert('RGBA')).copy()
    c[key, 3] = 0
    # 그림이 구멍을 분홍으로 칠한 곳(HOLES): 상자 안의 분홍 픽셀과 그 둘레 2px의 섞인 픽셀을 투명으로.
    for box in HOLES.get(name, []):
        x0, y0, x1, y1 = box
        R, G, B = (r[y0:y1, x0:x1, i] for i in range(3))
        pink = (R > 190) & (R - G > 80) & (B - G > 0) & (B - G < 90)
        grown = np.asarray(Image.fromarray((pink * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        mixed = grown & (R - G > 60) & (B - G > -10)
        c[y0:y1, x0:x1, 3][pink | mixed] = 0
    Image.fromarray(c, 'RGBA').save(dst)
    return dst


# 원본 좌표 상자(x0, y0, x1, y1): 주인공 여자아이 말총머리 가닥 사이를 그림이 분홍으로 칠했다.
HOLES = {f'bust_hero_f_{f}_a1': [(200, 350, 360, 530)] for f in ('base', 'surprise', 'joy')}


def despill(im, grey=False):
    """반투명 가장자리의 마젠타 기운을 뺀다: spill = min(R,B) − G 만큼 R과 B에서 뺀다.
    grey=True(몬스터)면 모든 픽셀에, 아니면 알파 < 250이고 마젠타 쪽 색(R·B가 G보다 크게 높고 R≈B)인 가장자리에만."""
    a = np.asarray(im.convert('RGBA')).astype(np.int32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    if not grey:
        mask = (al < 250) & (spill > 24) & (np.abs(r - b) < 60)
        spill = np.where(mask, spill, 0)
    a[..., 0] = r - spill
    a[..., 2] = b - spill
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def frame(im, fit):
    """원본 크기 캔버스에서 fit배로 줄이고 아래 끝·가로 가운데를 맞춘다."""
    W, H = im.size
    w, h = round(W * fit), round(H * fit)
    small = im.resize((w, h), Image.LANCZOS)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.alpha_composite(small, ((W - w) // 2, H - h))
    return c


def mask(im, k=4):
    a = np.asarray(im.getchannel('A').resize((im.width // k, im.height // k), Image.BILINEAR)).astype(np.float32) / 255
    return a


def best_shift(A, B):
    """B를 얼마나 옮기면 A와 가장 많이 겹치는지(FFT 상호상관). (dy, dx, 겹침)"""
    F = np.fft.rfft2(A) * np.conj(np.fft.rfft2(B))
    c = np.fft.irfft2(F, s=A.shape)
    i = np.unravel_index(np.argmax(c), c.shape)
    dy, dx = i
    if dy > A.shape[0] // 2: dy -= A.shape[0]
    if dx > A.shape[1] // 2: dx -= A.shape[1]
    return dy, dx, c[i]


def place(im, s, dx, dy):
    """원본 크기 캔버스에서 가운데 기준 s배 + (dx, dy) 이동."""
    W, H = im.size
    w, h = round(W * s), round(H * s)
    small = im.resize((w, h), Image.LANCZOS)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.paste(small, ((W - w) // 2 + dx, (H - h) // 2 + dy))  # 빈 캔버스라 그대로 복사(음수 위치도 됨)
    return c


def align(base, var, top=0.6):
    """표정 그림(var)을 base에 맞춘다. 머리·어깨(그림 위쪽 top 비율)의 알파가 가장 많이 겹치는 배율·이동을 찾는다.
    배율 0.94~1.06, 1/4 크기에서 찾은 뒤 원래 크기로 돌린다."""
    k = 4
    A = mask(base, k)
    bb = base.getbbox()
    cut_y = int((bb[1] + (bb[3] - bb[1]) * top) / k)
    A[cut_y:] = 0
    best = None
    for s in np.arange(0.94, 1.0601, 0.01):
        V = mask(place(var, float(s), 0, 0), k)
        V2 = V.copy(); V2[cut_y:] = 0
        dy, dx, _ = best_shift(A, V2)
        Vs = np.roll(np.roll(V, dy, 0), dx, 1); Vs[cut_y:] = 0
        inter = np.minimum(A, Vs).sum(); union = np.maximum(A, Vs).sum()
        iou = inter / union
        if best is None or iou > best[0]:
            best = (iou, float(s), int(dx) * k, int(dy) * k)
    iou, s, dx, dy = best
    out = place(var, s, dx, dy)
    return out, {'iou_head': round(float(iou), 4), 'scale': round(s, 3), 'dx': dx, 'dy': dy}


# 표정 그림을 만들며 옷 색이 바랜/짙어진 경우: 그 색 무리(이름)만 base의 색 분포에 맞춘다.
COLOR_MATCH = {'dodam_laugh': 'plum'}
GROUPS = {'plum': lambda r, g, b: (r > g + 30) & (b > g + 20)}


def match_colors(base, var, group):
    """var에서 group 색 픽셀의 채널별 분포(1·10·50·90·99 백분위)를 base의 같은 색 무리에 맞춘다."""
    A = np.asarray(base).astype(np.float32)
    V = np.asarray(var).astype(np.float32).copy()
    sel = GROUPS[group]
    ma = (A[..., 3] > 250) & sel(A[..., 0], A[..., 1], A[..., 2])
    mv = (V[..., 3] > 0) & sel(V[..., 0], V[..., 1], V[..., 2])
    q = [1, 10, 50, 90, 99]
    for ch in range(3):
        src = np.percentile(V[..., ch][mv & (V[..., 3] > 250)], q)
        dst = np.percentile(A[..., ch][ma], q)
        V[..., ch][mv] = np.interp(V[..., ch][mv], src, dst)
    return Image.fromarray(np.clip(V, 0, 255).astype(np.uint8), 'RGBA')


def save_webp(im, path, limit, quality=85):
    im.save(path, 'WEBP', quality=quality, method=6)
    size = os.path.getsize(path)
    if size > limit and quality > 80:
        return save_webp(im, path, limit, 80)
    if size > limit:
        sys.exit(f'{path}: {size} bytes > {limit}')
    print(f'{os.path.relpath(path, ROOT)} {im.size[0]}x{im.size[1]} q{quality} {size // 1024}KB')
    return quality


def bust(who, face, src):
    im = despill(Image.open(raw(f'{src}_cut.png')).convert('RGBA'))
    info = {}
    if face != 'base':
        base = despill(Image.open(raw(f'{_base_src(who)}_cut.png')).convert('RGBA'))
        im, info = align(base, im)
        if f'{who}_{face}' in COLOR_MATCH:
            im = match_colors(base, im, COLOR_MATCH[f'{who}_{face}'])
            info['color_match'] = COLOR_MATCH[f'{who}_{face}']
    im = frame(im, FIT.get(who, FIT['default']))
    out = im.resize(BUST, Image.LANCZOS)
    q = save_webp(out, os.path.join(OUT, f'bust_{who}_{face}.webp'), LIMITS['bust'])
    rec = json.load(open(ALIGN)) if os.path.exists(ALIGN) else {}
    rec[f'{who}_{face}'] = {'src': src, 'quality': q, **info}
    json.dump(rec, open(ALIGN, 'w'), indent=1)
    if info: print('  align', info)


def _base_src(who):
    rec = json.load(open(ALIGN))
    return rec[f'{who}_base']['src']


def battle(who, src, fit=0.92):
    im = despill(Image.open(raw(f'{src}_cut.png')).convert('RGBA'))
    im = frame(im, fit)
    save_webp(im.resize(BUST, Image.LANCZOS), os.path.join(OUT, f'battle_hero_{who}.webp'), LIMITS['bust'])


def monster(src, pad=0.06):
    im = despill(Image.open(raw(f'{src}_cut.png')).convert('RGBA'), grey=True)
    bb = im.getbbox()
    im = im.crop(bb)
    side = round(max(im.size) * (1 + 2 * pad))
    c = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    c.alpha_composite(im, ((side - im.width) // 2, side - im.height - round(side * pad)))  # 아래쪽에 앉힌다
    save_webp(c.resize(MONSTER, Image.LANCZOS), os.path.join(OUT, 'monster_act1.webp'), LIMITS['monster'])


def cover(im, size):
    W, H = size
    s = max(W / im.width, H / im.height)
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (r.width - W) // 2, (r.height - H) // 2
    return r.crop((x, y, x + W, y + H))


def bg(name, src, blur=0.0):
    im = cover(Image.open(raw(f'{src}.png')).convert('RGB'), BG)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    save_webp(im, os.path.join(OUT, f'{name}.webp'), LIMITS['bg'])


def battlebg(src):
    """아트 바이블 7절 전투 무대: 장소 배경을 채도 15%로 빼고 흐리게, 위쪽은 잿빛 안개, 아래쪽은 살짝 따뜻하게."""
    im = cover(Image.open(raw(f'{src}.png')).convert('RGB'), BG)
    a = np.asarray(im).astype(np.float32)
    lum = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    a = (lum + (a - lum) * 0.15) * 0.8  # 채도 15%, 조금 어둡게(밝은 흙길이 하얗게 뜨지 않게)
    H = a.shape[0]
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    fog = np.array([138, 141, 145], np.float32)  # 잿빛 가운데 단
    t = np.clip(1 - y / 0.6, 0, 1) ** 1.3 * 0.5  # 위쪽일수록 안개
    a = a * (1 - t) + fog * t
    warm = np.clip((y - 0.6) / 0.4, 0, 1) * 0.12  # 아래쪽(주인공 쪽)은 살짝 따뜻하게
    a = a * (1 - warm) + np.array([217, 165, 91], np.float32) * warm
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))
    save_webp(out, os.path.join(OUT, 'battle_bg_act1.webp'), LIMITS['bg'])


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    step, args = sys.argv[1], sys.argv[2:]
    if step == 'cut':
        for n in args: print(cut(n))
    elif step == 'bust': bust(*args)
    elif step == 'battle': battle(*args)
    elif step == 'monster': monster(*args)
    elif step == 'bg': bg(args[0], args[1], float(args[2]) if len(args) > 2 else 0.0)
    elif step == 'battlebg': battlebg(*args)
    else: sys.exit(__doc__)
