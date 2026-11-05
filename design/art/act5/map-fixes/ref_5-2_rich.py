# 5-2 다시 그리기(풍성하게)용 참고 그림: 커밋한 5-2 맵 위에 탑 꼭대기 자리를 거칠게 칠한다.
# 바깥벽 바깥쪽 두 칸(0~1열, 30~31열, 0줄, 22~23줄)은 탑 아래 멀리 깔린 잿빛 구름 바다,
# 바깥벽 안쪽 칸(2열·29열·1줄·21줄)은 네모 톱니(총안)가 있는 난간 벽, 동쪽 출구(29~31열 10줄)는 아래로 내려가는 돌계단.
# 가운데 꼭대기 단(12~21열 9~11줄)은 길 색 위에 네모 테두리 무늬와 금(갈라진 단). 안쪽 벽 위 부서진 쇠 난간 자리.
# 모양은 모두 곧은 네모(아치·둥근 것 없음, 구름만 부드럽다). 구름은 잿빛 3단이 아닌 옅은 푸른 잿빛.
# 사용: $PY ref_5-2_rich.py assets/pixel/map_ch5-2_tap-kkokdaegi.png raw/map_5-2_ref_rich.png
import sys, json, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
src, out = sys.argv[1:3]
im = Image.open(src).convert('RGB')
T = 48
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '5-2'], capture_output=True, text=True).stdout)
STONE_L, STONE, STONE_D, INK = (0x75, 0x79, 0x81), (0x61, 0x66, 0x73), (0x4B, 0x51, 0x60), (0x40, 0x43, 0x4F)
VOID, CLOUD_D, CLOUD_L = (0x4D, 0x50, 0x5B), (0x82, 0x84, 0x87), (0xA2, 0x9B, 0x93)
d = ImageDraw.Draw(im)
R = lambda x0, y0, x1, y1, c, o=None: d.rectangle((round(x0 * T), round(y0 * T), round(x1 * T) - 1, round(y1 * T) - 1), fill=c, outline=o)

# 구름 바다(바깥 두 칸 띠)
sea = np.zeros((24 * T, 32 * T), bool)
sea[:, :2 * T] = True; sea[:, 30 * T:] = True; sea[:1 * T, :] = True; sea[22 * T:, :] = True
sea[10 * T:11 * T, 29 * T:] = False                     # 출구 계단은 남긴다
cl = Image.new('RGB', im.size, VOID)
cd = ImageDraw.Draw(cl)
rng = np.random.default_rng(3)
for _ in range(90):
    x, y = rng.integers(0, 32 * T), rng.integers(0, 24 * T)
    w, h = rng.integers(60, 160), rng.integers(24, 60)
    cd.ellipse((x - w, y - h, x + w, y + h), fill=CLOUD_D)
    cd.ellipse((x - w * 0.6, y - h * 0.8, x + w * 0.5, y + h * 0.3), fill=CLOUD_L)
cl = cl.filter(ImageFilter.ModeFilter(9))
a = np.array(im); a[sea] = np.array(cl)[sea]; im = Image.fromarray(a)
d = ImageDraw.Draw(im)
# 난간 벽과 네모 톱니(바깥쪽 가장자리)
for x in (2, 29):
    for y0, y1 in ((1, 10), (11, 22)) if x == 29 else ((1, 22),):
        R(x, y0, x + 1, y1, STONE, INK)
    for y in range(1, 22):
        if x == 29 and y == 10:
            continue
        R(x + (0 if x == 2 else 0.55), y + 0.1, x + (0.45 if x == 2 else 1), y + 0.6, STONE_L, INK)
for y in (1, 21):
    R(2, y, 30, y + 1, STONE, INK)
    for xx in range(2, 30):
        R(xx + 0.1, y + (0 if y == 1 else 0.55), xx + 0.6, y + (0.45 if y == 1 else 1), STONE_L, INK)
# 출구 돌계단(29~31열 10줄), 길 색 위 디딤 턱
for k in range(9):
    x = 29 + k * 0.33
    R(x, 10, x + 0.05, 11, (0xA2, 0x9B, 0x93))
# 꼭대기 단: 네모 테두리 무늬 두 겹과 금
R(12.3, 9.2, 21.7, 11.8, None, (0xA2, 0x9B, 0x93))
R(12.6, 9.45, 21.4, 11.55, None, (0xA2, 0x9B, 0x93))
d.line((14 * T, 9.5 * T, 15.2 * T, 10.4 * T, 16.1 * T, 10.2 * T), fill=(0x82, 0x84, 0x87), width=2)
# 안쪽 벽 위 부서진 쇠 난간(가는 세로 살 줄)
for (x0, x1, y) in ((6, 26, 4.1), (10, 22, 8.1), (6, 26, 16.1)):
    for xx in np.arange(x0, x1, 0.25):
        if rng.random() < 0.8:
            R(xx, y, xx + 0.04, y + 0.35, INK)
    R(x0, y, x1, y + 0.05, INK)
im.save(out)
print('saved', out)
