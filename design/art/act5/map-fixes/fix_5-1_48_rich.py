# 5-1(풍성하게) 48px 다듬기. 2K 원본 map_5-1_2k_b1(참고: ref_5-1_rich.py로 문 자리를 칠한 커밋 맵)을
# 5막 색표(5-1·5-2 풍성한 2K 둘을 나란히 붙인 그림에서 뽑은 43색)로 줄인 뒤:
# 1) 탑 문: 2K는 문 안(15~16열 1~3줄)을 그늘로 그렸다. 마당 판석을 옮겨 깔고, 0줄과 1줄 위 22px만 어두운 문 안으로
#    (아래로 갈수록 성긴 디더). 문기둥은 데이터대로 14·17열 1~2줄 막힌 칸(act5.js 5-1 두 줄 고침)에 그대로 선다.
# 2) (16,5) 문 앞 기둥: 2K는 계단으로 그렸다. 오른쪽 (17,5) 기둥 돌을 옮겨 놓는다.
# 3) calm.py: 걸을 수 있는 칸마다 길 색이 46% 넘게(판석의 밝기 차이를 먼저 모으고, 모자라면 길 색과 가까운 점부터).
#    금 간 판석·잔돌·마른 꽃잎·풀·물웅덩이·네모 모자이크 같은 또렷한 무늬는 남는다.
# 사용: $PY fix_5-1_48_rich.py raw/map_5-1_b1_px.png raw/map_5-1_48b.png
import os, sys, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from calm import calm
src, out = sys.argv[1:3]
im = Image.open(src)
a = np.array(im)
pal = im.getpalette()
hexes = ['#%02X%02X%02X' % tuple(pal[i*3:i*3+3]) for i in range(len(pal) // 3)]
idx = lambda h: hexes.index(h.upper())
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '5-1'], capture_output=True, text=True).stdout)
T = a.shape[1] // 32

DARK, INK = idx('#22242C'), idx('#34373D')
B = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])
# 1) 문 안 바닥: 마당 판석 2×3칸(20~21열 16~18줄)을 문 안 15~16열 1~3줄로 옮기고, 0줄과 1줄 위쪽만 어두운 문 안
#    (1줄 위 22px 안에서 아래로 갈수록 성긴 Bayer 디더, 짙은 먹색 → 먹색)
a[1 * T:4 * T, 15 * T:17 * T] = a[16 * T:19 * T, 20 * T:22 * T]
for yy in range(T, 3 * T):                             # 문설주 안쪽 그늘(양옆 6px, 성긴 디더)
    for xx in list(range(15 * T, 15 * T + 6)) + list(range(17 * T - 6, 17 * T)):
        if B[yy % 4, xx % 4] < 6:
            a[yy, xx] = INK
for yy in range(int(0.55 * T), T + 22):
    t = 1.0 if yy < T + 6 else 1 - (yy - T - 6) / 16
    for xx in range(15 * T, 17 * T):
        if B[yy % 4, xx % 4] < t * 16:
            a[yy, xx] = DARK if yy < T + 12 else INK
# 2) (16,5) 기둥
a[5 * T:6 * T, 16 * T:17 * T] = a[5 * T:6 * T, 17 * T:18 * T]

# 3) 길 고르기
P = '#C9BFAE'
NEAR = ['#BBB0A1', '#BAB2A7', '#BDB6AB', '#B6ACA0', '#D1C9BA']
a = calm(a, pal, rows, set(), P, NEAR)
o = Image.fromarray(a, 'P'); o.putpalette(pal)
o.save(out, optimize=True)
print('saved', out)
