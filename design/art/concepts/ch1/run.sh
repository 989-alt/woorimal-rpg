#!/usr/bin/env bash
export SPRITE_GEN_ROOT=/root/.local/share/sprite-gen
G="$SPRITE_GEN_ROOT/.venv/bin/sprite-gen gen --provider codex"
cd "$(dirname "$0")"; mkdir -p out
run(){ n=$1; shift; echo "[$(date +%T)] start $n"; $G --prompt-file prompts/$n.txt --out out/$n.png --report out/$n.json "$@" > out/$n.log 2>&1; echo "[$(date +%T)] end $n exit=$?"; }
run map --aspect-ratio 16:9 &
run bg_ch1 --aspect-ratio 16:9 &
wait
run bust_hero_f --aspect-ratio 3:4 --transparent --chroma-key magenta &
run bust_dodam --aspect-ratio 3:4 --transparent --chroma-key magenta &
wait
run bust_hero_m --aspect-ratio 3:4 --transparent --chroma-key magenta &
run monster_ch1 --aspect-ratio 1:1 --transparent --chroma-key magenta &
wait
run pixel_chars --aspect-ratio 3:2 --transparent --chroma-key magenta
echo ALLDONE
