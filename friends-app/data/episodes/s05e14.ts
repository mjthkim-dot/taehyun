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
    },
    {
      id: 's05e14-2',
      titleKr: '떠보기 심리전',
      location: "Monica's Apartment",
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
    },
  ],
};

export default episode;
