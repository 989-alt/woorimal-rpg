# 5-1 맵 밑그림 모으기: 1K 초안(map_5-1_a1)의 탑 벽·문·받침돌·분수·의자·돌기둥·화단·가로등을 데이터 칸에 다시 놓는다.
# 바탕(벽돌) → 탑 앞벽(0~3줄, 틈 창) → 좌우 바깥 담(기둥 띠) → 아래 담(19줄~) → 탑 문(13~18열 0~3줄) → 받침돌 둘
# → 문 앞 기둥 → 화단 둘 → 걸을 수 있는 칸은 초안의 판석 → 소품(분수 0, 돌기둥 1, 꺼진 가로등 2, 돌 의자 9) → 마른 풀.
# 사용: $PY compose_5-1_16.py raw/map_5-1_a1.png raw/map_5-1_comp.png
import sys, json, subprocess
import numpy as np
from PIL import Image
src, out = sys.argv[1:3]
T = 45
orig = Image.open(src).convert('RGB')
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '5-1'], capture_output=True, text=True).stdout)
W, H = 32 * T, 24 * T
walk = lambda x, y: 0 <= y < 24 and 0 <= x < 32 and rows[y][x] != '#' and not rows[y][x].isdigit()

im = Image.new('RGB', (W, H))
def box(sbox, x0, y0, x1, y1, flip=False):  # 칸 좌표 상자에 늘여 붙인다
    c = orig.crop(sbox).resize((round((x1 - x0) * T), round((y1 - y0) * T)), Image.BOX)
    if flip:
        c = c.transpose(Image.FLIP_LEFT_RIGHT)
    im.paste(c, (round(x0 * T), round(y0 * T)))
def tile(sbox, x0, y0, x1, y1, h):  # 높이 h칸으로 맞춰 옆으로·아래로 잇는다(번갈아 뒤집기)
    crop = orig.crop(sbox)
    hh = round(h * T)
    c = crop.resize((max(1, round(crop.width * hh / crop.height)), hh), Image.BOX)
    for j, y in enumerate(range(round(y0 * T), round(y1 * T), hh)):
        for i, x in enumerate(range(round(x0 * T), round(x1 * T), c.width)):
            p = c if (i + j) % 2 == 0 else c.transpose(Image.FLIP_LEFT_RIGHT)
            p = p.crop((0, 0, min(p.width, round(x1 * T) - x), min(p.height, round(y1 * T) - y)))
            im.paste(p, (x, y))

BRICK = (200, 15, 455, 165)
tile(BRICK, 0, 0, 32, 24, 3.3)                                   # 바탕: 푸른 먹색 벽돌
# 탑 앞벽의 틈 창(위쪽, 문 양옆으로 셋씩)
for cx in (4.5, 7.5, 10.5, 21.5, 24.5, 27.5):
    box((458, 30, 498, 122), cx - 0.4, 0.6, cx + 0.4, 2.6)
# 좌우 바깥 담: 초안의 기둥 띠(머리 돌 포함)
box((0, 0, 76, 945), 1.35, 3.6, 3, 19.4)
box((1372, 0, 1448, 945), 29, 3.6, 30.65, 19.4)
# 아래 담: 초안 아래 담(19~21줄), 그 아래는 벽돌
box((80, 950, 632, 1086), 0, 19, 14, 22)
box((818, 950, 1370, 1086), 18, 19, 32, 22)
box((80, 950, 280, 1086), 14, 21, 18, 24)
box((0, 950, 82, 1086), 1.35, 18.8, 3.05, 21.5)                   # 담 모퉁이 기둥
box((1366, 950, 1448, 1086), 28.95, 18.8, 30.65, 21.5)
# 탑 문: 양옆 굵은 기둥(13·18열)과 위 상인방, 그 사이 어두운 문 안(0줄)
dark = orig.crop((690, 60, 760, 170))
box((690, 60, 760, 170), 14, 0, 18, 1.05)
box((652, 0, 680, 205), 13.1, 0, 14, 3.9)
box((770, 0, 798, 205), 18, 0, 18.9, 3.9)
box((650, 0, 798, 34), 12.9, 0, 19.1, 0.45)
# 받침돌 둘(4~9줄)
box((460, 150, 618, 358), 9, 4, 14, 10)
box((829, 150, 992, 358), 18, 4, 23, 10)
# 문 앞 기둥: (14,4)(14,5) 왼쪽, (17,4)(16,5)(17,5) 오른쪽 — 초안 돌기둥을 낮게
box((1189, 357, 1262, 481), 14.05, 3.85, 14.95, 6)
box((1189, 357, 1262, 481), 16.05, 4.85, 16.95, 6)
box((1189, 357, 1262, 481), 17.05, 3.85, 17.95, 6)
# 화단 둘(13~15줄)
box((182, 552, 632, 737), 5.95, 12.85, 14.05, 16.1)
box((818, 552, 1288, 737), 17.95, 12.85, 26.05, 16.1)

# 걸을 수 있는 칸: 초안의 판석(빈 마당 한 덩이를 잇는다)
pave = orig.crop((180, 745, 640, 945))
def flatten():
    for ty, r in enumerate(rows):
        for tx, c in enumerate(r):
            if walk(tx, ty):
                im.paste(pave.crop(((tx * T) % (pave.width - T), (ty * T) % (pave.height - T),
                                    (tx * T) % (pave.width - T) + T, (ty * T) % (pave.height - T) + T)), (tx * T, ty * T))
flatten()

floor_rgb = np.median(np.array(pave).reshape(-1, 3), axis=0)
def put(sbox, cx, bottom, width, height=None):  # 판석 색과 다른 점만 붙인다
    c = orig.crop(sbox)
    a = np.array(c).astype(float)
    mask = Image.fromarray(((np.abs(a - floor_rgb).sum(axis=2) > 70)).astype(np.uint8) * 255)
    h = height or round(c.height * width / c.width)
    c = c.resize((width, h), Image.BOX)
    mask = mask.resize((width, h), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    im.paste(c, (round(cx - width / 2), round(bottom - h)), mask)

put((160, 230, 376, 434), 6.5 * T, 8.3 * T, int(1.6 * T))        # 0 마른 네모 분수
put((1189, 357, 1262, 481), 26.5 * T, 9 * T - 2, int(0.95 * T))   # 1 무늬 없는 돌기둥
put((98, 698, 162, 926), 3.5 * T, 19 * T - 3, int(0.8 * T))     # 2 꺼진 가로등
put((1102, 200, 1286, 284), 25.5 * T, 6 * T + 2, int(1.7 * T))    # 9 돌 의자와 편지
# 마른 풀(담 밑과 받침돌 발치)
weed = orig.crop((90, 90, 196, 170))
wa = np.array(weed).astype(int)
wmask = Image.fromarray((((wa[..., 0] - wa[..., 2]) > 18)).astype(np.uint8) * 255)  # 마른 풀(누르스름한 점)만
for cx, b in ((3.6, 4.2), (28.4, 4.2), (9.3, 10.0), (22.7, 10.0), (13.6, 19.05), (18.4, 19.05)):
    w = int(0.9 * T); h = round(weed.height * w / weed.width)
    im.paste(weed.resize((w, h), Image.BOX), (round(cx * T - w / 2), round(b * T - h)),
             wmask.resize((w, h), Image.BOX).point(lambda v: 255 if v > 127 else 0))

Image.fromarray(np.array(im)).save(out)
print('saved', out)
