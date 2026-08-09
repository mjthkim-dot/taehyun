import type { Episode } from '../../lib/types';

/**
 * S02E14 The One with the Prom Video — "He's her lobster."
 * 추억 회상과 우정·감동 리액션. 마음을 전하는 회화.
 */
const episode: Episode = {
  id: 's02e14',
  code: 'S02E14',
  season: 2,
  titleEn: 'The One with the Prom Video',
  titleKr: '프롬 비디오',
  synopsisKr:
    '옛날 프롬(졸업 파티) 비디오 속에서, 파트너가 안 온 레이첼을 위해 몰래 ' +
    '턱시도를 입고 나서려던 어린 로스의 모습이 드러난다. 피비의 명대사 ' +
    '"봐, 로스는 레이첼의 랍스터라니까!"와 함께 두 사람이 다시 이어지는 회차.',
  theme: '추억 · 우정 · 감동',
  scenes: [
    {
      id: 's02e14-1',
      titleKr: '프롬 비디오 상영회',
      location: "Monica's Apartment",
      videoQuery: 'Friends prom video Phoebe lobster Ross Rachel kiss',
      contextKr:
        '부모님 집에서 가져온 낡은 비디오를 다 같이 봅니다. 촌스러운 옛 모습에 ' +
        '웃다가, 마지막 장면에서 모두가 숙연해지죠. 옛 추억을 나누고 감동적인 ' +
        '순간에 리액션하는 표현을 배웁니다.',
      expressions: [
        {
          id: 's02e14-1-1',
          phrase: "He's her lobster.",
          meaningKr: '걔는 쟤의 랍스터야 (= 천생연분이야).',
          nuanceKr:
            '피비의 랍스터 이론 — "랍스터는 평생 한 짝하고만 산다"에서 나온 표현. ' +
            '이 회차 이후 "lobster"는 미국 대중문화에서 "운명의 상대"라는 뜻이 됐다. ' +
            '"You\'re my lobster"는 최고의 고백 멘트 중 하나.',
          exampleEn: "Look at those two. Twenty years together — she's totally his lobster.",
          exampleKr: '저 둘 좀 봐. 20년을 함께라니 — 그녀는 완전히 그의 랍스터야.',
          level: 3,
          variations: [
            { en: "You're my lobster.", kr: '넌 내 랍스터야, 내 운명이야. (최고의 고백 버전)' },
            { en: "They're totally meant for each other.", kr: '쟤네는 완전 천생연분이야. (누구에게나 통하는 일반 표현)' },
            { en: 'I knew you two would end up together.', kr: '너희 둘 결국 이어질 줄 알았어. (end up = 결국 ~되다)' },
          ],
          mistakeKr:
            '프렌즈를 모르는 사람에게 다짜고짜 "You\'re my lobster"라고 하면 해산물 얘기로 ' +
            '오해받을 수 있다 — 미드 팬들끼리 통하는 문화 코드임을 알고 쓰자. 안전한 일반 표현은 ' +
            '"meant for each other"나 "soulmates". 소유격(her/my)을 빼고 "He\'s a lobster"라고 ' +
            '하면 진짜 갑각류 문장이 되니 주의.',
          soundKr:
            "He's her는 h가 약해지며 \"히저\"로 뭉개진다. lobster는 첫음절 \"랍\"에 강세, " +
            '끝의 "터"는 힘을 뺀다: "히저 랍스터". 피비처럼 확신에 차서 lobster를 꾹 눌러 ' +
            '말하는 게 포인트.',
        },
        {
          id: 's02e14-1-2',
          phrase: 'This brings back memories.',
          meaningKr: '옛날 생각 난다.',
          nuanceKr:
            '"bring back"은 기억을 "다시 데려온다"는 그림. 옛 사진, 노래, 장소 앞에서 ' +
            '자동으로 나오는 표현이다. "This song brings back so many memories."처럼 ' +
            '주어만 바꿔 쓰면 된다.',
          exampleEn: 'Wow, our old school photos — this brings back memories.',
          exampleKr: '와, 우리 옛날 학교 사진이잖아 — 옛날 생각 난다.',
          level: 1,
          variations: [
            { en: 'This song brings back so many memories.', kr: '이 노래 들으니 옛 생각이 밀려온다. (노래·사진·장소 다 됨)' },
            { en: 'Being here brings back my college days.', kr: '여기 오니까 대학 시절이 떠오르네. (memories 대신 구체적 시절)' },
            { en: 'That smell takes me back.', kr: '이 냄새 맡으니 그때로 돌아간 것 같아. (take back 응용)' },
          ],
          mistakeKr:
            '"옛날 생각 난다"를 "I remember old days"로 직역하면 밋밋하다 — 사진·노래 같은 ' +
            '사물을 주어로 세워 "This brings back~"이라고 해야 원어민 감각이다. 주어가 this라 ' +
            '3인칭 단수 s(brings)를 빼먹기 쉽고, back을 빼면 그냥 "가져온다"가 되니 세트로 외우자.',
          soundKr:
            'brings back이 "브링즈백"으로 붙고 back에 강세. memories는 첫음절 "메"에 힘을 주고 ' +
            '"메모리즈"로 가볍게 흘린다. 감탄사부터 "오~ 디스 브링즈백 메모리즈" 하고 ' +
            '아련한 톤으로 말하면 완성.',
        },
        {
          id: 's02e14-1-3',
          phrase: "I can't believe it.",
          meaningKr: '믿기지가 않아.',
          nuanceKr:
            '놀람의 기본기. 좋은 일에도 나쁜 일에도 쓴다. 뒤에 절을 붙여 ' +
            '"I can\'t believe you did that!(네가 그랬다니 믿기지 않아)"처럼 확장하면 ' +
            '활용도가 무한해진다.',
          exampleEn: "You kept this photo for twenty years? I can't believe it.",
          exampleKr: '이 사진을 20년이나 간직했다고? 믿기지가 않아.',
          level: 1,
          variations: [
            { en: "I can't believe you did that!", kr: '네가 그랬다니 믿기지 않아! (뒤에 절을 붙여 확장)' },
            { en: 'Can you believe it?', kr: '이게 믿겨져? (놀라움을 같이 나눌 때)' },
            { en: 'Unbelievable.', kr: '말도 안 돼. (한 단어짜리 리액션)' },
          ],
          mistakeKr:
            "can't 발음이 흐리면 \"I can believe it(믿을 수 있다)\"으로 정반대 뜻이 전달된다 — " +
            '부정형은 모음에 힘이 실리고 짧게 끊긴다. believe 뒤에 in을 붙이면 "~의 존재를 ' +
            '믿는다"로 뜻이 달라지니 주의. 한국어 "헐/대박"이 나올 자리에 이 문장이 온다고 ' +
            '기억하면 쓸 곳이 보인다.',
          soundKr:
            "can't는 \"캔(트)\" — 끝의 t는 거의 안 들리지만 \"캔\"을 강하고 짧게 끊는다(긍정 can은 " +
            '약하게 "큰"). believe it은 연음돼 "빌리-빗". 전체: "아이 캔 빌리-빗!" — can과 ' +
            'believe에 강세를 주고 눈을 크게 뜨면 놀람 리액션 완성.',
        },
      ],
      dialogue: [
        {
          speaker: 'Monica',
          en: 'Okay everyone, I found our old prom video at mom and dad\'s house.',
          kr: '얘들아, 엄마 아빠 집에서 우리 옛날 프롬 비디오 찾았어.',
        },
        {
          speaker: 'Rachel',
          en: 'Oh my God, look at my hair! This brings back memories.',
          kr: '세상에, 내 머리 좀 봐! 옛날 생각 난다.',
          expressionId: 's02e14-1-2',
        },
        {
          speaker: 'Joey',
          en: 'Wait — is that Ross with the mustache?',
          kr: '잠깐 — 콧수염 있는 저 사람 로스야?',
        },
        {
          speaker: 'Chandler',
          en: "I can't believe it. This video is a gift that keeps on giving.",
          kr: '믿기지가 않아. 이 비디오는 끝없이 주는 선물이네.',
          expressionId: 's02e14-1-3',
        },
        {
          speaker: 'Monica',
          en: 'Shh, watch this part. Rachel\'s date didn\'t show up... and look at Ross.',
          kr: '쉿, 이 부분 봐. 레이첼 파트너가 안 왔을 때… 로스를 봐.',
        },
        {
          speaker: 'Rachel',
          en: 'He put on a tux... to take me? I never knew that.',
          kr: '나를 데려가려고… 턱시도를 입었다고? 전혀 몰랐어.',
        },
        {
          speaker: 'Phoebe',
          en: "See?! He's her lobster! I told you!",
          kr: '봤지?! 걔는 쟤의 랍스터라니까! 내가 말했잖아!',
          expressionId: 's02e14-1-1',
        },
      ],
      drills: [
        {
          promptKr:
            '20년을 함께한 커플을 보고, 프렌즈 팬인 친구에게 "그녀는 완전히 그의 랍스터야"라고 말해 보세요.',
          targetEn: "She's totally his lobster.",
          keywords: ['totally', 'lobster'],
        },
        {
          promptKr:
            '옛날 학교 사진을 발견했습니다. "와, 옛날 생각 난다"라고 말해 보세요.',
          targetEn: 'Wow, this brings back memories.',
          keywords: ['brings', 'back', 'memories'],
        },
        {
          promptKr:
            '친구가 20년 전 사진을 아직 간직하고 있답니다. "20년이나 간직했다고? 믿기지가 않아"라고 놀라 보세요.',
          targetEn: "You kept it for twenty years? I can't believe it.",
          keywords: ['kept', 'twenty', 'believe'],
        },
      ],
    },
    {
      id: 's02e14-2',
      titleKr: '조이의 우정 팔찌',
      location: "Joey & Chandler's Apartment",
      videoQuery: 'Friends Joey gives Chandler gold bracelet gift',
      contextKr:
        '첫 큰 출연료를 받은 조이가 챈들러에게 번쩍이는 금팔찌를 선물합니다. ' +
        '챈들러 취향은 아니지만… 마음이 중요한 거니까요. 신세 진 것 갚기, ' +
        '선물에 반응하기, 고맙다는 말 받아치기를 배웁니다.',
      expressions: [
        {
          id: 's02e14-2-1',
          phrase: 'I owe you one.',
          meaningKr: '신세 한 번 졌네 / 내가 하나 빚졌어.',
          nuanceKr:
            '"owe"는 빚지다. 도움을 받았을 때 "다음에 갚을게"라는 뉘앙스로 가볍게 던진다. ' +
            '"I owe you big time(크게 신세 졌어)"으로 강조할 수도 있다.',
          exampleEn: 'Thanks for covering my shift — I owe you one.',
          exampleKr: '근무 대신해 줘서 고마워 — 신세 한 번 졌네.',
          level: 1,
          variations: [
            { en: 'I owe you big time.', kr: '너한테 크게 신세 졌다. (강조 버전)' },
            { en: 'You owe me one!', kr: '너 나한테 빚진 거다! (내가 도와줬을 때 장난스럽게)' },
            { en: 'How much do I owe you?', kr: '내가 얼마 주면 돼? (돈 계산할 때의 owe)' },
          ],
          mistakeKr:
            'owe는 철자에 이끌려 "오웨"로 읽기 쉬운데 그냥 "오우"다. "I owe you"에서 끊으면 ' +
            '어딘가 미완성 — 끝의 one(신세 한 번)까지 붙여야 관용구가 된다. 무겁게 감사할 ' +
            '자리에는 이 가벼운 표현보다 "I really appreciate it"이 어울린다는 온도 차이도 기억하자.',
          soundKr:
            'I owe you는 모음끼리 이어져 "아이오우유" — 사실상 한 덩어리로 흐른다. 마지막 one에 ' +
            '강세: "아이 오우 유 원". 가볍게 툭 던지는 리듬이라, 심각한 톤으로 말하면 ' +
            '오히려 어색해진다.',
        },
        {
          id: 's02e14-2-2',
          phrase: "It's the thought that counts.",
          meaningKr: '중요한 건 마음이지.',
          nuanceKr:
            '선물이 취향에 안 맞아도, 결과가 아쉬워도 "정성이 중요하다"고 말할 때의 ' +
            '관용구. count는 여기서 "중요하다, 값어치가 있다"는 뜻이다.',
          exampleEn: 'He burned the cake, but hey — it\'s the thought that counts.',
          exampleKr: '케이크를 태우긴 했지만, 뭐 — 중요한 건 마음이지.',
          level: 2,
          variations: [
            { en: "It's the effort that counts.", kr: '중요한 건 노력이지. (thought 자리만 바꿔 응용)' },
            { en: 'What counts is that you tried.', kr: '네가 시도했다는 게 중요한 거야.' },
            { en: 'Every vote counts.', kr: '한 표 한 표가 소중하다. (count = 중요하다의 대표 예)' },
          ],
          mistakeKr:
            'count를 "세다"로만 알면 이 문장이 해석 불가가 된다 — 여기서는 "중요하다, 값어치가 ' +
            '있다"다. 주어가 the thought라 3인칭 단수 s를 붙인 counts인데, "that count"로 s를 ' +
            '빼먹는 실수가 잦다. It is ~ that 강조 구문이라 "중요한 건 바로 마음"이라는 힘이 실린다.',
          soundKr:
            "It's the가 \"잇츠더\"로 가볍게 지나가고, thought에 첫 강세 — th는 혀끝을 살짝 " +
            '내밀어 "쏘-트". that counts는 "댓카운츠"로 붙이고 counts에 마지막 강세. ' +
            '리듬은 "잇츠더 쏘-옷 댓 카운츠".',
        },
        {
          id: 's02e14-2-3',
          phrase: "Don't mention it.",
          meaningKr: '별말씀을 / 그런 말 마.',
          nuanceKr:
            '"고마워"에 대한 세련된 대답. 직역하면 "그 얘긴 꺼내지도 마"인데, ' +
            '"고마워할 것도 없다"는 겸손의 표현이다. "No problem", "Anytime"과 같은 계열.',
          exampleEn: '"Thanks for the ride!" — "Don\'t mention it."',
          exampleKr: '"태워다 줘서 고마워!" — "별말씀을."',
          level: 1,
          variations: [
            { en: 'No problem.', kr: '별거 아니야. (제일 무난하고 흔한 대답)' },
            { en: 'Anytime.', kr: '언제든지. (기꺼이 또 도와주겠다는 뉘앙스)' },
            { en: 'My pleasure.', kr: '제가 좋아서 한 건데요. (격식 있는 서비스 톤)' },
          ],
          mistakeKr:
            '직역 "언급하지 마"만 보고 화내는 말로 오해하면 안 된다 — "고마워할 것도 없다"는 ' +
            '겸손의 표현이다. "You\'re welcome"만 기계적으로 반복하는 학습자가 많은데, ' +
            'Don\'t mention it / No problem / Anytime을 섞어 쓰면 훨씬 자연스럽다. ' +
            '다만 격식 있는 자리에서는 "You\'re welcome"이 여전히 안전하다.',
          soundKr:
            "Don't의 t는 탈락해 \"돈\"으로 끝나고, mention it은 연음돼 \"멘셔닛\". 전체를 " +
            '한 호흡에 "돈 멘셔닛" — mention의 첫음절 "멘"에 강세, 마지막 it은 힘을 뺀다. ' +
            '가볍게 손을 젓듯 툭 던지는 톤이 어울린다.',
        },
      ],
      dialogue: [
        {
          speaker: 'Joey',
          en: 'Chandler! I got my first big paycheck, and I got you something.',
          kr: '챈들러! 첫 거액 출연료 받았는데, 너 줄 거 샀어.',
        },
        {
          speaker: 'Chandler',
          en: 'Wow. That is... a very shiny bracelet.',
          kr: '와. 이건… 정말 번쩍이는 팔찌구나.',
        },
        {
          speaker: 'Joey',
          en: "You've paid my rent for years, man. I owe you one. I owe you like fifty.",
          kr: '네가 몇 년이나 내 월세를 내줬잖아. 신세 한 번 졌지. 아니, 오십 번은 졌지.',
          expressionId: 's02e14-2-1',
        },
        {
          speaker: 'Chandler',
          en: "Joey, you didn't have to do that.",
          kr: '조이, 이럴 필요까진 없었는데.',
        },
        {
          speaker: 'Joey',
          en: 'I know it\'s a lot. But we\'re best friends, you know?',
          kr: '과한 거 알아. 그래도 우린 절친이잖아, 안 그래?',
        },
        {
          speaker: 'Chandler',
          en: "Well... it's the thought that counts. And this is a very loud thought.",
          kr: '뭐… 중요한 건 마음이지. 그리고 이건 아주 요란한 마음이네.',
          expressionId: 's02e14-2-2',
        },
        {
          speaker: 'Joey',
          en: 'So you like it? Really?',
          kr: '그럼 마음에 든다는 거지? 진짜로?',
        },
        {
          speaker: 'Chandler',
          en: "I love it, buddy. — 'Thanks, Chandler.' — Don't mention it.",
          kr: '완전 마음에 들어, 친구. — "고마워, 챈들러." — 별말씀을.',
          expressionId: 's02e14-2-3',
        },
      ],
      drills: [
        {
          promptKr:
            '동료가 근무를 대신해 줬습니다. "정말 고마워, 신세 한 번 졌네"라고 말해 보세요.',
          targetEn: 'Thanks so much — I owe you one.',
          keywords: ['thanks', 'owe', 'one'],
        },
        {
          promptKr:
            '친구가 만든 케이크가 좀 탔지만 정성이 느껴집니다. "중요한 건 마음이지"라고 말해 보세요.',
          targetEn: "It's the thought that counts.",
          keywords: ['thought', 'counts'],
        },
        {
          promptKr:
            '"태워다 줘서 고마워!"라는 인사를 받았습니다. "별말씀을, 언제든지"라고 세련되게 받아 보세요.',
          targetEn: "Don't mention it — anytime.",
          keywords: ['mention', 'anytime'],
        },
      ],
    },
  ],
};

export default episode;
