// 엔딩 — 설계 3절(결: 도담도담, 마지막 메시지), 아트 바이블 2절(엔딩 새벽 금빛 역광).
// 장면마다 배경 그림 하나와 대사. bg는 엔딩 그림 키(ending01~03) 또는 장 id(그 장의 대화 배경 그림). 대사 규칙은 막 대본과 같고, 새 낱말([[ ]])은 없다(50개는 5-2까지 다 모았다).
const npc = (id, face, text) => (face ? { who: 'npc', npc: id, face, text } : { who: 'npc', npc: id, text });
const hero = (face, text) => (face ? { who: 'hero', face, text } : { who: 'hero', text });
const say = (text) => ({ who: 'narration', text });

const ENDING = {
  cast: [
    { id: 'dodam', name: '도담 할머니', color: '#8E4A7A' },
    { id: 'daon', name: '다온', color: '#C9A97E' },
    { id: 'haesol', name: '해솔', color: '#F08A3C' },
    { id: 'narae', name: '나래', color: '#A9C9D6' },
    // 되찾은 마을들(장면 2~5)의 주민: 이름·색은 막 데이터 그대로
    { id: 'fruit', name: '사과 장수 아저씨', color: '#9C8670' },
    { id: 'shopper', name: '장 보는 할머니', color: '#D8CDB8' },
    { id: 'flower', name: '꽃 파는 아이', color: '#E6DCC8' },
    { id: 'ferryman', name: '나룻배 사공', color: '#6E5E50' },
    { id: 'skygran', name: '날씨 할머니', color: '#9A8B7A' },
    { id: 'miru', name: '미루', color: '#C2B49A' },
    { id: 'tea', name: '찻집 아주머니', color: '#A08C76' },
    { id: 'garam', name: '가람', color: '#CBBBA4' },
    { id: 'signpost', name: '푯말 할아버지', color: '#7F7060' },
    { id: 'greykid', name: '잿빛 아이', color: '#8A8D91' },
    { id: 'woodcutter', name: '나무꾼 아저씨', color: '#7D6A58' },
    { id: 'chestnut', name: '밤 장수 할머니', color: '#857565' },
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
    // 2~5. 되찾은 마을들: 색과 말을 되찾은 마을과 주민들(선생님 요청). 배경은 그 막 장의 대화 배경 그림을 그대로 쓴다.
    { // 2. 너울장
      bg: '2-1',
      lines: [
        say('너울장 차양마다 알록달록한 빛깔이 되살아났다.'),
        npc('fruit', 'joy', '오늘은 문을 열자마자 마수걸이를 했다네!'),
        npc('shopper', 'base', '사과가 이렇게 옹골지니 제값을 주고 사야지.'),
        npc('flower', 'joy', '꽃을 한 아름 안고 장터를 한 바퀴 돌 거야!'),
        npc('haesol', 'base', '장터가 다시 시끌벅적하니 마음이 가뜬하다!'),
      ],
    },
    { // 3. 윤슬내
      bg: '3-2',
      lines: [
        say('윤슬내 물빛이 다시 푸르러지고 숲에도 초록이 번졌다.'),
        npc('ferryman', 'joy', '냇물 위로 윤슬이 반짝이니 노 젓는 맛이 나는구먼.'),
        npc('skygran', 'joy', '아침에 는개가 살짝 내려서 풀잎이 촉촉하구나.'),
        npc('miru', 'joy', '나뭇잎 사이로 볕뉘가 드니까 숲길이 환해!'),
        npc('narae', 'light', '물소리도 사람들 목소리도 다시 맑게 들려.'),
      ],
    },
    { // 4. 안개 고개: 고개 아래 골짜기에 안개가 짙던 4-1 그림 대신, 안개가 산 아래로 물러나고 하늘이 갠 고갯마루(4-2) 그림
      bg: '4-2',
      lines: [
        say('고갯길의 안개가 걷히고 들꽃 빛깔이 또렷해졌다.'),
        npc('tea', 'joy', '처음 오는 손님에게도 살갑게 차를 따라 준단다.'),
        npc('garam', 'joy', '서먹하던 친구와 이제는 너나들이하며 지내.'),
        npc('signpost', 'joy', '길손들이 서로 다독이며 고개를 넘어가는구먼.'),
        npc('haesol', 'base', '이제 아무도 애꿎은 사람을 의심하지 않겠지?'),
      ],
    },
    { // 5. 잿빛 탑: 잿빛이던 탑이 새벽빛으로 물든다(warm: 대화 배경 그림을 따뜻한 빛깔로)
      bg: '5-1',
      warm: true,
      lines: [
        say('잿빛이던 탑이 새벽빛을 받아 따스한 빛깔로 물들었다.'),
        npc('greykid', 'color', '탑을 다부지게 오른 너희 덕분에 나도 색을 찾았어!'),
        npc('woodcutter', 'joy', '너울가지 좋은 사람들이 앞뜰에 모여 이야기꽃을 피우네.'),
        npc('chestnut', 'joy', '이 아이들은 늘품이 있으니 한울이 더 밝아지겠구먼.'),
      ],
    },
    { // 6. 할머니와 나래
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
    { // 7. 도담도담
      bg: 'ending02',
      lines: [
        npc('haesol', 'base', '할머니 이름은 무슨 뜻이에요?'),
        npc('dodam', 'base', '내 이름 도담은 도담도담에서 왔단다.'),
        npc('dodam', 'base', '아이들이 탈 없이 잘 자라라는 뜻이지.'),
        hero('joy', '그래서 할머니가 늘 우리를 지켜봐 주셨구나!'),
        npc('dodam', 'laugh', '너희가 도담도담 자라서 한울을 구했구나.'),
      ],
    },
    { // 8. 마지막 말
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
