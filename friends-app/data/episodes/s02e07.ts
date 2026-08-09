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
    },
    {
      id: 's02e07-2',
      titleKr: '마감 후 커피하우스, 솔직해지는 순간',
      location: 'Central Perk (closed)',
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
    },
  ],
};

export default episode;
