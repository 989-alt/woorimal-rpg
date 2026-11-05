# 3-1 16px 맵 밑그림 모으기: 1K 초안(map_3-1_a1)의 숲·나무·소품을 데이터의 막힌 칸·물건 칸에 다시 놓는다.
import sys, json, subprocess
import numpy as np
from PIL import Image
src, out = sys.argv[1:3]
T = 42
orig = Image.open(src).convert('RGB')
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '3-1'], capture_output=True, text=True).stdout)
W, H = 32 * T, 24 * T
band = orig.crop((0, 920, W, 1008))  # 맨 아래 숲 띠를 위로 쌓아 숲 바탕
im = Image.new('RGB', (W, H))
for i, y in enumerate(range(0, H, band.height)):
    b = band if i % 2 == 0 else band.transpose(Image.FLIP_LEFT_RIGHT)
    im.paste(b, (0, y))
sand_rgb = np.median(np.array(orig.crop((600, 250, 800, 350))).reshape(-1, 3), axis=0)
sand = Image.new('RGB', (T, T), tuple(int(v) for v in sand_rgb))
for ty, r in enumerate(rows):
    for tx, c in enumerate(r):
        if c != '#' and not c.isdigit():
            im.paste(sand, (tx * T, ty * T))
for tx in (30, 31):
    im.paste(sand, (tx * T, 3 * T))  # 출구 통로

def obj(sbox, cx, bottom, width):
    c = orig.crop(sbox)
    a = np.array(c).astype(float)
    mask = Image.fromarray((np.abs(a - sand_rgb).sum(axis=2) > 45).astype(np.uint8) * 255)
    h = round(c.height * width / c.width)
    c = c.resize((width, h), Image.BOX)
    mask = mask.resize((width, h), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    im.paste(c, (round(cx - width / 2), round(bottom - h)), mask)

tree = (60, 60, 225, 245)
obj((630, 85, 715, 155), 15.5 * T, 3 * T, 46)      # 9 들꽃 무리
obj((722, 95, 800, 155), 18.5 * T, 3 * T, 44)      # 3 덤불
obj(tree, 3.5 * T, 5 * T, 3 * T)                   # 0 서쪽 끝 나무
obj(tree, 22.5 * T, 19 * T, 3 * T)                 # 1 남쪽 끝 나무
obj(tree, 26.5 * T, 17 * T, 3 * T)                 # 2 동남쪽 끝 나무
obj((825, 560, 950, 650), 21.5 * T, 9 * T, 48)     # 5 큰 바위
obj((355, 445, 420, 500), 12.5 * T, 11 * T, 40)    # 4 버섯 무리
obj((495, 400, 560, 455), 10.5 * T, 9 * T, 40)     # 빈터 가 그루터기(막힌 칸)
obj((495, 400, 560, 455), 17.5 * T, 11 * T, 40)
# 나무 갓이 길을 덮지 않게 걸을 수 있는 칸을 다시 평평한 길로
for ty, r in enumerate(rows):
    for tx, c in enumerate(r):
        if c != '#' and not c.isdigit():
            im.paste(sand, (tx * T, ty * T))
im.save(out)
print('saved', out)
