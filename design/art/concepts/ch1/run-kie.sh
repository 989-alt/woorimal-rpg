#!/usr/bin/env bash
cd "$(dirname "$0")"; mkdir -p out
K="python3 -I ../../../../tools/kie-gen.py"
run(){ n=$1; shift; echo "[$(date +%T)] start $n"; $K --prompt-file prompts/$n.txt --out out/$n.png "$@" > out/$n.log 2>&1; echo "[$(date +%T)] end $n exit=$?"; }
run map --aspect 16:9 --resolution 1K &
run bg_ch1 --aspect 16:9 --resolution 2K &
run bust_hero_f --aspect 3:4 --resolution 2K &
run bust_hero_m --aspect 3:4 --resolution 2K &
run bust_dodam --aspect 3:4 --resolution 2K &
run monster_ch1 --aspect 1:1 --resolution 2K &
run pixel_chars --aspect 3:2 --resolution 1K --background transparent &
wait; echo ALLDONE
