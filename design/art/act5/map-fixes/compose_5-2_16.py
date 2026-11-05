# 5-2 맵 밑그림 모으기: 데이터 칸에 맞춰 탑 안 네모 고리 셋을 다시 짓는다. 재료는 1K 초안(map_5-2_a1)의 돌.
# 막힌 칸 바탕은 초안의 푸른 먹색 벽돌, 걸을 수 있는 칸 둘레 막힌 쪽 가장자리는 밝은 돌 테(벽 윗면 가장자리),
# 걸을 수 있는 칸 바로 위의 막힌 칸 아래쪽은 어두운 벽 앞면(블록 쌓기), 걸을 수 있는 칸(과 출구 통로)은 초안의 판석.
# 바깥벽에 틈 창, 소품: 빈 등잔걸이 0·1·2, 돌 틈 쪽지 3, 굳은 글자 벽 4, 바랜 천 조각 9. 바닥은 5-1처럼 따뜻한 돌색으로 고른다.
# 사용: $PY compose_5-2_16.py raw/map_5-2_a1.png raw/map_5-2_comp.png
import sys, json, subprocess
import numpy as np
from PIL import Image
src, out = sys.argv[1:3]
T = 45
orig = Image.open(src).convert('RGB')
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '5-2'], capture_output=True, text=True).stdout)
W, H = 32 * T, 24 * T
walkt = np.array([[c != '#' and not c.isdigit() for c in r] for r in rows])
walkt[10, 31] = True                                          # 출구 통로
objt = np.array([[c.isdigit() for c in r] for r in rows])
floor_t = walkt | objt                                         # 물건 칸도 바닥 위에 놓인다
px = np.kron(floor_t, np.ones((T, T), bool))

def texture(sbox, h, flip=True):  # 높이 h px로 맞춘 띠를 캔버스 전체로 잇는다
    c = orig.crop(sbox)
    c = c.resize((max(1, round(c.width * h / c.height)), h), Image.BOX)
    can = Image.new('RGB', (W, H))
    for j, y in enumerate(range(0, H, h)):
        for i, x in enumerate(range(0, W, c.width)):
            can.paste(c if not flip or (i + j) % 2 == 0 else c.transpose(Image.FLIP_LEFT_RIGHT), (x, y))
    return np.array(can)

wall = texture((1340, 560, 1448, 900), 3 * T)                  # 벽 윗면: 큰 블록
face = texture((255, 243, 1190, 279), 26)                       # 벽 앞면: 어두운 블록 한 줄
lip_h = texture((170, 101, 650, 121), 11)                       # 돌 테(가로)
floor = texture((330, 850, 1210, 932), round(1.85 * T))         # 판석

def near(m, dy, dx, n):  # m을 (dy, dx) 쪽으로 1..n px 밀어 하나라도 겹치면
    o = np.zeros_like(m)
    for k in range(1, n + 1):
        s = np.roll(m, (dy * k, dx * k), axis=(0, 1))
        if dy > 0: s[:dy * k] = False
        if dy < 0: s[dy * k:] = False
        if dx > 0: s[:, :dx * k] = False
        if dx < 0: s[:, dx * k:] = False
        o |= s
    return o

F, L = 26, 11
blocked = ~px
below_face = blocked & near(px, -1, 0, F)                      # 바로 아래가 바닥(벽 앞면)
lip = blocked & ~below_face & (near(px, 1, 0, L) | near(px, 0, 1, L) | near(px, 0, -1, L) | near(px, -1, 0, F + L))
im = wall.copy()
side = blocked & ~below_face & (near(px, 0, 1, L) | near(px, 0, -1, L)) & ~near(px, 1, 0, L) & ~near(px, -1, 0, F + L)
im[lip] = lip_h[lip]
# 세로 테(옆이 바닥인 곳)는 가로 테 무늬를 눕혀 쓴다
rot = np.array(Image.fromarray(lip_h).transpose(Image.TRANSPOSE).resize((W, H)))
im[side] = rot[side]
im[below_face] = face[below_face]
# 앞면 아래 끝 1px 그늘 줄
edge = below_face & near(px, -1, 0, 1)
im[edge] = (im[edge] * 0.6).astype(np.uint8)
im[px] = floor[px]
im = Image.fromarray(im)

def put(sbox, cx, bottom, width, height=None, thr=60):  # 초안 바닥색과 다른 점만 붙인다
    c = orig.crop(sbox)
    fl = np.median(np.array(orig.crop((500, 300, 900, 340))).reshape(-1, 3), axis=0)
    mask = Image.fromarray((np.abs(np.array(c).astype(float) - fl).sum(axis=2) > thr).astype(np.uint8) * 255)
    h = height or round(c.height * width / c.width)
    c = c.resize((width, h), Image.BOX)
    mask = mask.resize((width, h), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    im.paste(c, (round(cx - width / 2), round(bottom - h)), mask)

def paste(sbox, x0, y0, x1, y1):
    im.paste(orig.crop(sbox).resize((round((x1 - x0) * T), round((y1 - y0) * T)), Image.BOX), (round(x0 * T), round(y0 * T)))

# 바깥벽 틈 창(위·왼쪽·오른쪽)
for cx in (9.5, 21.5):
    paste((426, 2, 474, 78), cx - 0.45, 0.1, cx + 0.45, 1.55)
for cy in (6.5, 16.5):
    paste((26, 405, 74, 528), 0.75, cy - 1.2, 1.75, cy + 1.2)
for cy in (5.5, 15.5):
    paste((26, 405, 74, 528), 30.2, cy - 1.2, 31.2, cy + 1.2)

LAMP = (662, 106, 718, 176)
put(LAMP, 15.5 * T, 4 * T - 2, int(0.95 * T))                  # 0 위쪽 빈 등잔걸이
put(LAMP, 3.5 * T, 10 * T - 2, int(0.95 * T))                  # 1 서쪽 빈 등잔걸이
put(LAMP, 23.5 * T, 16 * T - 2, int(0.95 * T))                 # 2 안쪽 빈 등잔걸이
put((713, 670, 777, 720), 16.5 * T, 15 * T - 3, int(1.0 * T))  # 3 돌 틈 쪽지
put((326, 468, 385, 528), 8.5 * T, 11 * T - 2, int(0.95 * T))  # 4 굳은 글자 벽
put((1242, 138, 1306, 192), 28.5 * T, 6 * T - 6, int(0.9 * T))  # 9 바랜 천 조각

# 바닥은 5-1처럼 아주 옅게 따뜻한 돌색으로(벽은 그대로 푸른 먹색)
a = np.array(im).astype(float)
pm = np.kron(walkt, np.ones((T, T), bool))
a[pm] = a[pm] * np.array([1.06, 1.02, 0.95])
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out)
print('saved', out)
