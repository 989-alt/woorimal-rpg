# 3-2 낚시 바위(2026-11-05, 크레딧 0): 꼬마 물안개(m) 너머 디딤돌 여섯 개(23..25, 10..11)를 넓적한 바위 하나로 다시 칠한다.
# 디딤돌 여섯 개가 북쪽 냇둑(9행, 벽)에 닿아 끝나 "길이 끊긴 디딤돌"처럼 보였다. 이 칸들은 이야기대로
# 꼬마 물안개가 막고 있는 낚시 바위(막다른 쉼터)이므로, 냇둑과 물길로 떨어진 바위 하나로 그려 목적지로 읽히게 한다.
# 색은 맵 색표(64색)에 이미 있는 디딤돌 색만 쓴다. 윗면은 대부분 길 색(13)이라 걷기 칸 검사(길 색 40% 이상)를 넘는다.
# 저장소 뿌리에서: python3 design/art/act3/map-fixes/fishing_rock_3-2.py <커밋 e84fc81의 3-2 맵> assets/pixel/map_ch3-2_yunseulnae.png
import math
import sys
from PIL import Image

T = 48
TOP, TOP_HI, TOP_SHADE = 13, 11, 37          # 윗면, 윗가 볕, 윗면 아래 그늘
GREY, GREY_D, WARM = 10, 61, 32              # 얼룩(밝은 회색, 어두운 회색), 따뜻한 얼룩
MOSS = (44, 49)
SIDE = (62, 61, 61, 61, 60, 60, 60, 62, 63)   # 옆면(위에서 아래로)
OUTLINE, FOAM, SHADOW = 63, 3, 4

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src)
assert im.mode == 'P'
px = im.load()

CX, CY = 24 * T + 24, 11 * T     # 바위 가운데(23..25열, 10..11행의 가운데)
A, B = 70, 43                        # 반지름(가로, 세로: 옆면 포함)
SIDE_H = len(SIDE)


def wobble(ang):
    # 둘레를 조금 울퉁불퉁하게(정해진 값: 다시 돌려도 같다)
    return 1 + 0.035 * math.sin(3 * ang + 0.7) + 0.025 * math.sin(5 * ang + 2.1) + 0.015 * math.sin(9 * ang)


def inside(x, y, lift=0):
    # lift: 윗면은 옆면 높이만큼 위로 올린 같은 꼴
    dx, dy = (x - CX) / A, (y + lift - CY) / B
    r = (abs(dx) ** 3.0 + abs(dy) ** 3.0) ** (1 / 3.0)
    return r <= wobble(math.atan2(dy, dx))


def on_top(x, y):
    return inside(x, y, SIDE_H) and inside(x, y)


N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
X0, X1, Y0, Y1 = CX - A - 6, CX + A + 6, CY - B - 6, CY + B + 6

# 1) 옛 디딤돌을 지운다: 23..25열 둘레를 같은 줄의 다섯 칸 오른쪽 물(무늬째, 돌 없는 곳)로 덮는다.
for y in range(10 * T - 2, 12 * T):
    for x in range(23 * T - 6, 26 * T + 6):
        px[x, y] = px[x + 5 * T, y]
# 옛 돌이 12행 위쪽에 남긴 그늘도(꼬마 물안개 디딤돌이 있는 24열은 그대로)
for y in range(12 * T, 12 * T + 12):
    for x in [*range(23 * T - 6, 24 * T - 6), *range(25 * T + 6, 26 * T + 6)]:
        px[x, y] = px[x + 5 * T, y]

# 2) 바위 둘레 물: 거품 테 한 줄, 아래에 그림자
for y in range(Y0, Y1 + 4):
    for x in range(X0, X1 + 1):
        if inside(x, y):
            continue
        if any(inside(x + dx, y + dy) for dx, dy in N4):
            px[x, y] = FOAM
        elif any(inside(x, y - k) for k in (1, 2, 3)) and not any(inside(x, y + k) for k in (1, 2, 3)):
            px[x, y] = SHADOW

# 3) 몸통: 옆면(아래쪽 띠)과 윗면
for y in range(Y0, Y1 + 1):
    for x in range(X0, X1 + 1):
        if not inside(x, y):
            continue
        edge = not all(inside(x + dx, y + dy) for dx, dy in N4)
        if on_top(x, y):
            top_edge = not all(on_top(x + dx, y + dy) for dx, dy in N4)
            if top_edge:
                px[x, y] = TOP_HI if y < CY - 4 else TOP_SHADE
            elif not on_top(x, y + 2):
                px[x, y] = TOP_SHADE
            elif not on_top(x, y - 2):
                px[x, y] = TOP_HI
            else:
                px[x, y] = TOP
        else:
            k = 0
            while k < SIDE_H and not on_top(x, y - k - 1):
                k += 1
            px[x, y] = OUTLINE if edge else SIDE[min(k, SIDE_H - 1)]


# 4) 윗면 얼룩·잔금·이끼(정해진 자리)
def blot(x0, y0, rx, ry, c, holes=()):
    for y in range(y0 - ry, y0 + ry + 1):
        for x in range(x0 - rx, x0 + rx + 1):
            if ((x - x0) / rx) ** 2 + ((y - y0) / ry) ** 2 > 1 or (x - x0, y - y0) in holes:
                continue
            if all(on_top(x + dx, y + dy) for dx, dy in N4) and px[x, y] == TOP:
                px[x, y] = c


for (dx, dy, rx, ry, c) in [
    (-44, -14, 6, 3, GREY), (-38, -12, 3, 2, GREY_D), (-10, -20, 4, 2, GREY), (18, -8, 7, 3, GREY),
    (24, -7, 3, 1, GREY_D), (44, -18, 4, 2, GREY), (50, 2, 5, 3, GREY), (-28, 4, 6, 3, GREY),
    (-22, 5, 2, 1, GREY_D), (2, 6, 4, 2, GREY), (34, 12, 3, 2, GREY), (-52, 8, 3, 2, GREY),
    (-6, -6, 8, 2, WARM), (30, -24, 6, 2, WARM), (-34, -22, 5, 2, WARM), (16, 16, 6, 2, WARM),
]:
    blot(CX + dx, CY + dy, rx, ry, c)
for (dx, dy, c) in [(-58, -6, MOSS[0]), (-57, -7, MOSS[1]), (-56, -6, MOSS[0]), (58, -10, MOSS[0]), (59, -11, MOSS[1]),
                    (-14, 14, MOSS[0]), (-13, 13, MOSS[1]), (40, -26, MOSS[0])]:
    blot(CX + dx, CY + dy, 1, 1, c)
# 잔금 두 줄(옆면 색)
for i in range(12):
    blot(CX - 4 + i, CY - 4 + (i // 4), 1, 1, SIDE[3])
for i in range(8):
    blot(CX + 30 + i, CY + 4 - (i // 3), 1, 1, SIDE[3])

im.save(out, optimize=True)
print('saved', out)
