# 5-1 다시 그리기(풍성하게)용 참고 그림: 커밋한 5-1 맵 위에 큰 탑 문 자리를 거칠게 칠한다.
# 문: 13·18열 굵은 문설주(0~3줄, 세로 홈 새김), 12~19열 0줄 위쪽 두꺼운 상인방(네모 새김판), 14~17열 0줄 어두운 문 안,
# 15~16열 3~4줄 돌계단(길 색 위에 디딤 턱 줄만). 받침돌 위 석상 자리, 화단 하나에 쓰러진 돌기둥, 탑 벽의 바랜 깃발 자리.
# 모양은 모두 곧은 네모(아치·둥근 것 없음). 색은 5막 색표 안의 것만.
# 사용: $PY ref_5-1_rich.py assets/pixel/map_ch5-1_tap-apttel.png raw/map_5-1_ref_rich.png
import sys
from PIL import Image, ImageDraw
src, out = sys.argv[1:3]
im = Image.open(src).convert('RGB')
d = ImageDraw.Draw(im)
T = 48
STONE_L, STONE, STONE_D, INK, DARK = (0x75, 0x79, 0x81), (0x61, 0x66, 0x73), (0x4B, 0x51, 0x60), (0x40, 0x43, 0x4F), (0x2B, 0x26, 0x22)
R = lambda x0, y0, x1, y1, c, o=None: d.rectangle((round(x0 * T), round(y0 * T), round(x1 * T) - 1, round(y1 * T) - 1), fill=c, outline=o)

# 문설주(왼쪽 13열, 오른쪽 18열): 바깥 돌, 안쪽 밝은 면, 세로 홈 셋
for x in (13, 18):
    R(x, 0, x + 1, 3.95, STONE, INK)
    R(x + 0.15, 0.55, x + 0.85, 3.7, STONE_L, INK)
    for k in (0.32, 0.5, 0.68):
        R(x + k - 0.03, 0.8, x + k + 0.03, 3.5, STONE_D)
    R(x - 0.1, 3.55, x + 1.1, 3.95, STONE_D, INK)            # 받침
# 상인방과 새김판
R(12.6, 0, 19.4, 0.55, STONE, INK)
R(14.3, 0.08, 17.7, 0.47, STONE_D, INK)
for k in range(6):
    R(14.5 + k * 0.5, 0.16, 14.75 + k * 0.5, 0.39, STONE_L)
# 문 안(0줄 아래쪽)
R(14, 0.55, 18, 1.0, DARK)
# 돌계단: 3~4줄 15~16열, 길 위에 디딤 턱 줄만
for k in range(5):
    y = 3 + 0.4 * k
    R(15, y, 17, y + 0.06, (0xB0, 0xA6, 0x9C))
# 받침돌 위 석상(책을 든 사람·꺼진 등을 든 사람) 자리: 좁은 세로 덩이
for cx, top in ((11.5, 4.1), (20.5, 4.1)):
    R(cx - 0.45, top + 1.1, cx + 0.45, top + 1.6, STONE_D, INK)   # 석상 받침
    R(cx - 0.3, top, cx + 0.3, top + 1.15, STONE_L, INK)          # 몸
    R(cx - 0.18, top - 0.35, cx + 0.18, top, STONE_L, INK)         # 머리
# 쓰러진 돌기둥(오른쪽 화단)
R(19, 13.55, 24.6, 14.25, STONE_L, INK)
R(24.6, 13.45, 25.2, 14.35, STONE, INK)
# 탑 벽의 바랜 깃발(세로 띠) 넷
for cx in (6, 9, 23, 26):
    R(cx - 0.3, 0.4, cx + 0.3, 2.9, (0x8E, 0x86, 0x80), INK)
im.save(out)
print('saved', out)
