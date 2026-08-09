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
    },
    {
      id: 's04e12-2',
      titleKr: '번개 라운드, 그리고 아파트의 주인',
      location: "Monica's Apartment",
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
    },
  ],
};

export default episode;
