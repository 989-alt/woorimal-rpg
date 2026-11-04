# 1장 플레이 가능 버전 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 임시 그림으로 1장 「새벽골」을 시작 화면부터 전투 승리까지 끝까지 플레이할 수 있게 만들고, 그 규칙을 단위 검사와 화면 검사로 고정한다.

**Architecture:** 빌드 없는 정적 웹앱이다. 규칙은 `js/rules/`의 순수 함수(상태 → 새 상태)로 두고 `node --test`로 검사한다. 화면은 `js/scenes/`가 맡는데, 상태를 읽고 사용자 동작을 규칙 함수에 넘기기만 한다. 탐험은 384×216 캔버스(정수 배율), 대화·전투·도감은 HTML 층이다. 낱말·대사·퀘스트·맵·퀴즈는 `data/`에만 둔다.

**Tech Stack:** HTML, CSS, 순수 JS 모듈(ES2022), Node 22 `node --test`, Playwright 1.56.1(화면 검사), Vercel 정적 배포, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-04-woorimal-rpg-design.md` · 화면 규칙: `design/art/art-bible.md` 7·8절 · 시안: `design/art/concepts/ch1/mock/` (`dialogue2.png`, `b3a~c.png`, `explore.png`)

**이 계획에 넣지 않는 것 (다음 계획):** 2~5장 내용, 확정 그림(sprite-gen)과 그림을 못 불러올 때 임시 그림으로 대신하기, 그림 규격 자동 검사, 글꼴 직접 올리기·서브셋, 세계 지도, 퀘스트 구역 색 되살리기, 엔딩. 이번에는 장 클리어 뒤 "1장 클리어! 다음 장은 준비 중이에요" 화면으로 끝낸다.

## Global Constraints

- 정적 웹앱, 빌드 단계 없음. 서버·로그인·소리 없음. 외부 런타임 라이브러리 없음(개발용 Playwright만).
- 도트 화면 기준 해상도 384×216, 칸 16px. 배율 `s = max(1, floor(min(vw·dpr/384, vh·dpr/216)))`, CSS 크기 `384·s/dpr`. `image-rendering: pixelated`. 남는 곳은 한지색 `#FBF5E6` 여백.
- 하트 5개, 몬스터 HP 6칸. 맞히면 HP −1, 틀리면 하트 −1. 6개 맞히면 승리, 5개 틀리면 게임 오버. 연속 정답은 연출만 바뀌고 피해는 늘 1칸. 제한 시간 없음.
- 낱말 하나는 게임 전체에서 한 번만 출제된다. 게임 오버 재도전은 같은 10문제를 순서만 섞어 다시 낸다.
- 색: 한지 `#FBF5E6`, 먹 `#2B2622`, 먹갈 테두리 `#5A4636`, 말빛 금 `#F2C14E`, 밝은 금 `#FFE7A3`, 한울 초록 `#5FAE5A`, 다홍 `#E0584F`, 잿빛 `#B9BBBE` / `#8A8D91` / `#5E6266`, 쪽빛 `#3B5BA5`, 자주 `#8E4A7A`. 금색은 글자색으로 쓰지 않는다(형광펜 띠, 테두리만).
- 글꼴: 대사·UI 고운돋움(Gowun Dodum), 제목 주아(Jua). 이번 계획에서는 Google Fonts 링크를 쓰고, 막히면 시스템 글꼴로 보인다. 글자 크기 최소 18px, 대사 26px, 보기 24px, HUD 20px. `word-break: keep-all`.
- 버튼·보기 높이 48px 이상. 정답·오답은 색 + ○/× + 글자로 구분한다. `prefers-reduced-motion`이면 흔들림 없이 서서히 나타나기만 한다.
- 닉네임 1~6글자, 한글 완성형·영문·숫자만. 대사의 `{이름}`, `{이름|아}`, `{이름|이}`, `{이름|은}`, `{이름|을}`은 받침에 맞는 조사로 바꾼다. 영문·숫자 끝은 받침 없음.
- 저장: localStorage, 닉네임별 키 `malbit:save:<닉네임>`, 이름 목록 키 `malbit:names`, 저장 형식 `version: 1`.
- 검사용 도움 기능은 주소에 `?test=1`이 있을 때만 `window.__test`로 드러나고, 화면에는 아무것도 나타나지 않는다.
- 학생이 읽는 글은 6학년 눈높이의 쉬운 한국어로 쓴다. 고유어 뜻은 설계 4절 표를 그대로 쓴다.

## Review Focus

1. **한글 입력 중 엔터**: 닉네임 칸에서 조합 중(`isComposing`)에 엔터를 누르면 마지막 글자가 빠진 이름으로 시작되면 안 된다. 조합이 끝난 뒤의 엔터만 받는다. → Task 9 단위 검사.
2. **보기 연타·두 번 누르기**: 보기를 빠르게 두 번 누르거나 키 1을 연타해도 한 문제에 답이 한 번만 들어가야 한다. → Task 12 화면 검사.
3. **전투 중 새로 고침**: 전투 도중 새로 고침하면 전투 직전 탐험 위치로 돌아오고, 다시 다가가면 같은 10낱말로 전투가 처음부터 시작해야 한다(출제 기록은 전투가 끝날 때만 남는다). → Task 5 단위 검사 + Task 13 화면 검사.
4. **같은 닉네임으로 새로 시작**: 이미 저장이 있는 닉네임으로 "처음부터"를 고르면 묻지 않고 덮어쓰면 안 된다. "이미 있는 이름이에요. 이어할까요, 처음부터 할까요?"를 묻는다. → Task 9 단위 검사.
5. **저장 중 오류**: 도중에 `localStorage.setItem`이 예외를 던져도(용량 초과, 시크릿 창) 게임은 멈추지 않고 "이 창에서는 저장되지 않아요" 안내만 뜬다. → Task 6 단위 검사.

---

## File Structure

```
index.html                    한 페이지, 장면 루트(#app)와 글꼴 링크
css/game.css                  색 토큰, 패널·버튼, 장면별 배치(아트 바이블 7절)
js/main.js                    시작점: 저장소 준비, 장면 전환, ?test=1 도움 기능
js/router.js                  장면 전환기 (show(name, params))
js/rules/josa.js              받침 판별, 조사 붙이기, 대사 서식, 닉네임 검사
js/rules/game.js              게임 상태와 탐험·낱말·퀘스트 규칙(순수)
js/rules/battle.js            전투 규칙(순수)
js/rules/rng.js               시드 난수와 섞기
js/save.js                    저장소(주입 가능한 storage)
js/explore/grid.js            맵 파싱, 걷기 판정, 이동, 말 걸기 대상, 도달 검사
js/explore/scale.js           배율 계산
js/explore/input.js           키보드·화면 버튼 → 방향/말하기 이벤트
js/explore/render.js          캔버스에 임시 그림 그리기
js/scenes/title.js            시작: 닉네임, 모습 고르기, 이어하기/처음부터
js/scenes/explore.js          탐험 + HUD + 안개 문
js/scenes/dialogue.js         대화, 타자 효과, 낱말 강조, 뜻풀이 카드
js/scenes/codex.js            도감 오버레이(E)
js/scenes/quests.js           퀘스트 오버레이(Q)
js/scenes/battle.js           전투 화면(3층, 유형별 보기)
js/scenes/gameover.js         게임 오버 + 도감 10장 다시 보기
js/scenes/clear.js            장 클리어 화면
js/ui/placeholder.js          임시 그림(단색 블록 + 이름표) 만들기
data/words.js                 낱말 50개
data/chapters/ch1.js          1장: 맵, 인물, 대사, 퀘스트, 몬스터, 퀴즈 10개
tests/*.test.mjs              단위 검사
tests/e2e/*.test.mjs          Playwright 화면 검사
tests/e2e/server.mjs          검사용 정적 서버(node:http)
package.json  vercel.json  .github/workflows/test.yml
```

---

### Task 1: 프로젝트 뼈대와 검사 환경

**Files:**
- Create: `package.json`, `vercel.json`, `.github/workflows/test.yml`, `index.html`, `css/game.css`, `js/main.js`, `js/router.js`, `tests/e2e/server.mjs`, `tests/e2e/boot.test.mjs`, `tests/smoke.test.mjs`

**Interfaces:**
- Produces: `createRouter(root: HTMLElement) -> { register(name, scene), show(name, params), current }`. 장면은 `{ mount(root, params, ctx) -> unmount() }` 모양이다. `ctx = { router, store, getState, setState }`(store와 state는 Task 5·6에서 채움).
- Produces: `startServer(port=0) -> Promise<{ url, close() }>` (`tests/e2e/server.mjs`, 저장소 루트를 정적으로 제공).

- [ ] **Step 1: `package.json` 작성** — `"type": "module"`, scripts `"test": "node --test tests/*.test.mjs"`, `"test:e2e": "node --test tests/e2e/*.test.mjs"`, devDependencies `"playwright": "1.56.1"`. `npm install`.
- [ ] **Step 2: 실패하는 화면 검사 작성** — `tests/e2e/boot.test.mjs`: 서버를 띄우고 `/`를 열어 `document.title === '말빛 한울'`, `#app`이 있고, 콘솔 오류가 0개인지 본다.
- [ ] **Step 3: 실패 확인** — Run: `npm run test:e2e` / Expected: FAIL (index.html 없음).
- [ ] **Step 4: `index.html`, `css/game.css`(Global Constraints의 색을 `:root` 변수로), `js/router.js`, `js/main.js`(빈 장면 하나를 보여 줌) 작성.** `vercel.json`에는 `/assets/(.*)`에 `Cache-Control: public, max-age=31536000, immutable`. 워크플로는 push·PR에서 `npm ci`, `npm test`, `npx playwright install --with-deps chromium`, `npm run test:e2e`.
- [ ] **Step 5: `tests/smoke.test.mjs`에 `createRouter` 단위 검사** — root는 `{}`, 장면은 호출 기록만 남기는 가짜 객체로: `show('a')` 뒤 `show('b')`면 기록이 `['a:mount', 'a:unmount', 'b:mount']`, `current === 'b'`.
- [ ] **Step 6: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: PASS.
- [ ] **Step 7: Commit** — `git commit -m "chore: scaffold static web app, router and test harness"`

---

### Task 2: 조사와 닉네임 규칙

**Files:** Create `js/rules/josa.js`, Test `tests/josa.test.mjs`

**Interfaces:**
- Produces: `hasBatchim(ch: string) -> boolean` (한글 완성형만 판별, 그 밖은 false)
- Produces: `attachJosa(name: string, kind: '아'|'이'|'은'|'을') -> string` (`'아'`→아/야, `'이'`→이/가, `'은'`→은/는, `'을'`→을/를)
- Produces: `formatLine(text: string, nickname: string) -> string` (`{이름}`, `{이름|아}` 등 바꾸기)
- Produces: `validateNickname(raw: string) -> { ok: true, value } | { ok: false, error }`

- [ ] **Step 1: 실패하는 검사 작성**

```js
test('받침에 맞는 조사', () => {
  assert.equal(attachJosa('서준', '아'), '서준아');
  assert.equal(attachJosa('서준', '이'), '서준이');
  assert.equal(attachJosa('지우', '아'), '지우야');
  assert.equal(attachJosa('지우', '이'), '지우가');
  assert.equal(attachJosa('하늘', '은'), '하늘은');
  assert.equal(attachJosa('지우', '을'), '지우를');
  assert.equal(attachJosa('Tom', '아'), 'Tom야');   // 영문 끝 = 받침 없음
  assert.equal(attachJosa('민수7', '이'), '민수7가'); // 숫자 끝 = 받침 없음
});
test('대사 서식', () => {
  assert.equal(formatLine('기다렸단다, {이름|아}.', '하늘'), '기다렸단다, 하늘아.');
  assert.equal(formatLine('{이름}의 주머니', '지우'), '지우의 주머니');
});
test('닉네임 검사', () => {
  assert.deepEqual(validateNickname('  하늘 '), { ok: true, value: '하늘' });
  assert.equal(validateNickname('').ok, false);
  assert.equal(validateNickname('   ').ok, false);
  assert.equal(validateNickname('가나다라마바사').ok, false); // 7글자
  assert.equal(validateNickname('ㅎㅎ').ok, false);           // 자모만
  assert.equal(validateNickname('하늘!').ok, false);
  assert.equal(validateNickname('Sky12').ok, true);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL (모듈 없음)
- [ ] **Step 3: 구현** — 받침은 `(code - 0xAC00) % 28 !== 0`. 허용 글자 `/^[가-힣A-Za-z0-9]{1,6}$/`(앞뒤 공백은 자르고 판단). 오류 문구: 빈 이름 "이름을 적어 주세요.", 길이 "이름은 6글자까지 쓸 수 있어요.", 글자 "한글, 영어, 숫자만 쓸 수 있어요."
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: josa and nickname rules"`

---

### Task 3: 낱말 50개와 1장 데이터

**Files:** Create `data/words.js`, `data/chapters/ch1.js`, Test `tests/data.test.mjs`

**Interfaces:**
- Produces `data/words.js`: `export const WORDS: Array<{ id: string /* 낱말 그대로 */, word, meaning, example, chapter: 1..5 }>` — 설계 4절 표 50개를 그대로 옮긴다(5장은 '짜장' 대신 '나래').
- Produces `data/chapters/ch1.js`: `export default CHAPTER` with
  - `id: 1`, `title: '새벽골'`
  - `map: { rows: string[] }` — 32열 × 24행 문자 격자. `#` 막힘, `.` 길, `S` 시작, `F` 안개 문(막힘, 낱말 10개가 모이면 열림), `M` 몬스터, `a`~`e` 인물 자리.
  - `npcs: Array<{ id, slot: 'a'..'e', name, color, bust, lines: Line[], after: Line[] }>`, `Line = { who: 'npc'|'hero', face: 'base'|'joy'|'surprise'|'worry'|'laugh', text }`. 낱말은 `[[낱말]]`로 표시한다.
  - `quests: Array<{ id, title, words: string[] }>` + 마지막 `{ id: 'q-boss', title: '그림자를 물리쳐라', words: [] }`
  - `monster: { id: 'ch1', name: '안개 덩이' }`
  - `quizzes: Record<wordId, Quiz>`, `Quiz = { type: 'meaning'|'blank'|'usage', prompt, options: string[4], answer: 0..3 }`. `blank`의 prompt는 빈칸을 `___`로 쓴다.
- 1장 인물·퀘스트·문제 유형(이 배정을 그대로 쓴다):

| 인물(slot) | 이름 | 낱말 | 퀘스트 |
|---|---|---|---|
| dodam (a) | 도담 할머니 | 어스름, 오롯이 | q1 할머니의 부탁: 말빛 주머니 받기 |
| daon (b) | 다온(마을 아이) | 매무새, 손사래 | q1 |
| baker (c) | 빵집 아저씨 | 부리나케, 짬 | q2 마을 사람들의 빛 잃은 말 |
| laundry (d) | 빨래터 아주머니 | 아침나절, 곰비임비 | q2: 아침나절 / q3: 곰비임비 |
| gate (e) | 어귀 할아버지 | 얼추, 해거름 | q3 해거름 전에 마을 어귀로 |

  문제 유형: 뜻 고르기 = 어스름, 아침나절, 해거름, 짬 · 빈칸 = 얼추, 부리나케, 매무새 · 문장 고르기 = 손사래, 오롯이, 곰비임비. 대사는 설계 3절 1장 줄거리(말이 엉망이 된 마을, 말빛 주머니)를 따르고, 인물마다 3~6줄, 한 줄 한 문장·28자 안팎 2줄 이내, 최소 한 줄은 `{이름…}`을 쓴다. 문제 문장은 설계 4절 예문과 달라야 한다. 아래 모서리 3×3칸에는 인물·몬스터·출구를 두지 않는다.

- [ ] **Step 1: 실패하는 검사 작성** (`tests/data.test.mjs`)

```js
test('낱말 50개, 장마다 10개, 중복 없음', () => {
  assert.equal(WORDS.length, 50);
  for (let c = 1; c <= 5; c++) assert.equal(WORDS.filter(w => w.chapter === c).length, 10);
  assert.equal(new Set(WORDS.map(w => w.id)).size, 50);
  assert.ok(WORDS.some(w => w.id === '나래') && !WORDS.some(w => w.id === '짜장'));
});
test('1장 낱말은 대사에 [[ ]]로 나오고 퀘스트 묶음과 같다', () => { /* ch1 10개 ⊆ 대사 표시, quests words 합집합 == ch1 10개, 대사의 [[x]]는 모두 1장 낱말 */ });
test('1장 퀴즈: 10개, 보기 4개 서로 다름, 정답 하나, 예문과 다른 문장', () => { /* options.length===4, new Set(options).size===4, 0<=answer<4, prompt !== word.example */ });
test('1장 문제 유형 배정 4·3·3', () => { /* meaning 4, blank 3, usage 3 */ });
test('맵: 32×24, 시작 1개, 몬스터 1개, 인물 a~e, 아래 모서리 비움', () => { /* rows 길이, 문자 집합, 모서리 3×3에 a-e/M/S 없음 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: `data/words.js`와 `data/chapters/ch1.js` 작성** (위 표와 규칙대로)
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "content: 50 words and chapter 1 data"`

---

### Task 4: 시드 난수, 맵 격자, 배율

**Files:** Create `js/rules/rng.js`, `js/explore/grid.js`, `js/explore/scale.js`, Test `tests/grid.test.mjs`

**Interfaces:**
- Produces: `makeRng(seed: number) -> () => number` (0 이상 1 미만, mulberry32), `shuffle(arr, rng) -> new array`
- Produces: `parseMap(rows: string[]) -> { w, h, start: {x,y}, monster: {x,y}, slots: Record<'a'..'e', {x,y}>, fog: {x,y}[], tileAt(x,y) -> char }`
- Produces: `isWalkable(map, x, y, { fogOpen: boolean }) -> boolean` — `.` `S`는 걸을 수 있음. `#`, 인물 자리, `M`은 못 걸음. `F`는 `fogOpen`일 때만.
- Produces: `step(map, pos, dir: 'up'|'down'|'left'|'right', opts) -> { pos, facing }` (막히면 제자리, 방향만 바뀜)
- Produces: `facingTarget(map, pos, facing) -> { kind: 'npc', slot } | { kind: 'monster' } | { kind: 'fog' } | null`
- Produces: `reachable(map, from, opts) -> Set<'x,y'>` (BFS, 걸을 수 있는 칸 기준)
- Produces: `computeScale(vw, vh, dpr) -> { scale, cssWidth, cssHeight }` (Global Constraints 공식)

- [ ] **Step 1: 실패하는 검사 작성**

```js
test('배율', () => {
  assert.deepEqual(computeScale(1366, 680, 1), { scale: 3, cssWidth: 1152, cssHeight: 648 });
  assert.equal(computeScale(1024, 768, 2).scale, 4);
  assert.equal(computeScale(300, 150, 1).scale, 1); // 최소 1
});
test('막힌 칸은 제자리, 방향만 바뀜', () => { /* 작은 3×3 맵으로 */ });
test('안개 문은 열렸을 때만 지나감', () => { /* fogOpen false → 제자리, true → 이동 */ });
test('1장 맵: 시작에서 모든 인물 옆 칸에 닿고, 안개가 열리면 몬스터 옆 칸에도 닿는다', () => {
  const m = parseMap(CH1.map.rows);
  const closed = reachable(m, m.start, { fogOpen: false });
  for (const s of Object.values(m.slots)) assert.ok(neighbors(s).some(n => closed.has(`${n.x},${n.y}`)));
  assert.ok(!neighbors(m.monster).some(n => closed.has(`${n.x},${n.y}`))); // 안개가 막고 있다
  const open = reachable(m, m.start, { fogOpen: true });
  assert.ok(neighbors(m.monster).some(n => open.has(`${n.x},${n.y}`)));
});
test('shuffle는 같은 시드면 같은 순서', () => { /* */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현** (`neighbors`는 검사 파일 안의 작은 도우미)
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: grid movement, reachability and pixel scaling"`

---

### Task 5: 게임 상태 규칙

**Files:** Create `js/rules/game.js`, Test `tests/game.test.mjs`

**Interfaces:**
- Consumes: `CHAPTER` 모양(Task 3), `parseMap`(Task 4)
- Produces: `newGame({ nickname, avatar: 'f'|'m' }) -> GameState`
  `GameState = { version: 1, nickname, avatar, chapter: 1, pos: {x,y}, facing: 'down', acquired: Record<wordId, { npcId }>, askedWordIds: string[], clearedChapters: number[], seenTips: string[] }` (`pos`는 1장 맵의 `S`)
- Produces: `acquireWord(state, wordId, npcId) -> GameState` (이미 있으면 그대로)
- Produces: `chapterWords(chapterId) -> string[]` (WORDS에서)
- Produces: `acquiredCount(state, chapterId) -> number`
- Produces: `questList(state, chapter) -> Array<{ id, title, got, total, done }>` (`q-boss`는 장 클리어 때 done)
- Produces: `currentQuest(state, chapter) -> { id, title }` (아직 안 끝난 첫 퀘스트)
- Produces: `npcPending(state, npc) -> boolean` (그 인물 대사의 `[[ ]]` 낱말 중 안 얻은 게 있으면 true)
- Produces: `fogOpen(state, chapter) -> boolean` (그 장 10개 모두 얻음)
- Produces: `finishChapter(state, chapterId, askedIds: string[]) -> GameState` (askedWordIds에 추가, clearedChapters에 추가)
- Produces: `setPos(state, pos, facing) -> GameState`, `markTip(state, tipId) -> GameState`

- [ ] **Step 1: 실패하는 검사 작성**

```js
test('새 게임은 1장 시작 칸에서 시작', () => { /* pos === parseMap(CH1.map.rows).start, acquired {} */ });
test('낱말 습득은 한 번만 세고 퀘스트가 진행된다', () => {
  let s = newGame({ nickname: '하늘', avatar: 'f' });
  s = acquireWord(s, '어스름', 'dodam'); s = acquireWord(s, '어스름', 'dodam');
  assert.equal(acquiredCount(s, 1), 1);
  assert.deepEqual(questList(s, CH1)[0], { id: 'q1', title: CH1.quests[0].title, got: 1, total: 4, done: false });
});
test('10개를 다 모으면 안개가 열리고 현재 퀘스트는 q-boss', () => { /* */ });
test('인물 표시: 그 인물 낱말을 다 얻으면 npcPending false', () => { /* */ });
test('출제 기록은 finishChapter에서만 남는다 (전투 중 새로 고침 대비)', () => {
  const s = newGame({ nickname: '하늘', avatar: 'f' });
  assert.deepEqual(s.askedWordIds, []);
  const t = finishChapter(s, 1, chapterWords(1));
  assert.equal(t.askedWordIds.length, 10); assert.deepEqual(t.clearedChapters, [1]);
});
test('상태 함수는 원래 상태를 바꾸지 않는다', () => { /* Object.freeze 깊은 동결 후 호출 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현** (`[[낱말]]` 추출 정규식 `/\[\[(.+?)\]\]/g`는 여기서 `extractWords(text) -> string[]`로 내보내 Task 10에서도 쓴다)
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: game state rules for words, quests and fog gate"`

---

### Task 6: 저장소

**Files:** Create `js/save.js`, Test `tests/save.test.mjs`

**Interfaces:**
- Produces: `createStore(storage: Storage | null) -> Store`
  `Store = { available: boolean, names() -> string[], load(nickname) -> { ok: true, state } | { ok: false, reason: 'missing'|'corrupt' }, save(state) -> boolean, has(nickname) -> boolean }`
- `storage`가 null이거나 시험 쓰기에서 예외가 나면 `available: false`. `save`가 예외를 만나면 `false`를 돌려주고 `available`을 false로 바꾼다(게임은 계속).
- `load`는 JSON이 깨졌거나 `version !== 1`이거나 필수 필드가 없으면 `corrupt`이고, 그 키를 지우지 않는다.

- [ ] **Step 1: 실패하는 검사 작성** — 메모리 storage 가짜(`getItem/setItem/removeItem`)로:
  - 저장 뒤 불러오면 `deepEqual`
  - `names()`에 닉네임이 한 번만 들어감
  - 깨진 JSON → `{ ok:false, reason:'corrupt' }`이고 원래 문자열이 그대로 남아 있음
  - `version: 0` → corrupt
  - `createStore(null).available === false`, `save()`가 false
  - setItem이 두 번째 호출부터 예외를 던지는 storage → 두 번째 `save`가 false, 예외가 밖으로 나오지 않음, 그 뒤 `available === false` **(Review Focus 5)**
- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현** (키는 Global Constraints대로)
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: per-nickname save store with corrupt and unavailable handling"`

---

### Task 7: 전투 규칙

**Files:** Create `js/rules/battle.js`, Test `tests/battle.test.mjs`

**Interfaces:**
- Consumes: `shuffle`, `makeRng`(Task 4)
- Produces: `createBattle({ wordIds: string[], seed: number, finalWordId?: string }) -> Battle`
  `Battle = { order: string[], index: 0, hearts: 5, hp: 6, correct: 0, wrong: 0, streak: 0, result: null|'win'|'lose', finalWordId }` — `finalWordId`가 있으면 그 낱말은 늘 `order`의 마지막.
- Produces: `currentWord(b) -> string | null`
- Produces: `answer(b, isCorrect: boolean) -> Battle` — 맞으면 hp−1·correct+1·streak+1, 틀리면 hearts−1·wrong+1·streak=0. hearts 0 → `lose`, hp 0 → `win`. `finalWordId`가 있을 때: 마지막 낱말 전에는 hp가 1 아래로 내려가지 않고, 마지막 낱말을 맞혀야 `win`. 마지막 낱말을 틀리고 `lose`가 아니면 같은 낱말을 다시 낸다(index 그대로). 결과가 나면 그 뒤 `answer`는 상태를 바꾸지 않는다.
- Produces: `retry(b, seed) -> Battle` — 같은 낱말 집합으로 새 전투(순서만 섞음, `finalWordId` 유지).
- Produces: `optionOrder(quiz, rng) -> { options: string[4], answer: number }` (보기 섞기, 정답 위치 따라감)

- [ ] **Step 1: 실패하는 검사 작성**

```js
const ten = chapterWords(1);
test('6개 맞히면 승리', () => { let b = createBattle({ wordIds: ten, seed: 1 }); for (let i = 0; i < 6; i++) b = answer(b, true); assert.equal(b.result, 'win'); assert.equal(b.index, 6); });
test('5개 틀리면 게임 오버', () => { /* hearts 0, result lose */ });
test('어떤 맞힘·틀림 순서든 10문제 안에 승패가 난다', () => {
  for (let mask = 0; mask < 1024; mask++) { let b = createBattle({ wordIds: ten, seed: mask });
    for (let i = 0; i < 10 && !b.result; i++) b = answer(b, !!(mask >> i & 1));
    assert.ok(b.result, `mask ${mask}`); }
});
test('각 낱말은 한 번씩만 나온다', () => { /* 끝날 때까지 currentWord 모아 중복 없음 */ });
test('연속 정답은 피해를 늘리지 않는다', () => { /* 맞힘 3번 뒤 hp === 3, streak === 3 */ });
test('재도전은 같은 낱말 10개, 하트·HP 초기화', () => { /* new Set(retry(b,2).order) == new Set(b.order) */ });
test('보스: 나래는 마지막, 그 전에는 HP 1에서 멈춤, 나래를 맞혀야 승리', () => {
  const ids = [...chapterWords(5)]; let b = createBattle({ wordIds: ids, seed: 3, finalWordId: '나래' });
  assert.equal(b.order.at(-1), '나래');
  for (let i = 0; i < 9; i++) b = answer(b, true);
  assert.equal(b.hp, 1); assert.equal(b.result, null); assert.equal(currentWord(b), '나래');
  b = answer(b, false); assert.equal(currentWord(b), '나래'); assert.equal(b.result, null);
  b = answer(b, true); assert.equal(b.result, 'win');
});
test('optionOrder는 정답 보기를 따라간다', () => { /* options[answer] === quiz.options[quiz.answer] */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: battle rules with boss final-word handling"`

---

### Task 8: 탐험 화면(캔버스, 입력, HUD, 안개 문)

**Files:** Create `js/explore/input.js`, `js/explore/render.js`, `js/ui/placeholder.js`, `js/scenes/explore.js`; Modify `js/main.js`, `css/game.css`; Test `tests/input.test.mjs`

**Interfaces:**
- Consumes: Task 4 grid·scale, Task 5 상태 함수
- Produces: `bindInput(target: EventTarget, handlers: { move(dir), talk(), codex(), quests() }) -> unbind()` — 방향키·WASD → move, 스페이스·엔터 → talk, E → codex, Q → quests. 키를 누르고 있으면 150ms마다 한 칸(`repeatMs = 150`). `pointer: coarse`일 때만 화면에 방향 버튼(3×56px 십자)과 말하기 버튼(지름 96px)을 그린다.
- Produces: `drawExplore(ctx2d, { map, state, chapter, fogOpen, camera })` — 임시 그림: 막힘 `#2F6B3A`, 길 `#D9A55B`, 안개 `#B9BBBE` 디더 체크무늬, 인물은 대표색 16×24 블록 + 이름 첫 글자, 주인공 쪽빛 블록, 몬스터 잿빛 원. `npcPending`인 인물 머리 위에 말풍선 표시(흰 바탕, 먹색 1px 윤곽). 카메라는 주인공을 가운데 두되 맵 밖으로 나가지 않게 고정.
- Produces: 탐험 장면 `exploreScene` — HUD(위쪽 48px 한지 띠: 왼쪽 초록 점 + `currentQuest` 제목, 오른쪽 "이 장의 낱말 n/10", 도감 E·퀘스트 Q 버튼). 말 걸기: `facingTarget`이 npc면 `router.show('dialogue', { npcId })`, monster면 `router.show('battle')`, fog면 "아직 찾지 못한 낱말이 n개 있어." 토스트(2초). 이동할 때마다 `setPos` 후 저장하지 않고, 장면이 바뀔 때 저장한다.
- 처음 하는 학생 안내: `seenTips`에 없으면 "방향키로 걸어 보세요"(움직이면 사라짐), 첫 인물 쪽 화살표 표시.
- Produces (`?test=1`일 때만, `js/main.js`): `window.__test = { state(), newGame(nickname, avatar), acquire(wordId, npcId) }`. Task 12·13이 함수를 더한다. 일반 주소에서는 만들지 않는다.

- [ ] **Step 1: 실패하는 검사 작성** — `tests/input.test.mjs`: `EventTarget`에 `KeyboardEvent` 대신 `{ key }`를 담은 `Event` 하위 객체를 보내 `ArrowUp`·`w` → `move('up')`, `' '`·`Enter` → `talk()`, `e`·`E` → `codex()`. 누르고 있는 반복은 가짜 타이머(`mock.timers`)로 150ms 간격 확인.
- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현** (input, placeholder, render, explore 장면, main.js에 등록)
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: 화면 확인** — `?test=1`로 열고 `window.__test.newGame('하늘','f')` 뒤 캔버스가 1152×648(1366×768 창)인지, HUD 문구가 "이 장의 낱말 0/10"인지 Playwright 스크린샷으로 확인(`tests/e2e/explore.test.mjs`).
- [ ] **Step 6: Commit** — `git commit -m "feat: explore scene with grid movement, HUD and fog gate"`

---

### Task 9: 시작 화면

**Files:** Create `js/scenes/title.js`; Modify `js/main.js`, `css/game.css`; Test `tests/title.test.mjs`

**Interfaces:**
- Consumes: `validateNickname`(Task 2), `createStore`(Task 6), `newGame`(Task 5)
- Produces: `shouldSubmit(event: { key, isComposing }) -> boolean` (`key === 'Enter' && !isComposing`)
- Produces: `titleDecision({ nickname, avatar, choice: 'new'|'continue', store }) -> { action: 'start', state } | { action: 'ask-overwrite' } | { action: 'load-error' } | { action: 'invalid', error }` — 시작 화면의 판단만 순수 함수로 뺀다.
- 화면: 제목 "말빛 한울"(주아 72px), 닉네임 칸(화면 위쪽 절반, 1~6글자 안내), 모습 카드 2장(그림 + "남"/"여" 글자), 저장된 닉네임 버튼들(48px), "처음부터"·"이어하기". `store.available === false`면 "이 창에서는 저장되지 않아요" 안내.
- 'load-error'면 "저장을 불러오지 못했어요. 처음부터 할까요?" 확인창(예: 새 게임 덮어쓰기 / 아니오: 그대로).

- [ ] **Step 1: 실패하는 검사 작성**

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

### Task 10: 대화 화면과 낱말 습득

**Files:** Create `js/scenes/dialogue.js`; Modify `css/game.css`; Test `tests/dialogue.test.mjs`

**Interfaces:**
- Consumes: `formatLine`(Task 2), `extractWords`·`acquireWord`·`npcPending`(Task 5), `WORDS`(Task 3)
- Produces: `splitHighlights(text: string) -> Array<{ text, word?: string }>` (`[[x]]` 조각 나누기)
- Produces: `createTypewriter({ full: string, msPerChar: 30 }) -> { shown(): string, done(): boolean, press() -> 'reveal'|'next'|'ignored', tick(ms) }` — 첫 press는 끝까지 보이기, 다 보인 뒤 200ms 안의 press는 `'ignored'`, 그 뒤 press는 `'next'`.
- 화면(아트 바이블 7절 대화, 시안 `dialogue2.png`): 배경(임시: 장 색 그라데이션), 두 상반신 임시 블록(같은 높이, 듣는 쪽 `filter: brightness(.62) saturate(.7)`), 화면 폭 대사 상자(좌우 40px, 높이 190px), 이름표는 말하는 쪽 위 + 대표색 4px 띠, 오른쪽 아래 ▼. 고유어는 먹색 글자 + 아래 40% 금빛 띠, 나타날 때 빛 알갱이 한 번.
- 낱말이 있는 문장이 다 보이면 뜻풀이 카드("새 낱말을 찾았다!", 낱말 40px, 뜻 22px, '확인'으로만 닫힘)를 띄우고 `acquireWord` 후 저장. 이미 얻은 낱말은 카드 없이 띠만.
- 처음 고유어가 나올 때 `seenTips`에 없으면 "반짝이는 낱말을 눌러 보세요"를 한 번 띄운다.
- 인물의 낱말을 다 얻은 뒤 다시 말을 걸면 `after` 줄만 보여 준다. 대화가 끝나면 `router.show('explore')`.

- [ ] **Step 1: 실패하는 검사 작성**

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
test('1장 모든 대사 줄은 닉네임을 넣은 뒤 56자 이하', () => { /* formatLine(text,'가나다라마바') 길이 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: dialogue scene with typewriter, word highlight and meaning card"`

---

### Task 11: 도감과 퀘스트 오버레이

**Files:** Create `js/scenes/codex.js`, `js/scenes/quests.js`; Modify `js/scenes/explore.js`, `css/game.css`; Test `tests/e2e/overlays.test.mjs`

**Interfaces:**
- Consumes: `questList`(Task 5), `WORDS`
- Produces: `openCodex(root, state, { chapterTab = state.chapter }) -> close()`, `openQuests(root, state, chapter) -> close()`
- 도감: 장별 탭 5개, 2×5 격자. 얻은 낱말 카드는 낱말·뜻·예문·만난 인물. 못 얻은 칸은 "?" 모양(회색만으로 표시하지 않음). Esc·E·닫기 버튼으로 닫힘. 전투 중에는 열리지 않는다(탐험 장면에서만 바인딩).
- 퀘스트: 진행 중은 "n/m", 완료는 초록 + 체크 아이콘 + "완료" 글자.

- [ ] **Step 1: 실패하는 화면 검사 작성** — `?test=1`에서 새 게임 → `__test.acquire('어스름','dodam')` → E를 누르면 1장 탭에 "어스름" 카드 1장과 "?" 9칸, Q를 누르면 q1이 "1/4".
- [ ] **Step 2: 실패 확인** — Run: `npm run test:e2e` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: codex and quest overlays"`

---

### Task 12: 전투 화면, 게임 오버, 장 클리어

**Files:** Create `js/scenes/battle.js`, `js/scenes/gameover.js`, `js/scenes/clear.js`; Modify `css/game.css`, `js/main.js`; Test `tests/e2e/battle.test.mjs`

**Interfaces:**
- Consumes: Task 7 전투 규칙, `chapterWords`, `finishChapter`, `CHAPTER.quizzes`, `openCodex`(게임 오버 다시 보기)
- 화면(아트 바이블 7절 전투, 시안 `b3a~c.png`):
  - 무대: 장 배경 임시 그라데이션을 잿빛으로, 가장자리 안개 비네트. 왼쪽 주인공 전투 자세 임시 블록, 오른쪽 몬스터 임시 원 + 위에 이름표 "안개 덩이"와 HP 6칸(줄어든 칸은 점선).
  - 아래 묶음(화면 아래에 붙음, 무대는 남은 높이): 주인공 이름표 + 하트 5개(빈 하트는 속 빈 모양) → 문제 상자(몬스터 말풍선, 왼쪽 위 몬스터 이름, 오른쪽 위 유형 이름, 28px) → 보기. **문제와 보기 사이 간격 12px.**
  - 보기: `blank` 카드 4장 가로(110px, 32px), `meaning` 2×2(72px), `usage` 1열(48px, 22px). 번호 원 1~4, 숫자키 1~4.
  - 누르면 바로 잠근다(같은 문제에 두 번째 입력 무시). ○/× 100ms 안. 맞으면 빈칸에 금빛 띠로 낱말, 빛줄기, HP 칸 금빛으로 갈라짐(0.8초 이하). 틀리면 안개가 조여 들고 하트 금 감 → 정답·뜻 표시 → '다음'.
  - 연속 2번 이상이면 "연속 n번 맞힘!" 표와 굵은 빛줄기. 피해는 그대로.
  - `prefers-reduced-motion`이면 흔들림·빛줄기 대신 서서히 나타나기.
- 승리: `finishChapter(state, 1, b.order)` → 저장 → `router.show('clear')`("1장 클리어!" + 도감 10장 + "다음 장은 준비 중이에요").
- 패배: `router.show('gameover')` → "안개에 휩싸였다…" → 도감 1장 탭 다시 보기 → "다시 도전"(처음부터 초점) → `retry`로 새 전투.
- 첫 전투 전에 `seenTips`에 없으면 규칙 한 장("하트 5개, 몬스터 6칸. 6번 맞히면 이겨요.")을 보여 준다.

- Produces (`?test=1`): `__test.startBattle()`(1장 낱말 10개를 모두 얻은 상태로 전투 시작), `__test.answerIndex() -> number`(지금 문제의 정답 보기 번호 0~3).

- [ ] **Step 1: 실패하는 화면 검사 작성** (`?test=1`, `__test.startBattle()`로 1장 전투 바로 시작)
  - 정답만 6번 고르면 clear 화면, 저장의 `askedWordIds` 길이 10, `clearedChapters` [1]
  - 오답만 5번 고르면 gameover 화면 → "다시 도전" → 하트 5, HP 6, 낱말 집합은 같음
  - **보기를 `dblclick`해도 correct+wrong 합이 1만 늘어난다 (Review Focus 2)**
  - 문제 상자 아래 끝과 첫 보기 위 끝의 거리가 12±2px (세 유형 모두)
- [ ] **Step 2: 실패 확인** — Run: `npm run test:e2e` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm run test:e2e` / Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: battle scene with three answer layouts, game over and chapter clear"`

---

### Task 13: 검사 도움 기능과 1장 끝까지 화면 검사

**Files:** Modify `js/main.js`; Create `tests/e2e/chapter1.test.mjs`

**Interfaces:**
- Produces (`?test=1`일 때만, Task 8·12의 것에 더함): `__test.teleportTo(slot: 'a'..'e'|'monster')`(그 대상과 맞닿은 걸을 수 있는 칸으로 옮기고 대상을 보게 함), `__test.skipDialogue()`, `__test.fastText(on: boolean)`(타자 효과 0ms).
- 일반 주소에서는 `window.__test === undefined`이고 화면에 아무것도 나타나지 않는다.

- [ ] **Step 1: 실패하는 화면 검사 작성** (`tests/e2e/chapter1.test.mjs`)
  - 끝까지 플레이: 닉네임 "하늘" 입력(키보드 입력) → 여 선택 → 처음부터 → 인물 a~e 차례로 `teleportTo` 후 스페이스 → 대사 넘기기(스페이스) → 뜻풀이 카드 '확인' → HUD가 10/10 → `teleportTo('monster')` 후 스페이스 → 정답 6번(`answerIndex`로 고름) → "1장 클리어!"
  - 안개 문: 낱말 9개일 때 몬스터 쪽 안개에 말 걸면 "아직 찾지 못한 낱말이 1개 있어." 토스트
  - 새로 고침 뒤 이어하기: 낱말 3개 얻은 뒤 새로 고침 → "하늘" 버튼 → 이어하기 → HUD 3/10, 같은 위치
  - **전투 중 새로 고침 (Review Focus 3)**: 전투에서 2문제 푼 뒤 새로 고침 → 이어하기 → 탐험 화면이고 `askedWordIds`는 비어 있음 → 다시 전투 → 하트 5, HP 6
  - 일반 주소(`/`)에서 `window.__test === undefined`
- [ ] **Step 2: 실패 확인** — Run: `npm run test:e2e` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run test:e2e` / Expected: 모두 PASS
- [ ] **Step 5: 1366×768, 1024×768(dpr 2) 스크린샷을 `docs/screenshots/ch1/`에 남겨 선생님께 보낸다.**
- [ ] **Step 6: Commit** — `git commit -m "test: chapter 1 end-to-end playthrough and test hooks"`
