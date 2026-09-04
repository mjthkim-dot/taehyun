import type { Episode } from '../../lib/types';

/**
 * S02E07 The One Where Ross Finds Out — 취중 전화와 "closure".
 * 감정을 정리하는 말, 관계를 확인하는 말. 연애 회화의 핵심 회차.
 */
const episode: Episode = {
  id: 's02e07',
  code: 'S02E07',
  season: 2,
  titleEn: 'The One Where Ross Finds Out',
  titleKr: '로스가 알게 된 밤',
  synopsisKr:
    '술에 취한 레이첼이 로스의 자동응답기에 "나 너 정리했어(I am over you)"라는 ' +
    '메시지를 남긴다. 다음 날 그 메시지를 들은 로스 — "네가 날 정리했다고? ' +
    '언제는 나에게 마음이 있었다는 거야?" 시리즈 최고의 명장면 중 하나.',
  theme: '감정 표현 · 관계 대화',
  scenes: [
    {
      id: 's02e07-1',
      titleKr: '취중 전화, "나 마음 정리했어"',
      location: 'Restaurant / Phone',
      videoQuery: 'Friends Rachel drunk phone call I am over you Ross answering machine',
      contextKr:
        '데이트 중 와인을 너무 마신 레이첼이 충동적으로 로스에게 전화를 걸어 ' +
        '"마음 정리했다"고 선언합니다. 감정을 정리했다고 말하기, 실수로 말이 ' +
        '튀어나왔을 때 수습하기 — 연애사에서 피할 수 없는 표현들을 배웁니다.',
      expressions: [
        {
          id: 's02e07-1-1',
          phrase: "I'm over you.",
          meaningKr: '나 너 완전히 정리했어 / 이제 아무렇지 않아.',
          nuanceKr:
            '"be over someone"은 옛 감정에서 완전히 벗어났다는 뜻. ' +
            '"I\'m over it"으로 바꾸면 사람이 아닌 일에도 쓴다 — "그 일은 이제 훌훌 털었어". ' +
            '레이첼의 이 한마디가 시즌 2 전체를 뒤흔든다.',
          exampleEn: 'It took a year, but I\'m finally over him.',
          exampleKr: '1년 걸렸지만, 이제 걔 완전히 정리했어.',
          level: 2,
          variations: [
            { en: "I'm so over this weather.", kr: '이 날씨 정말 지긋지긋하다. (사람 아닌 일·상황에도 확장)' },
            { en: 'Are you really over her?', kr: '너 걔 진짜 다 정리한 거 맞아? (확인 질문)' },
            { en: 'It took me months to get over the breakup.', kr: '이별을 극복하는 데 몇 달 걸렸어. (get over = 극복하는 과정)' },
          ],
          mistakeKr:
            'over를 "위에"로 직역하면 완전히 미궁에 빠진다 — be over는 "다 지나갔다, 벗어났다"는 ' +
            '상태다. 상태(be over)와 과정(get over)의 구분도 중요하다 — "I got over him"은 ' +
            '"극복해 냈다"에 가깝다. "I\'m finished with you"라고 하면 절교 선언처럼 공격적으로 들린다.',
          soundKr:
            "I'm over you는 \"아모버유\"처럼 부드럽게 이어지고 over의 첫음절 \"오\"에 강세가 " +
            '실린다. 레이첼처럼 선언하듯 말하려면 일부러 단어마다 끊어서 "아임. 오버. 유." — ' +
            '끊어 읽기 자체가 메시지가 된다.',
        },
        {
          id: 's02e07-1-2',
          phrase: 'I got closure.',
          meaningKr: '마음의 매듭을 지었어.',
          nuanceKr:
            'closure는 "끝맺음, 마음의 정리"라는 심리 용어인데 일상 회화에서도 그대로 쓴다. ' +
            '레이첼이 취해서 외친 "And that, my friend, is what they call closure"가 유명하다. ' +
            '이별·갈등 후 "이제 됐다"는 느낌을 한 단어로 담는다.',
          exampleEn: 'I finally said everything I wanted to say. I got closure.',
          exampleKr: '하고 싶던 말을 드디어 다 했어. 마음의 매듭을 지은 거지.',
          level: 3,
          variations: [
            { en: 'I need closure before I can move on.', kr: '다음으로 넘어가려면 마음의 매듭이 필요해. (need와 세트)' },
            { en: 'That last conversation gave me closure.', kr: '그 마지막 대화 덕분에 마음이 정리됐어.' },
            { en: 'We never got closure — it just ended.', kr: '우린 제대로 매듭을 못 지었어 — 그냥 끝나 버렸지.' },
          ],
          mistakeKr:
            'closure를 사전 첫 뜻 "폐쇄"로 읽으면 "도로 폐쇄?"가 된다 — 감정 얘기에서는 언제나 ' +
            '"마음의 정리, 끝맺음"이다. 관사 없이 그냥 closure로 쓰는 것도 포인트 — "a closure"는 ' +
            '어색하다. need closure / get closure / give closure처럼 동사와 짝지어 통째로 외우자.',
          soundKr:
            'closure는 2음절 "클로-저" — "클로슈어"처럼 3음절로 늘리지 않는다. 첫음절 "클로"에 ' +
            '강세. got closure는 t가 약해져 "갓클로저"로 붙는다. 레이첼처럼 한 단어씩 ' +
            '힘주어 말하면 취중 선언 느낌까지 재현된다.',
        },
        {
          id: 's02e07-1-3',
          phrase: 'It just slipped out.',
          meaningKr: '나도 모르게 튀어나왔어.',
          nuanceKr:
            '"slip out"은 말이 의도치 않게 빠져나가는 것. 비밀을 말해 버렸거나 ' +
            '하지 말았어야 할 말을 했을 때의 표준 변명이다. ' +
            '"Sorry, it just slipped out!"으로 통째로 외워 두자.',
          exampleEn: "I wasn't going to tell him about the party — it just slipped out.",
          exampleKr: '파티 얘기 안 하려고 했는데 — 나도 모르게 튀어나왔어.',
          level: 2,
          variations: [
            { en: 'Sorry, it slipped out. I know it was a secret.', kr: '미안, 나도 모르게 튀어나왔어. 비밀인 거 아는데. (사과와 세트)' },
            { en: 'The name just slipped out before I could stop it.', kr: '막을 새도 없이 그 이름이 튀어나왔어.' },
            { en: 'It completely slipped my mind.', kr: '까맣게 잊고 있었어. (slip 응용 — 기억이 빠져나갈 때)' },
          ],
          mistakeKr:
            'slip을 "미끄러지다"로만 알면 이 표현이 안 보인다 — 말이 입에서 "미끄러져 나온" ' +
            '그림을 떠올리자. "slipped out(말이 새어나옴)"과 "slipped my mind(깜빡함)"를 ' +
            '혼동하기 쉬운데 방향이 반대다. 이미 벌어진 일이므로 과거형 slipped가 기본.',
          soundKr:
            'slipped의 -ed는 /t/ 소리라 "슬립트", slipped out은 이어져 "슬립타웃". just의 t는 ' +
            '거의 탈락해 "잇 저스 슬립타웃". out에 강세를 얹고 억울한 톤으로 살짝 올리면 ' +
            '변명의 맛이 산다.',
        },
      ],
      dialogue: [
        {
          speaker: 'Rachel',
          en: 'Give me your phone. I have something very important to announce.',
          kr: '핸드폰 줘 봐. 아주 중요한 발표를 할 게 있어.',
        },
        {
          speaker: 'Guest',
          speakerLabel: '마이클',
          en: "Uh... are you sure? You've had a lot of wine.",
          kr: '어… 확실해요? 와인 많이 마셨잖아요.',
        },
        {
          speaker: 'Rachel',
          en: "Hi, Ross? It's Rachel. I am over you.",
          kr: '여보세요, 로스? 나 레이첼이야. 나 너 완전히 정리했어.',
          expressionId: 's02e07-1-1',
        },
        {
          speaker: 'Rachel',
          en: 'And that, my friend, is what they call closure.',
          kr: '그리고 이런 걸 바로, 마음의 매듭이라고 하는 거야.',
          expressionId: 's02e07-1-2',
        },
        {
          speaker: 'Guest',
          speakerLabel: '마이클',
          en: 'Wow. So... who\'s Ross?',
          kr: '와. 그래서… 로스가 누구예요?',
        },
        {
          speaker: 'Rachel',
          en: "Oh no. No, no, no. Why did I say that? It just slipped out!",
          kr: '안 돼. 안 돼, 안 돼. 내가 왜 그런 말을 했지? 나도 모르게 튀어나왔어!',
          expressionId: 's02e07-1-3',
        },
        {
          speaker: 'Rachel',
          en: 'He can never, ever hear that message.',
          kr: '로스가 그 메시지를 절대로, 절대로 들으면 안 돼.',
        },
      ],
      drills: [
        {
          promptKr:
            '친구가 옛 연인의 근황을 조심스레 전합니다. "1년 걸렸지만 이제 걔 완전히 정리했어"라고 말해 보세요.',
          targetEn: "It took a year, but I'm finally over him.",
          keywords: ['year', 'finally', 'over'],
        },
        {
          promptKr:
            '하고 싶던 말을 드디어 다 하고 왔습니다. "드디어 다 말했고, 마음의 매듭을 지었어"라고 말해 보세요.',
          targetEn: 'I finally said everything, and I got closure.',
          keywords: ['finally', 'got', 'closure'],
        },
        {
          promptKr:
            '깜짝 파티 계획을 실수로 말해 버렸습니다. "말 안 하려고 했는데 나도 모르게 튀어나왔어"라고 변명해 보세요.',
          targetEn: "I wasn't going to tell you — it just slipped out.",
          keywords: ['tell', 'slipped', 'out'],
        },
      ],
    },
    {
      id: 's02e07-2',
      titleKr: '마감 후 커피하우스, 솔직해지는 순간',
      location: 'Central Perk (closed)',
      videoQuery: 'Friends Ross Rachel first kiss Central Perk season 2',
      contextKr:
        '메시지를 들어 버린 로스가 화를 내고 나가지만, 마감한 커피하우스로 ' +
        '돌아와 레이첼과 마주 섭니다. 우리 무슨 사이인지 묻기, 복잡한 마음 ' +
        '고백하기, 천천히 가자고 말하기 — 관계를 정의하는 대화를 배웁니다.',
      expressions: [
        {
          id: 's02e07-2-1',
          phrase: 'Where do we stand?',
          meaningKr: '우리 지금 무슨 사이야?',
          nuanceKr:
            '"stand"는 여기서 "위치해 있다". 관계·협상·상황이 지금 어느 지점에 있는지 ' +
            '확인할 때 쓴다. "Where do I stand with you?(네게 난 뭐야?)"처럼 ' +
            '연애에서 특히 자주 등장한다.',
          exampleEn: 'Before I say anything else — where do we stand?',
          exampleKr: '다른 말 하기 전에 — 우리 지금 무슨 사이야?',
          level: 3,
          variations: [
            { en: 'Where do I stand with you?', kr: '너한테 난 어떤 존재야? (더 직접적인 버전)' },
            { en: 'Where do we stand on the contract?', kr: '계약 건은 지금 어디까지 온 거죠? (비즈니스 상황)' },
            { en: 'So where does that leave us?', kr: '그럼 우린 이제 어떻게 되는 거야? (같은 계열의 관계 확인)' },
          ],
          mistakeKr:
            'stand를 "서다"로 직역해 "우리 어디에 서 있냐고?"라는 위치 질문으로 오해하기 쉽다 — ' +
            '관계나 상황의 "현재 지점"을 묻는 관용구다. 같은 뜻으로 "What are we?"도 있지만 ' +
            '자칫 유치하게 들릴 수 있어, 진지한 대화에는 where do we stand가 어울린다.',
          soundKr:
            'Where do we가 빠르게 "웨어드위"로 뭉치고 stand에 강세가 떨어진다. 의문사 의문문이라 ' +
            '끝은 내려 읽는다: "웨어드위 스탠드↘". 진지한 장면이니 오히려 천천히 또박또박 ' +
            '말하는 게 원어민스럽다.',
        },
        {
          id: 's02e07-2-2',
          phrase: "It's kind of complicated.",
          meaningKr: '좀 복잡해.',
          nuanceKr:
            '관계나 상황이 한마디로 설명 안 될 때의 만능 대답. SNS 연애 상태의 ' +
            '"It\'s complicated"가 바로 이것. "kind of"로 톤을 눌러 주면 더 자연스럽다.',
          exampleEn: 'Are we dating? Well... it\'s kind of complicated.',
          exampleKr: '우리가 사귀는 거냐고? 음… 좀 복잡해.',
          level: 1,
          variations: [
            { en: "It's complicated between us right now.", kr: '우리 요즘 좀 복잡한 상태야.' },
            { en: "It's a long, complicated story.", kr: '길고 복잡한 사연이야. (long story와 콤보)' },
            { en: 'Things got complicated at work.', kr: '회사 일이 좀 꼬였어. (상황이 변했다고 말할 때)' },
          ],
          mistakeKr:
            '동사형 그대로 "It\'s complicate"라고 끝내면 틀린다 — 형용사 complicated까지 -ed를 ' +
            '붙여야 한다. difficult는 "어렵다(난이도)", complicated는 "얽혀 있다(구조)"라는 ' +
            '온도 차이도 알아두자 — 관계 설명을 피하고 싶을 때는 complicated가 정확하다.',
          soundKr:
            'kind of는 "카이너"로 뭉개지고, complicated는 맨 앞 "캄"에 강세 — 미국식으로 t가 ' +
            '굴러 "캄플리케이릿"처럼 들린다. 전체는 "잇츠 카이너 캄플리케이릿". 어깨 한 번 ' +
            '으쓱하며 말끝을 흐리면 딱이다.',
        },
        {
          id: 's02e07-2-3',
          phrase: "Let's take it slow.",
          meaningKr: '우리 천천히 가자.',
          nuanceKr:
            '관계를 서두르지 말자는 뜻. 연애뿐 아니라 일에도 쓴다 — ' +
            '"Let\'s take it slow with this project." 부담을 낮추면서도 ' +
            '계속하겠다는 의지는 남기는, 밸런스 좋은 표현.',
          exampleEn: 'I really like you, so let\'s take it slow and do this right.',
          exampleKr: '너를 정말 좋아하니까, 천천히 제대로 해 보자.',
          level: 2,
          variations: [
            { en: "Let's not rush things.", kr: '서두르지 말자. (같은 뜻의 다른 표현)' },
            { en: 'Can we slow down a little?', kr: '우리 조금만 천천히 가면 안 될까? (부탁 버전)' },
            { en: "Let's take things one step at a time.", kr: '한 걸음씩 차근차근 가자. (일에도 잘 쓰는 버전)' },
          ],
          mistakeKr:
            '문법책대로 "take it slowly"로 고쳐 말하기 쉬운데, 관용구는 "take it slow"가 표준이다 — ' +
            '이렇게 형용사 모양 그대로 부사로 쓰는 게 구어에서는 흔하다. it을 빼고 "take slow"라고 ' +
            '하면 어색하니 세 단어 세트로. "slow down"은 이미 빠른 것을 늦추라는 뉘앙스 차이가 있다.',
          soundKr:
            "Let's take it이 \"렛츠테이킷\"으로 이어진다 — take it의 연음 \"테이킷\"이 핵심. " +
            'slow는 낮은 톤으로 길게 "슬로우-" 끌어 주면 말 자체가 천천히 가자는 분위기를 만든다. ' +
            '전체: "렛츠 테이킷 슬로우-".',
        },
      ],
      dialogue: [
        {
          speaker: 'Rachel',
          en: 'You came back.',
          kr: '돌아왔네.',
        },
        {
          speaker: 'Ross',
          en: 'I kept thinking about that message. I need to know — where do we stand?',
          kr: '그 메시지가 계속 생각났어. 알아야겠어 — 우리 지금 무슨 사이야?',
          expressionId: 's02e07-2-1',
        },
        {
          speaker: 'Rachel',
          en: "Honestly? I don't know. It's kind of complicated.",
          kr: '솔직히? 나도 모르겠어. 좀 복잡해.',
          expressionId: 's02e07-2-2',
        },
        {
          speaker: 'Ross',
          en: 'Complicated how? Because from where I stand, it feels pretty simple.',
          kr: '뭐가 복잡한데? 내 입장에서는 꽤 단순하게 느껴지거든.',
        },
        {
          speaker: 'Rachel',
          en: "I've thought about this for so long, and now that it's real, I'm scared.",
          kr: '이 순간을 정말 오래 생각했는데, 막상 현실이 되니까 무서워.',
        },
        {
          speaker: 'Ross',
          en: "Then let's take it slow. No pressure. Just... us.",
          kr: '그럼 천천히 가자. 부담 갖지 말고. 그냥… 우리답게.',
          expressionId: 's02e07-2-3',
        },
        {
          speaker: 'Rachel',
          en: 'Slow sounds good.',
          kr: '천천히, 좋다.',
        },
      ],
      drills: [
        {
          promptKr:
            '썸 타는 상대와 진지한 대화가 필요합니다. "다른 말 하기 전에, 우리 지금 무슨 사이야?"라고 물어 보세요.',
          targetEn: 'Before I say anything else — where do we stand?',
          keywords: ['where', 'stand'],
        },
        {
          promptKr:
            '"너희 둘 사귀는 거야?"라는 질문을 받았습니다. "음… 좀 복잡해"라고 대답해 보세요.',
          targetEn: "Well... it's kind of complicated.",
          keywords: ['kind', 'complicated'],
        },
        {
          promptKr:
            '새로 만나는 사람에게 부담을 주고 싶지 않습니다. "천천히 제대로 해 보자"라고 말해 보세요.',
          targetEn: "Let's take it slow and do this right.",
          keywords: ['take', 'slow', 'right'],
        },
      ],
    },
  ],
};

export default episode;
