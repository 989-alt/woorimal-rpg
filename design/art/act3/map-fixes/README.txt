3막 맵 손질 기록(원본은 gitignore된 design/art/act3/raw/). 저장소 뿌리에서 PY=/root/.local/share/sprite-gen/.venv/bin/python -I 로 돌렸다.
화풍 참고: assets/pixel/map_ch1-2_maeul-eogwi.png → pixelize 512x384(act1 색표) → scale 2 → (576,448)-(1024,768) 자른 raw/style_forest.png
3-1: 1K 초안 map_3-1_a1(guide_3-1x2 + style_forest) → palette → $PY compose_3-1_16.py raw/map_3-1_a1.png raw/map_3-1_comp.png
     → pixelize 512x384 → 16px 참고(bad 0) → 2K 다시 그리기 → pixelize 1536x1152 → bad 0(warp·칸 복사 없음)
3-2: 1K 초안 map_3-2_a1(guide_3-2x2 + style_forest) → $PY compose_3-2_16.py raw/map_3-2_a1.png raw/map_3-2_comp.png
     → pixelize 512x384 → 16px 참고(bad 0) → 2K 다시 그리기 두 번(a1은 둥근 낚시 바위 귀퉁이 2칸 bad, 오른쪽 윗물길이 네모로 떠서 버림)
     → a2 pixelize 1536x1152(bad 0) → $PY rock_rim_3-2.py raw/map_3-2_2k_px2.png raw/map_3-2_48.png(낚시 바위 돌 테두리)
     → $PY ../../act2/map-fixes/tilecopy.py raw/map_3-2_48.png raw/map_3-2_48b.png 48 6,12:10,12 0,13:10,13(갈대숲 칸)
다리 바닥은 길과 같은 모래색 널이다: 나무색 바닥은 걸을 수 있는 칸 검사(길 색 40%)를 못 넘는다(밑그림에서 bad 8).

3-2 다시 그리기(2026-11-05, 선생님: "냇물도 위아래 구분이 되도록, 나무다리도 둥근 모양으로 디테일을 챙겨", 여유 크레딧 T3R 10)
  색표: map-palette_3-2.json = 3막 맵 색표 + 물빛·물안개·다리 나무·돌 색 13개(예약 색과 거리 12 넘음). quant_3-2.py가 실제로 쓰는 색을 64색 이하로 줄인다.
  1) 밑그림: 커밋돼 있던 옛 맵 위에 물·다리·디딤돌을 코드로 칠한다(웅덩이·윗물길·도랑은 바랜 물안개 색, 냇물은 깊이 띠·잔물결·윤슬, 둥근 아치 다리, 디딤돌 일곱).
     $PY paint_3-2.py ../../../../assets/pixel/map_ch3-2_yunseulnae.png raw/map_3-2_ref48_v2.png   (옛 맵 = 커밋 1cbe564의 그림)
  2) 2K 다시 그리기(1번, 10크레딧): 저장소 뿌리에서
     python3 tools/kie-gen.py --prompt-file design/art/act3/prompts/map_3-2_48_v2.txt --out design/art/act3/raw/map_3-2_2k_b1.png \
       --aspect 4:3 --resolution 2K --ref design/art/act3/raw/map_3-2_ref48_v2.png --ledger design/art/credits.tsv --task T3R --cap 356
  3) 저장소 뿌리에서:
     $PY design/art/act3/map-fixes/quant_3-2.py design/art/act3/raw/map_3-2_2k_b1.png design/art/act3/raw/map_3-2_b1_px.png      (bad 5: 디딤돌 칸)
     $PY design/art/act3/map-fixes/paint_3-2.py design/art/act3/raw/map_3-2_b1_px.png design/art/act3/raw/map_3-2_b1_fix.png --only seams,rock,mistify,stream,bridge,stones,glints
       (아래 숲 네모 이음매 풀기 · 빨래 바위 잔금 · 도랑과 냇물 어귀를 물안개 색으로 · 맨 위 윗물길 · 코드로 그린 둥근 다리와 디딤돌을 다시 얹기 · 하류 윤슬)
     $PY design/art/act3/map-fixes/quant_3-2.py design/art/act3/raw/map_3-2_b1_fix.png assets/pixel/map_ch3-2_yunseulnae.png    (64색)
     $PY tools/map-fit.py score assets/pixel/map_ch3-2_yunseulnae.png 3-2   → bad 0 (warp·칸 복사 없음)
     $PY tools/map-fit.py overlay assets/pixel/map_ch3-2_yunseulnae.png 3-2 design/art/act3/overlay_3-2.png
  2차 손질(크레딧 0): 디딤돌을 기울기·크기·지그재그로 흩고 윗면에 얼룩·지의류·잔금·이끼, 회갈색 옆면, 젖은 밑동, 상류 쪽 물거품.
    칸마다 길 색이 0.42 아래면 그 돌만 4%씩 키워 다시 그린다(paint_3-2.py draw_stones). 다리 널 금을 끝 쪽으로 휘고 양 끝 비탈 그늘 띠·꼭대기 볕·난간과 기둥 그림자.
  다리 바닥 칸 길 색 45~74%, 디딤돌 칸 42~44%. 걸을 수 없는 물속 바위는 회색이라 디딤돌과 헷갈리지 않는다.

3-2 낚시 바위(2026-11-05, 출시 검토, 크레딧 0): 꼬마 물안개(m) 너머 디딤돌 여섯 개(23..25열, 10..11행)가 북쪽 냇둑(9행, 벽)에 닿아
  "어디로도 안 가는 디딤돌"처럼 보였다. 이야기(여울: "꼬마 물안개가 낚시 바위로 가는 길을 막고 있어")와
  tests/acts.test.mjs("m이 막는 길이 있다")대로 이 칸들은 막다른 낚시 바위이므로, 맵 데이터는 그대로 두고 그림만 고쳤다.
  디딤돌 여섯 개를 지우고(같은 줄 다섯 칸 오른쪽 물 무늬로 덮음) 냇둑과 물길로 떨어진 넓적한 바위 하나를 맵 색표 안의 색으로 칠했다.
     python3 design/art/act3/map-fixes/fishing_rock_3-2.py <커밋 e84fc81의 맵> assets/pixel/map_ch3-2_yunseulnae.png
     $PY tools/map-fit.py score assets/pixel/map_ch3-2_yunseulnae.png 3-2 → bad 0, 바위 칸 길 색 47~80%
