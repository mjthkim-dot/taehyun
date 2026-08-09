import type { Episode } from '../../lib/types';

/**
 * S06E25 The One with the Proposal — 모니카와 챈들러의 프러포즈.
 * 사랑 고백, 청혼, 그리고 축하. 인생 이벤트의 회화.
 */
const episode: Episode = {
  id: 's06e25',
  code: 'S06E25',
  season: 6,
  titleEn: 'The One with the Proposal',
  titleKr: '촛불 속의 프러포즈',
  synopsisKr:
    '깜짝 프러포즈를 준비하던 챈들러의 계획이 꼬이지만, 촛불로 가득한 ' +
    '아파트에서 오히려 모니카가 먼저 무릎을 꿇는다. 울다가 말을 잇지 못하는 ' +
    '모니카, 그리고 챈들러의 완벽한 마무리 — 시리즈에서 가장 사랑받는 장면.',
  theme: '고백 · 청혼 · 축하',
  scenes: [
    {
      id: 's06e25-1',
      titleKr: '촛불 가득한 거실에서',
      location: "Monica & Chandler's Apartment",
      contextKr:
        '문을 연 챈들러 앞에 촛불로 가득한 거실과 모니카가 있습니다. ' +
        '서로 먼저 청혼하려다 눈물바다가 되는 장면. 확신을 표현하는 말, ' +
        '청혼의 말, 인생 최고의 순간을 전하는 표현을 배웁니다.',
      expressions: [
        {
          id: 's06e25-1-1',
          phrase: 'Will you marry me?',
          meaningKr: '나와 결혼해 줄래?',
          nuanceKr:
            '청혼의 표준 문장. "Marry me(결혼해 줘)"라고 짧게 던지면 더 캐주얼하고 ' +
            '강렬하다. 대답은 "Yes, I will!" 혹은 프렌즈식으로 눈물 콧물 범벅이 되어 ' +
            '"Yes"조차 못 하기.',
          exampleEn: 'You are my best friend and my whole heart. Will you marry me?',
          exampleKr: '너는 내 가장 친한 친구이자 내 마음 전부야. 나와 결혼해 줄래?',
          level: 1,
        },
        {
          id: 's06e25-1-2',
          phrase: "You're the one.",
          meaningKr: '너야말로 내 운명이야.',
          nuanceKr:
            '"the one"은 "바로 그 한 사람", 즉 운명의 상대. "You\'re the one for me", ' +
            '"He\'s the one" 등으로 활용한다. 연애 리얼리티 쇼 제목으로도 단골. ' +
            '물건에 쓰면 "That\'s the one!(바로 그거야!)"이 된다.',
          exampleEn: 'The moment we met, I just knew — you\'re the one.',
          exampleKr: '우리가 만난 순간 바로 알았어 — 너야말로 내 운명이라는 걸.',
          level: 2,
        },
        {
          id: 's06e25-1-3',
          phrase: "I've never been more sure of anything.",
          meaningKr: '이보다 확신해 본 적이 없어.',
          nuanceKr:
            '비교급 + 현재완료로 만드는 최상급 확신 — "지금이 인생 최대의 확신"이라는 ' +
            '구조다. "I\'ve never been happier(지금이 제일 행복해)"처럼 형용사만 바꾸면 ' +
            '무한 응용된다. 결심을 전할 때 이만큼 힘 있는 문형이 없다.',
          exampleEn: 'Quitting to start my own café? I\'ve never been more sure of anything.',
          exampleKr: '회사 그만두고 내 카페를 차리는 거? 이보다 확신해 본 적이 없어.',
          level: 3,
        },
      ],
      dialogue: [
        {
          speaker: 'Chandler',
          en: 'Oh my God. The candles... Monica, what is all this?',
          kr: '세상에. 이 촛불들… 모니카, 이게 다 뭐야?',
        },
        {
          speaker: 'Monica',
          en: 'You wanted it to be a surprise. But I wanted... okay, I\'m just gonna say it.',
          kr: '네가 깜짝 이벤트로 하고 싶어 했잖아. 근데 나는… 좋아, 그냥 말할게.',
        },
        {
          speaker: 'Monica',
          en: 'In all my life... I never thought I would be so lucky as to... to fall in love with my best—',
          kr: '내 평생… 이렇게 운이 좋을 줄 몰랐어. 가장 친한 친구와… 사랑에 빠지는—',
        },
        {
          speaker: 'Monica',
          en: "There's a reason why girls don't do this. I can't...",
          kr: '여자들이 이걸 안 하는 데는 이유가 있었어. 못 하겠어…',
        },
        {
          speaker: 'Chandler',
          en: "I'll do it. Monica... you make me happier than I ever thought I could be. You're the one.",
          kr: '내가 할게. 모니카… 너는 내가 가능하다고 생각한 것보다 더 행복하게 해 줘. 너야말로 내 운명이야.',
          expressionId: 's06e25-1-2',
        },
        {
          speaker: 'Chandler',
          en: "I've never been more sure of anything. Will you marry me?",
          kr: '이보다 확신해 본 적이 없어. 나와 결혼해 줄래?',
          expressionId: 's06e25-1-3',
        },
        {
          speaker: 'Monica',
          en: 'Yes! Yes!! A thousand times yes!',
          kr: '응! 응!! 천 번이라도 응!',
          expressionId: 's06e25-1-1',
        },
      ],
    },
    {
      id: 's06e25-2',
      titleKr: '친구들에게 알리는 밤',
      location: 'Central Perk',
      contextKr:
        '약혼 소식을 들고 커피하우스로 달려간 두 사람. 친구들의 환호가 터집니다. ' +
        '빅뉴스 발표하기, 진심으로 축하하기, 축배 제안하기 — 좋은 소식의 날 ' +
        '쓰는 표현을 배웁니다.',
      expressions: [
        {
          id: 's06e25-2-1',
          phrase: "We're engaged!",
          meaningKr: '우리 약혼했어!',
          nuanceKr:
            '"engaged"는 "약혼한". get engaged(약혼하다) → be engaged(약혼 상태) 순서로 ' +
            '기억하자. 참고로 엔지니어링 회의에서 "engaged"는 "몰입한"이라는 뜻 — ' +
            '문맥이 전부다. 결혼(married), 임신(expecting)과 함께 3대 발표 표현.',
          exampleEn: 'Everyone, we have news — we\'re engaged!',
          exampleKr: '얘들아, 우리 소식 있어 — 우리 약혼했어!',
          level: 1,
        },
        {
          id: 's06e25-2-2',
          phrase: "I'm so happy for you.",
          meaningKr: '내 일처럼 기뻐.',
          nuanceKr:
            '남의 좋은 소식에 대한 미국식 표준 축하. "for you"가 핵심 — "너를 위해 ' +
            '기쁘다", 즉 진심으로 함께 기뻐한다는 뜻이다. "Congratulations!"와 ' +
            '세트로 쓰면 완벽하다.',
          exampleEn: 'You got the job?! Congratulations, I\'m so happy for you!',
          exampleKr: '합격했다고?! 축하해, 내 일처럼 기쁘다!',
          level: 1,
        },
        {
          id: 's06e25-2-3',
          phrase: 'This calls for a celebration.',
          meaningKr: '이건 축하해야 할 일이지.',
          nuanceKr:
            '"call for"는 "~을 요구하다". 좋은 소식이 나오면 "이 상황이 축하를 ' +
            '요구한다"며 자연스럽게 축배·파티로 넘어가는 다리 표현이다. ' +
            '"This calls for champagne!(샴페인 각이다!)"처럼 바꿔도 좋다.',
          exampleEn: 'A promotion AND a new apartment? This calls for a celebration.',
          exampleKr: '승진에 새 아파트까지? 이건 축하해야 할 일이지.',
          level: 2,
        },
      ],
      dialogue: [
        {
          speaker: 'Monica',
          en: 'Hey guys? Guys! We have an announcement.',
          kr: '얘들아? 얘들아! 발표할 게 있어.',
        },
        {
          speaker: 'Chandler',
          en: "We're engaged!",
          kr: '우리 약혼했어!',
          expressionId: 's06e25-2-1',
        },
        {
          speaker: 'Rachel',
          en: 'Oh my God!! Let me see the ring! Let me see it!',
          kr: '세상에!! 반지 보여 줘! 어서 보여 줘!',
        },
        {
          speaker: 'Phoebe',
          en: 'I knew it! Well, I didn\'t know it, but I sensed a strong ring energy today.',
          kr: '내 그럴 줄 알았어! 뭐, 알았던 건 아니지만 오늘 강한 반지 기운을 느꼈거든.',
        },
        {
          speaker: 'Ross',
          en: "Congratulations, you two. I'm so happy for you.",
          kr: '축하한다, 너희 둘. 내 일처럼 기쁘다.',
          expressionId: 's06e25-2-2',
        },
        {
          speaker: 'Joey',
          en: 'My two best friends, getting married! This calls for a celebration!',
          kr: '내 절친 둘이 결혼이라니! 이건 축하해야 할 일이지!',
          expressionId: 's06e25-2-3',
        },
        {
          speaker: 'Chandler',
          en: 'Drinks on me! ...I mean, drinks on Joey. I just got engaged, I\'m saving for a wedding.',
          kr: '술은 내가 쏜다! …아니, 조이가 쏜다. 나 방금 약혼해서 결혼 자금 모아야 돼.',
        },
      ],
    },
  ],
};

export default episode;
