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
      videoQuery: 'Friends Ross pivot couch stairs scene',
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
          variations: [
            { en: 'Tilt it to the left a little.', kr: '왼쪽으로 조금만 기울여. (가구 옮기기 세트 지시어)' },
            { en: 'Turn it clockwise.', kr: '시계 방향으로 돌려. (회전 방향까지 지시할 때)' },
            { en: 'We had to pivot our business model.', kr: '사업 모델을 전환해야 했어. (스타트업 용어 버전)' },
          ],
          mistakeKr:
            '"돌리다"라고 하면 turn만 떠올리기 쉬운데, 축을 고정한 채 회전시키는 건 pivot이다. ' +
            '한국식으로 "피봇"이라고 읽으면 알아듣기 어렵다 — "피벗"에 가깝다. 비즈니스 문맥의 ' +
            'pivot(방향 전환)과 물리적 회전은 문맥으로 구분하자.',
          soundKr:
            '강세는 첫음절 — "피-벗". v는 아랫입술을 살짝 물고 진동시키는 소리라 b로 내면 안 된다. ' +
            '로스처럼 쓰려면 음절을 뚝뚝 끊어 "피! 벗!"으로 절규하면 된다.',
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
          variations: [
            { en: 'Can you give me a hand with this box?', kr: '이 상자 옮기는 것 좀 도와줄래? (with로 대상 지정)' },
            { en: 'Need a hand?', kr: '도와줄까? (먼저 손 내밀 때)' },
            { en: 'Could you help me out here?', kr: '여기 좀 도와주시겠어요? (조금 더 정중한 버전)' },
          ],
          mistakeKr:
            '"hand를 줘"라는 그림만 보고 "Give me your hand"라고 하면 "손 잡아 줘"라는 로맨스 ' +
            '대사가 된다 — 반드시 관사 a를 넣은 a hand다. 복수로 "give me hands"도 틀린다. ' +
            '박수를 청하는 "Give him a big hand"와도 문맥으로 구분하자.',
          soundKr:
            'Give me는 실제 대화에서 "김미(gimme)"로 줄어든다. a는 거의 안 들리게 — ' +
            '"김미어 핸드" 한 덩어리로 흘리고, hand에 강세를 얹으면 부탁의 포인트가 산다.',
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
          variations: [
            { en: "I'm stuck in traffic.", kr: '차가 막혀서 꼼짝을 못 해. (교통 체증 버전)' },
            { en: 'The zipper is stuck.', kr: '지퍼가 껴서 안 움직여.' },
            { en: "I'm stuck on question five.", kr: '5번 문제에서 막혔어. (문제 풀이 버전)' },
          ],
          mistakeKr:
            '"안 움직여"를 "It doesn\'t move"라고 하면 성질 설명처럼 들린다 — 꽉 낀 상태는 ' +
            'stuck 한 단어다. stuck을 동사처럼 활용해 "It stucks"라고 하는 실수도 흔한데, ' +
            'stuck은 형용사처럼 반드시 be동사와 함께 쓴다.',
          soundKr:
            "It's stuck은 s가 겹쳐 \"잇스턱\" 한 번에 발음한다. stuck의 모음은 입을 크게 " +
            '벌리지 않는 어두운 "어" — "스탁"이 아니라 "스턱". 끝의 k를 딱 끊어 주면 낀 느낌이 산다.',
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
      drills: [
        {
          promptKr:
            '무거운 상자를 혼자 들 수가 없습니다. 옆 사람에게 "이것 좀 도와줄래?"라고 부탁해 보세요.',
          targetEn: 'Can you give me a hand with this?',
          keywords: ['give', 'hand'],
        },
        {
          promptKr:
            '서랍이 꽉 껴서 안 열립니다. "낀 것 같아"라고 상황을 말해 보세요.',
          targetEn: "I think it's stuck.",
          keywords: ['think', 'stuck'],
        },
        {
          promptKr:
            '가구를 계단 모퉁이에서 돌려야 합니다. 로스처럼 "들어 올리고… 돌려!"라고 외쳐 보세요.',
          targetEn: 'Lift it up and pivot!',
          keywords: ['lift', 'pivot'],
        },
      ],
    },
    {
      id: 's05e16-2',
      titleKr: '반으로 접힌 소파, 환불 대작전',
      location: 'Furniture Store',
      videoQuery: 'Friends Ross returns couch cut in half store credit',
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
          variations: [
            { en: 'Can I get a refund on this?', kr: '이거 환불 되나요? (환불로 직행할 때)' },
            { en: "I'd like to exchange this for a bigger size.", kr: '이거 큰 사이즈로 교환하고 싶은데요. (교환 버전)' },
            { en: 'Do you have the receipt with you?', kr: '영수증 갖고 계신가요? (점원이 되물을 말도 알아 두기)' },
          ],
          mistakeKr:
            '"반품"을 "give back"으로 풀어 "I want to give this back"이라고 하면 매장에서는 ' +
            '어색하다 — 상점 반품은 return 한 단어다. 또 "I want to ~"는 너무 직설적이라 ' +
            '"I\'d like to ~"가 예의 바르고, return(반품)과 refund(환불)를 섞어 쓰지 않도록 주의.',
          soundKr:
            "I'd like to는 \"아이드 라익터\"로 흘리고 return의 2음절에 강세 — \"리터-언\". " +
            'this는 짧게 떨어뜨리고, 문장 끝을 살짝 올리면 한결 공손하게 들린다.',
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
          variations: [
            { en: 'What seems to be the trouble?', kr: '어디가 불편하신가요? (병원에서 의사가)' },
            { en: 'Is everything okay here?', kr: '무슨 일 있으신가요? (더 캐주얼한 응대)' },
            { en: 'How can I help you today?', kr: '무엇을 도와드릴까요? (매장 응대의 기본형)' },
          ],
          mistakeKr:
            '"What is your problem?"이라고 하면 "너 뭐가 문제야?"라는 시비가 된다 — 응대와 ' +
            '시비의 차이는 seems to be가 만든다. 어순도 함정: What이 주어라서 바로 동사가 오고, ' +
            '"What does seem to be..."처럼 do를 끼워 넣으면 틀린다.',
          soundKr:
            'seems to be가 "심스터비"로 부드럽게 이어진다. problem은 첫음절 강세 — "프라-블럼". ' +
            '전체를 낮고 느긋한 톤으로 깔아야 프로다운 응대처럼 들린다.',
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
          variations: [
            { en: "That's my final offer.", kr: '이게 제 마지막 제안입니다. (협상 마무리 세트 표현)' },
            { en: "It's now or never.", kr: '지금 아니면 기회 없어. (비슷한 최후통첩 리듬)' },
            { en: "Fine, I'll take it.", kr: '좋아요, 받을게요. (제안을 수락하는 대답)' },
          ],
          mistakeKr:
            '"싫으면 말고"의 가벼움만 보고 아무 데나 쓰면 무례해진다 — 본질은 "협상 끝"이라는 ' +
            '최후통첩이다. 어순을 바꿔 "Leave it or take it"이라고 하면 관용구가 깨지고, ' +
            'it을 다른 명사로 바꾸지 않고 그대로 쓰는 게 원칙이다.',
          soundKr:
            'Take it과 leave it이 각각 연음되어 "테이킷 오어 리-빗". or는 약하게 "어"로 죽인다. ' +
            'take와 leave에 똑같이 강세를 주고 문장 끝을 뚝 떨어뜨리면 "더는 협상 없음"이 전달된다.',
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
      drills: [
        {
          promptKr:
            '산 재킷이 몸에 안 맞습니다. 카운터에서 "이 재킷 반품하고 싶은데요"라고 말해 보세요.',
          targetEn: "I'd like to return this jacket.",
          keywords: ['return', 'jacket'],
        },
        {
          promptKr:
            '이번엔 점원 역할입니다. 반품하러 온 손님에게 "무엇이 문제이신가요?"라고 정중히 물어보세요.',
          targetEn: 'What seems to be the problem?',
          keywords: ['seems', 'problem'],
        },
        {
          promptKr:
            '중고 자전거를 파는 중인데 더는 안 깎아 주기로 했습니다. "마지막 제안이에요 — 싫으면 말고요"라고 말해 보세요.',
          targetEn: 'That is my last offer — take it or leave it.',
          keywords: ['offer', 'take', 'leave'],
        },
      ],
    },
  ],
};

export default episode;
