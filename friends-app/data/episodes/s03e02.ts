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
      videoQuery: 'Friends the one where no one is ready Ross rushing everyone',
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
          variations: [
            { en: "Hurry up, or we're gonna miss the train!", kr: '서둘러, 안 그러면 기차 놓치겠어! (놓칠 대상을 콕 집는 버전)' },
            { en: "If we don't leave now, we're gonna be so late.", kr: '지금 안 나가면 우리 진짜 늦어. (조건까지 붙인 압박)' },
            { en: "Sorry, I'm running late.", kr: '미안, 나 좀 늦을 것 같아. (늦고 있는 쪽에서 미리 알릴 때)' },
          ],
          mistakeKr:
            '"늦다"를 그대로 옮겨 "We will late"라고 하기 쉽다 — late는 형용사라 be가 반드시 ' +
            '필요하다: gonna be late. 또 지금 늦어지는 중이라면 "I\'m late(이미 늦었다)"보다 ' +
            '"I\'m running late(늦어지고 있다)"가 상황에 맞는 경우가 많다.',
          soundKr:
            "We're gonna be가 \"위어거너비\" 한 덩어리로 뭉개진다. 강세는 오직 late에 몰아주고 " +
            '끝을 살짝 올리면 다급함이 산다: "위거너비 레잇!". gonna의 o는 힘을 빼고 "어"로.',
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
          variations: [
            { en: "What's taking him so long?", kr: '걔는 뭐가 이렇게 오래 걸린대? (사람을 넣은 버전)' },
            { en: "Sorry it's taking so long.", kr: '오래 걸려서 미안해요. (기다리게 한 쪽의 사과)' },
            { en: 'This is taking forever.', kr: '한도 끝도 없이 오래 걸리네. (기다리다 지쳤을 때)' },
          ],
          mistakeKr:
            '"왜 이렇게 늦어?"를 "Why so late?"로 직역하면 어색하다 — 시간이 걸리는 건 ' +
            'take로 말한다. 또 주어를 what으로 두면 상황 탓이 되지만, "Why are YOU taking ' +
            'so long?"처럼 you를 세우면 훨씬 공격적으로 들린다는 온도 차이도 기억하자.',
          soundKr:
            "What's taking이 \"왓스테이킹\"으로 붙는다. taking의 테이와 long에 강세, so를 " +
            '길게 끌면 짜증이 배가된다: "왓스테이킹 쏘~ 롱?". 의문문이지만 끝은 내려 말한다.',
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
          variations: [
            { en: "I don't have time for this right now.", kr: '나 지금 이럴 시간 없거든. (1인칭 손절 버전)' },
            { en: 'Do you have time for a quick coffee?', kr: '커피 한잔할 시간 돼? (have time의 기본 활용)' },
            { en: "There's no time to explain — let's go!", kr: '설명할 시간 없어 — 가자! (영화 주인공처럼 급할 때)' },
          ],
          mistakeKr:
            '"시간이 없다"를 "There is no time"으로만 알면 누가 시간이 없는지 못 살린다 — ' +
            '회화의 기본형은 주어를 세운 "We don\'t have time"이다. 그리고 for this를 빼면 ' +
            '그냥 시간이 없다는 말이고, for this가 붙어야 "이런 짓 할 시간 없다"는 핀잔이 된다.',
          soundKr:
            "don't have는 t가 떨어져 \"돈해브\". time에 최고 강세를 주고 for this는 낮고 " +
            '빠르게 흘린다: "위 돈해브 타임 퍼디스". 단어를 뚝뚝 끊어 말할수록 단호해진다.',
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
      drills: [
        {
          promptKr:
            '영화 시작 10분 전인데 친구가 아직 준비 중입니다. "서둘러, 우리 늦겠어!"라고 재촉해 보세요.',
          targetEn: "Hurry up, we're gonna be late!",
          keywords: ['hurry', 'gonna', 'late'],
        },
        {
          promptKr:
            '배달 음식을 시킨 지 한 시간이 지났습니다. "뭐가 이렇게 오래 걸려?"라고 말해 보세요.',
          targetEn: "What's taking so long?",
          keywords: ['taking', 'long'],
        },
        {
          promptKr:
            '회의 중에 동료들이 딴 얘기로 언쟁을 시작합니다. "지금 이럴 시간 없어요"라고 끊어 보세요.',
          targetEn: "We don't have time for this.",
          keywords: ['have', 'time'],
        },
      ],
    },
    {
      id: 's03e02-2',
      titleKr: '의자 전쟁, 그리고 옷 전부 입기',
      location: "Monica's Apartment",
      videoQuery: 'Friends Joey wearing all of Chandlers clothes',
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
          variations: [
            { en: 'Could this day BE any longer?', kr: '오늘 하루가 이보다 더 길 수 있냐? (끝나지 않는 하루에)' },
            { en: 'Could you BE any louder?', kr: '너 그보다 더 시끄러울 수 있냐? (시끄러운 친구에게 비꼬기)' },
            { en: 'Could it BE any more obvious?', kr: '이게 이보다 더 뻔할 수가 있나? (속이 다 보일 때)' },
          ],
          mistakeKr:
            '평서문으로 "I could be more tired"라고 하면 "더 피곤할 수도 있다"는 정반대 ' +
            '뜻이 된다 — 반드시 Could로 시작하는 의문문에 BE 강세가 얹혀야 "이게 최대치"라는 ' +
            '비꼼이 성립한다. any more(또는 any + 비교급)를 빼먹으면 평범한 질문이 되니 주의.',
          soundKr:
            '이 표현의 생명은 BE를 과장되게 높고 세게 치는 것 — "쿠다이 비~ 애니모어 ' +
            '타이어드?". 챈들러처럼 BE 앞에서 반 박자 끊었다 터뜨리고, 나머지 단어는 ' +
            '오히려 평평하게 눌러야 대비가 산다.',
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
          variations: [
            { en: 'Cut it out, you two!', kr: '둘 다 그만해! (거의 같은 뜻의 쌍둥이 표현)' },
            { en: 'Knock it off before someone gets hurt.', kr: '누구 하나 다치기 전에 그만해.' },
            { en: "Will you knock it off? I'm trying to work.", kr: '그만 좀 할래? 나 일하잖아. (짜증 최대치 버전)' },
          ],
          mistakeKr:
            'knock을 "두드리다"로 직역해 문 얘기로 오해하기 쉽지만, knock it off는 통째로 ' +
            '"그만해"라는 관용구다. it은 항상 knock과 off 사이 — "knock off it"은 틀린 어순. ' +
            '"Stop it"보다 짜증 수위가 높아서 윗사람이나 초면에는 "Please stop"이 안전하다.',
          soundKr:
            'knock의 k는 묵음이라 "낙". 세 단어가 이어져 "나킷오프"로 한 방에 나간다. ' +
            'off에 강세를 콱 얹고 짧게 끊어야 명령의 맛이 산다: "나킷 오프!".',
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
          variations: [
            { en: "Trust me, it's not worth the trouble.", kr: '내 말 믿어, 그 고생할 가치가 없어.' },
            { en: 'The view is totally worth it.', kr: '그 경치는 완전 그만한 가치가 있어. (반대로 강력 추천할 때)' },
            { en: 'Is it really worth fighting over?', kr: '그게 진짜 싸울 만한 일이야? (말리면서 되묻기)' },
          ],
          mistakeKr:
            '"It\'s not worthy"라고 하기 쉽다 — worthy는 "자격 있는"이라는 다른 단어다. ' +
            'worth 뒤에는 명사나 동명사가 바로 온다: worth it, worth trying. "worth to ' +
            'try"처럼 to부정사를 붙이는 것도 한국인 단골 실수다.',
          soundKr:
            'worth의 th는 혀끝을 살짝 물었다 빼는 무성음 — "월쓰"에 가깝다. not worth it은 ' +
            '이어져 "낫월씻"으로 흐른다. worth에 강세, 마지막 it은 거의 삼킨다: "잇츠 낫월씻".',
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
      drills: [
        {
          promptKr:
            '세 시간밖에 못 잔 날입니다. 챈들러처럼 비꼬며 "이보다 더 피곤할 수가 있겠어?"라고 말해 보세요.',
          targetEn: 'Could I be any more tired?',
          keywords: ['could', 'more', 'tired'],
        },
        {
          promptKr:
            '동생 둘이 리모컨을 두고 유치하게 싸우고 있습니다. "야, 둘 다 그만 좀 해!"라고 외쳐 보세요.',
          targetEn: 'Hey, knock it off, you two!',
          keywords: ['knock', 'off'],
        },
        {
          promptKr:
            '친구가 사소한 일로 복수하겠다고 벼릅니다. "그냥 넘어가 — 그럴 가치 없어"라고 말려 보세요.',
          targetEn: "Let it go — it's not worth it.",
          keywords: ['let', 'go', 'worth'],
        },
      ],
    },
  ],
};

export default episode;
