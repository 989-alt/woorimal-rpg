# 2-1 16px 맵(1K 원본) 손질: 길 위 소품을 물건 칸·막힌 칸으로 옮기고, 데이터 밖 길을 숲으로 덮는다.
import sys, json, subprocess
import numpy as np
from PIL import Image, ImageOps
src, out = sys.argv[1:3]
T = 42
im = Image.open(src).convert('RGB')
orig = im.copy()
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '2-1'], capture_output=True, text=True).stdout)
WALK = set('.Sabcde')
sand = orig.crop((430, 590, 500, 660))
sand_rgb = np.median(np.array(sand).reshape(-1, 3), axis=0)

def fill_sand(x0, y0, x1, y1):  # 그림 px
    for yy in range(y0, y1, sand.height):
        for xx in range(x0, x1, sand.width):
            c = sand.crop((0, 0, min(sand.width, x1 - xx), min(sand.height, y1 - yy)))
            im.paste(c, (xx, yy))

def tiles_sand(tx0, ty0, tx1, ty1, only_walk=True):
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            if not only_walk or rows[ty][tx] in WALK:
                fill_sand(tx * T, ty * T, (tx + 1) * T, (ty + 1) * T)

def copy(sbox, dxy):
    im.paste(orig.crop(sbox), dxy)

def paste_obj(sbox, cx, bottom, width, grey=0.0):
    """원본 sbox의 소품(모래색이 아닌 점)을 width px로 줄여 (cx, bottom)에 아래 가운데로 놓는다."""
    c = orig.crop(sbox)
    a = np.array(c).astype(float)
    mask = (np.abs(a - sand_rgb).sum(axis=2) > 45).astype(np.uint8) * 255
    if grey:
        g = a.mean(axis=2, keepdims=True)
        a = a * (1 - grey) + (g * 0.9 + 25) * grey
    c = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    m = Image.fromarray(mask)
    h = round(c.height * width / c.width)
    c = c.resize((width, h), Image.BOX); m = m.resize((width, h), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    im.paste(c, (round(cx - width / 2), round(bottom - h)), m)

# 1) 데이터 밖 길을 숲으로: 남쪽 길 연장(21~23줄), 골목 아래 끝(19~20줄), 맨 위(1~2줄) 골목 위 가판대 자리
copy((10 * T, 21 * T, 14 * T, 24 * T), (14 * T, 21 * T))
copy((3 * T, 21 * T, 8 * T, 23 * T), (3 * T, 19 * T))
copy((24 * T, 21 * T, 29 * T, 23 * T), (24 * T, 19 * T))
copy((19 * T, 21 * T, 24 * T, 23 * T), (18 * T, 19 * T))       # 경비 옆 빈 흰 칸 자리(19~20줄, 18~22열)
copy((0, 0, 3 * T, 3 * T), (3 * T, 0)); copy((0, 0, 3 * T, 3 * T), (6 * T, 0))        # 왼쪽 위
copy((29 * T, 0, 32 * T, 3 * T), (23 * T, 0)); copy((29 * T, 0, 32 * T, 3 * T), (26 * T, 0))  # 오른쪽 위
# 광장 아래 가장자리가 한 칸 아래로 그려졌다: 막힌 칸을 숲 칸으로
for tx, ty in [(8, 14), (23, 14), (9, 15), (22, 15), (10, 16), (11, 16), (12, 16), (13, 16), (18, 16), (19, 16), (20, 16), (21, 16)]:
    copy((T, ty * T, 2 * T, (ty + 1) * T), (tx * T, ty * T))
# 아치 자리(11~13열 17~20줄)를 숲으로 비운 뒤 아치를 왼쪽으로 옮겨 놓는다
copy((8 * T, 17 * T, 11 * T, 21 * T), (11 * T, 17 * T))
copy((18 * T, 0, 20 * T, T), (int(16.5 * T), 0))                 # (16,0) 절반 나무

# 2) 골목·광장의 걸을 수 있는 칸을 모래로(경계는 남김), 물건 칸과 2×2 가판대 칸도 비움
tiles_sand(3, 3, 7, 18)
tiles_sand(24, 3, 28, 18)
tiles_sand(5, 8, 6, 9, False); tiles_sand(5, 13, 6, 14, False)
tiles_sand(25, 8, 26, 9, False); tiles_sand(25, 13, 26, 14, False)
tiles_sand(13, 9, 20, 14, False)                                   # 분수 둘레를 비우고 다시 놓는다
for ty in range(9, 15):
    for tx in range(13, 21):
        if rows[ty][tx] == '#' and not (15 <= tx <= 16 and 11 <= ty <= 12):
            pass
tiles_sand(8, 8, 12, 10)                                           # 간판 둘레
tiles_sand(20, 8, 23, 10)
tiles_sand(14, 16, 18, 20)                                         # 남쪽 길·문지기 자리

# 3) 소품 놓기 (cx, 바닥, 너비: 그림 px)
paste_obj((130, 75, 290, 190), 4.5 * T, 5 * T, 64)            # 2 해솔 좌판
paste_obj((1065, 60, 1225, 195), 24.5 * T, 4 * T, 62)         # 6 그릇 가판대
paste_obj((1065, 230, 1200, 345), 27.5 * T, 5 * T, 56)        # 3 사과 좌판
paste_obj((170, 575, 305, 700), 3.4 * T, 19 * T, 60)          # 5 천 가게 차양
paste_obj((1085, 755, 1200, 845), 28.5 * T, 19 * T, 52)       # 1 항아리
paste_obj((380, 350, 475, 430), 10.5 * T, 9 * T, 50)          # 4 흐려진 간판
paste_obj((676, 452, 802, 582), 16 * T, 13 * T + 4, 92)       # 0 분수(2×2)
paste_obj((170, 420, 300, 535), 6 * T, 10 * T, 84)            # 2×2 가판대들
paste_obj((1065, 230, 1200, 345), 6 * T, 15 * T, 84, grey=0.7)
paste_obj((170, 575, 305, 700), 26 * T, 10 * T, 84, grey=0.7)
paste_obj((170, 420, 300, 535), 26 * T, 15 * T, 84)
# 9 아치 문: 길(14열)에 걸치지 않게 왼쪽으로
tiles_sand(14, 18, 14, 20)
paste_obj((490, 745, 626, 890), 520, 890, 136)
tiles_sand(14, 16, 14, 20)
im.save(out)
print('saved', out)
