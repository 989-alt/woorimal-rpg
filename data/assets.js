// 그림 경로 목록. 값은 사이트 뿌리 기준 경로이고, 아직 없는 그림은 null이다.
// null이거나 불러오지 못하면 각 화면이 임시 그림(색 블록·그라데이션)으로 대신한다.
// 이름 규칙: assets/pixel|illust/종류_장_이름_변형.확장자 (art-bible 8절)
export const ASSETS = {
  // 탐험 맵(1536×1152, 칸당 48, 장 id)
  maps: { '1-1': 'assets/pixel/map_ch1-1_saebyeokgol.png', '1-2': 'assets/pixel/map_ch1-2_maeul-eogwi.png' },
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
  },
  // 물건 아이콘 48×48 (물건 id)
  items: { water: 'assets/pixel/icon_water.png', firewood: 'assets/pixel/icon_firewood.png', letter: 'assets/pixel/icon_letter.png' },
  // 꼬마 몬스터 도트 48×96(발이 맨 아래 줄)·보스 도트 96×96(2×2칸, 발이 보스 칸 아래 줄 가운데) (막 번호)
  small: { 1: 'assets/pixel/monster_small_act1.png' },
  bossPixel: { 1: 'assets/pixel/monster_boss_act1.png' },
  // 대화 상반신: 인물 × 표정. 표정 그림이 없으면 base로 대신한다.
  busts: {
    hero_f: { base: null, surprise: null, joy: null },
    hero_m: { base: null, surprise: null, joy: null },
    dodam: { base: null, worry: null, laugh: null },
    daon: { base: null, joy: null },
    gardener: { base: null },
    baker: { base: null, joy: null },
    laundry: { base: null, joy: null },
    gate: { base: null, joy: null },
  },
  dialogueBg: { '1-1': null, '1-2': null }, // 장 id
  battleBg: { 1: null }, // 막 번호
  battleHero: { f: null, m: null },
  monster: { 1: null }, // 보스(막 번호)
  title: null,
};

// 인물(who: 'hero_f', 'hero_m' 또는 인물 id)의 표정 그림 경로. 없으면 그 인물의 base, 그것도 없으면 null.
export function bustFor(who, face = 'base') {
  const set = ASSETS.busts[who];
  if (!set) return null;
  return set[face] ?? set.base ?? null;
}
