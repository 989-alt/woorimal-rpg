# 4-1 16px 맵 밑그림 모으기: 1K 초안(map_4-1_a1)의 숲·비탈·벼랑·소품을 데이터의 막힌 칸·물건 칸에 다시 놓는다.
# 가장자리 숲, 단 사이 풀·바위 비탈 → 걸을 수 있는 칸은 평평한 길 → 단마다 아래 가장자리에 벼랑 → 찻집·화로·돌무더기·푯말·꺾인 나무.
import sys, json, subprocess
import numpy as np
from PIL import Image, ImageEnhance
src, out = sys.argv[1:3]
T = 45
orig = Image.open(src).convert('RGB')
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '4-1'], capture_output=True, text=True).stdout)
W, H = 32 * T, 24 * T
walk = lambda x, y: 0 <= y < 24 and 0 <= x < 32 and rows[y][x] != '#' and not rows[y][x].isdigit()

# 바탕: 맵 가장자리는 초안 왼쪽 띠의 소나무·바위 숲, 단과 단 사이는 초안의 풀·바위 비탈
forest = orig.crop((0, 0, 190, 1086))
im = Image.new('RGB', (W, H))
for i, x in enumerate(range(0, W, forest.width)):
    f = forest if i % 2 == 0 else forest.transpose(Image.FLIP_LEFT_RIGHT)
    im.paste(f, (x, -40 * (i % 3)))
    im.paste(f.transpose(Image.FLIP_TOP_BOTTOM), (x, 1086 - 40 * (i % 3)))
slope = orig.crop((700, 345, 985, 480))
def band(x0, y0, x1, y1, flip=False):  # 비탈 조각을 띠 높이에 맞춰 늘이지 않고 뒤집어 가며 잇는다
    h = (y1 - y0) * T
    c = slope.resize((round(slope.width * h / slope.height), h), Image.BOX)
    strip = Image.new('RGB', ((x1 - x0) * T, h))
    for i, x in enumerate(range(0, strip.width, c.width)):
        strip.paste(c if (i + flip) % 2 == 0 else c.transpose(Image.FLIP_LEFT_RIGHT), (x, 0))
    im.paste(strip, (x0 * T, y0 * T))
band(4, 7, 26, 10)            # 가운데 단 사이
band(6, 12, 28, 15, True)     # 찻집 단
band(15, 1, 28, 5)            # 맨 위 단(꺾인 나무 쪽)
band(4, 17, 18, 19, True)     # 돌무더기 쪽 비탈
sand_rgb = np.median(np.array(orig.crop((450, 200, 650, 250))).reshape(-1, 3), axis=0)
sand = Image.new('RGB', (T, T), tuple(int(v) for v in sand_rgb))

def put(sbox, cx, bottom, width, keep=False):
    c = orig.crop(sbox)
    a = np.array(c).astype(float)
    m = np.ones(a.shape[:2], bool) if keep else (np.abs(a - sand_rgb).sum(axis=2) > 45)
    mask = Image.fromarray(m.astype(np.uint8) * 255)
    h = round(c.height * width / c.width)
    c = c.resize((width, h), Image.BOX)
    mask = mask.resize((width, h), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    im.paste(c, (round(cx - width / 2), round(bottom - h)), mask)

def flatten():  # 걸을 수 있는 칸 + 출구 통로(11,0)는 평평한 길
    for ty, r in enumerate(rows):
        for tx, c in enumerate(r):
            if walk(tx, ty):
                im.paste(sand, (tx * T, ty * T))
    im.paste(sand, (11 * T, 0))

flatten()
# 벼랑: 길 바로 아래 막힌 칸 줄마다 층진 바위 벼랑
cliff = orig.crop((400, 268, 985, 345))
for ty in range(1, 24):
    tx = 0
    while tx < 32:
        if not walk(tx, ty) and walk(tx, ty - 1):
            s = tx
            while tx < 32 and not walk(tx, ty) and walk(tx, ty - 1):
                tx += 1
            im.paste(cliff.resize(((tx - s) * T, round(T * 1.3)), Image.BOX), (s * T, ty * T))
        else:
            tx += 1

put((345, 355, 572, 522), 9.9 * T, 15 * T - 2, int(4.2 * T))     # 찻집(막힌 칸 8~11열 12~14줄)
put((262, 448, 362, 528), 7.5 * T, 15 * T - 1, int(1.3 * T))     # 0 화로와 찻주전자
put((727, 840, 813, 933), 16.5 * T, 18 * T - 1, int(1.0 * T))     # 1 돌무더기
put((995, 322, 1068, 432), 23.5 * T, 10 * T - 1, int(1.1 * T))    # 9 기울어진 푯말
put((690, 55, 1008, 172), 13.6 * T, 5 * T - 2, int(4.0 * T))      # 2 꺾인 나무
flatten()  # 소품이 길을 덮지 않게
# 해질녘: 채도 절반, 노을이 막 시작한 따뜻한 장밋빛을 살짝 곱한다
im = ImageEnhance.Color(im).enhance(0.5)
a = np.array(im).astype(float) * (np.array([255, 226, 200]) / 255.0) ** 0.6
im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
im.save(out)
print('saved', out)
