// 그림 경로 목록. 값은 사이트 뿌리 기준 경로이고, 아직 없는 그림은 null이다.
// null이거나 불러오지 못하면 각 화면이 임시 그림(색 블록·그라데이션)으로 대신한다.
// 이름 규칙: assets/pixel|illust/종류_장_이름_변형.확장자 (art-bible 8절)
export const ASSETS = {
  // 탐험 맵(512×384, 장 id)
  maps: { '1-1': 'assets/pixel/map_ch1-1_saebyeokgol.png', '1-2': null },
  // 주인공 걷기 시트 48×128 (f 여 · m 남)
  walk: { f: null, m: null },
  // 인물 도트 16×32 (인물 id)
  npcs: { dodam: null, daon: null, gardener: null, baker: null, laundry: null, gate: null },
  // 물건 아이콘 (물건 id)
  items: { water: null, firewood: null, letter: null },
  // 꼬마 몬스터·보스 도트 (막 번호)
  small: { 1: null },
  bossPixel: { 1: null },
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
