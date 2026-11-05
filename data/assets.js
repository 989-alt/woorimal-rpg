// 그림 경로 목록. 값은 사이트 뿌리 기준 경로이고, 아직 없는 그림은 null이다.
// null이거나 불러오지 못하면 각 화면이 임시 그림(색 블록·그라데이션)으로 대신한다.
// 이름 규칙: assets/pixel|illust/종류_장_이름_변형.확장자, UI 키트는 assets/ui/이름.v1.png (art-bible 8절)
export const ASSETS = {
  // 탐험 맵(1536×1152, 칸당 48, 장 id)
  maps: { '1-1': 'assets/pixel/map_ch1-1_saebyeokgol.png', '1-2': 'assets/pixel/map_ch1-2_maeul-eogwi.png', '2-1': 'assets/pixel/map_ch2-1_neouljang.png', '2-2': 'assets/pixel/map_ch2-2_bukmun.png', '3-1': 'assets/pixel/map_ch3-1_supsok.png', '3-2': 'assets/pixel/map_ch3-2_yunseulnae.png', '4-1': 'assets/pixel/map_ch4-1_gogaetgil.png', '4-2': 'assets/pixel/map_ch4-2_gogaetmaru.png', '5-1': 'assets/pixel/map_ch5-1_tap-apttel.png', '5-2': 'assets/pixel/map_ch5-2_tap-kkokdaegi.png' },
  // 주인공 걷기 시트 144×384: 48×96칸 × 3프레임(서기·왼발·오른발) × 4방향(아래·왼·오·위) (f 여 · m 남)
  walk: { f: 'assets/pixel/walk_hero_f.png', m: 'assets/pixel/walk_hero_m.png' },
  // 인물 도트 48×96(그림 48×72쯤, 발이 맨 아래 줄 가운데) (인물 id)
  npcs: {
    dodam: 'assets/pixel/npc_dodam.png',
    daon: 'assets/pixel/npc_daon.png',
    gardener: 'assets/pixel/npc_gardener.png',
    baker: 'assets/pixel/npc_baker.png',
    laundry: 'assets/pixel/npc_laundry.png',
    gate: 'assets/pixel/npc_gate.png',
    // 2막
    haesol: 'assets/pixel/npc_haesol.png',
    fruit: 'assets/pixel/npc_fruit.png',
    guard: 'assets/pixel/npc_guard.png',
    shopper: 'assets/pixel/npc_shopper.png',
    chestnut: 'assets/pixel/npc_chestnut.png',
    flower: 'assets/pixel/npc_flower.png',
    northgate: 'assets/pixel/npc_northgate.png',
    narae: 'assets/pixel/npc_narae.png', woodcutter: 'assets/pixel/npc_woodcutter.png', miru: 'assets/pixel/npc_miru.png', yeoul: 'assets/pixel/npc_yeoul.png', skygran: 'assets/pixel/npc_skygran.png', ferryman: 'assets/pixel/npc_ferryman.png', // 3막
    tea: 'assets/pixel/npc_tea.png', garam: 'assets/pixel/npc_garam.png', signpost: 'assets/pixel/npc_signpost.png', keeper: 'assets/pixel/npc_keeper.png', traveler: 'assets/pixel/npc_traveler.png', // 4막
    greykid: 'assets/pixel/npc_greykid.png', // 5막
  },
  // 물건 아이콘 48×48 (물건 id)
  items: { water: 'assets/pixel/icon_water.png', firewood: 'assets/pixel/icon_firewood.png', letter: 'assets/pixel/icon_letter.png', 'price-board': 'assets/pixel/icon_price-board.png', weight: 'assets/pixel/icon_weight.png', bundle: 'assets/pixel/icon_bundle.png', 'trail-ribbon': 'assets/pixel/icon_trail-ribbon.png', lunchbox: 'assets/pixel/icon_lunchbox.png', 'rain-bowl': 'assets/pixel/icon_rain-bowl.png', 'warm-tea': 'assets/pixel/icon_warm-tea.png', 'pine-twigs': 'assets/pixel/icon_pine-twigs.png', 'bundle-strap': 'assets/pixel/icon_bundle-strap.png', bell: 'assets/pixel/icon_bell.png', 'light-shard': 'assets/pixel/icon_light-shard.png', lullaby: 'assets/pixel/icon_lullaby.png' },
  // 꼬마 몬스터 도트 48×96(발이 맨 아래 줄)·보스 도트 96×96(2×2칸, 발이 보스 칸 아래 줄 가운데) (막 번호)
  small: { 1: 'assets/pixel/monster_small_act1.png', 2: 'assets/pixel/monster_small_act2.png', 3: 'assets/pixel/monster_small_act3.png', 4: 'assets/pixel/monster_small_act4.png', 5: 'assets/pixel/monster_small_act5.png' },
  bossPixel: { 1: 'assets/pixel/monster_boss_act1.png', 2: 'assets/pixel/monster_boss_act2.png', 3: 'assets/pixel/monster_boss_act3.png', 4: 'assets/pixel/monster_boss_act4.png', 5: 'assets/pixel/monster_boss_act5.png' },
  // 대화 상반신: 인물 × 표정. 표정 그림이 없으면 base로 대신한다.
  busts: {
    hero_f: { base: 'assets/illust/bust_hero_f_base.webp', surprise: 'assets/illust/bust_hero_f_surprise.webp', joy: 'assets/illust/bust_hero_f_joy.webp' },
    hero_m: { base: 'assets/illust/bust_hero_m_base.webp', surprise: 'assets/illust/bust_hero_m_surprise.webp', joy: 'assets/illust/bust_hero_m_joy.webp' },
    dodam: { base: 'assets/illust/bust_dodam_base.webp', worry: 'assets/illust/bust_dodam_worry.webp', laugh: 'assets/illust/bust_dodam_laugh.webp' },
    daon: { base: 'assets/illust/bust_daon_base.webp', joy: 'assets/illust/bust_daon_joy.webp' },
    gardener: { base: 'assets/illust/bust_gardener_base.webp', joy: 'assets/illust/bust_gardener_joy.webp' },
    baker: { base: 'assets/illust/bust_baker_base.webp', joy: 'assets/illust/bust_baker_joy.webp' },
    laundry: { base: 'assets/illust/bust_laundry_base.webp', joy: 'assets/illust/bust_laundry_joy.webp' },
    gate: { base: 'assets/illust/bust_gate_base.webp', joy: 'assets/illust/bust_gate_joy.webp' },
    // 2막 (그림은 다음 계획에서)
    haesol: { base: 'assets/illust/bust_haesol_base.webp', pout: 'assets/illust/bust_haesol_pout.webp', surprise: 'assets/illust/bust_haesol_surprise.webp' },
    fruit: { base: 'assets/illust/bust_fruit_base.webp', joy: 'assets/illust/bust_fruit_joy.webp' },
    guard: { base: 'assets/illust/bust_guard_base.webp', joy: 'assets/illust/bust_guard_joy.webp' },
    shopper: { base: 'assets/illust/bust_shopper_base.webp' },
    chestnut: { base: 'assets/illust/bust_chestnut_base.webp', joy: 'assets/illust/bust_chestnut_joy.webp' },
    flower: { base: 'assets/illust/bust_flower_base.webp', joy: 'assets/illust/bust_flower_joy.webp' },
    northgate: { base: 'assets/illust/bust_northgate_base.webp' },
    // 3막
    narae: { base: 'assets/illust/bust_narae_base.webp', sad: 'assets/illust/bust_narae_sad.webp', surprise: 'assets/illust/bust_narae_surprise.webp', light: null },
    woodcutter: { base: 'assets/illust/bust_woodcutter_base.webp', joy: 'assets/illust/bust_woodcutter_joy.webp' },
    miru: { base: 'assets/illust/bust_miru_base.webp', joy: 'assets/illust/bust_miru_joy.webp' },
    yeoul: { base: 'assets/illust/bust_yeoul_base.webp', joy: 'assets/illust/bust_yeoul_joy.webp' },
    skygran: { base: 'assets/illust/bust_skygran_base.webp', joy: 'assets/illust/bust_skygran_joy.webp' },
    ferryman: { base: 'assets/illust/bust_ferryman_base.webp', joy: 'assets/illust/bust_ferryman_joy.webp' },
    // 4막
    tea: { base: 'assets/illust/bust_tea_base.webp', joy: 'assets/illust/bust_tea_joy.webp' },
    garam: { base: 'assets/illust/bust_garam_base.webp', joy: 'assets/illust/bust_garam_joy.webp' },
    signpost: { base: 'assets/illust/bust_signpost_base.webp', joy: 'assets/illust/bust_signpost_joy.webp' },
    keeper: { base: 'assets/illust/bust_keeper_base.webp', joy: 'assets/illust/bust_keeper_joy.webp' },
    traveler: { base: 'assets/illust/bust_traveler_base.webp', joy: 'assets/illust/bust_traveler_joy.webp' },
    // 5막
    greykid: { base: null, joy: null },
  },
  dialogueBg: { '1-1': 'assets/illust/bg_ch1-1.webp', '1-2': 'assets/illust/bg_ch1-2.webp', '2-1': 'assets/illust/bg_ch2-1.webp', '2-2': 'assets/illust/bg_ch2-2.webp', '3-1': 'assets/illust/bg_ch3-1.webp', '3-2': 'assets/illust/bg_ch3-2.webp', '4-1': 'assets/illust/bg_ch4-1.webp', '4-2': 'assets/illust/bg_ch4-2.webp', '5-1': null, '5-2': null }, // 장 id (2560×1440)
  battleBg: { 1: 'assets/illust/battle_bg_act1.webp', 2: 'assets/illust/battle_bg_act2.webp', 3: 'assets/illust/battle_bg_act3.webp', 4: 'assets/illust/battle_bg_act4.webp', 5: null }, // 막 번호 (2560×1440, 잿빛)
  battleHero: { f: 'assets/illust/battle_hero_f.webp', m: 'assets/illust/battle_hero_m.webp' }, // 1080×1440, 오른쪽(몬스터 쪽)을 봄
  monster: { 1: 'assets/illust/monster_act1.webp', 2: 'assets/illust/monster_act2.webp', 3: 'assets/illust/monster_act3.webp', 4: 'assets/illust/monster_act4.webp', 5: null }, // 보스(막 번호), 1440×1440
  title: 'assets/illust/title.webp', // 2560×1440, 글자 없음(제목은 HTML)
  ending: { ending01: null, ending02: null, ending03: null }, // 엔딩 장면 그림 2560×1440 (data/ending.js의 scenes[].bg, ending03은 마지막 말 화면 바탕)
  worldmap: 'assets/pixel/worldmap.png', // 세계 지도 1536×864 (아래쪽 새벽골은 밝고 북쪽 탑으로 갈수록 잿빛). 표시 자리는 data/world.js
  // UI 키트(8비트 색표 PNG + 투명, 2배로 만들어 절반 크기로 보임). 크기·조각 값은 아래 UI_KIT.
  ui: {
    logo: 'assets/ui/logo_title.v1.png',
    panel: 'assets/ui/frame_panel.v1.png',
    dialogue: 'assets/ui/frame_dialogue.v1.png',
    scroll: 'assets/ui/frame_scroll.v1.png',
    card: 'assets/ui/frame_card.v1.png',
    medallion: 'assets/ui/medallion.v1.png',
    btnGreen: 'assets/ui/btn_green.v1.png',
    btnWood: 'assets/ui/btn_wood.v1.png',
    btnIcon: 'assets/ui/btn_icon.v1.png',
    ribbon: 'assets/ui/ribbon_mask.v1.png',
    iconBook: 'assets/ui/icon_book.v1.png',
    iconScroll: 'assets/ui/icon_scroll.v1.png',
    heartFull: 'assets/ui/heart_full.v1.png',
    heartEmpty: 'assets/ui/heart_empty.v1.png',
    hpCell: 'assets/ui/hp_cell.v1.png',
    coin: 'assets/ui/coin.v1.png',
    check: 'assets/ui/check.v1.png',
  },
  // 소리(js/ui/audio.js). 음악은 장면마다 하나이고 파일 하나가 한 바퀴다(끝이 처음으로 이어진다). 장면에 들어설 때 받는다(타이틀 음악만 처음에).
  // 효과음은 짧은 MP3이고, null이면 코드로 만든 소리(audio.js의 SYNTH)를 낸다. 만든 방법: design/audio/tracks.json, tools/audio-make.py
  audio: {
    music: {
      title: 'assets/audio/music_title.v1.mp3',
      act1: 'assets/audio/music_act1.v1.mp3', // 새벽골
      act2: 'assets/audio/music_act2.v1.mp3', // 너울장
      act3: 'assets/audio/music_act3.v1.mp3', // 윤슬내
      act4: 'assets/audio/music_act4.v1.mp3', // 안개 고개
      act5: 'assets/audio/music_act5.v1.mp3', // 잿빛 탑
      world: 'assets/audio/music_world.v1.mp3', // 세계 지도
      review: 'assets/audio/music_review.v1.mp3', // 복습전
      boss: 'assets/audio/music_boss.v1.mp3', // 1~4막 보스전
      final: 'assets/audio/music_final.v1.mp3', // 5막 보스전
      ending: 'assets/audio/music_ending.v1.mp3',
      quiz: 'assets/audio/music_quiz.v1.mp3', // 마무리 퀴즈
    },
    sfx: {
      step: null, // 걸음(코드로, 잦게 내지 않는다)
      talk: null, // 대사 넘김(코드로)
      click: null, // 단추(코드로)
      chime: 'assets/audio/sfx_chime.v1.mp3', // 낱말이 빛을 되찾음
      card: 'assets/audio/sfx_card.v1.mp3', // 뜻풀이 카드
      codex: 'assets/audio/sfx_codex.v1.mp3', // 도감 열기·닫기
      accept: 'assets/audio/sfx_accept.v1.mp3', // 부탁 받음
      done: 'assets/audio/sfx_done.v1.mp3', // 부탁 끝·클리어
      correct: 'assets/audio/sfx_correct.v1.mp3', // 정답(전투·퀴즈)
      wrong: 'assets/audio/sfx_wrong.v1.mp3', // 오답(전투·퀴즈)
      hit: 'assets/audio/sfx_hit.v1.mp3', // 공격
      streak: 'assets/audio/sfx_streak.v1.mp3', // 연속 정답 공격
      defeat: 'assets/audio/sfx_defeat.v1.mp3', // 몬스터를 물리침
      heart: 'assets/audio/sfx_heart.v1.mp3', // 하트를 잃음
      exit: 'assets/audio/sfx_exit.v1.mp3', // 출구·안개 문이 열림
      travel: 'assets/audio/sfx_travel.v1.mp3', // 세계 지도에서 길 떠나기
    },
  },
};

// UI 키트 부품마다 그림 크기(w×h, 그림 px)와 9조각 값. slice는 그림 px [위, 오른쪽, 아래, 왼쪽],
// border는 화면 px(같은 순서). fill: 가운데 조각도 그린다(버튼). mask: 모양만 쓰는 가면(색은 CSS가 칠함).
// 명판은 panel 그림을 border 16으로 쓴다. 두루마리는 오른쪽 끝이 나무 축이라 좌우가 다르다.
export const UI_KIT = {
  panel: { w: 144, h: 144, slice: [48, 48, 48, 48], border: [24, 24, 24, 24] },
  dialogue: { w: 192, h: 192, slice: [64, 64, 64, 64], border: [32, 32, 32, 32] },
  scroll: { w: 336, h: 120, slice: [36, 96, 36, 36], border: [18, 48, 18, 18], fill: true }, // 종이가 조각 안에 있어 가운데도 그린다
  card: { w: 144, h: 144, slice: [48, 48, 48, 48], border: [24, 24, 24, 24] },
  btnGreen: { w: 192, h: 144, slice: [48, 64, 32, 64], border: [24, 32, 16, 32], fill: true },
  btnWood: { w: 192, h: 144, slice: [48, 64, 32, 64], border: [24, 32, 16, 32], fill: true },
  btnIcon: { w: 144, h: 160, slice: [40, 40, 40, 40], border: [20, 20, 20, 20], fill: true }, // 72×80으로 보임
  ribbon: { w: 400, h: 104, slice: [0, 80, 0, 80], border: [0, 40, 0, 40], mask: true },
  medallion: { w: 192, h: 192 }, // 96px로 보임, 가운데 투명
  logo: { w: 1200, h: 480 }, // 600×240으로 보임
  iconBook: { w: 96, h: 96 },
  iconScroll: { w: 96, h: 96 },
  heartFull: { w: 64, h: 64 },
  heartEmpty: { w: 64, h: 64 },
  check: { w: 64, h: 64 },
  hpCell: { w: 64, h: 40 },
  coin: { w: 80, h: 80 },
};

// 인물(who: 'hero_f', 'hero_m' 또는 인물 id)의 표정 그림 경로. 없으면 그 인물의 base, 그것도 없으면 null.
export function bustFor(who, face = 'base') {
  const set = ASSETS.busts[who];
  if (!set) return null;
  return set[face] ?? set.base ?? null;
}

// 엔딩 장면의 배경 키(data/ending.js의 scenes[].bg) → 그림 경로. ending01~03은 엔딩 그림, 장 id면 그 장의 대화 배경 그림.
export function endingBg(key) {
  if (key in ASSETS.ending) return ASSETS.ending[key];
  return ASSETS.dialogueBg[key] ?? null;
}
