# 색표 PNG의 칸을 다른 칸에서 복사한다: tilecopy.py IN OUT T sx,sy:dx,dy[:w,h] ...
import sys
from PIL import Image
src, out, T = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src); orig = im.copy()
for op in sys.argv[4:]:
    parts = op.split(':')
    sx, sy = map(int, parts[0].split(',')); dx, dy = map(int, parts[1].split(','))
    w, h = map(int, parts[2].split(',')) if len(parts) > 2 else (1, 1)
    im.paste(orig.crop((sx * T, sy * T, (sx + w) * T, (sy + h) * T)), (dx * T, dy * T))
kw = {'transparency': im.info['transparency']} if 'transparency' in im.info else {}
im.save(out, optimize=True, **kw)
print('saved', out)
