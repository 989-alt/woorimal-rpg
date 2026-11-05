3막 맵 손질 기록(원본은 gitignore된 design/art/act3/raw/). 저장소 뿌리에서 PY=/root/.local/share/sprite-gen/.venv/bin/python -I 로 돌렸다.
화풍 참고: assets/pixel/map_ch1-2_maeul-eogwi.png → pixelize 512x384(act1 색표) → scale 2 → (576,448)-(1024,768) 자른 raw/style_forest.png
3-1: 1K 초안 map_3-1_a1(guide_3-1x2 + style_forest) → palette → $PY compose_3-1_16.py raw/map_3-1_a1.png raw/map_3-1_comp.png
     → pixelize 512x384 → 16px 참고(bad 0) → 2K 다시 그리기 → pixelize 1536x1152 → bad 0(warp·칸 복사 없음)
3-2: 1K 초안 map_3-2_a1(guide_3-2x2 + style_forest) → $PY compose_3-2_16.py raw/map_3-2_a1.png raw/map_3-2_comp.png
     → pixelize 512x384 → 16px 참고(bad 0) → 2K 다시 그리기 두 번(a1은 둥근 낚시 바위 귀퉁이 2칸 bad, 오른쪽 윗물길이 네모로 떠서 버림)
     → a2 pixelize 1536x1152(bad 0) → $PY rock_rim_3-2.py raw/map_3-2_2k_px2.png raw/map_3-2_48.png(낚시 바위 돌 테두리)
     → $PY ../../act2/map-fixes/tilecopy.py raw/map_3-2_48.png raw/map_3-2_48b.png 48 6,12:10,12 0,13:10,13(갈대숲 칸)
다리 바닥은 길과 같은 모래색 널이다: 나무색 바닥은 걸을 수 있는 칸 검사(길 색 40%)를 못 넘는다(밑그림에서 bad 8).
