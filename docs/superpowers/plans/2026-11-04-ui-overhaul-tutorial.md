# UI 다시 만들기와 플레이 안내 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선생님이 승인한 UI 시안 다섯 장(타이틀, 모습 고르기, 탐험 HUD, 대화, 보스 전투)대로 모든 화면 틀을 나무·놋쇠 UI 키트로 다시 만들고, 처음 하는 학생에게 그 자리에서 한 번만 뜨는 가벼운 플레이 안내를 넣는다.

**Architecture:** UI 그림(틀 9조각 PNG, 버튼, 리본 가면, 로고, 아이콘)은 KIE.AI로 만들고 `tools/ui-slice.py`가 대칭으로 맞춰 자른다. 경로와 조각 수치는 `data/assets.js`의 `ASSETS.ui`·`UI_KIT` 한 곳에 두고, `js/ui/ui-kit.js`가 그림을 불러온 뒤에만 `<html>`에 `ui-*` 클래스와 `--ui-*` 변수를 달아 CSS 틀을 켠다. 그림을 못 받으면 클래스가 붙지 않아 지금의 CSS 모습(한지 + 2px 먹갈 테두리)이 그대로 보인다. 안내는 순수 함수 `js/rules/tutorial.js`가 "지금 띄울 안내"를 고르고, 말풍선 한 가지(`js/ui/hint.js`)가 그리며, 본 안내는 기존 `seenTips`에 남는다.

**Tech Stack:** HTML, CSS(`border-image` 9조각, `-webkit-mask-box-image`), 순수 JS 모듈, Node 22 `node --test`, Playwright 1.56.1, Python 3(Pillow, fontTools — sprite-gen venv), KIE.AI GPT Image 2.5(`tools/kie-gen.py`, `KIE_AI_API_KEY`), sprite-gen `cutout`, GitHub Pages(`.github/workflows/pages.yml`).

**Spec:** `docs/superpowers/specs/2026-11-04-woorimal-rpg-design.md`(5·7·9·10절) · `design/art/art-bible.md`(3·4·7·8·9절) · UI 키트와 화면별 배치: `design/art/ui-concepts/README.md` · 승인된 시안 `design/art/ui-concepts/ui-01-title.webp` ~ `ui-05-character-select.webp` · 이 계획의 "선생님 결정" 절.

**선행 조건:** `2026-11-04-act1-playable.md`, `2026-11-04-act1-art.md` 완료(1막 그림이 들어간 상태). 이 계획은 앞 계획의 "2~5막으로 넘기는 일" 가운데 **글꼴 직접 올리기·용량 검사의 글꼴 몫**과 **HUD 가방 칸 32px 물건 그림**을 함께 처리한다. 그림 캐시 비우기와 `walkFrame`·`tipLift` 단위 검사는 이 계획에 넣지 않는다.

## 선생님 결정 (2026-11-04)

1. 타이틀과 플레이 화면이 아마추어 같다는 지적에 따라, 한국 2D 판타지 MMO RPG 갈래의 상용 수준 UI로 다시 만든다. 시안 다섯 장을 승인했고, 이것으로 README "아트 바이블과 다른 점" 표의 3·4·7·8절 고침도 승인된 것으로 본다.
2. 기존 게임의 UI·로고·이름·배치를 베끼지 않는다. 그림 프롬프트에 게임 이름을 넣지 않는다.
3. "처음 진행을 하며 npc를 만났을 때 어떻게 말을 걸어야 하는지, 전투는 어떻게 하는지 등 플레이를 하며 가볍게 안내": 그 순간에 한 번만 뜨는 안내 말풍선으로 하고, 본 것은 저장의 `seenTips`에 남긴다. 안내할 때는 처음 걷기, 처음 인물 앞에 섰을 때, 처음 대화, 처음 낱말 카드, 처음 부탁 받기, 처음 반짝임을 봤을 때, 처음 복습 전투, 처음 보스 전투다.

## Global Constraints

- 정적 웹앱, 빌드 없음, 런타임 외부 라이브러리 없음. 서버·로그인·소리 없음. 배포는 GitHub Pages(`pages.yml`이 `claude/gracious-thompson-8cti4h`·`main` push 때 `index.html css js data assets`를 gh-pages로 올림).
- 규칙은 `js/rules/*.js` 순수 함수, 글·대사·그림 경로는 `data/`에만. 안내 문구는 규칙 모듈 `js/rules/tutorial.js` 한 곳에 둔다(대사가 아니라 조작 설명이므로).
- 접근성(그대로 지킴): 키보드 초점 `outline: 3px solid #3B5BA5; outline-offset: 2px`(금빛 금지) · 누르는 것은 모두 48px 이상 · 1366×768에서 본문 글자 18px 이상 · `aria-label`·`role` 유지 · `prefers-reduced-motion`이면 서서히 나타나기만 · 정답/오답은 색 + ○/× + 글자.
- 말빛 금 `#F2C14E`은 낱말 띠·새 낱말 카드 테두리·정답 보기에만 쓴다. 놋쇠 `#C9963F`은 탁하게 두고 빛나지 않게 한다.
- UI 색 토큰(README 그대로): `--wood-dark #6E3211` · `--wood #8D4A19` · `--wood-light #DE9735` · `--brass #C9963F` · `--brass-light #F1C178` · `--brass-dark #8A5E2A` · `--parchment #FBF5E6` · `--parchment-deep #F6E4C0` · `--ink #2B2622` · `--gem-green #5FAE5A` · `--gem-blue #3FA7C9` · `--tag-green #4C8724` · `--hero #3B5BA5` · `--heart #E0584F` · `--hp #5E6266` · `--hp-empty #8A8D91` · `--gold #F2C14E`. 초록 버튼 면 `#A6C94A → #5FAE5A → #3E7A2C`(아랫단 `#2F5A22`), 나무 버튼 면 `#DE9735 → #8D4A19`(아랫단 `#5A2E0E`). 버튼 글자는 흰색 + 먹색 윤곽 2px(`paint-order: stroke`).
- 글꼴: 대사·문제·HUD·도움말 고운돋움, 버튼·명판·화면 제목·보기 낱말·이름 리본 주아. 크기(1366×768): 대사 28(줄 간격 1.6) · 문제 28 · 버튼 28 · 화면 제목 32 · 보기 낱말 32 · 리본 24 · HUD 20 · 최소 18. `word-break: keep-all`.
- 글자는 언제나 HTML이다. 그림이 한글을 그리는 것은 로고 하나뿐이고, 로고 그림은 `alt=""`, 이름은 `<h1>` 글자로 둔다.
- 그림 프롬프트(아트 바이블 9절): 게임·회사·작가 이름, `in the style of` 금지. 틀·버튼·아이콘 프롬프트에는 `no text, no letters`. 크레딧 합계 **120 이하**, 1K 6크레딧·2K 10크레딧. `KIE_AI_API_KEY`는 출력하지 않는다.
- UI 그림은 `assets/ui/*.v1.png`(8비트 색표 + 투명), 2배로 만들어 절반 크기로 보인다. 글꼴은 `assets/fonts/*.v1.woff2`(직접 올림, Google Fonts 링크 없음).
- 모든 화면은 UI 그림 하나하나가 실패해도 지금의 CSS 모습으로 읽히고 눌린다(`images.js`의 has-art 방식과 같은 원칙).
- 탐험은 1366×768에서 1:1(칸당 48픽셀 그대로), 화면이 크면 맵을 더 보이고 키우지 않는다. 한지색 여백 없음.
- `?test=1` 도움 기능은 모두 남긴다. 선택자가 바뀐 화면 검사는 고쳐 쓰고, 검사를 약하게 만들지 않는다.
- 학생이 읽는 글은 6학년 눈높이의 쉬운 한국어, 안내 한 줄은 30자 이하, 두 줄까지.

## Review Focus

1. **UI 그림이 일부만 실패**(학교 필터가 `btn_green`만 막음 등): 그 부품만 CSS 모습으로 돌아가고 글자가 읽히며 단추가 48px 이상이어야 한다. → Task 3 `ui-kit.test.mjs` "부분 실패".
2. **창 크기가 1366×768이 아님**(1024×768 태블릿, 1280×800, 주소창 때문에 세로가 짧은 1366×650, 창 크기 바꾸기): 캔버스가 늘 화면을 꽉 채우고, 가로 스크롤이 없고, 주인공이 HUD 밑에 숨지 않아야 한다. → Task 5 "창 크기" 검사.
3. **긴 글**(6글자 닉네임 `가나다라마바`, "마른 나무에서 장작 모으기", "빨래터 아주머니"): HUD 두루마리·이름 리본·명판에서 넘치거나 옆 부품과 겹치지 않아야 한다(말줄임은 할 일 한 줄만). → Task 5·6 검사.
4. **안내가 떠 있을 때 다른 일**(도감 E·할 일 Q 열기, 바로 말 걸기, 전투로 넘어감): 안내가 클릭을 가로채거나 다른 장면에 남아 떠다니면 안 된다. → Task 9 검사.
5. **옛 저장으로 이어하기**(`seenTips`에 `move`·`first-npc`·`tip-word`·`tip-boss`·`tip-review`만 있음): 본 안내는 다시 뜨지 않고, 새 안내만 한 번씩 뜬다. 저장 형식 `version: 1`은 그대로다. → Task 8 단위 검사 + Task 9 화면 검사.

---

## File Structure

```
design/art/art-bible.md         3·4·7·8절 고침(Task 1)
design/art/ui/prompts/*.txt     UI 키트 프롬프트(Task 2), design/art/ui/raw/는 .gitignore
tools/ui-slice.py               틀 대칭 9조각·아이콘 맞추기·시트 나누기·가면(Task 1), 가로 3조각 bar(Task 2)
tools/ui-postprocess.py         놋쇠 탁하게·바둑판 지우기·동전 면·마젠타 번짐 빼기(Task 2), 만든 기록 design/art/ui/BUILD.md
tools/subset-fonts.py           고운돋움·주아 서브셋(Task 3), tools/fonts/*.chars.txt
assets/ui/*.v1.png              UI 키트(Task 2)   assets/fonts/*.v1.woff2, OFL-*.txt(Task 3)
data/assets.js                  ASSETS.ui, UI_KIT(Task 2)
css/ui-kit.css                  토큰, 틀·버튼·리본·메달·아이콘·안내 말풍선(Task 3, 9)
css/game.css                    장면별 배치(Task 4~7)
js/ui/ui-kit.js                 loadUiKit: 그림 불러오기 → <html> 클래스·변수(Task 3)
js/ui/hint.js                   안내 말풍선 층(Task 9)
js/rules/tutorial.js            안내 규칙과 문구(Task 8)
js/scenes/select.js             새 장면: 이름·모습 고르기(Task 4)
js/explore/scale.js             computeView(Task 5)
tests/fixtures/ui-kit.html      UI 부품 견본 페이지(Task 3)
```

---

### Task 1: 아트 바이블 고침과 UI 자르기 도구

**모델:** sonnet, medium

**Files:**
- Modify: `design/art/art-bible.md`(3·4·7·8절, 머리의 Last Updated), `design/art/ui-concepts/README.md`(상태 줄을 "선생님 승인 2026-11-04"로), `.gitignore`(`design/art/ui/raw/`)
- Create: `tools/ui-slice.py`
- Test: `tests/tools.test.mjs`

**Interfaces:**
- Produces (명령줄, sprite-gen venv의 `python -I`로 실행):
  - `ui-slice.py frame IN OUT --size WxH --slice T,R,B,L --src-corner PX [--asym-right] [--fill]` → 대칭 9조각 시트
  - `ui-slice.py fit IN OUT --size WxH` → 알파 상자로 자르고 비율 유지해 맞춤(남는 곳 투명) — 메달, 로고, 아이콘 하나
  - `ui-slice.py sheet IN OUTDIR --names a,b,c --size WxH` → 연결된 덩어리를 위→아래, 왼→오 순서로 나눠 `OUTDIR/<name>.png`(각각 `fit`)
  - `ui-slice.py mask IN OUT --size WxH --slice T,R,B,L --src-corner PX` → 리본 가면(RGB는 모두 흰색, 알파만 모양), 좌우 대칭
  - `ui-slice.py bar IN OUT --size WxH --slice T,R,B,L [--asym-right] [--mask]` → (Task 2에서 더함) 높이 H에 맞춰 비율대로 줄이고 왼 끝 L열 + 가운데 띠 + 오른 끝(왼쪽 거울, `--asym-right`이면 원본 오른 끝), 위아래 뒤집기 없음. 버튼·두루마리·HP 칸, `--mask`는 위·아래 조각이 0인 리본 가면. `frame`·`mask`는 조각 값에 0이 있으면 `bar --mask`를 쓰라는 말로 멈춘다
  - 모든 출력: 8비트 색표 PNG(256색 이하) + tRNS, 알파 8 이하는 0.

- [ ] **Step 1: 아트 바이블 고치기** — README "아트 바이블과 다른 점" 표의 일곱 줄을 해당 절에 옮겨 쓴다. 3절 UI 모양 규칙 → 조각한 꿀빛 나무 테 + 놋쇠 선 + 모서리 놋쇠 잎 + 초록·파랑 보석 징, 틀은 2배 PNG 9조각. 4절 UI 색 → Global Constraints의 토큰 표(말빛 금 예외 문장 포함). 7절 → "UI는 그림 틀(PNG 9조각), 글자는 HTML", 탐험 HUD는 위 88px 영역의 떠 있는 명판·초상 메달·두루마리·아이콘 버튼, 타이틀 두 단계(타이틀 → 모습 고르기), 대화 상자 수치(좌우 24·높이 200·아래 16·글자 28), 글꼴 크기 표(Global Constraints), "처음 하는 학생 안내"를 Task 8의 안내 표로 바꾸고 "첫 전투 전 규칙 한 장"을 "첫 전투의 안내 말풍선"으로. 8절 → 형식 표에 `assets/ui/` 줄(8비트 색표 + 투명, 2배, 틀 40KB·로고 200KB·아이콘 12KB 이하), 로고는 그림 한글의 유일한 예외, 맵 표시는 "캔버스가 화면을 꽉 채운다: 내부 크기 = 화면 크기 / f", 처음 열 때 3MB의 범위(코드·글꼴·UI 키트·타이틀·모습 카드 상반신 2장·1장 도트), 글꼴 상한(고운돋움 320KB, 주아 120KB, 아래 Task 3 사유), 폴더에 `assets/ui/`.
- [ ] **Step 2: 실패하는 검사** — `tests/tools.test.mjs`에 넷을 더한다(venv 없으면 지금처럼 skip). 원본 그림은 검사 안에서 Pillow로 만든다(왼쪽 위 모서리 빨강, 오른쪽 위 파랑처럼 일부러 비대칭).
  - `ui-slice frame: 크기·색표·좌우와 위아래 대칭·가운데 투명` — `--size 144x144 --slice 48,48,48,48 --src-corner 60` 결과가 144×144, 모드 `P`, `transparency` 있음, 모든 (x,y)에서 `px(x,y) == px(143-x,y) == px(x,143-y)`, 가운데 (72,72) 알파 0.
  - `ui-slice frame --fill: 가운데가 채워진다` — 같은 원본으로 (72,72) 알파 255.
  - `ui-slice sheet: 덩어리 셋을 이름 순서대로` — 세 색 덩어리 → `a.png b.png c.png`, 각각 지정 크기, 각 파일의 가장 많은 불투명 색이 원본 덩어리 색.
  - `ui-slice mask: 흰색 + 알파, 좌우 대칭` — 불투명 픽셀의 RGB가 모두 (255,255,255).
- [ ] **Step 3: 실패 확인** — Run: `node --test tests/tools.test.mjs` / Expected: 새 검사 넷 FAIL(`tools/ui-slice.py` 없음)
- [ ] **Step 4: `tools/ui-slice.py` 구현** — `frame`의 방법: 알파 상자로 자른 원본에서 왼쪽 위 `PX×PX`를 떼어 L×T 모서리로 줄이고(LANCZOS), 위 변은 원본 위쪽 가운데의 `PX×PX` 띠를 (W−L−R)×T로, 왼 변은 왼쪽 가운데 띠를 L×(H−T−B)로 줄인다. 오른쪽은 왼쪽의 거울, 아래는 위의 상하 뒤집기다. `--asym-right`이면 오른쪽 모서리·변을 원본 오른쪽에서 같은 방법으로 떼어 온다(두루마리 축, 좌우 대칭 검사 대상 아님). `--fill`이면 가운데를 원본 가운데 띠로 채운다. 끝으로 `quantize(256, FASTOCTREE)`.
- [ ] **Step 5: 통과 확인** — Run: `node --test tests/tools.test.mjs` / Expected: PASS
- [ ] **Step 6: Commit** — `git add design/art/art-bible.md design/art/ui-concepts/README.md .gitignore tools/ui-slice.py tests/tools.test.mjs && git commit -m "docs: art bible UI amendments; tools: ui-slice for symmetric 9-slice frames"`

---

### Task 2: UI 키트 그림 만들기와 등록

**모델:** opus, medium (그림을 직접 보고 고르는 일)

**Files:**
- Create: `design/art/ui/prompts/{kit,panel,dialogue,scroll,card,medallion,btn_green,btn_wood,btn_icon,ribbon,icons,logo}.txt`, `assets/ui/{logo_title,frame_panel,frame_dialogue,frame_scroll,frame_card,medallion,btn_green,btn_wood,btn_icon,ribbon_mask,icon_book,icon_scroll,heart_full,heart_empty,hp_cell,coin,check}.v1.png`
- Modify: `data/assets.js`, `tests/assets-budget.test.mjs`
- Test: `tests/assets-budget.test.mjs`, `tests/assets.test.mjs`

**Interfaces:**
- Consumes: `tools/ui-slice.py`(Task 1), `tools/kie-gen.py`
- Produces: `ASSETS.ui = { logo, panel, dialogue, scroll, card, medallion, btnGreen, btnWood, btnIcon, ribbon, iconBook, iconScroll, heartFull, heartEmpty, hpCell, coin, check }`(값은 `assets/ui/<파일>.v1.png`).
- Produces: `UI_KIT` — 키마다 `{ w, h, slice?: [T,R,B,L], border?: [T,R,B,L], fill?: true, mask?: true }`. 값(그림 px, border는 화면 px):

| 키 | w×h | slice | border | 비고 |
|---|---|---|---|---|
| panel | 144×144 | 48,48,48,48 | 24 (명판은 같은 그림을 16) | 가운데 투명 |
| dialogue | 192×192 | 64,64,64,64 | 32 | 보석 징 모서리 |
| scroll | 336×120 | 36,96,36,36 | 18,48,18,18 | `--asym-right`(나무 축) |
| card | 144×144 | 48,48,48,48 | 24 | 보기·모습 카드 |
| btnGreen, btnWood | 192×144 | 48,64,32,64 | 24,32,16,32 | fill |
| btnIcon | 144×160 | 40,40,40,40 | 20 | fill, 72×80으로 보임 |
| ribbon | 400×104 | 0,80,0,80 | 0,40,0,40 | mask |
| medallion | 192×192 | — | — | 96px로 보임, 가운데 투명 |
| logo | 1200×480 | — | — | 600×240으로 보임 |
| iconBook, iconScroll | 96×96 | | | 48px |
| heartFull, heartEmpty, check | 64×64 | | | 32px |
| hpCell | 64×40 | | | 32×20 |
| coin | 80×80 | | | 40px |

- [ ] **Step 1: 실패하는 검사** — `tests/assets-budget.test.mjs`: `SPEC.ui`를 키마다 `UI_KIT`의 w×h로 보고, 상한은 틀·버튼·메달·리본 40KB, 로고 200KB, 아이콘 12KB, `assets/ui` 합계 500KB. `pngInfo`가 `tRNS`를 읽어 `alpha`를 돌려주게 하고 UI PNG는 `colorType === 3 && alpha`. `firstLoadPaths()`를 아트 바이블 8절 정의로 바꾼다: 코드·데이터 + `assets/ui` 전부 + `assets/fonts` 전부(아직 없으면 0) + `ASSETS.title` + `busts.hero_f.base`·`busts.hero_m.base` + 1-1의 도트(맵, `walk.f`, 1-1 인물 도트, 1-1 물건 아이콘, `small[1]`, `bossPixel[1]`). `tests/assets.test.mjs`: `ASSETS.ui`의 모든 경로가 `assets/ui/<이름>.v1.png` 꼴이고 `UI_KIT`과 키가 같다.
- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL(`ASSETS.ui` 없음)
- [ ] **Step 3: 프롬프트 쓰기** — `kit.txt`에 `design/art/ui-concepts/prompts/02-explore.txt`의 "UI KIT" 문단을 그대로 옮기되 "Korean text…" 문장을 `no text, no letters, no numbers`로 바꾼다. 부품 프롬프트는 `kit.txt` + "a single isolated <부품>, centred, straight-on orthographic view, symmetric, empty parchment-free centre(틀) / transparent background" + 해당 시안을 `--ref`로. 아이콘은 한 장에 일곱 개(책, 두루마리 체크리스트, 하트 가득, 하트 빈 윤곽, HP 칸 한 개, 놋쇠 동전(숫자 없음), 초록 체크)를 넉넉한 간격으로. 로고는 "말빛 한울" 네 글자를 정확히(한지빛 → 아래쪽 연한 금빛 글자, 먹갈색 윤곽 + 나무색 바깥 윤곽, 나무 명판, 오른쪽에 은은히 빛나는 작은 천 주머니), 다른 글자 없음, `--ref ui-01-title.webp`.
- [ ] **Step 4: 생성** — 순서와 예산(합계 120 이하, 계획 82):

| 부품 | 해상도·배경 | 크레딧 |
|---|---|---|
| panel → 투명 + ref가 되는지 먼저 확인 | 1K transparent | 6 |
| dialogue, scroll, card, medallion | 1K transparent | 24 |
| btn_green, btn_wood, btn_icon | 1K transparent | 18 |
| ribbon | 1K transparent | 6 |
| icons(한 장) | 1K transparent | 6 |
| logo | 2K, 단색 마젠타 `#FF00FF` 배경 → `sprite-gen cutout` | 10 |
| 다시 만들기 여유 | | 38 |

  첫 panel 결과가 불투명이거나 API가 ref + transparent를 거부하면, 나머지를 모두 "solid magenta #FF00FF background"로 바꾸고 `sprite-gen cutout`으로 지운다(마젠타 번짐 보정은 앞 계획 Task 5 방식). 결과마다 직접 보고 확인: 기존 게임 UI와 닮지 않음, 글자 없음(로고는 "말빛 한울" 정확), 좌상단 빛, 놋쇠가 금빛처럼 빛나지 않음. 부품당 최대 3번. 합계가 120에 닿으면 멈추고 남은 부품은 CSS 대체로 둔 채 보고한다.
- [ ] **Step 5: 자르기** — `ui-slice.py`로 `UI_KIT` 표의 크기·slice대로 `assets/ui/*.v1.png`를 만든다(`--src-corner`는 원본을 보고 모서리 장식이 다 들어오는 값). 아이콘 시트는 `sheet --names icon_book,icon_scroll,heart_full,heart_empty,hp_cell,coin,check` 뒤 크기별로 `fit`. 로고는 `fit --size 1200x480`. 각 결과를 확대해 보고, 틀 이음매(변 반복)가 끊겨 보이면 `--src-corner`를 고쳐 다시 자른다. `data/assets.js`에 `ASSETS.ui`와 `UI_KIT`을 넣는다.
- [ ] **Step 6: 통과 확인** — Run: `npm test` / Expected: PASS, `# first load` 줄이 3.00 MB 이하
- [ ] **Step 7: 크레딧 기록** — 이 계획 끝 "크레딧 기록" 표에 부품별 생성 수·크레딧을 적는다(`*.json` 보고서 기준).
- [ ] **Step 8: Commit** — `git add design/art/ui assets/ui data/assets.js tests/assets-budget.test.mjs tests/assets.test.mjs docs/superpowers/plans/2026-11-04-ui-overhaul-tutorial.md && git commit -m "art: UI kit frames, buttons, ribbon mask, icons and logo"`

---

### Task 3: 글꼴 직접 올리기, UI 토큰과 부품, 그림 실패 대비

**모델:** sonnet, high

**Files:**
- Create: `tools/subset-fonts.py`, `tools/fonts/gowun-dodum.chars.txt`, `tools/fonts/jua.chars.txt`, `assets/fonts/gowun-dodum.v1.woff2`, `assets/fonts/jua.v1.woff2`, `assets/fonts/OFL-GowunDodum.txt`, `assets/fonts/OFL-Jua.txt`, `css/ui-kit.css`, `js/ui/ui-kit.js`, `tests/fixtures/ui-kit.html`
- Modify: `index.html`, `js/main.js`, `css/game.css`(`:root`, `html/body/#app`, `.big-button` 삭제), `tests/assets-budget.test.mjs`, `tests/css.test.mjs`
- Test: `tests/fonts.test.mjs`, `tests/ui-kit.test.mjs`, `tests/e2e/ui-kit.test.mjs`

**Interfaces:**
- Consumes: `ASSETS.ui`, `UI_KIT`(Task 2), `loadImage`(`js/ui/images.js`)
- Produces (`js/ui/ui-kit.js`): `uiVarName(key) -> string`(`'btnGreen'` → `'--ui-btn-green'`), `uiClassName(key) -> string`(→ `'ui-btn-green'`), `loadUiKit(root = document.documentElement) -> Promise<{ ok: string[], failed: string[] }>` — 키마다 그림을 받고, 받은 것만 `root.style.setProperty(uiVarName(k), 'url("<경로>")')`와 `root.classList.add(uiClassName(k))`. 실패한 키는 클래스를 떼어 둔다. 다시 불러도 된다(캐시).
- Produces (CSS 부품, `css/ui-kit.css`): `.frame-panel` · `.frame-plate`(panel 그림, 테 16) · `.frame-dialogue` · `.frame-scroll` · `.frame-card` · `.btn` + `.btn-green`|`.btn-wood`(높이 64, `.btn-lg` 76, `.btn-sm` 48) · `.btn-icon`(72×80, 안에 `.icon` 48 + 이름 20 + `.key-badge`) · `.key-badge`(CSS만, 크림 바탕·먹색 글자 18px·아래 3px 진한 테두리) · `.ribbon`(`--speaker-color`, `--speaker-ink`) · `.medallion` · `.coin` · `.icon.icon-book|.icon-scroll|.icon-check` · `.heart.full|.empty` · `.hp-cell(.lost)`. 그림 규칙은 모두 `:root.ui-<키>` 아래에만 둔다. 클래스가 없으면 한지 `--parchment` + `2px solid #5A4636` + `border-radius: 12px`(지금 모습), 단추는 지금 `.big-button` 모습.
- Produces: 버튼 상태(README 표): 올림 `brightness(1.08)`, 누름 `translateY(2px)` + 면 6% 어둡게, 못 누름(`:disabled`, `[aria-disabled=true]`) `saturate(.4) opacity(.6)`, 초점은 Global Constraints의 쪽빛 테두리.

- [ ] **Step 1: 실패하는 검사**
  - `tests/fonts.test.mjs`: `assets/fonts/gowun-dodum.v1.woff2` ≤ 320KB, `jua.v1.woff2` ≤ 120KB, `css/ui-kit.css`의 `@font-face` url 둘이 이 파일을 가리키고 `font-display: swap`, `index.html`에 고운돋움 `rel="preload" as="font" crossorigin`이 있고 `fonts.googleapis.com`이 없다. `gowun-dodum.chars.txt`가 KS X 1001 한글 2,350자(`new TextDecoder('euc-kr')`로 0xB0A1~0xC8FE를 풀어 만든 목록)를 모두 담는다. `data/`·`js/`의 모든 `.js` 파일에 나오는 공백이 아닌 글자가 두 목록에 모두 있다(서브셋을 다시 만들지 않고 글을 더하면 이 검사가 잡는다).
  - `tests/ui-kit.test.mjs`: `uiVarName('btnGreen') === '--ui-btn-green'`, `uiClassName('panel') === 'ui-panel'`; 가짜 root(`classList`·`style.setProperty`를 기록)와 `loadImage`가 `heartFull`만 실패하는 경우 `loadUiKit`이 `failed: ['heartFull']`, 나머지는 클래스·변수가 달림.
  - `tests/assets-budget.test.mjs`: "쓰지 않는 파일" 검사가 `assets/fonts/`는 CSS가 가리키는지로, `OFL-*.txt`는 글꼴 짝이 있는지로 본다.
  - `tests/css.test.mjs`: 장면 뿌리(`.title-scene`, `.select-scene`, `[data-scene='explore']`, `.dialogue-scene`, `.battle-scene`, `.end-scene`)마다 `position: fixed`와 `inset: 0`; `100vh`가 남으면 지금처럼 바로 다음 줄에 `100dvh`. `body` 배경에 `--parchment`를 쓰지 않는다(여백 없음).
  - `tests/e2e/ui-kit.test.mjs`(견본 페이지 `/tests/fixtures/ui-kit.html`: 두 CSS를 읽고 `loadUiKit()`을 부른 뒤 부품을 하나씩 늘어놓음):
    - `그림이 오면 <html>에 ui-* 클래스 17개, .btn-green의 borderImageSource에 btn_green`.
    - `assets/ui/** 를 모두 막으면 ui-* 클래스 0개, .btn-green은 2px solid 테두리·높이 ≥ 48, 페이지 오류 없음`(콘솔 오류는 `/assets/ui/`를 가리키는 것만 허용).
    - `btn_green만 막으면 .btn-green만 CSS 모습, .frame-panel은 그림`(Review Focus 1).
    - `글꼴: document.fonts.check('20px "Gowun Dodum"')와 Jua가 참`.
- [ ] **Step 2: 실패 확인** — Run: `npm test && npm run test:e2e` / Expected: 새 검사 FAIL
- [ ] **Step 3: 글꼴 만들기** — `pip install fonttools brotli`(sprite-gen venv). 원본 `GowunDodum-Regular.ttf`, `Jua-Regular.ttf`와 `OFL.txt`를 `github.com/google/fonts`의 `ofl/gowundodum/`, `ofl/jua/`에서 `design/art/ui/raw/fonts/`로 받는다. `tools/subset-fonts.py --gowun SRC --jua SRC --out assets/fonts --chars-out tools/fonts`: 고운돋움 = KS X 1001 2,350자 + ASCII 0x20~0x7E + `data/`·`js/` 글자, 주아 = ASCII + `data/`·`js/` 글자(주석 포함: 빠뜨리지 않는 쪽을 고른다), `flavor='woff2'`, 힌팅 제거. 글자 목록은 정렬해 `*.chars.txt`로 남긴다.
- [ ] **Step 4: 구현** — `index.html`: Google Fonts 링크를 지우고 고운돋움 preload와 `css/ui-kit.css`(game.css 앞)를 넣는다. `css/ui-kit.css`: `@font-face` 둘(`font-weight: 400`, 가짜 굵게 금지 `font-synthesis: none`), 토큰, 부품. 틀은 `border-style: solid; border-color: transparent; border-width: <UI_KIT.border>; border-image: var(--ui-panel) <slice> [fill] / <border> round; background: var(--parchment) padding-box`. 리본은 `background: var(--speaker-color)` + `-webkit-mask-box-image: var(--ui-ribbon) 0 80 0 80 / 0 40px stretch`(그리고 `mask-border` 같은 값). `css/game.css`: `html, body, #app`의 가운데 정렬·한지 배경을 걷고 `body { background: var(--wood-dark); }`, 모든 장면 뿌리 `position: fixed; inset: 0`. 지금 `.big-button`을 쓰는 곳은 이 Task에서 클래스만 `.btn .btn-wood`(확인·시작·다시 도전은 `.btn-green`)로 바꾼다. `js/main.js`: 시작할 때와 `router.show` 감싼 곳의 `forgetFailed()` 뒤에 `loadUiKit()`.
- [ ] **Step 5: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS(기존 화면 검사 포함)
- [ ] **Step 6: Commit** — `git commit -m "feat: self-hosted font subsets, UI kit tokens and frames with CSS fallback"`

---

### Task 4: 타이틀과 모습 고르기

**모델:** sonnet, medium

**Files:**
- Create: `js/scenes/select.js`
- Modify: `js/scenes/title.js`, `js/main.js`(`router.register('select', select)`), `css/game.css`(시작 화면 절), `tests/title.test.mjs`, `tests/e2e/browser.mjs`, `tests/e2e/boot.test.mjs`, `tests/e2e/art-layout.test.mjs`(타이틀 검사), 시작 화면을 지나는 `tests/e2e/act1.test.mjs`·`reload.test.mjs`·`battle.test.mjs`
- Test: `tests/title.test.mjs`, `tests/e2e/boot.test.mjs`, `tests/e2e/art-layout.test.mjs`

**Interfaces:**
- Consumes: `.btn*`, `.frame-*`(Task 3), `ASSETS.ui.logo`, `setArt`
- Produces: `shouldSubmit`, `stillSameName`, `titleDecision`을 `js/scenes/select.js`로 옮긴다. `titleDecision({ nickname, avatar, choice, store })`는 지금과 같되 `choice === 'continue'`이고 저장이 없으면 `{ action: 'not-found' }`(지금은 새 게임 시작).
- Produces: 장면 `select`, `params = { mode: 'new' | 'continue', name?: string }`, `data-scene="select"`.
- Produces (`tests/e2e/browser.mjs`): `startFromTitle(page, { name, avatar = 'f', mode = 'new' })` — 타이틀 단추 → 이름 입력 → (new면 모습 카드) → 시작/이어하기.
- 타이틀(`data-scene="title"`): `title.webp`를 `object-fit: cover`로 꽉 채움. `<h1 class="title-logo">말빛 한울</h1>` 안에 `setArt(h1, ASSETS.ui.logo, 'logo-img art')`, 그림이 붙으면(`has-art`) 글자는 시각적으로만 숨김. 로고 폭 600(화면 약 45%), 위 40. 그림이 없으면 주아 72px 글자 + 먹갈 6px·나무색 12px 윤곽(`paint-order: stroke`) + `linear-gradient` 채움. 메뉴: 가운데, `처음부터`(`.btn-green.btn-lg`)·`이어하기`(`.btn-wood.btn-lg`) 340×76, 사이 16, 첫 단추 위끝 y≈470, 첫 초점 처음부터, ↑↓로 초점 이동. 저장된 이름이 없으면 이어하기는 `disabled`. `store.available === false`면 메뉴 아래 명판에 "이 창에서는 저장되지 않아요".
- 모습 고르기(new): 제목 명판 "모습 고르기" 360×64(위 24) → 이름 패널 680×130(위 104, "내 이름" 칸 + "1~6글자, 한글·영어·숫자로 적어 주세요." 18px + 오류 줄) → 모습 카드 220×280 둘(사이 40, `.frame-card`, `role="radio"`, `aria-label` "여자 주인공"/"남자 주인공", 카드 아래 명판에 "여자"/"남자" 글자) → 아래 "뒤로"(`.btn-wood` 200×64, 아래 24) · "시작하기"(`.btn-green` 260×72). 고른 카드: 밝은 놋쇠 테 + 초록 체크 배지(`.icon-check`), 빛 번짐 없음, 안 고른 카드 `brightness(.75)`.
- 이어하기(continue): 제목 명판 "이어하기", 이름 패널, 그 아래 저장된 이름 단추(`.btn-wood.btn-sm`, 48px 이상, 누르면 칸에 이름) — 모습 카드 없음. 아래 "뒤로" · "이어하기". `not-found`면 "이 이름으로 저장된 게임이 없어요." + "처음부터 하기" 단추(→ `select`, `{ mode: 'new', name }`).
- 그대로 지킴: 한글 조합 중 엔터 무시, `ask-overwrite`("이미 있는 이름이에요. 이어할까요, 처음부터 할까요?")·`load-error` 확인 창과 이름이 바뀌면 덮어쓰지 않는 guard, 새 게임이면 `intro` 대화 → 탐험.

- [ ] **Step 1: 실패하는 검사** — `tests/title.test.mjs`: import를 `select.js`로 바꾸고 `test('이어하기: 저장이 없으면 not-found', …)` → `{ action: 'not-found' }`. `tests/e2e/boot.test.mjs`: `타이틀: h1 이름 "말빛 한울", 처음부터에 초점, ↓ 뒤 이어하기에 초점, 단추 높이 ≥ 48`; `처음부터 → 모습 고르기: 이름 칸은 화면 위 절반, 카드 아래 "여자"·"남자" 글자가 보인다, 뒤로 → 타이틀`; `저장 없음 → 이어하기 disabled`; `이어하기: 저장된 이름 단추를 누르면 칸에 이름, 이어하기로 탐험`; 기존 "이미 있는 이름 확인 창" 검사는 모습 고르기 화면에서 그대로. `art-layout`의 타이틀 검사는 "글자는 패널(명판) 위"를 select 화면 기준으로 바꾸고, 로고 상자 폭 600±20.
- [ ] **Step 2: 실패 확인** — Run: `npm test && node --test tests/e2e/boot.test.mjs tests/e2e/art-layout.test.mjs` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 Interfaces대로. `title.js`는 메뉴만, 이름·모습·저장 처리는 `select.js`. 시작 화면을 지나는 다른 화면 검사는 `startFromTitle`로 바꾼다.
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: title menu with logo and separate character select step"`

---

### Task 5: 탐험 화면 꽉 채우기와 HUD

**모델:** sonnet, high

**Files:**
- Modify: `js/explore/scale.js`, `js/explore/render.js`, `js/explore/hud.js`, `js/explore/input.js`(터치 단추 클래스), `js/scenes/explore.js`, `js/main.js`(`teleportTo`는 그대로, 검사용 `view` 노출), `css/game.css`(탐험 절)
- Test: `tests/grid.test.mjs`, `tests/render.test.mjs`, `tests/e2e/explore.test.mjs`, `tests/e2e/images.test.mjs`, `tests/e2e/overlays.test.mjs`

**Interfaces:**
- Produces (`scale.js`): `computeView(winW, winH) -> { factor, canvasW, canvasH, cssW, cssH, viewW, viewH }` — `factor = min(1, winW/1152, winH/648)`(최소 0.01), `canvasW = round(winW/factor)`, `canvasH = round(winH/factor)`, `cssW = winW`, `cssH = winH`, `viewW = canvasW/ART`, `viewH = canvasH/ART`. `computeScale`는 지운다.
- Produces (`hud.js`): `HUD_INSET = 88`(CSS px, `HUD_HEIGHT` 대신), `createHud({ onCodex, onTasks, avatar }) -> { el, update(state, chapter), codexButton, tasksButton }`.
- Produces (`render.js`): `cameraFor(map, pos, view = { w: BASE_W, h: BASE_H }, insetTop = 0) -> { x, y }` — x는 지금 식에 `view.w`. y: 맵 높이 `mapPx ≤ view.h − insetTop`이면 `(mapPx − view.h − insetTop) / 2`(HUD 아래 영역의 가운데), 아니면 `heroC − (view.h + insetTop) / 2`를 `[−insetTop, mapPx − view.h]`로 자른다. `drawExplore`·`animKey`의 view 객체에 `view: { w, h }`를 더하고 `BASE_W`·`BASE_H`를 쓰던 곳(타일 범위, 화살표, inView)은 모두 `view`를 쓴다. `inViewWorld(camera, view, p) -> boolean`을 export(Task 9가 반짝임 안내에 씀).
- 탐험 장면: 캔버스 내부 `canvasW×canvasH`, CSS `100vw×100vh`(fixed inset 0), `factor === 1`이면 `pixelated` 아니면 `auto`. `insetTop = HUD_INSET / (factor·ART)`. 맵 밖은 지금처럼 `#2F6B3A`. `?test=1`이면 그릴 때마다 `window.__test.view = { camera, factor, viewW, viewH, insetTop }`.
- HUD(`.hud`, 위 88px 안, 캔버스 위 HTML 층): 왼쪽 `.medallion` ⌀96 (12,8) — 안에 `bustFor('hero_'+avatar,'base')`를 `setArt`로 넣어 얼굴만 보이게(`object-fit: cover; object-position: 50% 14%; transform: scale(2.2)` 정도, 원으로 자름), 그림이 없으면 이름 첫 글자 블록 — + `.hud-task.frame-scroll` 최대 420×60(메달 오른쪽에 물림, 초록 점 + 할 일 20px, 넘치면 말줄임, `flex: 1 1 auto; min-width: 160px`). 오른쪽 `.hud-words.frame-plate`(`.hud-count` "이 장의 낱말 n/5" + `.hud-bag` 48×48 칸 셋: 물건은 `ASSETS.items[id]`를 32px로 `setArt`, 없으면 지금 글자 블록, 빈칸 점선) + `.btn-icon.hud-button` 둘(도감: `.icon-book` + "도감" + `.key-badge` E, `aria-label="도감 (E)"` / 할 일: `.icon-scroll` + "할 일" + Q), 사이 8, 오른쪽 여백 12. 마우스로 누른 뒤 초점을 빼는 지금 동작은 그대로.
- 터치 단추(`pointer: coarse`)는 같은 나무 틀(`.btn-wood` 면)로, 크기·자리는 지금 그대로.

- [ ] **Step 1: 실패하는 검사**
  - `tests/grid.test.mjs`: `computeView(1366, 768)` → `{ factor: 1, canvasW: 1366, canvasH: 768, cssW: 1366, cssH: 768, viewW: 1366/3, viewH: 256 }`; `computeView(1024, 768)` → factor `1024/1152`, canvas 1152×864, view 384×288; `computeView(1920, 1080)` → factor 1, canvas 1920×1080(키우지 않고 더 보인다).
  - `tests/render.test.mjs`: 32×24 맵, view `{ w: 1366/3, h: 256 }`, inset `88/3`: 주인공 (16,12)이면 y = `200 − (256 + 88/3)/2`; 주인공 (16,0)이면 y = `−88/3`; 20×10 맵이면 y = `(160 − 256 − 88/3)/2`. 기본 인자만 쓰는 지금 검사는 그대로 통과.
  - `tests/e2e/explore.test.mjs`: 캔버스 검사를 `1366×768 → { w: 1366, h: 768, cssW: 1366, cssH: 768, rendering: 'pixelated' }`, `1024×768 → { w: 1152, h: 864, cssW: 1024, cssH: 768, rendering: 'auto' }`로 바꾼다. 새 검사 `창 크기`(Review Focus 2): 1366×768에서 시작 → 1280×800 → 1366×650 → 1024×768로 바꿀 때마다 캔버스 CSS 크기 = 창 크기, `scrollWidth ≤ innerWidth`, `__test.view`로 구한 주인공 칸 위끝이 화면 y ≥ 88. `teleportTo('dodam')`(맵 위쪽) 뒤에도 같은 조건. 새 검사 `HUD 겹침`(Review Focus 3): 1024×768, 닉네임 `가나다라마바`, 1-2 장(`nextChapter()`)의 "마른 나무에서 장작 모으기"에서 `.hud-task`와 `.hud-words` 상자가 겹치지 않고 HUD 단추는 72×80.
  - `tests/e2e/images.test.mjs`: `sample()`이 `384`와 `cameraFor`를 직접 쓰지 않고 `__test.view`의 `camera`·`factor`로 캔버스 좌표를 구한다. 가방 칸: 물동이를 얻으면 `.hud-bag img`의 src가 `icon_water.png`, `items.water`를 404로 바꾸면 글자 블록.
- [ ] **Step 2: 실패 확인** — Run: `npm test && node --test tests/e2e/explore.test.mjs tests/e2e/images.test.mjs` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 Interfaces대로. `fit()`은 `computeView(innerWidth, innerHeight)`로 캔버스 크기를 바꾸고 `size++`(지금처럼 다시 그리기).
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS(다시 그리지 않기·미끄러짐 검사 포함)
- [ ] **Step 5: Commit** — `git commit -m "feat: full-bleed explore canvas and carved HUD with medallion, scroll and icon buttons"`

---

### Task 6: 대화·뜻풀이 카드·도감·할 일 창

**모델:** sonnet, medium

**Files:**
- Modify: `js/scenes/dialogue.js`, `js/ui/meaning-card.js`, `js/scenes/codex.js`, `js/scenes/quests.js`, `css/game.css`(대화·카드·겹침 창 절)
- Create: `js/ui/ink.js`
- Test: `tests/ink.test.mjs`, `tests/e2e/art-layout.test.mjs`, `tests/e2e/dialogue.test.mjs`, `tests/e2e/overlays.test.mjs`

**Interfaces:**
- Produces: `ribbonInk(hex) -> '#2B2622' | '#FFFFFF'` (`js/ui/ink.js`) — 상대 휘도 0.45 초과면 먹색, 아니면 흰색(먹색 윤곽). 리본 `--speaker-ink`로 쓴다.
- 대화: `.dialogue-box.frame-dialogue` 좌우 24(폭 1318), 높이 200, 아래 16, 안쪽 여백 32/40, `.dialogue-text` 28px 줄 간격 1.6. `.name-tag.ribbon` 최소 200×52, 상자 위 테에 걸쳐(리본 세로 가운데 ≈ 상자 위끝), 주인공이면 왼쪽 x 56, 인물이면 오른쪽 56, 색은 말하는 인물 대표색(주인공 `#3B5BA5`), 글자는 주아 24 + `ribbonInk`. `data-side`·`.name-tag` 클래스 유지. `▼`(`.dialogue-arrow`)는 놋쇠색 삼각형, 1초 주기 4px 오르내림, 움직임 줄이기면 멈춤. 두 상반신 높이 620, 듣는 쪽 `brightness(.62) saturate(.7)`, 해설 줄 가운데 정렬은 그대로.
- 뜻풀이 카드: `.word-card.frame-panel` 가운데, 뒤 어둡게. "새 낱말을 찾았다!" 주아 28 · 낱말 주아 40(아래 40% 금빛 띠) · 뜻 22 · 예문 20 · `확인`(`.btn-green`, 160×64 이상). 카드 바깥 3px 금빛 테두리(새 낱말). `openMeaningCard`가 돌려주는 객체에 `okButton`을 더한다(Task 9가 안내를 붙임).
- **낱말이 빛을 되찾는 연출 (선생님 피드백 2026-11-04: "단어가 밝아졌다는데 곧장 체감할 수 없어. 대화씬 중간에 해금된 단어가 회색빛에서 밝게 빛나는 이펙트, 뜻도 함께")**:
  1. 대화 글줄에서 `[[낱말]]`이 타자로 찍힐 때 그 낱말은 먼저 잿빛(채도 0, `#8A8A8A`, 살짝 흐림)으로 찍힌다. 줄이 다 찍히면 0.6초 동안 잿빛 → 말빛 금색 `#F2C14E`으로 바뀌며 빛 번짐(`text-shadow`)과 빛 알갱이 몇 개가 위로 흩어진다(아트 바이블 원칙 1: 말이 살아나는 순간에만 빛).
  2. 이어서 뜻풀이 카드가 열릴 때 카드 안의 낱말도 같은 잿빛 → 금빛 연출을 0.8초 동안 한 번 더 하고, 뜻 줄은 낱말이 빛난 뒤 아래에서 떠오르듯 나타난다(뜻이 낱말과 함께 바로 보이게).
  3. 연출 중에도 `확인`은 누를 수 있다(지금의 300ms 키 연타 막기는 그대로). 움직임 줄이기(`prefers-reduced-motion`)에서는 바로 금빛으로, 흩어지는 알갱이 없음.
  4. 검사: `dialogue` e2e — `[[어스름]]` 줄에서 낱말 span이 처음엔 `.word-dim`, 줄이 끝난 뒤 `.word-lit`(계산된 색 rgb(242, 193, 78))가 된다. 카드의 낱말도 `.word-lit`로 끝나고 뜻 글줄이 보인다. 움직임 줄이기 에뮬레이션에서는 처음부터 `.word-lit`.
- 도감: `.overlay-panel.frame-panel`, 제목 명판, 닫기 `.btn-wood`, 막 탭 `.codex-tab.btn-wood.btn-sm`(고른 탭 `.on`은 `.btn-green` 면), 칸 `.codex-card.frame-card`(찾음: 주아 24 낱말 / 못 찾음: `.coin` 안 "?" + "아직 못 찾음" 18), 고른 칸은 `--brass-light` 3px 테두리(금빛 아님), 상세 `.frame-plate`. 할 일: `.task-row.frame-plate`, 완료는 초록 테두리 + `.icon-check` + "완료".

- [ ] **Step 1: 실패하는 검사** — `tests/ink.test.mjs`: `ribbonInk('#3B5BA5') === '#FFFFFF'`, `ribbonInk('#C9A97E') === '#FFFFFF'`(빨래터 아주머니, 휘도 약 0.42), `ribbonInk('#EDE6D6') === '#2B2622'`(빵집 아저씨), `ribbonInk('#A9C9D6') === '#2B2622'`(나래). `art-layout` 대화 검사: 상자 폭 1318±1, 높이 200±1, 아래 틈 16±1, `.dialogue-text` 글자 28px, 리본이 상자 위끝에 걸침(`tag.y < box.y < tag.y + tag.height`), 주인공 줄은 리본이 왼쪽 절반. `dialogue.test`: 1-2의 "빨래터 아주머니" 줄에서 리본 `scrollWidth ≤ clientWidth`, 리본 글자색 `rgb(255, 255, 255)`, 빵집 아저씨 줄은 `rgb(43, 38, 34)`. `overlays.test`: 도감·할 일의 모든 단추·탭·칸이 48px 이상, 찾은 칸 글자 ≥ 18px, 완료 줄에 "완료" 글자와 체크.
- [ ] **Step 2: 실패 확인** — Run: `npm test && node --test tests/e2e/art-layout.test.mjs tests/e2e/dialogue.test.mjs tests/e2e/overlays.test.mjs` / Expected: FAIL
- [ ] **Step 3: 구현** — 위대로. 클래스 이름(`.dialogue-box`, `.name-tag`, `.word-card`, `.codex-card.found|unknown`, `.task-row`)은 남기고 부품 클래스를 더한다.
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: carved dialogue box with speaker ribbon, meaning card and codex/tasks panels"`

---

### Task 7: 전투·게임 오버·클리어 화면

**모델:** sonnet, high

**Files:**
- Modify: `js/ui/battle-layout.js`, `js/scenes/battle.js`, `js/scenes/gameover.js`, `js/scenes/clear.js`, `css/game.css`(전투·끝 화면 절)
- Create: `tests/e2e/a11y.test.mjs`(화면을 모두 다시 만든 뒤의 접근성 훑기)
- Test: `tests/e2e/art-layout.test.mjs`, `tests/e2e/battle.test.mjs`, `tests/e2e/images.test.mjs`, `tests/e2e/a11y.test.mjs`
- Modify: `js/ui/battle-fx.js`(공격 연출 개선, 아래)

**공격 연출 개선 (선생님 피드백 2026-11-04: "공격 이펙트도 개선해야")**: 지금의 빛줄기·흔들림·알갱이는 약하다. 정답 한 번마다 0.8초(`HIT_MS` ≤ 800) 안에 다음이 차례로 보이게 한다.
1. 주인공 쪽: 말빛 주머니에서 낱말 글자(맞힌 낱말)가 금빛으로 떠올라 몬스터 쪽으로 날아간다(곡선, 꼬리 빛 줄).
2. 맞는 순간: 몬스터 위치에 금빛 원형 파동 1개 + 빛 알갱이 12~16개 사방으로, 몬스터 흔들림(±12px), 화면 짧은 흔들림(±4px, 120ms), 몬스터 HP 칸 하나가 깨지듯 사라지며 금 조각 몇 개.
3. 연속 정답(streak ≥ 3)이면 파동이 2겹, 알갱이 수 1.5배.
4. 마지막 일격: 몬스터가 잿빛 안개 조각으로 흩어지고 그 자리에 빛이 퍼진다(구해 내는 느낌, 원칙 3: 무섭지 않게).
5. 틀렸을 때(보스전): 안개가 주인공 쪽으로 조여 오고 하트 하나가 금 가며 흔들린다(지금 것 유지·다듬기). 복습전은 하트가 줄지 않으므로 몬스터가 살짝 웃듯 흔들리기만.
6. 움직임 줄이기: 날아가기·흔들림·화면 흔들림 없이 서서히 나타나고 흐려지기만.
검사: `battle-fx` 단위 검사(움직임 줄이기에서 흔들림 프레임 없음, 모든 애니메이션 길이 ≤ 800ms, streak 3에서 파동 2겹), e2e는 정답 뒤 `.fx-word-fly`와 `.fx-ring`이 생겼다가 800ms 안에 지워진다.

**Interfaces:**
- Consumes: 부품 클래스(Task 3)
- Produces: `markOptions(buttons, picked, answer)` — 지금 동작 + 고른 보기 `.picked`, 맞혔으면 그 보기에 `<span class="opt-say">맞았어!</span>`(주아 20). 보기 상태 CSS: 기본 `.frame-card`, 고름 `.picked` 놋쇠 밝게 + 1px 위, 잠김 `[aria-disabled=true]`(누름 효과 없음), 정답 `.right` 금빛 3px 테두리 + ○(먹색 윤곽), 오답 `.wrong` 면을 잿빛 `#B9BBBE` 쪽으로 섞고 ×와 글자 `#5E6266`.
- Produces: `buildFrame(...)`이 만드는 것에 `tail`(말풍선 꼬리)을 더하고, `layoutTail(f)`가 몬스터 상자 가운데 x에 꼬리를 놓는다(`--tail-x`, 묶음 기준 px, 창 크기 바뀌면 다시).
- 배치(1366×768, README 그대로): 무대는 남은 높이 전부. 몬스터 명판 `.battle-mhp.frame-plate` 440×56, 위 12·오른쪽 24, 이름 주아 22 + HP 칸 6개(`.hp-cell` 32×20, 그림 `hpCell`, 잃은 칸 `.lost`는 점선 빈칸). 주인공 명판 `.battle-status.frame-plate` 300×52, 묶음 위 8·왼쪽 24, 닉네임 + 하트 5개(`.heart.full|.empty` 32px, 그림 `heartFull`/`heartEmpty`, 그림이 없으면 지금 ♥/♡ 글자; 컨테이너 `aria-label="하트 n개"`). 복습전은 하트 대신 지금처럼 "연습" 표, HP 대신 "남은 빛 n/3". 문제 말풍선 `.battle-question.frame-panel` 폭 1318, 최소 높이 100, 글자 28, 왼쪽 위 몬스터 이름 표(나무 명판), 오른쪽 위 유형 표(`--tag-green`, 흰 글자 + 먹색 윤곽). 보기는 묶음 안 간격 12: 빈칸 채우기 4칸 높이 110(낱말 주아 32), 뜻 고르기 2×2 높이 72(24), 문장 고르기 1열 4줄 높이 48(22). 번호는 `.coin` 40px.
- 세 층: 무대(빛줄기·안개 효과 포함) < 묶음 < 오답 풀이·안내. 연출 시간·숫자키·방향키·한 번만 누르기는 그대로.
- 게임 오버: `.end-panel.frame-panel`, 제목 주아 36 "안개에 휩싸였다…", `도감 다시 보기`(`.btn-wood`), `다시 도전`(`.btn-green`, 처음 초점). 클리어: 같은 패널, 낱말 카드 `.clear-card.frame-card`(낱말에 금빛 띠), 단추 `.btn-green`. 지금의 처음 전투 규칙 카드(`tipCard`)는 이 Task에서는 모양만 `.frame-panel`로 둔다(Task 9가 바꾼다).

- [ ] **Step 1: 실패하는 검사** — `art-layout` 보스전(f·m): 지금 조건(주인공 614±8, 몬스터 380±8, 보기 안 가림, 무대 잿빛) + 몬스터 명판 위 12±2·오른쪽 끝 1342±2, 주인공 명판 아래끝 = 묶음 위끝 − 8±2, 꼬리 가운데 x가 몬스터 상자 가운데 x ±24. `battle.test`의 "12±2px" 검사에 유형별 보기 높이 110/72/48 ±2를 더한다. 새 검사 `맞히면 고른 보기에 "맞았어!"와 ○, 틀리면 × 보기와 정답 보기 .right`. `게임 오버: 다시 도전에 초점, 두 단추 48px 이상`. `images.test` 전투 대체 검사는 그대로 통과. `tests/e2e/a11y.test.mjs` — 1366×768에서 타이틀, 모습 고르기, 이어하기, 탐험(HUD), 대화, 뜻풀이 카드, 도감, 할 일, 복습전, 보스전(세 유형), 오답 풀이, 게임 오버, 클리어를 차례로 열고 화면마다: 보이는 글자가 있는 요소의 `font-size ≥ 18px`(키 배지·번호 동전 포함), 보이는 `button`·`[role=button]`·`[role=radio]`·`[role=tab]`의 상자가 48×48 이상, Tab으로 초점을 옮긴 요소의 `outline`이 `3px solid rgb(59, 91, 165)`. 같은 훑기를 `assets/ui/**`를 막은 채 한 번 더(대체 모습도 지킨다).
- [ ] **Step 2: 실패 확인** — Run: `node --test tests/e2e/art-layout.test.mjs tests/e2e/battle.test.mjs` / Expected: FAIL
- [ ] **Step 3: 구현** — 위대로.
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: battle plates, speech-bubble question, option card states, game over and clear panels"`

---

### Task 8: 안내 규칙(순수 함수)

**모델:** sonnet, medium

**Files:**
- Create: `js/rules/tutorial.js`
- Test: `tests/tutorial.test.mjs`, `tests/save.test.mjs`

**Interfaces:**
- Consumes: `hiddenGlow`(`js/rules/quests.js`)
- Produces:
  - `TIP = { MOVE: 'move', FIRST_NPC: 'first-npc', TALK: 'talk', DIALOGUE: 'dialogue', WORD: 'tip-word', CODEX: 'codex', QUEST: 'quest', SPARKLE: 'sparkle', REVIEW: 'tip-review', BOSS: 'tip-boss' }` — 옛 id 다섯 개는 그대로 써서 옛 저장이 본 안내를 다시 띄우지 않는다. `FIRST_NPC`는 캔버스 화살표(말풍선 아님)용.
  - `HINT_MS = 8000`
  - `hintText(id, { touch = false } = {}) -> string` — 줄바꿈은 `\n`.
  - `dueHint(state, chapter, event, { touch = false } = {}) -> Hint | null`, `Hint = { id, text, anchor, until, ms }`. 표시 기록(`markTip`)은 하지 않는다(부르는 쪽이 띄울 때 기록).
  - `event`: `{ type: 'explore', facing: 'npc'|'object'|'small'|'boss'|'fog'|null, sparkleInView: boolean }` · `{ type: 'dialogue-line', newWord: boolean }` · `{ type: 'word-card' }` · `{ type: 'battle', mode: 'review'|'boss' }`

| id | event | 조건(모두 `!seen(id)`) | anchor | until | ms | 글(키보드 / 터치) |
|---|---|---|---|---|---|---|
| move | explore | — | hero | move | null | 방향키로 걸어 보세요 / 왼쪽 아래 화살표를 눌러 걸어 보세요 |
| talk | explore | seen(move), facing === 'npc' | hero | talk | 8000 | 사람을 보고 Space를 누르면\n말을 걸 수 있어요 / 사람을 보고 말하기 버튼을 누르면\n말을 걸 수 있어요 |
| quest | explore | seen(move), 이 장 부탁 중 `active`가 있음 | tasks-button | tasks | 8000 | 할 일(Q)을 누르면 할 일이 보여요\n머리 위에 ?가 뜨면 돌아가 알려요 / 할 일 버튼을 누르면 할 일이 보여요\n머리 위에 ?가 뜨면 돌아가 알려요 |
| sparkle | explore | seen(move), `sparkleInView`, `hiddenGlow ≠ 'none'` | sparkle | inspect | 8000 | 반짝이는 곳이 있어요!\n가까이 가서 Space로 살펴봐요 / 반짝이는 곳이 있어요!\n가까이 가서 말하기 버튼을 눌러요 |
| tip-word | dialogue-line | newWord | word | press | null | 반짝이는 낱말을 눌러 보세요 (둘 다) |
| dialogue | dialogue-line | 이 줄에 tip-word가 뜨지 않음 | dialogue-box | press | null | Space를 누르거나 글 상자를 누르면\n다음 말로 넘어가요 / 글 상자를 누르면\n다음 말로 넘어가요 |
| codex | word-card | — | card-ok | confirm | null | 확인을 누르면 도감(E)에 모여요 / 확인을 누르면 도감에 모여요 |
| tip-review | battle(review) | — | options | pick | null | 1~4를 누르거나 보기를 눌러 골라요\n하트는 줄지 않아요. 3번 맞히면 이겨요 / 보기를 눌러 골라요\n하트는 줄지 않아요. 3번 맞히면 이겨요 |
| tip-boss | battle(boss) | — | hearts | pick | null | 하트 5개, 몬스터 HP 6칸이에요\n6번 맞히면 이기고, 져도 다시 도전해요 (둘 다) |

  explore 안의 차례: move → talk → quest → sparkle(하나만 돌려준다).

- [ ] **Step 1: 실패하는 검사** — `tests/tutorial.test.mjs`(1-1 장, `newGame` 상태로):

```js
const ex = (facing = null, sparkleInView = false) => ({ type: 'explore', facing, sparkleInView });
test('처음 탐험: move', () => {
  assert.equal(dueHint(s0, ch, ex()).id, 'move');
  assert.equal(dueHint(s0, ch, ex(), { touch: true }).text, '왼쪽 아래 화살표를 눌러 걸어 보세요');
});
test('move를 본 뒤 인물 앞: talk(8초), 아니면 없음', () => {
  const s = markTip(s0, 'move');
  assert.deepEqual(pick(dueHint(s, ch, ex('npc'))), { id: 'talk', anchor: 'hero', until: 'talk', ms: 8000 });
  assert.equal(dueHint(s, ch, ex('object')), null);
});
test('부탁이 active면 quest, talk보다 뒤', () => { /* q1 active: ex('npc') → talk, markTip(talk) 뒤 → quest, anchor 'tasks-button' */ });
test('반짝임: 주머니를 받은 뒤 화면 안이면 sparkle, 화면 밖이거나 주머니 전이면 없음', () => { /* hiddenGlow none/dim */ });
test('대화: 새 낱말 줄이면 tip-word, 아니면 dialogue, 둘 다 한 번', () => { /* */ });
test('낱말 카드: codex / 전투: tip-review, tip-boss', () => { /* anchor options / hearts, until pick */ });
test('본 안내는 다시 나오지 않는다(모든 id)', () => { /* 모든 TIP를 markTip한 상태 → 모든 event에서 null */ });
test('옛 저장(seenTips 옛 id 다섯)이면 새 안내만', () => {
  const old = { ...s0, seenTips: ['move', 'first-npc', 'tip-word', 'tip-boss', 'tip-review'] };
  assert.equal(dueHint(old, ch, ex('npc')).id, 'talk');
  assert.equal(dueHint(old, ch, { type: 'battle', mode: 'boss' }), null);
  assert.equal(dueHint(old, ch, { type: 'dialogue-line', newWord: true }).id, 'dialogue');
});
test('글: id가 서로 다르고, 줄마다 30자 이하, 두 줄까지, 키보드·터치 모두 있음', () => { /* */ });
```

  `tests/save.test.mjs`: `옛 seenTips(옛 id만)인 version 1 저장도 그대로 불러온다`.
- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL(`js/rules/tutorial.js` 없음)
- [ ] **Step 3: 구현** — 표대로. 글은 표의 문장 그대로.
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: tutorial hint rules with one table of tip ids and texts"`

---

### Task 9: 안내 말풍선과 장면 연결, 첫 몇 분 화면 검사

**모델:** sonnet, high

**Files:**
- Create: `js/ui/hint.js`, `tests/hint.test.mjs`, `tests/e2e/tutorial.test.mjs`
- Modify: `js/scenes/explore.js`(옛 `.explore-tip`·`TIP_*` 상수 삭제), `js/scenes/dialogue.js`(옛 `maybeTip`·`.word-tip`·`TIP_WORD` 삭제), `js/scenes/battle.js`(규칙 카드와 `intro` 기다림 삭제, `TIP_*` 삭제), `js/ui/battle-layout.js`(`tipCard` 삭제), `css/ui-kit.css`(`.hint`), `tests/e2e/explore.test.mjs`, `tests/e2e/dialogue.test.mjs`, `tests/e2e/battle.test.mjs`, `tests/e2e/act1.test.mjs`, `tests/e2e/art-layout.test.mjs`, `tests/e2e/capture-screenshots.mjs`
- Test: `tests/hint.test.mjs`, `tests/e2e/tutorial.test.mjs`

**Interfaces:**
- Consumes: `TIP`, `dueHint`, `HINT_MS`(Task 8), `markTip`, `isCoarsePointer`, `inViewWorld`(Task 5), `openMeaningCard(...).okButton`(Task 6)
- Produces:
  - `placeHint(anchor: {x,y,w,h}, size: {w,h}, box: {w,h}, gap = 12, margin = 16) -> { x, y, place: 'above'|'below', arrowX }` — 앵커 가운데가 `box.h/2`보다 위면 아래에(`y = anchor.y + anchor.h + gap`), 아니면 위에(`y = anchor.y − size.h − gap`). `x = clamp(앵커 가운데 x − size.w/2, margin, box.w − size.w − margin)`, `arrowX = clamp(앵커 가운데 x − x, 16, size.w − 16)`.
  - `createHintLayer(container) -> { show(hint, anchor: Element | (() => {x,y,w,h} | null)), done(reason) -> boolean, reposition(), clear(), current: Hint | null }` — 한 번에 하나(새 show는 앞 것을 바꿈). `done(reason)`은 `current.until === reason`일 때만 닫는다. `hint.ms`가 있으면 그 뒤 스스로 닫힌다. 요소: `<div class="hint" role="status" aria-live="polite" data-tip="<id>" data-place="above|below">`, 글은 `\n`마다 줄, 고운돋움 20px, 최대 폭 420, `.frame-plate` 그림 + CSS 꼬리(`--arrow-x`), `pointer-events: none`, 나타나기 180ms(움직임 줄이기면 서서히만). `?test=1`이면 show마다 `(window.__test.hints ??= []).push({ id, scene })`(새로 고침하면 빈 목록에서 다시 시작).
- 장면 연결(띄울 때 `ctx.setState(markTip(state, id))` 후 저장은 지금처럼 장면 전환·카드 확인 때):
  - 탐험: mount 뒤와 매 `update` 뒤, 겹침 창이 닫혀 있으면 `dueHint(state, chapter, { type: 'explore', facing: facingTarget(...)?.kind ?? null, sparkleInView })`. `sparkleInView = inViewWorld(camera, view, 숨은 낱말 칸)`. 같은 id가 이미 떠 있으면 다시 띄우지 않는다. 앵커: `hero`·`sparkle`은 `__test.view`와 같은 식(세계 → CSS px)의 함수, `tasks-button`은 `hud.tasksButton`. `move()` → `done('move')`, 인물에게 `act()` → `done('talk')`, 물건 `act()` → `done('inspect')`, 할 일 열기 → `done('tasks')`, 겹침 창 열기·장면 떠나기 → `clear()`. 그릴 때마다 `reposition()`. 첫 부탁 인물 화살표(`TIP.FIRST_NPC`)는 지금 그대로.
  - 대화: `showLine` 때 `{ type: 'dialogue-line', newWord }`(앵커 `word`는 첫 `.hl.new`, `dialogue-box`는 상자), `press()` → `done('press')`. 카드가 열리면 `{ type: 'word-card' }`(앵커 `okButton`, 층은 카드 겹침 위), 카드 닫힘 → `done('confirm')`.
  - 전투: 첫 `ask()` 때 `{ type: 'battle', mode }`(앵커 `options`는 보기 묶음, `hearts`는 주인공 명판), `pick()` → `done('pick')`. 규칙 카드가 없어지므로 첫 문제가 바로 나온다(`data-phase`는 처음부터 `ask`).
  - 터치 문구: `{ touch: isCoarsePointer() }`.

- [ ] **Step 1: 실패하는 검사**
  - `tests/hint.test.mjs`: `placeHint({x:100,y:50,w:40,h:40}, {w:300,h:80}, {w:1366,h:768})` → `{ x: 16, y: 102, place: 'below', arrowX: 104 }`; 앵커가 아래 절반이면 `place: 'above'`, `y = anchor.y − 92`; 오른쪽 끝 앵커면 `x = 1366 − 300 − 16`, `arrowX ≤ 284`.
  - `tests/e2e/tutorial.test.mjs`:
    - `키보드: 첫 몇 분 동안 안내가 하나씩 한 번만` — `startFromTitle` → 처음 이야기에서 `.hint[data-tip="dialogue"]`(글에 "Space") → Space 뒤 사라짐 → 탐험 `move` → `pathTo`로 도담 할머니 앞까지 걸어 바라봄 → `talk` → Space로 대화(`dialogue`는 다시 안 뜸) → 탐험 `quest`(말풍선 상자가 할 일 단추와 200px 안) → 우물 조사 → 할머니에게 돌아가 완료 대화에서 `tip-word` → 카드에 `codex`(말풍선이 확인 단추 위) → 확인 → `teleportTo('장독대')`로 `sparkle` → `__test.startBattle('review', 7)` `tip-review`(보기 묶음 위), 하나 고르면 사라짐 → `startBattle('boss', 7)` `tip-boss`. 끝에 `__test.hints`의 id가 `dialogue, move, talk, quest, tip-word, codex, sparkle, tip-review, tip-boss`를 **정확히 한 번씩** 담고, 대화를 다시 열고 탐험·전투를 한 번 더 열어도 늘지 않는다. 새로 고침 → 이어하기 → 탐험·대화에서 `__test.hints`가 비어 있다. `state().seenTips`가 아홉 id를 담는다.
    - `터치(hasTouch, isMobile, 1024×768): move 글에 "화살표", talk 글에 "말하기 버튼"`.
    - `안내가 떠 있어도 HUD 단추를 누를 수 있고, 도감을 열면 안내가 사라진다`(Review Focus 4): `move` 안내가 뜬 채 도감 단추 가운데를 마우스로 누르면 `.codex`가 열리고 `.hint`가 0개, 닫고 전투로 넘어가도 `.hint`가 남지 않음, 오류 없음.
    - `옛 저장으로 이어하기`(Review Focus 5): localStorage에 `seenTips: ['move','first-npc','tip-word','tip-boss','tip-review']`인 version 1 저장을 넣고 이어하기 → `move` 안 뜸, 인물 앞에서 `talk` 뜸, 보스전에서 안내 없음.
  - 옛 선택자 고치기: `explore.test`의 `.explore-tip` → `.hint[data-tip="move"]`(글 "방향키로 걸어 보세요"), `dialogue.test`의 `.word-tip` → `.hint[data-tip="tip-word"]`, `battle.test`의 규칙 카드 검사 → "첫 보스전에 `tip-boss` 안내가 한 번, 두 번째 보스전엔 없음", 그 밖의 `.battle-tip button` 누르기는 지운다.
- [ ] **Step 2: 실패 확인** — Run: `npm test && node --test tests/e2e/tutorial.test.mjs` / Expected: FAIL
- [ ] **Step 3: 구현** — 위대로.
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: one-time contextual hint callouts in explore, dialogue and battle"`

---

### Task 10: 길잡이(지금 할 일 알려 주기)와 숨은 낱말 빛무리

**모델:** sonnet, high

**선생님 피드백 (2026-11-04)**: "다온은 길을 막은 몬스터를 처치해 달라고 해. 몬스터를 처치하고 나면 바로 지나가 버리며 다온과 다시 대화를 하지 않을 것 같아. 그냥 지나가려고 하면 힌트를 주자. 누구와 대화를 해야 하는지, 어디서 무엇을 찾아야 하는지. 단어가 숨겨진 곳을 이따금씩 빛무리로 표시해 주면 도움이 될 것 같아."

**Files:**
- Create: `js/rules/guide.js`(순수 함수), `tests/guide.test.mjs`, `tests/e2e/guide.test.mjs`
- Modify: `js/scenes/explore.js`, `js/explore/render.js`, `js/scenes/battle.js`(작은 몬스터를 이긴 뒤 돌아갈 때), `js/ui/hint.js`(Task 9의 말풍선을 길잡이에도 씀)

**Interfaces:**
- Consumes: `currentTask`, `npcMarker`, `hiddenGlow`, `questList`(`js/rules/quests.js`), `inViewWorld`(Task 5), 안내 말풍선 `showHint(layer, { text, anchor })`(Task 9).
- Produces (`js/rules/guide.js`):
  - `nextGoal(state, chapter) -> { kind: 'talk'|'find'|'fight'|'hidden'|'boss'|'none', npcId?, objectSlot?, text }` — 지금 해야 할 한 가지. 우선순위: (1) 물건을 들었거나 작은 몬스터를 이겨 **끝내러 돌아갈 부탁**(stage `ready`)의 주는 인물에게 말 걸기 → (2) 받은 부탁의 대상(조사할 곳·전할 사람·쫓을 몬스터) → (3) 아직 받지 않은 부탁의 주는 인물 → (4) 부탁을 다 끝냈고 숨은 낱말이 남았으면 숨은 곳 → (5) 장 보스/다음 장. `text`는 6학년 쉬운 말, 25자 이하, 인물·장소 이름을 넣는다(예: "다온에게 돌아가 알려 주자", "우물에서 물을 길어 오자", "반짝이는 곳을 찾아 조사해 보자").
  - `leavingTooSoon(state, chapter, fromPos, toPos, map) -> boolean` — 아직 `ready` 부탁이 있는데 그 주는 인물에게서 멀어지는 쪽으로, 장 출구·안개 문·막힌 골목 너머로 넘어가려는 걸음이면 true.
- [ ] **Step 1: 실패하는 단위 검사** — `tests/guide.test.mjs`: 1-1 시작 → talk dodam; 물동이를 든 뒤 → talk dodam("돌아가"); 꼬마 안개를 이긴 직후(q2 `ready`) → talk daon("다온에게 돌아가 알려 주자"); 부탁을 다 끝내고 숨은 낱말 남음 → hidden; 모두 끝 → boss. `leavingTooSoon`: q2 `ready`에서 골목 너머 빈터로 들어가는 걸음 → true, 다온 쪽 걸음 → false, `ready` 없음 → false.
- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현과 연결**
  1. **이긴 직후 한마디**: 작은 몬스터를 이기고 탐험으로 돌아오면 바로 길잡이 말풍선 "다온에게 돌아가 알려 주자"를 주인공 머리 위에 3초 띄우고, 다온 머리 위 표시를 금빛 ! 로 깜박인다.
  2. **그냥 지나가려 할 때**: `leavingTooSoon`이 true인 걸음은 막지 않고(학생이 자유롭게 걸을 수 있게) 길잡이 말풍선을 띄운다. 같은 말은 20초 안에 다시 띄우지 않는다.
  3. **오래 헤맬 때**: 30초 동안 할 일이 진전되지 않으면(말 걸기·조사·전투 없음) `nextGoal`의 말풍선을 띄우고, 화면 가장자리 화살표(지금의 첫 인물 화살표를 일반화)로 대상 쪽을 가리킨다. 학생이 움직이거나 대상에 닿으면 사라진다.
  4. **할 일 창(Q)과 HUD 두루마리**는 늘 `nextGoal().text`를 보여 준다(HUD 두루마리 글이 지금의 부탁 제목 대신 "지금 할 일"이 됨).
  5. **숨은 낱말 빛무리**: 숨은 낱말이 있는 물건(주머니를 받은 뒤, 아직 못 찾았을 때)에 6초마다 1.2초 동안 둥근 빛무리(물건 칸보다 1.5배, 말빛 금색 #F2C14E 반투명, 가운데서 퍼졌다 사라짐)와 빛 알갱이 3~4개가 떠오른다. 부탁을 다 끝낸 뒤(`hiddenGlow` 'bright')에는 3초마다. 지금의 1픽셀 반짝임은 이것으로 바꾼다. 움직임 줄이기에서는 퍼지는 대신 1.2초 동안 은은히 밝아졌다 어두워지기만.
  6. 길잡이 말풍선은 안내(Task 9)와 같은 모양을 쓰되 저장의 `seenTips`에 넣지 않는다(언제든 다시 뜰 수 있는 도움말).
- [ ] **Step 4: 화면 검사** — `tests/e2e/guide.test.mjs`: (a) 꼬마 안개를 이기고 돌아오면 "다온에게" 말풍선이 보인다; (b) 다온에게 가지 않고 빈터 쪽으로 걸으면 길잡이 말풍선이 뜨지만 걸음은 막히지 않는다; (c) `__test`로 시계를 30초 넘기면 길잡이와 가장자리 화살표가 뜬다; (d) 숨은 곳 빛무리가 6초 주기로 그려진다(`animKey`에 빛무리 단계가 들어가 그 동안만 다시 그림, 나머지 때는 "바뀐 것이 없으면 다시 그리지 않는다" 검사 그대로 통과).
- [ ] **Step 5: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS
- [ ] **Step 6: Commit** — `git commit -m "feat: guide hints for what to do next and a light halo on hidden words"`

---

### Task 11: 화면 사진, 용량, 배포

**모델:** sonnet, low

**Files:**
- Modify: `tests/e2e/capture-screenshots.mjs`, `docs/screenshots/act1/*`(전부 새로), `design/art/ui-concepts/README.md`("다음 순서"에 구현 완료 한 줄), 이 계획의 "크레딧 기록"
- Test: 전체

- [ ] **Step 1: 사진 도구 고치기** — 찍는 화면: `01-title`, `02-select`, `03-explore-1-1`(첫 `move` 안내가 뜬 모습), `04-explore-1-2`, `05-dialogue-1-1-dodam`, `06-dialogue-1-2-baker`, `07-meaning-card`(`codex` 안내 포함), `08-review-battle`, `09-boss-battle-blank|meaning|usage`, `10-gameover`, `11-act-clear`, `12-codex`. 크기는 지금처럼 1366×768과 1024×768@2x, JPEG 85. 찍기 전에 `docs/screenshots/act1/`의 옛 파일을 지운다.
- [ ] **Step 2: 찍기와 보기** — Run: `node tests/e2e/capture-screenshots.mjs` / Expected: 34장. 한 장씩 열어 시안 다섯 장과 나란히 보고 확인: 한지색 여백 없음, 글자가 그림 위에 바로 놓이지 않음, 틀 이음매 끊김 없음, 금빛은 낱말·정답에만.
- [ ] **Step 3: 전체 검사** — Run: `npm test && npm run test:e2e` / Expected: PASS, `# first load` ≤ 3.00 MB, 장마다 ≤ 6.00 MB(숫자를 커밋 메시지에 적는다).
- [ ] **Step 4: Commit** — `git add docs/screenshots/act1 tests/e2e/capture-screenshots.mjs design/art/ui-concepts/README.md docs/superpowers/plans/2026-11-04-ui-overhaul-tutorial.md && git commit -m "docs: act 1 screenshots with the new UI (1366x768, 1024x768@2x)"`
- [ ] **Step 5: 배포** — 선생님(사용자)의 push 허락을 받은 뒤 `git push origin claude/gracious-thompson-8cti4h`. `pages` 워크플로가 끝나면 `https://989-alt.github.io/woorimal-rpg/`과 `…/assets/ui/frame_panel.v1.png`, `…/assets/fonts/gowun-dodum.v1.woff2`가 200인지 확인하고, 주소를 선생님께 알린다.

---

## 크레딧 기록

| 부품 | 생성 수 | 크레딧 |
|---|---|---|
| panel (1K 투명 + ref) | 1 | 6 |
| dialogue | 1 | 6 |
| scroll (1번째는 바둑판을 그려 넣은 불투명이라 다시 만듦) | 2 | 12 |
| card | 1 | 6 |
| medallion | 1 | 6 |
| btn_green (바둑판을 그려 넣은 불투명 → 가장자리에서 이어진 회색을 지워 씀) | 1 | 6 |
| btn_wood | 1 | 6 |
| btn_icon | 1 | 6 |
| ribbon | 1 | 6 |
| icons (한 장에 일곱) | 1 | 6 |
| logo (2K 마젠타 → `sprite-gen cutout` + 마젠타 번짐 빼기) | 1 | 10 |
| 합계 | 12 | **76** (120 이하) |

## 선생님께 알릴 결정 (계획을 쓰며 정한 것)

- **전투 규칙 카드 → 안내 말풍선**: 지금 첫 전투 앞의 "규칙 한 장 + 시작" 카드를 없애고, 첫 문제와 함께 뜨는 말풍선으로 바꾼다(안내 모양을 하나로). 첫 고르기를 하면 사라진다.
- **안내는 띄운 순간 '봤다'로 남긴다**: 8초 뒤 저절로 사라져도 다시 뜨지 않는다. 걷기 안내만 시간 제한 없이 걸을 때까지 남는다.
- **옛 안내 id를 그대로 쓴다**(`move`, `tip-word`, `tip-boss`, `tip-review`): 이미 플레이한 학생에게 같은 안내가 다시 뜨지 않는다. 새 안내(`talk`, `dialogue`, `codex`, `quest`, `sparkle`)는 옛 저장에서도 한 번 뜬다.
- **"Space를 누르거나 눌러서 말 걸기"**: 지도에서 인물을 마우스로 눌러 말 거는 기능은 없으므로, 키보드는 "Space", 터치는 "말하기 버튼"으로 썼다.
- **낱말 카드 안내 자리**: "도감(E)에 모였어요"는 탐험으로 돌아온 뒤가 아니라 첫 뜻풀이 카드의 '확인' 위에 띄운다("확인을 누르면 도감(E)에 모여요").
- **이어하기에서 없는 이름**: 지금은 그냥 새 게임이 시작되지만(모습도 못 고른 채), 이어하기 화면에 모습 카드가 없으므로 "이 이름으로 저장된 게임이 없어요." + "처음부터 하기"로 바꾼다. 저장이 하나도 없으면 타이틀의 이어하기는 누를 수 없다.
- **처음 열 때 3MB의 범위**를 아트 바이블 8절 글대로 "코드·글꼴·UI·타이틀·모습 카드 상반신·1장 도트"로 좁힌다. 지금 검사는 대화·전투 그림까지 세어 넉넉했는데, 글꼴(약 0.4MB)과 UI(약 0.45MB)를 더하면 그 방식으로는 3MB를 넘는다.
- **글꼴 상한**: 주아를 버튼·명판·보기 낱말까지 넓혀 쓰고 서브셋을 "data와 js에 나오는 모든 글자"로 잡아 30KB → 120KB, 고운돋움은 KS X 1001 2,350자 + 쓰는 글자로 320KB 이하. 서브셋에 없는 글자(닉네임의 드문 글자)는 시스템 글꼴로 보인다.
- **CLAUDE.md의 "Vercel 배포"는 옛 내용**이다. 실제 배포는 GitHub Pages(`pages.yml`)이다. 이 계획은 CLAUDE.md를 고치지 않는다.
