4막 맵 손질 기록(원본은 gitignore된 design/art/act4/raw/). 저장소 뿌리에서 PY=/root/.local/share/sprite-gen/.venv/bin/python -I 로 돌렸다.
화풍 참고: assets/pixel/map_ch1-1_saebyeokgol.png → pixelize 512x384(act1 색표) → scale 2 → (0,0)-(448,320) 자른 raw/style_house.png
4-1: 1K 초안 map_4-1_a1(guide_4-1x2 + style_house) → $PY compose_4-1_16.py raw/map_4-1_a1.png raw/map_4-1_comp.png
     (초안의 숲·비탈·벼랑·찻집·화로·돌무더기·푯말·꺾인 나무를 데이터 칸에 다시 놓고, 채도 절반 + 장밋빛 해질녘으로 고름)
     → palette raw/map_4-1_comp.png --allow-fog (4막 색표: 해질녘으로 고른 밑그림에서 뽑아야 색이 맞는다)
     → pixelize 512x384 → 16px 참고 bad 0 → 2K 다시 그리기는 16px 대신 고른 밑그림(map_4-1_comp)을 1536x1152로 줄여 참고로 줌
       (16px로 줄이면 푯말·돌무더기·화로가 몇 점으로 뭉개진다)
     → pixelize 1536x1152 → $PY path_calm.py raw/map_4-1_2k_px.png 4-1 raw/map_4-1_48a.png '#D7B28B' '#CC9C71'
       (색표로 줄인 길이 두 흙색 얼룩으로 갈려 bad 72 → 한 흙색 + 성긴 잔점, bad 2)
     → $PY fix_4-1_48.py raw/map_4-1_48a.png raw/map_4-1_48.png (착지 왼쪽 위 두 칸 풀 → 길, 튀어나온 길 칸 모서리 둥글리기,
       막힌 칸에만 낮은 안개 디더링) → bad 0
fog.py: 안개는 잿빛 3단 가운데 밝은·가운데 둘을 Bayer 4×4(2px 칸) 디더링으로 찍는다. 덮는 점은 밑그림이 밝으면 밝은 잿빛,
     어두우면 가운데 잿빛이라 밑의 나무·바위 모양이 비친다. 가장 짙은 곳도 78%라 아주 메운 회색 면이 없다.
     걸을 수 있는 칸 둘레 20px 안은 엷어지고, 상징 소품(찻집·푯말·돌무더기·꺾인 나무) 둘레는 비운다.
