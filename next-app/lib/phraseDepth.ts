'use client';

/**
 * 표현 딥카드 — "영어 한 줄 + 뜻 한 줄"로 3초에 소비되던 표현에 6층 깊이를 준다:
 * 뉘앙스·격식도 / 변형 3종(부드럽게↔강하게) / 한국인 흔한 실수 / 상대의 예상 응답 /
 * 미니 체크. 대표 미션 3종(미팅 오프닝·이견 대응·가격 협상)의 15개 표현은 정성
 * 큐레이션했고, 나머지 표현은 열 때 AI가 같은 스키마로 생성해 캐시한다.
 */
import { groqComplete } from './groq';
import { load, store } from './state';

export interface DepthVariation {
  /** 부드럽게 · 중립 · 강하게 */
  tone: string;
  en: string;
  kr: string;
}

export interface PhraseDepth {
  /** 뉘앙스와 쓰는 상황(한국어 2~3문장) */
  nuance: string;
  /** 격식도 1(캐주얼)~3(포멀) */
  register: 1 | 2 | 3;
  variations: DepthVariation[];
  mistake: { wrong: string; right: string; why: string };
  /** 상대가 이렇게 받아칠 수 있고 → 나는 이렇게 잇는다 */
  reply: { en: string; kr: string; mine: string; mineKr: string };
  check: { q: string; options: string[]; a: number };
}

/* ── 정성 큐레이션 15카드 (미팅 오프닝 · 이견 대응 · 가격 협상) ── */
export const STATIC_DEPTH: Record<string, PhraseDepth> = {
  'Thanks for making the time today.': {
    nuance:
      '단순한 "고맙다"가 아니라 "바쁜 중에 시간을 내줬다"는 걸 인정하는 오프닝. 미팅 첫 10초에 쓰면 상대를 존중한다는 신호가 되고, 분위기가 부드럽게 시작됩니다.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: 'Thanks so much for squeezing this in.', kr: '바쁜 일정에 끼워 넣어 주셔서 정말 감사해요.' },
      { tone: '중립', en: 'Thanks for making the time today.', kr: '오늘 시간 내주셔서 감사합니다.' },
      { tone: '포멀', en: 'I appreciate you taking the time to meet with us.', kr: '저희와의 미팅에 시간을 내주셔서 감사드립니다.' },
    ],
    mistake: {
      wrong: 'Thank you for your time today. (미팅 시작에)',
      right: 'Thanks for making the time today.',
      why: '"Thank you for your time"은 주로 미팅을 끝낼 때 쓰는 마무리 인사예요. 시작할 때 쓰면 벌써 끝내려는 느낌을 줄 수 있습니다.',
    },
    reply: {
      en: 'Of course, happy to connect.',
      kr: '물론이죠, 이야기 나누게 되어 반가워요.',
      mine: "Likewise. Shall we get started?",
      mineKr: '저도요. 그럼 시작해 볼까요?',
    },
    check: {
      q: '"Thanks for making the time"이 가장 어울리는 순간은?',
      options: ['미팅을 마무리할 때', '미팅을 시작할 때', '이메일 서명에'],
      a: 1,
    },
  },
  'Before we dive in, how has your week been?': {
    nuance:
      '"dive in(본론으로 들어가다)" 앞에 안부를 끼워 넣는 전형적인 스몰토크 브리지. 서양 비즈니스 미팅은 보통 2~3분의 가벼운 대화로 시작하는데, 이 문장이 그 문을 열어줍니다.',
    register: 1,
    variations: [
      { tone: '부드럽게', en: "How's everything going on your end?", kr: '그쪽은 요즘 어떻게 지내세요?' },
      { tone: '중립', en: 'Before we dive in, how has your week been?', kr: '본론 전에, 이번 주는 어떠셨어요?' },
      { tone: '포멀', en: 'Before we begin, I hope things have been going well for you.', kr: '시작하기 전에, 요즘 잘 지내고 계시길 바랍니다.' },
    ],
    mistake: {
      wrong: "Let's start. (인사 없이 바로)",
      right: 'Before we dive in, how has your week been?',
      why: '한국식으로 바로 본론에 들어가면 서양 파트너에겐 차갑게 느껴질 수 있어요. 1~2분의 스몰토크가 신뢰의 윤활유입니다.',
    },
    reply: {
      en: "Pretty hectic, actually — we're wrapping up the quarter.",
      kr: '사실 꽤 정신없어요 — 분기 마감 중이라서요.',
      mine: 'I hear you. Well, I promise to keep this one efficient!',
      mineKr: '이해합니다. 그럼 오늘 미팅은 효율적으로 진행할게요!',
    },
    check: {
      q: '"dive in"의 뜻에 가장 가까운 것은?',
      options: ['수영하러 가다', '본론으로 들어가다', '회의를 끝내다'],
      a: 1,
    },
  },
  "Let me quickly walk you through today's agenda.": {
    nuance:
      '"walk you through"는 상대를 데리고 차근차근 안내한다는 뉘앙스 — 일방적인 발표(present)보다 훨씬 협력적으로 들립니다. 아젠다·데모·문서 설명 어디에나 쓰는 만능 동사구예요.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: "Here's what I was hoping we could cover today.", kr: '오늘 이런 것들을 다뤄보면 어떨까 해요.' },
      { tone: '중립', en: "Let me quickly walk you through today's agenda.", kr: '오늘 아젠다를 간단히 안내해 드릴게요.' },
      { tone: '포멀', en: "I'd like to outline the agenda before we proceed.", kr: '진행에 앞서 아젠다를 정리해 드리겠습니다.' },
    ],
    mistake: {
      wrong: "I will explain today's agenda.",
      right: "Let me walk you through today's agenda.",
      why: '"explain"은 틀리진 않지만 선생님이 학생에게 설명하는 느낌이에요. "walk you through"가 동료 간의 협력적인 톤입니다.',
    },
    reply: {
      en: 'Sounds good — go ahead.',
      kr: '좋아요 — 진행하세요.',
      mine: "Great. First, a quick status update, then we'll talk next steps.",
      mineKr: '좋습니다. 먼저 진행 상황 업데이트, 그다음 다음 단계를 이야기하죠.',
    },
    check: {
      q: '"walk you through"가 주는 느낌은?',
      options: ['일방적으로 발표한다', '차근차근 함께 살펴본다', '빨리 끝내겠다'],
      a: 1,
    },
  },
  'Feel free to jump in anytime if you have questions.': {
    nuance:
      '"jump in"은 대화에 끼어드는 것 — 이 문장은 "끼어들어도 무례가 아니다"라고 미리 허락하는 장치입니다. 발표 앞에 이 말을 깔아두면 청중 질문이 실제로 늘고, 미팅이 대화형이 됩니다.',
    register: 1,
    variations: [
      { tone: '부드럽게', en: "Don't hesitate to stop me if anything is unclear.", kr: '불분명한 게 있으면 주저 말고 멈춰 주세요.' },
      { tone: '중립', en: 'Feel free to jump in anytime if you have questions.', kr: '질문 있으시면 언제든 편하게 끼어드세요.' },
      { tone: '포멀', en: 'Please feel free to interrupt at any point with questions.', kr: '질문이 있으시면 언제든 말씀해 주시기 바랍니다.' },
    ],
    mistake: {
      wrong: 'You can ask questions later.',
      right: 'Feel free to jump in anytime.',
      why: '"질문은 나중에"는 청중을 수동적으로 만들어요. 글로벌 미팅에선 중간 질문을 환영하는 게 표준 매너입니다.',
    },
    reply: {
      en: 'Actually, quick question — does this include the mobile app?',
      kr: '마침 질문이요 — 여기 모바일 앱도 포함되나요?',
      mine: "Great question. Yes, and I'll show you exactly how in a moment.",
      mineKr: '좋은 질문이에요. 네, 곧 정확히 보여드릴게요.',
    },
    check: {
      q: '"jump in"이 여기서 뜻하는 것은?',
      options: ['뛰어오르다', '대화에 끼어들다', '회의실에 들어오다'],
      a: 1,
    },
  },
  'Does that work for you?': {
    nuance:
      '제안을 던진 뒤 상대의 동의를 확인하는 마무리 질문. "Is it OK?"보다 훨씬 자연스럽고, 일정·계획·조건 어디에나 붙일 수 있는 만능 확인 표현입니다.',
    register: 1,
    variations: [
      { tone: '부드럽게', en: 'How does that sound?', kr: '어떻게 들리세요? / 괜찮을까요?' },
      { tone: '중립', en: 'Does that work for you?', kr: '그렇게 진행해도 괜찮으실까요?' },
      { tone: '포멀', en: 'Would that be acceptable from your side?', kr: '그쪽 입장에서도 수용 가능하실까요?' },
    ],
    mistake: {
      wrong: 'Is it OK for you?',
      right: 'Does that work for you?',
      why: '"Is it OK?"도 통하지만 살짝 어린 말투예요. 비즈니스에선 "work for you"가 표준이고, 일정 조율의 시그니처 표현입니다.',
    },
    reply: {
      en: "Tuesday's a bit tight — could we do Wednesday instead?",
      kr: '화요일은 좀 빠듯해요 — 수요일로 할 수 있을까요?',
      mine: 'Wednesday works perfectly. I\'ll send an updated invite.',
      mineKr: '수요일 좋습니다. 초대 일정 수정해서 보낼게요.',
    },
    check: {
      q: '"Does that work for you?"를 쓰기 가장 좋은 순간은?',
      options: ['제안이나 일정을 확인할 때', '문제를 지적할 때', '회의를 시작할 때'],
      a: 0,
    },
  },

  "That's a fair point.": {
    nuance:
      '반대 의견을 "일리 있다"고 먼저 인정하는 한 마디. 방어부터 하면 논쟁이 되지만, 이 말로 시작하면 대화가 됩니다. 동의한다는 뜻이 아니라 "듣고 있고, 존중한다"는 신호예요.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: 'I totally get where you\'re coming from.', kr: '어떤 마음에서 하시는 말씀인지 충분히 알겠어요.' },
      { tone: '중립', en: "That's a fair point.", kr: '일리 있는 말씀이에요.' },
      { tone: '강하게', en: "You raise a valid concern, and it deserves a straight answer.", kr: '타당한 우려를 제기하셨고, 정직한 답변을 드릴게요.' },
    ],
    mistake: {
      wrong: 'No, that\'s not a problem.',
      right: "That's a fair point. Let me address it.",
      why: '상대 우려를 바로 부정하면("문제 없어요") 방어적으로 들리고 신뢰를 깎아요. 인정 → 대응 순서가 설득의 기본기입니다.',
    },
    reply: {
      en: "I'm glad you see it that way. So how do you plan to handle it?",
      kr: '그렇게 봐주시니 다행이네요. 그래서 어떻게 해결하실 건가요?',
      mine: "Here's what we've done for customers in the same situation.",
      mineKr: '같은 상황의 고객들에게 저희가 해온 방법을 말씀드릴게요.',
    },
    check: {
      q: '"That\'s a fair point"의 진짜 기능은?',
      options: ['전적으로 동의한다는 뜻', '상대 의견을 존중한다는 신호', '화제를 돌리는 말'],
      a: 1,
    },
  },
  'I understand the concern. Let me address that.': {
    nuance:
      '"address"는 문제를 정면으로 다룬다는 동사 — 회피하지 않고 답하겠다는 자신감을 보여줍니다. 우려 인정(understand) + 정면 대응(address)이 한 문장에 담긴 이견 대응의 정석 콤보.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: 'I hear you — let me try to put that worry to rest.', kr: '이해해요 — 그 걱정을 덜어드려 볼게요.' },
      { tone: '중립', en: 'I understand the concern. Let me address that.', kr: '우려 이해합니다. 그 부분 말씀드릴게요.' },
      { tone: '강하게', en: "That concern is exactly why we designed it this way.", kr: '바로 그 우려 때문에 저희가 이렇게 설계한 겁니다.' },
    ],
    mistake: {
      wrong: "Don't worry about that.",
      right: 'I understand the concern. Let me address that.',
      why: '"걱정 마세요"는 상대의 우려를 가볍게 취급하는 느낌이에요. 우려를 인정한 뒤 근거로 답하는 것이 프로의 대응입니다.',
    },
    reply: {
      en: 'OK, go ahead — convince me.',
      kr: '좋아요, 말씀해 보세요 — 설득해 주세요.',
      mine: 'Three of our banking clients had the same worry. Here\'s what happened.',
      mineKr: '은행권 고객 세 곳이 같은 걱정을 했어요. 결과를 말씀드리죠.',
    },
    check: {
      q: '"address a concern"의 뜻은?',
      options: ['우려를 무시하다', '우려를 정면으로 다루다', '우려를 기록해 두다'],
      a: 1,
    },
  },
  'A lot of our customers felt the same way at first.': {
    nuance:
      '사회적 증거(social proof)로 우려를 녹이는 표현. "당신만 그런 게 아니고, 같은 걱정을 했던 사람들이 지금은 만족한다"는 스토리의 도입부입니다. "at first"가 핵심 — 처음엔 그랬지만 지금은 다르다는 반전을 예고해요.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: "You're definitely not alone in thinking that.", kr: '그렇게 생각하시는 게 절대 이상한 게 아니에요.' },
      { tone: '중립', en: 'A lot of our customers felt the same way at first.', kr: '많은 고객분들이 처음엔 같은 생각을 하셨어요.' },
      { tone: '강하게', en: 'Every single customer who raised that concern is still with us today.', kr: '그 우려를 제기했던 고객 전원이 지금도 저희와 함께합니다.' },
    ],
    mistake: {
      wrong: 'Other companies also use our product. (막연하게)',
      right: 'A lot of our customers felt the same way at first — until they ran a pilot.',
      why: '막연한 "남들도 써요"는 힘이 없어요. "같은 우려 → 전환의 계기"까지 이어져야 사회적 증거가 설득이 됩니다.',
    },
    reply: {
      en: 'Really? And what changed their mind?',
      kr: '그래요? 그래서 뭐가 그들의 마음을 바꿨나요?',
      mine: 'Seeing the first month of results. Numbers did the talking.',
      mineKr: '첫 달 결과를 본 거죠. 숫자가 말해줬어요.',
    },
    check: {
      q: '이 표현에서 "at first"가 하는 역할은?',
      options: ['우선순위를 말한다', '"지금은 다르다"는 반전을 예고한다', '처음 만난 사이임을 밝힌다'],
      a: 1,
    },
  },
  "Can I ask what's driving that concern?": {
    nuance:
      '반대에 부딪혔을 때 방어 대신 질문으로 전환하는 고급 기술. "drive"는 그 우려를 만들어내는 근본 원인 — 표면의 반대("비싸요") 뒤의 진짜 이유(예산 주기? 과거의 실패?)를 캐내야 진짜 대응이 가능합니다.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: 'Could you tell me a bit more about that worry?', kr: '그 걱정에 대해 조금 더 말씀해 주실 수 있을까요?' },
      { tone: '중립', en: "Can I ask what's driving that concern?", kr: '어떤 점 때문에 그런 우려가 생기는지 여쭤도 될까요?' },
      { tone: '강하게', en: "What would need to be true for this to feel safe to you?", kr: '어떤 조건이 갖춰지면 안심이 되실까요?',},
    ],
    mistake: {
      wrong: 'Why do you think so? (단도직입)',
      right: "Can I ask what's driving that concern?",
      why: '"Why?"만 던지면 심문처럼 들려요. "Can I ask ~"로 허락을 구하는 형태가 같은 질문을 훨씬 부드럽게 만듭니다.',
    },
    reply: {
      en: 'Honestly, we got burned by a similar tool two years ago.',
      kr: '솔직히 2년 전에 비슷한 툴로 크게 데인 적이 있어요.',
      mine: 'That context helps a lot. Let me show you what\'s different this time.',
      mineKr: '그 맥락을 알려주셔서 도움이 돼요. 이번엔 뭐가 다른지 보여드릴게요.',
    },
    check: {
      q: '"what\'s driving that concern"에서 driving의 뜻은?',
      options: ['운전하는', '~을 유발하는', '몰아내는'],
      a: 1,
    },
  },
  'Would it help if we ran a small pilot first?': {
    nuance:
      '큰 결정을 못 내리는 상대에게 작은 첫걸음을 제안해 교착을 푸는 표현. "Would it help if ~"는 강요가 아니라 상대를 돕는 프레임이라, 거절당해도 관계가 상하지 않습니다.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: 'What if we just dipped a toe in with a small trial?', kr: '작은 시험 도입으로 살짝 발만 담가보면 어떨까요?' },
      { tone: '중립', en: 'Would it help if we ran a small pilot first?', kr: '먼저 작게 파일럿을 해보면 도움이 될까요?' },
      { tone: '강하게', en: "Let's de-risk this: a 4-week pilot, one team, clear success metrics.", kr: '리스크를 없애죠: 4주 파일럿, 한 팀, 명확한 성공 지표로요.' },
    ],
    mistake: {
      wrong: 'You should try a pilot.',
      right: 'Would it help if we ran a small pilot?',
      why: '"You should"는 지시조라 저항을 부릅니다. 같은 제안도 "도움이 될까요?" 프레임이면 상대가 자기 결정처럼 느껴요.',
    },
    reply: {
      en: 'A pilot could work. What would that look like?',
      kr: '파일럿이라면 가능할 것 같네요. 어떤 식으로 진행되나요?',
      mine: 'Four weeks, one team, and we define success metrics together up front.',
      mineKr: '4주간 한 팀으로, 성공 지표는 시작 전에 함께 정합니다.',
    },
    check: {
      q: '파일럿 제안이 교착 상태를 푸는 이유는?',
      options: ['가격을 깎아주기 때문', '결정의 크기를 줄여주기 때문', '계약을 강제하기 때문'],
      a: 1,
    },
  },

  'Let me break down the pricing for you.': {
    nuance:
      '"break down"은 덩어리를 항목별로 쪼개 보여준다는 뜻. 가격 저항의 절반은 "왜 이 가격인지 모르겠다"에서 오는데, 구조를 투명하게 쪼개 보여주는 순간 협상 톤이 차분해집니다.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: "Let me show you exactly what's included.", kr: '정확히 뭐가 포함돼 있는지 보여드릴게요.' },
      { tone: '중립', en: 'Let me break down the pricing for you.', kr: '가격 구성을 하나씩 설명해 드릴게요.' },
      { tone: '포멀', en: "I'll take you through the cost structure line by line.", kr: '비용 구조를 항목별로 하나씩 짚어드리겠습니다.' },
    ],
    mistake: {
      wrong: 'The price is the price. (구성 설명 없이)',
      right: 'Let me break down the pricing for you.',
      why: '총액만 던지면 비싸게만 느껴져요. 항목을 쪼개 보여주면 어디를 조정할 수 있는지 대화의 실마리도 생깁니다.',
    },
    reply: {
      en: 'Please do — the total felt steep at first glance.',
      kr: '그래 주세요 — 첫눈에 총액이 좀 세 보였어요.',
      mine: "Totally understandable. You'll see about 40% of it is one-time setup.",
      mineKr: '충분히 그럴 수 있어요. 보시면 40% 정도는 일회성 구축 비용입니다.',
    },
    check: {
      q: '"break down the pricing"의 뜻은?',
      options: ['가격을 인하하다', '가격 구성을 항목별로 설명하다', '가격 협상을 결렬시키다'],
      a: 1,
    },
  },
  'This option gives you the best value for your scale.': {
    nuance:
      '"cheap(싸다)"이 아니라 "value(가치)"로 말하는 게 세일즈 영어의 핵심. "for your scale(지금 규모에는)"을 붙이면 일반론이 아니라 상대 맞춤 제안이 됩니다.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: 'For where you are right now, this plan makes the most sense.', kr: '지금 상황에는 이 플랜이 가장 합리적이에요.' },
      { tone: '중립', en: 'This option gives you the best value for your scale.', kr: '이 옵션이 지금 규모에는 가장 가치가 좋습니다.' },
      { tone: '강하게', en: 'Dollar for dollar, nothing else on the market comes close at your scale.', kr: '비용 대비로 보면, 이 규모에서 이만한 선택지는 시장에 없습니다.' },
    ],
    mistake: {
      wrong: 'This is very cheap.',
      right: 'This gives you the best value.',
      why: '"cheap"은 품질도 싸구려라는 인상을 줍니다. 가격 이야기는 언제나 value(얻는 가치) 프레임으로 하세요.',
    },
    reply: {
      en: 'How does it compare to the enterprise tier?',
      kr: '엔터프라이즈 등급과 비교하면 어떤가요?',
      mine: 'Enterprise adds SSO and a dedicated CSM — worth it once you pass 200 seats.',
      mineKr: '엔터프라이즈는 SSO와 전담 매니저가 추가돼요 — 200시트를 넘으면 그때 가치가 있죠.',
    },
    check: {
      q: '가격 설명에서 "cheap" 대신 써야 할 프레임은?',
      options: ['discount', 'value', 'expensive'],
      a: 1,
    },
  },
  'I hear you on the budget.': {
    nuance:
      '"I hear you"는 "당신 말이 들린다 = 공감한다"는 구어체 표현. 예산 압박을 인정하되 바로 할인으로 달려가지 않고, 일단 공감으로 받아 협상 온도를 낮추는 첫수입니다.',
    register: 1,
    variations: [
      { tone: '부드럽게', en: 'Budgets are tight everywhere right now — I completely get it.', kr: '요즘 어디나 예산이 빠듯하죠 — 충분히 이해해요.' },
      { tone: '중립', en: 'I hear you on the budget.', kr: '예산 부분, 충분히 이해합니다.' },
      { tone: '포멀', en: 'I fully appreciate the budget constraints you\'re working within.', kr: '주어진 예산 제약을 충분히 이해하고 있습니다.' },
    ],
    mistake: {
      wrong: 'OK, I will give you a discount. (바로 할인)',
      right: 'I hear you on the budget. Let\'s see what we can adjust.',
      why: '공감 없이 바로 할인하면 "처음 가격이 부풀려져 있었다"는 인상을 줘요. 공감 → 범위 조정 논의 → 필요시 가격 순서가 정석입니다.',
    },
    reply: {
      en: 'So is there any room to move on the number?',
      kr: '그럼 금액에 조정 여지가 좀 있나요?',
      mine: 'If we adjust the scope, yes — let\'s look at what\'s essential first.',
      mineKr: '범위를 조정하면요 — 먼저 꼭 필요한 것부터 추려보시죠.',
    },
    check: {
      q: '"I hear you"의 뉘앙스는?',
      options: ['소리가 들린다', '공감한다', '동의할 수 없다'],
      a: 1,
    },
  },
  'We have some flexibility if we adjust the scope.': {
    nuance:
      '가격이 아니라 범위(scope)를 협상 테이블에 올리는 프로의 수. 가격만 깎이면 마진이 죽지만, 범위를 조정하면 양쪽 다 명분이 생깁니다. "some flexibility"라는 절제된 표현이 과도한 기대를 막아줘요.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: 'There might be a way to make this fit if we trim a few things.', kr: '몇 가지를 덜어내면 맞출 방법이 있을 것 같아요.' },
      { tone: '중립', en: 'We have some flexibility if we adjust the scope.', kr: '범위를 조정하면 어느 정도 조율의 여지가 있어요.' },
      { tone: '강하게', en: 'The price reflects the scope — change one, and we can change the other.', kr: '가격은 범위의 반영입니다 — 하나를 바꾸면 다른 하나도 바꿀 수 있어요.' },
    ],
    mistake: {
      wrong: 'We can discount 20%.',
      right: 'We have some flexibility if we adjust the scope.',
      why: '숫자를 먼저 던지면 그 숫자가 새 기준가가 됩니다. 조정의 "조건(범위)"을 먼저 말해야 협상 주도권을 지켜요.',
    },
    reply: {
      en: 'What would you suggest cutting first?',
      kr: '뭘 먼저 빼는 걸 제안하시겠어요?',
      mine: 'The advanced analytics module — most teams add it in phase two anyway.',
      mineKr: '고급 분석 모듈요 — 대부분 2단계에서 추가하시거든요.',
    },
    check: {
      q: '가격 대신 범위를 협상하는 이유는?',
      options: ['말을 돌리기 위해', '양쪽 모두 명분 있는 조정이 가능해서', '계약을 늦추기 위해'],
      a: 1,
    },
  },
  'What kind of budget were you working with?': {
    nuance:
      '상대의 예산을 캐묻되 부담을 최소화한 형태. 과거진행형 "were you working with"가 "혹시 생각해 두신 범위가 있다면" 정도의 완곡함을 만들어, 직설적인 "How much can you pay?"와 하늘땅 차이를 냅니다.',
    register: 2,
    variations: [
      { tone: '부드럽게', en: 'Do you have a rough range in mind?', kr: '대략 생각하시는 범위가 있으실까요?' },
      { tone: '중립', en: 'What kind of budget were you working with?', kr: '어느 정도 예산을 생각하고 계셨어요?' },
      { tone: '포멀', en: 'May I ask what budget range has been allocated for this initiative?', kr: '이 프로젝트에 배정된 예산 범위를 여쭤봐도 될까요?' },
    ],
    mistake: {
      wrong: 'How much money do you have?',
      right: 'What kind of budget were you working with?',
      why: '직역식 질문은 무례하게 들려요. 예산 질문은 반드시 완곡한 형태로 — 그래야 상대도 편하게 숫자를 공유합니다.',
    },
    reply: {
      en: "We were hoping to stay under fifty thousand for year one.",
      kr: '1년 차엔 5만 달러 아래로 맞추고 싶었어요.',
      mine: "That's workable. Let me put together an option that fits.",
      mineKr: '가능한 범위네요. 거기 맞는 옵션을 구성해 볼게요.',
    },
    check: {
      q: '예산을 물을 때 완곡함을 만드는 문법 장치는?',
      options: ['현재완료', '과거진행형(were you working)', '명령문'],
      a: 1,
    },
  },
};

/* ── AI 생성 + 캐시 (정적 카드가 없는 표현용) ── */
const CACHE_KEY = 'va_depth_cache';
const CACHE_MAX = 120;

function loadCache(): Record<string, PhraseDepth> {
  return load<Record<string, PhraseDepth>>(CACHE_KEY, {});
}

export function getDepth(en: string): PhraseDepth | null {
  return STATIC_DEPTH[en] || loadCache()[en] || null;
}

function saveToCache(en: string, d: PhraseDepth) {
  const cache = loadCache();
  cache[en] = d;
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX) keys.slice(0, keys.length - CACHE_MAX).forEach((k) => delete cache[k]);
  store(CACHE_KEY, cache);
}

const GEN_SYS = [
  '너는 한국인 비즈니스 영어 학습자를 위한 표현 분석 코치다. 주어진 영어 표현 하나를 아래 JSON으로만 분석한다(코드블록 없이):',
  '{',
  ' "nuance": "뉘앙스와 쓰는 상황 (한국어 2~3문장)",',
  ' "register": 1|2|3,  // 1 캐주얼, 2 중립, 3 포멀',
  ' "variations": [ { "tone": "부드럽게|중립|강하게(또는 포멀)", "en": "...", "kr": "..." } ],  // 정확히 3개',
  ' "mistake": { "wrong": "한국인이 흔히 잘못 쓰는 문장", "right": "올바른 문장", "why": "이유 (한국어)" },',
  ' "reply": { "en": "상대의 예상 응답", "kr": "뜻", "mine": "그에 대한 내 자연스러운 리액션", "mineKr": "뜻" },',
  ' "check": { "q": "미니 확인 문제 (한국어)", "options": ["보기1","보기2","보기3"], "a": 정답인덱스 }',
  '}',
  '규칙: 실무 비즈니스 맥락 기준. 설명은 전부 자연스러운 한국어. 지어내지 말고 실제 용법대로.',
].join('\n');

/** 딥카드가 없는 표현을 AI로 분석해 캐시한다. 실패 시 throw. */
export async function generatePhraseDepth(en: string, kr: string, missionTitle: string): Promise<PhraseDepth> {
  const raw = await groqComplete(
    [
      { role: 'system', content: GEN_SYS },
      { role: 'user', content: `상황: ${missionTitle}\n표현: "${en}" (${kr})\n이 표현을 분석해줘.` },
    ],
    { temperature: 0.4, maxTokens: 900, json: true }
  );
  const p = JSON.parse(raw || '{}') as Partial<PhraseDepth>;
  if (!p.nuance || !Array.isArray(p.variations) || p.variations.length < 2 || !p.mistake || !p.check) {
    throw new Error('분석 생성에 실패했어요. 다시 시도해주세요.');
  }
  const d: PhraseDepth = {
    nuance: String(p.nuance),
    register: p.register === 1 || p.register === 3 ? p.register : 2,
    variations: p.variations.slice(0, 3).map((v) => ({ tone: String(v.tone || '중립'), en: String(v.en || ''), kr: String(v.kr || '') })),
    mistake: { wrong: String(p.mistake.wrong || ''), right: String(p.mistake.right || ''), why: String(p.mistake.why || '') },
    reply: {
      en: String(p.reply?.en || ''),
      kr: String(p.reply?.kr || ''),
      mine: String(p.reply?.mine || ''),
      mineKr: String(p.reply?.mineKr || ''),
    },
    check: {
      q: String(p.check.q || ''),
      options: (p.check.options || []).map(String).slice(0, 3),
      a: Math.min(Math.max(Number(p.check.a) || 0, 0), 2),
    },
  };
  saveToCache(en, d);
  return d;
}
