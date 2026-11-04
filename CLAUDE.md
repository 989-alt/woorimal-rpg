# 말빛 한울 (가제) — 작업 안내

초등 6학년용 고유어 학습 웹 RPG. 설계: `docs/superpowers/specs/2026-11-04-woorimal-rpg-design.md` (이 문서가 기준).

## 원칙
- 빌드 없는 정적 웹앱(HTML, CSS, 순수 JS 모듈). Vercel 배포. 서버·로그인·소리 없음.
- 규칙은 `js/state.js` 순수 함수, 내용(낱말·대사·퀘스트·맵)은 `data/`에만 둔다.
- 학생이 읽는 글은 6학년 눈높이의 쉬운 한국어로 쓴다. 고유어 뜻은 표준국어대사전에 근거한다.
- 장르만 빌려 오고 기존 게임의 이름·인물·그림·화면을 흉내 내지 않는다.

## 도구
- `.claude/agents`, `.claude/skills`: Claude-Code-Game-Studios(MIT)의 디자인 에이전트·스킬만 가져왔다.
  스킬이 말하는 `design/`, `production/` 문서 경로는 이 저장소에서도 그대로 쓴다. 훅은 등록하지 않았다.
  엔진(Godot/Unity/Unreal) 관련 지시는 이 프로젝트(순수 웹)에 맞지 않으므로 따르지 않는다.
- `reference/game-dev-agentic-skills/`: Godot용 참고 문서(LGPL-3.0). 설계 참고로만 읽고 코드를 옮겨 오지 않는다.
- 그림: `tools/setup-art-tools.sh`로 sprite-gen과 Codex CLI를 설치하고 `codex login --device-auth`로 구독 로그인한다.
  그림은 1막 것을 먼저 만들어 선생님 확인을 받은 뒤 나머지를 만든다.

## 검사
- `npm test` (node --test), `npm run test:e2e` (Playwright)
