# 2-2 16px 맵 밑그림 모으기: 1K 초안(map_2-2_a1)의 건물·소품을 걷기 칸 밖(막힌 칸·물건 칸)에 다시 놓는다.
import sys, json, subprocess
import numpy as np
from PIL import Image
src, out = sys.argv[1:3]
T = 42
orig = Image.open(src).convert('RGB')
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '2-2'], capture_output=True, text=True).stdout)
W, H = 32 * T, 24 * T
# 숲 바탕: 초안 맨 아래 숲 띠를 위로 쌓는다
band = orig.crop((0, 920, W, 1008))
im = Image.new('RGB', (W, H))
for y in range(0, H, band.height):
    im.paste(band, (0, y))
sand_rgb = np.median(np.array(orig.crop((600, 470, 690, 560))).reshape(-1, 3), axis=0)
sand = Image.new('RGB', (T, T), tuple(int(v) for v in sand_rgb))  # 평평한 모래(무늬는 48px 다시 그리기가 넣는다)
# 북문 깃발(문장 무늬)을 성벽 돌로 덮는다
for bx in (566, 590, 731, 755):
    orig.paste(orig.crop((540, 78, 566, 134)), (bx, 78))
for ty, r in enumerate(rows):
    for tx, c in enumerate(r):
        if c != '#' and not c.isdigit():
            im.paste(sand.crop((0, 0, T, T)), (tx * T, ty * T))
im.paste(sand.crop((0, 0, T, T)), (16 * T, 0))  # 출구 통로

def obj(sbox, cx, bottom, width, keep_sand=False):
    c = orig.crop(sbox)
    a = np.array(c).astype(float)
    mask = Image.fromarray(((np.abs(a - sand_rgb).sum(axis=2) > 45) | keep_sand).astype(np.uint8) * 255)
    h = round(c.height * width / c.width)
    c = c.resize((width, h), Image.BOX)
    mask = mask.resize((width, h), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    im.paste(c, (round(cx - width / 2), round(bottom - h)), mask)

# 북문 성벽과 아치(길 (16,1)이 문 사이로 나간다)
obj((500, 0, 845, 120), 16.5 * T, 2 * T, 12 * T)
# 건물
obj((100, 55, 335, 290), 10 * T, 6 * T, 4 * T)          # 서쪽 위 붉은 지붕 집(8~11열)
obj((940, 55, 1240, 335), 24.5 * T, 6 * T, 7 * T)        # 동쪽 위 푸른 지붕 집
obj((45, 590, 300, 830), 19.5 * T, 12 * T, 4 * T)        # 18~21열 7~11줄 가게
# 소품(물건 칸)
obj((130, 330, 225, 412), 4.5 * T, 8 * T, 52)            # 3 밤 자루
obj((918, 330, 1010, 442), 22.5 * T, 12 * T, 54)         # 4 바랜 차양 가판대
obj((1135, 355, 1200, 425), 28.5 * T, 12 * T, 44)        # 2 머리끈 꾸러미
obj((228, 790, 348, 892), 9.5 * T, 17 * T, 58)           # 9 꽃수레
obj((515, 625, 588, 698), 4.5 * T, 19 * T, 44)           # 0 방울 상자
obj((895, 768, 1042, 878), 20.5 * T, 18 * T, 60)         # 5 짐수레
obj((1030, 788, 1110, 882), 27.5 * T, 19 * T, 44)        # 1 손거울 꾸러미
# 막힌 칸 소품: 통과 길 옆 나무 상자·통
obj((395, 175, 470, 255), 3.5 * T + 20, 6 * T, 60)        # 3~5열 4~5줄
obj((470, 330, 620, 460), 12.5 * T, 11 * T + 30, 5 * T)  # 10~14열 덤불
im.save(out)
print('saved', out)
