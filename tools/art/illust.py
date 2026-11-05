#!/usr/bin/env python3
"""막 번호를 받는 일러스트 다듬기(design/art/act1/make_illust.py의 일반화) + 참고 그림 PNG.

사용: /root/.local/share/sprite-gen/.venv/bin/python -I tools/art/illust.py --act N STEP [인자 ...]
RAW = design/art/act<N>/raw/illust (gitignore). 결과는 assets/illust/, 미리보기는 raw/preview/<이름>.png(절반 크기).

STEP
  cut NAME...         RAW/NAME.png(마젠타 배경) → sprite-gen cutout(--key magenta --decontam auto) + 마젠타 구멍 지우기
                      → RAW/NAME_cut.png. 그림이 구멍을 분홍으로 칠한 곳은 illust.json holes[NAME]의 상자에서 지운다.
  bust WHO FACE SRC   상반신: RAW/SRC_cut.png → 가장자리 마젠타 빼기 → 틀(fit[WHO], 기본 0.92) → 1080×1440.
                      FACE가 base가 아니면 커밋된 assets/illust/bust_WHO_base.webp에 맞춘다(위 60% 알파 IoU,
                      배율 0.94~1.06 + 이동). colorMatch["WHO_FACE"]가 있으면 그 색 무리를 base에 맞춘다.
                      기록은 design/art/act<N>/align.json. iou_head < 0.95면 저장하지 않고 종료 1.
                      greyUnmix에 든 인물은 cut 결과 대신 RAW/SRC.png를 회색 풀기(unmix_grey)로 쓴다.
  monster SRC         몬스터: RAW/SRC.png → 회색 풀기 → monster_act<N>.webp 1440×1440(N=5면 1440×2160), 위아래 여백 6%,
                      아래에 앉힌다.
  bg NAME SRC [blur]  배경: RAW/SRC.png → 2560×1440 가운데 맞춰 자름 → assets/illust/NAME.webp
  battlebg            전투 배경: 커밋된 assets/illust/bg_ch<N>-2.webp → 채도 15%·0.8배·위쪽 잿빛 안개·아래 따뜻하게 12%·흐림 5
                      → battle_bg_act<N>.webp
  refpng WEBP OUT     WebP(투명)를 마젠타(#FF00FF) 바탕에 얹은 PNG(생성 참고 그림용)
  shawlguide OUT      5막 보스 밑그림 1024×1536: 마젠타 바탕, 아래가 넓고 위로 겹겹이 쌓인 둥근 머리 회색(#8A8D91)
                      사람 덩어리 무리, 가로 50%·세로 58%에 폭 30% 날개 모양 숄(#B4C0C6, 불투명도 40%)

design/art/act<N>/illust.json (없어도 된다):
  fit        { WHO: 배율 }                  상반신 틀 배율(원본을 줄여 아래 끝을 맞춘다)
  colorMatch { "WHO_FACE": plum|orange|sky } 표정 그림에서 바랜 옷 색 무리를 base에 맞춘다
  holes      { NAME: [[x0,y0,x1,y1], …] }   원본 좌표 상자: 분홍으로 칠해진 구멍
  greyUnmix  [WHO, …]                       회색 인물(cut 대신 unmix_grey)
  lift       { WHO: 비율 }                   틀에 넣은 뒤 그림 높이의 이 비율만큼 위로 올린다(아래가 녹아 흐르는 인물)

원본(raw/)은 저장소에 없다. 표정 정렬 기준과 전투 배경 원본은 커밋된 WebP에서 다시 읽으므로 컨테이너가 다시 시작돼도 된다.
"""
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'illust')
SPRITE_GEN = '/root/.local/share/sprite-gen/.venv/bin/sprite-gen'

BUST = (1080, 1440)
BG = (2560, 1440)
LIMITS = {'bust': 300_000, 'bg': 700_000, 'monster': 400_000}
IOU_MIN = 0.95
MAGENTA = (255, 0, 255, 255)

GROUPS = {
    'plum': lambda r, g, b: (r > g + 30) & (b > g + 20),
    'orange': lambda r, g, b: (r > 180) & (r - b > 90) & (g > b),
    'sky': lambda r, g, b: (b > r + 15) & (g > r) & (b > 150),
}


class Act:
    def __init__(self, n):
        self.n = n
        self.dir = os.path.join(ROOT, 'design', 'art', f'act{n}')
        self.raw = os.path.join(self.dir, 'raw', 'illust')
        self.preview = os.path.join(self.dir, 'raw', 'preview')
        self.align_path = os.path.join(self.dir, 'align.json')
        p = os.path.join(self.dir, 'illust.json')
        self.conf = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}

    def rawp(self, name):
        return os.path.join(self.raw, name)


# ── 공통 ─────────────────────────────────────────────────────────────

def despill(im, grey=False):
    """반투명 가장자리의 마젠타 기운을 뺀다: spill = min(R,B) − G 만큼 R과 B에서 뺀다.
    grey=True면 모든 픽셀에, 아니면 알파 < 250이고 마젠타 쪽 색(R·B가 G보다 크게 높고 R≈B)인 가장자리에만."""
    a = np.asarray(im.convert('RGBA')).astype(np.int32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    if not grey:
        m = (al < 250) & (spill > 24) & (np.abs(r - b) < 60)
        spill = np.where(m, spill, 0)
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


def alpha_mask(im, k=4):
    return np.asarray(im.getchannel('A').resize((im.width // k, im.height // k), Image.BILINEAR)).astype(np.float32) / 255


def best_shift(A, B):
    """B를 얼마나 옮기면 A와 가장 많이 겹치는지(FFT 상호상관). (dy, dx)"""
    F = np.fft.rfft2(A) * np.conj(np.fft.rfft2(B))
    c = np.fft.irfft2(F, s=A.shape)
    dy, dx = np.unravel_index(np.argmax(c), c.shape)
    if dy > A.shape[0] // 2: dy -= A.shape[0]
    if dx > A.shape[1] // 2: dx -= A.shape[1]
    return int(dy), int(dx)


def place(im, s, dx, dy):
    """같은 크기 캔버스에서 가운데 기준 s배 + (dx, dy) 이동."""
    W, H = im.size
    w, h = round(W * s), round(H * s)
    small = im.resize((w, h), Image.LANCZOS)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.paste(small, ((W - w) // 2 + dx, (H - h) // 2 + dy))
    return c


def head_iou(A, V, cut_y):
    A = A.copy(); V = V.copy()
    A[cut_y:] = 0; V[cut_y:] = 0
    return float(np.minimum(A, V).sum() / max(np.maximum(A, V).sum(), 1e-6))


def align(base, var, top=0.6, k=4):
    """표정 그림(var)을 base에 맞춘다. 머리·어깨(그림 위쪽 top 비율)의 알파가 가장 많이 겹치는 배율·이동을 찾는다.
    배율 0.94~1.06, 1/k 크기에서 찾은 뒤 맞춘 그림으로 IoU를 다시 잰다."""
    A = alpha_mask(base, k)
    bb = base.getbbox()
    cut_y = int((bb[1] + (bb[3] - bb[1]) * top) / k)
    best = None
    for s in np.arange(0.94, 1.0601, 0.01):
        V = alpha_mask(place(var, float(s), 0, 0), k)
        V2 = V.copy(); V2[cut_y:] = 0
        A2 = A.copy(); A2[cut_y:] = 0
        dy, dx = best_shift(A2, V2)
        iou = head_iou(A, np.roll(np.roll(V, dy, 0), dx, 1), cut_y)
        if best is None or iou > best[0]:
            best = (iou, float(s), dx * k, dy * k)
    _, s, dx, dy = best
    out = place(var, s, dx, dy)
    iou = head_iou(A, alpha_mask(out, k), cut_y)  # 실제로 옮긴 그림(가장자리 잘림 포함)으로 다시 잰다
    return out, {'iou_head': round(iou, 4), 'scale': round(s, 3), 'dx': dx, 'dy': dy}


def match_colors(base, var, group):
    """var에서 group 색 픽셀의 채널별 분포(1·10·50·90·99 백분위)를 base의 같은 색 무리에 맞춘다."""
    A = np.asarray(base).astype(np.float32)
    V = np.asarray(var).astype(np.float32).copy()
    sel = GROUPS[group]
    ma = (A[..., 3] > 250) & sel(A[..., 0], A[..., 1], A[..., 2])
    mv = (V[..., 3] > 0) & sel(V[..., 0], V[..., 1], V[..., 2])
    if ma.sum() < 100 or (mv & (V[..., 3] > 250)).sum() < 100:
        sys.exit(f'colorMatch {group}: 색 무리 픽셀이 너무 적다')
    q = [1, 10, 50, 90, 99]
    for ch in range(3):
        src = np.percentile(V[..., ch][mv & (V[..., 3] > 250)], q)
        dst = np.percentile(A[..., ch][ma], q)
        V[..., ch][mv] = np.interp(V[..., ch][mv], src, dst)
    return Image.fromarray(np.clip(V, 0, 255).astype(np.uint8), 'RGBA')


def unmix_grey(path):
    """회색 그림용 마젠타 풀기: P = a·F + (1−a)·K(K는 모서리 마젠타, F는 무채색)에서 a와 F를 푼다(1막과 같음)."""
    r = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    corners = np.concatenate([r[:40, :40].reshape(-1, 3), r[:40, -40:].reshape(-1, 3),
                              r[-40:, :40].reshape(-1, 3), r[-40:, -40:].reshape(-1, 3)])
    K = np.median(corners, 0)
    k = (K[0] + K[2]) / 2 - K[1]
    a = 1 - (((r[..., 0] + r[..., 2]) / 2 - r[..., 1]) / k)
    a = np.clip((np.clip(a, 0, 1) - 0.08) / 0.9, 0, 1)  # 배경 잡티(알파 8% 아래)는 버리고 몸통은 불투명하게
    safe = np.maximum(a, 1e-3)[..., None]
    F = (r - (1 - a[..., None]) * K) / safe
    f = np.clip(F @ np.array([0.299, 0.587, 0.114], np.float32), 0, 255)
    return Image.fromarray(np.dstack([f, f, f, a * 255]).astype(np.uint8), 'RGBA'), K


def cover(im, size):
    W, H = size
    s = max(W / im.width, H / im.height)
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (r.width - W) // 2, (r.height - H) // 2
    return r.crop((x, y, x + W, y + H))


def save_webp(act, im, name, limit):
    path = os.path.join(OUT, f'{name}.webp')
    for q in (85, 80, 75):
        im.save(path, 'WEBP', quality=q, method=6)
        size = os.path.getsize(path)
        if size <= limit:
            break
    else:
        os.remove(path)
        sys.exit(f'{path}: {size} bytes > {limit}')
    print(f'{os.path.relpath(path, ROOT)} {im.size[0]}x{im.size[1]} q{q} {size // 1024}KB')
    os.makedirs(act.preview, exist_ok=True)
    pv = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    if pv.mode == 'RGBA':
        bgc = Image.new('RGBA', pv.size, (221, 221, 213, 255))
        bgc.alpha_composite(pv)
        pv = bgc
    pv.convert('RGB').save(os.path.join(act.preview, f'{name}.png'))
    return q


# ── STEP ─────────────────────────────────────────────────────────────

def cut(act, name):
    src, dst = act.rawp(f'{name}.png'), act.rawp(f'{name}_cut.png')
    subprocess.run([SPRITE_GEN, 'cutout', src, '--out', dst, '--key', 'magenta', '--decontam', 'auto'],
                   check=True, stdout=subprocess.DEVNULL)
    # 머리카락 사이처럼 둘러싸인 배경 구멍: 원본에서 마젠타에 가까운 픽셀은 투명으로.
    r = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)
    key = (r[..., 0] > 200) & (r[..., 2] > 200) & (r[..., 1] < 70)
    c = np.asarray(Image.open(dst).convert('RGBA')).copy()
    c[key, 3] = 0
    for x0, y0, x1, y1 in act.conf.get('holes', {}).get(name, []):
        R, G, B = (r[y0:y1, x0:x1, i] for i in range(3))
        pink = (R > 190) & (R - G > 80) & (B - G > 0) & (B - G < 90)
        grown = np.asarray(Image.fromarray((pink * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        mixed = grown & (R - G > 60) & (B - G > -10)
        c[y0:y1, x0:x1, 3][pink | mixed] = 0
    Image.fromarray(c, 'RGBA').save(dst)
    print(os.path.relpath(dst, ROOT))


def bust(act, who, face, src):
    if who in act.conf.get('greyUnmix', []):
        im, _ = unmix_grey(act.rawp(f'{src}.png'))
    else:
        im = despill(Image.open(act.rawp(f'{src}_cut.png')).convert('RGBA'))
    im = frame(im, act.conf.get('fit', {}).get(who, 0.92)).resize(BUST, Image.LANCZOS)
    lift = act.conf.get('lift', {}).get(who, 0)
    if lift:  # 아래가 녹아 흐르는 인물(잿빛 아이)은 대사 상자에 몸이 가리지 않게 위로 올린다
        up = Image.new('RGBA', BUST, (0, 0, 0, 0))
        up.alpha_composite(im, (0, -round(BUST[1] * lift)))
        im = up
    info = {}
    key = f'{who}_{face}'
    if face != 'base':
        base_path = os.path.join(OUT, f'bust_{who}_base.webp')
        if not os.path.exists(base_path):
            sys.exit(f'{base_path}가 없다: base를 먼저 만들고 커밋한다')
        base = Image.open(base_path).convert('RGBA')
        im, info = align(base, im)
        print('  align', info)
        if info['iou_head'] < IOU_MIN:
            print(f'{key}: iou_head {info["iou_head"]} < {IOU_MIN}, 저장하지 않는다', file=sys.stderr)
            sys.exit(1)
        group = act.conf.get('colorMatch', {}).get(key)
        if group:
            im = match_colors(base, im, group)
            info['color_match'] = group
    q = save_webp(act, im, f'bust_{key}', LIMITS['bust'])
    rec = json.load(open(act.align_path, encoding='utf-8')) if os.path.exists(act.align_path) else {}
    rec[key] = {'src': src, 'quality': q, **info}
    with open(act.align_path, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(rec.items())), f, indent=1, ensure_ascii=False)
        f.write('\n')


def monster(act, src, pad=0.06):
    im, K = unmix_grey(act.rawp(f'{src}.png'))
    print('  key', K.round().tolist())
    bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()  # 옅은 잡티는 틀 계산에서 뺀다
    a = np.asarray(im).copy()
    keep = np.zeros(a.shape[:2], bool); keep[bb[1]:bb[3], bb[0]:bb[2]] = True
    a[~keep, 3] = 0
    im = Image.fromarray(a, 'RGBA').crop(bb)
    TW, TH = (1440, 2160) if act.n == 5 else (1440, 1440)
    s = min(TW * (1 - 2 * pad) / im.width, TH * (1 - 2 * pad) / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    c = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    c.alpha_composite(im, ((TW - im.width) // 2, TH - im.height - round(TH * pad)))  # 아래쪽에 앉힌다
    save_webp(act, c, f'monster_act{act.n}', LIMITS['monster'])


def bg(act, name, src, blur=0.0):
    im = cover(Image.open(act.rawp(f'{src}.png')).convert('RGB'), BG)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    save_webp(act, im, name, LIMITS['bg'])


def battlebg(act):
    """아트 바이블 7절 전투 무대(1막 recipe): 채도 15%·0.8배, 위쪽 잿빛 안개, 아래쪽 따뜻하게 12%, 흐림 5."""
    src = os.path.join(OUT, f'bg_ch{act.n}-2.webp')
    im = cover(Image.open(src).convert('RGB'), BG)
    a = np.asarray(im).astype(np.float32)
    lum = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    a = (lum + (a - lum) * 0.15) * 0.8
    y = np.linspace(0, 1, a.shape[0], dtype=np.float32)[:, None, None]
    fog = np.array([138, 141, 145], np.float32)
    t = np.clip(1 - y / 0.6, 0, 1) ** 1.3 * 0.5
    a = a * (1 - t) + fog * t
    warm = np.clip((y - 0.6) / 0.4, 0, 1) * 0.12
    a = a * (1 - warm) + np.array([217, 165, 91], np.float32) * warm
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))
    save_webp(act, out, f'battle_bg_act{act.n}', LIMITS['bg'])


def refpng(webp, out):
    im = Image.open(webp).convert('RGBA')
    c = Image.new('RGBA', im.size, MAGENTA)
    c.alpha_composite(im)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    c.convert('RGB').save(out)
    print(f'saved {out} {im.width}x{im.height}')


def shawlguide(out, W=1024, H=1536):
    """5막 보스 밑그림: 사람 덩어리를 아래 줄부터 쌓고(아래가 넓다), 무리 한가운데에 날개 모양 숄을 옅게 얹는다.
    덩어리마다 #5E6266 가장자리를 둘러 한 사람씩 읽히게 한다(생성 참고용, 결과 그림에는 윤곽이 없다)."""
    from PIL import ImageDraw
    body, edge, shawl = (138, 141, 145, 255), (94, 98, 102, 255), (180, 192, 198)
    im = Image.new('RGBA', (W, H), MAGENTA)
    d = ImageDraw.Draw(im)
    rows = [7, 7, 6, 6, 5, 4, 3, 2]  # 아래 줄부터 위로(아래가 넓다)
    top, bottom = 0.06 * H, 0.97 * H
    step = (bottom - top) / (len(rows) + 0.4)
    w0 = W * 0.90 / rows[0]
    # 무리 안쪽에 바탕 구멍이 남지 않게, 덩어리들 뒤에 무리 둘레만 한 어두운 덩어리를 먼저 깐다
    env = [(W / 2 - W * 0.45, bottom), (W / 2 + W * 0.45, bottom)]
    env += [(W / 2 + w0 * n / 2 * 0.95, bottom - (i + 0.8) * step) for i, n in enumerate(rows)]
    env += [(W / 2 - w0 * n / 2 * 0.95, bottom - (i + 0.8) * step) for i, n in reversed(list(enumerate(rows)))]
    d.polygon(env, fill=edge)
    for i, n in reversed(list(enumerate(rows))):  # 위(뒤) 줄을 먼저 그려 아래(앞) 줄이 덮는다
        y_feet = bottom - i * step + (0 if i == 0 else step * 0.5)
        w = w0 * (1 - 0.03 * i)
        hr = w * 0.26  # 머리 반지름
        off = (w * 0.5 if (rows[0] - n) % 2 else 0) * 0
        for k in range(n):
            cx = W / 2 + (k - (n - 1) / 2) * w + off
            hy = bottom - i * step - step * 1.25
            sh = hy + hr * 1.05  # 처진 어깨에서 아래로 넓어지는 몸
            poly = [(cx - w * 0.30, sh + hr * 0.55), (cx - w * 0.15, sh), (cx + w * 0.15, sh), (cx + w * 0.30, sh + hr * 0.55),
                    (cx + w * 0.56, y_feet), (cx - w * 0.56, y_feet)]
            d.polygon(poly, fill=body, outline=edge, width=4)
            d.ellipse((cx - hr, hy - hr, cx + hr, hy + hr), fill=body, outline=edge, width=4)
    # 숄: 가운데(50%, 58%)에서 양쪽 위로 뒤로 날리는 두 날개, 전체 폭 30%
    cx, cy, half = 0.5 * W, 0.58 * H, 0.15 * W
    m = Image.new('L', (W, H), 0)
    md = ImageDraw.Draw(m)
    for sgn in (-1, 1):
        pts = [(cx, cy - 0.01 * H), (cx + sgn * half * 0.45, cy - 0.05 * H), (cx + sgn * half, cy - 0.085 * H),
               (cx + sgn * half * 0.92, cy - 0.04 * H), (cx + sgn * half * 0.80, cy - 0.01 * H),
               (cx + sgn * half * 0.70, cy + 0.015 * H), (cx + sgn * half * 0.45, cy + 0.03 * H), (cx, cy + 0.035 * H)]
        md.polygon(pts, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(2)).point(lambda v: round(v * 0.40))
    layer = Image.new('RGBA', (W, H), shawl + (0,))
    layer.putalpha(m)
    im.alpha_composite(layer)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    im.convert('RGB').save(out)
    print(f'saved {out} {W}x{H}')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--act', type=int, required=True)
    p.add_argument('step', choices=['cut', 'bust', 'monster', 'bg', 'battlebg', 'refpng', 'shawlguide'])
    p.add_argument('args', nargs='*')
    a = p.parse_args()
    act = Act(a.act)
    os.makedirs(OUT, exist_ok=True)
    s, args = a.step, a.args
    if s == 'cut':
        for n in args: cut(act, n)
    elif s == 'bust': bust(act, *args)
    elif s == 'monster': monster(act, *args)
    elif s == 'bg': bg(act, args[0], args[1], float(args[2]) if len(args) > 2 else 0.0)
    elif s == 'battlebg': battlebg(act)
    elif s == 'refpng': refpng(*args)
    elif s == 'shawlguide': shawlguide(*args)


if __name__ == '__main__':
    main()
