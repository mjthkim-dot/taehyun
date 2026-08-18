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

export const WORKATO_ROLE = 'Workato Enterprise Account Executive (Seoul)';

/** 면접관 AI에게 주입되는 JD 요약 — 후속 질문·평가가 이 문맥으로 나온다. */
export const WORKATO_JD_BRIEF = [
  '지원 포지션: Workato Enterprise Account Executive (서울, 아시아 테리토리).',
  'Workato: 에이전틱(agentic) 시대의 엔터프라이즈 자동화·iPaaS 플랫폼 — 앱·데이터·프로세스·AI를 단일 플랫폼으로 통합·오케스트레이션. 포춘 500의 50%가 사용.',
  '역할: 신규 고객(New Business) 발굴에 거의 전적으로 집중하는 헌터. 직판 + 채널 파트너 병행. 타깃 계정의 여러 사업부 C레벨과 멀티스레딩. $100K(USD) 이상 대형 계약 클로징 목표. 영업 VP 직보고, 테리토리 플랜 수립.',
  '요건: 7년+ 풀사이클 클로징 경력, 쿼터 지속 달성/초과 실적, 스타트업의 모호함을 수용하는 팀 플레이어형 헌터.',
].join('\n');

export const WORKATO_QUESTIONS: { q: string; qKr: string }[] = [
  { q: 'To start, walk me through your background and why you think you fit this role.', qKr: '먼저 경력을 소개해 주시고, 이 역할에 맞는 이유를 말씀해 주세요.' },
  { q: 'Why Workato, and why now?', qKr: '왜 Workato인가요, 그리고 왜 지금인가요?' },
  { q: 'This role is almost entirely new business. Walk me through a new logo you hunted and closed from scratch.', qKr: '이 역할은 거의 전적으로 신규 영업입니다. 처음부터 발굴해 클로징한 신규 로고 사례를 들려주세요.' },
  { q: 'Tell me about the largest deal you have closed. How did you build the business case for a six-figure contract?', qKr: '클로징한 가장 큰 딜을 말해 주세요. 10만 달러 이상 계약의 비즈니스 케이스를 어떻게 만들었나요?' },
  { q: 'How do you multi-thread into multiple business units and reach C-level executives in a target account?', qKr: '타깃 계정에서 여러 사업부를 멀티스레딩하고 C레벨에 닿는 방법은 무엇인가요?' },
  { q: 'If you joined, how would you build your territory plan for Korea in the first ninety days?', qKr: '합류한다면 첫 90일 한국 테리토리 플랜을 어떻게 세우시겠어요?' },
  { q: 'Tell me about a time you missed, or nearly missed, your quota. What did you change?', qKr: '쿼터를 놓쳤거나 놓칠 뻔했던 경험과, 그 뒤 무엇을 바꿨는지 말씀해 주세요.' },
  { q: 'A customer says they can build integrations in-house. How do you position Workato against that?', qKr: '고객이 통합을 내재화로 해결하겠다고 합니다. Workato를 어떻게 포지셔닝하시겠어요?' },
  { q: 'How do you work with channel partners without losing control of the deal?', qKr: '딜의 주도권을 잃지 않으면서 채널 파트너와 협업하는 방법은요?' },
  { q: 'You are leaving a stable large company for a startup. How do you handle the ambiguity without big-company support?', qKr: '안정적인 대기업을 떠나 스타트업으로 갑니다. 대기업의 지원 없이 모호함을 어떻게 다루시겠어요?' },
];

const ROTATE_KEY = 'va_workato_q';

/** 이번 세션의 질문 5개 — 호출할 때마다 다음 5개로 로테이션. */
export function nextWorkatoQuestions(): { q: string; qKr: string }[] {
  const start = load<number>(ROTATE_KEY, 0) % WORKATO_QUESTIONS.length;
  const out: { q: string; qKr: string }[] = [];
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
