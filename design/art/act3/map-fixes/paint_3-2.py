# 3-2 윤슬내 다시 그리기(선생님: "냇물도 위아래 구분이 되도록, 나무다리도 둥근 모양으로 디테일을 챙겨").
# 48px 그림 위에 물·다리·디딤돌을 손으로(코드로) 다시 칠한다. 칸 데이터(data/acts/act3.js)는 그대로다.
#   윗물(맨 위 윗물길 → 왼쪽 위 웅덩이 → 왼쪽 끝 도랑의 작은 폭포 둘): 물안개에 바랜 회청색, 잔물결·윤슬 없이 멈춰 있다.
#   아랫물(9~12줄 냇물): 왼쪽 어귀에서 안개가 걷히며 오른쪽(하류)으로 갈수록 맑고, 잔물결이 오른쪽으로 흐르고 흰 1px 윤슬.
#   깊이: 윗둑 흙벽 그늘 → 가운데 깊은 물길 → 아랫둑 얕은 물·조약돌·갈대.
#   다리(14~15열): 가운데가 솟은 둥근 아치 나무다리. 먼 쪽 널은 촘촘(기울어 멀어짐), 가까운 쪽 널은 넓다.
#     난간은 가운데가 바깥으로 둥글게 부풀고, 기둥 머리는 둥글다. 오른쪽 물에 아치 모양 그림자.
#     바닥 널은 길과 같은 모래색(걸을 수 있는 칸은 길 색 40% 이상).
#   디딤돌(23~25열 10~11줄, (24,12)): 물 위의 둥글넓적한 돌 일곱 개. 윗면은 길 색, 옆면은 돌색, 위쪽 물에 물거품, 아래쪽으로 물살 자국.
#     걸을 수 없는 물속 바위는 회색이라 디딤돌과 헷갈리지 않는다.
# 사용: $PY paint_3-2.py BASE.png OUT.png [--only water,bridge,stones,decor]
#   BASE는 1536x1152 그림(색표든 RGB든). OUT은 RGB(색표 맞추기는 quant_3-2.py).
import sys, math
import numpy as np
from PIL import Image

T, W, H = 48, 1536, 1152
args = sys.argv[1:]
src, out = args[0], args[1]
only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else {'water', 'bridge', 'stones', 'decor'}
# 다시 그린(AI) 그림 위에는: --only mistify,stream,bridge,stones,glints

def hx(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)

C = {k: hx(v) for k, v in dict(
    path='#F5D48F', path_sh='#ECC884', path_sh2='#E9C479', plank_gap='#CEAA64', cream='#FBF5E6',
    w0='#1E5A73', w1='#2A6F8E', w2='#3788A9', w3='#3FA7C9', w4='#75BCC9', w5='#A6DDEB',
    m0='#567A78', m1='#7E9E9C', m2='#9DB8B2', m3='#BCCDC4', m4='#DCE5DA',
    wood_hi='#C08F68', wood='#A8714A', wood_mid='#9A6F38', wood_dk='#7A4E30', wood_ol='#553420', honey='#D9A55B',
    st_hi='#C9BFAE', st='#AEA38D', st_mid='#8F8576', st_dk='#6E6A62', st_wet='#4C5E5A',
    g_ol='#1F4A2A', g_dk='#2F6B3A', g_mid='#3B8846', g='#5FAE5A', g_hi='#8CC97F', g_lime='#8DD651', g_reed='#A5C159',
).items()}
CLEAR = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'cream']
MISTY = ['m0', 'm1', 'm1', 'm2', 'm3', 'm4', 'm4']

img = np.array(Image.open(src).convert('RGB'))
assert img.shape == (H, W, 3), img.shape
rng = np.random.default_rng(32)
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16
BAY = np.tile(BAYER, (H // 4, W // 4))
Y, X = np.mgrid[0:H, 0:W]
xs = np.arange(W)

def smooth2d(sy, sx, seed):
    r = np.random.default_rng(seed).uniform(-1, 1, (H // sy + 3, W // sx + 3)).astype(np.float32)
    im = Image.fromarray(r).resize(((W // sx + 3) * sx, (H // sy + 3) * sy), Image.BICUBIC)
    return np.clip(np.array(im)[:H, :W], -1, 1)

def put(x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and 0 <= y < H:
        img[y, x] = C[c] if isinstance(c, str) else c

def S(f, period, ph=0.0):
    return np.sin(2 * np.pi * f / period + ph)

# ---------------------------------------------------------------- 물 모양
yF = np.round(458 + 4 * S(xs, 530, 0.4) + 2 * S(xs, 170, 1.3)).astype(int)        # 윗둑 흙벽 위끝
hf = np.round(13 + 3 * S(xs, 90, 0.5)).astype(int)                                 # 흙벽 높이
yW = yF + hf                                                                       # 물 위끝
yB = np.round(588 + 5 * S(xs, 470, 2.0) + 2 * S(xs, 130, 0.3)).astype(int)         # 물 아래끝
ys = np.round(30 + 3 * S(xs, 300) + 2 * S(xs, 97, 1.0)).astype(int)                # 맨 위 윗물길 아래끝

creek = (Y >= yF[None]) & (Y < yB[None])
face = (Y >= yF[None]) & (Y < yW[None])
# 웅덩이: 둥근 네모 몸통 + 길 아래로 뻗은 자락
nang = smooth2d(40, 40, 5)
dx, dy = (X - 300) / 205.0, (Y - 70) / 140.0
pond = (np.abs(dx) ** 3 + np.abs(dy) ** 3) ** (1 / 3) < 1 + 0.035 * nang
dx2, dy2 = (X - 468) / 46.0, (Y - 172) / 40.0
pond |= (dx2 ** 2 + dy2 ** 2) < 1 + 0.08 * nang
stream = (X >= 470) & (Y < ys[None])
# 도랑: 웅덩이 왼쪽 아래에서 냇물 어귀까지
yy = np.arange(H)
bxc = 92 - 20 * np.clip((yy - 170) / 290, 0, 1) + 8 * np.sin((yy - 170) / 40.0)
bhw = 21 + 3 * np.sin(yy / 23.0)
brook = (Y >= 160) & (Y < yW[70] + 2) & (np.abs(X - bxc[:, None]) < bhw[:, None])
mouth = brook & face                       # 도랑이 흙벽을 넘어 떨어지는 곳(작은 폭포)
face &= ~brook
upper = pond | stream | brook
water = (creek & ~face) | upper

# 안개 정도(0 맑음 ~ 1 바램)
mist = np.zeros((H, W), np.float32)
mist[upper] = 1.0
mb = np.clip(1.0 - (Y - 250) / 420.0, 0.45, 1.0)
mist = np.where(brook & ~pond, mb, mist)
mc = 0.5 * np.exp(-((X - 80) / 270.0) ** 2) * np.clip(1 - (Y - yW[None]) / 160.0, 0.6, 1)
mist = np.where(creek & ~brook, mc, mist)

def runs(mask, axis, rev):
    """mask 안에서 축을 따라 바깥까지 거리(맵 끝은 멀리)"""
    m = mask if not rev else np.flip(mask, axis)
    d = np.zeros(m.shape, np.int32)
    n = m.shape[axis]
    prev = np.full(m.shape[1 - axis], 999, np.int32)
    for i in range(n):
        cur = m[i] if axis == 0 else m[:, i]
        prev = np.where(cur, prev + 1, 0)
        if axis == 0: d[i] = prev
        else: d[:, i] = prev
    return np.flip(d, axis) if rev else d

if 'water' in only:
    dn, ds = runs(water, 0, False), runs(water, 0, True)
    dl, dr = runs(water, 1, False), runs(water, 1, True)
    n1, n2, n3, n4 = smooth2d(12, 60, 1), smooth2d(14, 70, 2), smooth2d(10, 40, 3), smooth2d(4, 9, 4)
    lev = np.full((H, W), 3, np.int8)
    deep = np.minimum(dn, ds)
    lev[(deep > 24 + 6 * n2)] = 2
    lev[(deep > 52 + 8 * n2) & upper] = 1
    lev[dl < 4 + 2 * n1] = 1                      # 왼쪽 둑 그늘
    lev[(dr < 3 + n1) & (lev > 2)] = 4            # 오른쪽 둑은 볕
    lev[ds < 9 + 3 * n3] = 4                      # 아래쪽 얕은 물
    lev[(ds < 3 + n3) & (n4 > -0.35)] = 5         # 물가 거품 줄
    lev[dn < 9 + 2 * n1] = 1                      # 윗둑 흙벽 그늘
    lev[dn < 4 + 1.5 * n1] = 0
    # 웅덩이 위끝(맵 끝)은 그늘 없음
    lev[upper & (Y < 12) & (lev < 2)] = 3
    # 물안개 띠: 바랜 물 위에 한 단 밝은 결을 성기게
    wisp = smooth2d(10, 90, 7)
    wmask = upper & (wisp > 0.35) & ((X + Y) % 2 == 0) & (lev < 5)
    lev[wmask] += 1
    wmask2 = upper & (wisp > 0.62) & ((X // 2 + Y) % 2 == 0) & (lev < 5)
    lev[wmask2] += 1
    # 냇물 어귀 안개도 결로
    wm3 = creek & (mist > 0.2) & (wisp > 0.45) & ((X + Y) % 2 == 0) & (lev < 5) & (lev > 1)
    lev[wm3] += 1

    useM = BAY < mist
    for i in range(7):
        sel = water & (lev == i)
        img[sel & useM] = C[MISTY[i]]
        img[sel & ~useM] = C[CLEAR[i]]

    def wcol(x, y, i):
        return MISTY[i] if BAY[y, x] < mist[y, x] else CLEAR[i]

    # 잔물결: 맑은 물에서 오른쪽(하류)으로 길게 늘어진 결. 하류일수록 많고 길다.
    open_w = water & ~upper & (lev >= 2) & (lev <= 4)
    cand = np.argwhere(open_w & (rng.random((H, W)) < 0.010))
    rng.shuffle(cand)
    used = np.zeros((H, W), bool)
    for y, x in cand:
        if mist[y, x] > 0.35 or not (yW[x] + 8 < y < yB[x] - 6):
            continue
        down = x / W
        L = int(rng.integers(5, 10) + 9 * down * rng.random())
        if x + L >= W or used[max(0, y - 3):y + 4, max(0, x - 4):x + L + 4].any():
            continue
        if not open_w[y, x:x + L].all():
            continue
        used[y, x:x + L] = True
        base = lev[y, x]
        up = min(base + 1, 5) if base < 4 else 5
        for k in range(L):
            img[y, x + k] = C[wcol(x + k, y, up)]
        for k in range(L // 2, L + 2):                 # 결 아래 그늘(오른쪽으로 비켜서)
            if x + k < W and open_w[y + 1, x + k]:
                img[y + 1, x + k] = C[wcol(x + k, y + 1, max(base - 1, 0))]
        if rng.random() < 0.15 + 0.55 * down and mist[y, x] < 0.15:   # 윤슬: 흰 1px 점
            img[y, x + L - 1] = C['cream']
            if rng.random() < 0.4:
                put(x + L + 1, y - 1, 'cream')
    # 윤슬 점만 따로: 하류 쪽 가운데 물길에 성기게
    cand = np.argwhere(open_w & (rng.random((H, W)) < 0.0016))
    for y, x in cand:
        if mist[y, x] < 0.1 and rng.random() < (x / W) ** 1.3 + 0.1:
            img[y, x] = C['cream']
            if rng.random() < 0.3:
                put(x + 2, y, 'cream')

    # 윗둑 흙벽(9줄): 풀 끝 → 흙 → 젖은 밑동, 박힌 돌
    nF = smooth2d(4, 6, 9)
    for x in range(W):
        if not face[yF[x], x]:
            continue
        for y in range(yF[x], yW[x]):
            k = y - yF[x]
            if k == 0: c = 'g_ol'
            elif k >= hf[x] - 2: c = 'wood_ol'
            elif k == 2 and nF[y, x] > 0.1: c = 'wood_mid'
            elif k == hf[x] - 4 and nF[y, x] < -0.3: c = 'wood_mid'
            else: c = 'wood_dk'
            img[y, x] = C[c]
        drip = int(max(0, rng.integers(-3, 5)))          # 둑 위 풀이 흙벽으로 늘어진다
        for k in range(1, drip):
            img[yF[x] + k, x] = C['g_dk' if k < drip - 1 else 'g_ol']
    # 흙벽 돌
    x = 6
    while x < W:
        rx, ry = int(rng.integers(5, 10)), int(rng.integers(3, 5))
        cx = x + rx
        if cx < W and face[yF[cx] + 2, cx]:
            cy = yF[cx] + int(rng.integers(4, max(5, hf[cx] - 3)))
            for yy2 in range(cy - ry, cy + ry + 1):
                for xx in range(cx - rx, cx + rx + 1):
                    if not (0 <= xx < W) or not face[min(yy2, H - 1), xx]:
                        continue
                    e = ((xx - cx) / rx) ** 2 + ((yy2 - cy) / ry) ** 2
                    if e > 1: continue
                    if e > 0.72 and yy2 >= cy: c = 'st_dk'
                    elif yy2 < cy - ry * 0.3: c = 'st_hi'
                    elif yy2 > cy + ry * 0.3: c = 'st_mid'
                    else: c = 'st'
                    img[yy2, xx] = C[c]
        x += int(rng.integers(14, 40))

    # 작은 폭포: 도랑이 흙벽을 넘어 냇물로 떨어진다
    for y, x in np.argwhere(mouth):
        k = (x + (y // 3)) % 4
        img[y, x] = C[wcol(x, y, 5 if k == 0 else (4 if k == 2 else 3))]
    for x in range(int(bxc[yW[70]] - bhw[yW[70]] - 6), int(bxc[yW[70]] + bhw[yW[70]] + 7)):
        for y in range(yW[x] - 1, yW[x] + 6):
            if water[y, x] and rng.random() < 0.75 - 0.1 * (y - yW[x]):
                img[y, x] = C[wcol(x, y, 5 if rng.random() < 0.7 else 6)]
    # 도랑 계단 폭포 둘(바랜 물)
    for ystep in (300, 384):
        for x in range(int(bxc[ystep] - bhw[ystep]) + 1, int(bxc[ystep] + bhw[ystep])):
            if not brook[ystep, x]: continue
            img[ystep, x] = C[wcol(x, ystep, 5)]
            for k in range(1, 7):
                img[ystep + k, x] = C[wcol(x, ystep + k, 1 if (x % 3) else 4)]
            for k in range(7, 10):
                if rng.random() < 0.7: img[ystep + k, x] = C[wcol(x, ystep + k, 5)]

    # 물가: 아래쪽 둑과 옆 둑에 젖은 조약돌 띠, 그 바깥에 풀 끝 윤곽
    land = ~water & ~face & ~mouth
    above_w = np.zeros((H, W), np.int32)       # 바로 위로 몇 칸째 땅인가(위가 물일 때)
    run = np.zeros(W, np.int32)
    for y in range(H):
        run = np.where(land[y], np.where(water[y - 1] if y else False, 1, np.where(run > 0, run + 1, 0)), 0)
        above_w[y] = run
    sh = (4 + 2 * smooth2d(6, 10, 11)).round()
    pn = rng.random((H, W))
    band = land & (above_w > 0) & (above_w <= sh)
    img[band] = C['st']
    img[band & (pn < 0.35)] = C['st_hi']
    img[band & (pn > 0.75)] = C['st_mid']
    img[land & (above_w == 1)] = C['st_wet']
    img[land & (above_w == 1) & (pn < 0.3)] = C['st_mid']
    edge = land & (above_w == sh + 1) & (pn < 0.8)
    img[edge] = C['g_dk']
    # 옆 둑(웅덩이·도랑의 좌우)
    side = np.zeros((H, W), bool)
    for d in (1, 2, 3):
        side |= np.roll(water, d, 1) | np.roll(water, -d, 1)
    sideb = land & side & (above_w == 0)
    img[sideb] = C['st']
    img[sideb & (pn < 0.4)] = C['st_hi']
    side1 = np.roll(water, 1, 1) | np.roll(water, -1, 1)
    img[land & side1 & (above_w == 0)] = C['st_wet']
    out4 = (np.roll(water, 4, 1) | np.roll(water, -4, 1)) & land & ~side & (above_w == 0)
    img[out4] = C['g_ol']
    # 위쪽 땅이 물 아래로 내려오는 곳(웅덩이 아래끝 아래 = 아래 둑): 위 처리로 됨. 물 위쪽 땅(웅덩이 남쪽 밖 아님)
    below_w = np.zeros((H, W), np.int32)
    run = np.zeros(W, np.int32)
    for y in range(H - 1, -1, -1):
        run = np.where(land[y], np.where(water[y + 1] if y < H - 1 else False, 1, np.where(run > 0, run + 1, 0)), 0)
        below_w[y] = run
    # 물 바로 위 땅(물의 북쪽 둑, 웅덩이·도랑 쪽): 짧은 흙턱 2px
    nb = land & (below_w > 0) & (below_w <= 3) & ~creek
    img[nb & (below_w == 1)] = C['wood_ol']
    img[nb & (below_w == 2)] = C['wood_dk']
    img[nb & (below_w == 3)] = C['g_ol']
    WATER, UPPER, MIST = water, upper, mist

# ---------------------------------------------------------------- 다리
BX0, BX1, BY0, BY1 = 14 * T, 16 * T, 9 * T, 13 * T
HS = 30                    # 아치 높이(그림 px)
NPL = 14                   # 널 수
def bulge(y):              # 난간이 가운데에서 바깥으로 부푸는 양
    t = np.clip((y - BY0) / (BY1 - BY0), 0, 1)
    return 11 * np.sin(np.pi * t) ** 1.1

def plank_y(t):
    return BY0 + (BY1 - BY0) * t - HS * np.sin(np.pi * t)

def draw_bridge():
    # 물 위 아치 그림자(볕이 왼쪽 위라 오른쪽으로): 가운데가 넓다
    for y in range(BY0, BY1):
        t = (y - BY0) / (BY1 - BY0)
        b = bulge(y)
        x0 = int(round(BX1 - 4 + b + 7 + 1 + 0.24 * HS * np.sin(np.pi * t)))
        w = int(round(4 + 0.45 * HS * np.sin(np.pi * t)))
        for x in range(x0, x0 + w):
            if 0 <= x < W and (y > 440 if 'water' not in only else (WATER[y, x] and not UPPER[y, x])):
                p = img[y, x].astype(int)
                # 한두 단 어둡게
                for a, bb in (('w5', 'w4'), ('w4', 'w3'), ('w3', 'w1'), ('w2', 'w1'), ('cream', 'w3'), ('m4', 'm3'), ('m3', 'm2'), ('m2', 'm1')):
                    if (p == C[a]).all():
                        if x < x0 + w - 2 or (x + y) % 2 == 0:
                            img[y, x] = C[bb]
                        break
    # 다리 아래끝 길(13줄)은 평평한 길 색으로 비우고, 끝 기둥 그림자만 작게
    img[BY1 - 1:BY1 + 24, BX0 - 32:BX1 + 32] = C['path']
    for cx in (BX0 - 2, BX1 + 4):
        for y in range(BY1, BY1 + 3):
            img[y, cx:cx + 12 - 2 * (y - BY1)] = C['path_sh']
    # 바닥 널
    ts = np.linspace(0, 1, NPL + 1)
    ybs = plank_y(ts)
    for y in range(BY0, BY1):
        b = bulge(y)
        xl, xr = int(round(BX0 + 4 - b)), int(round(BX1 - 4 + b))
        # 이 y가 어느 널 안인가
        k = int(np.searchsorted(ybs, y + 0.5) - 1)
        k = min(max(k, 0), NPL - 1)
        y0, y1 = ybs[k], ybs[k + 1]
        pos = y - y0                    # 널 안 위치
        hgt = y1 - y0
        tmid = (k + 0.5) / NPL
        for x in range(xl, xr):
            c = 'path'
            if pos < 1:                                  # 널 사이 틈
                c = 'plank_gap'
            elif tmid > 0.5 and pos > hgt - 5:           # 가까운 쪽(볕을 등진 비탈)은 널 아래쪽이 그늘
                c = 'path_sh'
            elif tmid <= 0.5 and pos < 2 and hgt > 4:    # 먼 쪽(볕을 받는 비탈)은 널 위끝이 밝다
                c = 'cream' if (x + k) % 5 else 'path'
            img[y, x] = C[c]
        # 널 끝 못
        if 2 <= pos < 3 or (hgt < 7 and pos == hgt // 2):
            img[y, xl + 2] = C['wood_mid']; img[y, xr - 3] = C['wood_mid']
        # 왼쪽 난간 그림자가 바닥에
        img[y, xl:xl + 2] = C['path_sh2']
    # 꼭대기 널: 밝은 줄
    k = NPL // 2
    yc = int(round(ybs[k])) + 1
    for x in range(int(BX0 + 4 - bulge(yc)) + 2, int(BX1 - 4 + bulge(yc)) - 1):
        img[yc, x] = C['cream']
    # 결 무늬
    for _ in range(26):
        y = int(rng.integers(BY0 + 4, BY1 - 4)); b = bulge(y)
        x = int(rng.integers(int(BX0 + 8 - b), int(BX1 - 14 + b)))
        L = int(rng.integers(3, 7))
        if (img[y, x:x + L] == C['path']).all():
            img[y, x:x + L] = C['path_sh']
    # 아치 옆판: 난간 바깥으로 보이는 휜 옆 들보. 다리가 높은 가운데일수록 넓게 보여 둥근 몸통이 읽힌다.
    for y in range(BY0 + 6, BY1 - 4):
        t = (y - BY0) / (BY1 - BY0)
        wf = int(round(1 + 0.24 * HS * np.sin(np.pi * t)))
        b = bulge(y)
        xl0 = int(round(BX0 + 4 - b)) - 7
        xr0 = int(round(BX1 - 4 + b)) + 7
        for i in range(wf + 1):
            last = i == wf
            img[y, xl0 - 1 - i] = C['wood_ol' if last else ('wood_mid' if i < wf - 1 else 'wood')]
            img[y, xr0 + i] = C['wood_ol' if last else ('wood_dk' if i < wf - 1 else 'wood_ol')]
        if (y - BY0) % 12 == 0 and wf > 2:              # 옆판 널 이음
            img[y, xl0 - wf:xl0 - 1] = C['wood_dk']
            img[y, xr0 + 1:xr0 + wf] = C['wood_ol']
    # 난간(두 줄) — 둥글게 부푼 들보, 윗면 밝고 바깥 어둡게
    for side in (-1, 1):
        for y in range(BY0 - 2, BY1 + 1):
            b = bulge(y)
            if side < 0:
                x0 = int(round(BX0 + 4 - b)) - 7
                cols = ['wood_ol', 'wood_hi', 'wood_hi', 'wood', 'wood', 'wood_dk', 'wood_ol']
            else:
                x0 = int(round(BX1 - 4 + b))
                cols = ['wood_ol', 'wood_hi', 'wood', 'wood', 'wood_dk', 'wood_dk', 'wood_ol']
            for i, c in enumerate(cols):
                img[y, x0 + i] = C[c]
            if (y - BY0) % 9 == 0:                       # 들보 이음매
                img[y, x0 + 1:x0 + 6] = C['wood_dk']
    # 둥근 기둥: 양 끝(둑) 넷 + 꼭대기 둘 + 사이 넷
    def post(cx, cy, tall):
        r = 6
        # 몸통(보이는 남쪽 면)
        for y in range(cy, cy + tall):
            for x in range(cx - r, cx + r + 1):
                u = (x - cx) / r
                if abs(u) > 1: continue
                c = 'wood_ol' if abs(u) > 0.84 else ('wood_hi' if u < -0.35 else ('wood_dk' if u > 0.4 else 'wood'))
                if y == cy + tall - 1: c = 'wood_ol'
                img[y, x] = C[c]
        # 둥근 머리(윗면)
        for y in range(cy - 5, cy + 4):
            for x in range(cx - r, cx + r + 1):
                e = ((x - cx) / (r + 0.3)) ** 2 + ((y - cy + 0.5) / 4.3) ** 2
                if e > 1: continue
                c = 'wood_ol' if e > 0.68 else ('honey' if (x - cx) + (y - cy) < -1 else 'wood_hi')
                img[y, x] = C[c]
        img[cy - 2, cx - 2] = C['path']                 # 머리 반짝(볕)
    for t, tall in ((0.0, 14), (0.25, 9), (0.5, 9), (0.75, 9), (1.0, 14)):
        y = int(round(BY0 + (BY1 - BY0) * t)) if t not in (0.0, 1.0) else (BY0 + 4 if t == 0 else BY1 - 16)
        b = bulge(y)
        post(int(round(BX0 + 4 - b)) - 4, y, tall)
        post(int(round(BX1 - 4 + b)) + 3, y, tall)
    # 다리 머리 돌(둑에 놓인 받침돌)
    for (cx, cy) in ((BX0 - 12, BY0 + 26), (BX1 + 12, BY0 + 26), (BX0 - 12, BY1 - 34), (BX1 + 12, BY1 - 34)):
        for y in range(cy - 4, cy + 6):
            for x in range(cx - 7, cx + 8):
                e = ((x - cx) / 7.5) ** 2 + ((y - cy) / 5.5) ** 2
                if e > 1: continue
                c = 'st_dk' if e > 0.7 and y >= cy else ('st_hi' if y < cy - 1 else ('st_mid' if y > cy + 2 else 'st'))
                img[y, x] = C[c]

# ---------------------------------------------------------------- 디딤돌
STONES = [  # 칸(x,y), 가운데 비켜남, 반지름, 모양 지수, 울퉁불퉁 위상
    ((23, 10), (-1, 2), (21, 18), 2.5, 0.3), ((24, 10), (1, 0), (23, 19), 2.3, 1.7), ((25, 10), (1, 2), (21, 18), 2.7, 2.9),
    ((23, 11), (2, 1), (21, 19), 2.4, 4.1), ((24, 11), (-1, 2), (22, 18), 2.8, 5.3), ((25, 11), (-2, 0), (22, 19), 2.5, 0.9),
    ((24, 12), (0, -4), (21, 17), 2.6, 2.2),
]

def draw_stones():
    top_all = np.zeros((H, W), bool)
    shapes = []
    for (tx, ty), (ox, oy), (a, b), p, ph in STONES:
        cx, cy = tx * T + 24 + ox, ty * T + 21 + oy
        x0, x1, y0, y1 = cx - a - 3, cx + a + 4, cy - b - 3, cy + b + 12
        yy2, xx2 = np.mgrid[y0:y1, x0:x1]
        ang = np.arctan2(yy2 - cy, xx2 - cx)
        r = (np.abs((xx2 - cx) / a) ** p + np.abs((yy2 - cy) / b) ** p) * (1 + 0.09 * np.sin(3 * ang + ph) + 0.05 * np.sin(5 * ang + 2 * ph))
        top = r <= 1
        sidem = np.zeros_like(top)
        for k in range(1, 7):
            sh = np.zeros_like(top); sh[k:] = top[:-k]
            sidem |= sh
        sidem &= ~top
        shapes.append((x0, y0, top, sidem, cx, cy, a, b, p, r))
        top_all[y0:y1, x0:x1] |= top | sidem
    # 물 쪽 거품(왼쪽 = 상류) · 돌 둘레 젖은 그늘 · 아래(하류 오른쪽) 물살 자국
    for x0, y0, top, sidem, cx, cy, a, b, p, r in shapes:
        allm = top | sidem
        hh, ww = allm.shape
        for y in range(hh):
            for x in range(ww):
                if allm[y, x]: continue
                X0, Y0 = x0 + x, y0 + y
                if top_all[Y0, X0]: continue
                near = allm[max(0, y - 2):y + 3, max(0, x - 2):x + 3].any()
                if not near: continue
                if X0 < cx - a * 0.5:
                    img[Y0, X0] = C['w5' if (X0 + Y0) % 3 else 'cream']
                elif Y0 > cy:
                    img[Y0, X0] = C['w0' if Y0 > cy + b * 0.6 else 'w1']
        # 물살 자국: 돌 오른쪽으로 벌어지는 두 줄
        for sgn, y_start in ((-1, cy - b // 2), (1, cy + b // 2 + 5)):
            xx, yv = cx + a + 2, float(y_start)
            for k in range(int(rng.integers(12, 20))):
                X0, Y0 = xx + k, int(round(yv + sgn * k * 0.22))
                if 0 <= X0 < W and not top_all[Y0, X0] and (k % 6) != 5:
                    img[Y0, X0] = C['w5' if k < 9 else 'w4']
            put(xx + 5, y_start - 2 * sgn, 'cream')
    for x0, y0, top, sidem, cx, cy, a, b, p, r in shapes:
        hh, ww = top.shape
        for y in range(hh):
            for x in range(ww):
                X0, Y0 = x0 + x, y0 + y
                if sidem[y, x]:
                    k = 0
                    while y - k - 1 >= 0 and not top[y - k - 1, x]: k += 1
                    below = y + 1 >= hh or not (top[y + 1, x] or sidem[y + 1, x])
                    edge_lr = (x == 0 or not (top[y, x - 1] or sidem[y, x - 1])) or (x == ww - 1 or not (top[y, x + 1] or sidem[y, x + 1]))
                    if below or edge_lr: c = 'st_wet'
                    elif k <= 1: c = 'st_hi'
                    elif k <= 3: c = 'st'
                    else: c = 'st_mid'
                    img[Y0, X0] = C[c]
                elif top[y, x]:
                    rr = r[y, x]
                    up_left = (X0 - cx) / a + (Y0 - cy) / b < -0.2
                    if rr > 0.9 and (Y0 < cy - b * 0.55 or up_left): c = 'st_hi'     # 윗가장자리 테
                    elif rr > 0.9: c = 'st'
                    elif rr > 0.8 and up_left: c = 'cream'
                    elif rr > 0.8 and not up_left and Y0 > cy: c = 'path_sh'
                    else: c = 'path'
                    img[Y0, X0] = C[c]
        # 윗면 윤곽(아래쪽은 옆면이 받는다): 볕 쪽은 밝은 돌색, 그늘 쪽은 어두운 돌색
        allm = top | sidem
        for y in range(hh):
            for x in range(ww):
                if not top[y, x]: continue
                nb = [(y - 1, x), (y, x - 1), (y, x + 1)]
                if any(not (0 <= j < hh and 0 <= i < ww) or not allm[j, i] for j, i in nb):
                    img[y0 + y, x0 + x] = C['st_dk' if (x0 + x) > cx + a * 0.3 else 'st_mid']
        # 이끼 조금, 잔금
        for _ in range(3):
            X0 = int(cx + rng.integers(-a // 2, a // 2)); Y0 = int(cy + rng.integers(-b // 3, b // 2))
            img[Y0, X0:X0 + 3] = C['path_sh2']
        mx, my = cx + a - 6, cy + b // 2 - 2
        for d in ((0, 0), (1, 0), (0, 1), (-1, 1), (1, 1)):
            put(mx + d[0], my + d[1], 'g_reed' if d != (0, 0) else 'g')

# ---------------------------------------------------------------- 꾸밈: 갈대, 물속 회색 바위, 덤불
def reeds(cx, base_y, n, spread=7, hmin=9, hmax=20, cat=True):
    for i in range(n):
        x = cx + int(rng.integers(-spread, spread + 1))
        h = int(rng.integers(hmin, hmax))
        lean = rng.uniform(-0.18, 0.18)
        col = ['g_dk', 'g_mid', 'g', 'g_reed'][int(rng.integers(0, 4))]
        for k in range(h):
            xx = int(round(x + lean * k))
            c = 'g_ol' if k == 0 else (col if k < h - 3 else ('g_lime' if col != 'g_dk' else 'g_mid'))
            put(xx, base_y - k, c)
            if k < 3: put(xx + 1, base_y - k, 'g_dk')
        if cat and rng.random() < 0.35:
            tx, ty = int(round(x + lean * h)), base_y - h
            for k in range(5):
                put(tx, ty + k, 'wood_dk'); put(tx + 1, ty + k, 'wood' if k < 3 else 'wood_dk')
            put(tx, ty - 1, 'g_dk')

def rock(cx, cy, a, b):
    for y in range(cy - b - 1, cy + b + 5):
        for x in range(cx - a - 1, cx + a + 2):
            e = ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2
            e2 = ((x - cx) / a) ** 2 + ((y - cy - 3) / b) ** 2
            if e <= 1:
                c = 'st_dk' if e > 0.8 and y > cy - 1 else ('st_hi' if (x - cx) / a + (y - cy) / b < -0.5 else ('st' if y < cy + b * 0.3 else 'st_mid'))
                img[y, x] = C[c]
            elif e2 <= 1:
                img[y, x] = C['st_wet']
    for x in range(cx - a - 4, cx - a):
        if (x + cy) % 2: put(x, cy + 1, 'w5')
    for k in range(10):
        if k % 4 != 3: put(cx + a + 2 + k, cy + 2 + k // 5, 'w4')

def bush(cx, cy, r):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            e = ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.85)) ** 2
            if e > 1 or not (0 <= x < W and 0 <= y < H): continue
            lit = (x - cx) + (y - cy) < -r * 0.5
            if e > 0.8: c = 'g_ol'
            elif lit and e < 0.5: c = 'g_hi' if (x + y) % 4 == 0 else 'g'
            elif lit: c = 'g'
            elif (x - cx) + (y - cy) > r * 0.5: c = 'g_dk'
            else: c = 'g_mid'
            img[y, x] = C[c]

# ---------------------------------------------------------------- 다시 그린 그림 손질
CLEAR2MIST = {'w0': 'm0', 'w1': 'm1', 'w2': 'm1', 'w3': 'm2', 'w4': 'm3', 'w5': 'm4', 'cream': 'm4'}
def mistify():
    """도랑과 냇물 어귀의 맑은 물빛을 물안개 색으로(위쪽일수록 많이, 디더링)."""
    m = np.zeros((H, W), np.float32)
    region_b = (Y >= 120) & (Y < yW[None] + 14) & (np.abs(X - bxc[:, None]) < bhw[:, None] + 26)
    m = np.where(region_b, np.clip(1.0 - (Y - 280) / 380.0, 0.5, 1.0), m)
    veil = smooth2d(16, 120, 23)
    mouth_m = 0.6 * np.clip(1 - (X - 60) / 540.0, 0, 1) ** 1.6 * np.clip(0.75 + 0.6 * veil, 0, 1.2) * ((Y >= 440) & (Y < 610))
    m = np.maximum(m, mouth_m)
    use = BAY < m
    for a, b in CLEAR2MIST.items():
        sel = use & (img == C[a]).all(-1)
        img[sel] = C[b]

ys2 = np.round(21 + 2 * S(xs, 260, 0.7) + 1.5 * S(xs, 83, 2.0)).astype(int)
def stream():
    """맨 위 윗물길(오른쪽 끝까지): 바랜 회청색, 멈춘 물, 물안개 결, 아래 물가 조약돌."""
    wisp = smooth2d(6, 70, 17)
    for x in range(470, W):
        top = ys2[x]
        for y in range(0, top):
            ds = top - y
            lv = 3 if ds > 4 else 4
            if y < 3: lv = 2
            if ds <= 1 and (x * 7 + y) % 5: lv = 5
            if wisp[y, x] > 0.3 and (x + y) % 2 == 0 and lv < 5: lv += 1
            img[y, x] = C[MISTY[lv]]
        for k in range(3):                               # 젖은 조약돌 물가
            c = 'st_wet' if k == 0 else ('st_hi' if (x * 13 + k) % 7 < 2 else 'st')
            img[top + k, x] = C[c]
        if (x * 5) % 9 < 6: img[top + 3, x] = C['g_dk']
    for _ in range(26):                                 # 멈춘 물결(잔 결 하나 없이 희미한 가로줄)
        x = int(rng.integers(480, W - 20)); y = int(rng.integers(4, 15)); L = int(rng.integers(8, 22))
        for k in range(L):
            if y < ys2[x + k] - 3: img[y, x + k] = C['m3']

def glints():
    """하류 맑은 물에 흰 1px 윤슬을 더한다(오른쪽일수록 많이). 물빛 점 위에만."""
    ok = np.zeros((H, W), bool)
    for c in ('w2', 'w3', 'w4'):
        ok |= (img == C[c]).all(-1)
    ok &= (Y > 470) & (Y < 600)
    r = rng.random((H, W))
    p = 0.0035 * np.clip((X - 350) / 1000.0, 0, 1) ** 1.2
    pts = np.argwhere(ok & (r < p))
    for y, x in pts:
        img[y, x] = C['cream']
        if rng.random() < 0.35 and x + 2 < W and ok[y, x + 2]:
            img[y, x + 2] = C['cream']

def rockdetail():
    """빨래 바위(오른쪽 아래) 평평한 윗면에 얼룩·잔금·볕 테를 넣는다."""
    x0, y0, x1, y1 = 1336, 786, 1448, 866
    sub = img[y0:y1, x0:x1]
    top = (sub == C['st_hi']).all(-1)
    nz = smooth2d(5, 9, 31)[y0:y1, x0:x1]
    sub[top & (nz > 0.45)] = C['st']
    up = np.zeros_like(top); up[1:] = top[:-1]
    left = np.zeros_like(top); left[:, 1:] = top[:, :-1]
    rim = top & ~up
    sub[rim & (np.arange(x1 - x0)[None] < (x1 - x0) * 0.6)] = C['cream']
    for _ in range(7):
        ys_, xs_ = np.argwhere(top)[int(rng.integers(0, top.sum()))]
        for k in range(int(rng.integers(5, 12))):
            yy_, xx_ = ys_ + (k // 4) * (1 if k % 8 < 4 else -1) // 1, xs_ + k
            if 0 <= yy_ < y1 - y0 and 0 <= xx_ < x1 - x0 and top[yy_, xx_]:
                sub[yy_, xx_] = C['st_mid']
    img[y0:y1, x0:x1] = sub

if 'rock' in only:
    rockdetail()
if 'mistify' in only:
    mistify()
if 'stream' in only:
    stream()
if 'glints' in only:
    glints()
if 'bridge' in only:
    draw_bridge()
if 'stones' in only:
    draw_stones()
if 'decor' in only:
    # 아랫둑 갈대(걸을 수 있는 칸·다리·디딤돌을 비킨다)
    for cx in (40, 64, 180, 205, 330, 360, 520, 548, 610, 820, 850, 960, 1000, 1290, 1320, 1420, 1450, 1500):
        if 640 < cx < 800 or 1090 < cx < 1260: continue
        reeds(cx, int(yB[cx] + 4 + rng.integers(0, 6)), int(rng.integers(6, 11)))
    # 윗둑 흙벽 가 갈대 몇
    for cx in (250, 440, 900, 1060, 1380):
        reeds(cx, int(yW[cx] + 1), int(rng.integers(3, 6)), spread=4, hmin=6, hmax=13, cat=False)
    # 물속 회색 바위(걸을 수 없음)
    for cx, cy, a, b in ((1062, 548, 9, 6), (1296, 510, 8, 5), (1278, 566, 6, 4), (560, 520, 7, 5), (930, 556, 6, 4), (300, 528, 7, 5)):
        rock(cx, cy, a, b)
    # 웅덩이 바위 몇(바랜 물)
    for cx, cy, a, b in ((210, 150, 8, 5), (430, 60, 7, 5)):
        rock(cx, cy, a, b)
    # 웅덩이·도랑 둑 갈대
    for cx, by in ((150, 228), (180, 226), (300, 232), (470, 226), (620, 230), (130, 300), (40, 360), (125, 420)):
        reeds(cx, by, int(rng.integers(4, 8)), spread=5, hmin=7, hmax=16)
    for cx in (560, 700, 860, 1000, 1180, 1330, 1480):
        reeds(cx, int(ys[cx] + 4), int(rng.integers(3, 6)), spread=5, hmin=6, hmax=12, cat=False)

Image.fromarray(img).save(out)
print('saved', out)
