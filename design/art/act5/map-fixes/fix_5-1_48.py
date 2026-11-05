# 5-1 48px 다듬기(색표 안에서만 바꾼다, 색 수 그대로).
# 1) 탑 문: 2K 그림은 문 앞 돌계단 자리(1~2줄 14~17열, 3~4줄 15~16열, 5줄 15열)를 문 안 그늘로 그렸다.
#    같은 열의 가운데 마당 판석(6~9줄)을 옮겨 깔고, 0줄 상인방 아래쪽을 어두운 문 안으로, 1줄 위쪽에 문 그늘을 둔다.
#    문 기둥 사이 막힌 (14,3)(17,3)은 문 기둥 돌로 채운다.
# 2) 판석 고르기: 걸을 수 있는 칸 둘레 8px 안에서 판석 색들을 밝은 판석 한 색으로, 줄눈 색들을 옅은 줄눈 한 색으로 모은다
#    (길과 벽이 밝기로 갈리고, 잿빛 그림자·잿빛 아이가 바닥 위에서 묻히지 않게 바닥을 한 단 밝게 한다).
#    그 위에 어두운 판석 잔점을 성기게 뿌린다.
# 사용: $PY fix_5-1_48.py raw/map_5-1_2k_px.png raw/map_5-1_48.png raw/map_5-1_2k_a1.png
import sys, json, subprocess
import numpy as np
from PIL import Image
src, out = sys.argv[1:3]
im = Image.open(src)
a = np.array(im)
pal = im.getpalette()
hexes = ['#%02X%02X%02X' % tuple(pal[i*3:i*3+3]) for i in range(len(pal) // 3)]
idx = lambda h: hexes.index(h.upper())
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '5-1'], capture_output=True, text=True).stdout)
T = a.shape[1] // len(rows[0])
tile = lambda x, y: (slice(y * T, (y + 1) * T), slice(x * T, (x + 1) * T))
walk = lambda x, y: rows[y][x] != '#' and not rows[y][x].isdigit()
rng = np.random.default_rng(5)

# 1) 문 앞
for y in range(1, 6):
    for x in range(14, 18):
        if walk(x, y):
            a[tile(x, y)] = a[tile(x, y + 5)]
for x in (14, 17):
    a[tile(x, 3)] = a[tile(13 if x == 14 else 18, 2)]
DARK = idx('#2B2622')
a[22:T, 14 * T:18 * T] = DARK                       # 상인방 아래 문 안
m = np.zeros(a.shape, bool)
for y, r in enumerate(rows):
    for x, c in enumerate(r):
        if walk(x, y):
            m[tile(x, y)] = True

# 2) 판석 고르기(변경 전 색으로 고르고 한꺼번에 바꾼다)
def shift_all(mm, r, fn):
    H, W = mm.shape
    p = np.pad(mm, r, constant_values=(fn is np.logical_and))
    o = mm.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o = fn(o, p[r + dy:r + dy + H, r + dx:r + dx + W])
    return o
zone = shift_all(m, 8, np.logical_or)
SLAB = idx('#C9BFAE')
JOINT = idx('#B0A69C')
SPECK = idx('#B5ABA1')
before = a.copy()
for h in ('#AA9F96', '#A49A92', '#B5ABA1', '#A09C98'):
    a[(before == idx(h)) & zone] = SLAB
for h in ('#9F948D', '#9A9089', '#949597'):
    a[(before == idx(h)) & zone] = JOINT
inner = shift_all(m, 4, np.logical_and) & (a == SLAB)
ys, xs = np.nonzero(inner)
for y0, x0 in zip(*(v[rng.random(len(ys)) < 0.006] for v in (ys, xs))):
    w, h = [(1, 1), (2, 1), (1, 2), (3, 1)][rng.integers(4)]
    sl = (slice(y0, y0 + h), slice(x0, x0 + w))
    a[sl] = np.where(a[sl] == SLAB, SPECK, a[sl])

# 3) 받침돌 그림자: 10줄 칸에서 그림자를 위 16px로 줄인다(그 아래 그림자 색은 판석으로)
PAVE = {SLAB, JOINT, SPECK}
for x in list(range(9, 14)) + list(range(18, 23)):
    sl = (slice(10 * T + 16, 11 * T), slice(x * T, (x + 1) * T))
    a[sl] = np.where(a[sl] == JOINT, SLAB, a[sl])

# 4) 칸보다 키 큰 물건 줄이기: 상자 안 판석이 아닌 점(물건과 그 그림자)을 떼어 판석으로 지우고,
#    가운데 몸통 줄 n개를 빼서 아래(발)에 맞춰 다시 놓는다. 물건 칸 위 칸에 판석이 40% 넘게 남게.
def shorten(x0, y0, x1, y1, cut_y, n):
    box = a[y0:y1, x0:x1].copy()
    obj = ~np.isin(box, list(PAVE))
    a[y0:y1, x0:x1] = np.where(obj, SLAB, box)
    keep = [r for r in range(y1 - y0) if not (cut_y - y0 <= r < cut_y - y0 + n)]
    nb, no = box[keep], obj[keep]
    sub = a[y1 - len(keep):y1, x0:x1]
    a[y1 - len(keep):y1, x0:x1] = np.where(no, nb, sub)
# 2 꺼진 가로등: 2K 원본의 가로등을 키 1.65칸으로 줄여 다시 놓는다(등이 위 칸에 반만 나오게). 유리는 어두운 잿빛.
#   (몸통만 빼서 줄이면 등이 납작해져서 원본에서 다시 줄인다)
raw = Image.open(sys.argv[3]).convert('RGB')
floor_raw = np.median(np.array(raw.crop((330, 1240, 400, 1300))).reshape(-1, 3), axis=0)
lc = raw.crop((233, 1186, 295, 1407))
la = np.array(lc).astype(float)
lmask = Image.fromarray(((np.abs(la - floor_raw).sum(axis=2) > 60) & ((la[..., 2] > la[..., 0] + 4) | (la.mean(axis=2) < 90)))
                        .astype(np.uint8) * 255)  # 쇠·유리(푸른 잿빛)만, 따뜻한 그림자는 빼고
LH = int(1.65 * T); LW = round(lc.width * LH / lc.height)
lc = np.array(lc.resize((LW, LH), Image.BOX)).astype(float)
lmask = np.array(lmask.resize((LW, LH), Image.BOX)) > 140
prgb = np.array(pal[:len(hexes) * 3]).reshape(-1, 3).astype(float)
lum = prgb.mean(axis=1)
near = np.argmin(((lc[:, :, None, :] - prgb[None, None]) ** 2).sum(axis=3), axis=2)
GLASS = idx('#4B5160')
near = np.where(lum[near] > 110, GLASS, near)
# 1 무늬 없는 돌기둥: 2K 원본 돌기둥을 머리·몸통·밑동으로 나눠 폭 0.72칸, 키 1.8칸으로 곧게 세운다
#   (위 칸에 판석이 40% 넘게 남게 좁고 길게). 옛 돌기둥 자리는 아래 같은 열 판석으로 덮는다.
a[7 * T:9 * T, 25 * T:28 * T] = a[10 * T:12 * T, 25 * T:28 * T]
def from_raw(xr0, xr1, parts, W):
    blocks = []
    for ry0, ry1, h in parts:
        c = raw.crop((xr0, ry0, xr1, ry1))
        ca = np.array(c).astype(float)
        mk = (np.abs(ca - floor_raw).sum(axis=2) > 60) & ((ca[..., 2] > ca[..., 0] + 4) | (ca.mean(axis=2) < 90))
        blocks.append((np.array(c.resize((W, h), Image.BOX)).astype(float),
                       np.array(Image.fromarray(mk.astype(np.uint8) * 255).resize((W, h), Image.BOX)) > 140))
    rgb = np.concatenate([b[0] for b in blocks]); mk = np.concatenate([b[1] for b in blocks])
    return np.argmin(((rgb[:, :, None, :] - prgb[None, None]) ** 2).sum(axis=3), axis=2), mk
def place(ids, mk, cx, bottom, shadow=True):
    h, w = ids.shape
    x0, y0 = round(cx - w / 2), bottom - h
    if shadow:  # 오른쪽 아래로 짧은 그림자(판석 위에만)
        sh = np.zeros_like(mk); sh[3:, 4:] = mk[:-3, :-4]
        sub = a[y0:y0 + h, x0:x0 + w]
        a[y0:y0 + h, x0:x0 + w] = np.where(sh & (sub == SLAB), JOINT, sub)
    sub = a[y0:y0 + h, x0:x0 + w]
    a[y0:y0 + h, x0:x0 + w] = np.where(mk, ids, sub)
PW = round(0.72 * T)
ids, mk = from_raw(1922, 1998, [(538, 576, 18), (576, 610, 10), (610, 640, 44), (640, 673, 14)], PW)
place(ids, mk, 26.5 * T, 9 * T - 3, shadow=False)

box = a[15 * T + 30:19 * T, 3 * T + 8:4 * T + 4]
a[15 * T + 30:19 * T, 3 * T + 8:4 * T + 4] = np.where(np.isin(box, list(PAVE)), box, SLAB)
x0, y0 = round(3.5 * T - LW / 2), 19 * T - 2 - LH
sub = a[y0:y0 + LH, x0:x0 + LW]
a[y0:y0 + LH, x0:x0 + LW] = np.where(lmask, near, sub)

# 문 그늘: 1줄 위 10px, 문 안 쪽으로 갈수록 짙은 디더(Bayer 2×2)
B = np.array([[0, 2], [3, 1]])
SH1, SH2 = idx('#9A9089'), idx('#837C79')
for yy in range(T, T + 10):
    t = 1 - (yy - T) / 10
    for xx in range(14 * T, 18 * T):
        if B[yy % 2, xx % 2] < t * 4:
            a[yy, xx] = SH2 if t > 0.6 else SH1
o = Image.fromarray(a, 'P'); o.putpalette(pal)
o.save(out, optimize=True)
print('saved', out)
