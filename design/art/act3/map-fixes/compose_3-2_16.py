# 3-2 16px 맵 밑그림 모으기: 1K 초안(map_3-2_a1)의 풀밭·나무·냇물·다리·소품을 데이터 칸에 다시 놓는다.
# 냇물은 9~12줄, 다리는 (14,15)열, 낚시 바위 자리(23~25열 10~11줄)와 디딤돌(24,12)은 길 색, 웅덩이는 맨 윗줄, 윗물길은 2~3줄 오른쪽.
import sys, json, subprocess
import numpy as np
from PIL import Image, ImageEnhance
src, out = sys.argv[1:3]
T = 42
orig = Image.open(src).convert('RGB')
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '3-2'], capture_output=True, text=True).stdout)
W, H = 32 * T, 24 * T
band = orig.crop((0, 900, W, 1008))
im = Image.new('RGB', (W, H))
for i, y in enumerate(range(0, H, band.height)):
    im.paste(band if i % 2 == 0 else band.transpose(Image.FLIP_LEFT_RIGHT), (0, y))
sand_rgb = np.median(np.array(orig.crop((700, 620, 1000, 680))).reshape(-1, 3), axis=0)
sand = Image.new('RGB', (T, T), tuple(int(v) for v in sand_rgb))

def faded(c):  # 물안개에 덮인 물: 채도를 빼고 밝게
    return ImageEnhance.Brightness(ImageEnhance.Color(c).enhance(0.35)).enhance(1.08)

# 냇물 띠(둑 포함): 9~12줄
water = orig.crop((250, 398, 560, 592)).resize((310, 4 * T + 16), Image.BOX)  # 갈대 없는 쪽
for i, x in enumerate(range(0, W, 310)):
    im.paste(water if i % 2 == 0 else water.transpose(Image.FLIP_LEFT_RIGHT), (x, 9 * T - 8))
# 맨 윗줄 물안개 웅덩이(바랜 색)와 오른쪽 윗물길(2~3줄, 바랜 색)
# 웅덩이는 맨 윗줄 10~21열, 윗물길은 그 오른쪽으로 맨 윗줄을 따라 맵 끝까지(출구 길 바로 위)
pond = faded(orig.crop((560, 0, 905, 80)))
im.paste(pond.resize((12 * T, T + 4), Image.BOX), (10 * T, 0))
stream = faded(orig.crop((250, 450, 560, 540))).resize((310, T - 10), Image.BOX)
for i, x in enumerate(range(22 * T, W, 310)):
    im.paste(stream if i % 2 == 0 else stream.transpose(Image.FLIP_LEFT_RIGHT), (x, 4))

def obj(sbox, cx, bottom, width, keep=False):
    c = orig.crop(sbox)
    a = np.array(c).astype(float)
    m = np.ones(a.shape[:2], bool) if keep else (np.abs(a - sand_rgb).sum(axis=2) > 45)
    mask = Image.fromarray(m.astype(np.uint8) * 255)
    h = round(c.height * width / c.width)
    c = c.resize((width, h), Image.BOX)
    mask = mask.resize((width, h), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    im.paste(c, (round(cx - width / 2), round(bottom - h)), mask)

# 걸을 수 있는 칸은 평평한 모래
for ty, r in enumerate(rows):
    for tx, c in enumerate(r):
        if c != '#' and not c.isdigit():
            im.paste(sand, (tx * T, ty * T))
for tx in range(22, 32):
    im.paste(sand, (tx * T, 1 * T))  # 출구 통로
# 다리 난간: 모래 다리 바닥 양옆에 가는 갈색 난간
# 다리: 바닥은 길과 같은 모래색 널(걸을 수 있는 칸이 길 색이어야 한다), 가는 널 금, 양옆 갈색 난간과 기둥
plank = tuple(int(v * 0.86) for v in sand_rgb)
for y in range(9 * T + 10, 13 * T, 14):
    im.paste(Image.new('RGB', (2 * T, 2), plank), (14 * T, y))
rail = orig.crop((577, 410, 592, 575)).resize((8, 4 * T + 16), Image.BOX)
im.paste(rail, (14 * T - 6, 9 * T - 8)); im.paste(rail, (16 * T - 2, 9 * T - 8))
# 낚시 바위 둘레 돌, 소품
obj((960, 430, 1080, 505), 26.6 * T, 12 * T + 4, 40)       # 낚시 자리 옆 둥근 바위(막힌 칸)
obj((960, 430, 1080, 505), 22.4 * T, 11 * T, 34)           # 왼쪽 둥근 바위(막힌 칸)
obj((120, 258, 158, 294), 3.5 * T, 8 * T - 4, 34)          # 0 빗물 그릇
obj((1185, 288, 1222, 324), 28.5 * T, 9 * T - 4, 34)       # 1 빗물 그릇
obj((420, 582, 458, 618), 27.5 * T, 17 * T - 4, 34)        # 2 빗물 그릇
obj((125, 515, 240, 600), 10.5 * T, 14 * T, T)             # 3 갈대숲(물가로 솟는다)
obj((118, 708, 156, 792), 3.5 * T, 17 * T, 24)             # 9 나루터 말뚝
obj((1040, 695, 1135, 757), 29 * T, 18 * T - 2, 2 * T)     # 빨래 바위(막힌 칸)
im.save(out)
print('saved', out)
