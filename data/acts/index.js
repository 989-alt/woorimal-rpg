// 막 목록: 새 막을 만들면 여기에 더한다.
import ACT1 from './act1.js';
import ACT2 from './act2.js';
import ACT3 from './act3.js';
import ACT4 from './act4.js';

export const ACTS = [ACT1, ACT2, ACT3, ACT4];

export function actOfChapter(chapterId) {
  const act = ACTS.find((a) => a.chapters.some((c) => c.id === chapterId));
  if (!act) throw new Error(`actOfChapter: 알 수 없는 장 '${chapterId}'`);
  return act;
}
