// 엔딩 — 설계 3절(결: 도담도담, 마지막 메시지), 아트 바이블 2절(엔딩 새벽 금빛 역광).
// 장면마다 배경 그림 하나와 대사. 대사 규칙은 막 대본과 같고, 새 낱말([[ ]])은 없다(50개는 5-2까지 다 모았다).
const npc = (id, face, text) => (face ? { who: 'npc', npc: id, face, text } : { who: 'npc', npc: id, text });
const hero = (face, text) => (face ? { who: 'hero', face, text } : { who: 'hero', text });
const say = (text) => ({ who: 'narration', text });

const ENDING = {
  cast: [
    { id: 'dodam', name: '도담 할머니', color: '#8E4A7A' },
    { id: 'daon', name: '다온', color: '#C9A97E' },
    { id: 'haesol', name: '해솔', color: '#F08A3C' },
    { id: 'narae', name: '나래', color: '#A9C9D6' },
  ],
  scenes: [
    { // 1. 돌아오는 새벽
      bg: 'ending01',
      lines: [
        say('{이름|은} 해솔, 나래와 함께 새벽골로 돌아왔다.'),
        say('새벽 어스름이 걷히고 산 너머에서 아침 해가 떠오른다.'),
        say('마을 사람들이 서로 반갑게 인사를 나눈다.'),
        npc('daon', 'joy', '{이름|아}, 어서 와!'),
      ],
    },
    { // 2. 할머니와 나래
      bg: 'ending02',
      lines: [
        npc('dodam', 'laugh', '{이름|아}, 수고했다.'),
        npc('dodam', 'base', '말빛 주머니를 오롯이 채워 왔구나.'),
        npc('narae', 'light', '할머니, 처음 뵙겠습니다.'),
        npc('dodam', 'laugh', '처음이라니, 나는 너를 아주 잘 안단다.'),
        hero('surprise', '할머니, 나래를 아세요?'),
        npc('dodam', 'base', '내가 너희만 할 때 날마다 불러 주던 이름이란다.'),
        npc('narae', 'surprise', '그럼 예전에 나를 자주 불러 준 사람이 할머니였어요?'),
        npc('dodam', 'laugh', '그래, 날개를 꿈꾸며 부르던 말이 바로 너였지.'),
      ],
    },
    { // 3. 도담도담
      bg: 'ending02',
      lines: [
        npc('haesol', 'base', '할머니 이름은 무슨 뜻이에요?'),
        npc('dodam', 'base', '내 이름 도담은 도담도담에서 왔단다.'),
        npc('dodam', 'base', '아이들이 탈 없이 잘 자라라는 뜻이지.'),
        hero('joy', '그래서 할머니가 늘 우리를 지켜봐 주셨구나!'),
        npc('dodam', 'laugh', '너희가 도담도담 자라서 한울을 구했구나.'),
      ],
    },
    { // 4. 마지막 말
      bg: 'ending03',
      still: true,
      lines: [
        npc('dodam', 'base', '잊힌 말은 사라진 게 아니라 잠들어 있을 뿐이란다.'),
        npc('dodam', 'base', '누군가 다시 부르면 깨어나지.'),
        npc('narae', 'light', '나처럼 말이야.'),
        hero('base', '이제 우리가 되찾은 말을 날마다 쓸게요.'),
        npc('haesol', 'base', '장터에 가서 다 같이 써 보자!'),
      ],
    },
  ],
  // 대사가 끝나면 이 한 줄만 화면 가운데(한지 패널 위)에 크게 띄운다.
  message: '우리가 쓰면 말은 살아난다.',
  // 도감 50장 화면 뒤에 나오는 만든 이 글. 사람 이름은 넣지 않는다(내가 정한 것 9).
  credits: [
    { title: '이야기와 낱말', lines: ['고유어 50개의 뜻은 표준국어대사전을 바탕으로 쉽게 풀었어요.'] },
    { title: '그림', lines: ['인공지능으로 그린 뒤 사람이 하나하나 다듬었어요.'] },
    { title: '글꼴', lines: ['고운돋움, 주아 (SIL 오픈 폰트 라이선스)'] },
    { title: '만든 도구', lines: ['Claude Code', 'Claude-Code-Game-Studios (MIT)', 'sprite-gen (Apache-2.0)'] },
    { title: '함께한 사람', lines: ['우리 반 선생님', '끝까지 길을 걸은 {이름}'] },
  ],
  thanks: '{이름|아}, 끝까지 함께해 줘서 고마워!',
};

export default ENDING;
