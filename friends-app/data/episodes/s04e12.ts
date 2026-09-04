import type { Episode } from '../../lib/types';

/**
 * S04E12 The One with the Embryos — 아파트를 건 퀴즈 대결.
 * 내기 걸기, 승부욕, 결과 승복. 게임의 회화.
 */
const episode: Episode = {
  id: 's04e12',
  code: 'S04E12',
  season: 4,
  titleEn: 'The One with the Embryos',
  titleKr: '운명의 퀴즈 대결',
  synopsisKr:
    '"우리가 너희를 더 잘 알아"로 시작된 사소한 언쟁이 아파트를 건 퀴즈쇼로 ' +
    '번진다. 로스가 진행하는 초유의 대결 — 그리고 "챈들러의 직업은 무엇인가?"라는 ' +
    '문제 하나로 모니카와 레이첼은 집을 잃는다.',
  theme: '내기 · 승부 · 승복',
  scenes: [
    {
      id: 's04e12-1',
      titleKr: '내기가 성사되다',
      location: "Monica's Apartment",
      videoQuery: 'Friends the one with the embryos bet quiz apartment',
      contextKr:
        '서로를 얼마나 아는지 자존심 싸움이 붙고, 판돈이 눈덩이처럼 커집니다. ' +
        '도전 받아들이기, 판돈 정하기, 기싸움하기 — 내기와 게임에서 쓰는 ' +
        '표현을 배웁니다.',
      expressions: [
        {
          id: 's04e12-1-1',
          phrase: "You're on!",
          meaningKr: '좋아, 콜!',
          nuanceKr:
            '내기나 도전을 받아들이는 순간의 한마디. "The bet is on(내기 성립)"에서 ' +
            '온 표현이다. 손을 내밀며 "You\'re on!"이라고 하면 승부 시작. ' +
            '"Game on!"도 같은 온도의 표현.',
          exampleEn: '"Loser buys dinner for a month." — "You\'re on!"',
          exampleKr: '"진 사람이 한 달 동안 저녁 사기." — "좋아, 콜!"',
          level: 1,
          variations: [
            { en: 'Game on!', kr: '승부 시작이다! (같은 온도의 한마디)' },
            { en: "You're so on!", kr: '완전 콜이지! (so를 넣어 더 신나게 수락)' },
            { en: "It's on now.", kr: '이제 진짜 붙는 거야. (선전포고 느낌)' },
          ],
          mistakeKr:
            '"네가 켜져 있다?"로 직역하면 미궁에 빠진다 — 여기서 on은 "(내기·승부가) ' +
            '성립된" 상태다. 도전을 받을 때 "OK"만 하면 밋밋한데 "You\'re on!"은 생동감이 ' +
            '넘친다. 무대 뒤에서 듣는 "You\'re on(네 차례야, 나가)"과는 문맥으로 구분하자.',
          soundKr:
            "You're on은 두 단어가 붙어 \"유어론\"에 가깝게 한 방에 터진다. on에 강세를 " +
            '콱 주고 끝을 짧게 끊어야 승부사 느낌: "유어 온!". 상대를 손가락으로 가리키며.',
        },
        {
          id: 's04e12-1-2',
          phrase: 'Bring it on.',
          meaningKr: '덤벼 봐 / 얼마든지 와.',
          nuanceKr:
            '도전을 두려워하지 않는다는 허세 가득한 수락. 상대의 공격·시험·어려움 ' +
            '무엇이든 "가져와 봐(bring it)"라는 그림이다. 시험 전날 스스로에게 ' +
            '외쳐도 좋다.',
          exampleEn: 'You think your quiz is hard? Bring it on.',
          exampleKr: '너네 퀴즈가 어렵다고? 덤벼 봐.',
          level: 1,
          variations: [
            { en: 'You want a rematch? Bring it on.', kr: '설욕전 하자고? 얼마든지. (재대결 수락)' },
            { en: 'Exams, interviews — bring it all on.', kr: '시험이든 면접이든 다 덤벼라. (all을 넣은 확장판)' },
            { en: 'If they want a fight, bring it on.', kr: '걔네가 싸움을 원한다면, 얼마든지 와 보라 그래.' },
          ],
          mistakeKr:
            '대명사 it은 bring과 on 사이에 온다 — "Bring on it"은 틀린 어순. "가져와"라는 ' +
            '직역 때문에 물건을 부탁하는 "Bring it to me"와 혼동하기 쉽지만, bring it on은 ' +
            '통째로 "덤벼 봐"라는 관용구다. 진지한 갈등에서 쓰면 도발이 되니 온도 조절 필수.',
          soundKr:
            'bring it이 이어져 "브링잇", 전체는 "브링이론"처럼 흐른다. 마지막 on을 낮고 ' +
            '묵직하게 누르면 여유 있는 도발의 맛. "브링. 잇. 온."처럼 끊어 말하면 더 세진다.',
        },
        {
          id: 's04e12-1-3',
          phrase: 'What are the stakes?',
          meaningKr: '뭘 걸 건데?',
          nuanceKr:
            'stakes는 "내기에 건 것, 판돈". "The stakes are high(판이 크다)"는 ' +
            '뉴스에도 나오는 표현이다. 내기 전에 이 질문으로 조건을 확정하는 게 ' +
            '미국식 승부의 정석.',
          exampleEn: "Okay, I'm in. But first — what are the stakes?",
          exampleKr: '좋아, 나도 낄게. 근데 먼저 — 뭘 걸 건데?',
          level: 2,
          variations: [
            { en: 'The stakes are high this time.', kr: '이번엔 판이 커. (뉴스에도 나오는 고정 표현)' },
            { en: "Let's raise the stakes.", kr: '판돈을 올리자. (승부를 키울 때)' },
            { en: "There's a lot at stake here.", kr: '여기 걸린 게 많아. (be at stake 콤보)' },
          ],
          mistakeKr:
            'stakes를 steaks(스테이크)로 쓰는 스펠링 실수가 정말 많다 — 발음이 같아서 ' +
            '"What are the steaks?"라고 쓰면 저녁 메뉴 질문이 된다. 내기 맥락에서는 복수형 ' +
            'stakes가 기본이고, "걸려 있다"는 at stake로 전치사가 at이라는 것까지 세트로.',
          soundKr:
            'What are the가 뭉개져 "와러더"가 된다: "와러더 스테익스?". stakes에 최고 강세, ' +
            '끝의 -ks는 "익스"로 분명하게. 눈썹을 올리며 끝을 살짝 올려 물으면 기싸움 완성.',
        },
      ],
      dialogue: [
        {
          speaker: 'Monica',
          en: 'Please. Rachel and I know WAY more about you two than you know about us.',
          kr: '웃기지 마. 나랑 레이첼이 너희 둘을 아는 게, 너희가 우릴 아는 것보다 훨씬 많아.',
        },
        {
          speaker: 'Joey',
          en: 'Oh yeah? I say we settle this. A quiz. Winner takes all.',
          kr: '그래? 그럼 결판을 내자. 퀴즈로. 이긴 쪽이 다 갖기.',
        },
        {
          speaker: 'Rachel',
          en: 'Winner takes what, exactly? What are the stakes?',
          kr: '이긴 쪽이 정확히 뭘 갖는데? 뭘 걸 건데?',
          expressionId: 's04e12-1-3',
        },
        {
          speaker: 'Chandler',
          en: 'If we win... we get your apartment.',
          kr: '우리가 이기면… 너희 아파트를 갖는다.',
        },
        {
          speaker: 'Monica',
          en: 'And when WE win, you get rid of the chick and the duck.',
          kr: '그리고 우리가 이기면, 너희는 병아리랑 오리를 치우는 거야.',
        },
        {
          speaker: 'Joey',
          en: "Deal. Bring it on.",
          kr: '좋아. 덤벼 봐.',
          expressionId: 's04e12-1-2',
        },
        {
          speaker: 'Monica',
          en: "Oh, you're on!",
          kr: '오, 좋아 콜이야!',
          expressionId: 's04e12-1-1',
        },
        {
          speaker: 'Ross',
          en: 'As the only neutral party, I will write the questions. This is a terrible idea.',
          kr: '유일한 중립 인사로서 문제는 내가 낸다. 참고로 이건 끔찍한 생각이야.',
        },
      ],
      drills: [
        {
          promptKr:
            '친구가 "진 사람이 한 달 동안 커피 사기"라며 내기를 겁니다. "좋아, 콜!"이라고 받아 보세요.',
          targetEn: "Okay, you're on!",
          keywords: ['okay', 'on'],
        },
        {
          promptKr:
            '동료가 "이번 게임은 내가 이길걸?"이라며 도발합니다. "덤벼 봐"라고 받아치세요.',
          targetEn: 'Bring it on.',
          keywords: ['bring', 'on'],
        },
        {
          promptKr:
            '내기를 받기 전에 조건부터 확실히 하고 싶습니다. "근데 먼저, 뭘 걸 건데?"라고 물어보세요.',
          targetEn: 'But first, what are the stakes?',
          keywords: ['first', 'stakes'],
        },
      ],
    },
    {
      id: 's04e12-2',
      titleKr: '번개 라운드, 그리고 아파트의 주인',
      location: "Monica's Apartment",
      videoQuery: 'Friends lightning round transponster Chandler job',
      contextKr:
        '동점 상황에서 운명의 번개 라운드. "챈들러의 직업은?"이라는 문제에 ' +
        '모니카와 레이첼이 무너집니다. 항의하기, 정정당당함 주장하기, ' +
        '결과에 승복하기 — 승부의 마무리 표현을 배웁니다.',
      expressions: [
        {
          id: 's04e12-2-1',
          phrase: "That's not fair!",
          meaningKr: '그건 불공평해!',
          nuanceKr:
            '억울함의 기본 표현. fair(공정한)의 부정이니 규칙 위반에 항의할 때 쓴다. ' +
            '아이 같은 억지 느낌을 빼려면 "That doesn\'t seem fair(그건 좀 불공평한 것 ' +
            '같은데요)"로 부드럽게 만들 수 있다.',
          exampleEn: "You changed the rules in the middle of the game — that's not fair!",
          exampleKr: '게임 중간에 규칙을 바꾸다니 — 그건 불공평해!',
          level: 1,
          variations: [
            { en: "That doesn't seem fair.", kr: '그건 좀 불공평한 것 같은데요. (어른스러운 버전)' },
            { en: 'No fair! You peeked!', kr: '반칙이야! 너 훔쳐봤잖아! (구어체 축약형)' },
            { en: "Life's not fair.", kr: '인생은 원래 불공평해. (달관한 대답)' },
          ],
          mistakeKr:
            '"불공평하다"에 unfair만 떠올리기 쉬운데, 회화에서는 not fair가 압도적으로 자주 ' +
            '나온다. fair를 fare(요금)와 헷갈리는 스펠링 실수도 흔하다. 다 큰 어른이 정색하고 ' +
            '이 말만 외치면 떼쓰는 아이처럼 들릴 수 있으니 seem을 넣어 수위를 조절하자.',
          soundKr:
            "That's not이 \"댓츠낫\"으로 붙고, fair를 길게 끌며 강세를 싣는다: \"댓츠 낫 " +
            '페어~!". f는 윗니를 아랫입술에 살짝 대고 — p 소리로 새면 "패어"가 되니 주의.',
        },
        {
          id: 's04e12-2-2',
          phrase: 'We won fair and square.',
          meaningKr: '우린 정정당당하게 이겼어.',
          nuanceKr:
            '"fair and square"는 "반칙 없이, 깨끗하게"라는 굳어진 표현. ' +
            '이겼을 때 정당성을 주장하거나, 졌을 때 "깨끗하게 졌다(lost fair and ' +
            'square)"고 승복하는 데 모두 쓴다.',
          exampleEn: 'No rematch. We won fair and square.',
          exampleKr: '재경기는 없어. 우린 정정당당하게 이겼으니까.',
          level: 2,
          variations: [
            { en: 'I lost fair and square.', kr: '내가 깨끗하게 졌어. (승복 버전)' },
            { en: 'She got the job fair and square.', kr: '걔는 정정당당하게 그 자리를 따낸 거야.' },
            { en: "We'll settle this fair and square.", kr: '공정하게 결판을 내자.' },
          ],
          mistakeKr:
            'square(정사각형)가 왜 나오는지 따지며 직역하면 길을 잃는다 — fair and square는 ' +
            '통째로 "반칙 없이"라는 굳은 관용구고, 어순을 바꿔 square and fair라고 하면 ' +
            '안 된다. won(win의 과거형)은 숫자 one과 발음이 완전히 같다는 것도 알아 두자.',
          soundKr:
            'won은 one과 똑같이 "원". fair and square는 and가 약해져 "페어른 스퀘어"로 ' +
            '흐른다. fair와 square 둘 다 강세를 살리되 마지막 square를 묵직하게 눌러 준다.',
        },
        {
          id: 's04e12-2-3',
          phrase: "A deal's a deal.",
          meaningKr: '약속은 약속이야.',
          nuanceKr:
            '조건에 합의했으면 결과가 쓰라려도 지켜야 한다는 뜻. 마음 약해지려는 ' +
            '상대(혹은 자신)를 다잡을 때 쓴다. "A bet\'s a bet(내기는 내기)"도 ' +
            '같은 구조의 표현.',
          exampleEn: "I hate to take your desk, but a deal's a deal.",
          exampleKr: '네 책상 뺏기는 미안한데, 약속은 약속이잖아.',
          level: 2,
          variations: [
            { en: "A bet's a bet — pay up.", kr: '내기는 내기야 — 돈 내놔.' },
            { en: 'A promise is a promise.', kr: '약속은 약속이지. (같은 구조의 진지 버전)' },
            { en: 'Rules are rules.', kr: '규칙은 규칙이야. (예외 없다고 못 박을 때)' },
          ],
          mistakeKr:
            '"약속은 약속"을 관사 없이 "Promise is promise"로 옮기면 틀린다 — 영어는 ' +
            '"A promise is a promise"처럼 관사가 양쪽에 다 필요하다. 또 deal을 "할인"으로만 ' +
            '알면 세일 얘기로 들린다 — 여기서 deal은 "합의, 거래"다. "It\'s a deal"도 세트로.',
          soundKr:
            "deal's a가 이어져 \"딜저\"가 된다: \"어 딜저 딜\". 첫 deal보다 마지막 deal을 " +
            '더 세게, 뚝 떨어뜨리며 끝내면 "토 달지 마"라는 단호함이 산다. l은 혀끝을 윗니 뒤에.',
        },
      ],
      dialogue: [
        {
          speaker: 'Ross',
          en: 'Lightning round. Monica, Rachel — what is Chandler Bing\'s job?',
          kr: '번개 라운드. 모니카, 레이첼 — 챈들러 빙의 직업은 무엇일까요?',
        },
        {
          speaker: 'Rachel',
          en: "Oh! Oh! It's... something with numbers! A transponster!",
          kr: '아! 아! 그건… 숫자랑 관련된 거야! 트랜스폰스터!',
        },
        {
          speaker: 'Ross',
          en: 'That is not even a word. Joey and Chandler win the apartment.',
          kr: '그건 존재하지도 않는 단어야. 조이와 챈들러가 아파트를 가져갑니다.',
        },
        {
          speaker: 'Monica',
          en: "No! That question was impossible. That's not fair!",
          kr: '안 돼! 그 문제는 말도 안 됐어. 불공평하다고!',
          expressionId: 's04e12-2-1',
        },
        {
          speaker: 'Chandler',
          en: "Hey, we won fair and square. Even I don't know what my job is.",
          kr: '이봐, 우린 정정당당하게 이겼어. 심지어 나도 내 직업이 뭔지 모르는걸.',
          expressionId: 's04e12-2-2',
        },
        {
          speaker: 'Rachel',
          en: 'Monica, please tell me you did not actually bet the apartment.',
          kr: '모니카, 제발 진짜로 아파트를 걸었던 건 아니라고 말해 줘.',
        },
        {
          speaker: 'Joey',
          en: "She did. And a deal's a deal. Start packing, ladies!",
          kr: '걸었지. 그리고 약속은 약속이야. 짐 싸시죠, 숙녀분들!',
          expressionId: 's04e12-2-3',
        },
      ],
      drills: [
        {
          promptKr:
            '보드게임 중간에 상대가 규칙을 바꿨습니다. "규칙을 바꾸다니 — 그건 불공평해!"라고 항의해 보세요.',
          targetEn: "You changed the rules — that's not fair!",
          keywords: ['changed', 'rules', 'fair'],
        },
        {
          promptKr:
            '내기에서 진 친구가 재경기를 요구합니다. "우린 정정당당하게 이겼어"라고 말해 보세요.',
          targetEn: 'We won fair and square.',
          keywords: ['won', 'fair', 'square'],
        },
        {
          promptKr:
            '내기에서 진 친구가 약속을 무르려고 합니다. "미안하지만, 약속은 약속이야"라고 못 박아 보세요.',
          targetEn: "Sorry, but a deal's a deal.",
          keywords: ['sorry', 'deal'],
        },
      ],
    },
  ],
};

export default episode;
