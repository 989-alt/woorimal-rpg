5막 맵 손질 기록(원본은 gitignore된 design/art/act5/raw/). 저장소 뿌리에서 PY=/root/.local/share/sprite-gen/.venv/bin/python -I, R=design/art/act5/raw.
K="--ledger design/art/credits.tsv --task T7 --cap 1000"

첫 판(커밋 673518e, f2db88e: 너무 밋밋하다는 검토로 갈아엎음, 기록으로 둔다)
  5-1: kie-gen map_5-1_16.txt(guide_5-1x2 + style_house) → compose_5-1_16.py → kie-gen 2K map_5-1_48.txt(--ref map_5-1_ref48)
       → palette → pixelize → fix_5-1_48.py
  5-2: kie-gen map_5-2_16.txt(guide_5-2x2 + style_51) → compose_5-2_16.py → kie-gen 2K map_5-2_48.txt → pixelize → fix_5-2_48.py

풍성한 판(지금 맵)
  참고 그림: 첫 판 커밋 맵 위에 새로 넣을 것의 자리를 거칠게 칠한다.
    $PY design/art/act5/map-fixes/ref_5-1_rich.py assets/pixel/map_ch5-1_tap-apttel.png $R/map_5-1_ref_rich.png
      (13·18열 4칸 높이 문기둥과 상인방, 문 안, 돌계단, 받침돌 위 석상, 쓰러진 돌기둥, 탑 벽의 바랜 깃발)
    $PY design/art/act5/map-fixes/ref_5-2_rich.py assets/pixel/map_ch5-2_tap-kkokdaegi.png $R/map_5-2_ref_rich.png
      (바깥 두 칸 구름 바다, 네모 톱니 난간 벽, 동쪽 내려가는 돌계단, 꼭대기 단 테두리와 금, 부서진 쇠 난간)
  2K: python3 tools/kie-gen.py --prompt-file design/art/act5/prompts/map_5-1_48_rich.txt --out $R/map_5-1_2k_b1.png --aspect 4:3 --resolution 2K --ref $R/map_5-1_ref_rich.png $K
      python3 tools/kie-gen.py --prompt-file design/art/act5/prompts/map_5-2_48_rich.txt --out $R/map_5-2_2k_b1.png --aspect 4:3 --resolution 2K --ref $R/map_5-2_ref_rich.png $K
  색표: 두 2K 그림을 옆으로 붙인 $R/both_b1.png에서
      $PY tools/map-fit.py palette $R/both_b1.png --out design/art/act5/map-palette.json --max-sat 0.25   (43색)
  줄이기: $PY tools/pixelize.py $R/map_5-X_2k_b1.png $R/map_5-X_b1_px.png --size 1536x1152 --palette design/art/act5/map-palette.json --max-colors 64
  다듬기: $PY design/art/act5/map-fixes/fix_5-1_48_rich.py $R/map_5-1_b1_px.png $R/map_5-1_48b.png
          $PY design/art/act5/map-fixes/fix_5-2_48_rich.py $R/map_5-2_b1_px.png $R/map_5-2_48b.png
          (둘 다 calm.py: 걸을 수 있는 칸마다 길 색 46% 넘게, 길 색과 가까운 점부터 바꿔 또렷한 무늬는 남긴다)
  확인: $PY tools/map-fit.py score … 5-X → bad 0, overlay → design/art/act5/overlay_5-X.png

데이터 고침(5-1, Task 1 Step 9 규칙 안): (14,1) (14,2) (17,1) (17,2) 네 칸을 '.'→'#'. 탑 문 안을 두 칸 폭으로 좁혀
  문기둥이 4칸 높이로 서게 했다. 출구 (15,1)·출구 통로 (15,0)·글자 칸 둘레 1칸은 건드리지 않았다. tests/acts.test.mjs 통과.

아트 바이블과 다르게 하지 않은 것: 탑은 곧은 수직·직각만이라 아치 문 대신 높은 네모 문(기둥·상인방·계단), 둥근 무늬 대신
  네모 모자이크. 안개는 4막 맵에만이라 5-2 바깥은 걸을 수 없는 칸의 구름 바다(잿빛 3단이 아닌 색)로만 그렸다. 불빛 없음.
