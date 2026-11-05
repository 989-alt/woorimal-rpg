# 5-2(풍성하게, 탑 꼭대기) 48px 다듬기. 2K 원본 map_5-2_2k_b1(참고: ref_5-2_rich.py로 난간·구름·단을 칠한 커밋 맵)을
# 5막 색표(5-1과 같은 43색)로 줄인 뒤:
# 1) 위쪽 등잔걸이(0, (15,3)): 2K는 종을 넣어 그렸다. 서쪽 빈 등잔걸이(1, (3,9)) 칸을 옮겨 놓아 셋이 같은 빈 등잔걸이가 되게 한다.
# 1b) 구름 띠의 가장 밝은 점은 구름 잿빛으로.
# 2) calm.py: 걸을 수 있는 칸(과 출구 통로 (31,10))마다 길 색이 46% 넘게. 바닥에 떨어진 잔돌·재·꽃잎·금·물웅덩이는 남는다.
# 사용: $PY fix_5-2_48_rich.py raw/map_5-2_b1_px.png raw/map_5-2_48b.png
import os, sys, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from calm import calm
src, out = sys.argv[1:3]
im = Image.open(src)
a = np.array(im)
pal = im.getpalette()
rows = json.loads(subprocess.run(['node', 'tools/layout-guide.mjs', '--rows', '5-2'], capture_output=True, text=True).stdout)
T = a.shape[1] // 32

# 1) 위쪽 등잔걸이
a[2 * T + 16:4 * T, 15 * T:16 * T] = a[8 * T + 16:10 * T, 3 * T:4 * T]

# 1b) 구름의 가장 밝은 점(흰 빛처럼 보임)은 구름 잿빛으로(바닥 둘레 밖에서만)
hexes = ['#%02X%02X%02X' % tuple(pal[i*3:i*3+3]) for i in range(len(pal) // 3)]
from calm import walk_mask, shift_all
wm, _ = walk_mask(a, rows, {(31, 10)})
out_zone = ~shift_all(wm, 4 * T, np.logical_or) | (np.arange(a.shape[1])[None, :] >= 30 * T) | (np.arange(a.shape[1])[None, :] < 2 * T)
for h, to in (('#FBF5E6', '#A19B93'), ('#D1C9BA', '#A19B93'), ('#C9BFAE', '#A19B93')):
    a[(a == hexes.index(h)) & out_zone & ~wm] = hexes.index(to)

# 2) 길 고르기
P = '#C9BFAE'
NEAR = ['#BBB0A1', '#BAB2A7', '#BDB6AB', '#B6ACA0', '#D1C9BA']
a = calm(a, pal, rows, {(31, 10)}, P, NEAR)
o = Image.fromarray(a, 'P'); o.putpalette(pal)
o.save(out, optimize=True)
print('saved', out)
