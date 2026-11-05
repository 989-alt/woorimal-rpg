# 4-2 16px 맵 밑그림 모으기: 1K 초안(map_4-2_a1)의 바위·소나무·벼랑·쉼터·화로·이정표·솔가지 묶음을 데이터 칸에 다시 놓는다.
# 바탕(바위·소나무) → 바위 등성이(9~12줄) → 아래 벼랑(21줄~)·동쪽 벼랑·서쪽 큰 바위 → 걸을 수 있는 칸은 평평한 길 → 소품
# → 4-1과 같은 해질녘 색 고르기(채도 절반, 장밋빛).
import sys, json, subprocess
import numpy as np
from PIL import Image, ImageEnhance
src, out = sys.argv[1:3]
T = 45
orig = Image.open(src).convert('RGB')
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '4-2'], capture_output=True, text=True).stdout)
W, H = 32 * T, 24 * T
walk = lambda x, y: 0 <= y < 24 and 0 <= x < 32 and rows[y][x] != '#' and not rows[y][x].isdigit()

im = Image.new('RGB', (W, H))
def tile(crop, x0, y0, x1, y1, h=None):  # crop을 높이 h(칸, 기본 상자 높이)로 맞춰 뒤집어 가며 옆으로 잇는다
    hh = round((h or (y1 - y0)) * T)
    c = crop.resize((max(1, round(crop.width * hh / crop.height)), hh), Image.BOX)
    for j, y in enumerate(range(round(y0 * T), round(y1 * T), hh)):
        for i, x in enumerate(range(round(x0 * T), round(x1 * T), c.width)):
            p = c if (i + j) % 2 == 0 else c.transpose(Image.FLIP_LEFT_RIGHT)
            p = p.crop((0, 0, min(p.width, round(x1 * T) - x), min(p.height, round(y1 * T) - y)))
            im.paste(p, (x, y))

tile(orig.crop((0, 0, 140, 540)), 0, 0, 32, 24, 12)               # 바탕: 바위와 소나무(초안 왼쪽 띠, 길 가장자리 앞까지)
tile(orig.crop((820, 375, 1440, 545)), 0, 9, 32, 13, 4)           # 바위 등성이(고갯마루와 마당 사이, 초안의 틈 길은 빼고)
tile(orig.crop((360, 950, 1110, 1086)), 0, 20.8, 32, 24, 3.2)     # 아래 벼랑
tile(orig.crop((1120, 770, 1448, 1086)), 28.6, 12.6, 32, 24, 7)   # 동쪽 벼랑
tile(orig.crop((1120, 770, 1448, 1086)), 23.6, 16.8, 32, 21, 7)
tile(orig.crop((0, 555, 160, 850)), 0, 13.4, 3, 17.8, 4.4)        # 서쪽 큰 바위
tile(orig.crop((0, 780, 330, 1086)), 0, 17.8, 8, 21, 3.2)         # 서남 바위·소나무

sand_rgb = np.median(np.array(orig.crop((700, 250, 1100, 330))).reshape(-1, 3), axis=0)
sand = Image.new('RGB', (T, T), tuple(int(v) for v in sand_rgb))
def flatten():  # 걸을 수 있는 칸 + 출구 통로(28,0)는 평평한 길
    for ty, r in enumerate(rows):
        for tx, c in enumerate(r):
            if walk(tx, ty):
                im.paste(sand, (tx * T, ty * T))
    im.paste(sand, (28 * T, 0))
flatten()

def put(sbox, cx, bottom, width, height=None):
    c = orig.crop(sbox)
    a = np.array(c).astype(float)
    mask = Image.fromarray(((np.abs(a - sand_rgb).sum(axis=2) > 60)).astype(np.uint8) * 255)
    h = height or round(c.height * width / c.width)
    c = c.resize((width, h), Image.BOX)
    mask = mask.resize((width, h), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    im.paste(c, (round(cx - width / 2), round(bottom - h)), mask)

# 지붕이 반쯤 꺾인 쉼터: 초안 쉼터를 둘로 나눠, 멀쩡한 왼쪽 지붕은 12~14열 14~16줄(3×3칸)에,
# 꺾여 내려앉은 오른쪽 지붕은 15~16열 15~16줄(2×2칸, 맨 오른쪽 앞 기둥이 9)에 놓는다.
put((592, 555, 736, 750), 13.5 * T, 17 * T - 2, int(3.05 * T), int(3.0 * T))
put((736, 578, 880, 750), 15.95 * T, 17 * T - 2, int(2.1 * T), int(2.0 * T))
put((826, 640, 866, 752), 16.45 * T, 16 * T - 1, int(0.5 * T), int(1.25 * T))  # 9 오른쪽 앞 기둥(꺾인 지붕 끝을 받친다)
put((428, 560, 515, 632), 10.5 * T, 14 * T - 2, int(1.1 * T))                 # 3 화로
put((1000, 818, 1082, 950), 23.5 * T, 21 * T - 2, int(1.0 * T))               # 4 이정표
put((140, 660, 215, 760), 3.5 * T, 18 * T - 2, int(0.95 * T))                 # 0 서쪽 바위 밑 솔가지
put((1288, 655, 1360, 755), 28.5 * T, 17 * T - 2, int(0.95 * T))              # 1 동쪽 벼랑 끝 솔가지
put((325, 875, 395, 958), 8.5 * T, 21 * T - 2, int(0.95 * T))                 # 2 마당 남쪽 구석 솔가지
flatten()

# 해질녘: 채도 절반, 노을이 막 시작한 따뜻한 장밋빛을 살짝 곱한다(4-1과 같은 값)
im = ImageEnhance.Color(im).enhance(0.5)
a = np.array(im).astype(float) * (np.array([255, 226, 200]) / 255.0) ** 0.6
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out)
print('saved', out)
