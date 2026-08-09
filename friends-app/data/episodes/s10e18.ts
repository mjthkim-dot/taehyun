import type { Episode } from '../../lib/types';

/**
 * S10E18 The Last One — 마지막 회.
 * 10년의 끝, 열쇠를 내려놓는 여섯 친구. 작별과 새 출발의 회화.
 */
const episode: Episode = {
  id: 's10e18',
  code: 'S10E18',
  season: 10,
  titleEn: 'The Last One',
  titleKr: '마지막 이야기',
  synopsisKr:
    '10년을 함께한 보라색 아파트가 텅 비고, 여섯 친구는 각자의 열쇠를 ' +
    '카운터에 내려놓는다. 그리고 마지막 대사 — "커피 한잔할래?" ' +
    '"좋아. 어디서?" 시트콤 역사상 가장 완벽한 마무리.',
  theme: '작별 인사 · 새 출발',
  scenes: [
    {
      id: 's10e18-1',
      titleKr: '텅 빈 아파트, 여섯 개의 열쇠',
      location: "Monica's Apartment (empty)",
      contextKr:
        '이삿짐이 모두 빠진 아파트. 벽만 남은 거실에서 여섯 친구가 마지막으로 ' +
        '모입니다. 한 시대의 끝을 표현하는 말, 그리울 거라는 말, 연락하며 지내자는 ' +
        '약속 — 이별의 자리에서 꼭 필요한 표현을 배웁니다.',
      expressions: [
        {
          id: 's10e18-1-1',
          phrase: "It's the end of an era.",
          meaningKr: '한 시대가 끝난 거야.',
          nuanceKr:
            'era는 "시대". 오래 지속된 무언가(모임, 직장, 가게, 시리즈)가 끝날 때 ' +
            '쓰는 격조 있는 표현이다. 실제로 프렌즈 종영 당시 전 세계 언론이 ' +
            '이 문장을 헤드라인으로 썼다.',
          exampleEn: 'Our favorite café is closing after 20 years. It\'s the end of an era.',
          exampleKr: '우리 단골 카페가 20년 만에 문을 닫는대. 한 시대가 끝난 거지.',
          level: 2,
        },
        {
          id: 's10e18-1-2',
          phrase: "I'm gonna miss you guys so much.",
          meaningKr: '너희들 정말 많이 보고 싶을 거야.',
          nuanceKr:
            '"miss"는 "그리워하다". 헤어지기 전에는 미래형(I\'m gonna miss you), ' +
            '헤어진 후에는 현재형(I miss you)을 쓴다는 게 포인트. ' +
            '"you guys"는 여럿을 부르는 가장 미국적인 호칭이다.',
          exampleEn: 'This was the best team ever. I\'m gonna miss you guys so much.',
          exampleKr: '최고의 팀이었어. 너희들 정말 많이 보고 싶을 거야.',
          level: 1,
        },
        {
          id: 's10e18-1-3',
          phrase: 'Keep in touch.',
          meaningKr: '연락하고 지내자.',
          nuanceKr:
            '"touch(접촉)를 유지하자", 즉 연락을 이어 가자는 작별의 정석. ' +
            '"Let\'s keep in touch", "Stay in touch" 모두 같은 뜻이다. ' +
            '"I\'ll be in touch(연락할게)"는 비즈니스 마무리 멘트로도 쓴다.',
          exampleEn: 'Good luck in Boston — and keep in touch, okay?',
          exampleKr: '보스턴에서 잘 지내 — 그리고 연락하고 지내자, 알았지?',
          level: 1,
        },
      ],
      dialogue: [
        {
          speaker: 'Monica',
          en: 'Wow. It looks so much bigger without all our stuff.',
          kr: '와. 우리 짐이 다 빠지니까 훨씬 넓어 보인다.',
        },
        {
          speaker: 'Ross',
          en: 'Ten years. Do you realize we basically lived our twenties in this room?',
          kr: '10년이야. 우리 20대를 사실상 이 방에서 다 보냈다는 거, 실감 나?',
        },
        {
          speaker: 'Chandler',
          en: "It's officially the end of an era.",
          kr: '공식적으로 한 시대가 끝난 거네.',
          expressionId: 's10e18-1-1',
        },
        {
          speaker: 'Phoebe',
          en: 'The apartment kept us together. Now we have to do it ourselves.',
          kr: '이 아파트가 우릴 묶어 줬는데, 이제 우리 힘으로 해야 하는 거야.',
        },
        {
          speaker: 'Rachel',
          en: "Okay, I promised myself I wouldn't cry... I'm gonna miss you guys so much.",
          kr: '울지 않겠다고 다짐했는데… 너희들 정말 많이 보고 싶을 거야.',
          expressionId: 's10e18-1-2',
        },
        {
          speaker: 'Joey',
          en: 'Hey, we\'re not disappearing. Dinner every week. No excuses.',
          kr: '야, 우리 사라지는 거 아니잖아. 매주 저녁 먹기다. 변명은 없기.',
        },
        {
          speaker: 'Monica',
          en: 'Every week. And everyone — keep in touch. I mean it. I will check.',
          kr: '매주야. 그리고 다들 — 연락하고 지내. 진심이야. 내가 확인할 거야.',
          expressionId: 's10e18-1-3',
        },
        {
          speaker: 'Chandler',
          en: 'She will. She has a spreadsheet.',
          kr: '진짜 확인할 거야. 쟤 엑셀 시트도 있어.',
        },
      ],
    },
    {
      id: 's10e18-2',
      titleKr: '마지막 한 잔의 커피',
      location: "Monica's Apartment → Central Perk",
      contextKr:
        '열쇠를 내려놓고 문을 나서기 직전, 마지막 대화. "작별이 아니라 또 만나자는 ' +
        '인사"라고 서로를 다독이며, 시리즈의 마지막 대사가 나옵니다. ' +
        '새 출발을 응원하고 산뜻하게 헤어지는 표현을 배웁니다.',
      expressions: [
        {
          id: 's10e18-2-1',
          phrase: "It's not goodbye, it's see you later.",
          meaningKr: '작별이 아니라, 나중에 또 보자는 인사야.',
          nuanceKr:
            'goodbye(영영 이별 느낌)와 see you later(곧 또 봐)를 대비시키는 위로의 ' +
            '공식. 영어권에서 이별의 슬픔을 눅이는 관용적 레토릭이다. ' +
            '"This isn\'t goodbye"만 따로 써도 통한다.',
          exampleEn: "Don't be sad. It's not goodbye, it's see you later.",
          exampleKr: '슬퍼하지 마. 작별이 아니라, 나중에 또 보자는 인사잖아.',
          level: 2,
        },
        {
          id: 's10e18-2-2',
          phrase: "It's a fresh start.",
          meaningKr: '새로운 시작이야.',
          nuanceKr:
            '"fresh start"는 과거를 털고 새로 시작하는 출발점. 이사, 이직, 새해, ' +
            '이별 후 — 리셋이 필요한 모든 순간에 쓴다. "We all need a fresh start ' +
            'sometimes(누구나 가끔은 새 출발이 필요해)"처럼 위로로도 쓴다.',
          exampleEn: 'A new city, a new job — it\'s a fresh start for us.',
          exampleKr: '새 도시에 새 직장 — 우리에겐 새로운 시작이야.',
          level: 1,
        },
        {
          id: 's10e18-2-3',
          phrase: 'Should we get some coffee?',
          meaningKr: '우리 커피 한잔할까?',
          nuanceKr:
            '시리즈 236화의 대미를 장식한 마지막 대사 — 레이첼의 이 말에 챈들러가 ' +
            '"Sure. Where?(좋지. 어디서?)"라고 받아친다. 10년 내내 커피하우스에 살던 ' +
            '이들의 완벽한 마무리. "Should we ~?"는 부드러운 제안의 만능 틀이다.',
          exampleEn: 'We have thirty minutes before the train. Should we get some coffee?',
          exampleKr: '기차까지 30분 남았네. 우리 커피 한잔할까?',
          level: 1,
        },
      ],
      dialogue: [
        {
          speaker: 'Ross',
          en: 'So... I guess this is it.',
          kr: '그럼… 이제 정말 끝인가 보다.',
        },
        {
          speaker: 'Phoebe',
          en: "No. It's not goodbye, it's see you later. Very different energy.",
          kr: '아니야. 작별이 아니라 나중에 또 보자는 인사야. 기운이 완전히 다르다고.',
          expressionId: 's10e18-2-1',
        },
        {
          speaker: 'Monica',
          en: 'The movers are done. Time to leave the keys.',
          kr: '이삿짐 다 나갔대. 열쇠 두고 갈 시간이야.',
        },
        {
          speaker: 'Chandler',
          en: 'A house in the suburbs, twins on the way... it\'s a fresh start.',
          kr: '교외의 집에, 곧 태어날 쌍둥이까지… 새로운 시작이지.',
          expressionId: 's10e18-2-2',
        },
        {
          speaker: 'Joey',
          en: 'Six keys. One bowl. Why is this so hard?',
          kr: '열쇠 여섯 개. 그릇 하나. 이게 왜 이렇게 힘들지?',
        },
        {
          speaker: 'Rachel',
          en: 'Okay. Should we get some coffee?',
          kr: '자. 우리 커피 한잔할까?',
          expressionId: 's10e18-2-3',
        },
        {
          speaker: 'Chandler',
          en: 'Sure. Where?',
          kr: '좋지. 어디서?',
        },
      ],
    },
  ],
};

export default episode;
