/**
 * 패턴 스토리 — "단편적이어서 어떻게 활용할지 모르겠다"에 대한 답.
 *
 * 패턴을 낱장 카드가 아니라 장면으로 가르친다:
 *   scene(어떤 상황인가) → dialogue(그 장면의 미니 대화 — 패턴이 실제로 쓰이는
 *   순간을 mark로 표시) → how(언제·어떻게 쓰는지, 흔한 오해까지) →
 *   speak(기본→원어민 2단 말하기) → challenge(상황만 듣고 떠올려 말하기)
 *
 * 전부 정적 콘텐츠다 — AI 호출 없이 오프라인에서도 세션이 완주된다.
 * 대화 어휘는 의도적으로 쉽게 묶었다(패턴 자체에 집중하도록).
 */

export interface PatternStory {
  /** 어떤 장면인가 — 한국어 한두 문장 */
  scene: string;
  /** 미니 대화 — 쉬운 어휘 3턴. 패턴이 쓰인 줄에 mark */
  dialogue: { sp: 'A' | 'B'; en: string; kr: string; mark?: boolean }[];
  /** 활용 포인트 — 언제/어떻게 쓰고, 무엇과 다른지 (한국어) */
  how: string;
  /** 말하기 2단 — 세션의 미니 사다리 (기본 → 원어민) */
  speak: { basic: { en: string; kr: string }; native: { en: string; kr: string } };
  /** 실전 리콜 — 이 상황에서 native 문장을 떠올려 말한다 */
  challenge: string;
}

export const PATTERN_STORIES: Record<string, PatternStory> = {
  /* ── 1단계 · 뼈대 ── */
  'id-like': {
    scene: '처음 연락한 고객에게 미팅을 청하는 전화. 부담을 주지 않고 원하는 것을 말해야 한다.',
    dialogue: [
      { sp: 'A', en: 'Hello, this is Taehyun from MZC.', kr: '안녕하세요, MZC의 태현입니다.' },
      { sp: 'A', en: "I'd like to schedule a quick call this week.", kr: '이번 주에 짧은 통화를 잡고 싶습니다.', mark: true },
      { sp: 'B', en: 'Sure. How about Thursday?', kr: '좋아요. 목요일 어때요?' },
    ],
    how: '"I want to"는 아이가 조르는 느낌이 날 수 있어요. 비즈니스에서 원하는 걸 말할 땐 거의 항상 "I\'d like to"가 기본값입니다. 뒤에 동사원형만 붙이면 어떤 요청이든 정중해져요.',
    speak: {
      basic: { en: 'I want to schedule a call.', kr: '통화를 잡고 싶어요.' },
      native: { en: "I'd like to schedule a quick call this week.", kr: '이번 주에 짧은 통화를 잡고 싶습니다.' },
    },
    challenge: '새 고객에게 이번 주 짧은 통화를 청해보세요.',
  },
  'could-you': {
    scene: '고객에게 최신 자료를 요청하는 상황. 명령처럼 들리면 안 된다.',
    dialogue: [
      { sp: 'A', en: 'I reviewed the old deck yesterday.', kr: '어제 예전 자료를 봤어요.' },
      { sp: 'A', en: 'Could you send me the latest version?', kr: '최신 버전을 보내주시겠어요?', mark: true },
      { sp: 'B', en: 'Of course, sending it now.', kr: '물론이죠, 지금 보낼게요.' },
    ],
    how: '"Please send me"는 정중한 것 같지만 사실 명령문이에요. 원어민의 요청 표준형은 "Could you ...?" — 물음표 하나로 상대에게 선택권을 주는 모양이 됩니다. send, share, check 어떤 동사와도 붙어요.',
    speak: {
      basic: { en: 'Please send me the file.', kr: '파일을 보내주세요.' },
      native: { en: 'Could you send me the latest version?', kr: '최신 버전을 보내주시겠어요?' },
    },
    challenge: '고객에게 최신 자료를 보내달라고 요청해보세요.',
  },
  'get-back': {
    scene: '미팅에서 모르는 질문을 받았다. 얼버무리지 않고 신뢰를 지키며 넘겨야 한다.',
    dialogue: [
      { sp: 'B', en: 'Does the price include support?', kr: '가격에 기술 지원이 포함되나요?' },
      { sp: 'A', en: "Good question. Let me check and get back to you.", kr: '좋은 질문이에요. 확인하고 다시 연락드릴게요.', mark: true },
      { sp: 'B', en: 'Sounds good, thanks.', kr: '좋아요, 감사합니다.' },
    ],
    how: '모를 때 "I don\'t know"로 끝내면 신뢰가 깎여요. "Let me check and get back to you"는 모른다는 말 없이 "확인 후 회신"을 약속하는 원어민의 표준 대응입니다. 실무에서 가장 많이 쓰게 될 한 문장이에요.',
    speak: {
      basic: { en: 'I will check and tell you later.', kr: '확인하고 나중에 말씀드릴게요.' },
      native: { en: 'Let me check and get back to you tomorrow.', kr: '확인하고 내일 다시 연락드릴게요.' },
    },
    challenge: '모르는 질문을 받았습니다. 확인 후 내일 회신하겠다고 말해보세요.',
  },
  'didnt-catch': {
    scene: '콘퍼런스콜에서 상대의 말을 놓쳤다. 상대 탓하지 않고 다시 청해야 한다.',
    dialogue: [
      { sp: 'B', en: 'We need the report by the twenty-third.', kr: '23일까지 보고서가 필요해요.' },
      { sp: 'A', en: "Sorry, I didn't catch that. Could you say it again?", kr: '죄송해요, 잘 못 들었어요. 다시 말씀해주시겠어요?', mark: true },
      { sp: 'B', en: 'Sure — the twenty-third.', kr: '네 — 23일이요.' },
    ],
    how: '"What?"이나 "Again please"는 무례하게 들려요. "I didn\'t catch that"은 "내가 못 잡았다"라고 말해 상대 탓을 지웁니다. 전화 품질이 나빴든 발음이 빨랐든, 언제나 안전한 되묻기예요.',
    speak: {
      basic: { en: 'Sorry, can you say that again?', kr: '죄송해요, 다시 말해줄래요?' },
      native: { en: "Sorry, I didn't catch that. Could you say it again?", kr: '죄송해요, 잘 못 들었어요. 다시 말씀해주시겠어요?' },
    },
    challenge: '통화 중 상대의 말을 놓쳤습니다. 정중하게 다시 청해보세요.',
  },
  'just-to-confirm': {
    scene: '미팅 끝, 일정이 맞는지 마지막으로 확인하고 싶다. 따지는 느낌 없이.',
    dialogue: [
      { sp: 'A', en: 'Great, I think we are done.', kr: '좋아요, 다 된 것 같네요.' },
      { sp: 'A', en: 'Just to confirm, the demo is at 3pm on Friday?', kr: '확인차 여쭤요, 데모는 금요일 3시죠?', mark: true },
      { sp: 'B', en: "That's right. See you then.", kr: '맞아요. 그때 봬요.' },
    ],
    how: '확인 질문을 그냥 던지면 "아까 말했잖아요"처럼 들릴 수 있어요. 앞에 "Just to confirm"을 붙이면 "제 확인 절차예요"라는 신호가 되어 몇 번을 물어도 어색하지 않습니다. 숫자·날짜·금액 확인에 특히 좋아요.',
    speak: {
      basic: { en: 'The demo is at 3pm, right?', kr: '데모는 3시 맞죠?' },
      native: { en: 'Just to confirm, the demo is at 3pm on Friday?', kr: '확인차 여쭤요, 데모는 금요일 3시죠?' },
    },
    challenge: '미팅을 끝내며 금요일 3시 데모 일정을 확인해보세요.',
  },
  'that-works': {
    scene: '고객이 미팅 시간을 제안했다. 자연스럽게 동의하고 싶다.',
    dialogue: [
      { sp: 'B', en: 'Can we meet Thursday at two?', kr: '목요일 2시에 만날 수 있을까요?' },
      { sp: 'A', en: 'Thursday at two? That works for me.', kr: '목요일 2시요? 저는 좋습니다.', mark: true },
      { sp: 'B', en: "Perfect, I'll send an invite.", kr: '좋아요, 초대장 보낼게요.' },
    ],
    how: '"OK"나 "Yes"만 하면 성의 없어 보일 수 있어요. "That works for me"는 "그 조건이 내게 돌아간다(works)"는 원어민 특유의 동의 표현 — 일정, 가격, 계획 무엇에든 씁니다. 반대로 안 되면 "That doesn\'t work for me".',
    speak: {
      basic: { en: 'OK, Thursday is good.', kr: '네, 목요일 좋아요.' },
      native: { en: 'Thursday at two? That works for me.', kr: '목요일 2시요? 저는 좋습니다.' },
    },
    challenge: '고객이 목요일 2시를 제안했습니다. 자연스럽게 동의해보세요.',
  },
  'im-afraid': {
    scene: '내일 미팅에 못 간다고 말해야 한다. 차갑지 않게 거절하는 법.',
    dialogue: [
      { sp: 'B', en: 'Can you join the meeting tomorrow?', kr: '내일 미팅에 올 수 있어요?' },
      { sp: 'A', en: "I'm afraid I can't make it tomorrow.", kr: '죄송하지만 내일은 어렵습니다.', mark: true },
      { sp: 'A', en: 'Could we do Friday instead?', kr: '대신 금요일은 어떨까요?' },
    ],
    how: '"I can\'t"만 말하면 문이 쾅 닫히는 소리가 나요. 앞에 "I\'m afraid"를 붙이면 "유감스럽게도"라는 완충재가 깔려 같은 거절이 부드러워집니다. 거절 뒤에 대안(instead)을 붙이면 원어민의 거절 공식이 완성돼요.',
    speak: {
      basic: { en: "I can't come tomorrow.", kr: '내일은 못 가요.' },
      native: { en: "I'm afraid I can't make it tomorrow. Could we do Friday instead?", kr: '죄송하지만 내일은 어렵습니다. 대신 금요일은 어떨까요?' },
    },
    challenge: '내일 미팅에 못 간다고 말하고, 금요일을 대안으로 제시해보세요.',
  },
  'thanks-time': {
    scene: '첫 미팅이 끝났다. 마지막 인상을 좋게 남기는 닫는 말.',
    dialogue: [
      { sp: 'A', en: 'That covers everything from my side.', kr: '제 쪽에서는 이게 전부입니다.' },
      { sp: 'A', en: 'Thanks for your time today.', kr: '오늘 시간 내주셔서 감사합니다.', mark: true },
      { sp: 'B', en: 'Thank you. Talk soon.', kr: '감사합니다. 곧 얘기해요.' },
    ],
    how: '미팅을 "Bye"로 끝내면 뭔가 빠진 느낌이 들어요. 원어민은 거의 예외 없이 "Thanks for your time"으로 닫습니다 — 상대의 시간이 소중하다는 인정이자, 다음 만남의 문을 열어두는 정형구예요. 이메일 마무리에도 그대로 씁니다.',
    speak: {
      basic: { en: 'Thank you for the meeting.', kr: '미팅 감사합니다.' },
      native: { en: 'Thanks for your time today. Talk soon.', kr: '오늘 시간 내주셔서 감사합니다. 곧 얘기해요.' },
    },
    challenge: '미팅을 마무리하며 감사 인사로 닫아보세요.',
  },

  /* ── 2단계 · 구어의 감 ── */
  'looking-to': {
    scene: '고객이 우리 회사의 계획을 물었다. 격식 문어체 대신 구어로 답하고 싶다.',
    dialogue: [
      { sp: 'B', en: 'What are your plans for next year?', kr: '내년 계획이 어떻게 되세요?' },
      { sp: 'A', en: "We're looking to expand into Japan.", kr: '일본 진출을 계획하고 있어요.', mark: true },
      { sp: 'B', en: 'Interesting. Tell me more.', kr: '흥미롭네요. 더 얘기해주세요.' },
    ],
    how: '"We plan to"는 보고서 문장이에요. 말로 할 땐 "We\'re looking to" — "~하려고 보고 있다"는 진행형이 계획에 온도를 붙입니다. 개인 계획에도 그대로: "I\'m looking to switch teams."',
    speak: {
      basic: { en: 'We plan to expand into Japan.', kr: '일본 진출을 계획합니다.' },
      native: { en: "We're looking to expand into Japan next year.", kr: '내년에 일본 진출을 계획하고 있어요.' },
    },
    challenge: '내년 일본 진출 계획을 구어체로 말해보세요.',
  },
  'turns-out': {
    scene: '장애 원인을 조사해 보니 우리 쪽 문제였다. 반전을 자연스럽게 전해야 한다.',
    dialogue: [
      { sp: 'B', en: 'Did you find the cause of the error?', kr: '오류 원인은 찾았어요?' },
      { sp: 'A', en: 'Yes. It turns out the issue was on our side.', kr: '네. 알고 보니 문제는 저희 쪽이었어요.', mark: true },
      { sp: 'A', en: 'We already fixed it.', kr: '이미 고쳤습니다.' },
    ],
    how: '"Actually the problem was..."보다 한 수 위가 "It turns out ..." — "조사해 보니 밝혀졌다"는 과정이 문장에 담겨요. 예상과 달랐던 결과를 전할 때의 원어민 표준 오프닝입니다.',
    speak: {
      basic: { en: 'The problem was on our side.', kr: '문제는 저희 쪽이었어요.' },
      native: { en: 'It turns out the issue was on our side. We already fixed it.', kr: '알고 보니 문제는 저희 쪽이었어요. 이미 고쳤습니다.' },
    },
    challenge: '조사 결과 문제가 우리 쪽이었음을 전하고, 이미 고쳤다고 말해보세요.',
  },
  'thing-is': {
    scene: '고객 제안은 좋지만 예산이 걸린다. 난점을 꺼내야 하는 순간.',
    dialogue: [
      { sp: 'B', en: 'So, can we start next month?', kr: '그럼 다음 달에 시작할 수 있죠?' },
      { sp: 'A', en: 'The thing is, our budget is already set for this quarter.', kr: '문제는, 이번 분기 예산이 이미 정해져 있다는 거예요.', mark: true },
      { sp: 'B', en: 'I see. Then how about Q3?', kr: '그렇군요. 그럼 3분기는요?' },
    ],
    how: '나쁜 소식이나 난점을 바로 던지면 딱딱해요. "The thing is, ..."는 "실은 문제가 하나 있는데"라며 숨을 고르는 원어민의 프레임 — 듣는 사람이 마음의 준비를 하게 해줍니다. 뒤에는 항상 난점의 핵심 한 문장.',
    speak: {
      basic: { en: 'The budget is already set.', kr: '예산이 이미 정해져 있어요.' },
      native: { en: 'The thing is, our budget is already set for this quarter.', kr: '문제는, 이번 분기 예산이 이미 정해져 있다는 거예요.' },
    },
    challenge: '시작 시점을 묻는 고객에게, 예산이 이미 정해져 있다는 난점을 꺼내보세요.',
  },
  'wondering-if': {
    scene: '마감을 미뤄달라는 부탁 — 부담스러운 요청일수록 낮은 톤으로.',
    dialogue: [
      { sp: 'A', en: 'About the proposal deadline...', kr: '제안서 마감 관련해서요...' },
      { sp: 'A', en: 'I was wondering if we could push it to Monday.', kr: '월요일로 미룰 수 있을지 여쭤봅니다.', mark: true },
      { sp: 'B', en: 'Monday should be fine.', kr: '월요일 괜찮을 거예요.' },
    ],
    how: '"Can we...?"보다 훨씬 낮은 자세의 요청이 "I was wondering if ..." — 과거진행형(was wondering)이 "계속 고민해 왔다"는 조심스러움을 만들어요. 마감 연기, 가격 조정, 특별 요청처럼 부담스러운 부탁 전용입니다.',
    speak: {
      basic: { en: 'Can we move the deadline to Monday?', kr: '마감을 월요일로 옮길 수 있나요?' },
      native: { en: 'I was wondering if we could push the deadline to Monday.', kr: '마감을 월요일로 미룰 수 있을지 여쭤봅니다.' },
    },
    challenge: '제안서 마감을 월요일로 미뤄달라고 조심스럽게 부탁해보세요.',
  },
  'do-you-mind': {
    scene: '통화를 녹음하고 싶다. 허락을 구하는 가장 자연스러운 방법.',
    dialogue: [
      { sp: 'A', en: 'Before we start —', kr: '시작하기 전에 —' },
      { sp: 'A', en: 'do you mind if I record this call?', kr: '통화를 녹음해도 괜찮을까요?', mark: true },
      { sp: 'B', en: 'Not at all, go ahead.', kr: '전혀요, 하세요.' },
    ],
    how: '"May I ...?"는 교과서, "Do you mind if ...?"가 실전입니다. 주의 하나: 대답이 반대로 와요 — "Not at all(전혀 꺼리지 않아요)"이 허락, "Actually, ..."가 거절의 신호입니다. 녹음·화면공유·동석자 참여 요청에 딱이에요.',
    speak: {
      basic: { en: 'May I record this call?', kr: '통화를 녹음해도 될까요?' },
      native: { en: 'Do you mind if I record this call for our notes?', kr: '기록용으로 통화를 녹음해도 괜찮을까요?' },
    },
    challenge: '미팅 시작 전에 녹음 허락을 구해보세요.',
  },
  'kind-of': {
    scene: '고객이 제시한 일정이 빠듯하다. 직설을 눅여서 말하는 법.',
    dialogue: [
      { sp: 'B', en: 'We want it live in two weeks.', kr: '2주 안에 오픈하고 싶어요.' },
      { sp: 'A', en: 'Honestly, that timeline feels a bit tight.', kr: '솔직히 그 일정은 좀 빠듯한 것 같아요.', mark: true },
      { sp: 'A', en: 'Three weeks would be safer.', kr: '3주가 더 안전할 거예요.' },
    ],
    how: '"That\'s impossible"은 문을 닫는 말이에요. 원어민은 부정적 평가 앞에 "a bit", "kind of"를 깔아 강도를 낮춥니다 — "a bit tight(좀 빠듯)"이라 말하고 대안을 붙이는 게 프로의 반대 의견이에요.',
    speak: {
      basic: { en: 'That schedule is too tight.', kr: '그 일정은 너무 빠듯해요.' },
      native: { en: 'That timeline feels a bit tight. Three weeks would be safer.', kr: '그 일정은 좀 빠듯한 것 같아요. 3주가 더 안전할 거예요.' },
    },
    challenge: '2주 일정이 빠듯하다고 완곡하게 말하고 3주를 제안해보세요.',
  },
  'touch-base': {
    scene: '지금 결정은 안 났고, 다음 주에 가볍게 다시 얘기하고 싶다.',
    dialogue: [
      { sp: 'A', en: 'No need to decide today.', kr: '오늘 결정하실 필요는 없어요.' },
      { sp: 'A', en: "Let's touch base early next week.", kr: '다음 주 초에 가볍게 얘기해요.', mark: true },
      { sp: 'B', en: 'Sounds good. Monday afternoon?', kr: '좋아요. 월요일 오후?' },
    ],
    how: '"Let\'s have a meeting"은 무겁고, "Let\'s touch base"는 야구에서 온 "베이스 찍기" — 잠깐 상태만 맞추자는 가벼운 제안이에요. 상대가 부담 없이 응할 수 있어 후속 약속 잡기의 마법 표현입니다.',
    speak: {
      basic: { en: "Let's talk again next week.", kr: '다음 주에 다시 얘기해요.' },
      native: { en: "Let's touch base early next week.", kr: '다음 주 초에 가볍게 얘기해요.' },
    },
    challenge: '결정을 재촉하지 않으면서 다음 주 초에 다시 얘기하자고 해보세요.',
  },
  'how-sound': {
    scene: '파일럿부터 시작하자는 제안을 마쳤다. 공을 상대에게 넘기는 마무리.',
    dialogue: [
      { sp: 'A', en: 'We start small with a two-week pilot.', kr: '2주 파일럿으로 작게 시작하는 거죠.' },
      { sp: 'A', en: 'How does that sound?', kr: '어떠세요?', mark: true },
      { sp: 'B', en: 'That sounds reasonable.', kr: '합리적으로 들리네요.' },
    ],
    how: '제안만 하고 침묵하면 어색하고, "OK?"는 가볍습니다. "How does that sound?"는 "당신 귀에 어떻게 들리나요"라며 공을 정중히 넘기는 원어민의 클로징 — 제안·일정·가격 어떤 마무리에도 붙습니다.',
    speak: {
      basic: { en: 'Is this plan OK for you?', kr: '이 계획 괜찮으세요?' },
      native: { en: 'We start with a two-week pilot. How does that sound?', kr: '2주 파일럿으로 시작하는 거죠. 어떠세요?' },
    },
    challenge: '파일럿 제안을 마치고 상대 의견을 청해보세요.',
  },

  /* ── 3단계 · 자연스러운 흐름 ── */
  'run-through': {
    scene: '발표 시작, 숫자를 빠르게 훑어주겠다고 예고하는 오프닝.',
    dialogue: [
      { sp: 'A', en: 'Thanks for joining, everyone.', kr: '모두 참석 감사합니다.' },
      { sp: 'A', en: 'Let me quickly run through the numbers.', kr: '수치를 빠르게 짚어 드릴게요.', mark: true },
      { sp: 'B', en: 'Go ahead.', kr: '시작하세요.' },
    ],
    how: '"I will explain the numbers"는 무겁고 깁니다. "run through"는 "달리며 통과한다" — 핵심만 빠르게 훑겠다는 예고라서 듣는 사람의 부담을 덜어줘요. 발표·데모·안건 소개의 단골 오프닝입니다.',
    speak: {
      basic: { en: 'I will explain the numbers now.', kr: '이제 수치를 설명하겠습니다.' },
      native: { en: 'Let me quickly run through the numbers.', kr: '수치를 빠르게 짚어 드릴게요.' },
    },
    challenge: '발표를 시작하며 수치를 빠르게 훑겠다고 예고해보세요.',
  },
  'go-over': {
    scene: '계약 조건을 고객과 함께 하나씩 살피고 싶다.',
    dialogue: [
      { sp: 'A', en: 'Before signing, one thing.', kr: '서명 전에 하나만요.' },
      { sp: 'A', en: 'Can we go over the contract terms together?', kr: '계약 조건을 같이 살펴볼까요?', mark: true },
      { sp: 'B', en: 'Good idea. Start with payment.', kr: '좋아요. 지불 조건부터.' },
    ],
    how: '"check"는 혼자 검사하는 느낌, "go over"는 함께 차근차근 넘겨 보는 그림이에요. 계약·견적·일정처럼 상대와 같이 봐야 하는 문서에는 go over가 협력적으로 들립니다.',
    speak: {
      basic: { en: 'Let me check the contract.', kr: '계약서를 확인해볼게요.' },
      native: { en: 'Can we go over the contract terms together?', kr: '계약 조건을 같이 살펴볼까요?' },
    },
    challenge: '서명 전에 계약 조건을 함께 살펴보자고 제안해보세요.',
  },
  'follow-up-on': {
    scene: '지난주 보낸 제안서에 답이 없다. 후속 연락의 첫 문장.',
    dialogue: [
      { sp: 'A', en: 'Hi, this is Taehyun.', kr: '안녕하세요, 태현입니다.' },
      { sp: 'A', en: "I'm following up on the proposal I sent last week.", kr: '지난주 보낸 제안서 건으로 다시 연락드려요.', mark: true },
      { sp: 'B', en: 'Ah yes, we were just discussing it.', kr: '아 네, 마침 논의 중이었어요.' },
    ],
    how: '"Did you read my proposal?"은 추궁처럼 들려요. "I\'m following up on ..."은 "후속 확인차 연락했다"는 중립 신호 — 재촉의 느낌 없이 상기시킵니다. 세일즈 이메일과 전화의 국룰 첫 문장이에요.',
    speak: {
      basic: { en: 'Did you see my proposal?', kr: '제 제안서 보셨나요?' },
      native: { en: "I'm following up on the proposal I sent last week.", kr: '지난주 보낸 제안서 건으로 다시 연락드려요.' },
    },
    challenge: '답이 없는 제안서에 대해 재촉하지 않고 후속 연락을 해보세요.',
  },
  'sort-out': {
    scene: '고객 계정에 접속 문제가 생겼다. 해결을 믿음직하게 약속하기.',
    dialogue: [
      { sp: 'B', en: 'Our team still cannot log in.', kr: '저희 팀이 아직 로그인이 안 돼요.' },
      { sp: 'A', en: "Sorry about that. We'll sort it out today.", kr: '죄송합니다. 오늘 안에 해결하겠습니다.', mark: true },
      { sp: 'B', en: 'Thanks, please keep me posted.', kr: '고마워요, 진행 상황 알려주세요.' },
    ],
    how: '"solve"는 수학 문제 푸는 느낌이라 일상 문제엔 과해요. "sort out"은 엉킨 걸 "정리해서 해결한다"는 구어 동사 — 접속 문제, 일정 꼬임, 청구 오류처럼 실무의 자잘한 문제들에 딱 맞고 믿음직하게 들립니다.',
    speak: {
      basic: { en: 'We will fix the login problem today.', kr: '로그인 문제를 오늘 고치겠습니다.' },
      native: { en: "Sorry about that — we'll sort it out today.", kr: '죄송합니다 — 오늘 안에 해결하겠습니다.' },
    },
    challenge: '접속 문제로 불편한 고객에게 오늘 안 해결을 약속해보세요.',
  },
  'put-together': {
    scene: '미팅이 잘 끝났다. 다음 스텝으로 제안서를 만들어 오겠다고 약속한다.',
    dialogue: [
      { sp: 'B', en: 'This direction looks promising.', kr: '이 방향 괜찮아 보이네요.' },
      { sp: 'A', en: "Great — I'll put together a proposal by Friday.", kr: '좋습니다 — 금요일까지 제안서를 만들어 드릴게요.', mark: true },
      { sp: 'B', en: 'Looking forward to it.', kr: '기대할게요.' },
    ],
    how: '"make a proposal"은 어딘가 밋밋해요. "put together"는 조각을 모아 "꾸려 만든다"는 그림 — 자료·팀·계획처럼 여러 요소를 조립하는 작업에 원어민이 쓰는 동사입니다. 정성이 느껴지는 약속이 돼요.',
    speak: {
      basic: { en: 'I will make a proposal by Friday.', kr: '금요일까지 제안서를 만들게요.' },
      native: { en: "I'll put together a proposal by Friday.", kr: '금요일까지 제안서를 꾸려 드릴게요.' },
    },
    challenge: '미팅을 마치며 금요일까지 제안서를 만들어 오겠다고 약속해보세요.',
  },
  'reach-out': {
    scene: '미팅을 닫으며 "언제든 연락 달라"는 문을 열어두고 싶다.',
    dialogue: [
      { sp: 'A', en: "That's everything from me.", kr: '제 쪽에서는 여기까지입니다.' },
      { sp: 'A', en: 'Feel free to reach out anytime with questions.', kr: '궁금한 점은 언제든 편하게 연락 주세요.', mark: true },
      { sp: 'B', en: 'Will do, thanks.', kr: '그럴게요, 감사합니다.' },
    ],
    how: '"Contact me"는 사무적이에요. "reach out"은 손을 뻗는 그림이라 따뜻하고, 앞에 "Feel free to"를 붙이면 문턱이 완전히 낮아집니다. 미팅·이메일 마무리에서 관계를 열어두는 원어민의 정형구예요.',
    speak: {
      basic: { en: 'Contact me if you have questions.', kr: '질문 있으면 연락 주세요.' },
      native: { en: 'Feel free to reach out anytime with questions.', kr: '궁금한 점은 언제든 편하게 연락 주세요.' },
    },
    challenge: '미팅을 닫으며 언제든 연락하라고 문을 열어두세요.',
  },
  'that-said': {
    scene: '가격이 높다는 상대 말에 동의하면서도, 방향을 틀어야 한다.',
    dialogue: [
      { sp: 'B', en: 'Your price is higher than others.', kr: '가격이 다른 곳보다 높네요.' },
      { sp: 'A', en: "You're right, it's not the cheapest.", kr: '맞아요, 가장 싸지는 않죠.' },
      { sp: 'A', en: 'That said, our support saves you real time.', kr: '그렇긴 하지만, 저희 지원이 시간을 확실히 아껴 드려요.', mark: true },
    ],
    how: '"but"으로 뒤집으면 앞의 인정이 가짜처럼 들려요. "That said"는 "그 말은 맞다, 그런데 방향을 틀면"이라는 세련된 전환 — 앞 문장을 존중한 채 내 논점으로 넘어갑니다. 반론과 협상의 필수 연결어예요.',
    speak: {
      basic: { en: 'But our support is very good.', kr: '하지만 저희 지원은 아주 좋아요.' },
      native: { en: 'That said, our support saves you real time every week.', kr: '그렇긴 하지만, 저희 지원이 매주 시간을 확실히 아껴 드려요.' },
    },
    challenge: '가격이 높다는 지적을 인정한 뒤, 지원 가치로 방향을 틀어보세요.',
  },
  'moving-forward': {
    scene: '커뮤니케이션이 꼬였던 프로젝트. 과거를 탓하지 않고 다음 방식을 정한다.',
    dialogue: [
      { sp: 'B', en: 'We missed two updates last month.', kr: '지난달 업데이트를 두 번 놓쳤어요.' },
      { sp: 'A', en: "You're right, and I'm sorry about that.", kr: '맞아요, 죄송합니다.' },
      { sp: 'A', en: "Moving forward, let's sync every Monday.", kr: '앞으로는 매주 월요일에 맞춰 가요.', mark: true },
    ],
    how: '"From now on"은 규칙을 선언하는 느낌이라 딱딱해요. "Moving forward"는 "앞으로 나아가면서"라는 그림으로 과거의 잘잘못을 접고 다음 방식에 집중하게 합니다. 사과 뒤의 재발 방지 약속에 특히 좋아요.',
    speak: {
      basic: { en: 'From now on, we will meet every Monday.', kr: '이제부터 매주 월요일에 만나요.' },
      native: { en: "Moving forward, let's sync every Monday morning.", kr: '앞으로는 매주 월요일 아침에 맞춰 가요.' },
    },
    challenge: '소통 문제를 사과한 뒤, 앞으로 매주 월요일 싱크를 제안해보세요.',
  },

  /* ── 4단계 · 관용의 층 ── */
  'circle-back': {
    scene: '데모 중에 가격 질문이 들어왔다. 지금은 미루되 반드시 돌아온다는 약속.',
    dialogue: [
      { sp: 'B', en: 'Before you continue — how much is this?', kr: '계속하기 전에 — 이거 얼마예요?' },
      { sp: 'A', en: "Great question. Let's circle back to pricing after the demo.", kr: '좋은 질문이에요. 가격은 데모 후에 다시 돌아오죠.', mark: true },
      { sp: 'B', en: 'Fair enough.', kr: '그러죠.' },
    ],
    how: '"Later"라고만 하면 회피처럼 들려요. "circle back"은 원을 그려 제자리로 돌아오는 그림 — "지금은 넘어가지만 반드시 돌아온다"는 약속이 담긴 회의 진행의 관용구입니다. 안건 순서를 지키면서 질문자를 존중하는 기술이에요.',
    speak: {
      basic: { en: 'We will talk about price later.', kr: '가격은 나중에 얘기해요.' },
      native: { en: "Let's circle back to pricing right after the demo.", kr: '가격은 데모 직후에 다시 돌아오죠.' },
    },
    challenge: '데모 중 가격 질문에, 데모 후 다시 다루겠다고 정중히 미뤄보세요.',
  },
  'touch-on': {
    scene: '시간이 빠듯한 발표. 보안 항목은 깊이 대신 "짚기만" 하겠다고 예고.',
    dialogue: [
      { sp: 'A', en: 'We have ten minutes left.', kr: '10분 남았네요.' },
      { sp: 'A', en: "I'll briefly touch on security, then wrap up.", kr: '보안을 짧게 짚고 마무리할게요.', mark: true },
      { sp: 'B', en: 'Perfect.', kr: '좋아요.' },
    ],
    how: '"talk about"은 얼마나 길어질지 모르는 말이에요. "touch on"은 손끝으로 살짝 건드리는 그림 — "깊이 안 들어가고 짚기만 한다"는 시간 신호가 들어 있어, 발표 시간 관리의 필수 관용구입니다.',
    speak: {
      basic: { en: 'I will talk about security quickly.', kr: '보안 얘기를 빨리 할게요.' },
      native: { en: "I'll briefly touch on security, then wrap up.", kr: '보안을 짧게 짚고 마무리할게요.' },
    },
    challenge: '남은 10분 동안 보안을 짧게만 짚겠다고 예고해보세요.',
  },
  'same-page': {
    scene: '긴 논의 끝, 서로 같은 결론을 이해했는지 확인하고 싶다.',
    dialogue: [
      { sp: 'A', en: 'Before we finish —', kr: '끝내기 전에 —' },
      { sp: 'A', en: "I want to make sure we're on the same page about the scope.", kr: '범위에 대해 같은 그림을 보고 있는지 확인하고 싶어요.', mark: true },
      { sp: 'B', en: 'Good call. So, phase one is API only, right?', kr: '잘했어요. 그러니까 1단계는 API만이죠?' },
    ],
    how: '"Do you understand?"는 상대를 시험하는 말투예요. "on the same page"는 "같은 페이지를 펴고 있나"라는 그림으로, 이해의 어긋남을 서로의 문제로 만들어 확인이 예의가 됩니다. 범위·일정·역할 합의 확인의 관용구예요.',
    speak: {
      basic: { en: 'Do we agree about the scope?', kr: '범위에 대해 동의하나요?' },
      native: { en: "I want to make sure we're on the same page about the scope.", kr: '범위에 대해 같은 그림을 보고 있는지 확인하고 싶어요.' },
    },
    challenge: '미팅을 닫기 전, 범위에 대한 이해가 일치하는지 확인해보세요.',
  },
  'ballpark': {
    scene: '아직 요구사항이 확정 전이지만 대략의 예산 감을 잡고 싶다.',
    dialogue: [
      { sp: 'A', en: 'I know the specs are not final yet.', kr: '사양이 아직 확정 전인 건 알아요.' },
      { sp: 'A', en: 'But could you give me a ballpark figure?', kr: '그래도 대략적인 금액을 알 수 있을까요?', mark: true },
      { sp: 'B', en: 'Roughly fifty to seventy thousand.', kr: '대략 5만에서 7만 정도요.' },
    ],
    how: '정확한 견적을 요구하면 상대가 방어적이 돼요. "ballpark figure"는 야구장 크기 정도의 "대략 범위"라는 뜻 — "정확 안 해도 된다"는 신호가 내장돼 있어 상대가 편하게 숫자를 꺼냅니다. 예산 탐색의 관용구예요.',
    speak: {
      basic: { en: 'How much will it cost, roughly?', kr: '대략 얼마나 들까요?' },
      native: { en: 'Could you give me a ballpark figure?', kr: '대략적인 금액이라도 알 수 있을까요?' },
    },
    challenge: '확정 전이지만 대략의 금액을 부담 없이 물어보세요.',
  },
  'move-needle': {
    scene: '여러 기능 중 진짜 성과를 바꿀 한 가지를 강조하고 싶다.',
    dialogue: [
      { sp: 'B', en: 'Which feature matters most?', kr: '어떤 기능이 제일 중요해요?' },
      { sp: 'A', en: 'Auto-scaling. That one could really move the needle on costs.', kr: '오토스케일링이요. 그게 비용 지표를 실제로 움직일 수 있어요.', mark: true },
      { sp: 'B', en: 'Show me the numbers.', kr: '수치를 보여줘요.' },
    ],
    how: '"very important"는 모두가 쓰는 말이라 힘이 없어요. "move the needle"은 계기판 바늘을 움직인다는 그림 — "측정 가능한 변화를 만든다"는 뜻이라 임팩트 주장에 무게가 실립니다. 성과·지표 논의의 관용구예요.',
    speak: {
      basic: { en: 'This feature is very important for costs.', kr: '이 기능이 비용에 아주 중요해요.' },
      native: { en: 'This one could really move the needle on costs.', kr: '이게 비용 지표를 실제로 움직일 수 있어요.' },
    },
    challenge: '오토스케일링이 비용을 실제로 바꿀 기능이라고 강조해보세요.',
  },
  'low-hanging': {
    scene: '할 일이 산더미. 쉬운 것부터 시작하자고 우선순위를 잡는다.',
    dialogue: [
      { sp: 'B', en: 'The migration list is huge. Where do we start?', kr: '이전 목록이 어마어마한데, 어디서 시작하죠?' },
      { sp: 'A', en: "Let's start with the low-hanging fruit — the static sites.", kr: '쉽게 딸 수 있는 것부터 하죠 — 정적 사이트요.', mark: true },
      { sp: 'B', en: 'Makes sense.', kr: '말이 되네요.' },
    ],
    how: '"easy things first"는 밋밋해요. "low-hanging fruit"은 낮게 달린 과일부터 딴다는 그림 — 적은 노력으로 빠른 성과가 나는 항목이라는 뜻이 그대로 전해집니다. 우선순위 회의의 단골 관용구예요.',
    speak: {
      basic: { en: "Let's do the easy things first.", kr: '쉬운 것부터 하죠.' },
      native: { en: "Let's start with the low-hanging fruit.", kr: '쉽게 딸 수 있는 것부터 시작하죠.' },
    },
    challenge: '방대한 작업 목록 앞에서, 쉬운 것부터 시작하자고 제안해보세요.',
  },
  'ball-rolling': {
    scene: '논의만 길어지는 프로젝트. 일단 시작하자고 시동을 건다.',
    dialogue: [
      { sp: 'B', en: 'We keep discussing but nothing starts.', kr: '논의만 하고 시작을 못 하네요.' },
      { sp: 'A', en: "Let's get the ball rolling with a kickoff call this week.", kr: '이번 주 킥오프 콜로 일단 시작해 보죠.', mark: true },
      { sp: 'B', en: "Agreed. I'll send invites.", kr: '동의해요. 초대장 보낼게요.' },
    ],
    how: '"Let\'s start"는 명령처럼 들릴 수 있어요. "get the ball rolling"은 공을 굴리기 시작한다는 그림 — 완벽한 준비 대신 "작게라도 굴리자"는 뉘앙스가 시작의 부담을 낮춥니다. 지지부진한 논의를 깨는 관용구예요.',
    speak: {
      basic: { en: "Let's start with a kickoff call.", kr: '킥오프 콜로 시작하죠.' },
      native: { en: "Let's get the ball rolling with a kickoff call this week.", kr: '이번 주 킥오프 콜로 일단 굴려 보죠.' },
    },
    challenge: '논의만 길어지는 상황에서 킥오프 콜로 시작하자고 시동을 걸어보세요.',
  },
  'in-the-loop': {
    scene: '배포가 진행되는 동안 고객이 소외감을 느끼지 않게 하고 싶다.',
    dialogue: [
      { sp: 'B', en: 'How will I know the progress?', kr: '진행 상황은 어떻게 알 수 있죠?' },
      { sp: 'A', en: "I'll keep you in the loop with a short update every Friday.", kr: '매주 금요일 짧은 업데이트로 계속 공유드릴게요.', mark: true },
      { sp: 'B', en: 'Perfect, thank you.', kr: '완벽해요, 감사합니다.' },
    ],
    how: '"I will report to you"는 상하관계처럼 들려요. "keep you in the loop"은 정보가 도는 원(loop) 안에 상대를 계속 둔다는 그림 — "당신을 빼놓지 않겠다"는 존중이 담긴 약속입니다. 신뢰를 만드는 소통의 관용구예요.',
    speak: {
      basic: { en: 'I will send you updates every week.', kr: '매주 업데이트를 보내드릴게요.' },
      native: { en: "I'll keep you in the loop with a short update every Friday.", kr: '매주 금요일 짧은 업데이트로 계속 공유드릴게요.' },
    },
    challenge: '진행 상황을 궁금해하는 고객에게 매주 공유를 약속해보세요.',
  },

  /* ── 5단계 · 원어민의 결 ── */
  'i-hear-you': {
    scene: '일정 단축 요구에 반대해야 한다. 상대의 말을 먼저 받아주는 기술.',
    dialogue: [
      { sp: 'B', en: 'We really need this done in one month.', kr: '정말 한 달 안에 끝나야 해요.' },
      { sp: 'A', en: 'I hear you, but rushing it risks the data migration.', kr: '말씀 이해해요, 다만 서두르면 데이터 이전이 위험해져요.', mark: true },
      { sp: 'A', en: 'Six weeks protects your data.', kr: '6주면 데이터를 지킬 수 있어요.' },
    ],
    how: '반론을 "But"으로 시작하면 상대는 방어부터 해요. "I hear you"는 "당신 말이 내게 닿았다"를 먼저 선언하는 원어민의 무장해제 기술 — 그 다음의 but은 공격이 아니라 관점 추가로 들립니다.',
    speak: {
      basic: { en: 'I understand, but one month is too short.', kr: '이해해요, 하지만 한 달은 너무 짧아요.' },
      native: { en: 'I hear you, but rushing it risks the data migration.', kr: '말씀 이해해요, 다만 서두르면 데이터 이전이 위험해져요.' },
    },
    challenge: '한 달 요구를 받아주면서, 서두르면 위험하다고 반론해보세요.',
  },
  'to-be-fair': {
    scene: '경쟁사 제안을 깎아내리고 싶은 유혹 — 대신 균형 잡힌 평가로 신뢰를 얻는다.',
    dialogue: [
      { sp: 'B', en: 'Competitor X offered a lower price.', kr: 'X사가 더 낮은 가격을 제시했어요.' },
      { sp: 'A', en: 'To be fair, their offer has some merit on price.', kr: '공정하게 보면, 가격 면에서는 그쪽 제안도 일리가 있어요.', mark: true },
      { sp: 'A', en: 'The difference is what happens after launch.', kr: '차이는 출시 이후에 갈립니다.' },
    ],
    how: '경쟁자를 무조건 깎아내리면 내 말 전체가 의심받아요. "To be fair"는 반대편의 몫을 먼저 인정하는 신호 — 그 균형감이 이어지는 내 주장에 신뢰를 실어줍니다. 원어민의 성숙한 논의 습관이에요.',
    speak: {
      basic: { en: 'Their price is lower, but our service is better.', kr: '그쪽 가격이 낮지만 저희 서비스가 낫습니다.' },
      native: { en: 'To be fair, their offer has some merit — the difference is after launch.', kr: '공정하게 보면 그쪽도 일리가 있어요 — 차이는 출시 이후입니다.' },
    },
    challenge: '경쟁사 가격을 인정하면서도 출시 이후의 차이를 말해보세요.',
  },
  'wouldnt-say': {
    scene: '문제가 있냐는 질문 — 아니라고 딱 잘라 말하기도, 그렇다고 하기도 애매할 때.',
    dialogue: [
      { sp: 'B', en: 'Is the delay a serious problem?', kr: '지연이 심각한 문제인가요?' },
      { sp: 'A', en: "I wouldn't say it's a dealbreaker.", kr: '결정적인 문제라고까지는 안 하겠어요.', mark: true },
      { sp: 'A', en: 'But we should watch it closely.', kr: '다만 예의주시는 해야죠.' },
    ],
    how: '"No"는 너무 단호하고 "Yes"는 과장이 될 때, 원어민은 "I wouldn\'t say ..."로 부정의 강도를 조절해요 — "그렇게까지는 말하지 않겠다"는 한 겹의 완곡이 정확한 온도를 만듭니다. 평가 질문에 대한 세련된 답변 틀이에요.',
    speak: {
      basic: { en: 'It is not a big problem.', kr: '큰 문제는 아니에요.' },
      native: { en: "I wouldn't say it's a dealbreaker, but we should watch it.", kr: '결정적 문제라곤 안 하겠지만, 예의주시는 해야죠.' },
    },
    challenge: '지연이 심각하냐는 질문에 강도를 조절해 답해보세요.',
  },
  'worth-ing': {
    scene: '범위를 다시 논의하자고 밀어붙이지 않고 끌어당기는 제안.',
    dialogue: [
      { sp: 'B', en: 'The project feels too big now.', kr: '프로젝트가 이제 너무 커진 느낌이에요.' },
      { sp: 'A', en: 'It might be worth revisiting the scope together.', kr: '범위를 같이 다시 들여다볼 가치가 있을 것 같아요.', mark: true },
      { sp: 'B', en: "Yes, let's do that Thursday.", kr: '네, 목요일에 하죠.' },
    ],
    how: '"We should ..."는 밀어붙이는 제안이에요. "It might be worth -ing"는 "해볼 가치가 있을지도"라며 판단을 상대에게 남기는 끌어당김 — 제안이 명령이 아니라 초대가 됩니다. might의 불확실함이 오히려 세련됨이에요.',
    speak: {
      basic: { en: 'We should discuss the scope again.', kr: '범위를 다시 논의해야 해요.' },
      native: { en: 'It might be worth revisiting the scope together.', kr: '범위를 같이 다시 들여다볼 가치가 있을 것 같아요.' },
    },
    challenge: '커져버린 프로젝트의 범위 재논의를 부드럽게 제안해보세요.',
  },
  'being-honest': {
    scene: '기대보다 나쁜 조건을 받았다. 솔직함을 예의로 감싸 말하는 법.',
    dialogue: [
      { sp: 'B', en: 'What do you think of our renewal offer?', kr: '저희 갱신 제안 어떠세요?' },
      { sp: 'A', en: "If I'm being honest, we expected a better rate.", kr: '솔직히 말씀드리면, 더 나은 조건을 기대했어요.', mark: true },
      { sp: 'B', en: 'I see. Let me talk to my manager.', kr: '알겠어요. 매니저와 얘기해볼게요.' },
    ],
    how: '불만을 그냥 던지면 공격이 돼요. "If I\'m being honest"는 "지금부터 솔직해지겠다"는 예고편 — 듣는 사람이 마음의 자세를 갖추게 해, 같은 직설도 존중으로 감싸입니다. 협상에서 진짜 속마음을 꺼낼 때의 관용 프레임이에요.',
    speak: {
      basic: { en: 'Honestly, we wanted a better price.', kr: '솔직히 더 나은 가격을 원했어요.' },
      native: { en: "If I'm being honest, we expected a better rate this year.", kr: '솔직히 말씀드리면, 올해는 더 나은 조건을 기대했어요.' },
    },
    challenge: '갱신 제안이 기대 이하라고 솔직하되 정중하게 말해보세요.',
  },
  'fair-point': {
    scene: '상대의 반론이 사실 맞다. 우아하게 인정하고 논의를 이어가는 법.',
    dialogue: [
      { sp: 'B', en: 'Your timeline ignores our internal audit week.', kr: '그 일정은 저희 내부 감사 주간을 놓쳤어요.' },
      { sp: 'A', en: "That's a fair point — let me rework the schedule.", kr: '좋은 지적이에요 — 일정을 다시 짜볼게요.', mark: true },
      { sp: 'B', en: 'Thanks for being flexible.', kr: '유연하게 봐줘서 고마워요.' },
    ],
    how: '지적을 받으면 변명부터 나오기 쉬워요. "That\'s a fair point"는 반론의 정당함을 한 문장으로 인정하는 원어민의 품격 — 논쟁을 승패에서 협력으로 바꿉니다. 인정 뒤에 행동(rework, adjust)을 붙이면 완성이에요.',
    speak: {
      basic: { en: 'You are right. I will change the schedule.', kr: '맞아요. 일정을 바꿀게요.' },
      native: { en: "That's a fair point — let me rework the schedule.", kr: '좋은 지적이에요 — 일정을 다시 짜볼게요.' },
    },
    challenge: '일정의 허점을 지적받았습니다. 우아하게 인정하고 수정을 약속해보세요.',
  },
  'where-land': {
    scene: '갱신 조건 논의가 길어졌다. 결론이 어디에 착지했는지 묻고 싶다.',
    dialogue: [
      { sp: 'A', en: "We've discussed a lot today.", kr: '오늘 많은 걸 논의했네요.' },
      { sp: 'A', en: 'So where do we land on the renewal terms?', kr: '그래서 갱신 조건은 어디로 정리됐죠?', mark: true },
      { sp: 'B', en: 'Two years, with the current rate.', kr: '2년, 현재 요율로요.' },
    ],
    how: '"What is your decision?"은 압박 면접 같아요. "Where do we land?"는 비행기가 착지하는 그림 — "우리의 논의가 어디에 내려앉나"라며 결정을 공동의 것으로 만듭니다. 긴 논의를 결론으로 모으는 원어민의 마무리 화법이에요.',
    speak: {
      basic: { en: 'So what is our final decision?', kr: '그래서 최종 결정이 뭐죠?' },
      native: { en: 'So where do we land on the renewal terms?', kr: '그래서 갱신 조건은 어디로 정리됐죠?' },
    },
    challenge: '긴 논의 끝에 갱신 조건의 결론을 물어보세요.',
  },
  'happy-to': {
    scene: '고객 팀에게 설정 과정을 안내해주겠다고 — 의무가 아니라 호의로 들리게.',
    dialogue: [
      { sp: 'B', en: 'Our team might need help with the setup.', kr: '저희 팀이 설정에 도움이 필요할 것 같아요.' },
      { sp: 'A', en: 'Happy to walk your team through it next week.', kr: '다음 주에 기꺼이 팀에 안내해 드릴게요.', mark: true },
      { sp: 'B', en: 'That would be great.', kr: '그럼 정말 좋죠.' },
    ],
    how: '"I can help"는 능력의 진술이고, "Happy to"는 마음의 진술이에요 — 같은 도움도 "기꺼이"가 붙으면 호의가 됩니다. 원어민은 부탁을 수락할 때 습관처럼 "Happy to"로 시작해요. 뒤에 동사원형만 붙이면 됩니다.',
    speak: {
      basic: { en: 'I can help your team with the setup.', kr: '팀의 설정을 도와드릴 수 있어요.' },
      native: { en: 'Happy to walk your team through the setup next week.', kr: '다음 주에 기꺼이 팀에 설정 과정을 안내해 드릴게요.' },
    },
    challenge: '도움이 필요하다는 고객에게 기꺼이 안내하겠다고 답해보세요.',
  },
};
