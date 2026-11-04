3막 맵 손질 기록(원본은 gitignore된 design/art/act3/raw/). 저장소 뿌리에서 PY=/root/.local/share/sprite-gen/.venv/bin/python -I 로 돌렸다.
화풍 참고: assets/pixel/map_ch1-2_maeul-eogwi.png → pixelize 512x384(act1 색표) → scale 2 → (576,448)-(1024,768) 자른 raw/style_forest.png
3-1: 1K 초안 map_3-1_a1(guide_3-1x2 + style_forest) → palette → $PY compose_3-1_16.py raw/map_3-1_a1.png raw/map_3-1_comp.png
     → pixelize 512x384 → 16px 참고(bad 0) → 2K 다시 그리기 → pixelize 1536x1152 → bad 0(warp·칸 복사 없음)
