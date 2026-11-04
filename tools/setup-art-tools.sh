#!/usr/bin/env bash
# 그림 도구 설치: sprite-gen(Apache-2.0) + Codex CLI.
# 클라우드 작업 환경은 매번 새로 만들어지므로, 그림을 만들기 전에 한 번 실행한다.
# 실행 뒤 구독 계정 로그인: codex login --device-auth
set -euo pipefail

SPRITE_GEN_REF="4f5ccd55c7cf06685a41f954acc1e476b7772ece"   # 검토한 커밋으로 고정
SPRITE_GEN_ROOT="${SPRITE_GEN_ROOT:-$HOME/.local/share/sprite-gen}"
CODEX_VERSION="${CODEX_VERSION:-latest}"

if [ ! -d "$SPRITE_GEN_ROOT/.git" ]; then
  mkdir -p "$(dirname "$SPRITE_GEN_ROOT")"
  git clone --filter=blob:none https://github.com/aldegad/sprite-gen.git "$SPRITE_GEN_ROOT"
fi
git -C "$SPRITE_GEN_ROOT" fetch -q --depth 1 origin "$SPRITE_GEN_REF"
git -C "$SPRITE_GEN_ROOT" checkout -q "$SPRITE_GEN_REF"

[ -x "$SPRITE_GEN_ROOT/.venv/bin/python" ] || python3 -m venv "$SPRITE_GEN_ROOT/.venv"
"$SPRITE_GEN_ROOT/.venv/bin/pip" install -q -e "$SPRITE_GEN_ROOT"

# 사용자 스킬로 연결해 Claude Code가 sprite-gen 스킬을 읽게 한다.
mkdir -p "$HOME/.claude/skills"
ln -sfn "$SPRITE_GEN_ROOT" "$HOME/.claude/skills/sprite-gen"

command -v codex >/dev/null 2>&1 || npm install -g "@openai/codex@${CODEX_VERSION}"

echo "sprite-gen: $SPRITE_GEN_ROOT ($("$SPRITE_GEN_ROOT/.venv/bin/sprite-gen" --version 2>/dev/null || echo installed))"
echo "codex: $(codex --version)"
echo "다음 단계: export SPRITE_GEN_ROOT=$SPRITE_GEN_ROOT && codex login --device-auth"
