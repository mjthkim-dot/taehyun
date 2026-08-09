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
      videoQuery: 'Friends The Last One leaving keys empty apartment scene',
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
          variations: [
            { en: 'It feels like the end of an era.', kr: '한 시대가 끝나는 기분이야. (feels like로 부드럽게)' },
            { en: 'An era has come to an end.', kr: '한 시대가 막을 내렸다. (뉴스 헤드라인 톤)' },
            { en: 'This is the start of a new chapter.', kr: '새로운 챕터의 시작이지. (반대편 짝꿍 표현)' },
          ],
          mistakeKr:
            '관사 함정이 두 개다 — era 앞은 an이라 "the end of an era"가 맞고, "a end"나 ' +
            '"the era"로 쓰면 어색해진다. era를 "에라"로 읽어 원어민 발음 [이어러]를 못 알아듣는 ' +
            '경우도 많다. "시대"라고 age나 period를 넣으면 관용구 맛이 사라진다.',
          soundKr:
            'era는 "에라"가 아니라 첫음절에 강세를 둔 "이어라"에 가깝다. end of an이 이어져 ' +
            '"엔더번"처럼 들린다: "잇츠 디 엔더번 이어라". 차분히 낮은 톤으로 말해야 여운이 산다.',
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
          variations: [
            { en: 'I already miss you.', kr: '벌써 보고 싶다. (헤어진 직후에)' },
            { en: "I'm gonna miss this place.", kr: '이곳이 정말 그리울 거야. (장소 버전)' },
            { en: 'We miss having you around.', kr: '네가 있던 때가 그리워. (miss + 동명사 응용)' },
          ],
          mistakeKr:
            '"보고 싶다"를 "I want to see you"라고 하면 "만나자"는 요청이 된다 — 그리움은 ' +
            'miss다. 시제 구분이 핵심: 헤어지기 전에는 미래형(I\'m gonna miss you), 헤어진 ' +
            '뒤에는 현재형(I miss you)이다. "I will missing you" 같은 시제 뒤섞기도 조심하자.',
          soundKr:
            "I'm gonna는 \"암거나\"로 뭉개지고 miss you는 연음되어 \"미슈\"가 된다. so를 길게 " +
            '늘여 감정을 싣자 — 전체는 "암거나 미슈 가이즈 쏘우~ 머치".',
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
          variations: [
            { en: "Let's stay in touch.", kr: '계속 연락하고 지내자. (stay 버전)' },
            { en: "I'll be in touch.", kr: '연락드리겠습니다. (비즈니스 마무리 멘트)' },
            { en: 'We lost touch after college.', kr: '대학 졸업하고 연락이 끊겼어. (반대 상황)' },
          ],
          mistakeKr:
            '"연락할게"를 "I will contact you"라고 하면 업무 메일처럼 딱딱하다 — 친구 사이엔 ' +
            'keep/stay in touch가 자연스럽다. touch를 "만지다"로만 알면 헷갈리는데, 여기서는 ' +
            '"연결·교류"라는 명사다. in을 빼먹고 "keep touch"라고 하는 실수도 흔하다.',
          soundKr:
            'keep in이 이어져 "키핀"으로 소리 난다: "키핀 터치". touch는 ch를 분명히 살려 ' +
            '"터취"에 가깝게. touch에 강세를 얹고 끝을 살짝 올리면 다정한 당부가 된다.',
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
      drills: [
        {
          promptKr:
            '10년 넘게 다닌 단골 식당이 문을 닫는다는 소식을 들었습니다. "한 시대가 끝난 거야"라고 말해 보세요.',
          targetEn: "It's the end of an era.",
          keywords: ['end', 'era'],
        },
        {
          promptKr:
            '팀이 해체되어 마지막 회식 자리입니다. 동료들에게 "너희들 정말 많이 보고 싶을 거야"라고 말해 보세요.',
          targetEn: "I'm gonna miss you guys so much.",
          keywords: ['miss', 'guys', 'much'],
        },
        {
          promptKr:
            '해외로 떠나는 친구를 배웅합니다. "잘 지내, 그리고 연락하고 지내자"라고 인사해 보세요.',
          targetEn: 'Take care, and keep in touch!',
          keywords: ['keep', 'touch'],
        },
      ],
    },
    {
      id: 's10e18-2',
      titleKr: '마지막 한 잔의 커피',
      location: "Monica's Apartment → Central Perk",
      videoQuery: 'Friends series finale last line should we get some coffee',
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
          variations: [
            { en: "This isn't goodbye.", kr: '이건 작별이 아니야. (짧은 버전)' },
            { en: 'See you around!', kr: '또 보자! (기약 없이 가볍게)' },
            { en: "Let's not say goodbye — let's say see you soon.", kr: '작별 인사 말고 곧 보자고 하자. (같은 공식의 응용)' },
          ],
          mistakeKr:
            '"see you later"를 진짜 약속으로만 알면 이 문장의 맛을 놓친다 — 여기서는 "우리는 ' +
            '다시 만날 사이"라는 위로의 레토릭이다. goodbye 앞에 a를 붙여 "a goodbye"라고 하면 ' +
            '어색하고, "not A, B"의 대비 구조를 그대로 살려 통째로 쓰는 게 포인트다.',
          soundKr:
            'not goodbye의 not을 강하게 눌러 대비를 만든다. see you later는 "씨유레이러"로 ' +
            '흐르고 later의 t는 미국식 "러". 앞은 단호하게, 뒤는 부드럽게 — 톤의 대비가 핵심이다.',
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
          variations: [
            { en: 'We all deserve a fresh start.', kr: '누구나 새 출발 할 자격이 있어. (위로 버전)' },
            { en: "Let's start fresh.", kr: '처음부터 다시 시작하자. (동사 버전)' },
            { en: "It's a clean slate.", kr: '완전히 백지에서 시작하는 거야. (비슷한 관용구)' },
          ],
          mistakeKr:
            '"새로운 시작"을 "new start"라고 해도 틀리진 않지만 원어민은 fresh start를 압도적으로 ' +
            '많이 쓴다 — fresh에 "묵은 걸 털어냈다"는 뉘앙스가 있기 때문. "fresh restart"처럼 ' +
            're-를 덧붙이는 건 콩글리시다. 관사 a도 잊지 말자.',
          soundKr:
            "It's a는 \"잇처\"로 가볍게, fresh start는 sh를 분명히 끊어 \"프레쉬 스타-트\". " +
            'start에 강세를 두고 살짝 올라가는 톤으로 말하면 희망적인 뉘앙스가 산다.',
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
          variations: [
            { en: 'Should we grab some lunch?', kr: '우리 점심이나 먹을까? (grab으로 더 캐주얼하게)' },
            { en: 'Wanna get a drink after work?', kr: '퇴근하고 한잔할래? (술 버전)' },
            { en: 'Shall we?', kr: '갈까요? (문 앞에서 건네는 초간단 제안)' },
          ],
          mistakeKr:
            '제안을 "Do you want coffee?"라고만 하면 의향 확인에 그친다 — "같이 하자"는 부드러운 ' +
            '제안은 Should we ~?가 만든다. "Let\'s coffee"처럼 coffee를 동사로 쓰는 콩글리시도 ' +
            '금물 — get some coffee처럼 반드시 동사가 필요하다.',
          soundKr:
            'Should we는 "슈드위"→"슈위"로 가볍게 붙는다. get some coffee는 "겟썸 커-피"로, ' +
            'coffee의 첫음절에 강세. 제안문이니 문장 끝을 확실히 올려 준다.',
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
      drills: [
        {
          promptKr:
            '전근을 가게 된 동료가 아쉬워합니다. "작별이 아니라 나중에 또 보자는 인사야"라고 다독여 보세요.',
          targetEn: "It's not goodbye, it's see you later.",
          keywords: ['goodbye', 'later'],
        },
        {
          promptKr:
            '이직을 앞두고 설레는 마음을 가족에게 전합니다. "우리에겐 새로운 시작이야"라고 말해 보세요.',
          targetEn: "It's a fresh start for us.",
          keywords: ['fresh', 'start'],
        },
        {
          promptKr:
            '약속 시간까지 여유가 생겼습니다. 친구에게 "우리 커피 한잔할까?"라고 제안해 보세요.',
          targetEn: 'Should we get some coffee?',
          keywords: ['get', 'some', 'coffee'],
        },
      ],
    },
  ],
};

export default episode;
