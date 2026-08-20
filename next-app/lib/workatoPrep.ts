'use client';

/**
 * Workato Enterprise AE 면접 프리셋 — 실제 지원 중인 포지션의 맞춤 준비 세트.
 *
 * 재료 출처:
 *  - 실제 JD(2026-08): 신규 고객 발굴 중심 헌터, 직판+채널, 여러 사업부
 *    C레벨 멀티스레딩, $100K+ 클로징, 7년+ 풀사이클, 스타트업 모호함 수용.
 *  - 사용자의 GitLab Korea 최종 면접 스크립트(검증된 서사)를 Workato 문맥으로
 *    번역: Cloud Native→AI Native 시장 변화 → "앱·데이터·프로세스·AI의
 *    오케스트레이션"이라는 Workato의 질문으로, DevSecOps 플랫폼 스토리 →
 *    에이전틱 시대의 통합 플랫폼 스토리로. AM 네트워크 레버리지·파트너
 *    전략·Salesforce 투명성·90일 플랜은 그대로 이식.
 *
 * 질문 10개는 세션마다 5개씩 로테이션(va_workato_q) — 두 번 보면 전 문항을
 * 다 만난다. JD 요약은 면접관 반응·평가 프롬프트에 주입되어 후속 질문이
 * Workato 문맥으로 파고든다.
 */
import { load, store } from './state';
import type { AnswerGuide } from './interview';

export const WORKATO_ROLE = 'Workato Enterprise Account Executive (Seoul)';

/** 면접관 AI에게 주입되는 JD 요약 — 후속 질문·평가가 이 문맥으로 나온다. */
export const WORKATO_JD_BRIEF = [
  '지원 포지션: Workato Enterprise Account Executive (서울, 아시아 테리토리).',
  'Workato: 에이전틱(agentic) 시대의 엔터프라이즈 자동화·iPaaS 플랫폼 — 앱·데이터·프로세스·AI를 단일 플랫폼으로 통합·오케스트레이션. 포춘 500의 50%가 사용.',
  '역할: 신규 고객(New Business) 발굴에 거의 전적으로 집중하는 헌터. 직판 + 채널 파트너 병행. 타깃 계정의 여러 사업부 C레벨과 멀티스레딩. $100K(USD) 이상 대형 계약 클로징 목표. 영업 VP 직보고, 테리토리 플랜 수립.',
  '요건: 7년+ 풀사이클 클로징 경력, 쿼터 지속 달성/초과 실적, 스타트업의 모호함을 수용하는 팀 플레이어형 헌터.',
].join('\n');

export const WORKATO_QUESTIONS: { q: string; qKr: string; guide: AnswerGuide }[] = [
  {
    q: 'To start, walk me through your background and why you think you fit this role.',
    qKr: '먼저 경력을 소개해 주시고, 이 역할에 맞는 이유를 말씀해 주세요.',
    guide: {
      structure: ['현재 역할 한 줄', '대표 성과 1개(숫자로)', '왜 이 역할인가로 착지'],
      materials: [
        '메가존클라우드(한국 최대 클라우드 파트너) AM 4년+ — 클라우드·DevOps·데이터·AI 영업',
        '엔터프라이즈·디지털 네이티브 50+ 계정 포트폴리오',
        '만료 계약 → 3년 25만 달러 약정 전환 클로징',
        '"헌터지만, 큰 딜은 적임자를 모아 만든다"로 마무리',
      ],
      opener: "I've spent over four years at Korea's largest cloud partner, selling cloud, DevOps, and AI solutions.",
      sample: {
        en: "I've spent over four years at MegazoneCloud, Korea's largest cloud partner, selling cloud, DevOps, and AI solutions. I manage a portfolio of over fifty enterprise accounts, and I've closed complex six-figure deals — including converting an expiring enterprise agreement into a three-year, quarter-million-dollar commitment. I'm a hunter by nature, but I close big deals by pulling the right people together. That's exactly the profile this role is asking for.",
        kr: '저는 한국 최대 클라우드 파트너인 메가존클라우드에서 4년 넘게 클라우드·DevOps·AI 솔루션을 판매해 왔습니다. 50개 이상의 엔터프라이즈 계정을 담당하고, 만료되던 기업 계약을 3년 25만 달러 약정으로 전환하는 등 복잡한 6자리 딜을 클로징해 왔습니다. 천성은 헌터지만, 큰 딜은 적임자들을 모아 함께 만듭니다. 이 역할이 원하는 프로필이 정확히 그것이라고 생각합니다.',
      },
    },
  },
  {
    q: 'Why Workato, and why now?',
    qKr: '왜 Workato인가요, 그리고 왜 지금인가요?',
    guide: {
      structure: ['시장 변화 진단', 'Workato의 자리', '나의 방향과 일치'],
      materials: [
        '모든 고객 대화가 자동화·AI 거버넌스로 이동 중(현장 관찰)',
        '에이전틱 시대엔 통합이 기업의 컨트롤 플레인 — Workato가 그 자리',
        '영어로 매일 일하는 글로벌 환경으로 가려는 커리어 방향',
      ],
      opener: 'Because in the agentic era, integration becomes the control plane of the enterprise.',
      sample: {
        en: "Because in the agentic era, integration becomes the control plane of the enterprise — and Workato sits exactly there. In my current role, I've watched every customer conversation drift toward automation and AI governance. I want to sell the platform that answers that question, as a hunter, from day one. And personally, this is the right time for me to move into a global environment where I work in English every day.",
        kr: '에이전트 시대에는 통합이 기업의 컨트롤 플레인이 되는데, Workato가 정확히 그 자리에 있기 때문입니다. 지금 역할에서 모든 고객 대화가 자동화와 AI 거버넌스로 흘러가는 걸 지켜봤습니다. 그 질문에 답하는 플랫폼을 첫날부터 헌터로서 팔고 싶습니다. 그리고 개인적으로도, 매일 영어로 일하는 글로벌 환경으로 옮길 적기입니다.',
      },
    },
  },
  {
    q: 'This role is almost entirely new business. Walk me through a new logo you hunted and closed from scratch.',
    qKr: '이 역할은 거의 전적으로 신규 영업입니다. 처음부터 발굴해 클로징한 신규 로고 사례를 들려주세요.',
    guide: {
      structure: ['어떻게 발견했나', '니즈→기술 적합→비즈니스 가치 순서', '클로징과 결과'],
      materials: [
        '넥서스: 기회를 내가 먼저 발굴 → 파트너와 공유 → 빠른 클로징',
        'AM 네트워크(100+)로 접점을 만든 과정',
        '고객의 기술 과제와 사업 니즈를 정리해 도입 논리를 만든 것',
      ],
      opener: 'Let me walk you through a deal I hunted from scratch.',
      sample: {
        en: "Let me walk you through a deal I hunted from scratch. I spotted the opportunity myself — a customer whose development process was clearly hitting its limits — before anyone had it in a pipeline. I mapped their technical pain and business needs, built the case for why now, and brought in the right partner to move fast. We closed it quickly, and that motion — find it early, frame the value, pull in the right people — is exactly how I'd hunt new logos here.",
        kr: '처음부터 발굴한 딜을 말씀드리겠습니다. 개발 프로세스가 한계에 부딪힌 고객을 파이프라인에 잡히기 전에 제가 먼저 포착했습니다. 기술적 페인과 사업 니즈를 정리해 "왜 지금인가"의 논리를 만들었고, 빠르게 움직일 적임 파트너를 붙였습니다. 딜은 빠르게 클로징됐고 — 일찍 발견하고, 가치를 프레이밍하고, 적임자를 모으는 이 동작이 여기서 신규 로고를 사냥할 제 방식입니다.',
      },
    },
  },
  {
    q: 'Tell me about the largest deal you have closed. How did you build the business case for a six-figure contract?',
    qKr: '클로징한 가장 큰 딜을 말해 주세요. 10만 달러 이상 계약의 비즈니스 케이스를 어떻게 만들었나요?',
    guide: {
      structure: ['딜의 출발점(리스크)', '비즈니스 케이스 재구성', '협상과 클로징(숫자)'],
      materials: [
        '씨피랩스 EDP: 미소진 잔액 큰 만료 리스크로 시작',
        '잔액 전액 → 3년 약정 전환 케이스를 다시 세움',
        '분납·보증보험을 재무팀과 협상, 모든 전제를 실행 전 서면 확정',
        '25만 달러+ 클로징, 고객이 과정에 감사를 표함',
      ],
      opener: 'My largest recent deal started as a renewal risk.',
      sample: {
        en: "My largest recent deal started as a renewal risk — an enterprise agreement expiring with a large unspent balance. I rebuilt the business case around converting the entire balance into a three-year commitment, negotiated installment terms and security with our finance team, and put every assumption in writing before execution. It closed at over a quarter million dollars, and the customer actually thanked us for the process.",
        kr: '최근 가장 큰 딜은 갱신 리스크로 시작됐습니다 — 미소진 잔액이 큰 채로 만료되는 기업 계약이었죠. 잔액 전액을 3년 약정으로 전환하는 비즈니스 케이스를 다시 세우고, 재무팀과 분납·담보 조건을 협상했으며, 실행 전에 모든 전제를 서면으로 확정했습니다. 25만 달러가 넘는 규모로 클로징됐고, 고객은 오히려 그 과정에 감사를 표했습니다.',
      },
    },
  },
  {
    q: 'How do you multi-thread into multiple business units and reach C-level executives in a target account?',
    qKr: '타깃 계정에서 여러 사업부를 멀티스레딩하고 C레벨에 닿는 방법은 무엇인가요?',
    guide: {
      structure: ['계정 매핑', '이해관계자별 언어', '실전 근거'],
      materials: [
        'IT·재무·보안·페인을 느끼는 현업까지 매핑',
        '재무엔 비용, 보안엔 거버넌스, 현업엔 속도 — 각자의 언어로',
        '지금도 한 딜에서 고객·하이퍼스케일러·딜리버리 팀을 동시 조율',
      ],
      opener: 'Multi-threading is how I de-risk big deals.',
      sample: {
        en: "Multi-threading is how I de-risk big deals. I map the account across IT, finance, security, and the business unit that actually feels the pain, and I give each stakeholder a reason to care in their own language — cost for finance, governance for security, speed for the business. In my current role I routinely coordinate customers, hyperscalers, and internal delivery teams on a single deal, so working six threads at once is my normal.",
        kr: '멀티스레딩은 큰 딜의 리스크를 줄이는 제 방식입니다. IT·재무·보안·페인을 실제로 느끼는 현업까지 계정을 매핑하고, 각 이해관계자에게 그들의 언어로 관심 가질 이유를 만듭니다 — 재무엔 비용, 보안엔 거버넌스, 현업엔 속도. 지금도 한 딜에서 고객·하이퍼스케일러·내부 딜리버리 팀을 동시에 조율하는 게 일상이라, 여섯 갈래를 동시에 굴리는 건 제 평소 방식입니다.',
      },
    },
  },
  {
    q: 'If you joined, how would you build your territory plan for Korea in the first ninety days?',
    qKr: '합류한다면 첫 90일 한국 테리토리 플랜을 어떻게 세우시겠어요?',
    guide: {
      structure: ['30일', '60일', '90일 — 각 단계의 산출물'],
      materials: [
        '30일: 온보딩과 병행해 웜 계정 검증 — 통합·AI 자동화 니즈 보이는 우선순위 리스트',
        '60일: 그 리스트를 첫 미팅으로 전환, 처음부터 멀티스레드',
        '90일: 검증된 신규 로고 파이프라인 + 6자리 딜 1건 진행 중',
      ],
      opener: "In the first thirty days, I'd run onboarding in parallel with territory validation.",
      sample: {
        en: "In the first thirty days, I'd run onboarding in parallel with territory validation — building a prioritized list of warm accounts from my network where integration and AI-automation needs are already visible. Days thirty-one to sixty, I'd convert that list into first meetings, multi-threaded from the start. By day ninety, my goal is a qualified new-logo pipeline and at least one deal moving toward a six-figure close. The metrics I'd track are simple: first meetings booked, qualified opportunities, and pipeline coverage against quota.",
        kr: '첫 30일은 온보딩과 테리토리 검증을 병행하겠습니다 — 통합·AI 자동화 니즈가 이미 보이는 웜 계정을 제 네트워크에서 추려 우선순위 리스트를 만듭니다. 31~60일엔 그 리스트를 첫 미팅으로 전환하고, 처음부터 멀티스레드로 접근합니다. 90일차 목표는 검증된 신규 로고 파이프라인과 6자리 클로징을 향해 움직이는 딜 최소 1건입니다. 추적할 지표는 단순합니다: 첫 미팅 수, 검증된 기회 수, 쿼터 대비 파이프라인 커버리지.',
      },
    },
  },
  {
    q: 'Tell me about a time you missed, or nearly missed, your quota. What did you change?',
    qKr: '쿼터를 놓쳤거나 놓칠 뻔했던 경험과, 그 뒤 무엇을 바꿨는지 말씀해 주세요.',
    guide: {
      structure: ['솔직한 상황 인정', '원인 분석 한 줄', '바꾼 시스템(지금도 유지)'],
      materials: [
        '한 분기 대형 딜 지연으로 위태로웠던 경험 — 원인은 파이프라인이 소수 딜에 편중',
        '바꾼 것: 커버리지 3배 규칙 + 주간 파이프라인 리뷰로 조기 감지',
        '"운이 아니라 시스템으로 반복 달성"으로 마무리',
      ],
      opener: 'Let me be honest about the quarter that taught me the most.',
      sample: {
        en: "Let me be honest about the quarter that taught me the most. I nearly missed my number because my pipeline was concentrated in a few large deals, and one of them slipped. What I changed was the system, not the effort: I now keep pipeline coverage at roughly three times quota, and I run a weekly review to catch slipping deals early. Since then, hitting the number has been about discipline, not luck.",
        kr: '가장 많이 배운 분기를 솔직히 말씀드리겠습니다. 파이프라인이 소수의 큰 딜에 편중돼 있었고 그중 하나가 밀리면서 목표를 놓칠 뻔했습니다. 바꾼 건 노력이 아니라 시스템입니다: 지금은 파이프라인 커버리지를 쿼터의 약 3배로 유지하고, 주간 리뷰로 밀리는 딜을 조기에 잡아냅니다. 그 뒤로 목표 달성은 운이 아니라 규율의 문제가 됐습니다.',
      },
    },
  },
  {
    q: 'A customer says they can build integrations in-house. How do you position Workato against that?',
    qKr: '고객이 통합을 내재화로 해결하겠다고 합니다. Workato를 어떻게 포지셔닝하시겠어요?',
    guide: {
      structure: ['반박 대신 질문', '스케일의 현실 3가지', '리프레임'],
      materials: [
        '수백 개 연결의 유지보수는 누가?',
        '프로덕션 데이터를 만지는 AI 에이전트의 거버넌스는?',
        '엔지니어링 시간의 기회비용은?',
        '리프레임: 엔지니어를 대체하는 게 아니라 로드맵을 돌려주는 것',
      ],
      opener: "I don't argue — I ask what happens at scale.",
      sample: {
        en: "I don't argue — I ask what happens at scale. Who maintains hundreds of connections a year from now? Who governs the AI agents touching production data? And what does that cost in engineering time that should go to the product? Then I reframe it: Workato isn't replacing their engineers — it's giving them back their roadmap.",
        kr: '반박하지 않고, 스케일에서 무슨 일이 생기는지 묻습니다. 1년 뒤 수백 개의 연결은 누가 유지보수하나요? 프로덕션 데이터를 만지는 AI 에이전트는 누가 통제하나요? 그리고 제품에 써야 할 엔지니어링 시간으로 얼마가 드나요? 그리고 프레임을 바꿉니다: Workato는 엔지니어를 대체하는 게 아니라, 그들의 로드맵을 돌려주는 것이라고.',
      },
    },
  },
  {
    q: 'How do you work with channel partners without losing control of the deal?',
    qKr: '딜의 주도권을 잃지 않으면서 채널 파트너와 협업하는 방법은요?',
    guide: {
      structure: ['파트너관(觀)', '역할 설계', '주도권의 실체'],
      materials: [
        '파트너는 리셀러가 아니라 GTM 생태계 — 접점·기술검증·구축을 나눠 설계',
        '파트너사 내부에서 딜이 실제로 어떻게 움직이는지 아는 것이 내 강점',
        '주도권 = 고객의 니즈 정의와 다음 액션을 내가 쥐는 것(서류가 아니라)',
      ],
      opener: "I keep control by owning the customer's next step, not the paperwork.",
      sample: {
        en: "I keep control by owning the customer's next step, not the paperwork. To me, partners aren't resellers — they're a go-to-market ecosystem, and I design their role deal by deal: who opens the door, who runs the technical validation, who delivers. I've worked inside a partner, so I know exactly where deals stall on that side and how to unblock them. As long as I own the customer's needs and the next action, the deal stays mine.",
        kr: '저는 서류가 아니라 고객의 다음 스텝을 쥐는 것으로 주도권을 지킵니다. 파트너는 리셀러가 아니라 GTM 생태계라, 딜마다 역할을 설계합니다: 누가 문을 열고, 누가 기술 검증을 하고, 누가 구축하는지. 저는 파트너사 안에서 일해봐서 딜이 그쪽에서 어디서 막히는지, 어떻게 푸는지 정확히 압니다. 고객의 니즈와 다음 액션을 제가 쥐고 있는 한, 딜은 제 것입니다.',
      },
    },
  },
  {
    q: 'You are leaving a stable large company for a startup. How do you handle the ambiguity without big-company support?',
    qKr: '안정적인 대기업을 떠나 스타트업으로 갑니다. 대기업의 지원 없이 모호함을 어떻게 다루시겠어요?',
    guide: {
      structure: ['정면 응답(두려움 없음)', '구조와 투명성이라는 방법', '증거'],
      materials: [
        '대기업식 안전장치 불필요 — 명확함은 내가 만든다',
        '모든 미팅 = 니즈·단계·이해관계자·다음 액션·리스크 기록',
        '주간 서면 업데이트 — 내 파이프라인은 블랙박스가 되지 않는다',
      ],
      opener: "I don't need guardrails — I need clarity, and I create it myself.",
      sample: {
        en: "I don't need big-company guardrails — I need clarity, and I create it myself. English isn't my first language, so I manage that risk with structure and transparency rather than promises: every meeting becomes a clear record — needs, stage, stakeholders, next action, risk — and a weekly written update to the team. Good communication isn't speaking the most; it's making sure my pipeline is never a black box.",
        kr: '저는 대기업식 안전장치가 필요하지 않습니다 — 필요한 건 명확함이고, 그건 제가 직접 만듭니다. 영어가 모국어가 아니기에 이 리스크를 다짐이 아니라 구조와 투명성으로 관리합니다: 모든 미팅은 니즈·단계·이해관계자·다음 액션·리스크가 담긴 명확한 기록이 되고, 매주 서면 업데이트로 팀과 공유합니다. 좋은 커뮤니케이션은 말을 많이 하는 게 아니라, 제 파이프라인이 블랙박스가 되지 않게 하는 것입니다.',
      },
    },
  },
];

const ROTATE_KEY = 'va_workato_q';

/** 이번 세션의 질문 5개 — 호출할 때마다 다음 5개로 로테이션. */
export function nextWorkatoQuestions(): { q: string; qKr: string; guide: AnswerGuide }[] {
  const start = load<number>(ROTATE_KEY, 0) % WORKATO_QUESTIONS.length;
  const out: { q: string; qKr: string; guide: AnswerGuide }[] = [];
  for (let i = 0; i < 5; i++) out.push(WORKATO_QUESTIONS[(start + i) % WORKATO_QUESTIONS.length]);
  store(ROTATE_KEY, (start + 5) % WORKATO_QUESTIONS.length);
  return out;
}

/** 핵심 답변 카드 — GitLab 최종 면접 스크립트의 검증된 서사를 Workato 버전으로. */
export const WORKATO_ANSWERS: { topic: string; en: string; kr: string }[] = [
  {
    topic: '오프닝 — 시장 변화',
    en: "Let me start with what I'm seeing in the Korean market. For years, companies invested in cloud infrastructure and dozens of SaaS tools. Now the question has changed — how do we connect our apps, data, and processes, and how do we put AI agents to work safely on top of them. That is exactly the problem Workato solves, and it's the conversation my customers are already having.",
    kr: '제가 한국 시장에서 보고 있는 변화부터 말씀드리겠습니다. 지난 몇 년간 기업들은 클라우드 인프라와 수십 개의 SaaS 도구에 투자해 왔습니다. 이제 질문이 바뀌었습니다 — 앱·데이터·프로세스를 어떻게 연결하고, 그 위에서 AI 에이전트를 어떻게 안전하게 일하게 할 것인가. 이것이 바로 Workato가 푸는 문제이고, 제 고객들이 이미 하고 있는 고민입니다.',
  },
  {
    topic: '자기소개 핵심',
    en: "I've spent over four years at MegazoneCloud, Korea's largest cloud partner, selling cloud, DevOps, data, and AI solutions. I manage a portfolio of over fifty enterprise and digital-native accounts, and I've closed complex six-figure deals — including converting an expiring enterprise agreement into a three-year, quarter-million-dollar commitment. I'm a hunter by nature, but I close big deals by pulling the right people together.",
    kr: '저는 한국 최대 클라우드 파트너인 메가존클라우드에서 4년 넘게 클라우드·DevOps·데이터·AI 솔루션을 판매해 왔습니다. 50개 이상의 엔터프라이즈·디지털 네이티브 계정을 담당하고 있고, 만료되던 기업 계약을 3년 25만 달러 약정으로 전환하는 등 복잡한 6자리 딜을 클로징해 왔습니다. 저는 천성이 헌터지만, 큰 딜은 적임자들을 모아 함께 만듭니다.',
  },
  {
    topic: 'AM 네트워크 — 신규 로고 엔진',
    en: "My biggest differentiator is leverage. I've built a trusted network of over a hundred account managers inside Megazone, who collectively touch more than seventeen hundred customer accounts. When an AM spots an integration or AI-automation pain point, I want them to think of Workato first — so I'm not just bringing my own accounts; I'm bringing a repeatable new-logo engine.",
    kr: '저의 가장 큰 차별점은 레버리지입니다. 메가존 안에서 100명이 넘는 AM들과 신뢰 네트워크를 쌓아왔고, 이들이 합쳐서 1,700개 이상의 고객 계정을 접점으로 갖고 있습니다. AM이 통합이나 AI 자동화 페인포인트를 발견했을 때 Workato를 가장 먼저 떠올리게 만들고 싶습니다 — 저는 제 계정만 가져오는 게 아니라, 반복 가능한 신규 로고 엔진을 가져옵니다.',
  },
  {
    topic: '$100K+ 딜 스토리 (STAR)',
    en: "My largest recent deal started as a renewal risk — an enterprise agreement expiring with a large unspent balance. I rebuilt the business case around converting the entire balance into a three-year commitment, negotiated installment terms and security with our finance team, and put every assumption in writing before execution. It closed at over a quarter million dollars, and the customer thanked us for the process.",
    kr: '최근 가장 큰 딜은 갱신 리스크로 시작됐습니다 — 미소진 잔액이 큰 채로 만료되는 기업 계약이었죠. 잔액 전액을 3년 약정으로 전환하는 비즈니스 케이스를 다시 세우고, 재무팀과 분납·담보 조건을 협상했으며, 실행 전에 모든 전제를 서면으로 확정했습니다. 25만 달러가 넘는 규모로 클로징됐고, 고객은 오히려 그 과정에 감사를 표했습니다.',
  },
  {
    topic: '멀티스레딩',
    en: "Multi-threading is how I de-risk big deals. I map the account across IT, finance, security, and the business unit that feels the pain, and I give each stakeholder a reason to care in their own language — cost for finance, governance for security, speed for the business. In my current role I routinely coordinate customers, hyperscalers, and internal delivery teams on one deal, so working six threads at once is my normal.",
    kr: '멀티스레딩은 큰 딜의 리스크를 줄이는 제 방식입니다. IT·재무·보안·페인을 느끼는 현업까지 계정을 매핑하고, 각 이해관계자에게 그들의 언어로 관심 가질 이유를 만듭니다 — 재무엔 비용, 보안엔 거버넌스, 현업엔 속도. 지금도 한 딜에서 고객·하이퍼스케일러·내부 딜리버리 팀을 동시에 조율하는 게 일상이라, 여섯 갈래를 동시에 굴리는 건 제 평소 방식입니다.',
  },
  {
    topic: '첫 90일 플랜',
    en: "In the first thirty days, I'd respect the onboarding but run it in parallel with territory validation — building a prioritized list of warm accounts from my network where integration and AI-automation needs are already visible. Days thirty-one to sixty, I'd convert those into first meetings, multi-threaded from the start. By day ninety, my goal is a qualified new-logo pipeline and at least one deal moving toward a six-figure close.",
    kr: '첫 30일은 온보딩을 존중하되 테리토리 검증과 병행하겠습니다 — 통합·AI 자동화 니즈가 이미 보이는 웜 계정을 네트워크에서 추려 우선순위 리스트를 만들겠습니다. 31~60일엔 그 리스트를 첫 미팅으로 전환하고, 처음부터 멀티스레드로 접근합니다. 90일차의 목표는 검증된 신규 로고 파이프라인과, 6자리 클로징을 향해 움직이는 딜 최소 1건입니다.',
  },
  {
    topic: '내재화 반론 대응',
    en: "When a customer says they can build integrations in-house, I don't argue — I ask what happens at scale: who maintains hundreds of connections, who governs the AI agents touching production data, and what that costs in engineering time. Then I reframe: Workato isn't replacing their engineers; it's giving them back their roadmap.",
    kr: '고객이 통합을 내재화로 해결하겠다고 하면 반박하지 않습니다 — 스케일에서 무슨 일이 생기는지 묻습니다: 수백 개의 연결은 누가 유지보수하고, 프로덕션 데이터를 만지는 AI 에이전트는 누가 통제하며, 그것이 엔지니어링 시간으로 얼마가 드는지. 그리고 프레임을 바꿉니다: Workato는 엔지니어를 대체하는 게 아니라, 그들의 로드맵을 돌려주는 것이라고.',
  },
  {
    topic: '모호함 + 영어 리스크 — 구조와 투명성',
    en: "I don't need big-company guardrails — I need clarity, and I create it myself. English isn't my first language, so I manage that risk with structure and transparency rather than promises: every meeting becomes a clear record — needs, stage, stakeholders, next action, risk — and a weekly written update to the team. Good communication isn't speaking the most; it's making sure my pipeline is never a black box.",
    kr: '저는 대기업식 안전장치가 필요하지 않습니다 — 필요한 건 명확함이고, 그건 제가 직접 만듭니다. 영어가 모국어가 아니기에 이 리스크를 다짐이 아니라 구조와 투명성으로 관리합니다: 모든 미팅은 니즈·단계·이해관계자·다음 액션·리스크가 담긴 명확한 기록이 되고, 매주 서면 업데이트로 팀과 공유합니다. 좋은 커뮤니케이션은 말을 많이 하는 게 아니라, 제 파이프라인이 블랙박스가 되지 않게 하는 것입니다.',
  },
  {
    topic: '클로징 메시지 — 왜 Workato',
    en: "Why Workato? Because in the agentic era, integration becomes the control plane of the enterprise — and Workato sits exactly there. I've watched every customer conversation drift toward automation and AI governance, and I want to sell the platform that answers that question, as a hunter, from day one. I'm not a candidate who needs to learn the Korean enterprise market; I'm bringing it with me.",
    kr: '왜 Workato인가? 에이전트 시대에는 통합이 기업의 컨트롤 플레인이 되는데, Workato가 정확히 그 자리에 있기 때문입니다. 모든 고객 대화가 자동화와 AI 거버넌스로 흘러가는 걸 현장에서 봐왔고, 그 질문에 답하는 플랫폼을 첫날부터 헌터로서 팔고 싶습니다. 저는 한국 엔터프라이즈 시장을 배워야 하는 후보가 아니라, 그 시장을 데리고 오는 사람입니다.',
  },
];
