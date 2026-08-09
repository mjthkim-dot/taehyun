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
      videoQuery: 'Friends blackout candles Monica apartment weirdest place',
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
          variations: [
            { en: 'Would you rather work from home or at the office?', kr: '재택이 좋아, 사무실 출근이 좋아? (직장인 스몰토크)' },
            { en: 'Would you rather know the future or change the past?', kr: '미래를 알래, 과거를 바꿀래? (분위기 띄우는 상상 질문)' },
            { en: "I'd rather stay in tonight.", kr: '오늘 밤엔 그냥 집에 있을래. (would rather 단독 활용)' },
          ],
          mistakeKr:
            'rather 뒤에는 동사원형이 온다 — "Would you rather to live~"처럼 to를 붙이는 실수가 ' +
            '정말 흔하다. 대답할 때도 "I\'d rather + 동사원형"으로 받는다. rather를 빼고 ' +
            '"Would you A or B?"라고 하면 그냥 주문받는 질문이 되어 게임의 맛이 사라진다.',
          soundKr:
            'Would you는 연음돼 "우쥬"로 소리 난다: "우쥬 래더~". rather의 th는 혀끝을 살짝 물고 ' +
            '"래더"에 가깝게. 선택지 A와 B에 각각 강세를 주고, or 앞에서 살짝 올렸다가 ' +
            '문장 끝은 내려 읽으면 원어민 리듬이 된다.',
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
          variations: [
            { en: "That's so sweet of you.", kr: '정말 다정하시네요. (of you를 붙이면 상대를 콕 집어 칭찬)' },
            { en: "He's such a sweet guy.", kr: '걔 진짜 다정한 애야. (사람 성격을 묘사할 때)' },
            { en: "Aww, that's adorable.", kr: '어머, 너무 사랑스럽다. (같은 계열의 리액션)' },
          ],
          mistakeKr:
            'sweet를 "달콤한"으로만 알고 있으면 이 리액션이 입에서 안 나온다 — 사람이나 행동에 ' +
            '쓰면 "다정하다, 착하다"다. "너무 착하다"를 "You are too kind"로 직역하면 딱딱하게 ' +
            '들리니 이 문장이 정답. 남자에게 써도 전혀 어색하지 않다.',
          soundKr:
            "That's so가 \"댓쏘\"로 붙는다. sweet에 최고 강세를 주고 \"스위-트\"로 길게 끌수록 " +
            '감동이 커진다. 앞에 "아우(Aww)~" 하고 감탄사를 얹으면 미드식 리액션 완성.',
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
          variations: [
            { en: "It's no big deal, really.", kr: '진짜 별거 아니야. (not a 대신 no를 쓰는 더 캐주얼한 버전)' },
            { en: "What's the big deal?", kr: '그게 뭐 그리 대단한 일인데? (호들갑에 대한 반문)' },
            { en: "Don't make a big deal out of it.", kr: '일 크게 만들지 마. (make a big deal 세트)' },
          ],
          mistakeKr:
            'deal을 "거래"로 직역해 "큰 거래가 아니라고?"라며 미궁에 빠지기 쉽다 — 여기서 deal은 ' +
            '"일, 사안"이다. 관사 a를 빼고 "It\'s not big deal"이라고 하는 실수가 정말 많으니 ' +
            '"not a big deal" 통째로 외우자. 반대로 강조할 땐 is에 힘을 줘 "It IS a big deal!".',
          soundKr:
            "It's not a는 \"잇츠나러\"로 뭉개진다 — not의 t가 미국식으로 부드럽게 굴러간다. " +
            'big과 deal 둘 다 강세를 주되 deal을 살짝 길게: "잇츠 나러 빅 디-일". ' +
            '어깨를 으쓱하며 가볍게 던지는 톤이 핵심이다.',
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
      drills: [
        {
          promptKr:
            '모임에서 대화가 끊겼습니다. "1년 동안 인터넷 없이 살래, 커피 없이 살래?"라고 질문을 던져 보세요.',
          targetEn: 'Would you rather live without internet or without coffee for a year?',
          keywords: ['rather', 'internet', 'coffee'],
        },
        {
          promptKr:
            '친구가 당신 몫의 케이크를 남겨 뒀습니다. "정말 다정하다"라고 리액션해 보세요.',
          targetEn: "Aww, that's so sweet of you.",
          keywords: ['so', 'sweet'],
        },
        {
          promptKr:
            '작은 도움을 준 것뿐인데 동료가 계속 고마워합니다. "별거 아니야"라고 말해 보세요.',
          targetEn: "It's not a big deal.",
          keywords: ['not', 'big', 'deal'],
        },
      ],
    },
    {
      id: 's01e07-2',
      titleKr: 'ATM 부스에 갇힌 챈들러',
      location: 'ATM Vestibule',
      videoQuery: 'Friends Chandler Jill Goodacre ATM vestibule blackout',
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
          variations: [
            { en: "I don't think we've met. I'm Chandler.", kr: '초면인 것 같네요. 챈들러라고 해요. (먼저 자기소개를 틀 때)' },
            { en: 'You look so familiar. Where do I know you from?', kr: '정말 낯이 익은데, 우리 어디서 봤죠? (한 발 더 들어가는 버전)' },
            { en: "Have we met? I never forget a face.", kr: '우리 만난 적 있죠? 전 얼굴은 안 잊거든요. (가벼운 농담 톤)' },
          ],
          mistakeKr:
            '"Did we meet before?"처럼 단순 과거로 물으면 어색하다 — "만난 적 있는지"는 경험이라 ' +
            '현재완료 "Have we met"이 자연스럽다. 한국식으로 "Do you know me?"라고 하면 ' +
            '"너 내가 누군지 알아?"라는 시비조로 들릴 수 있으니 절대 금물.',
          soundKr:
            'Have we met이 "해뷔멧"으로 가볍게 흐르고 met에 강세가 실린다. before는 뒤 음절 ' +
            '"포-"에 힘. 의문문이니 끝을 살짝 올려 "해뷔멧 비포-?" — 부드럽게 물어야 ' +
            '작업 멘트가 아니라 정중한 질문으로 들린다.',
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
          variations: [
            { en: "Don't freak out, but I lost your umbrella.", kr: '놀라지 말고 들어, 나 네 우산 잃어버렸어. (나쁜 소식 예고)' },
            { en: 'My mom totally freaked out when she saw my grades.', kr: '엄마가 내 성적 보고 완전 뒤집어지셨어. (제3자 묘사)' },
            { en: "I'm kind of nervous about tomorrow.", kr: '내일이 좀 긴장돼. (kind of로 톤 낮추기 응용)' },
          ],
          mistakeKr:
            'freak을 명사로만 쓰면 "괴짜"라는 전혀 다른 말이 된다 — 동사구 "freak out" 세트로 ' +
            '외워야 한다. 한국어 "멘붕"을 "mental breakdown"으로 직역하면 진짜 정신과 얘기처럼 ' +
            '무겁게 들린다. kind of는 "친절한"이 아니라 "약간"이라는 부사인 것도 헷갈리는 포인트.',
          soundKr:
            'kind of는 "카인더브"를 지나 실제로는 "카이너"까지 뭉개진다. freaking out은 이어져 ' +
            '"프뤼킹아웃". 전체를 빠르게 "암 카이너 프뤼킹아웃" — freaking의 첫음절에 강세를 주면 ' +
            '다급한 마음이 그대로 전달된다.',
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
          variations: [
            { en: 'Just be cool, okay?', kr: '침착하게 굴어, 알았지? (더 짧은 버전)' },
            { en: 'He tried to play it cool, but his hands were shaking.', kr: '걔는 태연한 척했지만 손이 떨리고 있었어.' },
            { en: 'Stay calm and act natural.', kr: '침착하게, 자연스럽게 행동해. (같은 상황의 풀어 쓴 표현)' },
          ],
          mistakeKr:
            'play를 "놀다"로 직역해 "쿨하게 놀아라?"로 읽으면 뜻이 엉킨다 — 여기서 play는 ' +
            '"~인 척 연기하다"다. it을 빼고 "play cool"이라고 하면 어색하니 반드시 세 단어 세트로. ' +
            '"Chill out(진정해)"은 이미 흥분한 사람에게, play it cool은 티 내지 말라는 상황에 쓴다.',
          soundKr:
            'Play it이 연음돼 "플레잇", 미국식으로는 t가 굴러 "플레이릿 쿠-울"처럼 들린다. ' +
            'cool을 낮고 길게 끌면 정말 침착한 느낌이 산다. 챈들러처럼 혼잣말 주문으로 ' +
            '두 번 반복하면("플레이릿쿨, 플레이릿쿨") 리듬까지 완성.',
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
      drills: [
        {
          promptKr:
            '카페에서 낯이 익은 사람을 봤습니다. "우리 어디서 본 적 있지 않나요? 정말 낯이 익어서요"라고 말을 걸어 보세요.',
          targetEn: 'Have we met before? You look really familiar.',
          keywords: ['met', 'before', 'familiar'],
        },
        {
          promptKr:
            '발표가 10분 뒤인데 심장이 마구 뜁니다. 친구에게 "나 지금 살짝 멘붕이야"라고 말해 보세요.',
          targetEn: "I'm kind of freaking out right now.",
          keywords: ['kind', 'freaking', 'out'],
        },
        {
          promptKr:
            '긴장한 친구가 좋아하는 사람에게 다가가려 합니다. "그냥 침착한 척해"라고 조언해 보세요.',
          targetEn: 'Just play it cool.',
          keywords: ['play', 'cool'],
        },
      ],
    },
  ],
};

export default episode;
