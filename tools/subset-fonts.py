#!/usr/bin/env python3
"""고운돋움·주아 서브셋 만들기 (woff2). 계획: docs/superpowers/plans/2026-11-04-ui-overhaul-tutorial.md Task 3.

  /root/.local/share/sprite-gen/.venv/bin/python -I tools/subset-fonts.py \
      --gowun design/art/ui/raw/fonts-dl-gowun/GowunDodum-Regular.ttf \
      --jua   design/art/ui/raw/fonts-dl-jua/Jua-Regular.ttf \
      --out assets/fonts --chars-out tools/fonts

- 고운돋움 = KS X 1001 한글 2,350자 + ASCII 0x20~0x7E + 저장소 글(data/·js/·css/·index.html)에 나오는 글자
- 주아     = ASCII 0x20~0x7E + 저장소 글에 나오는 글자
- 힌팅을 빼고 woff2로 묶는다. 쓴 글자 목록은 정렬해 <chars-out>/gowun-dodum.chars.txt, jua.chars.txt로 남긴다.
  글을 더했는데 서브셋을 다시 만들지 않으면 tests/fonts.test.mjs가 잡는다(data/·js/의 글자가 목록에 없음).
- 원본 글꼴은 github.com/google/fonts 의 ofl/gowundodum/, ofl/jua/ (SIL OFL 1.1). 원본(ttf)은 저장소에 넣지 않는다.
"""
import argparse
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SCAN = [('data', '*.js'), ('js', '*.js'), ('css', '*.css')]


def ksx1001_hangul():
    """KS X 1001 한글 2,350자: EUC-KR 0xB0A1~0xC8FE."""
    chars = []
    for lead in range(0xB0, 0xC9):
        for trail in range(0xA1, 0xFF):
            chars.append(bytes([lead, trail]).decode('euc-kr'))
    assert len(chars) == 2350, len(chars)
    return set(chars)


def ascii_printable():
    return {chr(c) for c in range(0x20, 0x7F)}


def repo_chars():
    """data/·js/의 모든 .js, css/의 .css, index.html에 나오는 글자(공백·제어 문자 빼고). 주석도 센다: 빠뜨리지 않는 쪽을 고른다."""
    out = set()
    files = [ROOT / 'index.html']
    for d, pat in SCAN:
        files += sorted((ROOT / d).rglob(pat))
    for f in files:
        for ch in f.read_text(encoding='utf-8'):
            if not ch.isspace() and ord(ch) >= 0x20:
                out.add(ch)
    return out


def write_list(path, chars):
    path.write_text(''.join(sorted(chars)) + '\n', encoding='utf-8')


def make(src, dest, chars):
    font = TTFont(src)
    cmap = font.getBestCmap()
    missing = sorted(c for c in chars if ord(c) not in cmap)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.hinting = False
    opts.desubroutinize = True
    opts.layout_features = ['kern', 'liga', 'locl', 'ccmp', 'mark', 'mkmk']
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # 저작권·이름·라이선스 표시는 남긴다
    opts.notdef_outline = True
    opts.drop_tables += ['DSIG']
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(sorted(chars)))
    sub.subset(font)
    dest.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff2'
    font.save(dest)
    return missing


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--gowun', required=True, type=Path, help='GowunDodum-Regular.ttf')
    ap.add_argument('--jua', required=True, type=Path, help='Jua-Regular.ttf')
    ap.add_argument('--out', required=True, type=Path, help='woff2를 둘 폴더(assets/fonts)')
    ap.add_argument('--chars-out', required=True, type=Path, help='글자 목록을 둘 폴더(tools/fonts)')
    a = ap.parse_args()

    repo = repo_chars()
    gowun = ksx1001_hangul() | ascii_printable() | repo
    jua = ascii_printable() | repo
    a.chars_out.mkdir(parents=True, exist_ok=True)
    write_list(a.chars_out / 'gowun-dodum.chars.txt', gowun)
    write_list(a.chars_out / 'jua.chars.txt', jua)

    for name, src, chars in (('gowun-dodum', a.gowun, gowun), ('jua', a.jua, jua)):
        dest = a.out / f'{name}.v1.woff2'
        missing = make(src, dest, chars)
        print(f'{dest}: {dest.stat().st_size:,} bytes, {len(chars)}자 요청', file=sys.stderr)
        if missing:
            print(f'  원본에 없는 글자 {len(missing)}개(다른 글꼴로 대신 보임): {"".join(missing)}', file=sys.stderr)


if __name__ == '__main__':
    main()
