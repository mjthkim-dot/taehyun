import type { Episode } from '../../lib/types';

/**
 * S05E16 The One with the Cop — "PIVOT!"
 * 이사(가구 옮기기)와 반품 실랑이. 몸으로 배우는 생활 밀착 영어.
 */
const episode: Episode = {
  id: 's05e16',
  code: 'S05E16',
  season: 5,
  titleEn: 'The One with the Cop',
  titleKr: '소파와 경찰 배지',
  synopsisKr:
    '새 소파를 산 로스가 배달비를 아끼려고 조이·레이첼과 직접 계단으로 ' +
    '옮기기로 한다. 그 결과 탄생한 전설의 외침 — "피벗! 피벗!! 피벗!!!" ' +
    '그리고 반으로 접힌 소파와 함께한 눈물의 환불 시도.',
  theme: '이사 · 부탁 · 반품/환불',
  scenes: [
    {
      id: 's05e16-1',
      titleKr: '계단에서, "피벗!!"',
      location: 'Apartment Stairwell',
      contextKr:
        '좁은 계단 모퉁이에 소파가 껴 버렸습니다. 로스는 "피벗(회전)!"만 외치고, ' +
        '챈들러는 "닥쳐(Shut up)!"로 응수하죠. 도움 요청하기, 방향 지시하기, ' +
        '"껴서 안 움직여" 말하기 — 이사 날의 영어를 배웁니다.',
      expressions: [
        {
          id: 's05e16-1-1',
          phrase: 'Pivot!',
          meaningKr: '돌려! (회전!)',
          nuanceKr:
            '로스의 전설적인 외침. pivot은 "축을 중심으로 회전하다"라는 뜻으로, ' +
            '가구 옮길 때 실제로 쓰는 지시어다. 요즘은 스타트업 용어(사업 방향 전환)로도 ' +
            '유명하다. 미국인 앞에서 "Pivot!"을 외치면 웃음이 터질 확률 99%.',
          exampleEn: 'Okay, tilt it left and— pivot! Pivot!',
          exampleKr: '좋아, 왼쪽으로 기울이고— 돌려! 돌리라고!',
          level: 1,
        },
        {
          id: 's05e16-1-2',
          phrase: 'Give me a hand.',
          meaningKr: '좀 도와줘.',
          nuanceKr:
            '"hand(일손)를 달라"는 그림의 부탁 표현. "Can you give me a hand with ' +
            'this?(이것 좀 도와줄래?)"처럼 with로 대상을 붙인다. ' +
            '"Need a hand?(도와줄까?)"는 먼저 손을 내밀 때 쓴다.',
          exampleEn: 'This box is heavier than it looks — give me a hand?',
          exampleKr: '이 상자 보기보다 무겁네 — 좀 도와줄래?',
          level: 1,
        },
        {
          id: 's05e16-1-3',
          phrase: "It's stuck.",
          meaningKr: '꽉 껴서 안 움직여.',
          nuanceKr:
            '"stuck"은 stick(끼우다)의 과거분사로 "낀, 막힌" 상태. 서랍, 지퍼, 차, ' +
            '엘리베이터, 소파 — 안 움직이는 모든 것에 쓴다. 사람에게 쓰면 ' +
            '"I\'m stuck(막혔어/갇혔어)"으로 문제 풀이부터 교통 체증까지 커버한다.',
          exampleEn: 'The drawer won\'t open. I think it\'s stuck.',
          exampleKr: '서랍이 안 열려. 꽉 낀 것 같아.',
          level: 1,
        },
      ],
      dialogue: [
        {
          speaker: 'Ross',
          en: 'Delivery costs money. We have arms, don\'t we? Rachel, give me a hand.',
          kr: '배달은 돈이 들잖아. 우린 팔이 있는데, 안 그래? 레이첼, 좀 도와줘.',
          expressionId: 's05e16-1-2',
        },
        {
          speaker: 'Rachel',
          en: 'Fine, but I\'m telling you, this couch is not going up those stairs.',
          kr: '알았어, 근데 분명히 말하는데 이 소파 저 계단으로는 못 올라가.',
        },
        {
          speaker: 'Ross',
          en: 'Nonsense. It\'s all about angles. Okay — lift... and... pivot!',
          kr: '말도 안 돼. 전부 각도의 문제야. 자 — 들고… 그리고… 돌려!',
          expressionId: 's05e16-1-1',
        },
        {
          speaker: 'Chandler',
          en: 'I\'m pivoting!',
          kr: '돌리고 있잖아!',
        },
        {
          speaker: 'Ross',
          en: 'Pivot! Pi-vot! PI-VOT!!',
          kr: '돌려! 돌-려! 돌리라고!!',
          expressionId: 's05e16-1-1',
        },
        {
          speaker: 'Chandler',
          en: 'SHUT UP! SHUT UP!! It doesn\'t pivot any more than this!',
          kr: '닥쳐! 닥치라고!! 이 이상은 안 돌아간다고!',
        },
        {
          speaker: 'Rachel',
          en: "Guys... stop. It's stuck. It is completely stuck.",
          kr: '얘들아… 그만해. 껴 버렸어. 완전히 꽉 껴서 안 움직여.',
          expressionId: 's05e16-1-3',
        },
        {
          speaker: 'Ross',
          en: 'Okay. New plan. We cut the couch in half... as a design choice.',
          kr: '좋아. 새 계획. 소파를 반으로 자르는 거야… 디자인적 선택으로.',
        },
      ],
    },
    {
      id: 's05e16-2',
      titleKr: '반으로 접힌 소파, 환불 대작전',
      location: 'Furniture Store',
      contextKr:
        '두 동강 난 소파를 들고 가게로 돌아온 로스. 태연하게 환불을 요구합니다. ' +
        '반품 요청하기, 점원의 응대 표현 듣기, 최종 제안 받아들이기(혹은 말기) — ' +
        '쇼핑 실전 영어를 배웁니다.',
      expressions: [
        {
          id: 's05e16-2-1',
          phrase: "I'd like to return this.",
          meaningKr: '이거 반품하고 싶은데요.',
          nuanceKr:
            '반품 카운터에서의 첫 문장. "I\'d like to(정중한 want to)" + return(반품하다). ' +
            '환불은 refund — "Can I get a refund?(환불 되나요?)"와 세트로 외워 두면 ' +
            '해외 쇼핑이 두렵지 않다.',
          exampleEn: "Hi, I'd like to return this jacket. It doesn't fit.",
          exampleKr: '안녕하세요, 이 재킷 반품하고 싶은데요. 사이즈가 안 맞아서요.',
          level: 1,
        },
        {
          id: 's05e16-2-2',
          phrase: 'What seems to be the problem?',
          meaningKr: '무엇이 문제이신가요?',
          nuanceKr:
            '점원·의사·경찰이 쓰는 정중한 응대 표현. "seem(~인 것 같다)"이 들어가 ' +
            '"What\'s the problem?"보다 훨씬 부드럽다. 듣는 입장에서 알아야 하고, ' +
            '내가 응대할 일이 있을 때 쓰면 프로처럼 들린다.',
          exampleEn: 'Good afternoon, sir. What seems to be the problem?',
          exampleKr: '안녕하세요, 고객님. 무엇이 문제이신가요?',
          level: 2,
        },
        {
          id: 's05e16-2-3',
          phrase: 'Take it or leave it.',
          meaningKr: '받든지 말든지 하세요 / 싫으면 말고.',
          nuanceKr:
            '협상 종료 선언 — "이게 마지막 제안이니 받거나 떠나거나 둘 중 하나". ' +
            '단호하지만 무례하진 않은, 흥정의 마침표다. 친구 사이 농담으로도 쓴다: ' +
            '"피자 한 조각 줄게. 싫으면 말고."',
          exampleEn: "Fifty dollars for the bike. That's my final price — take it or leave it.",
          exampleKr: '자전거 50달러예요. 그게 최종 가격이에요 — 싫으면 말고요.',
          level: 2,
        },
      ],
      dialogue: [
        {
          speaker: 'Ross',
          en: "Hello. I'd like to return this couch.",
          kr: '안녕하세요. 이 소파를 반품하고 싶은데요.',
          expressionId: 's05e16-2-1',
        },
        {
          speaker: 'Guest',
          speakerLabel: '점원',
          en: 'Of course, sir. What seems to be the problem?',
          kr: '물론입니다, 고객님. 무엇이 문제이신가요?',
          expressionId: 's05e16-2-2',
        },
        {
          speaker: 'Ross',
          en: 'The problem is that it is now... two couches.',
          kr: '문제는 이게 지금… 소파 두 개가 됐다는 겁니다.',
        },
        {
          speaker: 'Guest',
          speakerLabel: '점원',
          en: 'Sir, this couch has been cut in half.',
          kr: '고객님, 이 소파는 반으로 잘려 있는데요.',
        },
        {
          speaker: 'Ross',
          en: 'Yes. And I would argue that it was designed with a fatal weakness: stairs.',
          kr: '네. 그리고 저는 이 소파에 치명적 설계 결함이 있었다고 주장하는 바입니다: 계단이요.',
        },
        {
          speaker: 'Guest',
          speakerLabel: '점원',
          en: 'Here is what I can do: store credit of four dollars. Take it or leave it.',
          kr: '제가 해 드릴 수 있는 건 이겁니다: 매장 적립금 4달러. 싫으면 마시고요.',
          expressionId: 's05e16-2-3',
        },
        {
          speaker: 'Ross',
          en: '...I\'ll take it.',
          kr: '…받겠습니다.',
        },
      ],
    },
  ],
};

export default episode;
