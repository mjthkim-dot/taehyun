import type { Episode } from '../../lib/types';

/**
 * S01E07 The One with the Blackout — 뉴욕 대정전.
 * 촛불 앞 수다와 ATM 부스에 갇힌 챈들러. "스몰토크"와 "어색함 깨기"라는
 * 실전 회화의 양대 관문을 한 회차에서 배운다.
 */
const episode: Episode = {
  id: 's01e07',
  code: 'S01E07',
  season: 1,
  titleEn: 'The One with the Blackout',
  titleKr: '뉴욕이 정전된 밤',
  synopsisKr:
    '뉴욕 전체가 정전된 밤. 다섯 친구는 모니카네 촛불 앞에 모여 수다를 떨고, ' +
    '하필 은행에 있던 챈들러는 빅토리아 시크릿 모델과 단둘이 ATM 부스에 갇힌다. ' +
    '말 걸고 싶은데 입이 안 떨어지는 그 기분, 챈들러가 대신 겪어 준다.',
  theme: '스몰토크 · 어색함 깨기',
  scenes: [
    {
      id: 's01e07-1',
      titleKr: '촛불 앞 진실 게임',
      location: "Monica's Apartment",
      contextKr:
        '전기가 나가자 할 일이 없어진 친구들이 촛불을 켜 놓고 "가장 특이한 장소에서의 ' +
        '경험" 같은 질문을 주고받습니다. 정적을 깨는 질문 던지기, 리액션하기 — ' +
        '모임에서 대화를 살리는 스몰토크 표현을 배웁니다.',
      expressions: [
        {
          id: 's01e07-1-1',
          phrase: 'Would you rather A or B?',
          meaningKr: 'A랑 B 중에 뭘 고를래?',
          nuanceKr:
            '"Would you rather"는 둘 중 하나를 고르게 하는 스몰토크 만능 질문 틀. ' +
            '어색한 자리에서 대화를 굴리는 데 이만한 게 없다. ' +
            '"Would you rather live in the city or the country?"처럼 쓴다.',
          exampleEn: 'Would you rather have no internet or no coffee for a year?',
          exampleKr: '1년 동안 인터넷 없이 살래, 커피 없이 살래?',
          level: 2,
        },
        {
          id: 's01e07-1-2',
          phrase: "That's so sweet.",
          meaningKr: '정말 다정하다 / 감동이야.',
          nuanceKr:
            '누가 사려 깊은 행동이나 말을 했을 때의 표준 리액션. sweet는 음식이 아니라 ' +
            '사람에게 쓰면 "다정하다, 착하다"는 뜻이 된다. 살짝 놀리듯 쓸 수도 있다.',
          exampleEn: 'You saved me the last slice? That\'s so sweet.',
          exampleKr: '마지막 조각을 나 주려고 남겨 뒀다고? 정말 다정하다.',
          level: 1,
        },
        {
          id: 's01e07-1-3',
          phrase: "It's not a big deal.",
          meaningKr: '별거 아니야.',
          nuanceKr:
            '"big deal"은 "대단한 일". 부정문으로 쓰면 겸손이나 대수롭지 않음을 표현한다. ' +
            '반대로 "It IS a big deal!"이라고 하면 "이건 큰일이라니까!"라는 강조가 된다.',
          exampleEn: 'I just helped a little — it\'s not a big deal.',
          exampleKr: '그냥 조금 도왔을 뿐이야 — 별거 아니야.',
          level: 1,
        },
      ],
      dialogue: [
        {
          speaker: 'Phoebe',
          en: 'Ooh, the whole city is dark. This is kind of romantic.',
          kr: '와, 도시 전체가 깜깜해. 이거 좀 낭만적인데.',
        },
        {
          speaker: 'Joey',
          en: "Okay, I've got a game. Would you rather be stuck in an elevator or on a subway?",
          kr: '좋아, 게임 하나 하자. 엘리베이터에 갇힐래, 지하철에 갇힐래?',
          expressionId: 's01e07-1-1',
        },
        {
          speaker: 'Monica',
          en: 'Elevator. At least it\'s not moving.',
          kr: '엘리베이터. 최소한 움직이진 않잖아.',
        },
        {
          speaker: 'Ross',
          en: 'I brought candles from my place so nobody trips in the dark.',
          kr: '어두워서 넘어질까 봐 우리 집에서 초 가져왔어.',
        },
        {
          speaker: 'Rachel',
          en: "Aww, that's so sweet.",
          kr: '어머, 정말 다정하다.',
          expressionId: 's01e07-1-2',
        },
        {
          speaker: 'Ross',
          en: "Oh, it's not a big deal. I just... had a lot of candles.",
          kr: '아, 별거 아니야. 그냥… 초가 많이 있었을 뿐이야.',
          expressionId: 's01e07-1-3',
        },
        {
          speaker: 'Phoebe',
          en: 'Okay, my turn! Would you rather sing in front of everyone or dance?',
          kr: '좋아, 내 차례! 모두 앞에서 노래할래, 춤출래?',
          expressionId: 's01e07-1-1',
        },
        {
          speaker: 'Joey',
          en: 'Both. Obviously.',
          kr: '둘 다. 당연하지.',
        },
      ],
    },
    {
      id: 's01e07-2',
      titleKr: 'ATM 부스에 갇힌 챈들러',
      location: 'ATM Vestibule',
      contextKr:
        '정전으로 ATM 부스에 갇힌 챈들러. 옆에는 모델 질 굿에이커가 있는데, ' +
        '머릿속에서만 말이 맴돌고 입 밖으로는 이상한 소리만 나옵니다. ' +
        '처음 보는 사람에게 자연스럽게 말 걸기, 긴장했다고 솔직하게 말하기 — ' +
        '어색함을 깨는 표현을 배웁니다.',
      expressions: [
        {
          id: 's01e07-2-1',
          phrase: 'Have we met before?',
          meaningKr: '우리 어디서 본 적 있지 않나요?',
          nuanceKr:
            '처음 보는 사람에게 말을 트는 클래식한 오프너. 정말 궁금해서 묻기도 하고, ' +
            '말 걸 핑계로 쓰기도 한다. "I don\'t think we\'ve met(초면인 것 같네요)"은 ' +
            '반대로 먼저 자기소개를 시작할 때 쓴다.',
          exampleEn: 'Sorry, have we met before? You look really familiar.',
          exampleKr: '저기, 우리 어디서 본 적 있지 않나요? 정말 낯이 익어서요.',
          level: 1,
        },
        {
          id: 's01e07-2-2',
          phrase: "I'm kind of freaking out.",
          meaningKr: '나 지금 살짝 멘붕이야.',
          nuanceKr:
            '"freak out"은 당황·패닉·흥분으로 이성을 잃는 것. "kind of"를 붙이면 ' +
            '"살짝, 좀"으로 강도가 부드러워진다. "Don\'t freak out(진정해, 놀라지 마)"도 ' +
            '드라마 전체에서 수없이 나오는 세트 표현.',
          exampleEn: 'The interview is in ten minutes and I\'m kind of freaking out.',
          exampleKr: '면접이 10분 뒤인데 나 지금 살짝 멘붕이야.',
          level: 2,
        },
        {
          id: 's01e07-2-3',
          phrase: 'Play it cool.',
          meaningKr: '침착한 척해 / 태연하게 굴어.',
          nuanceKr:
            '속으로는 떨려도 겉으로는 아무렇지 않은 척하라는 뜻. 스스로에게 주문처럼 ' +
            '외우기도 한다 — "Okay, play it cool, play it cool." 챈들러가 제일 못 하는 것.',
          exampleEn: 'She\'s walking over here — okay, play it cool.',
          exampleKr: '그녀가 이쪽으로 오고 있어 — 좋아, 침착한 척하자.',
          level: 2,
        },
      ],
      dialogue: [
        {
          speaker: 'Chandler',
          en: "Okay, Chandler, she's right there. Play it cool.",
          kr: '좋아 챈들러, 그녀가 바로 저기 있어. 침착한 척하자.',
          expressionId: 's01e07-2-3',
        },
        {
          speaker: 'Guest',
          speakerLabel: '질',
          en: 'Looks like we might be here a while.',
          kr: '우리 여기 한참 있어야 할 것 같네요.',
        },
        {
          speaker: 'Chandler',
          en: 'Yeah! Yes. A while. Which is... time. That we are in.',
          kr: '네! 그렇죠. 한참. 그러니까… 시간이죠. 우리가 그 안에 있는.',
        },
        {
          speaker: 'Guest',
          speakerLabel: '질',
          en: "Ha! You're funny. Have we met before?",
          kr: '하하! 재밌으시네요. 우리 어디서 본 적 있지 않나요?',
          expressionId: 's01e07-2-1',
        },
        {
          speaker: 'Chandler',
          en: "I don't think so. I would definitely remember that.",
          kr: '아닐 거예요. 만났다면 분명히 기억했을 테니까요.',
        },
        {
          speaker: 'Chandler',
          en: "Honestly? I'm kind of freaking out right now. I'm terrible at small talk.",
          kr: '솔직히 말하면요? 저 지금 살짝 멘붕이에요. 스몰토크를 정말 못하거든요.',
          expressionId: 's01e07-2-2',
        },
        {
          speaker: 'Guest',
          speakerLabel: '질',
          en: "Are you kidding? Admitting it — that's the best icebreaker there is.",
          kr: '농담해요? 그걸 인정하는 거야말로 최고의 어색함 깨기인데요.',
        },
        {
          speaker: 'Chandler',
          en: 'Then hi. I\'m Chandler. I make jokes when I\'m nervous.',
          kr: '그럼 안녕하세요. 전 챈들러예요. 긴장하면 농담을 하죠.',
        },
      ],
    },
  ],
};

export default episode;
