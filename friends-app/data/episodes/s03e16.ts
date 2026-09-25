import type { Episode } from '../../lib/types';

/**
 * S03E16 The One with the Morning After — "We were on a break!"
 * 시리즈 전체를 관통하는 논쟁의 시작. 다툼과 사과의 회화.
 */
const episode: Episode = {
  id: 's03e16',
  code: 'S03E16',
  season: 3,
  titleEn: 'The One with the Morning After',
  titleKr: '그날 아침 이후',
  synopsisKr:
    '"잠깐 거리를 두자"고 한 날 밤 로스가 저지른 실수를 레이첼이 알게 된다. ' +
    '거실에서 밤새 이어지는 대판 싸움 — 그리고 시트콤 역사상 가장 유명한 변명, ' +
    '"We were on a break!"가 탄생한다.',
  theme: '다툼 · 사과 · 관계 정리',
  scenes: [
    {
      id: 's03e16-1',
      titleKr: '밤새 이어진 싸움',
      location: "Monica's Apartment",
      videoQuery: 'Friends Ross and Rachel we were on a break fight',
      contextKr:
        '숨길 수 없는 진실이 터지고, 두 사람은 거실에서 정면으로 부딪칩니다. ' +
        '(다른 넷은 모니카 방에 갇혀 숨죽이고 엿듣고 있죠.) 따지기, 항의하기, ' +
        '변명 차단하기 — 싸울 때조차 필요한 영어를 배웁니다.',
      expressions: [
        {
          id: 's03e16-1-1',
          phrase: 'We were on a break!',
          meaningKr: '우린 그때 잠깐 쉬는 중이었잖아!',
          nuanceKr:
            '시트콤 역사상 가장 유명한 항변. "be on a break"는 "(관계·일을) 잠시 쉬는 ' +
            '중"이라는 뜻으로, 커피 브레이크부터 연애 휴식기까지 다 쓴다. ' +
            '로스는 파이널 시즌까지 이 말을 놓지 않는다.',
          exampleEn: "I texted my ex once. Once! And technically, we were on a break!",
          exampleKr: '전 애인한테 문자 한 번 보냈어. 딱 한 번! 그리고 엄밀히는, 우리 그때 쉬는 중이었잖아!',
          level: 2,
          variations: [
            { en: "Let's take a break.", kr: '우리 잠깐 쉬자. (공부·일·회의 어디서든)' },
            { en: "I'm on my lunch break.", kr: '나 지금 점심시간이야. (직장인 단골 문장)' },
            { en: "They're on a break right now.", kr: '걔네 지금 잠깐 거리 두는 중이래. (연애 휴식기 소식 전할 때)' },
          ],
          mistakeKr:
            'break를 "부수다"로만 알면 이 문장이 안 들린다 — 여기서는 "휴식, 중단"이라는 ' +
            '명사다. 전치사는 반드시 on: "in a break"는 틀린다. take a break(쉬다)와 ' +
            'be on a break(쉬는 중이다)의 짝도 구분하자 — 로스와 레이첼의 싸움도 결국 ' +
            '이 표현의 해석 차이에서 시작됐다.',
          soundKr:
            'were on a가 이어져 "워로너"처럼 들린다: "위 워로너 브레익!". 로스처럼 항변하려면 ' +
            'break에 최고 강세를 얹고 목청을 살짝 높인다. break 끝의 k는 딱 끊어 준다.',
        },
        {
          id: 's03e16-1-2',
          phrase: 'How could you?',
          meaningKr: '어떻게 그럴 수 있어?',
          nuanceKr:
            '배신감의 표준 표현. 뒤를 생략하면 더 아프게 꽂힌다. ' +
            '"How could you do this to me?(나한테 어떻게 이래?)"로 늘려 쓸 수도 있다. ' +
            '억양이 전부인 문장이니 소리 내어 연습하자.',
          exampleEn: 'You told everyone my secret. How could you?',
          exampleKr: '내 비밀을 다 말해 버렸다며. 어떻게 그럴 수 있어?',
          level: 1,
          variations: [
            { en: 'How could you do this to me?', kr: '나한테 어떻게 이럴 수 있어? (풀 버전)' },
            { en: 'How could you not tell me?', kr: '어떻게 나한테 말을 안 할 수가 있어?' },
            { en: 'How could you say that?', kr: '어떻게 그런 말을 해?' },
          ],
          mistakeKr:
            '현재형 "How can you?"로 쓰면 힐난의 뉘앙스가 약해진다 — 이미 벌어진 일에 대한 ' +
            '배신감은 과거형 could가 만든다. 또 "Why did you do that?"은 이유를 묻는 중립적 ' +
            '질문이지만, How could you?에는 "그러면 안 됐다"는 비난이 깔려 있다.',
          soundKr:
            'could의 l은 묵음, could you는 이어져 "쿠쥬"가 된다: "하우 쿠쥬?". How를 높게 ' +
            '시작해 끝을 떨어뜨리면 실망, 끝을 올리면 따지는 느낌 — 세 단어라 억양이 전부다.',
        },
        {
          id: 's03e16-1-3',
          phrase: "That's no excuse.",
          meaningKr: '그건 변명이 안 돼.',
          nuanceKr:
            '상대의 해명을 잘라 버리는 한마디. "There\'s no excuse for that(그건 ' +
            '변명의 여지가 없다)"도 같은 계열이다. excuse는 명사로 "변명", ' +
            '동사로 "용서하다" — 품사에 따라 발음이 달라진다(명사 s, 동사 z).',
          exampleEn: 'I know you were busy, but that\'s no excuse for not calling.',
          exampleKr: '바빴던 건 알겠는데, 전화 안 한 변명은 안 돼.',
          level: 2,
          variations: [
            { en: "There's no excuse for being that rude.", kr: '그렇게 무례했던 건 변명의 여지가 없어.' },
            { en: 'Stop making excuses.', kr: '변명 좀 그만해. (make excuses 콤보)' },
            { en: "That's no excuse for lying.", kr: '그렇다고 거짓말이 정당화되진 않아. (for로 대상 지정)' },
          ],
          mistakeKr:
            '"That\'s not excuse"라고 하기 쉽다 — 이 관용구는 not이 아니라 no를 쓴다. ' +
            '또 excuse는 명사(변명)일 때 끝소리가 [s], 동사(용서하다)일 때 [z]다. ' +
            '"Excuse me"의 [z] 발음만 기억하고 명사까지 "익스큐즈"로 읽는 실수가 흔하다.',
          soundKr:
            '명사 excuse는 끝을 [s]로 — "익스큐스". no에 강세를 콱 얹어 "댓츠 노- 익스큐스". ' +
            '문장 전체를 낮은 톤으로 뚝 떨어뜨리며 끝내야 단호함이 산다.',
        },
      ],
      dialogue: [
        {
          speaker: 'Rachel',
          en: 'I trusted you. And the second things got hard, you ran to someone else.',
          kr: '난 너를 믿었어. 그런데 상황이 힘들어지자마자 다른 사람한테 달려갔더라.',
        },
        {
          speaker: 'Ross',
          en: 'Whoa, whoa. You said we should take a break. We were on a break!',
          kr: '잠깐, 잠깐. 네가 거리를 두자고 했잖아. 우린 그때 쉬는 중이었다고!',
          expressionId: 's03e16-1-1',
        },
        {
          speaker: 'Rachel',
          en: 'A break is not a breakup, Ross! How could you?',
          kr: '거리를 두는 건 헤어진 게 아니잖아, 로스! 어떻게 그럴 수 있어?',
          expressionId: 's03e16-1-2',
        },
        {
          speaker: 'Ross',
          en: 'I was hurt, okay? I thought I had lost you. I wasn\'t thinking straight.',
          kr: '나도 상처받았단 말이야. 널 잃은 줄 알았어. 제정신이 아니었다고.',
        },
        {
          speaker: 'Rachel',
          en: "That's no excuse. You don't get to hurt me back on a technicality.",
          kr: '그건 변명이 안 돼. 말꼬리 하나 잡고 나한테 상처를 되갚을 권리는 없어.',
          expressionId: 's03e16-1-3',
        },
        {
          speaker: 'Ross',
          en: 'Rachel, please. It meant nothing. YOU mean everything.',
          kr: '레이첼, 제발. 그건 아무 의미 없었어. 나한테 의미 있는 건 너라고.',
        },
        {
          speaker: 'Rachel',
          en: "Then you shouldn't have done it.",
          kr: '그럼 애초에 그러지 말았어야지.',
        },
      ],
      drills: [
        {
          promptKr:
            '"잠깐 거리를 두자"고 한 사이에 있었던 일로 친구가 따집니다. 로스처럼 "엄밀히는, 우리 그때 쉬는 중이었잖아!"라고 항변해 보세요.',
          targetEn: 'Technically, we were on a break!',
          keywords: ['technically', 'break'],
        },
        {
          promptKr:
            '친구가 내 비밀을 다른 사람에게 말해 버렸습니다. "어떻게 그럴 수 있어?"라고 따져 보세요.',
          targetEn: 'How could you?',
          keywords: ['how', 'could'],
        },
        {
          promptKr:
            '지각한 동료가 "차가 막혔어요"라고 해명합니다. "그건 변명이 안 돼요"라고 잘라 보세요.',
          targetEn: "That's no excuse.",
          keywords: ['no', 'excuse'],
        },
      ],
    },
    {
      id: 's03e16-2',
      titleKr: '새벽, 지친 두 사람',
      location: "Monica's Apartment",
      videoQuery: 'Friends Ross and Rachel morning after breakup scene',
      contextKr:
        '소리치던 밤이 지나고, 새벽녘에 지친 두 사람이 마지막 대화를 나눕니다. ' +
        '진심으로 사과하기, 다시 시작하자고 부탁하기, 그리고 시간이 필요하다고 ' +
        '말하기 — 관계의 갈림길에서 꼭 필요한 표현들입니다.',
      expressions: [
        {
          id: 's03e16-2-1',
          phrase: 'I screwed up.',
          meaningKr: '내가 다 망쳤어 / 내 잘못이야.',
          nuanceKr:
            '"screw up"은 "망치다, 크게 실수하다"의 구어체. 자기 잘못을 인정하는 ' +
            '사과의 첫 문장으로 완벽하다. 더 캐주얼하게는 "I messed up"도 쓴다. ' +
            '(공식 석상에서는 "I made a mistake"가 안전.)',
          exampleEn: "I screwed up, and I'm not going to make excuses for it.",
          exampleKr: '내가 다 망쳤어. 변명하지 않을게.',
          level: 2,
          variations: [
            { en: 'I really messed up this time.', kr: '이번엔 내가 진짜 망쳤어. (같은 온도의 대체 표현)' },
            { en: 'Sorry, I screwed up the reservation.', kr: '미안, 내가 예약을 망쳐 버렸어. (목적어를 넣은 버전)' },
            { en: "Don't screw this up.", kr: '이건 망치지 마. (중요한 일을 앞둔 사람에게)' },
          ],
          mistakeKr:
            '수동태로 "I was screwed up"이라고 하면 "나 (정신이) 엉망이었다"는 전혀 다른 ' +
            '말이 된다 — 잘못을 인정할 땐 능동태 "I screwed up"이다. 스펠링에 이끌려 ' +
            '"스크류드"로 또박또박 읽지 말 것. 격식 있는 자리에서는 "I made a mistake"로.',
          soundKr:
            'screwed up은 이어져 "스크루덥"이 된다. 강세는 up에 얹고 끝을 낮추면 자책의 톤: ' +
            '"아이 스크루덥". 사과의 첫 문장답게 천천히, 또렷하게 말하는 게 좋다.',
        },
        {
          id: 's03e16-2-2',
          phrase: 'Can we start over?',
          meaningKr: '우리 처음부터 다시 시작하면 안 될까?',
          nuanceKr:
            '"start over"는 "처음부터 다시 하다". 관계, 대화, 프로젝트 무엇이든 ' +
            '리셋하고 싶을 때 쓴다. "Let\'s start over"라고 하면 어색해진 첫인사를 ' +
            '다시 하자는 귀여운 용법도 가능하다.',
          exampleEn: 'This conversation went all wrong. Can we start over?',
          exampleKr: '대화가 완전히 꼬여 버렸네. 우리 처음부터 다시 하면 안 될까?',
          level: 1,
          variations: [
            { en: "Let's just start over.", kr: '그냥 처음부터 다시 하자.' },
            { en: 'I had to start over from scratch.', kr: '완전 맨바닥부터 다시 해야 했어. (from scratch 콤보)' },
            { en: 'Can we start this conversation over?', kr: '이 대화 처음부터 다시 하면 안 될까? (목적어 삽입형)' },
          ],
          mistakeKr:
            '"다시"에 이끌려 start again만 쓰기 쉬운데, start over는 "처음으로 되돌아가 ' +
            '완전히 다시"라는 리셋의 뉘앙스가 더 강하다. 또 over를 "끝났다(It\'s over)"로만 ' +
            '알면 start over가 모순처럼 보인다 — 여기서 over는 "한 번 더"라는 부사다.',
          soundKr:
            'start over는 t가 부드러워져 "스타로버"처럼 이어진다: "캔 위 스타로버?". ' +
            'over의 첫음절에 강세, 부탁하는 문장이니 끝은 살짝 올려 준다.',
        },
        {
          id: 's03e16-2-3',
          phrase: 'I need some time.',
          meaningKr: '나 시간이 좀 필요해.',
          nuanceKr:
            '바로 결정하거나 용서할 수 없을 때, 거절 대신 쓰는 완충 표현. ' +
            '"I need some time to think(생각할 시간이 필요해)"처럼 to부정사로 ' +
            '이유를 붙일 수 있다. 상대를 밀어내지 않으면서 여지를 남긴다.',
          exampleEn: "I'm not saying no. I just need some time to think about it.",
          exampleKr: '싫다는 게 아니야. 그냥 생각할 시간이 좀 필요해.',
          level: 1,
          variations: [
            { en: 'I need some time to think.', kr: '생각할 시간이 좀 필요해. (이유를 붙인 기본형)' },
            { en: 'Take all the time you need.', kr: '필요한 만큼 천천히 해. (기다려 주는 쪽의 대답)' },
            { en: 'Give me some time, okay?', kr: '나한테 시간을 좀 줘, 응?' },
          ],
          mistakeKr:
            '"I need a time"은 틀린다 — time(시간)은 셀 수 없는 명사라 a가 아니라 some과 ' +
            '어울린다. "시간 있어?"를 "Do you have a time?"이라고 하는 것도 같은 실수다. ' +
            '무작정 "Wait"라고 하면 명령처럼 들리니, 감정 대화에서는 need some time이 부드럽다.',
          soundKr:
            'need some이 이어져 "니썸"처럼 들린다: "아이 니썸 타임". time에 강세를 두고 ' +
            '살짝 길게 끌면 진지함이 전해진다. 끝은 낮고 차분하게 떨어뜨리는 게 이 표현의 정서.',
        },
      ],
      dialogue: [
        {
          speaker: 'Ross',
          en: "It's almost morning. We've been at this all night.",
          kr: '거의 아침이야. 우리 밤새 이러고 있었네.',
        },
        {
          speaker: 'Rachel',
          en: 'I know. I\'m so tired of yelling.',
          kr: '그러게. 소리 지르는 것도 이제 지친다.',
        },
        {
          speaker: 'Ross',
          en: "Rachel, listen. I screwed up. Worse than I've ever screwed up in my life.",
          kr: '레이첼, 들어 봐. 내가 다 망쳤어. 내 인생에서 이렇게까지 망친 적은 없었어.',
          expressionId: 's03e16-2-1',
        },
        {
          speaker: 'Ross',
          en: "But this can't be how we end. Can we start over? Please?",
          kr: '그래도 우리가 이렇게 끝날 순 없잖아. 처음부터 다시 시작하면 안 될까? 제발?',
          expressionId: 's03e16-2-2',
        },
        {
          speaker: 'Rachel',
          en: "I can't even look at you right now without seeing it.",
          kr: '지금은 널 보기만 해도 그 일이 떠올라.',
        },
        {
          speaker: 'Rachel',
          en: "I'm not saying never. I'm saying... I need some time.",
          kr: '영영 끝이라는 게 아니야. 그냥… 시간이 좀 필요하다는 거야.',
          expressionId: 's03e16-2-3',
        },
        {
          speaker: 'Ross',
          en: 'Okay. Then I\'ll wait. However long it takes.',
          kr: '알았어. 그럼 기다릴게. 얼마가 걸리든.',
        },
      ],
      drills: [
        {
          promptKr:
            '내 실수로 프로젝트가 꼬였습니다. 변명 없이 "내가 다 망쳤어"라고 인정해 보세요.',
          targetEn: 'I screwed up.',
          keywords: ['screwed', 'up'],
        },
        {
          promptKr:
            '친구와의 대화가 싸움으로 번져 버렸습니다. "우리 처음부터 다시 시작하면 안 될까?"라고 부탁해 보세요.',
          targetEn: 'Can we start over?',
          keywords: ['start', 'over'],
        },
        {
          promptKr:
            '큰 결정을 지금 당장 내리라고 재촉받고 있습니다. "그냥 생각할 시간이 좀 필요해요"라고 말해 보세요.',
          targetEn: 'I just need some time to think.',
          keywords: ['need', 'time', 'think'],
        },
      ],
    },
  ],
};

export default episode;
