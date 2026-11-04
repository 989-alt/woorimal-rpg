// 모든 막의 데이터 검사가 같이 쓰는 도우미와 기대 표(설계 2·4절, 9절).
import { formatLine } from '../js/rules/josa.js';
import { wordMark } from '../js/rules/game.js';
import { ACTS } from '../data/acts/index.js';

export const BUILT_ACTS = [1, 2, 3, 4, 5];

export const EXPECT = {
  acts: {
    1: { title: '새벽골', boss: '안개 덩이', small: '꼬마 안개', chapters: ['새벽골의 아침', '마을 어귀로'] },
    2: { title: '너울장', boss: '값 흐리는 그림자', small: '꼬마 값 그림자', travel: '안개가 내려오는 북쪽, 북적이는 장터로', chapters: ['북적이는 장터', '장터 북문'] },
    3: { title: '윤슬내', boss: '물안개 그림자', small: '꼬마 물안개', travel: '해솔과 함께, 숲과 냇물이 있는 곳으로', chapters: ['숲속 갈림길', '냇가의 나무다리'] },
    4: { title: '안개 고개', boss: '의심 그림자', small: '꼬마 의심 그림자', travel: '나래의 길잡이를 따라 안개 낀 고개로', chapters: ['안개 낀 고갯길', '고갯마루 쉼터'] },
    5: { title: '잿빛 탑', boss: '잿빛 그림자', small: '꼬마 잿빛 그림자', travel: '나래를 되찾으러 잿빛 탑으로', chapters: ['잿빛 탑 앞뜰', '탑 꼭대기로'] },
  },
  // 부탁: [주는 이, 종류, 낱말], hidden: [낱말, 알려 주는 인물]
  chapters: {
    '1-1': { q1: ['dodam', 'fetch', ['어스름', '아침나절']], q2: ['daon', 'chase', ['매무새', '손사래']], hidden: ['오롯이', 'gardener'] },
    '1-2': { q3: ['baker', 'gather', ['부리나케', '짬']], q4: ['laundry', 'deliver', ['곰비임비', '얼추']], hidden: ['해거름', 'laundry'] },
    '2-1': { q5: ['haesol', 'fetch', ['마수걸이', '우수리']], q6: ['fruit', 'find', ['에누리', '되레']], hidden: ['들머리', 'guard'] },
    '2-2': { q7: ['chestnut', 'chase', ['어림', '옹골지다']], q8: ['haesol', 'gather', ['바리바리', '가뜬하다']], hidden: ['아름', 'flower'] },
    '3-1': { q9: ['narae', 'gather', ['물꼬', '아스라하다']], q10: ['woodcutter', 'find', ['그루터기', '볕뉘']], hidden: ['함초롬하다', 'miru'] },
    '3-2': { q11: ['yeoul', 'chase', ['가뭇없다', '윤슬']], q12: ['skygran', 'gather', ['여우비', '시나브로']], hidden: ['는개', 'ferryman'] },
    '4-1': { q13: ['tea', 'deliver', ['서름하다', '살갑다']], q14: ['signpost', 'chase', ['새치름하다', '마뜩잖다']], hidden: ['애꿎다', 'garam'] },
    '4-2': { q15: ['keeper', 'gather', ['데면데면하다', '부아']], q16: ['narae', 'deliver', ['시샘', '다독이다']], hidden: ['너나들이', 'traveler'] },
    '5-1': { q17: ['woodcutter', 'chase', ['다부지다', '늘품']], q18: ['haesol', 'deliver', ['너울가지', '미쁘다']], hidden: ['웅숭깊다', 'daon'] },
    '5-2': { q19: ['keeper', 'gather', ['내처', '애오라지']], q20: ['chestnut', 'find', ['도담도담', '매조지다']], hidden: ['나래', 'haesol'] },
  },
  items: ['water', 'firewood', 'letter', 'price-board', 'weight', 'bundle', 'trail-ribbon', 'lunchbox', 'rain-bowl', 'warm-tea', 'pine-twigs', 'bundle-strap', 'bell', 'light-shard', 'lullaby'],
  quizTypes: { // 설계 4절 "문제 유형 배정"
    1: { meaning: ['어스름', '아침나절', '해거름', '짬'], blank: ['얼추', '부리나케', '매무새'], usage: ['손사래', '오롯이', '곰비임비'] },
    2: { meaning: ['마수걸이', '우수리', '옹골지다', '가뜬하다'], blank: ['에누리', '바리바리', '들머리'], usage: ['어림', '아름', '되레'] },
    3: { meaning: ['윤슬', '는개', '함초롬하다', '가뭇없다'], blank: ['볕뉘', '그루터기', '시나브로'], usage: ['여우비', '아스라하다', '물꼬'] },
    4: { meaning: ['데면데면하다', '새치름하다', '다독이다', '서름하다'], blank: ['시샘', '부아', '너나들이'], usage: ['살갑다', '마뜩잖다', '애꿎다'] },
    5: { meaning: ['미쁘다', '웅숭깊다', '늘품', '매조지다'], blank: ['나래', '애오라지', '내처'], usage: ['다부지다', '너울가지', '도담도담'] },
  },
};

// 인물별 표정 묶음(아트 바이블 8절, 설계 2절). 나머지 인물은 other.
export const FACES = {
  hero: ['base', 'surprise', 'joy'],
  dodam: ['base', 'worry', 'laugh'],
  haesol: ['base', 'pout', 'surprise'],
  narae: ['base', 'sad', 'surprise', 'light'],
  other: ['base', 'joy'],
};
// 대표색은 그 주인만 쓴다.
export const RESERVED = { '#3B5BA5': 'hero', '#8E4A7A': 'dodam', '#F08A3C': 'haesol', '#A9C9D6': 'narae' };

const BRACKET = /\[\[(.+?)\]\]/g;
export const brackets = (text) => [...text.matchAll(BRACKET)].map((m) => wordMark(m[1]).id);
export const plain = (text) => text.replace(BRACKET, '');

/** 닉네임을 넣고 [[id|꼴]]을 꼴로 바꾼, 화면에 보이는 글 */
export const shownText = (text, nickname = '가나다라마바') =>
  formatLine(text, nickname).replace(BRACKET, (_, inner) => wordMark(inner).form);

/** 장의 모든 대사 묶음: [이름표, Line[], 'before'|'done'|'after'] */
export function lineGroups(ch) {
  const groups = [[`${ch.id} intro`, ch.intro, 'before']];
  for (const n of ch.npcs) {
    groups.push([`${ch.id} ${n.id}.chat`, n.chat, 'before']);
    if (n.chatAfter) groups.push([`${ch.id} ${n.id}.chatAfter`, n.chatAfter.lines, 'before']);
    if (n.reveal) groups.push([`${ch.id} ${n.id}.reveal`, n.reveal, 'before']);
    if (n.after) groups.push([`${ch.id} ${n.id}.after`, n.after, 'before']);
  }
  for (const q of ch.quests) {
    groups.push([`${q.id}.offer`, q.offer, 'before']);
    groups.push([`${q.id}.waiting`, q.waiting, 'before']);
    groups.push([`${q.id}.done`, q.done, 'done']);
  }
  groups.push([`${ch.id} hidden`, ch.hidden.lines, 'done']);
  if (ch.afterBoss) groups.push([`${ch.id} afterBoss`, ch.afterBoss, 'after']);
  return groups;
}
export const allLines = (ch) => lineGroups(ch).flatMap(([, lines]) => lines);

/** 게임 전체에서 낱말을 얻는 곳(done·hidden.lines의 [[ ]])의 id, 중복 포함 */
export function gainedWordIds() {
  const ids = [];
  for (const act of ACTS) {
    for (const ch of act.chapters) {
      for (const q of ch.quests) for (const l of q.done) ids.push(...brackets(l.text));
      for (const l of ch.hidden.lines) ids.push(...brackets(l.text));
    }
  }
  return ids;
}

/** 부탁 물건 id를 게임 차례대로 */
export function questItemIds() {
  return ACTS.flatMap((a) => a.chapters.flatMap((c) => c.quests)).filter((q) => q.item).map((q) => q.item.id);
}
