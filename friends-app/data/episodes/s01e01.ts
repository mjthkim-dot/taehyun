import type { Episode } from '../../lib/types';

/**
 * S01E01 Pilot — 모든 것이 시작된 회차.
 * 파혼하고 도망쳐 온 레이첼이 모니카네 무리에 합류하고, 스스로 살아가기로
 * 결심한다. "첫 만남 인사 / 위로 / 새 출발 응원"이라는 실생활 단골 상황 3종.
 */
const episode: Episode = {
  id: 's01e01',
  code: 'S01E01',
  season: 1,
  titleEn: 'The One Where Monica Gets a Roommate',
  titleKr: '모니카의 새 룸메이트',
  synopsisKr:
    '결혼식장에서 도망친 레이첼이 웨딩드레스 차림으로 센트럴 퍼크에 뛰어든다. ' +
    '고등학교 동창 모니카의 집에 얹혀살게 된 레이첼은 아빠 카드를 자르고 ' +
    '처음으로 "내 힘으로 살기"를 선언한다.',
  theme: '첫 만남 · 위로 · 새 출발',
  scenes: [
    {
      id: 's01e01-1',
      titleKr: '웨딩드레스 차림의 불청객',
      location: 'Central Perk',
      contextKr:
        '비 오는 날, 웨딩드레스를 입은 레이첼이 커피하우스로 뛰어들어 옵니다. ' +
        '모니카는 놀란 친구들에게 레이첼을 소개하고, 다들 어색함을 누르며 ' +
        '말을 건네죠. 처음 만난 사람에게 인사하고, 힘들어 보이는 사람에게 ' +
        '부담스럽지 않게 다가가는 표현을 배웁니다.',
      expressions: [
        {
          id: 's01e01-1-1',
          phrase: "How you doin'?",
          meaningKr: '(친근하게) 안녕, 잘 지내?',
          nuanceKr:
            '조이의 시그니처 작업 멘트. 원래는 "How are you doing?"의 캐주얼한 축약으로, ' +
            '평범한 안부 인사지만 조이가 눈썹을 올리며 말하면 플러팅이 된다. ' +
            '억양에 따라 인사도, 농담도 되는 만능 표현.',
          exampleEn: "Hey, I'm Joey. How you doin'?",
          exampleKr: '안녕, 난 조이야. 잘 지내?',
          level: 1,
        },
        {
          id: 's01e01-1-2',
          phrase: 'I could really use a friend right now.',
          meaningKr: '지금 친구가 절실히 필요해.',
          nuanceKr:
            '"could use ~"는 "~가 있으면 좋겠다, ~가 필요하다"를 부드럽게 말하는 표현. ' +
            '"I could use a coffee(커피 한잔 하고 싶다)"처럼 일상에서 정말 자주 쓴다. ' +
            'really를 넣으면 절실함이 커진다.',
          exampleEn: 'After a day like this, I could really use a coffee.',
          exampleKr: '이런 하루를 보내고 나니 커피 한잔이 절실해.',
          level: 2,
        },
        {
          id: 's01e01-1-3',
          phrase: "It's a long story.",
          meaningKr: '말하자면 길어.',
          nuanceKr:
            '지금 다 설명하기 힘든 사연이 있을 때 쓰는 클래식한 회피 표현. ' +
            '"무슨 일이야?"라는 질문에 가볍게 넘기고 싶을 때 딱 한마디로 끝낼 수 있다.',
          exampleEn: 'Why am I still awake at 3 a.m.? It\'s a long story.',
          exampleKr: '왜 새벽 3시에 안 자고 있냐고? 말하자면 길어.',
          level: 1,
        },
        {
          id: 's01e01-1-4',
          phrase: "You're better off without him.",
          meaningKr: '걔 없는 게 너한테 더 나아.',
          nuanceKr:
            '"be better off"는 "형편이 더 낫다"는 뜻. 이별한 친구를 위로할 때 ' +
            '단골로 나오는 문장이다. without 뒤만 바꾸면 어떤 상황에도 응용 가능 — ' +
            '"You\'re better off without that job."',
          exampleEn: 'Honestly, you\'re better off without that job.',
          exampleKr: '솔직히 그 직장은 없는 게 너한테 더 나아.',
          level: 2,
        },
      ],
      dialogue: [
        {
          speaker: 'Rachel',
          en: 'Monica? Oh, thank God you\'re here.',
          kr: '모니카? 아, 여기 있어서 정말 다행이야.',
        },
        {
          speaker: 'Monica',
          en: 'Rachel?! What happened? Why are you in a wedding dress?',
          kr: '레이첼?! 무슨 일이야? 왜 웨딩드레스를 입고 있어?',
        },
        {
          speaker: 'Rachel',
          en: "It's a long story. I just... I couldn't do it.",
          kr: '말하자면 길어. 그냥… 도저히 못 하겠더라.',
          expressionId: 's01e01-1-3',
        },
        {
          speaker: 'Rachel',
          en: 'I know we haven\'t talked in years, but I could really use a friend right now.',
          kr: '우리 몇 년 동안 연락 안 한 거 알지만, 지금은 친구가 절실히 필요해.',
          expressionId: 's01e01-1-2',
        },
        {
          speaker: 'Monica',
          en: 'Of course. Come here. Everyone, this is Rachel.',
          kr: '당연하지. 이리 와. 얘들아, 여긴 레이첼이야.',
        },
        {
          speaker: 'Joey',
          en: "Hey. How you doin'?",
          kr: '안녕. 잘 지내?',
          expressionId: 's01e01-1-1',
        },
        {
          speaker: 'Monica',
          en: 'Joey, not now. Rachel, trust me — you\'re better off without him.',
          kr: '조이, 지금은 아니야. 레이첼, 내 말 믿어 — 걔 없는 게 너한테 더 나아.',
          expressionId: 's01e01-1-4',
        },
        {
          speaker: 'Rachel',
          en: 'You know what? I think you might be right.',
          kr: '있잖아, 네 말이 맞는 것 같아.',
        },
      ],
    },
    {
      id: 's01e01-2',
      titleKr: '아빠 카드를 자르다',
      location: "Monica's Apartment",
      contextKr:
        '레이첼이 아빠의 신용카드를 자르며 처음으로 홀로서기를 선언하는 장면. ' +
        '모니카의 명대사 "Welcome to the real world"가 여기서 나옵니다. ' +
        '새 출발을 응원하고, 막막한 상황에서 스스로를 다잡는 표현을 배웁니다.',
      expressions: [
        {
          id: 's01e01-2-1',
          phrase: 'Welcome to the real world.',
          meaningKr: '현실 세계에 온 걸 환영해.',
          nuanceKr:
            '모니카의 명대사 — "Welcome to the real world. It sucks. You\'re gonna love it." ' +
            '보호받던 사람이 처음 현실을 마주할 때, 반은 놀리고 반은 응원하며 건네는 말. ' +
            '신입사원, 갓 독립한 친구에게 딱이다.',
          exampleEn: 'First day paying your own rent? Welcome to the real world.',
          exampleKr: '처음으로 네 월세를 직접 내는 날이라고? 현실 세계에 온 걸 환영해.',
          level: 1,
        },
        {
          id: 's01e01-2-2',
          phrase: "I'm gonna figure it out.",
          meaningKr: '어떻게든 방법을 찾아낼 거야.',
          nuanceKr:
            '"figure out"은 "생각해서 알아내다/해결하다". 아직 답은 없지만 해내겠다는 ' +
            '의지를 보여줄 때 미국인들이 입에 달고 사는 표현. ' +
            '"We\'ll figure it out(어떻게든 되겠지)"도 세트로 알아두자.',
          exampleEn: "I don't know how yet, but I'm gonna figure it out.",
          exampleKr: '아직 방법은 모르겠지만, 어떻게든 찾아낼 거야.',
          level: 1,
        },
        {
          id: 's01e01-2-3',
          phrase: "That's what friends are for.",
          meaningKr: '친구 좋다는 게 뭐야.',
          nuanceKr:
            '도와줘서 고맙다는 말에 대한 최고의 대답. "친구란 원래 이런 걸 위해 ' +
            '있는 거야"라는 뜻으로, 생색내지 않고 따뜻하게 받아치는 표현이다.',
          exampleEn: "Don't thank me — that's what friends are for.",
          exampleKr: '고맙긴 — 친구 좋다는 게 뭐야.',
          level: 1,
        },
      ],
      dialogue: [
        {
          speaker: 'Monica',
          en: 'Okay. You ready to cut up daddy\'s credit cards?',
          kr: '자. 아빠 신용카드 자를 준비 됐어?',
        },
        {
          speaker: 'Rachel',
          en: 'Oh God... okay. If I do this, there\'s no going back.',
          kr: '어떡해… 좋아. 이걸 자르면 이제 돌이킬 수 없어.',
        },
        {
          speaker: 'Monica',
          en: "Welcome to the real world. It sucks — you're gonna love it.",
          kr: '현실 세계에 온 걸 환영해. 끔찍하지만 — 분명 좋아하게 될걸.',
          expressionId: 's01e01-2-1',
        },
        {
          speaker: 'Rachel',
          en: 'I have no job, no plan, and I just cut up my only money.',
          kr: '직업도 없고, 계획도 없고, 방금 유일한 돈줄을 잘라 버렸네.',
        },
        {
          speaker: 'Rachel',
          en: "But you know what? I'm gonna figure it out.",
          kr: '그래도 있잖아, 어떻게든 방법을 찾아낼 거야.',
          expressionId: 's01e01-2-2',
        },
        {
          speaker: 'Monica',
          en: "That's the spirit. And you can stay here as long as you need.",
          kr: '그 마음가짐이야. 그리고 필요한 만큼 여기 있어도 돼.',
        },
        {
          speaker: 'Rachel',
          en: 'Monica... I don\'t know how to thank you.',
          kr: '모니카… 어떻게 고마움을 표현해야 할지 모르겠어.',
        },
        {
          speaker: 'Monica',
          en: "Don't. That's what friends are for.",
          kr: '그러지 마. 친구 좋다는 게 뭐야.',
          expressionId: 's01e01-2-3',
        },
      ],
    },
  ],
};

export default episode;
