# 1막 플레이 가능 버전 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 임시 그림으로 1막 「새벽골」(1장 새벽골의 아침, 2장 마을 어귀로)을 시작 화면부터 막 보스전 승리까지 끝까지 플레이할 수 있게 만들고, 그 규칙을 단위 검사와 화면 검사로 고정한다.

**Architecture:** 빌드 없는 정적 웹앱이다. 규칙은 `js/rules/`의 순수 함수(상태 → 새 상태)로 두고 `node --test`로 검사한다. 화면은 `js/scenes/`가 맡고, 상태를 읽고 사용자 동작을 규칙 함수에 넘기기만 한다. 탐험은 384×216 캔버스(정수 배율), 대화·전투·도감은 HTML 층이다. 낱말·대사·부탁·맵·퀴즈는 `data/`에만 둔다.

**Tech Stack:** HTML, CSS, 순수 JS 모듈(ES2022), Node 22 `node --test`, Playwright 1.56.1(화면 검사), Vercel 정적 배포, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-04-woorimal-rpg-design.md`(특히 5절 플레이 흐름) · 화면 규칙: `design/art/art-bible.md` 7·8절 · 시안: `design/art/concepts/ch1/mock/` (`dialogue2.png`, `b3a~c.png`, `explore.png`)

**이 계획에 넣지 않는 것 (다음 계획):** 2~5막 내용, 확정 그림(sprite-gen), 그림을 못 불러올 때 대신 그리기와 그림 규격 자동 검사, 글꼴 직접 올리기·서브셋, 세계 지도, 부탁 구역 색 되살리기 그림, 5막 보스의 '나래' 연출 화면, 엔딩. 이번에는 막 클리어 뒤 "1막 클리어! 다음 막은 준비 중이에요" 화면으로 끝낸다. 단, 보스의 '나래' 마지막 문제 규칙은 순수 함수라 이번에 함께 만든다.

## Global Constraints

- 정적 웹앱, 빌드 단계 없음. 서버·로그인·소리 없음. 외부 런타임 라이브러리 없음(개발용 Playwright만).
- 도트 화면 기준 해상도 384×216, 칸 16px. 배율 `s = max(1, floor(min(vw·dpr/384, vh·dpr/216)))`, CSS 크기 `384·s/dpr`. `image-rendering: pixelated`. 남는 곳은 한지색 `#FBF5E6` 여백.
- 장마다 낱말 5개(부탁 2개 × 2개 + 숨은 낱말 1개), 막마다 10개. 부탁은 차례로 열린다.
- 막 보스전: 하트 5개, 몬스터 HP 6칸. 맞히면 HP −1, 틀리면 하트 −1. 6개 맞히면 승리, 5개 틀리면 게임 오버. 그 막 낱말 10개를 한 번씩. 한 번 보스전에 나온 낱말은 다시 나오지 않는다. 게임 오버 재도전은 같은 10문제를 순서만 섞어 다시 낸다.
- 작은 몬스터 복습전: 뜻 고르기 3개 맞히면 승리, 하트 줄지 않음, 게임 오버 없음. 문제는 `words.js` 뜻풀이로 자동 생성.
- 연속 정답은 연출만 바뀌고 피해는 늘 1칸. 제한 시간 없음.
- 가방은 3칸, 부탁 물건만 들어가고 부탁이 끝나면 사라진다.
- 색: 한지 `#FBF5E6`, 먹 `#2B2622`, 먹갈 테두리 `#5A4636`, 말빛 금 `#F2C14E`, 밝은 금 `#FFE7A3`, 한울 초록 `#5FAE5A`, 다홍 `#E0584F`, 잿빛 `#B9BBBE` / `#8A8D91` / `#5E6266`, 쪽빛 `#3B5BA5`, 자주 `#8E4A7A`. 금색은 글자색으로 쓰지 않는다(형광펜 띠, 테두리만).
- 글꼴: 대사·UI 고운돋움(Gowun Dodum), 제목 주아(Jua). 이번에는 Google Fonts 링크, 막히면 시스템 글꼴. 글자 최소 18px, 대사 26px, 보기 24px, HUD 20px. `word-break: keep-all`.
- 버튼·보기 높이 48px 이상. 정답·오답은 색 + ○/× + 글자. `prefers-reduced-motion`이면 흔들림 없이 서서히 나타나기만.
- 닉네임 1~6글자, 한글 완성형·영문·숫자만. 대사의 `{이름}`, `{이름|아}`, `{이름|이}`, `{이름|은}`, `{이름|을}`은 받침에 맞는 조사로 바꾼다. 영문·숫자 끝은 받침 없음.
- 저장: localStorage, 키 `malbit:save:<닉네임>`, 이름 목록 `malbit:names`, 형식 `version: 1`. 전투 도중 진행은 저장하지 않는다.
- 검사용 도움 기능은 주소에 `?test=1`이 있을 때만 `window.__test`로 드러나고, 화면에는 아무것도 나타나지 않는다.
- 학생이 읽는 글은 6학년 눈높이의 쉬운 한국어. 고유어 뜻은 설계 4절 표를 그대로 쓴다.

## Review Focus

1. **한글 입력 중 엔터**: 닉네임 칸에서 조합 중(`isComposing`)에 엔터를 누르면 마지막 글자가 빠진 이름으로 시작되면 안 된다. → Task 11 단위 검사.
2. **보기 연타·두 번 누르기**: 보기를 빠르게 두 번 누르거나 키 1을 연타해도 한 문제에 답이 한 번만 들어가야 한다. → Task 14 화면 검사.
3. **전투 중 새로 고침**: 보스전·복습전 도중 새로 고침하면 전투 직전 탐험 위치로 돌아오고, 출제 기록은 남지 않고, 다시 다가가면 처음부터 시작해야 한다. → Task 5 단위 검사 + Task 15 화면 검사.
4. **같은 닉네임으로 새로 시작**: 이미 저장이 있는 닉네임으로 "처음부터"를 고르면 묻지 않고 덮어쓰면 안 된다. "이미 있는 이름이에요. 이어할까요, 처음부터 할까요?"를 묻는다. → Task 11 단위 검사.
5. **부탁 순서를 어기는 조사**: 부탁을 받기 전에 우물·나무를 조사하거나, 가방이 꽉 찼을 때 물건을 얻거나, 부탁이 끝난 물건을 다시 조사해도 물건이 생기거나 진행이 꼬이면 안 된다(설명 한 줄만 뜸). → Task 6 단위 검사.

---

## File Structure

```
index.html                    한 페이지, 장면 루트(#app)와 글꼴 링크
css/game.css                  색 토큰, 패널·버튼, 장면별 배치(아트 바이블 7절)
js/main.js                    시작점: 저장소 준비, 장면 등록, ?test=1 도움 기능
js/router.js                  장면 전환기
js/rules/josa.js              받침, 조사, 대사 서식, 닉네임 검사
js/rules/rng.js               시드 난수와 섞기
js/rules/game.js              게임 상태, 장 진행, 낱말 습득, 안개 문
js/rules/quests.js            부탁 단계, 조사, 가방, 인물 표시
js/rules/battle.js            막 보스전 규칙
js/rules/review.js            복습전 규칙과 자동 문제
js/save.js                    저장소(주입 가능한 storage)
js/explore/grid.js            맵 파싱, 걷기, 이동, 바라보는 대상, 도달 검사
js/explore/scale.js           배율 계산
js/explore/input.js           키보드·화면 버튼 → 이벤트
js/explore/render.js          캔버스에 임시 그림 그리기
js/scenes/title.js            시작 화면
js/scenes/explore.js          탐험 + HUD(할 일, n/5, 가방) + 안개 문
js/scenes/dialogue.js         대화·장면 글, 타자 효과, 낱말 강조, 뜻풀이 카드
js/scenes/codex.js            도감 오버레이(E)
js/scenes/quests.js           할 일 오버레이(Q)
js/scenes/battle.js           보스전·복습전 화면(3층, 유형별 보기)
js/scenes/gameover.js         게임 오버 + 도감 다시 보기
js/scenes/clear.js            장 클리어·막 클리어 화면
js/ui/placeholder.js          임시 그림(단색 블록 + 이름표)
data/words.js                 낱말 50개
data/acts/act1.js             1막: 보스, 보스전 퀴즈 10개, 장 2개
tests/*.test.mjs              단위 검사
tests/e2e/*.test.mjs          Playwright 화면 검사
tests/e2e/server.mjs          검사용 정적 서버(node:http)
package.json  vercel.json  .github/workflows/test.yml
```

---

### Task 1: 프로젝트 뼈대와 검사 환경

**Files:** Create `package.json`, `vercel.json`, `.github/workflows/test.yml`, `index.html`, `css/game.css`, `js/main.js`, `js/router.js`, `tests/e2e/server.mjs`, `tests/e2e/boot.test.mjs`, `tests/smoke.test.mjs`

**Interfaces:**
- Produces: `createRouter(root) -> { register(name, scene), show(name, params), current }`. 장면은 `{ mount(root, params, ctx) -> unmount() }`. `ctx = { router, store, getState, setState }`(store·state는 Task 5·7에서 채움).
- Produces: `startServer(port=0) -> Promise<{ url, close() }>` (저장소 루트를 정적으로 제공).

- [ ] **Step 1: `package.json`** — `"type": "module"`, scripts `"test": "node --test tests/*.test.mjs"`, `"test:e2e": "node --test tests/e2e/*.test.mjs"`, devDependencies `"playwright": "1.56.1"`. `npm install`.
- [ ] **Step 2: 실패하는 화면 검사** — `tests/e2e/boot.test.mjs`: 서버를 띄우고 `/`를 열어 `document.title === '말빛 한울'`, `#app`이 있고 콘솔 오류 0개.
- [ ] **Step 3: 실패 확인** — Run: `npm run test:e2e` / Expected: FAIL
- [ ] **Step 4: 구현** — `index.html`, `css/game.css`(Global Constraints의 색을 `:root` 변수로), `js/router.js`, `js/main.js`(빈 장면 하나). `vercel.json`: `/assets/(.*)`에 `Cache-Control: public, max-age=31536000, immutable`. 워크플로: push·PR에서 `npm ci`, `npm test`, `npx playwright install --with-deps chromium`, `npm run test:e2e`.
- [ ] **Step 5: `tests/smoke.test.mjs`** — root는 `{}`, 장면은 호출 기록만 남기는 가짜로: `show('a')` 뒤 `show('b')`면 기록 `['a:mount','a:unmount','b:mount']`, `current === 'b'`.
- [ ] **Step 6: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS
- [ ] **Step 7: Commit** — `git commit -m "chore: scaffold static web app, router and test harness"`

---

### Task 2: 조사와 닉네임 규칙

**Files:** Create `js/rules/josa.js`, Test `tests/josa.test.mjs`

**Interfaces:**
- Produces: `hasBatchim(ch) -> boolean`, `attachJosa(name, kind: '아'|'이'|'은'|'을') -> string`, `formatLine(text, nickname) -> string`, `validateNickname(raw) -> { ok: true, value } | { ok: false, error }`

- [ ] **Step 1: 실패하는 검사**

```js
test('받침에 맞는 조사', () => {
  assert.equal(attachJosa('서준', '아'), '서준아');
  assert.equal(attachJosa('서준', '이'), '서준이');
  assert.equal(attachJosa('지우', '아'), '지우야');
  assert.equal(attachJosa('지우', '이'), '지우가');
  assert.equal(attachJosa('하늘', '은'), '하늘은');
  assert.equal(attachJosa('지우', '을'), '지우를');
  assert.equal(attachJosa('Tom', '아'), 'Tom야');
  assert.equal(attachJosa('민수7', '이'), '민수7가');
});
test('대사 서식', () => {
  assert.equal(formatLine('기다렸단다, {이름|아}.', '하늘'), '기다렸단다, 하늘아.');
  assert.equal(formatLine('{이름}의 주머니', '지우'), '지우의 주머니');
});
test('닉네임 검사', () => {
  assert.deepEqual(validateNickname('  하늘 '), { ok: true, value: '하늘' });
  for (const bad of ['', '   ', '가나다라마바사', 'ㅎㅎ', '하늘!']) assert.equal(validateNickname(bad).ok, false);
  assert.equal(validateNickname('Sky12').ok, true);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현** — 받침은 `(code - 0xAC00) % 28 !== 0`(한글 완성형일 때만). 허용 `/^[가-힣A-Za-z0-9]{1,6}$/`(앞뒤 공백을 자른 뒤). 오류 문구: "이름을 적어 주세요." / "이름은 6글자까지 쓸 수 있어요." / "한글, 영어, 숫자만 쓸 수 있어요."
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: josa and nickname rules"`

---

### Task 3: 시드 난수, 맵 격자, 배율

**Files:** Create `js/rules/rng.js`, `js/explore/grid.js`, `js/explore/scale.js`, Test `tests/grid.test.mjs`

**Interfaces:**
- Produces: `makeRng(seed) -> () => number`(mulberry32), `shuffle(arr, rng) -> new array`
- Produces: `parseMap(rows: string[]) -> { w, h, start, boss|null, smallMonster|null, slots: Record<'a'..'e', {x,y}>, objects: Record<'0'..'9', {x,y}>, fog: {x,y}[], tileAt(x,y) }`
  맵 문자: `#` 막힘, `.` 길, `S` 시작, `F` 안개 문, `M` 막 보스, `m` 작은 몬스터, `a`~`e` 인물, `0`~`9` 조사 물건(우물·나무·장독 등). `S`·`.`만 걸을 수 있고 `F`는 열렸을 때만.
- Produces: `isWalkable(map, x, y, { fogOpen, smallMonsterGone })` — `m`은 물리친 뒤 걸을 수 있음.
- Produces: `step(map, pos, dir, opts) -> { pos, facing }`, `facingTarget(map, pos, facing) -> { kind: 'npc', slot } | { kind: 'object', slot } | { kind: 'boss' } | { kind: 'small' } | { kind: 'fog' } | null`
- Produces: `reachable(map, from, opts) -> Set<'x,y'>`, `computeScale(vw, vh, dpr) -> { scale, cssWidth, cssHeight }`

- [ ] **Step 1: 실패하는 검사**

```js
test('배율', () => {
  assert.deepEqual(computeScale(1366, 680, 1), { scale: 3, cssWidth: 1152, cssHeight: 648 });
  assert.equal(computeScale(1024, 768, 2).scale, 4);
  assert.equal(computeScale(300, 150, 1).scale, 1);
});
test('막힌 칸은 제자리, 방향만 바뀜', () => { /* 3×3 맵 */ });
test('안개 문은 열렸을 때만, 작은 몬스터 칸은 물리친 뒤에만 지나감', () => { /* */ });
test('바라보는 대상: 인물, 물건, 몬스터, 안개', () => { /* 작은 맵에 a, 0, m, F를 두고 */ });
test('shuffle는 같은 시드면 같은 순서', () => { /* */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: grid movement, targets, reachability and pixel scaling"`

---

### Task 4: 낱말 50개와 1막 데이터

**Files:** Create `data/words.js`, `data/acts/act1.js`, Test `tests/data.test.mjs`

**Interfaces:**
- Produces `data/words.js`: `export const WORDS: Array<{ id /* 낱말 그대로 */, word, meaning, example, act: 1..5 }>` — 설계 4절 표 50개를 그대로(5막은 '짜장' 대신 '나래').
- Produces `data/acts/act1.js`: `export default ACT`
  - `id: 1`, `title: '새벽골'`, `boss: { name: '안개 덩이' }`, `small: { name: '꼬마 안개' }`
  - `bossQuizzes: Record<wordId, Quiz>`, `Quiz = { type: 'meaning'|'blank'|'usage', prompt, options: string[4], answer: 0..3 }`. `blank`는 `___`로 빈칸 표시.
  - `chapters: [Chapter, Chapter]`, `Chapter = { id: '1-1'|'1-2', title, map: { rows: string[] /* 32열×24행 */ }, npcs: Npc[], objects: Obj[], quests: [Quest, Quest], hidden: { object: '0'..'9', word, lines: Line[] }, intro: Line[] }`
  - `Npc = { id, slot: 'a'..'e', name, color, chat: Line[] }` (부탁과 상관없을 때 하는 말. 한 명은 숨은 낱말 힌트를 말한다)
  - `Obj = { slot: '0'..'9', name, item?: { id, name }, text: string }` (`text`는 부탁과 상관없이 조사했을 때 한 줄)
  - `Quest = { id, giver: npcId, kind: 'fetch'|'gather'|'deliver'|'find'|'chase', title, targets: string[] /* fetch·find·gather: 물건 slot, deliver: [받는 npcId], chase: [] */, item?: { id, name } /* fetch·find·deliver */, words: [w1, w2], offer: Line[], waiting: Line[], done: Line[] /* deliver는 받는 인물의 대사 */ }`
  - `Line = { who: 'npc'|'hero'|'narration', npc?: npcId, face?: 'base'|'joy'|'surprise'|'worry'|'laugh', text }`. 낱말은 `[[낱말]]`.
- 1막 배정(설계 5-3 표를 그대로):

| 장 | 부탁 | giver · kind · 할 일 | words |
|---|---|---|---|
| 1-1 새벽골의 아침 | q1 | dodam(도담 할머니) · fetch · 우물(물건 slot)에서 물동이 | 어스름, 아침나절 |
| | q2 | daon(다온) · chase · 꼬마 안개(맵의 `m`) | 매무새, 손사래 |
| | hidden | 장독대 | 오롯이 |
| 1-2 마을 어귀로 | q3 | baker(빵집 아저씨) · gather · 마른 나무 3그루(물건 slot 3개) → 장작 | 부리나케, 짬 |
| | q4 | laundry(빨래터 아주머니) · deliver · 편지를 gate(어귀 할아버지)에게 | 곰비임비, 얼추 |
| | hidden | 빨랫줄 | 해거름 |

  보스전 문제 유형: 뜻 고르기 = 어스름, 아침나절, 해거름, 짬 · 빈칸 = 얼추, 부리나케, 매무새 · 문장 고르기 = 손사래, 오롯이, 곰비임비.
- 글쓰기 규칙: 대사는 설계 3절 1막 줄거리(말이 엉망이 된 마을, 말빛 주머니)를 따른다. 낱말은 **완료 대화(`done`)나 숨은 낱말 글(`hidden.lines`)에서만** `[[ ]]`로 처음 나오고, 그 일과 이어진 상황이어야 한다(예: 장작을 가져오면 "[[부리나케]] 다녀왔구나!"). 한 줄 한 문장, 닉네임을 넣고 56자 이하. 부탁마다 `offer`에 최소 한 줄은 `{이름…}`. 보스전 문제 문장은 설계 4절 예문과 달라야 한다.
- 맵 규칙: 1-1은 `m` 1개, `M`·`F` 없음. 1-2는 `M` 1개와 그 앞을 막는 `F`, `m` 없음. 아래 양쪽 모서리 3×3칸에는 `S`·인물·물건·몬스터를 두지 않는다.

- [ ] **Step 1: 실패하는 검사** (`tests/data.test.mjs`)

```js
test('낱말 50개, 막마다 10개, 중복 없음, 나래 있음·짜장 없음', () => { /* */ });
test('1막 장마다 낱말 5개: 부탁 2개 × 2 + 숨은 1 = 그 장 5개, 두 장 합 = 1막 10개', () => { /* */ });
test('낱말은 done 또는 hidden.lines에서만 [[ ]]로 나오고, offer·waiting·chat에는 없다', () => { /* */ });
test('보스전 문제 10개: 보기 4개 서로 다름, 정답 하나, 예문과 다름, 유형 4·3·3', () => { /* */ });
test('부탁 대상이 맵에 있다: 물건 slot은 objects와 맵에, deliver 받는 이는 npcs에, chase면 맵에 m', () => { /* */ });
test('맵: 32×24, 시작 1개, 1-1은 m만, 1-2는 M과 F, 아래 모서리 3×3 비움', () => { /* */ });
test('도달: 시작에서 모든 인물·물건·m 옆 칸에 닿고, M 옆 칸은 F가 열렸을 때만', () => { /* reachable 사용 */ });
test('모든 대사 줄은 닉네임 "가나다라마바"를 넣어도 56자 이하', () => { /* formatLine */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: `data/words.js`와 `data/acts/act1.js` 작성** (위 표와 규칙대로)
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: 1막 대사·문제를 선생님 확인용 파일로 뽑기** — `node -e`로 `docs/review/act1-script.md`(장별: 부탁 제목, 대사 전체, 숨은 낱말 글, 보스전 문제와 정답)를 만든다. 실행이 끝나면 선생님께 보내 확인을 받는다(구현은 기다리지 않고 계속).
- [ ] **Step 6: Commit** — `git commit -m "content: 50 words and act 1 data"`

---

### Task 5: 게임 상태와 장 진행

**Files:** Create `js/rules/game.js`, Test `tests/game.test.mjs`

**Interfaces:**
- Consumes: ACT 모양(Task 4), `parseMap`(Task 3)
- Produces: `newGame({ nickname, avatar: 'f'|'m' }) -> GameState`
  `GameState = { version: 1, nickname, avatar, act: 1, chapter: '1-1', pos, facing: 'down', acquired: Record<wordId, { from: string /* npcId 또는 물건 이름 */ }>, quests: Record<questId, { stage: 'locked'|'open'|'active'|'ready'|'done', gathered: string[] }>, bag: string[] /* item id */, hiddenFound: Record<chapterId, true>, smallGone: Record<chapterId, true>, askedWordIds: string[], clearedChapters: string[], clearedActs: number[], seenTips: string[] }`
  (`pos`는 1-1 맵의 `S`, q1은 `'open'`, 나머지 부탁은 `'locked'`)
- Produces: `chapterOf(act, chapterId) -> Chapter`, `chapterWords(chapter) -> string[5]`, `actWords(act) -> string[10]`
- Produces: `acquireWords(state, wordIds, from) -> GameState`(이미 있으면 그대로)
- Produces: `acquiredCount(state, chapter) -> number`
- Produces: `fogOpen(state, chapter) -> boolean` (그 장 5개 모두)
- Produces: `chapterComplete(state, chapter) -> boolean` (5개 모두. 앞 장은 이것으로 장 클리어)
- Produces: `enterNextChapter(state, act) -> GameState` (1-1 → 1-2, `pos`는 1-2의 `S`, `clearedChapters`에 '1-1', 1-2의 첫 부탁 `'open'`)
- Produces: `finishAct(state, act, askedIds) -> GameState` (askedWordIds 추가, clearedChapters에 '1-2', clearedActs에 1)
- Produces: `setPos(state, pos, facing)`, `markTip(state, tipId)`, `extractWords(text) -> string[]`

- [ ] **Step 1: 실패하는 검사**

```js
test('새 게임: 1-1 시작 칸, q1만 open', () => { /* */ });
test('낱말 습득은 한 번만 센다', () => { /* acquireWords 두 번 → count 1 */ });
test('앞 장 5개를 다 모으면 장 완료, 다음 장으로 가면 1-2 시작 칸과 q3 open', () => { /* */ });
test('뒷 장 5개를 다 모으면 안개가 열린다', () => { /* */ });
test('보스전 출제 기록은 finishAct에서만 남는다 (전투 중 새로 고침 대비)', () => { /* newGame → askedWordIds [] , finishAct 뒤 10 */ });
test('상태 함수는 원래 상태를 바꾸지 않는다', () => { /* 깊은 동결 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현** (`extractWords`는 `/\[\[(.+?)\]\]/g`)
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: game state and chapter progression"`

---

### Task 6: 부탁 규칙

**Files:** Create `js/rules/quests.js`, Test `tests/quests.test.mjs`

**Interfaces:**
- Consumes: Task 5 상태
- Produces: `talkTo(state, chapter, npcId) -> { state, script: Line[], event: 'offer'|'waiting'|'done'|'chat' , words: string[] }`
  - giver이고 그 부탁이 `open` → `offer` 대사, 부탁은 `active`, deliver면 물건을 가방에 넣음
  - giver이고 `active` → `waiting` 대사
  - giver이고 `ready`(fetch·gather·find·chase 끝냄) → `done` 대사, `words` = 부탁의 낱말 2개, 부탁 `done`, 물건 가방에서 뺌, 다음 부탁 `open`
  - deliver 받는 인물이고 그 부탁이 `active`이며 가방에 물건 있음 → 받는 인물의 `done` 대사, 위와 같이 완료
  - 그 밖 → `chat`
  - (낱말 습득 자체는 화면이 `acquireWords`로 한다. `talkTo`는 바뀐 부탁 상태와 줄 낱말만 돌려준다.)
- Produces: `inspect(state, chapter, objectSlot) -> { state, script: Line[], event: 'item'|'gathered'|'hidden'|'bag-full'|'nothing', words: string[] }`
  - fetch·find 대상이고 부탁이 `active` → 물건을 가방에(가방 3칸이 차 있으면 `bag-full`, "가방이 가득 찼어." 한 줄), 부탁 `ready`
  - gather 대상이고 `active`이며 아직 안 모은 곳 → `gathered`에 추가, 다 모으면 물건을 가방에 넣고 `ready`
  - 숨은 낱말 물건이고 아직 못 찾음 → `hidden.lines`, `words: [hidden.word]`, `hiddenFound` 기록
  - 그 밖(부탁 전, 이미 끝난 곳, 이미 찾은 숨은 낱말) → 물건의 `text` 한 줄, `nothing`
- Produces: `winSmall(state, chapter) -> GameState` (chase 부탁 `ready`, `smallGone` 기록)
- Produces: `npcMarker(state, chapter, npcId) -> '!'|'…'|'?'|null`, `currentTask(state, chapter) -> string` (진행 중 부탁 제목 → 부탁 2개가 끝났고 숨은 낱말이 남았으면 "숨은 낱말을 찾아라" → 뒷 장에서 5개가 다 모이면 "그림자를 물리쳐라"), `hiddenGlow(state, chapter) -> 'none'|'dim'|'bright'`, `questList(state, chapter) -> Array<{ id, title, stage }>`

- [ ] **Step 1: 실패하는 검사**

```js
test('fetch: 받기 → 우물 조사 → 보고하면 낱말 2개, 다음 부탁 open', () => {
  let s = newGame({ nickname: '하늘', avatar: 'f' }); const ch = ACT.chapters[0];
  ({ state: s } = talkTo(s, ch, 'dodam')); assert.equal(s.quests.q1.stage, 'active');
  ({ state: s } = inspect(s, ch, wellSlot)); assert.equal(s.quests.q1.stage, 'ready'); assert.deepEqual(s.bag, ['water']);
  const r = talkTo(s, ch, 'dodam'); assert.deepEqual(r.words, ['어스름', '아침나절']);
  assert.equal(r.state.quests.q1.stage, 'done'); assert.deepEqual(r.state.bag, []); assert.equal(r.state.quests.q2.stage, 'open');
});
test('부탁 전 조사·끝난 뒤 조사는 물건을 주지 않는다 (Review Focus 5)', () => { /* event nothing, bag 그대로 */ });
test('가방 3칸이 차면 bag-full, 부탁은 active 그대로 (Review Focus 5)', () => { /* bag을 3개로 만든 상태 */ });
test('gather: 같은 나무를 두 번 조사해도 한 번만 센다, 3곳이면 ready', () => { /* */ });
test('deliver: 받으면 가방에 편지, 받는 인물에게 말 걸면 완료', () => { /* */ });
test('chase: winSmall 뒤 보고하면 완료', () => { /* */ });
test('숨은 낱말: 처음 조사만 낱말을 준다, 부탁 2개가 끝나면 bright', () => { /* */ });
test('인물 표시: open → !, active → …, ready·받는 인물 → ?, 그 밖 null', () => { /* */ });
test('currentTask 순서', () => { /* q 제목 → 숨은 낱말을 찾아라 → (1-2) 그림자를 물리쳐라 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: quest rules with bag, inspection and hidden words"`

---

### Task 7: 저장소

**Files:** Create `js/save.js`, Test `tests/save.test.mjs`

**Interfaces:**
- Produces: `createStore(storage | null) -> { available, names(), load(nickname) -> { ok: true, state } | { ok: false, reason: 'missing'|'corrupt' }, save(state) -> boolean, has(nickname) }`
- storage가 null이거나 시험 쓰기에서 예외 → `available: false`. `save`에서 예외 → `false`를 돌려주고 `available`을 false로(게임은 계속). `load`: JSON이 깨졌거나 `version !== 1`이거나 필수 필드가 없으면 `corrupt`이고, 그 키를 지우지 않는다.

- [ ] **Step 1: 실패하는 검사** — 메모리 storage 가짜로: 저장 뒤 불러오면 `deepEqual` · `names()`에 한 번만 · 깨진 JSON은 corrupt이고 원래 문자열이 남음 · `version: 0`은 corrupt · `createStore(null).available === false` · setItem이 두 번째부터 예외를 던지면 두 번째 `save`가 false이고 예외가 밖으로 안 나오며 그 뒤 `available === false`.
- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: per-nickname save store with corrupt and unavailable handling"`

---

### Task 8: 막 보스전 규칙

**Files:** Create `js/rules/battle.js`, Test `tests/battle.test.mjs`

**Interfaces:**
- Consumes: `shuffle`, `makeRng`(Task 3)
- Produces: `createBattle({ wordIds, seed, finalWordId? }) -> Battle` — `{ order, index: 0, hearts: 5, hp: 6, correct: 0, wrong: 0, streak: 0, result: null, finalWordId }`. `finalWordId`는 늘 `order` 마지막.
- Produces: `currentWord(b)`, `answer(b, isCorrect) -> Battle`, `retry(b, seed) -> Battle`, `optionOrder(quiz, rng) -> { options, answer }`
  - 맞으면 hp−1·correct+1·streak+1, 틀리면 hearts−1·wrong+1·streak=0. hearts 0 → `lose`, hp 0 → `win`. `finalWordId`가 있으면: 마지막 낱말 전에는 hp가 1 아래로 내려가지 않고, 마지막 낱말을 맞혀야 `win`. 마지막 낱말을 틀리고 `lose`가 아니면 같은 낱말을 다시 낸다. 결과가 난 뒤 `answer`는 상태를 바꾸지 않는다.

- [ ] **Step 1: 실패하는 검사**

```js
const ten = actWords(ACT);
test('6개 맞히면 승리', () => { let b = createBattle({ wordIds: ten, seed: 1 }); for (let i = 0; i < 6; i++) b = answer(b, true); assert.equal(b.result, 'win'); });
test('5개 틀리면 게임 오버', () => { /* */ });
test('어떤 맞힘·틀림 순서든 10문제 안에 승패가 난다', () => {
  for (let mask = 0; mask < 1024; mask++) { let b = createBattle({ wordIds: ten, seed: mask });
    for (let i = 0; i < 10 && !b.result; i++) b = answer(b, !!(mask >> i & 1));
    assert.ok(b.result, `mask ${mask}`); }
});
test('각 낱말은 한 번씩만', () => { /* */ });
test('연속 정답은 피해를 늘리지 않는다', () => { /* 3번 맞힘 → hp 3, streak 3 */ });
test('재도전은 같은 낱말 10개, 하트·HP 초기화', () => { /* */ });
test('보스: 나래는 마지막, 그 전엔 HP 1에서 멈춤, 나래를 맞혀야 승리', () => {
  const ids = WORDS.filter(w => w.act === 5).map(w => w.id); let b = createBattle({ wordIds: ids, seed: 3, finalWordId: '나래' });
  assert.equal(b.order.at(-1), '나래');
  for (let i = 0; i < 9; i++) b = answer(b, true);
  assert.equal(b.hp, 1); assert.equal(b.result, null); assert.equal(currentWord(b), '나래');
  b = answer(b, false); assert.equal(currentWord(b), '나래'); assert.equal(b.result, null);
  b = answer(b, true); assert.equal(b.result, 'win');
});
test('optionOrder는 정답 보기를 따라간다', () => { /* */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: act boss battle rules with final-word handling"`

---

### Task 9: 복습전 규칙

**Files:** Create `js/rules/review.js`, Test `tests/review.test.mjs`

**Interfaces:**
- Consumes: `WORDS`, `makeRng`, `shuffle`
- Produces: `makeMeaningQuestion(wordId, act: number, rng) -> { prompt: "'<낱말>'의 뜻은?", options: string[4], answer: 0..3 }` — 틀린 보기 3개는 다른 낱말의 뜻. 같은 막 낱말을 먼저, 모자라면 다른 막에서. 4개 모두 서로 다름.
- Produces: `createReview({ pool: string[] /* 얻은 낱말 */, act, seed }) -> Review` — `{ pool, correct: 0, need: 3, last: null, question, word, result: null }`
- Produces: `answerReview(r, isCorrect, rng) -> Review` — 맞으면 correct+1, 3이면 `win`. 틀리면 그대로. 결과가 나기 전이면 다음 낱말을 고른다: `pool`이 2개 이상이면 바로 전 낱말과 다른 것, 1개면 그것.

- [ ] **Step 1: 실패하는 검사**

```js
test('뜻 고르기 문제: 보기 4개 서로 다름, 정답 뜻이 정답 자리에', () => {
  const q = makeMeaningQuestion('어스름', 1, makeRng(1));
  assert.equal(new Set(q.options).size, 4); assert.equal(q.options[q.answer], WORDS.find(w => w.id === '어스름').meaning);
});
test('3개 맞히면 승리, 틀려도 끝나지 않는다', () => { /* */ });
test('얻은 낱말이 2개뿐이면 번갈아 낸다(같은 낱말 연달아 없음)', () => { /* pool ['어스름','아침나절'] */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: review battle rules with generated meaning questions"`

---

### Task 10: 탐험 화면

**Files:** Create `js/explore/input.js`, `js/explore/render.js`, `js/ui/placeholder.js`, `js/scenes/explore.js`; Modify `js/main.js`, `css/game.css`; Test `tests/input.test.mjs`, `tests/e2e/explore.test.mjs`

**Interfaces:**
- Consumes: Task 3 grid·scale, Task 5·6 규칙
- Produces: `bindInput(target, { move(dir), act(), codex(), tasks() }) -> unbind()` — 방향키·WASD → move, 스페이스·엔터 → act, E → codex, Q → tasks. 누르고 있으면 150ms마다 한 칸. `pointer: coarse`일 때만 방향 버튼(3×56px 십자)과 말하기 버튼(지름 96px).
- Produces: `drawExplore(ctx2d, { map, state, chapter, camera })` — 임시 그림: 막힘 `#2F6B3A`, 길 `#D9A55B`, 안개 `#B9BBBE` 체크무늬, 인물은 대표색 16×24 블록 + 이름 첫 글자, 주인공 쪽빛 블록, 물건 흙색 블록, 작은 몬스터·보스 잿빛 원. 인물 머리 위 `npcMarker`("!"·"…"·"?", 흰 말풍선 + 먹색 1px 윤곽). 부탁 대상 물건은 발밑 흰 화살표, 숨은 낱말 물건은 `hiddenGlow`대로 흰 점 반짝임(dim: 2초에 한 번 1점, bright: 1초에 한 번 2점). 카메라는 주인공을 가운데 두되 맵 밖으로 안 나감.
- 탐험 장면: HUD(위쪽 48px 한지 띠: 초록 점 + `currentTask`, "이 장의 낱말 n/5", 가방 3칸 — 물건 이름 첫 글자 블록, 빈칸 점선, 도감 E·할 일 Q 버튼). `act()`: `facingTarget`이 npc → `talkTo` 후 `router.show('dialogue', { script, words, from })`, object → `inspect` 후 대사가 있으면 dialogue, 없으면 한 줄 토스트, small → `router.show('battle', { mode: 'review' })`, boss → `router.show('battle', { mode: 'boss' })`, fog → "아직 찾지 못한 낱말이 n개 있어." 토스트(2초). 앞 장에서 `chapterComplete`가 되면 `router.show('clear', { kind: 'chapter' })`. 장면이 바뀔 때 저장한다.
- 처음 하는 학생 안내: `seenTips`에 없으면 "방향키로 걸어 보세요"(움직이면 사라짐), 첫 부탁 인물 쪽 화살표.
- Produces (`?test=1`일 때만, `js/main.js`): `window.__test = { state(), newGame(nickname, avatar), acquire(wordIds, from) }`. 뒤 Task가 더한다. 일반 주소에서는 만들지 않는다.

- [ ] **Step 1: 실패하는 검사** — `tests/input.test.mjs`: `ArrowUp`·`w` → `move('up')`, `' '`·`Enter` → `act()`, `e` → `codex()`, `q` → `tasks()`, 누르고 있는 반복은 `mock.timers`로 150ms 간격. `tests/e2e/explore.test.mjs`: `?test=1`로 열어 `__test.newGame('하늘','f')` 뒤 1366×768 창에서 캔버스 CSS 크기 1152×648, HUD에 "이 장의 낱말 0/5"와 q1 제목.
- [ ] **Step 2: 실패 확인** — Run: `npm test && npm run test:e2e` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: explore scene with markers, bag HUD, inspection and fog gate"`

---

### Task 11: 시작 화면

**Files:** Create `js/scenes/title.js`; Modify `js/main.js`, `css/game.css`; Test `tests/title.test.mjs`

**Interfaces:**
- Consumes: `validateNickname`, `createStore`, `newGame`
- Produces: `shouldSubmit({ key, isComposing }) -> boolean` (`key === 'Enter' && !isComposing`)
- Produces: `titleDecision({ nickname, avatar, choice: 'new'|'continue', store }) -> { action: 'start', state } | { action: 'ask-overwrite' } | { action: 'load-error' } | { action: 'invalid', error }`
- 화면: 제목 "말빛 한울"(주아 72px), 닉네임 칸(화면 위쪽 절반, 1~6글자 안내), 모습 카드 2장(그림 + "남"/"여"), 저장된 닉네임 버튼(48px), "처음부터"·"이어하기". `store.available === false`면 "이 창에서는 저장되지 않아요". `load-error`면 "저장을 불러오지 못했어요. 처음부터 할까요?". 시작하면 지금 장의 `intro` 대사를 보여 준 뒤 탐험으로(이어하기는 바로 탐험).

- [ ] **Step 1: 실패하는 검사**

```js
test('조합 중 엔터는 받지 않는다', () => {
  assert.equal(shouldSubmit({ key: 'Enter', isComposing: true }), false);
  assert.equal(shouldSubmit({ key: 'Enter', isComposing: false }), true);
});
test('같은 닉네임으로 처음부터 → 덮어쓰기 확인', () => {
  const store = createStore(memStorage()); store.save(newGame({ nickname: '하늘', avatar: 'f' }));
  assert.deepEqual(titleDecision({ nickname: '하늘', avatar: 'f', choice: 'new', store }), { action: 'ask-overwrite' });
});
test('이어하기: 저장 있음 → start, 깨짐 → load-error, 없음 → 새로 시작', () => { /* */ });
test('잘못된 닉네임 → invalid', () => { /* */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: title scene with nickname, avatar and save handling"`

---

### Task 12: 대화 화면과 낱말 습득

**Files:** Create `js/scenes/dialogue.js`; Modify `css/game.css`; Test `tests/dialogue.test.mjs`

**Interfaces:**
- Consumes: `formatLine`, `extractWords`, `acquireWords`, `WORDS`
- Produces: `splitHighlights(text) -> Array<{ text, word? }>`
- Produces: `createTypewriter({ full, msPerChar: 30 }) -> { shown(), done(), press() -> 'reveal'|'next'|'ignored', tick(ms) }` — 첫 press는 끝까지 보이기, 다 보인 뒤 200ms 안의 press는 `'ignored'`, 그 뒤는 `'next'`.
- 대화 장면 `params = { script: Line[], words: string[], from }`:
  - 배치(아트 바이블 7절, 시안 `dialogue2.png`): 배경(임시: 장 색 그라데이션), 상반신 임시 블록 둘(같은 높이, 듣는 쪽 `filter: brightness(.62) saturate(.7)`), 화면 폭 대사 상자(좌우 40px, 높이 190px), 말하는 쪽 위 이름표 + 대표색 4px 띠, 오른쪽 아래 ▼. `who: 'narration'`은 상반신 없이 가운데 정렬 글.
  - 고유어는 먹색 글자 + 아래 40% 금빛 띠, 나타날 때 빛 알갱이 한 번.
  - `params.words`에 든 낱말이 있는 문장이 다 보이면 뜻풀이 카드("새 낱말을 찾았다!", 낱말 40px, 뜻 22px, '확인'으로만 닫힘) → `acquireWords(state, [w], from)` → 저장. 이미 얻은 낱말은 카드 없이 띠만.
  - 처음 고유어에서 `seenTips`에 없으면 "반짝이는 낱말을 눌러 보세요"를 한 번.
  - 대화가 끝나면 `router.show('explore')`.

- [ ] **Step 1: 실패하는 검사**

```js
test('강조 조각 나누기', () => {
  assert.deepEqual(splitHighlights('새벽 [[어스름]]부터'), [{ text: '새벽 ' }, { text: '어스름', word: '어스름' }, { text: '부터' }]);
});
test('타자 효과: 첫 누름은 다 보이기, 200ms 안은 무시, 그 뒤는 다음', () => {
  const t = createTypewriter({ full: '가나다', msPerChar: 30 });
  assert.equal(t.press(), 'reveal'); assert.equal(t.shown(), '가나다');
  t.tick(100); assert.equal(t.press(), 'ignored');
  t.tick(150); assert.equal(t.press(), 'next');
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: dialogue scene with typewriter, word highlight and meaning card"`

---

### Task 13: 도감과 할 일 오버레이

**Files:** Create `js/scenes/codex.js`, `js/scenes/quests.js`; Modify `js/scenes/explore.js`, `css/game.css`; Test `tests/e2e/overlays.test.mjs`

**Interfaces:**
- Consumes: `questList`, `currentTask`, `WORDS`
- Produces: `openCodex(root, state, { actTab = state.act }) -> close()`, `openTasks(root, state, chapter) -> close()`
- 도감: 막별 탭 5개, 2×5 격자. 얻은 낱말 카드는 낱말·뜻·예문·만난 곳(`acquired[w].from`). 못 얻은 칸은 "?" 모양(회색만으로 표시하지 않음). Esc·E·닫기 버튼. 탐험 장면에서만 열린다.
- 할 일: 부탁 2개(잠김은 "?", 받을 수 있음 "받기 전", 진행 중 "하는 중", 보고 가능 "돌아가서 알리기", 완료는 초록 + 체크 + "완료"), 숨은 낱말(찾음/못 찾음), 뒷 장이면 "그림자를 물리쳐라".

- [ ] **Step 1: 실패하는 화면 검사** — `?test=1`: 새 게임 → `__test.acquire(['어스름'], '도담 할머니')` → E: 1막 탭에 "어스름" 카드 1장과 "?" 9칸 → Q: q1 "받기 전", q2 "?", 숨은 낱말 "못 찾음".
- [ ] **Step 2: 실패 확인** — Run: `npm run test:e2e` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: codex and task overlays"`

---

### Task 14: 전투 화면(보스전·복습전), 게임 오버, 클리어

**Files:** Create `js/scenes/battle.js`, `js/scenes/gameover.js`, `js/scenes/clear.js`; Modify `css/game.css`, `js/main.js`; Test `tests/e2e/battle.test.mjs`

**Interfaces:**
- Consumes: Task 8·9 전투 규칙, `actWords`, `finishAct`, `winSmall`, `enterNextChapter`, `ACT.bossQuizzes`, `makeMeaningQuestion`, `openCodex`
- 배치(아트 바이블 7절 전투, 시안 `b3a~c.png`):
  - 무대: 장 배경 임시 그라데이션을 잿빛으로, 가장자리 안개 비네트. 왼쪽 주인공 전투 자세 임시 블록, 오른쪽 몬스터 임시 원 + 위에 이름표와 HP 6칸(줄어든 칸은 점선). 복습전은 HP 대신 "남은 빛 n/3".
  - 아래 묶음(화면 아래에 붙음, 무대는 남은 높이): 주인공 이름표 + 하트 5개(빈 하트는 속 빈 모양, 복습전은 하트 대신 "연습" 표) → 문제 상자(몬스터 말풍선, 왼쪽 위 몬스터 이름, 오른쪽 위 유형, 28px) → 보기. **문제와 보기 사이 12px.**
  - 보기: `blank` 카드 4장 가로(110px, 32px), `meaning` 2×2(72px), `usage` 1열(48px, 22px). 번호 원 1~4, 숫자키 1~4.
  - 누르면 바로 잠근다. ○/× 100ms 안. 맞으면 빈칸에 금빛 띠, 빛줄기, HP 칸 금빛으로 갈라짐(0.8초 이하). 틀리면 안개가 조여 들고 하트 금 감(복습전은 하트 그대로) → 정답·뜻 → '다음'.
  - 연속 2번 이상이면 "연속 n번 맞힘!"과 굵은 빛줄기. 피해는 그대로.
  - `prefers-reduced-motion`이면 흔들림·빛줄기 대신 서서히 나타나기.
- 복습전 승리: `winSmall` → 저장 → "꼬마 안개를 쫓아냈다!" → 탐험.
- 보스전 승리: `finishAct(state, ACT, b.order)` → 저장 → `clear`(kind 'act': "1막 클리어!" + 도감 10장 + "다음 막은 준비 중이에요").
- 장 클리어(`clear` kind 'chapter'): "1장 클리어!" + 이 장 낱말 5장 → `enterNextChapter` → 저장 → 2장 `intro` → 탐험.
- 보스전 패배: `gameover` → "안개에 휩싸였다…" → 도감 1막 탭 다시 보기 → "다시 도전"(처음부터 초점) → `retry`.
- 첫 보스전 전에 `seenTips`에 없으면 규칙 한 장("하트 5개, 몬스터 6칸. 6번 맞히면 이겨요."). 첫 복습전 전에는 "얻은 낱말을 복습해요. 3번 맞히면 이겨요."
- Produces (`?test=1`): `__test.startBattle(mode: 'boss'|'review')`(필요한 낱말을 얻은 상태로 전투 시작), `__test.answerIndex() -> number`.

- [ ] **Step 1: 실패하는 화면 검사**
  - 보스전: 정답만 6번 → 막 클리어 화면, 저장 `askedWordIds` 10개, `clearedActs` [1]
  - 보스전: 오답만 5번 → 게임 오버 → "다시 도전" → 하트 5, HP 6, 낱말 집합 같음
  - 복습전: 오답 2번 뒤 정답 3번 → 탐험으로 돌아오고 q2가 보고 가능('?')
  - **보기를 `dblclick`해도 맞힘+틀림 합이 1만 늘어난다 (Review Focus 2)**
  - 문제 상자 아래 끝과 첫 보기 위 끝의 거리가 12±2px (세 유형 모두)
- [ ] **Step 2: 실패 확인** — Run: `npm run test:e2e` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: boss and review battle scenes, game over and clear screens"`

---

### Task 15: 1막 끝까지 화면 검사

**Files:** Modify `js/main.js`; Create `tests/e2e/act1.test.mjs`

**Interfaces:**
- Produces (`?test=1`, 앞 Task의 것에 더함): `__test.teleportTo(target: npcId | objectName | 'small' | 'boss')`(맞닿은 걸을 수 있는 칸으로 옮기고 대상을 보게 함), `__test.fastText(on)`(타자 효과 0ms).

- [ ] **Step 1: 실패하는 화면 검사** (`tests/e2e/act1.test.mjs`)
  - 끝까지 플레이: 닉네임 "하늘"(키보드 입력) → 여 → 처음부터 → 인트로 → q1(도담 할머니 → 우물 → 할머니, 뜻풀이 카드 2장 '확인') → q2(다온 → 꼬마 안개 복습전 승리 → 다온) → 장독대(숨은 낱말) → "1장 클리어!" → 2장 → q3(빵집 → 나무 3그루 → 빵집) → q4(빨래터 → 어귀 할아버지) → 빨랫줄 → HUD "5/5", 할 일 "그림자를 물리쳐라" → 보스 → 정답 6번 → "1막 클리어!"
  - 각 단계에서 HUD 낱말 수와 인물 표시("!", "…", "?")가 기대대로 바뀐다(q1 받기 전 도담 할머니 "!", 받은 뒤 "…", 물동이를 든 뒤 "?").
  - 안개 문: 2장에서 낱말 4개일 때 안개에 말 걸면 "아직 찾지 못한 낱말이 1개 있어."
  - 새로 고침 뒤 이어하기: q1 끝낸 뒤 새로 고침 → "하늘" → 이어하기 → HUD 2/5, 같은 위치, q2 "!"
  - **전투 중 새로 고침 (Review Focus 3)**: 보스전에서 2문제 푼 뒤 새로 고침 → 이어하기 → 탐험 화면, `askedWordIds` 비어 있음 → 다시 보스 → 하트 5, HP 6
  - 일반 주소(`/`)에서 `window.__test === undefined`
- [ ] **Step 2: 실패 확인** — Run: `npm run test:e2e` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: 모두 PASS
- [ ] **Step 5: 1366×768, 1024×768(dpr 2) 스크린샷(시작, 탐험, 대화, 뜻풀이 카드, 복습전, 보스전, 막 클리어)을 `docs/screenshots/act1/`에 남겨 선생님께 보낸다.**
- [ ] **Step 6: Commit** — `git commit -m "test: act 1 end-to-end playthrough and test hooks"`
