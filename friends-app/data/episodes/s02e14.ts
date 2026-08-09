import type { Episode } from '../../lib/types';

/**
 * S02E14 The One with the Prom Video — "He's her lobster."
 * 추억 회상과 우정·감동 리액션. 마음을 전하는 회화.
 */
const episode: Episode = {
  id: 's02e14',
  code: 'S02E14',
  season: 2,
  titleEn: 'The One with the Prom Video',
  titleKr: '프롬 비디오',
  synopsisKr:
    '옛날 프롬(졸업 파티) 비디오 속에서, 파트너가 안 온 레이첼을 위해 몰래 ' +
    '턱시도를 입고 나서려던 어린 로스의 모습이 드러난다. 피비의 명대사 ' +
    '"봐, 로스는 레이첼의 랍스터라니까!"와 함께 두 사람이 다시 이어지는 회차.',
  theme: '추억 · 우정 · 감동',
  scenes: [
    {
      id: 's02e14-1',
      titleKr: '프롬 비디오 상영회',
      location: "Monica's Apartment",
      contextKr:
        '부모님 집에서 가져온 낡은 비디오를 다 같이 봅니다. 촌스러운 옛 모습에 ' +
        '웃다가, 마지막 장면에서 모두가 숙연해지죠. 옛 추억을 나누고 감동적인 ' +
        '순간에 리액션하는 표현을 배웁니다.',
      expressions: [
        {
          id: 's02e14-1-1',
          phrase: "He's her lobster.",
          meaningKr: '걔는 쟤의 랍스터야 (= 천생연분이야).',
          nuanceKr:
            '피비의 랍스터 이론 — "랍스터는 평생 한 짝하고만 산다"에서 나온 표현. ' +
            '이 회차 이후 "lobster"는 미국 대중문화에서 "운명의 상대"라는 뜻이 됐다. ' +
            '"You\'re my lobster"는 최고의 고백 멘트 중 하나.',
          exampleEn: "Look at those two. Twenty years together — she's totally his lobster.",
          exampleKr: '저 둘 좀 봐. 20년을 함께라니 — 그녀는 완전히 그의 랍스터야.',
          level: 3,
        },
        {
          id: 's02e14-1-2',
          phrase: 'This brings back memories.',
          meaningKr: '옛날 생각 난다.',
          nuanceKr:
            '"bring back"은 기억을 "다시 데려온다"는 그림. 옛 사진, 노래, 장소 앞에서 ' +
            '자동으로 나오는 표현이다. "This song brings back so many memories."처럼 ' +
            '주어만 바꿔 쓰면 된다.',
          exampleEn: 'Wow, our old school photos — this brings back memories.',
          exampleKr: '와, 우리 옛날 학교 사진이잖아 — 옛날 생각 난다.',
          level: 1,
        },
        {
          id: 's02e14-1-3',
          phrase: "I can't believe it.",
          meaningKr: '믿기지가 않아.',
          nuanceKr:
            '놀람의 기본기. 좋은 일에도 나쁜 일에도 쓴다. 뒤에 절을 붙여 ' +
            '"I can\'t believe you did that!(네가 그랬다니 믿기지 않아)"처럼 확장하면 ' +
            '활용도가 무한해진다.',
          exampleEn: "You kept this photo for twenty years? I can't believe it.",
          exampleKr: '이 사진을 20년이나 간직했다고? 믿기지가 않아.',
          level: 1,
        },
      ],
      dialogue: [
        {
          speaker: 'Monica',
          en: 'Okay everyone, I found our old prom video at mom and dad\'s house.',
          kr: '얘들아, 엄마 아빠 집에서 우리 옛날 프롬 비디오 찾았어.',
        },
        {
          speaker: 'Rachel',
          en: 'Oh my God, look at my hair! This brings back memories.',
          kr: '세상에, 내 머리 좀 봐! 옛날 생각 난다.',
          expressionId: 's02e14-1-2',
        },
        {
          speaker: 'Joey',
          en: 'Wait — is that Ross with the mustache?',
          kr: '잠깐 — 콧수염 있는 저 사람 로스야?',
        },
        {
          speaker: 'Chandler',
          en: "I can't believe it. This video is a gift that keeps on giving.",
          kr: '믿기지가 않아. 이 비디오는 끝없이 주는 선물이네.',
          expressionId: 's02e14-1-3',
        },
        {
          speaker: 'Monica',
          en: 'Shh, watch this part. Rachel\'s date didn\'t show up... and look at Ross.',
          kr: '쉿, 이 부분 봐. 레이첼 파트너가 안 왔을 때… 로스를 봐.',
        },
        {
          speaker: 'Rachel',
          en: 'He put on a tux... to take me? I never knew that.',
          kr: '나를 데려가려고… 턱시도를 입었다고? 전혀 몰랐어.',
        },
        {
          speaker: 'Phoebe',
          en: "See?! He's her lobster! I told you!",
          kr: '봤지?! 걔는 쟤의 랍스터라니까! 내가 말했잖아!',
          expressionId: 's02e14-1-1',
        },
      ],
    },
    {
      id: 's02e14-2',
      titleKr: '조이의 우정 팔찌',
      location: "Joey & Chandler's Apartment",
      contextKr:
        '첫 큰 출연료를 받은 조이가 챈들러에게 번쩍이는 금팔찌를 선물합니다. ' +
        '챈들러 취향은 아니지만… 마음이 중요한 거니까요. 신세 진 것 갚기, ' +
        '선물에 반응하기, 고맙다는 말 받아치기를 배웁니다.',
      expressions: [
        {
          id: 's02e14-2-1',
          phrase: 'I owe you one.',
          meaningKr: '신세 한 번 졌네 / 내가 하나 빚졌어.',
          nuanceKr:
            '"owe"는 빚지다. 도움을 받았을 때 "다음에 갚을게"라는 뉘앙스로 가볍게 던진다. ' +
            '"I owe you big time(크게 신세 졌어)"으로 강조할 수도 있다.',
          exampleEn: 'Thanks for covering my shift — I owe you one.',
          exampleKr: '근무 대신해 줘서 고마워 — 신세 한 번 졌네.',
          level: 1,
        },
        {
          id: 's02e14-2-2',
          phrase: "It's the thought that counts.",
          meaningKr: '중요한 건 마음이지.',
          nuanceKr:
            '선물이 취향에 안 맞아도, 결과가 아쉬워도 "정성이 중요하다"고 말할 때의 ' +
            '관용구. count는 여기서 "중요하다, 값어치가 있다"는 뜻이다.',
          exampleEn: 'He burned the cake, but hey — it\'s the thought that counts.',
          exampleKr: '케이크를 태우긴 했지만, 뭐 — 중요한 건 마음이지.',
          level: 2,
        },
        {
          id: 's02e14-2-3',
          phrase: "Don't mention it.",
          meaningKr: '별말씀을 / 그런 말 마.',
          nuanceKr:
            '"고마워"에 대한 세련된 대답. 직역하면 "그 얘긴 꺼내지도 마"인데, ' +
            '"고마워할 것도 없다"는 겸손의 표현이다. "No problem", "Anytime"과 같은 계열.',
          exampleEn: '"Thanks for the ride!" — "Don\'t mention it."',
          exampleKr: '"태워다 줘서 고마워!" — "별말씀을."',
          level: 1,
        },
      ],
      dialogue: [
        {
          speaker: 'Joey',
          en: 'Chandler! I got my first big paycheck, and I got you something.',
          kr: '챈들러! 첫 거액 출연료 받았는데, 너 줄 거 샀어.',
        },
        {
          speaker: 'Chandler',
          en: 'Wow. That is... a very shiny bracelet.',
          kr: '와. 이건… 정말 번쩍이는 팔찌구나.',
        },
        {
          speaker: 'Joey',
          en: "You've paid my rent for years, man. I owe you one. I owe you like fifty.",
          kr: '네가 몇 년이나 내 월세를 내줬잖아. 신세 한 번 졌지. 아니, 오십 번은 졌지.',
          expressionId: 's02e14-2-1',
        },
        {
          speaker: 'Chandler',
          en: "Joey, you didn't have to do that.",
          kr: '조이, 이럴 필요까진 없었는데.',
        },
        {
          speaker: 'Joey',
          en: 'I know it\'s a lot. But we\'re best friends, you know?',
          kr: '과한 거 알아. 그래도 우린 절친이잖아, 안 그래?',
        },
        {
          speaker: 'Chandler',
          en: "Well... it's the thought that counts. And this is a very loud thought.",
          kr: '뭐… 중요한 건 마음이지. 그리고 이건 아주 요란한 마음이네.',
          expressionId: 's02e14-2-2',
        },
        {
          speaker: 'Joey',
          en: 'So you like it? Really?',
          kr: '그럼 마음에 든다는 거지? 진짜로?',
        },
        {
          speaker: 'Chandler',
          en: "I love it, buddy. — 'Thanks, Chandler.' — Don't mention it.",
          kr: '완전 마음에 들어, 친구. — "고마워, 챈들러." — 별말씀을.',
          expressionId: 's02e14-2-3',
        },
      ],
    },
  ],
};

export default episode;
