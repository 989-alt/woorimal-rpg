2막 맵 손질 기록(원본은 gitignore된 design/art/act2/raw/). 저장소 뿌리에서 PY=/root/.local/share/sprite-gen/.venv/bin/python -I 로 돌렸다.
2-1: $PY fix_2-1_16.py raw/map_2-1_a2.png raw/map_2-1_a2_fix.png → pixelize 512x384 → 16px 참고(bad 0) → 2K 다시 그리기
     → pixelize 1536x1152 → $PY tilecopy.py raw/map_2-1_2k_px.png raw/map_2-1_48.png 48 10,21:14,21:4,3 11,15:10,15 17,18:18,18
2-2: $PY compose_2-2_16.py raw/map_2-2_a1.png raw/map_2-2_comp.png → pixelize 512x384 → 16px 참고(bad 0) → 2K 다시 그리기
     → pixelize 1536x1152 → $PY tilecopy.py raw/map_2-2_2k_px.png raw/map_2-2_48.png 48 16,10:17,10 23,10:22,10
tilecopy 인자: 원본칸x,y:대상칸x,y[:너비,높이] (칸 단위, 같은 그림에서 복사하므로 색표 그대로)
