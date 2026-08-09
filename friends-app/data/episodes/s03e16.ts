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
    },
    {
      id: 's03e16-2',
      titleKr: '새벽, 지친 두 사람',
      location: "Monica's Apartment",
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
    },
  ],
};

export default episode;
