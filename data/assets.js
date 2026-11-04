// 그림 경로 목록. 값은 사이트 뿌리 기준 경로이고, 아직 없는 그림은 null이다.
// null이거나 불러오지 못하면 각 화면이 임시 그림(색 블록·그라데이션)으로 대신한다.
// 이름 규칙: assets/pixel|illust/종류_장_이름_변형.확장자, UI 키트는 assets/ui/이름.v1.png (art-bible 8절)
export const ASSETS = {
  // 탐험 맵(1536×1152, 칸당 48, 장 id)
  maps: { '1-1': 'assets/pixel/map_ch1-1_saebyeokgol.png', '1-2': 'assets/pixel/map_ch1-2_maeul-eogwi.png', '2-1': 'assets/pixel/map_ch2-1_neouljang.png', '2-2': 'assets/pixel/map_ch2-2_bukmun.png', '3-1': null, '3-2': null, '4-1': null, '4-2': null, '5-1': null, '5-2': null },
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
    narae: null, woodcutter: null, miru: null, yeoul: null, skygran: null, ferryman: null, // 3막
    tea: null, garam: null, signpost: null, keeper: null, traveler: null, // 4막
    greykid: null, // 5막
  },
  // 물건 아이콘 48×48 (물건 id)
  items: { water: 'assets/pixel/icon_water.png', firewood: 'assets/pixel/icon_firewood.png', letter: 'assets/pixel/icon_letter.png', 'price-board': null, weight: null, bundle: null, 'trail-ribbon': null, lunchbox: null, 'rain-bowl': null, 'warm-tea': null, 'pine-twigs': null, 'bundle-strap': null, bell: null, 'light-shard': null, lullaby: null },
  // 꼬마 몬스터 도트 48×96(발이 맨 아래 줄)·보스 도트 96×96(2×2칸, 발이 보스 칸 아래 줄 가운데) (막 번호)
  small: { 1: 'assets/pixel/monster_small_act1.png', 2: 'assets/pixel/monster_small_act2.png', 3: null, 4: null, 5: null },
  bossPixel: { 1: 'assets/pixel/monster_boss_act1.png', 2: 'assets/pixel/monster_boss_act2.png', 3: null, 4: null, 5: null },
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
    haesol: { base: null, pout: null, surprise: null },
    fruit: { base: null, joy: null },
    guard: { base: null, joy: null },
    shopper: { base: null },
    chestnut: { base: null, joy: null },
    flower: { base: null, joy: null },
    northgate: { base: null },
    // 3막
    narae: { base: null, sad: null, surprise: null, light: null },
    woodcutter: { base: null, joy: null },
    miru: { base: null, joy: null },
    yeoul: { base: null, joy: null },
    skygran: { base: null, joy: null },
    ferryman: { base: null, joy: null },
    // 4막
    tea: { base: null, joy: null },
    garam: { base: null, joy: null },
    signpost: { base: null, joy: null },
    keeper: { base: null, joy: null },
    traveler: { base: null, joy: null },
    // 5막
    greykid: { base: null, joy: null },
  },
  dialogueBg: { '1-1': 'assets/illust/bg_ch1-1.webp', '1-2': 'assets/illust/bg_ch1-2.webp', '2-1': null, '2-2': null, '3-1': null, '3-2': null, '4-1': null, '4-2': null, '5-1': null, '5-2': null }, // 장 id (2560×1440)
  battleBg: { 1: 'assets/illust/battle_bg_act1.webp', 2: null, 3: null, 4: null, 5: null }, // 막 번호 (2560×1440, 잿빛)
  battleHero: { f: 'assets/illust/battle_hero_f.webp', m: 'assets/illust/battle_hero_m.webp' }, // 1080×1440, 오른쪽(몬스터 쪽)을 봄
  monster: { 1: 'assets/illust/monster_act1.webp', 2: null, 3: null, 4: null, 5: null }, // 보스(막 번호), 1440×1440
  title: 'assets/illust/title.webp', // 2560×1440, 글자 없음(제목은 HTML)
  worldmap: null, // 세계 지도 1536×864 (아래쪽 새벽골은 밝고 북쪽 탑으로 갈수록 잿빛). 표시 자리는 data/world.js
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
