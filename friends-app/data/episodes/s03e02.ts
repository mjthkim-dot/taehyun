import type { Episode } from '../../lib/types';

/**
 * S03E02 The One Where No One's Ready — 아무도 준비가 안 됐다.
 * 재촉하기, 티격태격, 말리기. 리얼타임으로 흘러가는 코미디 명작 회차.
 */
const episode: Episode = {
  id: 's03e02',
  code: 'S03E02',
  season: 3,
  titleEn: "The One Where No One's Ready",
  titleKr: '아무도 준비가 안 됐어',
  synopsisKr:
    '로스의 박물관 행사가 코앞인데 아무도 옷을 안 입었다. 조이와 챈들러는 ' +
    '의자 하나를 두고 전쟁을 벌이고, 결국 조이는 챈들러의 옷을 전부 껴입고 ' +
    '나타난다 — "Could I BE wearing any more clothes?"',
  theme: '재촉 · 티격태격 · 중재',
  scenes: [
    {
      id: 's03e02-1',
      titleKr: '박물관 행사 30분 전',
      location: "Monica's Apartment",
      contextKr:
        '턱시도까지 갖춰 입은 로스 혼자 애가 탑니다. 시간 없다고 재촉하기, ' +
        '왜 이렇게 오래 걸리냐고 따지기 — 약속 시간에 늦어 가는 모든 상황에서 ' +
        '바로 써먹는 표현을 배웁니다.',
      expressions: [
        {
          id: 's03e02-1-1',
          phrase: "We're gonna be late!",
          meaningKr: '우리 늦겠어!',
          nuanceKr:
            '"be late"에 미래 표현 gonna(going to)를 붙인 재촉의 기본형. ' +
            '"We\'re gonna be SO late!"처럼 so를 넣으면 더 다급해진다. ' +
            '이 회차의 로스는 이 말을 무한 반복한다.',
          exampleEn: 'The movie starts in ten minutes — we\'re gonna be late!',
          exampleKr: '영화 10분 뒤에 시작해 — 우리 늦겠어!',
          level: 1,
        },
        {
          id: 's03e02-1-2',
          phrase: "What's taking so long?",
          meaningKr: '뭐가 이렇게 오래 걸려?',
          nuanceKr:
            '직역하면 "무엇이 이렇게 오래 걸리게 하고 있어?". 사람을 직접 탓하지 않고 ' +
            '상황을 주어로 두는 게 포인트다. 배달, 대기줄, 준비 안 끝난 친구 — ' +
            '기다림이 있는 모든 곳에서 쓴다.',
          exampleEn: 'The food was ordered an hour ago. What\'s taking so long?',
          exampleKr: '음식 시킨 지 한 시간이나 됐는데. 뭐가 이렇게 오래 걸려?',
          level: 2,
        },
        {
          id: 's03e02-1-3',
          phrase: "We don't have time for this.",
          meaningKr: '지금 이럴 시간 없어.',
          nuanceKr:
            '싸움이나 딴짓으로 시간이 새고 있을 때 끊어 주는 말. ' +
            '"I don\'t have time for this"로 바꾸면 "나 이런 거에 낭비할 시간 없어"라는 ' +
            '짜증 섞인 손절 표현이 된다.',
          exampleEn: 'Guys, stop arguing about the playlist — we don\'t have time for this.',
          exampleKr: '얘들아, 플레이리스트 갖고 그만 싸워 — 지금 이럴 시간 없어.',
          level: 2,
        },
      ],
      dialogue: [
        {
          speaker: 'Ross',
          en: 'Okay, people! The banquet starts in thirty minutes. Why is no one dressed?',
          kr: '자, 여러분! 행사 30분 뒤에 시작해. 왜 아무도 옷을 안 입은 거야?',
        },
        {
          speaker: 'Phoebe',
          en: 'Relax, Ross. Getting ready takes, like, two minutes.',
          kr: '진정해, 로스. 준비하는 데 한 2분이면 돼.',
        },
        {
          speaker: 'Ross',
          en: "Rachel, you're still in a towel! We're gonna be late!",
          kr: '레이첼, 아직도 수건 차림이잖아! 우리 늦겠어!',
          expressionId: 's03e02-1-1',
        },
        {
          speaker: 'Rachel',
          en: "I can't decide between two dresses. This is a big night for you!",
          kr: '드레스 두 벌 중에 못 고르겠단 말이야. 너한테 중요한 밤이잖아!',
        },
        {
          speaker: 'Ross',
          en: "You've been in there for forty minutes. What's taking so long?",
          kr: '너 거기 들어간 지 40분 됐어. 뭐가 이렇게 오래 걸려?',
          expressionId: 's03e02-1-2',
        },
        {
          speaker: 'Monica',
          en: 'Should I call Richard back? Or is that weird? I\'m gonna call him.',
          kr: '리처드한테 다시 전화할까? 아니면 이상한가? 그냥 전화해야겠다.',
        },
        {
          speaker: 'Ross',
          en: "Monica, please. We don't have time for this!",
          kr: '모니카, 제발. 지금 이럴 시간 없어!',
          expressionId: 's03e02-1-3',
        },
        {
          speaker: 'Chandler',
          en: 'Bad news, Ross. It\'s about to get so much worse.',
          kr: '나쁜 소식이야, 로스. 이제 훨씬 더 심각해질 거거든.',
        },
      ],
    },
    {
      id: 's03e02-2',
      titleKr: '의자 전쟁, 그리고 옷 전부 입기',
      location: "Monica's Apartment",
      contextKr:
        '챈들러가 잠깐 일어난 사이 조이가 의자를 차지하면서 유치한 전면전이 ' +
        '시작됩니다. 복수로 조이는 챈들러의 옷장을 통째로 입고 나타나죠. ' +
        '챈들러식 비꼬기 화법과, 싸움을 말리는 표현을 배웁니다.',
      expressions: [
        {
          id: 's03e02-2-1',
          phrase: 'Could I BE any more...?',
          meaningKr: '이보다 더 ~할 수가 있겠어?',
          nuanceKr:
            '챈들러 말투의 정수. BE에 강세를 주며 "이게 최대치"라고 비꼬는 강조법이다. ' +
            '조이가 챈들러 흉내를 내며 한 "Could I BE wearing any more clothes?"가 ' +
            '시리즈 최고 명대사 중 하나. 아무 형용사나 넣어 응용한다.',
          exampleEn: 'Could I BE any more tired? I slept three hours.',
          exampleKr: '이보다 더 피곤할 수가 있겠어? 세 시간 잤다고.',
          level: 3,
        },
        {
          id: 's03e02-2-2',
          phrase: 'Knock it off!',
          meaningKr: '그만 좀 해!',
          nuanceKr:
            '유치한 장난, 싸움, 시끄러운 행동을 끊을 때 쓰는 명령형. ' +
            '"Cut it out!"과 거의 같은 뜻이다. 친한 사이에서 쓰는 말이고, ' +
            '격식 있는 자리에서는 "Please stop"이 안전하다.',
          exampleEn: 'Hey! Knock it off, both of you. The neighbors can hear.',
          exampleKr: '야! 둘 다 그만 좀 해. 옆집에 다 들리겠다.',
          level: 2,
        },
        {
          id: 's03e02-2-3',
          phrase: "It's not worth it.",
          meaningKr: '그럴 가치 없어.',
          nuanceKr:
            '싸움·복수·무리수를 말릴 때 — "그렇게까지 할 일이 아니야". ' +
            '"Trust me, it\'s not worth it."으로 통째로 쓰면 산전수전 다 겪은 ' +
            '친구의 조언처럼 들린다.',
          exampleEn: "Let it go, man. Fighting over a chair? It's not worth it.",
          exampleKr: '그냥 넘어가, 인마. 의자 하나로 싸운다고? 그럴 가치 없어.',
          level: 2,
        },
      ],
      dialogue: [
        {
          speaker: 'Chandler',
          en: 'You took my seat. I got up for ONE minute.',
          kr: '네가 내 자리 뺏었잖아. 나 딱 1분 일어났었다고.',
        },
        {
          speaker: 'Joey',
          en: 'You left the chair. Chair rules: you leave it, you lose it.',
          kr: '네가 의자를 떠났잖아. 의자의 법칙: 떠나면 잃는 거야.',
        },
        {
          speaker: 'Ross',
          en: 'Guys! Knock it off! It\'s a chair. We are leaving in five minutes.',
          kr: '얘들아! 그만 좀 해! 그냥 의자잖아. 우리 5분 뒤에 나가야 해.',
          expressionId: 's03e02-2-2',
        },
        {
          speaker: 'Chandler',
          en: 'Fine. Then he gives me back my seat AND my clothes he\'s hiding.',
          kr: '좋아. 그럼 쟤가 내 자리랑, 숨겨 놓은 내 옷도 돌려줘야지.',
        },
        {
          speaker: 'Joey',
          en: 'Oh, your clothes? Okay. Give me a second.',
          kr: '아, 네 옷? 알았어. 잠깐만 기다려.',
        },
        {
          speaker: 'Joey',
          en: "Okay, buddy-boy. Here it is. Could I BE wearing any more clothes?",
          kr: '자, 친구. 어때. 내가 이보다 옷을 더 입을 수가 있겠냐?',
          expressionId: 's03e02-2-1',
        },
        {
          speaker: 'Ross',
          en: 'Chandler, breathe. Just let it go — it\'s not worth it.',
          kr: '챈들러, 숨 쉬어. 그냥 넘어가 — 그럴 가치 없어.',
          expressionId: 's03e02-2-3',
        },
        {
          speaker: 'Chandler',
          en: "He's wearing my underwear... over his pants. It might be worth it.",
          kr: '쟤 내 속옷을… 바지 위에 입었어. 가치가 있을지도 몰라.',
        },
      ],
    },
  ],
};

export default episode;
