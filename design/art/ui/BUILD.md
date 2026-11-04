# UI 키트 만든 기록 (`assets/ui/*.v1.png`)

`assets/ui/`의 그림 17장을 어떤 생성 결과에서 어떻게 만들었는지 적는다. 그림을 다시 만들거나 고칠 때 이 순서를 따른다.
계획: `docs/superpowers/plans/2026-11-04-ui-overhaul-tutorial.md` Task 2. 크기·조각 값의 기준은 `data/assets.js`의 `UI_KIT`이다.

## 생성 (KIE.AI GPT Image 2.5, `tools/kie-gen.py`)

- 원본은 `design/art/ui/raw/`(gitignore)에 있고, 생성마다 옆에 `*.json`(요청·taskId·크레딧)이 있다.
- 프롬프트는 `design/art/ui/prompts/<부품>.txt`. 모두 `kit.txt`(시안 02의 UI KIT 문단, 한글 문장을 `No text, no letters, no numbers.`로 바꿈)를 끝에 붙였다.
  scroll·btn_green·btn_wood·btn_icon·ribbon·icons에는 "탁한 놋쇠" 문장을 더했다(panel·dialogue·card·medallion은 그 문장 없이 만들고 뒤에 `brass`로 고침).
- `--ref`는 승인된 시안에서 그 부품 자리만 잘라 쓴 그림이다(`raw/refs/<이름>.png`, 2736×1536 원본 좌표):

| ref | 시안 | 자른 상자 (x0, y0, x1, y1) |
|---|---|---|
| panel | ui-04-boss-battle | 1590, 20, 2490, 160 |
| dialogue | ui-03-dialogue | 50, 1040, 2690, 1490 |
| scroll | ui-02-explore | 300, 20, 1010, 210 |
| card | ui-04-boss-battle | 40, 1244, 716, 1500 |
| medallion | ui-02-explore | 40, 10, 320, 270 |
| btn_green | ui-01-title | 960, 890, 1710, 1100 |
| btn_wood | ui-01-title | 1020, 1120, 1710, 1336 |
| btn_icon | ui-02-explore | 2320, 20, 2520, 236 |
| ribbon | ui-03-dialogue | 140, 996, 700, 1130 |
| icons_hud | ui-02-explore | 2320, 20, 2720, 236 |
| icons_battle | ui-04-boss-battle | 40, 840, 620, 1440 |
| logo | ui-01-title | 700, 90, 2030, 620 |

```sh
# KIE_AI_API_KEY는 환경 변수로만 둔다(출력·파일에 쓰지 않는다).
R=design/art/ui/raw; P=design/art/ui/prompts
gen() { python3 tools/kie-gen.py --prompt-file $P/$1.txt --out $R/$2.png --resolution 1K --background transparent --aspect $3 "${@:4}"; }
gen panel      panel_1      1:1  --ref $R/refs/panel.png
gen dialogue   dialogue_1   1:1  --ref $R/refs/dialogue.png
gen card       card_1       1:1  --ref $R/refs/card.png
gen medallion  medallion_1  1:1  --ref $R/refs/medallion.png
gen scroll     scroll_2     16:9 --ref $R/refs/scroll.png      # scroll_1은 바둑판을 그려 넣은 불투명이라 버림
gen btn_green  btn_green_1  3:2  --ref $R/refs/btn_green.png   # 바둑판 불투명 → unchecker로 살림
gen btn_wood   btn_wood_1   3:2  --ref $R/refs/btn_wood.png
gen btn_icon   btn_icon_1   1:1  --ref $R/refs/btn_icon.png
gen ribbon     ribbon_1     16:9 --ref $R/refs/ribbon.png
gen icons      icons_1      1:1  --ref $R/refs/icons_hud.png --ref $R/refs/icons_battle.png
python3 tools/kie-gen.py --prompt-file $P/logo.txt --out $R/logo_1.png --resolution 2K --aspect 16:9 --ref $R/refs/logo.png
```

크레딧: 1K 11장 × 6 + 2K 로고 10 = **76**(계획의 크레딧 기록 표).

## 원본 → 부품

| 부품(`ASSETS.ui`) | 파일 | 원본 | 다듬기 | 자르기 |
|---|---|---|---|---|
| panel | frame_panel.v1.png | panel_1 | brass | frame, src-corner 175 |
| dialogue | frame_dialogue.v1.png | dialogue_1 | brass | frame, src-corner 200 |
| card | frame_card.v1.png | card_1 | brass | frame, src-corner 230 |
| scroll | frame_scroll.v1.png | scroll_2 | — | bar --asym-right |
| btnGreen | btn_green.v1.png | btn_green_1 | unchecker → brass | bar |
| btnWood | btn_wood.v1.png | btn_wood_1 | — | bar |
| btnIcon | btn_icon.v1.png | btn_icon_1 | — | bar |
| ribbon | ribbon_mask.v1.png | ribbon_1 | — | bar --mask |
| medallion | medallion.v1.png | medallion_1 | brass | fit |
| iconBook, iconScroll, heartFull, heartEmpty, check | icon_*.v1.png 등 | icons_1 → sheet | — | fit |
| hpCell | hp_cell.v1.png | icons_1 → sheet | — | bar |
| coin | coin.v1.png | icons_1 → sheet | coinface → brass | fit |
| logo | logo_title.v1.png | logo_1 | `sprite-gen cutout --key magenta` → despill | fit |

## 다듬기와 자르기 (그대로 실행하면 지금의 `assets/ui`와 픽셀까지 같게 나온다)

다듬기 방법과 수치는 `tools/ui-postprocess.py` 머리말에 있다(brass: 놋쇠 가운뎃값을 s 0.68·v 0.82로, unchecker: 채도 0.18 미만 + 가장자리에서 흘려 채우기, coinface: 0.78R 안의 밝기 120 미만을 #E2B86C로, despill: min(R,B)−G > 4를 #FFE7A3로).
`frame`의 `--src-corner`는 모서리 놋쇠 장식과 안쪽 둥근 놋쇠 선이 다 들어오는 값이다(panel은 150에서 이음매가 꺾여 175로 올림).
`frame`은 위를 뒤집어 아래를 만들므로 버튼(윤기 띠·아랫단)·두루마리(오른쪽 축)·리본(위아래 조각 0)에는 `bar`를 쓴다.

```sh
PY="/root/.local/share/sprite-gen/.venv/bin/python -I"
R=design/art/ui/raw; W=$R/work; OUT=${OUT:-assets/ui}; mkdir -p $W $OUT
PP="$PY tools/ui-postprocess.py"; SL="$PY tools/ui-slice.py"

# 다듬기
for n in panel_1 dialogue_1 card_1 medallion_1; do $PP brass $R/$n.png $W/$n.png; done
$PP unchecker $R/btn_green_1.png $W/btn_green_1c.png && $PP brass $W/btn_green_1c.png $W/btn_green_1.png
/root/.local/share/sprite-gen/.venv/bin/sprite-gen cutout $R/logo_1.png --out $W/logo_1_cut.png --key magenta
$PP despill $W/logo_1_cut.png $W/logo_1.png
$SL sheet $R/icons_1.png $W/icons --names icon_book,icon_scroll,heart_full,heart_empty,hp_cell,coin,check --size 256x256
$PP coinface $W/icons/coin.png $W/coin_light.png && $PP brass $W/coin_light.png $W/coin.png

# 틀(대칭 9조각, 가운데 투명)
$SL frame $W/panel_1.png    $OUT/frame_panel.v1.png    --size 144x144 --slice 48,48,48,48 --src-corner 175
$SL frame $W/dialogue_1.png $OUT/frame_dialogue.v1.png --size 192x192 --slice 64,64,64,64 --src-corner 200
$SL frame $W/card_1.png     $OUT/frame_card.v1.png     --size 144x144 --slice 48,48,48,48 --src-corner 230
# 가로 3조각(높이에 맞춰 줄이고, 위아래 뒤집기 없음)
$SL bar $R/scroll_2.png     $OUT/frame_scroll.v1.png   --size 336x120 --slice 36,96,36,36 --asym-right
$SL bar $W/btn_green_1.png  $OUT/btn_green.v1.png      --size 192x144 --slice 48,64,32,64
$SL bar $R/btn_wood_1.png   $OUT/btn_wood.v1.png       --size 192x144 --slice 48,64,32,64
$SL bar $R/btn_icon_1.png   $OUT/btn_icon.v1.png       --size 144x160 --slice 40,40,40,40
$SL bar $R/ribbon_1.png     $OUT/ribbon_mask.v1.png    --size 400x104 --slice 0,80,0,80 --mask
$SL bar $W/icons/hp_cell.png $OUT/hp_cell.v1.png       --size 64x40   --slice 0,20,0,20
# 하나씩 맞추기(비율 유지, 남는 곳 투명)
$SL fit $W/medallion_1.png  $OUT/medallion.v1.png      --size 192x192
$SL fit $W/logo_1.png       $OUT/logo_title.v1.png     --size 1200x480
$SL fit $W/coin.png         $OUT/coin.v1.png           --size 80x80
for n in icon_book icon_scroll; do $SL fit $W/icons/$n.png $OUT/$n.v1.png --size 96x96; done
for n in heart_full heart_empty check; do $SL fit $W/icons/$n.png $OUT/$n.v1.png --size 64x64; done
```

## 다음 과제가 알아 둘 것

- 틀의 나무 테는 조각 폭보다 얇다(모서리 장식이 테 두께의 두 배쯤 안쪽까지 들어와서). 화면 px로 panel 약 9/24, dialogue 약 9/32, card 약 8/24.
  `background: padding-box`만 쓰면 나무와 한지 사이가 비어 보이므로, 한지를 테 안쪽 일부까지 깔아야 한다(가상 요소를 나무 폭만큼 안으로 들여 놓기 등).
- 좌우 거울이라 한 틀의 보석은 모두 같은 색이다. 리본은 모양 가면뿐이고, README의 접힘·그늘 회색 덮개는 아직 없다.
- 색표 줄이기(FASTOCTREE) 때문에 버튼 윤기를 크게 키워 보면 띠가 조금 보인다. 보이는 크기에서는 괜찮다.
