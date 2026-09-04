import type { Episode } from '../../lib/types';

/**
 * S01E01 Pilot — 모든 것이 시작된 회차.
 * 파혼하고 도망쳐 온 레이첼이 모니카네 무리에 합류하고, 스스로 살아가기로
 * 결심한다. "첫 만남 인사 / 위로 / 새 출발 응원"이라는 실생활 단골 상황 3종.
 */
const episode: Episode = {
  id: 's01e01',
  code: 'S01E01',
  season: 1,
  titleEn: 'The One Where Monica Gets a Roommate',
  titleKr: '모니카의 새 룸메이트',
  synopsisKr:
    '결혼식장에서 도망친 레이첼이 웨딩드레스 차림으로 센트럴 퍼크에 뛰어든다. ' +
    '고등학교 동창 모니카의 집에 얹혀살게 된 레이첼은 아빠 카드를 자르고 ' +
    '처음으로 "내 힘으로 살기"를 선언한다.',
  theme: '첫 만남 · 위로 · 새 출발',
  scenes: [
    {
      id: 's01e01-1',
      titleKr: '웨딩드레스 차림의 불청객',
      location: 'Central Perk',
      videoQuery: 'Friends Rachel wedding dress Central Perk first scene',
      contextKr:
        '비 오는 날, 웨딩드레스를 입은 레이첼이 커피하우스로 뛰어들어 옵니다. ' +
        '모니카는 놀란 친구들에게 레이첼을 소개하고, 다들 어색함을 누르며 ' +
        '말을 건네죠. 처음 만난 사람에게 인사하고, 힘들어 보이는 사람에게 ' +
        '부담스럽지 않게 다가가는 표현을 배웁니다.',
      expressions: [
        {
          id: 's01e01-1-1',
          phrase: "How you doin'?",
          meaningKr: '(친근하게) 안녕, 잘 지내?',
          nuanceKr:
            '조이의 시그니처 작업 멘트. 원래는 "How are you doing?"의 캐주얼한 축약으로, ' +
            '평범한 안부 인사지만 조이가 눈썹을 올리며 말하면 플러팅이 된다. ' +
            '억양에 따라 인사도, 농담도 되는 만능 표현.',
          exampleEn: "Hey, I'm Joey. How you doin'?",
          exampleKr: '안녕, 난 조이야. 잘 지내?',
          level: 1,
          variations: [
            { en: "How's it going?", kr: '요즘 어때? (제일 무난한 캐주얼 인사)' },
            { en: "What's up?", kr: '별일 없어? (대답도 "Not much"로 가볍게)' },
            { en: 'How have you been?', kr: '그동안 잘 지냈어? (오랜만에 만났을 때)' },
          ],
          mistakeKr:
            '"How are you?"에 국어책처럼 "I\'m fine, thank you, and you?"로 답하면 어색하다. ' +
            '원어민은 "Good, you?" / "Pretty good" 정도로 짧게 받고 바로 대화를 잇는다. ' +
            '이 인사말들은 진짜 안부를 묻는 질문이 아니라 인사 그 자체다.',
          soundKr:
            'are를 통째로 삼켜 "하우유두잉"처럼 한 덩어리로 흘린다. doin\'의 g는 발음하지 ' +
            '않는다. 조이처럼 쓰려면 you를 길게 눌러 "하우 유~ 두잉?" — 억양이 뜻을 바꾼다.',
        },
        {
          id: 's01e01-1-2',
          phrase: 'I could really use a friend right now.',
          meaningKr: '지금 친구가 절실히 필요해.',
          nuanceKr:
            '"could use ~"는 "~가 있으면 좋겠다, ~가 필요하다"를 부드럽게 말하는 표현. ' +
            '"I could use a coffee(커피 한잔 하고 싶다)"처럼 일상에서 정말 자주 쓴다. ' +
            'really를 넣으면 절실함이 커진다.',
          exampleEn: 'After a day like this, I could really use a coffee.',
          exampleKr: '이런 하루를 보내고 나니 커피 한잔이 절실해.',
          level: 2,
          variations: [
            { en: 'I could use some help here.', kr: '여기 도움이 좀 필요한데. (SOS를 부드럽게)' },
            { en: 'You look like you could use a break.', kr: '너 좀 쉬어야 할 것 같은데. (상대를 챙길 때)' },
            { en: 'I could use some good news for a change.', kr: '이제 좋은 소식 좀 듣고 싶다.' },
          ],
          mistakeKr:
            '"use"를 "사용하다"로 직역해 "친구를 사용한다고?"라고 오해하기 쉽다. ' +
            'could use는 통째로 "필요하다(need)"의 완곡한 버전이다. 또 "I need a friend"라고 ' +
            '하면 너무 직접적이고 무거워진다 — could use가 훨씬 자연스럽다.',
          soundKr:
            'could의 l은 묵음 — "쿠드"가 아니라 "큿". could use는 이어서 "쿠쥬-즈"처럼 ' +
            '연음된다. really에 강세를 주면 절실함이 살아난다: "아이 쿠드 뤼~을리 유저 프렌드".',
        },
        {
          id: 's01e01-1-3',
          phrase: "It's a long story.",
          meaningKr: '말하자면 길어.',
          nuanceKr:
            '지금 다 설명하기 힘든 사연이 있을 때 쓰는 클래식한 회피 표현. ' +
            '"무슨 일이야?"라는 질문에 가볍게 넘기고 싶을 때 딱 한마디로 끝낼 수 있다.',
          exampleEn: "Why am I still awake at 3 a.m.? It's a long story.",
          exampleKr: '왜 새벽 3시에 안 자고 있냐고? 말하자면 길어.',
          level: 1,
          variations: [
            { en: "Long story short, we missed the flight.", kr: '짧게 말하면, 우리 비행기 놓쳤어. (요약 버전)' },
            { en: "It's a long story — I'll tell you later.", kr: '얘기가 길어 — 나중에 말해 줄게.' },
            { en: "Don't ask. Long story.", kr: '묻지 마. 사연이 길다. (더 짧은 구어체)' },
          ],
          mistakeKr:
            '"The story is long"이라고 어순을 뒤집으면 문법은 맞지만 관용구 맛이 사라진다. ' +
            '반드시 "It\'s a long story" 통째로. 요약해 줄 때는 "Long story short(요약하자면)"를 ' +
            '문장 맨 앞에 붙인다 — 미드에서 하루에 한 번은 나오는 표현.',
          soundKr:
            "It's a가 \"잇처\"로 뭉개진다: \"잇처 롱-스토리\". long에 강세, story는 첫음절 " +
            '스토에 힘. 어깨를 살짝 으쓱하며 말하면 원어민 느낌 완성.',
        },
        {
          id: 's01e01-1-4',
          phrase: "You're better off without him.",
          meaningKr: '걔 없는 게 너한테 더 나아.',
          nuanceKr:
            '"be better off"는 "형편이 더 낫다"는 뜻. 이별한 친구를 위로할 때 ' +
            '단골로 나오는 문장이다. without 뒤만 바꾸면 어떤 상황에도 응용 가능 — ' +
            '"You\'re better off without that job."',
          exampleEn: "Honestly, you're better off without that job.",
          exampleKr: '솔직히 그 직장은 없는 게 너한테 더 나아.',
          level: 2,
          variations: [
            { en: "We're better off taking the subway.", kr: '지하철 타는 게 낫겠다. (without 없이 동명사와도 씀)' },
            { en: "He's better off not knowing.", kr: '걔는 모르는 게 나아.' },
            { en: "You'd be better off starting over.", kr: '처음부터 다시 하는 게 나을걸. (가정의 would)' },
          ],
          mistakeKr:
            '"better than him"과 헷갈리기 쉽다 — 그건 "걔보다 네가 낫다(비교)"고, ' +
            'better off without him은 "걔가 없어야 네 상황이 낫다"다. off를 빼고 ' +
            '"You\'re better without him"이라고 하면 뜻이 애매해지니 off까지 세트로 외우자.',
          soundKr:
            'better의 tt는 미국식으로 "베러". better off는 이어져 "베러로프". ' +
            'without him은 h가 약해져 "위다웃임". 전체: "유어 베러로프 위다웃임".',
        },
      ],
      dialogue: [
        {
          speaker: 'Rachel',
          en: "Monica? Oh, thank God you're here.",
          kr: '모니카? 아, 여기 있어서 정말 다행이야.',
        },
        {
          speaker: 'Monica',
          en: 'Rachel?! What happened? Why are you in a wedding dress?',
          kr: '레이첼?! 무슨 일이야? 왜 웨딩드레스를 입고 있어?',
        },
        {
          speaker: 'Rachel',
          en: "It's a long story. I just... I couldn't do it.",
          kr: '말하자면 길어. 그냥… 도저히 못 하겠더라.',
          expressionId: 's01e01-1-3',
        },
        {
          speaker: 'Rachel',
          en: "I know we haven't talked in years, but I could really use a friend right now.",
          kr: '우리 몇 년 동안 연락 안 한 거 알지만, 지금은 친구가 절실히 필요해.',
          expressionId: 's01e01-1-2',
        },
        {
          speaker: 'Monica',
          en: 'Of course. Come here. Everyone, this is Rachel.',
          kr: '당연하지. 이리 와. 얘들아, 여긴 레이첼이야.',
        },
        {
          speaker: 'Joey',
          en: "Hey. How you doin'?",
          kr: '안녕. 잘 지내?',
          expressionId: 's01e01-1-1',
        },
        {
          speaker: 'Monica',
          en: "Joey, not now. Rachel, trust me — you're better off without him.",
          kr: '조이, 지금은 아니야. 레이첼, 내 말 믿어 — 걔 없는 게 너한테 더 나아.',
          expressionId: 's01e01-1-4',
        },
        {
          speaker: 'Rachel',
          en: 'You know what? I think you might be right.',
          kr: '있잖아, 네 말이 맞는 것 같아.',
        },
      ],
      drills: [
        {
          promptKr:
            '힘든 하루를 보낸 당신. 친구에게 "지금 커피 한잔이 절실해"라고 말해 보세요.',
          targetEn: 'I could really use a coffee right now.',
          keywords: ['could', 'use', 'coffee'],
        },
        {
          promptKr:
            '친구가 "어제 무슨 일 있었어?"라고 묻습니다. 지금 다 설명하기 힘들다고 한마디로 넘겨 보세요.',
          targetEn: "It's a long story.",
          keywords: ['long', 'story'],
        },
        {
          promptKr:
            '나쁜 남자친구와 헤어진 친구에게 "걔 없는 게 너한테 더 나아"라고 위로해 보세요.',
          targetEn: "You're better off without him.",
          keywords: ['better', 'off', 'without'],
        },
      ],
    },
    {
      id: 's01e01-2',
      titleKr: '아빠 카드를 자르다',
      location: "Monica's Apartment",
      videoQuery: 'Friends Rachel cutting credit cards welcome to the real world',
      contextKr:
        '레이첼이 아빠의 신용카드를 자르며 처음으로 홀로서기를 선언하는 장면. ' +
        '모니카의 명대사 "Welcome to the real world"가 여기서 나옵니다. ' +
        '새 출발을 응원하고, 막막한 상황에서 스스로를 다잡는 표현을 배웁니다.',
      expressions: [
        {
          id: 's01e01-2-1',
          phrase: 'Welcome to the real world.',
          meaningKr: '현실 세계에 온 걸 환영해.',
          nuanceKr:
            '모니카의 명대사 — "Welcome to the real world. It sucks. You\'re gonna love it." ' +
            '보호받던 사람이 처음 현실을 마주할 때, 반은 놀리고 반은 응원하며 건네는 말. ' +
            '신입사원, 갓 독립한 친구에게 딱이다.',
          exampleEn: 'First day paying your own rent? Welcome to the real world.',
          exampleKr: '처음으로 네 월세를 직접 내는 날이라고? 현실 세계에 온 걸 환영해.',
          level: 1,
          variations: [
            { en: 'Welcome to adulthood.', kr: '어른의 세계에 온 걸 환영해. (세금·공과금 앞에서)' },
            { en: 'Welcome to my world.', kr: '내가 맨날 겪는 게 이거야. (내 고충을 상대가 처음 겪을 때)' },
            { en: 'Welcome aboard!', kr: '합류 환영! (새 팀원·동료에게)' },
          ],
          mistakeKr:
            '"real world"를 "리얼 월드(진짜 세계?)"로 직역해 어리둥절하기 쉽다 — 여기서는 ' +
            '"보호막 밖의 냉정한 현실 사회"라는 관용적 의미다. 뒤에 "It sucks. You\'re gonna ' +
            'love it(끔찍한데, 좋아하게 될걸)"처럼 반전 코멘트를 붙이는 게 원어민식 유머다.',
          soundKr:
            'Welcome to the가 "웰컴터더"로 뭉개진다. real world는 둘 다 강세를 살려 ' +
            '"뤼-을 워-을드" — r과 l을 정확히 굴리는 게 포인트인 난이도 높은 조합이다.',
        },
        {
          id: 's01e01-2-2',
          phrase: "I'm gonna figure it out.",
          meaningKr: '어떻게든 방법을 찾아낼 거야.',
          nuanceKr:
            '"figure out"은 "생각해서 알아내다/해결하다". 아직 답은 없지만 해내겠다는 ' +
            '의지를 보여줄 때 미국인들이 입에 달고 사는 표현. ' +
            '"We\'ll figure it out(어떻게든 되겠지)"도 세트로 알아두자.',
          exampleEn: "I don't know how yet, but I'm gonna figure it out.",
          exampleKr: '아직 방법은 모르겠지만, 어떻게든 찾아낼 거야.',
          level: 1,
          variations: [
            { en: "We'll figure something out.", kr: '뭐라도 방법을 찾아보자. (함께 고민할 때)' },
            { en: "I can't figure out how this works.", kr: '이거 어떻게 쓰는 건지 모르겠어. (기계·앱 앞에서)' },
            { en: 'I finally figured out why.', kr: '드디어 이유를 알아냈어.' },
          ],
          mistakeKr:
            '목적어가 대명사(it)면 반드시 figure와 out 사이에 넣는다 — "figure out it"은 ' +
            '틀린 어순. "figure it out"이 맞다. 명사는 양쪽 다 가능: "figure out the answer" ' +
            '또는 "figure the answer out".',
          soundKr:
            'gonna는 "거나"로 가볍게. figure it out은 셋이 이어져 "피겨릿아웃"으로 한 단어처럼 ' +
            '소리 난다. out에 마지막 강세를 얹으면 결의가 느껴진다: "암 거나 피겨릿아웃!".',
        },
        {
          id: 's01e01-2-3',
          phrase: "That's what friends are for.",
          meaningKr: '친구 좋다는 게 뭐야.',
          nuanceKr:
            '도와줘서 고맙다는 말에 대한 최고의 대답. "친구란 원래 이런 걸 위해 ' +
            '있는 거야"라는 뜻으로, 생색내지 않고 따뜻하게 받아치는 표현이다.',
          exampleEn: "Don't thank me — that's what friends are for.",
          exampleKr: '고맙긴 — 친구 좋다는 게 뭐야.',
          level: 1,
          variations: [
            { en: "That's what family is for.", kr: '가족 좋다는 게 뭐야. (가족 버전)' },
            { en: "That's what I'm here for.", kr: '내가 그러려고 있는 거지. (도움을 준 직후)' },
            { en: 'Anytime.', kr: '언제든지. (같은 상황에서 쓰는 초간단 대답)' },
          ],
          mistakeKr:
            '문장 끝의 for를 빼먹기 쉽다 — "what friends are"만 하면 미완성 문장이다. ' +
            '"~하라고 있는 거다"라는 뜻은 끝의 for가 만든다. 고맙다는 말에 "No, no"라고만 ' +
            '손사래 치는 것보다 이 문장을 쓰면 관계가 훨씬 따뜻해진다.',
          soundKr:
            "That's what이 \"댓츠웟\"으로 붙고, friends are for는 \"프렌저 포-\"로 흐른다. " +
            'friends에 최고 강세, 마지막 for는 낮고 부드럽게 떨어뜨린다.',
        },
      ],
      dialogue: [
        {
          speaker: 'Monica',
          en: "Okay. You ready to cut up daddy's credit cards?",
          kr: '자. 아빠 신용카드 자를 준비 됐어?',
        },
        {
          speaker: 'Rachel',
          en: "Oh God... okay. If I do this, there's no going back.",
          kr: '어떡해… 좋아. 이걸 자르면 이제 돌이킬 수 없어.',
        },
        {
          speaker: 'Monica',
          en: "Welcome to the real world. It sucks — you're gonna love it.",
          kr: '현실 세계에 온 걸 환영해. 끔찍하지만 — 분명 좋아하게 될걸.',
          expressionId: 's01e01-2-1',
        },
        {
          speaker: 'Rachel',
          en: 'I have no job, no plan, and I just cut up my only money.',
          kr: '직업도 없고, 계획도 없고, 방금 유일한 돈줄을 잘라 버렸네.',
        },
        {
          speaker: 'Rachel',
          en: "But you know what? I'm gonna figure it out.",
          kr: '그래도 있잖아, 어떻게든 방법을 찾아낼 거야.',
          expressionId: 's01e01-2-2',
        },
        {
          speaker: 'Monica',
          en: "That's the spirit. And you can stay here as long as you need.",
          kr: '그 마음가짐이야. 그리고 필요한 만큼 여기 있어도 돼.',
        },
        {
          speaker: 'Rachel',
          en: "Monica... I don't know how to thank you.",
          kr: '모니카… 어떻게 고마움을 표현해야 할지 모르겠어.',
        },
        {
          speaker: 'Monica',
          en: "Don't. That's what friends are for.",
          kr: '그러지 마. 친구 좋다는 게 뭐야.',
          expressionId: 's01e01-2-3',
        },
      ],
      drills: [
        {
          promptKr:
            '새 프로젝트를 맡았는데 아직 방법을 모릅니다. "어떻게든 방법을 찾아낼 거야"라고 말해 보세요.',
          targetEn: "I'm gonna figure it out.",
          keywords: ['figure', 'out'],
        },
        {
          promptKr:
            '친구가 "정말 고마워, 어떻게 갚지?"라고 합니다. "친구 좋다는 게 뭐야"라고 받아 보세요.',
          targetEn: "That's what friends are for.",
          keywords: ['friends', 'for'],
        },
        {
          promptKr:
            '동생이 첫 자취를 시작하며 공과금 고지서에 놀랍니다. "현실 세계에 온 걸 환영해"라고 놀려 보세요.',
          targetEn: 'Welcome to the real world.',
          keywords: ['welcome', 'real', 'world'],
        },
      ],
    },
  ],
};

export default episode;
