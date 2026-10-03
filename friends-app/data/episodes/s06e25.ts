import type { Episode } from '../../lib/types';

/**
 * S06E25 The One with the Proposal — 모니카와 챈들러의 프러포즈.
 * 사랑 고백, 청혼, 그리고 축하. 인생 이벤트의 회화.
 */
const episode: Episode = {
  id: 's06e25',
  code: 'S06E25',
  season: 6,
  titleEn: 'The One with the Proposal',
  titleKr: '촛불 속의 프러포즈',
  synopsisKr:
    '깜짝 프러포즈를 준비하던 챈들러의 계획이 꼬이지만, 촛불로 가득한 ' +
    '아파트에서 오히려 모니카가 먼저 무릎을 꿇는다. 울다가 말을 잇지 못하는 ' +
    '모니카, 그리고 챈들러의 완벽한 마무리 — 시리즈에서 가장 사랑받는 장면.',
  theme: '고백 · 청혼 · 축하',
  scenes: [
    {
      id: 's06e25-1',
      titleKr: '촛불 가득한 거실에서',
      location: "Monica & Chandler's Apartment",
      videoQuery: 'Friends Monica Chandler proposal candles scene',
      contextKr:
        '문을 연 챈들러 앞에 촛불로 가득한 거실과 모니카가 있습니다. ' +
        '서로 먼저 청혼하려다 눈물바다가 되는 장면. 확신을 표현하는 말, ' +
        '청혼의 말, 인생 최고의 순간을 전하는 표현을 배웁니다.',
      expressions: [
        {
          id: 's06e25-1-1',
          phrase: 'Will you marry me?',
          meaningKr: '나와 결혼해 줄래?',
          nuanceKr:
            '청혼의 표준 문장. "Marry me(결혼해 줘)"라고 짧게 던지면 더 캐주얼하고 ' +
            '강렬하다. 대답은 "Yes, I will!" 혹은 프렌즈식으로 눈물 콧물 범벅이 되어 ' +
            '"Yes"조차 못 하기.',
          exampleEn: 'You are my best friend and my whole heart. Will you marry me?',
          exampleKr: '너는 내 가장 친한 친구이자 내 마음 전부야. 나와 결혼해 줄래?',
          level: 1,
          variations: [
            { en: 'Marry me.', kr: '나랑 결혼하자. (짧고 강렬한 버전)' },
            { en: 'She said yes!', kr: '그녀가 승낙했어! (프러포즈 성공 보고)' },
            { en: 'Will you do me the honor of becoming my wife?', kr: '제 아내가 되어 주시겠습니까? (격식 최상급 버전)' },
          ],
          mistakeKr:
            '"나와 결혼해 줄래?"의 "~와"에 이끌려 "Will you marry with me?"라고 하기 쉽지만, ' +
            'marry는 전치사 없이 목적어를 바로 받는다 — marry me가 정답. "~와 결혼한 상태"도 ' +
            'married with가 아니라 married to를 쓴다.',
          soundKr:
            'Will you가 연음되어 "윌유"→"위류"처럼 부드럽게 흐른다. 강세는 marry의 첫음절 ' +
            '"매-리"에. 인생의 문장답게 천천히, 끝을 살짝 올려 진심을 실어 보자.',
        },
        {
          id: 's06e25-1-2',
          phrase: "You're the one.",
          meaningKr: '너야말로 내 운명이야.',
          nuanceKr:
            '"the one"은 "바로 그 한 사람", 즉 운명의 상대. "You\'re the one for me", ' +
            '"He\'s the one" 등으로 활용한다. 연애 리얼리티 쇼 제목으로도 단골. ' +
            '물건에 쓰면 "That\'s the one!(바로 그거야!)"이 된다.',
          exampleEn: 'The moment we met, I just knew — you\'re the one.',
          exampleKr: '우리가 만난 순간 바로 알았어 — 너야말로 내 운명이라는 걸.',
          level: 2,
          variations: [
            { en: "You're the one for me.", kr: '너야말로 내 짝이야. (for me로 더 분명하게)' },
            { en: "I think he's the one.", kr: '걔가 내 운명인 것 같아. (친구에게 연애 상담할 때)' },
            { en: "That's the one!", kr: '바로 그거야! (쇼핑에서 물건 고를 때)' },
          ],
          mistakeKr:
            'the를 빼고 "You\'re one"이라고 하면 "너는 하나다?"가 되어 버린다 — "운명의 단 한 ' +
            '사람"이라는 뜻은 정관사 the가 만든다. 또 one을 숫자 1로만 알고 있으면 이 관용구를 ' +
            '들어도 놓친다. "the one = 바로 그 사람/그것"으로 묶어 두자.',
          soundKr:
            '핵심 강세는 one — "유어 더 원-"처럼 one을 길고 묵직하게 누른다. the는 "더"로 ' +
            '약하게 흘린다. 눈을 맞추고 천천히 말해야 대사의 무게가 산다.',
        },
        {
          id: 's06e25-1-3',
          phrase: "I've never been more sure of anything.",
          meaningKr: '이보다 확신해 본 적이 없어.',
          nuanceKr:
            '비교급 + 현재완료로 만드는 최상급 확신 — "지금이 인생 최대의 확신"이라는 ' +
            '구조다. "I\'ve never been happier(지금이 제일 행복해)"처럼 형용사만 바꾸면 ' +
            '무한 응용된다. 결심을 전할 때 이만큼 힘 있는 문형이 없다.',
          exampleEn: 'Quitting to start my own café? I\'ve never been more sure of anything.',
          exampleKr: '회사 그만두고 내 카페를 차리는 거? 이보다 확신해 본 적이 없어.',
          level: 3,
          variations: [
            { en: "I've never been happier.", kr: '지금이 제일 행복해. (형용사만 바꾼 응용)' },
            { en: "I've never seen anything like it.", kr: '그런 건 태어나서 처음 봐. (동사 버전)' },
            { en: 'Are you sure about this?', kr: '이거 확실해? (확신을 되묻는 반대편 질문)' },
          ],
          mistakeKr:
            'sure를 동사처럼 써서 "I never sured"라고 하면 틀린다 — sure는 형용사라 be동사가 ' +
            '필수다. 시제도 포인트: 태어나서 지금까지의 경험을 말하므로 현재완료 "I\'ve never ' +
            'been"을 쓴다. 단순과거 "I never was"로 하면 어색해진다.',
          soundKr:
            "I've never been이 \"아이브 네버빈\"으로 뭉치고, more sure를 \"모어 슈어-\"로 가장 " +
            '힘 있게 누른다. sure는 "슈얼"이 아니라 끝의 r만 살짝 굴리는 "슈어r". anything은 가볍게.',
        },
      ],
      dialogue: [
        {
          speaker: 'Chandler',
          en: 'Oh my God. The candles... Monica, what is all this?',
          kr: '세상에. 이 촛불들… 모니카, 이게 다 뭐야?',
        },
        {
          speaker: 'Monica',
          en: 'You wanted it to be a surprise. But I wanted... okay, I\'m just gonna say it.',
          kr: '네가 깜짝 이벤트로 하고 싶어 했잖아. 근데 나는… 좋아, 그냥 말할게.',
        },
        {
          speaker: 'Monica',
          en: 'In all my life... I never thought I would be so lucky as to... to fall in love with my best—',
          kr: '내 평생… 이렇게 운이 좋을 줄 몰랐어. 가장 친한 친구와… 사랑에 빠지는—',
        },
        {
          speaker: 'Monica',
          en: "There's a reason why girls don't do this. I can't...",
          kr: '여자들이 이걸 안 하는 데는 이유가 있었어. 못 하겠어…',
        },
        {
          speaker: 'Chandler',
          en: "I'll do it. Monica... you make me happier than I ever thought I could be. You're the one.",
          kr: '내가 할게. 모니카… 너는 내가 가능하다고 생각한 것보다 더 행복하게 해 줘. 너야말로 내 운명이야.',
          expressionId: 's06e25-1-2',
        },
        {
          speaker: 'Chandler',
          en: "I've never been more sure of anything. Will you marry me?",
          kr: '이보다 확신해 본 적이 없어. 나와 결혼해 줄래?',
          expressionId: 's06e25-1-3',
        },
        {
          speaker: 'Monica',
          en: 'Yes! Yes!! A thousand times yes!',
          kr: '응! 응!! 천 번이라도 응!',
          expressionId: 's06e25-1-1',
        },
      ],
      drills: [
        {
          promptKr:
            '오래 사귄 연인에게 청혼하는 순간입니다. "너는 내 가장 친한 친구야. 나와 결혼해 줄래?"라고 말해 보세요.',
          targetEn: 'You are my best friend. Will you marry me?',
          keywords: ['friend', 'marry'],
        },
        {
          promptKr:
            '친구가 "그 사람이랑 진지한 거야?"라고 묻습니다. "만난 순간 알았어 — 그 사람이 내 운명이야"라고 답해 보세요.',
          targetEn: 'The moment we met, I just knew he was the one.',
          keywords: ['knew', 'one'],
        },
        {
          promptKr:
            '유학을 결심하고 부모님께 알리는 자리입니다. "이보다 확신해 본 적이 없어요"라고 결심을 전해 보세요.',
          targetEn: "I've never been more sure of anything.",
          keywords: ['never', 'more', 'sure'],
        },
      ],
    },
    {
      id: 's06e25-2',
      titleKr: '친구들에게 알리는 밤',
      location: 'Central Perk',
      videoQuery: 'Friends Monica Chandler announce engagement to friends',
      contextKr:
        '약혼 소식을 들고 커피하우스로 달려간 두 사람. 친구들의 환호가 터집니다. ' +
        '빅뉴스 발표하기, 진심으로 축하하기, 축배 제안하기 — 좋은 소식의 날 ' +
        '쓰는 표현을 배웁니다.',
      expressions: [
        {
          id: 's06e25-2-1',
          phrase: "We're engaged!",
          meaningKr: '우리 약혼했어!',
          nuanceKr:
            '"engaged"는 "약혼한". get engaged(약혼하다) → be engaged(약혼 상태) 순서로 ' +
            '기억하자. 참고로 엔지니어링 회의에서 "engaged"는 "몰입한"이라는 뜻 — ' +
            '문맥이 전부다. 결혼(married), 임신(expecting)과 함께 3대 발표 표현.',
          exampleEn: 'Everyone, we have news — we\'re engaged!',
          exampleKr: '얘들아, 우리 소식 있어 — 우리 약혼했어!',
          level: 1,
          variations: [
            { en: 'We got engaged last night!', kr: '우리 어젯밤에 약혼했어! (사건으로 말할 때는 get)' },
            { en: "She's engaged to my old roommate.", kr: '걔 내 옛 룸메이트랑 약혼했어. (~와 약혼은 to)' },
            { en: "We're expecting!", kr: '우리 아기 생겼어요! (3대 발표 표현 세트)' },
          ],
          mistakeKr:
            '"~와 약혼했다"는 engaged with가 아니라 engaged to다 — engaged with는 "~에 ' +
            '몰두한/관여한"이라는 비즈니스 뜻이 되어 버린다. 또 약혼하는 "순간"은 get engaged, ' +
            '약혼한 "상태"는 be engaged로 구분해서 쓰자.',
          soundKr:
            "We're는 \"위어\"로 짧게 치고, engaged는 2음절에 강세 — \"인게이-지드\". " +
            '빅뉴스답게 문장 전체를 위로 던지듯 밝은 톤으로 외치는 게 자연스럽다.',
        },
        {
          id: 's06e25-2-2',
          phrase: "I'm so happy for you.",
          meaningKr: '내 일처럼 기뻐.',
          nuanceKr:
            '남의 좋은 소식에 대한 미국식 표준 축하. "for you"가 핵심 — "너를 위해 ' +
            '기쁘다", 즉 진심으로 함께 기뻐한다는 뜻이다. "Congratulations!"와 ' +
            '세트로 쓰면 완벽하다.',
          exampleEn: 'You got the job?! Congratulations, I\'m so happy for you!',
          exampleKr: '합격했다고?! 축하해, 내 일처럼 기쁘다!',
          level: 1,
          variations: [
            { en: "I'm so proud of you.", kr: '네가 정말 자랑스러워. (성취를 축하할 때)' },
            { en: "I'm thrilled for you both.", kr: '두 사람 일이 내 일처럼 신난다. (커플에게)' },
            { en: 'You two deserve it.', kr: '너희는 그럴 자격 있어. (축하에 얹는 한마디)' },
          ],
          mistakeKr:
            'for you를 빼고 "I\'m so happy"만 하면 "내 기분이 좋다"는 내 얘기가 된다 — 상대를 ' +
            '축하하는 마음은 for you가 만든다. "happy about you"도 어색하다. 사람을 축하할 땐 ' +
            'for, 사건에 대한 감정은 about — 전치사로 갈린다.',
          soundKr:
            'so를 길게 늘여 "쏘우~ 해피"로 감정을 싣는다. happy for you는 "해피퍼유"로 이어지고 ' +
            'for는 약하게 "퍼". happy에 최고 강세를 두고 미소 띤 톤이면 완성이다.',
        },
        {
          id: 's06e25-2-3',
          phrase: 'This calls for a celebration.',
          meaningKr: '이건 축하해야 할 일이지.',
          nuanceKr:
            '"call for"는 "~을 요구하다". 좋은 소식이 나오면 "이 상황이 축하를 ' +
            '요구한다"며 자연스럽게 축배·파티로 넘어가는 다리 표현이다. ' +
            '"This calls for champagne!(샴페인 각이다!)"처럼 바꿔도 좋다.',
          exampleEn: 'A promotion AND a new apartment? This calls for a celebration.',
          exampleKr: '승진에 새 아파트까지? 이건 축하해야 할 일이지.',
          level: 2,
          variations: [
            { en: 'This calls for champagne!', kr: '샴페인 각이다! (구체적 아이템 버전)' },
            { en: 'This calls for a toast.', kr: '이건 건배해야지. (축배 버전)' },
            { en: "Let's celebrate!", kr: '축하하자! (제일 간단한 버전)' },
          ],
          mistakeKr:
            'call을 "전화하다"로만 알면 "축하에 전화를 한다?"로 꼬인다 — call for는 "~을 ' +
            '요구하다"라는 별개의 구동사다. 주어를 사람으로 바꿔 "I call for ~"라고 하면 격식 ' +
            '있는 동의 요청이 되어 버리니, 상황이 주어인 "This calls for ~"를 통째로 외우자.',
          soundKr:
            'calls for a가 이어져 "콜즈퍼러"로 굴러간다. 강세는 calls와 celebration의 "레이"에 — ' +
            '"디스 콜-즈 퍼러 셀러브레이-션". 잔을 드는 제스처와 함께 톤을 올리면 딱이다.',
        },
      ],
      dialogue: [
        {
          speaker: 'Monica',
          en: 'Hey guys? Guys! We have an announcement.',
          kr: '얘들아? 얘들아! 발표할 게 있어.',
        },
        {
          speaker: 'Chandler',
          en: "We're engaged!",
          kr: '우리 약혼했어!',
          expressionId: 's06e25-2-1',
        },
        {
          speaker: 'Rachel',
          en: 'Oh my God!! Let me see the ring! Let me see it!',
          kr: '세상에!! 반지 보여 줘! 어서 보여 줘!',
        },
        {
          speaker: 'Phoebe',
          en: 'I knew it! Well, I didn\'t know it, but I sensed a strong ring energy today.',
          kr: '내 그럴 줄 알았어! 뭐, 알았던 건 아니지만 오늘 강한 반지 기운을 느꼈거든.',
        },
        {
          speaker: 'Ross',
          en: "Congratulations, you two. I'm so happy for you.",
          kr: '축하한다, 너희 둘. 내 일처럼 기쁘다.',
          expressionId: 's06e25-2-2',
        },
        {
          speaker: 'Joey',
          en: 'My two best friends, getting married! This calls for a celebration!',
          kr: '내 절친 둘이 결혼이라니! 이건 축하해야 할 일이지!',
          expressionId: 's06e25-2-3',
        },
        {
          speaker: 'Chandler',
          en: 'Drinks on me! ...I mean, drinks on Joey. I just got engaged, I\'m saving for a wedding.',
          kr: '술은 내가 쏜다! …아니, 조이가 쏜다. 나 방금 약혼해서 결혼 자금 모아야 돼.',
        },
      ],
      drills: [
        {
          promptKr:
            '친구들을 모아 놓고 약혼 소식을 발표하는 순간입니다. "우리 소식 있어 — 우리 약혼했어!"라고 외쳐 보세요.',
          targetEn: "We have news — we're engaged!",
          keywords: ['news', 'engaged'],
        },
        {
          promptKr:
            '친구가 드디어 취업에 성공했습니다. "축하해, 내 일처럼 기뻐!"라고 축하해 보세요.',
          targetEn: "Congratulations! I'm so happy for you!",
          keywords: ['congratulations', 'happy'],
        },
        {
          promptKr:
            '친구의 승진 소식을 들었습니다. "이건 축하해야 할 일이지!"라며 축배를 제안해 보세요.',
          targetEn: 'This calls for a celebration!',
          keywords: ['calls', 'celebration'],
        },
      ],
    },
  ],
};

export default episode;
