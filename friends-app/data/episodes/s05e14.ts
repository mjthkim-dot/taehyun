import type { Episode } from '../../lib/types';

/**
 * S05E14 The One Where Everybody Finds Out — "They don't know that we know they know we know."
 * 비밀, 목격, 떠보기 게임. 서스펜스 코미디의 정점.
 */
const episode: Episode = {
  id: 's05e14',
  code: 'S05E14',
  season: 5,
  titleEn: 'The One Where Everybody Finds Out',
  titleKr: '모두가 알게 된 날',
  synopsisKr:
    '피비가 창밖으로 모니카와 챈들러의 비밀 연애 현장을 목격한다 — "내 눈! ' +
    '내 눈!!" 이를 아는 척하지 않고 서로를 떠보는 심리전이 시작되고, ' +
    '"쟤네는 우리가 아는 걸 몰라"의 무한 루프가 펼쳐진다.',
  theme: '비밀 · 놀람 · 심리전',
  scenes: [
    {
      id: 's05e14-1',
      titleKr: '창문 너머의 목격',
      location: "Ugly Naked Guy's Apartment",
      videoQuery: 'Friends Phoebe finds out Monica and Chandler my eyes',
      contextKr:
        '어글리 네이키드 가이의 아파트를 보러 간 피비와 레이첼. 창밖으로 ' +
        '건너편 모니카네가 보이는데… 피비가 보면 안 될 것을 보고 맙니다. ' +
        '충격적인 목격담 전하기, 비밀 지키라고 당부하기를 배웁니다.',
      expressions: [
        {
          id: 's05e14-1-1',
          phrase: "You'll never guess what I just saw.",
          meaningKr: '내가 방금 뭘 봤는지 넌 상상도 못 할걸.',
          nuanceKr:
            '충격 뉴스를 터뜨리기 직전의 예열 멘트. "You\'ll never guess what/who/where..."는 ' +
            '가십의 표준 오프닝이다. 이 말을 들으면 미국인들은 자동으로 "What?!"이라고 ' +
            '받아 준다.',
          exampleEn: "You'll never guess what I just saw in the break room.",
          exampleKr: '내가 방금 휴게실에서 뭘 봤는지 넌 상상도 못 할걸.',
          level: 2,
          variations: [
            { en: "You'll never guess who I ran into today.", kr: '오늘 내가 누굴 마주쳤는지 상상도 못 할걸. (우연한 만남 소식)' },
            { en: 'Guess what — I got the job!', kr: '있잖아 — 나 합격했어! (더 짧은 뉴스 오프닝)' },
            { en: "You're not gonna believe this.", kr: '이거 들으면 안 믿길걸. (충격 뉴스 예고편)' },
          ],
          mistakeKr:
            '"넌 못 맞힐 거야"를 "You can\'t guess"로 직역하면 어색하다 — 관용적으로 미래형 ' +
            '"You\'ll never guess"를 쓴다. 또 what 뒤는 의문문이 아니라 평서문 어순이라 ' +
            '"what I just saw"가 맞고, "what did I just see"라고 하면 틀린다.',
          soundKr:
            "You'll은 \"유을\"로 가볍게 흘리고 never에 강세를 꽝 준다. guess what은 붙여서 " +
            '"게스왓". 예고 멘트답게 끝을 살짝 올려 상대의 "What?!"을 끌어내는 억양이 포인트다.',
        },
        {
          id: 's05e14-1-2',
          phrase: 'My eyes! My eyes!',
          meaningKr: '내 눈! 내 눈!!',
          nuanceKr:
            '피비의 전설적인 리액션. 보면 안 될 것을 봤을 때 장난스럽게 외치는 말로, ' +
            '이 장면 이후 밈이 되어 실제로도 널리 쓰인다. 친구의 낯뜨거운 셀카를 ' +
            '봤을 때 던져 보자.',
          exampleEn: 'You two, stop kissing in the kitchen — my eyes! My eyes!',
          exampleKr: '너희 둘, 부엌에서 뽀뽀 좀 그만해 — 내 눈! 내 눈!!',
          level: 1,
          variations: [
            { en: 'My ears! I did not need to hear that.', kr: '내 귀! 그건 안 들었어야 했는데. (들으면 안 될 걸 들었을 때)' },
            { en: "I can't unsee that.", kr: '한번 본 건 지울 수가 없다고. (밈처럼 쓰는 자매 표현)' },
            { en: 'Get a room, you two!', kr: '너희 둘, 방을 잡아! (닭살 커플 놀리기 세트)' },
          ],
          mistakeKr:
            '한국어식으로 "내 눈이 아파"를 "My eyes hurt"로 풀면 진짜 통증 호소가 된다 — ' +
            '이 표현은 "My eyes!"만 반복해 외치는 게 포인트다. 진지한 톤으로 말하면 오해를 ' +
            '사니, 과장된 몸짓과 장난기가 세트라는 것도 기억하자.',
          soundKr:
            '"마이 아이즈!"에서 eyes 끝의 z를 살려 "아이즈"로 끝낸다. 두 번째 외침을 첫 번째보다 ' +
            '더 높고 크게 — 피비처럼 절규하듯 톤을 끌어올려야 코미디가 산다.',
        },
        {
          id: 's05e14-1-3',
          phrase: 'Keep it to yourself.',
          meaningKr: '너만 알고 있어.',
          nuanceKr:
            '비밀 엄수 당부의 표준형. 직역하면 "그걸 네 안에만 간직해". ' +
            '"Can you keep a secret?(비밀 지킬 수 있어?)" 다음에 자연스럽게 이어진다. ' +
            '반대로 소문내는 건 "spill the beans".',
          exampleEn: 'I\'m telling you this, but you have to keep it to yourself.',
          exampleKr: '너한테만 말해 주는 거니까, 너만 알고 있어야 해.',
          level: 2,
          variations: [
            { en: 'Just between us, okay?', kr: '우리끼리만 아는 거다, 알았지? (비밀 공유 직전에)' },
            { en: 'My lips are sealed.', kr: '입 꾹 다물게. (비밀 지키겠다는 대답)' },
            { en: "Don't tell anyone, but...", kr: '아무한테도 말하지 마, 근데… (비밀 털어놓기 오프닝)' },
          ],
          mistakeKr:
            '"너만 알아"를 "Only you know it"으로 직역하면 뜻이 안 통한다. 또 to를 for로 바꿔 ' +
            '"keep it for yourself"라고 하면 "그거 네가 가져(소유해)"라는 전혀 다른 말이 된다 — ' +
            '비밀 엄수는 반드시 to yourself다.',
          soundKr:
            'keep it이 연음되어 "키핏"으로 붙고 to는 약하게 "터" — 전체는 "키핏 터 유어셀프". ' +
            'yourself의 self에 두 번째 강세를 실으면 당부의 무게가 생긴다.',
        },
      ],
      dialogue: [
        {
          speaker: 'Phoebe',
          en: 'Wow, this apartment has a great view of Monica\'s place.',
          kr: '와, 이 아파트에서 모니카네 집이 훤히 보이네.',
        },
        {
          speaker: 'Rachel',
          en: 'Yeah, we used to watch Ugly Naked Guy from her window. Circle of life.',
          kr: '응, 예전엔 모니카네 창문에서 어글리 네이키드 가이를 구경했는데. 인생은 돌고 도네.',
        },
        {
          speaker: 'Phoebe',
          en: 'Wait. Is that... Monica? And CHANDLER? MY EYES! MY EYES!',
          kr: '잠깐. 저거… 모니카야? 그리고 챈들러?! 내 눈! 내 눈!!',
          expressionId: 's05e14-1-2',
        },
        {
          speaker: 'Rachel',
          en: 'Phoebe! Phoebe, calm down! I have to tell you something.',
          kr: '피비! 피비, 진정해! 너한테 말해 줄 게 있어.',
        },
        {
          speaker: 'Rachel',
          en: 'I already know. Joey, you\'ll never guess what Phoebe just saw.',
          kr: '나 이미 알고 있었어. 조이, 피비가 방금 뭘 봤는지 넌 상상도 못 할걸.',
          expressionId: 's05e14-1-1',
        },
        {
          speaker: 'Joey',
          en: 'Oh no. You saw them too? Do you know how long I\'ve kept this in?!',
          kr: '이런. 너희도 봤어? 내가 이걸 얼마나 오래 참아 왔는지 알아?!',
        },
        {
          speaker: 'Rachel',
          en: "Okay, new rule: everybody keep it to yourself. They can't know that we know.",
          kr: '좋아, 새 규칙: 전원 입 다물기. 우리가 아는 걸 걔네가 알면 안 돼.',
          expressionId: 's05e14-1-3',
        },
      ],
      drills: [
        {
          promptKr:
            '방금 믿기 힘든 장면을 목격했습니다. 친구에게 "내가 방금 뭘 봤는지 넌 상상도 못 할걸"이라고 운을 띄워 보세요.',
          targetEn: "You'll never guess what I just saw.",
          keywords: ['never', 'guess', 'saw'],
        },
        {
          promptKr:
            '친구 커플이 눈앞에서 닭살 행각을 벌입니다. 장난스럽게 "방 잡아 — 내 눈! 내 눈!"이라고 외쳐 보세요.',
          targetEn: 'Get a room — my eyes! My eyes!',
          keywords: ['room', 'eyes'],
        },
        {
          promptKr:
            '친구에게 비밀을 털어놓기 직전입니다. "너만 알고 있어야 해"라고 당부해 보세요.',
          targetEn: 'You have to keep it to yourself.',
          keywords: ['keep', 'yourself'],
        },
      ],
    },
    {
      id: 's05e14-2',
      titleKr: '떠보기 심리전',
      location: "Monica's Apartment",
      videoQuery: "Friends they don't know that we know they know scene",
      contextKr:
        '"모르는 척하는 걸 아는지 모르는" 수 싸움이 시작됩니다. 수상함을 짚는 말, ' +
        '"네 속셈 다 안다"는 견제구, 그리고 들켰을 때의 항복 선언까지 — ' +
        '밀당의 표현을 배웁니다.',
      expressions: [
        {
          id: 's05e14-2-1',
          phrase: "Something's going on.",
          meaningKr: '뭔가 있어 / 수상한 낌새가 있어.',
          nuanceKr:
            '"go on"은 "일어나고 있다". 확실한 증거는 없지만 낌새를 챘을 때 쓴다. ' +
            '"What\'s going on?(무슨 일이야?)"은 인사로도 쓰이는 만능 표현이니 세트로. ' +
            '"between A and B"를 붙이면 썸 감지 전용이 된다.',
          exampleEn: "They keep whispering. Something's going on between those two.",
          exampleKr: '계속 귓속말을 하네. 저 둘 사이에 뭔가 있어.',
          level: 1,
          variations: [
            { en: "What's going on here?", kr: '여기 무슨 일이야? (현장을 급습했을 때)' },
            { en: 'Is something going on with you two?', kr: '너희 둘 사이에 무슨 일 있어? (썸 직구 질문)' },
            { en: "Something's up with him today.", kr: '걔 오늘 뭔가 이상해. (be up도 같은 뜻)' },
          ],
          mistakeKr:
            '"뭔가 있다"를 "There is something"으로만 옮기면 낌새의 뉘앙스가 사라진다 — ' +
            '"지금 벌어지고 있다"는 진행형 going on이 핵심이다. "Something is happen"처럼 ' +
            'happen을 원형으로 두는 실수도 잦으니 통째로 "Something\'s going on"으로 외우자.',
          soundKr:
            "Something's의 th는 빠르게 말하면 \"썸띵스\"로 뭉개진다. going on은 이어져 " +
            '"고인온"에 가깝게 흐른다. going에 강세를 주고 끝을 살짝 내리면 확신에 찬 뉘앙스가 된다.',
        },
        {
          id: 's05e14-2-2',
          phrase: "I'm onto you.",
          meaningKr: '네 속셈 다 알아.',
          nuanceKr:
            '"be onto someone"은 상대의 꿍꿍이를 눈치챘다는 뜻. 장난스러운 견제부터 ' +
            '진지한 경고까지 폭넓게 쓴다. "They\'re onto us(들켰다, 눈치챘어)"는 ' +
            '작전 영화 단골 대사.',
          exampleEn: "Extra nice all of a sudden? I'm onto you. What do you want?",
          exampleKr: '갑자기 왜 이렇게 친절해? 네 속셈 다 알아. 원하는 게 뭔데?',
          level: 3,
          variations: [
            { en: "They're onto us. Act natural.", kr: '들켰어. 자연스럽게 행동해. (작전 들통 직전)' },
            { en: 'The police are onto him.', kr: '경찰이 걔 뒤를 쫓고 있어. (수사 뉘앙스)' },
            { en: "I know what you're up to.", kr: '너 무슨 꿍꿍이인지 다 알아. (같은 뜻의 자매 표현)' },
          ],
          mistakeKr:
            '"네 속셈을 안다"를 "I know your mind"처럼 직역하면 콩글리시다 — onto 하나면 끝난다. ' +
            '또 to를 빼고 "I\'m on you"라고 하면 "너 위에 있다"는 이상한 말이 되니 주의. ' +
            '"be onto + 사람" 덩어리로 기억하자.',
          soundKr:
            "I'm onto가 이어져 \"아몬투\"처럼 들린다. 강세는 onto의 on에 — \"암 온-투 유\". " +
            '말끝을 천천히 내리면서 상대를 지그시 보면 견제구의 뉘앙스가 완성된다.',
        },
        {
          id: 's05e14-2-3',
          phrase: 'Busted!',
          meaningKr: '딱 걸렸어!',
          nuanceKr:
            '"bust"는 "덮치다, 체포하다". 현장을 잡았을 때 외치는 한 단어다. ' +
            '"You\'re busted!" 또는 당한 입장에서 "Okay, I\'m busted(그래, 나 걸렸다)"로 ' +
            '항복할 때도 쓴다.',
          exampleEn: 'Eating my dessert from the fridge — busted!',
          exampleKr: '냉장고에서 내 디저트 꺼내 먹다니 — 딱 걸렸어!',
          level: 1,
          variations: [
            { en: 'You are so busted!', kr: '너 완전 딱 걸렸어! (so로 강조)' },
            { en: 'Okay, you got me.', kr: '그래, 나 걸렸다. (들킨 쪽의 항복 선언)' },
            { en: 'I caught him red-handed.', kr: '현행범으로 딱 잡았지. (좀 더 격식 있는 버전)' },
          ],
          mistakeKr:
            '"걸렸다"를 "You are caught"라고 하면 문법은 맞아도 딱딱하다 — 순간의 외침은 ' +
            'Busted! 한 단어가 정답이다. bust에는 "파산하다, 흉상" 같은 다른 뜻도 있어 사전 ' +
            '첫 뜻으로 해석하면 헤매니, 이 용법은 감탄사처럼 통째로 외우자.',
          soundKr:
            '"버스티드"가 아니라 첫음절에 강세를 실은 "버스틷!"에 가깝다. 짧고 강하게 ' +
            '터뜨리는 게 핵심 — 손가락으로 상대를 가리키며 외치면 미드 그 장면이 된다.',
        },
      ],
      dialogue: [
        {
          speaker: 'Phoebe',
          en: "Chandler, you've been acting weird all day. Something's going on.",
          kr: '챈들러, 너 하루 종일 이상하게 굴더라. 뭔가 있어.',
          expressionId: 's05e14-2-1',
        },
        {
          speaker: 'Chandler',
          en: 'What? Nothing is going on. Why would something be going on?',
          kr: '뭐? 아무 일도 없는데. 왜 무슨 일이 있겠어?',
        },
        {
          speaker: 'Phoebe',
          en: "Mm-hmm. I'm onto you, mister.",
          kr: '흐음. 네 속셈 다 알고 있어, 이 양반아.',
          expressionId: 's05e14-2-2',
        },
        {
          speaker: 'Monica',
          en: 'Chandler, she knows. She\'s trying to make you crack.',
          kr: '챈들러, 쟤 알고 있어. 너 무너뜨리려고 저러는 거야.',
        },
        {
          speaker: 'Chandler',
          en: "They don't know that we know they know. We're fine. Play along.",
          kr: '우리가 아는 걸 쟤네가 안다는 걸 쟤넨 몰라. 괜찮아. 장단 맞춰 줘.',
        },
        {
          speaker: 'Phoebe',
          en: 'Oh really? Then why are you holding Monica\'s hand under the table?',
          kr: '아 그래? 그럼 왜 테이블 밑에서 모니카 손을 잡고 있는데?',
        },
        {
          speaker: 'Joey',
          en: 'Busted! Oh, thank God. I could not keep track of who knows what anymore.',
          kr: '딱 걸렸어! 아, 살았다. 누가 뭘 아는지 더는 못 따라가겠더라고.',
          expressionId: 's05e14-2-3',
        },
        {
          speaker: 'Chandler',
          en: 'Fine! We\'re dating! And I love her! ...Well, that slipped out.',
          kr: '그래! 우리 사귄다! 그리고 사랑해! …어, 이건 나도 모르게 나왔네.',
        },
      ],
      drills: [
        {
          promptKr:
            '옆자리 동료 둘이 하루 종일 귓속말을 합니다. 친구에게 "뭔가 있어"라고 낌새를 짚어 보세요.',
          targetEn: "Something's going on.",
          keywords: ['something', 'going'],
        },
        {
          promptKr:
            '갑자기 유난히 친절해진 친구, 분명 바라는 게 있습니다. "네 속셈 다 알아"라고 견제해 보세요.',
          targetEn: "I'm onto you, mister.",
          keywords: ['onto', 'mister'],
        },
        {
          promptKr:
            '몰래 게임하던 동생을 현장에서 잡았습니다. "너 완전 딱 걸렸어!"라고 외쳐 보세요.',
          targetEn: 'You are so busted!',
          keywords: ['so', 'busted'],
        },
      ],
    },
  ],
};

export default episode;
