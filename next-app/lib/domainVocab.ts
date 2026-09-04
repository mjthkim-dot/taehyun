/**
 * 직무 도메인 어휘 뱅크 — 재무·법무·HR·기술 + IT 영업 트랙(영업·딜, 클라우드,
 * FinOps, 콩글리시 교정). IT 영업 실무에서 실제로 오가는 표현을 우선한다.
 *
 * 설계 원칙(단어장과의 차이):
 * ① **연어(collocation) 중심** — 단어 하나를 외워도 쓰지 못하는 이유는 함께 쓰는
 *    동사·전치사를 모르기 때문이다. 그래서 각 항목에 실제로 붙여 쓰는 덩어리를 넣는다.
 * ② **한국인 오용 지점**을 note에 명시 — 직역·유사어 혼동·전치사 오류가 반복되는 곳.
 * ③ **바로 쓸 수 있는 예문 1개** — 회의·이메일에서 그대로 꺼낼 수 있는 형태.
 * 정적 데이터라 API 비용이 없고 오프라인에서도 동작한다.
 */

export interface VocabEntry {
  /** 표제어(연어 포함 가능) */
  term: string;
  kr: string;
  /** 난이도 — 표시·필터용 */
  level: 'B1' | 'B2' | 'C1';
  /** 함께 쓰는 덩어리 */
  collocations: string[];
  example: { en: string; kr: string };
  /** 뉘앙스·오용 주의(한국어 화자 기준) */
  note: string;
}

export interface VocabDomain {
  key: string;
  label: string;
  /** 이 도메인을 언제 쓰는지 한 줄 */
  desc: string;
  entries: VocabEntry[];
}

export const VOCAB_DOMAINS: VocabDomain[] = [
  {
    key: 'finance',
    label: '재무 · 회계',
    desc: '예산·비용·매출 보고와 투자 논의에서 쓰는 표현',
    entries: [
      {
        term: 'revenue',
        kr: '매출(액)',
        level: 'B1',
        collocations: ['revenue growth', 'generate revenue', 'recurring revenue'],
        example: { en: 'Revenue grew 12% quarter over quarter.', kr: '매출이 전 분기 대비 12% 성장했습니다.' },
        note: 'revenue(매출)와 profit(이익)은 다릅니다 — 비용을 빼기 전이 revenue.\nsales는 판매 활동/판매액, revenue는 회계상 총수익이라 보고서에서는 revenue가 정확합니다.',
      },
      {
        term: 'margin',
        kr: '이익률, 마진',
        level: 'B2',
        collocations: ['gross margin', 'margin pressure', 'improve margins'],
        example: { en: 'Gross margin improved as cloud costs came down.', kr: '클라우드 비용이 내려가면서 매출총이익률이 개선됐습니다.' },
        note: '한국어 "마진이 좋다"를 good margin으로 직역해도 통하지만, 보고서에서는 **healthy/strong margins**가 자연스럽습니다.\n압박 상황은 margin pressure(마진 압박).',
      },
      {
        term: 'burn rate',
        kr: '현금 소진 속도',
        level: 'B2',
        collocations: ['monthly burn rate', 'reduce the burn', 'runway'],
        example: { en: 'At the current burn rate, we have 14 months of runway.', kr: '현재 소진 속도라면 14개월치 자금이 남아 있습니다.' },
        note: 'runway(남은 개월 수)와 짝으로 쓰입니다.\n스타트업·신사업 논의의 필수 표현이며, 투자자 미팅에서 거의 반드시 나옵니다.',
      },
      {
        term: 'CapEx / OpEx',
        kr: '자본적 지출 / 운영 비용',
        level: 'B2',
        collocations: ['shift from CapEx to OpEx', 'CapEx-heavy', 'OpEx model'],
        example: { en: 'Moving to the cloud shifts spending from CapEx to OpEx.', kr: '클라우드로 이전하면 지출이 자본적 지출에서 운영 비용으로 옮겨갑니다.' },
        note: 'capital expenditure / operating expense의 약어로, 회의에서는 거의 항상 약어로 말합니다("캡엑스·옵엑스").\n클라우드 전환 제안의 핵심 논리라 반드시 알아야 합니다.',
      },
      {
        term: 'forecast',
        kr: '전망, 예측(치)',
        level: 'B1',
        collocations: ['revise the forecast', 'in line with forecast', 'conservative forecast'],
        example: { en: "We're revising the forecast down slightly for Q4.", kr: '4분기 전망치를 소폭 하향 조정하고 있습니다.' },
        note: '동사·명사 둘 다 됩니다 — forecast the demand / the sales forecast.\n예상대로면 **in line with** the forecast, 밑돌면 **below** forecast.',
      },
      {
        term: 'break even',
        kr: '손익분기에 이르다',
        level: 'B2',
        collocations: ['break even by Q3', 'break-even point', 'break-even analysis'],
        example: { en: 'We expect to break even by the third quarter.', kr: '3분기에 손익분기를 넘길 것으로 예상합니다.' },
        note: '동사로 쓰면 띄어쓰기(break even), 명사·형용사로 쓰면 하이픈(break-even point).\n"이익이 나기 시작한다"는 뜻이 아니라 **손실이 0이 되는 지점**입니다.',
      },
      {
        term: 'write off',
        kr: '(손실로) 상각하다, 손실 처리하다',
        level: 'C1',
        collocations: ['write off bad debt', 'a one-time write-off', 'write it off as a loss'],
        example: { en: 'We had to write off the remaining inventory.', kr: '남은 재고를 손실로 처리해야 했습니다.' },
        note: '구동사(write off)와 명사(a write-off)를 구분하세요.\n일상 회화에서는 "완전히 실패로 치다"라는 뜻으로도 씁니다 — The whole quarter was a write-off.',
      },
      {
        term: 'ROI',
        kr: '투자수익률',
        level: 'B1',
        collocations: ['demonstrate ROI', 'ROI on the investment', 'payback period'],
        example: { en: 'Can you demonstrate the ROI within 12 months?', kr: '12개월 안에 투자수익률을 입증할 수 있나요?' },
        note: 'return on investment의 약어. 회의에서는 문장 앞에 the를 붙여 the ROI로 자주 씁니다.\n짝 표현: payback period(투자비 회수 기간), TCO(총소유비용).',
      },
      {
        term: 'allocate budget',
        kr: '예산을 배정하다',
        level: 'B2',
        collocations: ['allocate budget to', 'budget allocation', 'reallocate funds'],
        example: { en: 'We allocated most of the budget to migration.', kr: '예산 대부분을 이관 작업에 배정했습니다.' },
        note: '전치사는 **to**입니다 — allocate budget **for**도 쓰이지만 대상에는 to가 표준입니다.\n"예산을 잡다"는 set aside a budget / earmark funds로도 표현합니다.',
      },
      {
        term: 'cost-effective',
        kr: '비용 대비 효율이 높은',
        level: 'B1',
        collocations: ['a cost-effective option', 'more cost-effective than', 'cost savings'],
        example: { en: 'The managed service is more cost-effective at this scale.', kr: '이 규모에서는 매니지드 서비스가 비용 효율이 더 높습니다.' },
        note: 'cheap(싸다)은 품질이 낮다는 뉘앙스가 섞이므로 제안서에서는 피하고 **cost-effective**를 씁니다.\n비슷한 표현: economical, good value for money.',
      },
    ],
  },
  {
    key: 'legal',
    label: '법무 · 계약',
    desc: '계약 검토, 조건 협의, 컴플라이언스 논의에서 쓰는 표현',
    entries: [
      {
        term: 'terms and conditions',
        kr: '계약 조건, 약관',
        level: 'B1',
        collocations: ['agree to the terms', 'under the terms of', 'revise the terms'],
        example: { en: 'Under the terms of the contract, either side can cancel.', kr: '계약 조건에 따르면 양측 모두 해지할 수 있습니다.' },
        note: '항상 복수 terms입니다 — a term은 "용어" 또는 "기간"이라는 다른 뜻이 됩니다.\n구어에서는 T&Cs로 줄여 부릅니다.',
      },
      {
        term: 'liability',
        kr: '책임, 법적 책임',
        level: 'B2',
        collocations: ['limit liability', 'liability cap', 'be liable for'],
        example: { en: 'The contract limits our liability to the annual fee.', kr: '계약은 우리 책임을 연간 수수료로 제한합니다.' },
        note: 'responsibility(일반적 책임)와 달리 **법적·금전적 배상 책임**을 뜻합니다.\n형용사는 liable — We are **liable for** any data loss.(전치사 for)',
      },
      {
        term: 'indemnify',
        kr: '(손해를) 배상하다, 면책하다',
        level: 'C1',
        collocations: ['indemnify against', 'indemnification clause', 'hold harmless'],
        example: { en: 'The vendor agrees to indemnify us against third-party claims.', kr: '업체는 제3자 청구에 대해 우리를 배상하기로 동의합니다.' },
        note: '계약서에서 가장 자주 협상되는 조항입니다. 전치사는 **against**.\n짝 표현 hold harmless와 함께 "indemnify and hold harmless"로 묶여 나옵니다.',
      },
      {
        term: 'breach of contract',
        kr: '계약 위반',
        level: 'B2',
        collocations: ['be in breach of', 'material breach', 'remedy the breach'],
        example: { en: 'Missing the deadline would put us in breach of contract.', kr: '마감을 놓치면 우리가 계약 위반 상태가 됩니다.' },
        note: '"위반하다"는 breach the contract 또는 **be in breach of** the contract.\nmaterial breach(중대한 위반)는 해지 사유가 되는 수준을 뜻합니다.',
      },
      {
        term: 'due diligence',
        kr: '실사, 사전 검토',
        level: 'B2',
        collocations: ['conduct due diligence', 'due diligence process', 'technical due diligence'],
        example: { en: 'We need two weeks to conduct due diligence.', kr: '실사를 진행하려면 2주가 필요합니다.' },
        note: '동사는 **conduct/perform**입니다 — do due diligence도 구어에서는 씁니다.\n인수합병 외에도 벤더 선정·보안 검토 맥락에서 널리 쓰입니다.',
      },
      {
        term: 'NDA',
        kr: '비밀유지계약',
        level: 'B1',
        collocations: ['sign an NDA', 'under NDA', 'mutual NDA'],
        example: { en: "I can share the numbers once we're under NDA.", kr: '비밀유지계약을 체결하면 숫자를 공유할 수 있습니다.' },
        note: 'non-disclosure agreement의 약어. "NDA를 걸다"는 **sign/put in place** an NDA.\n이미 체결된 상태는 **under NDA**(관사 없이).',
      },
      {
        term: 'compliance',
        kr: '규정 준수, 컴플라이언스',
        level: 'B2',
        collocations: ['in compliance with', 'compliance requirements', 'non-compliance'],
        example: { en: 'The setup is in compliance with local data laws.', kr: '이 구성은 현지 데이터 법규를 준수합니다.' },
        note: '전치사는 **with**입니다 — in compliance **to**(X).\n동사형 comply도 with를 씁니다 — We must **comply with** the policy.',
      },
      {
        term: 'clause',
        kr: '조항',
        level: 'B1',
        collocations: ['a termination clause', 'strike out a clause', 'per clause 5.2'],
        example: { en: 'Could we revisit the termination clause?', kr: '해지 조항을 다시 논의할 수 있을까요?' },
        note: '조항 번호를 말할 때는 관사 없이 **per clause 5.2** 또는 under clause 5.2.\n삭제 요청은 strike out / remove, 수정 요청은 amend.',
      },
      {
        term: 'binding',
        kr: '법적 구속력이 있는',
        level: 'B2',
        collocations: ['legally binding', 'non-binding proposal', 'binding agreement'],
        example: { en: 'This quote is non-binding until both sides sign.', kr: '이 견적은 양측이 서명하기 전까지 구속력이 없습니다.' },
        note: '견적·의향서를 보낼 때 리스크를 줄이는 필수 표현입니다.\nLOI(letter of intent)는 보통 non-binding, contract는 legally binding.',
      },
      {
        term: 'governing law',
        kr: '준거법',
        level: 'C1',
        collocations: ['governing law clause', 'be governed by', 'jurisdiction'],
        example: { en: 'The agreement is governed by Korean law.', kr: '본 계약은 대한민국 법의 적용을 받습니다.' },
        note: '수동태 **be governed by**로 씁니다.\n짝 개념 jurisdiction(관할)과 함께 국제 계약에서 가장 먼저 확인하는 항목입니다.',
      },
    ],
  },
  {
    key: 'hr',
    label: 'HR · 조직',
    desc: '채용, 평가, 온보딩, 조직 변화에 관해 말할 때 쓰는 표현',
    entries: [
      {
        term: 'onboarding',
        kr: '입사·도입 초기 적응 과정',
        level: 'B1',
        collocations: ['onboarding process', 'onboard a new hire', 'smooth onboarding'],
        example: { en: 'We shortened onboarding from four weeks to two.', kr: '온보딩 기간을 4주에서 2주로 줄였습니다.' },
        note: '사람에게도 고객에게도 씁니다 — onboard a **new hire** / onboard a **customer**.\n동사 onboard는 목적어를 바로 받습니다(onboard **to**는 불필요).',
      },
      {
        term: 'headcount',
        kr: '인원 수, 정원',
        level: 'B2',
        collocations: ['increase headcount', 'headcount freeze', 'approved headcount'],
        example: { en: "There's a headcount freeze until the next fiscal year.", kr: '다음 회계연도까지 채용 동결 상태입니다.' },
        note: "불가산처럼 씁니다 — headcounts(X)는 부자연스럽습니다.\n'자리(TO)가 없다'는 We don't have the headcount for that role.",
      },
      {
        term: 'performance review',
        kr: '성과 평가',
        level: 'B1',
        collocations: ['annual performance review', 'give feedback', 'set objectives'],
        example: { en: 'Your performance review is scheduled for next Friday.', kr: '성과 평가가 다음 주 금요일로 예정돼 있습니다.' },
        note: 'evaluation은 다소 딱딱하고, 실무에서는 **review**가 표준입니다.\n짝 표현: one-on-one(1:1 면담), OKR/KPI, calibration(평가 조정 회의).',
      },
      {
        term: 'take ownership',
        kr: '주도적으로 책임지고 맡다',
        level: 'B2',
        collocations: ['take ownership of', 'clear ownership', 'own the outcome'],
        example: { en: 'She took ownership of the whole migration.', kr: '그녀가 이관 작업 전체를 주도적으로 맡았습니다.' },
        note: '평가·자기소개에서 가장 높이 평가되는 표현 중 하나입니다. 전치사는 **of**.\n"담당"이라는 사실(be in charge of)보다 **주체적으로 끌고 간다**는 태도를 강조합니다.',
      },
      {
        term: 'attrition / turnover',
        kr: '자연 감소 / 이직률',
        level: 'C1',
        collocations: ['high turnover', 'reduce attrition', 'voluntary attrition'],
        example: { en: 'Turnover dropped after we changed the review process.', kr: '평가 방식을 바꾸고 나서 이직률이 떨어졌습니다.' },
        note: 'turnover는 "이직률"과 "매출액"(영국식) 두 뜻이 있어 문맥이 중요합니다.\nattrition은 퇴사·계약 종료로 자연스럽게 줄어드는 인원을 뜻합니다.',
      },
      {
        term: 'stakeholder',
        kr: '이해관계자',
        level: 'B2',
        collocations: ['key stakeholders', 'align stakeholders', 'stakeholder buy-in'],
        example: { en: 'We need buy-in from all key stakeholders first.', kr: '먼저 주요 이해관계자들의 동의가 필요합니다.' },
        note: '"관계자"를 related people로 직역하면 어색합니다 — stakeholder가 표준입니다.\nbuy-in(동의·지지)과 거의 항상 함께 쓰입니다.',
      },
      {
        term: 'delegate',
        kr: '(업무를) 위임하다',
        level: 'B2',
        collocations: ['delegate tasks to', 'delegate authority', 'effective delegation'],
        example: { en: 'You should delegate the reporting to your team.', kr: '보고 업무는 팀에 위임하는 게 좋겠습니다.' },
        note: '전치사는 **to**입니다 — delegate work **to** someone.\n명사 delegate는 "대표·파견자"라는 다른 뜻이니 문맥을 보세요.',
      },
      {
        term: 'upskill / reskill',
        kr: '역량을 높이다 / 새 직무로 재교육하다',
        level: 'C1',
        collocations: ['upskill the team', 'reskilling program', 'skills gap'],
        example: { en: 'We upskilled the team on cloud security in six weeks.', kr: '6주 만에 팀의 클라우드 보안 역량을 끌어올렸습니다.' },
        note: 'upskill은 같은 직무의 수준을 높이는 것, reskill은 다른 직무로 옮기기 위한 재교육입니다.\n짝 표현: skills gap(역량 격차), enablement(내부 역량 강화).',
      },
      {
        term: 'probation period',
        kr: '수습 기간',
        level: 'B2',
        collocations: ['on probation', 'pass probation', 'three-month probation'],
        example: { en: 'He passed his probation period last month.', kr: '그는 지난달에 수습 기간을 통과했습니다.' },
        note: '법률 문맥의 probation(보호관찰)과 같은 단어라 회사 맥락임을 분명히 하세요.\n영국식으로는 probationary period도 흔합니다.',
      },
      {
        term: 'work-life balance',
        kr: '일과 삶의 균형',
        level: 'B1',
        collocations: ['maintain work-life balance', 'flexible hours', 'burn out'],
        example: { en: 'Flexible hours really improved our work-life balance.', kr: '유연근무제가 일과 삶의 균형을 크게 개선했습니다.' },
        note: '하이픈 두 개를 붙여 한 덩어리로 씁니다.\n"워라밸"은 한국식 축약이라 영어로는 통하지 않습니다 — 반드시 풀어서 말하세요.',
      },
    ],
  },
  {
    key: 'tech',
    label: '기술 · 개발',
    desc: '아키텍처, 배포, 장애 대응, 기술 협의에서 쓰는 표현',
    entries: [
      {
        term: 'deploy',
        kr: '배포하다',
        level: 'B1',
        collocations: ['deploy to production', 'a staged deployment', 'roll back'],
        example: { en: 'We deployed to production on Friday morning.', kr: '금요일 오전에 운영 환경에 배포했습니다.' },
        note: '전치사는 **to** + 환경 — deploy **to** production/staging.\n되돌리는 것은 roll back(동사) / a rollback(명사).',
      },
      {
        term: 'scalability',
        kr: '확장성',
        level: 'B2',
        collocations: ['scale horizontally', 'scale out / scale up', 'a scalable design'],
        example: { en: 'The design scales horizontally without downtime.', kr: '이 설계는 중단 없이 수평 확장됩니다.' },
        note: 'scale **out/horizontally**(서버 대수를 늘림)와 scale **up/vertically**(사양을 높임)는 다릅니다.\n제안서에서 자주 혼용되니 구분해서 쓰면 신뢰가 올라갑니다.',
      },
      {
        term: 'latency',
        kr: '지연 시간',
        level: 'B2',
        collocations: ['reduce latency', 'low-latency', 'p99 latency'],
        example: { en: 'We cut p99 latency from 800ms to 120ms.', kr: 'p99 지연 시간을 800ms에서 120ms로 줄였습니다.' },
        note: 'speed(속도)와 구분됩니다 — latency는 **지연**이라 낮을수록 좋습니다.\n짝 개념: throughput(처리량), bandwidth(대역폭).',
      },
      {
        term: 'downtime / outage',
        kr: '중단 시간 / 장애',
        level: 'B2',
        collocations: ['scheduled downtime', 'a partial outage', 'zero-downtime migration'],
        example: { en: 'We completed a zero-downtime migration last night.', kr: '어젯밤에 무중단 이관을 완료했습니다.' },
        note: 'downtime은 **시간의 길이**, outage는 **사건**입니다.\n계획된 중단은 scheduled/planned downtime, 예고 없는 장애는 unplanned outage.',
      },
      {
        term: 'technical debt',
        kr: '기술 부채',
        level: 'C1',
        collocations: ['pay down technical debt', 'accumulate debt', 'refactor'],
        example: { en: 'We set aside one sprint to pay down technical debt.', kr: '기술 부채를 갚기 위해 스프린트 하나를 배정했습니다.' },
        note: '갚는다는 표현은 **pay down/pay off**를 씁니다(remove가 아님).\n비개발 임원에게 투자 필요성을 설명할 때 매우 효과적인 비유입니다.',
      },
      {
        term: 'root cause',
        kr: '근본 원인',
        level: 'B2',
        collocations: ['identify the root cause', 'root cause analysis', 'a postmortem'],
        example: { en: "We've identified the root cause: an expired API key.", kr: '근본 원인을 찾았습니다 — 만료된 API 키였습니다.' },
        note: '"원인을 찾다"는 find보다 **identify/pinpoint**가 보고체에 맞습니다.\n장애 후 회고 문서는 postmortem 또는 incident report.',
      },
      {
        term: 'provision',
        kr: '(자원을) 프로비저닝하다, 준비하다',
        level: 'C1',
        collocations: ['provision resources', 'auto-provisioning', 'over-provisioned'],
        example: { en: 'The cluster is over-provisioned for current traffic.', kr: '현재 트래픽에 비해 클러스터 자원이 과다 배정돼 있습니다.' },
        note: '법률 문맥의 provision(조항)과 같은 단어라 도메인이 뜻을 결정합니다.\n비용 논의에서는 over-/under-provisioned가 핵심 표현입니다.',
      },
      {
        term: 'workaround',
        kr: '임시 우회 방법',
        level: 'B1',
        collocations: ['a temporary workaround', 'work around the issue', 'a permanent fix'],
        example: { en: "There's a temporary workaround until the patch ships.", kr: '패치가 나올 때까지 임시 우회 방법이 있습니다.' },
        note: '명사는 붙여 쓰고(workaround), 동사는 띄어 씁니다(work around).\n대비되는 표현: a permanent fix / a proper fix.',
      },
      {
        term: 'rollout',
        kr: '단계적 출시, 배포 확대',
        level: 'B2',
        collocations: ['a phased rollout', 'roll out to all users', 'a canary release'],
        example: { en: "We're doing a phased rollout starting with 5% of users.", kr: '사용자 5%부터 시작하는 단계적 출시를 진행합니다.' },
        note: '명사 rollout / 동사 roll out으로 형태가 갈립니다.\n관련 표현: canary release(소수 대상 선행 배포), feature flag(기능 스위치).',
      },
      {
        term: 'end-to-end',
        kr: '처음부터 끝까지, 전 구간',
        level: 'B2',
        collocations: ['end-to-end testing', 'end-to-end encryption', 'own it end to end'],
        example: { en: 'We ran end-to-end tests before the release.', kr: '릴리스 전에 전 구간 테스트를 수행했습니다.' },
        note: '형용사로 쓸 때는 하이픈(end-to-end testing), 부사로 쓸 때는 띄어씁니다(own it end to end).\n줄여서 E2E라고 표기합니다.',
      },
    ],
  },
  {
    "key": "itsales",
    "label": "IT 영업 · 딜",
    "desc": "파이프라인·제안·PoC·수주·갱신까지 딜 사이클에서 쓰는 표현",
    "entries": [
      {
        "term": "pipeline",
        "kr": "영업 파이프라인",
        "level": "B2",
        "collocations": [
          "build a pipeline",
          "pipeline coverage",
          "deals in the pipeline"
        ],
        "example": {
          "en": "We need three times pipeline coverage to hit the quota.",
          "kr": "목표를 달성하려면 파이프라인이 목표의 3배는 있어야 합니다."
        },
        "note": "한국어 '영업 물량'을 volume으로 옮기면 어색합니다 — **pipeline**이 표준입니다.\ncoverage(목표 대비 배수), **funnel**(단계별 깔때기)과 함께 씁니다."
      },
      {
        "term": "qualify",
        "kr": "(딜을) 검증하다, 자격을 가리다",
        "level": "B2",
        "collocations": [
          "qualify a lead",
          "qualify out",
          "qualification criteria"
        ],
        "example": {
          "en": "We qualified out early because there was no budget.",
          "kr": "예산이 없어서 초기에 딜에서 손을 뗐습니다."
        },
        "note": "**qualify in/out**은 '가망을 살린다/접는다'는 뜻의 영업 전문 표현입니다.\n한국어 '검증하다'를 verify로 옮기면 기술 검증 뉘앙스가 되니 구분하세요.\n짝 개념: BANT, MEDDPICC."
      },
      {
        "term": "decision maker",
        "kr": "의사결정권자",
        "level": "B1",
        "collocations": [
          "the economic buyer",
          "reach the decision maker",
          "a champion inside the account"
        ],
        "example": {
          "en": "We still haven't reached the actual decision maker.",
          "kr": "아직 실제 의사결정권자를 만나지 못했습니다."
        },
        "note": "**champion**(우리를 밀어주는 내부 지지자)과 **economic buyer**(예산 결정권자)는 다른 역할입니다.\n'키맨'은 콩글리시라 영어로는 통하지 않습니다 — key stakeholder / decision maker를 쓰세요."
      },
      {
        "term": "RFP",
        "kr": "제안요청서",
        "level": "B1",
        "collocations": [
          "respond to an RFP",
          "submit a bid",
          "RFI / RFQ"
        ],
        "example": {
          "en": "The RFP is due next Friday, so we start drafting today.",
          "kr": "제안요청서 마감이 다음 주 금요일이라 오늘 초안을 시작합니다."
        },
        "note": "**respond to / reply to** an RFP(제안서를 낸다)로 씁니다 — write an RFP은 발주처가 쓰는 쪽입니다.\nRFI(정보 요청) → RFP(제안 요청) → RFQ(견적 요청) 순서로 구분됩니다."
      },
      {
        "term": "PoC",
        "kr": "개념 검증",
        "level": "B2",
        "collocations": [
          "run a PoC",
          "a two-week PoC",
          "PoC success criteria"
        ],
        "example": {
          "en": "Let's agree on the PoC success criteria before we start.",
          "kr": "시작 전에 PoC 성공 기준부터 합의하시죠."
        },
        "note": "**주의**: POC는 point of contact(담당자)의 약어이기도 합니다. 혼동을 피하려면 검증은 **PoC**, 담당자는 풀어서 point of contact라고 말하세요.\n성공 기준(success criteria)을 먼저 못 박는 것이 영업의 핵심입니다."
      },
      {
        "term": "quote",
        "kr": "견적(서), 견적을 내다",
        "level": "B1",
        "collocations": [
          "issue a quote",
          "a formal quotation",
          "rate card"
        ],
        "example": {
          "en": "I'll issue a formal quote by Wednesday.",
          "kr": "수요일까지 정식 견적서를 보내드리겠습니다."
        },
        "note": "구어는 **quote**, 문서상 정식 명칭은 **quotation**입니다.\n'단가표'는 **rate card**, '단가'는 unit price / hourly rate.\nestimate는 개략 추정치라 구속력이 약합니다."
      },
      {
        "term": "close a deal",
        "kr": "딜을 성사시키다",
        "level": "B2",
        "collocations": [
          "closed-won / closed-lost",
          "the deal slipped",
          "close out the quarter"
        ],
        "example": {
          "en": "The deal slipped to next quarter because of the budget freeze.",
          "kr": "예산 동결로 딜이 다음 분기로 밀렸습니다."
        },
        "note": "성사는 **closed-won**, 실패는 **closed-lost**로 CRM 용어처럼 씁니다.\n**slip**(일정이 밀리다)은 영업에서 매우 자주 쓰이는 동사입니다."
      },
      {
        "term": "win the deal",
        "kr": "수주하다",
        "level": "B2",
        "collocations": [
          "win / lose the deal",
          "lose out to a competitor",
          "secure the contract"
        ],
        "example": {
          "en": "We won the deal on architecture, not on price.",
          "kr": "가격이 아니라 아키텍처로 수주했습니다."
        },
        "note": "'수주'를 order로 직역하면 어색합니다 — **win the deal / secure the contract**가 자연스럽습니다.\n경쟁사에 밀린 경우는 **lose out to** + 회사명."
      },
      {
        "term": "renewal",
        "kr": "계약 갱신",
        "level": "B2",
        "collocations": [
          "up for renewal",
          "renewal rate",
          "churn risk"
        ],
        "example": {
          "en": "Their contract is up for renewal in March.",
          "kr": "그쪽 계약은 3월에 갱신 시점입니다."
        },
        "note": "갱신 시점이 다가온 상태는 **be up for renewal**.\n이탈은 **churn**, 이탈 위험 고객은 at-risk account.\n갱신율(renewal rate)과 유지율(retention rate)은 같은 계열 지표입니다."
      },
      {
        "term": "upsell / cross-sell",
        "kr": "상위 상품 판매 / 연계 판매",
        "level": "B2",
        "collocations": [
          "upsell to a higher tier",
          "cross-sell managed services",
          "land and expand"
        ],
        "example": {
          "en": "We landed with migration and expanded into managed services.",
          "kr": "이관으로 진입해서 매니지드 서비스로 확장했습니다."
        },
        "note": "**upsell**은 같은 제품의 상위 등급, **cross-sell**은 다른 제품을 붙이는 것입니다.\n**land and expand**는 작게 시작해 계정을 키우는 전형적인 클라우드 영업 전략입니다."
      }
    ]
  },
  {
    "key": "cloud",
    "label": "클라우드 · 인프라",
    "desc": "이관·아키텍처·가용성·규제 요건을 설명할 때 쓰는 표현",
    "entries": [
      {
        "term": "workload",
        "kr": "워크로드(업무 시스템 단위)",
        "level": "B2",
        "collocations": [
          "migrate workloads",
          "production workload",
          "mission-critical workload"
        ],
        "example": {
          "en": "We're migrating three production workloads this quarter.",
          "kr": "이번 분기에 운영 워크로드 3개를 이관합니다."
        },
        "note": "한국어 '시스템'을 system으로만 말하면 범위가 모호합니다 — 클라우드 논의에서는 **workload**가 표준 단위입니다.\nmission-critical(업무 필수), non-prod(비운영)로 등급을 나눕니다."
      },
      {
        "term": "lift and shift",
        "kr": "(재설계 없이) 그대로 이관",
        "level": "B2",
        "collocations": [
          "rehost / replatform / refactor",
          "a lift-and-shift approach",
          "modernize later"
        ],
        "example": {
          "en": "We'll lift and shift first, then modernize in phase two.",
          "kr": "우선 그대로 이관하고 2단계에서 현대화하겠습니다."
        },
        "note": "이관 전략 6R 중 **rehost**의 구어 표현입니다.\nreplatform(약간 손봄) → refactor(재설계) 순으로 난이도가 올라갑니다.\n'마이그레이션만 한다'는 뉘앙스라 부정적으로 들릴 수 있어, 뒤에 modernize 계획을 붙이는 것이 좋습니다."
      },
      {
        "term": "landing zone",
        "kr": "랜딩 존(초기 계정·네트워크 기반 구성)",
        "level": "C1",
        "collocations": [
          "set up a landing zone",
          "guardrails",
          "multi-account strategy"
        ],
        "example": {
          "en": "The landing zone gives us guardrails before teams start building.",
          "kr": "랜딩 존을 깔아두면 팀들이 개발을 시작하기 전에 가드레일이 생깁니다."
        },
        "note": "직역하면 뜻이 안 통하는 업계 용어입니다 — 계정 구조·네트워크·보안 기준을 미리 깔아두는 기반 환경을 뜻합니다.\n짝 표현: **guardrails**(강제 정책), blast radius(장애 영향 범위)."
      },
      {
        "term": "managed service",
        "kr": "매니지드 서비스(운영 대행)",
        "level": "B1",
        "collocations": [
          "a fully managed service",
          "offload the operations",
          "shared responsibility"
        ],
        "example": {
          "en": "A managed service offloads patching and monitoring to us.",
          "kr": "매니지드 서비스로 패치와 모니터링을 저희가 대신 맡습니다."
        },
        "note": "**fully managed**(완전 관리형)는 고객이 서버를 직접 안 만진다는 뜻입니다.\n영업 화법의 핵심 동사는 **offload**(부담을 덜어준다)입니다.\nIaaS/PaaS/SaaS와 함께 책임 범위를 설명하세요."
      },
      {
        "term": "high availability",
        "kr": "고가용성",
        "level": "B2",
        "collocations": [
          "multi-AZ",
          "failover",
          "RTO / RPO"
        ],
        "example": {
          "en": "Multi-AZ gives us failover without manual intervention.",
          "kr": "다중 가용영역 구성이라 수동 개입 없이 장애 조치가 됩니다."
        },
        "note": "HA로 줄여 말합니다. **failover**(장애 시 전환)와 **disaster recovery**(재해 복구)는 다른 층위입니다.\nRTO(복구 목표 시간)·RPO(복구 목표 시점)는 반드시 숫자로 합의하세요."
      },
      {
        "term": "autoscaling",
        "kr": "오토스케일링(자동 확장)",
        "level": "B2",
        "collocations": [
          "scale out automatically",
          "handle spiky traffic",
          "scaling policy"
        ],
        "example": {
          "en": "Autoscaling handles the spiky traffic during promotions.",
          "kr": "프로모션 기간의 급증 트래픽은 오토스케일링이 처리합니다."
        },
        "note": "**spiky/bursty traffic**(급증 트래픽)이 짝 표현입니다.\nscale out(대수 증가) ↔ scale up(사양 증가) 구분은 여기서도 그대로 적용됩니다."
      },
      {
        "term": "data residency",
        "kr": "데이터 소재지(국내 보관 요건)",
        "level": "C1",
        "collocations": [
          "data residency requirements",
          "in-country",
          "cross-border transfer"
        ],
        "example": {
          "en": "Their data residency requirements mean we must stay in-country.",
          "kr": "데이터 소재지 요건 때문에 국내 리전에 있어야 합니다."
        },
        "note": "금융·공공 딜에서 거의 항상 나오는 제약 조건입니다.\nresidency(어디에 저장되는가)와 sovereignty(어느 나라 법의 지배를 받는가)는 다릅니다."
      },
      {
        "term": "on-premises",
        "kr": "온프레미스(자체 전산실)",
        "level": "B1",
        "collocations": [
          "on-prem environment",
          "hybrid setup",
          "repatriation"
        ],
        "example": {
          "en": "They run a hybrid setup with on-prem databases.",
          "kr": "데이터베이스는 온프레미스로 두는 하이브리드 구성입니다."
        },
        "note": "**on-premise**(단수)는 흔한 오기이고 정확한 형태는 **on-premises**입니다. 구어로는 on-prem.\n클라우드에서 되돌아가는 흐름은 repatriation."
      },
      {
        "term": "SLA",
        "kr": "서비스 수준 협약",
        "level": "B1",
        "collocations": [
          "meet the SLA",
          "breach the SLA",
          "99.9% uptime"
        ],
        "example": {
          "en": "We commit to 99.9% uptime under the SLA.",
          "kr": "SLA상 99.9% 가동률을 보장합니다."
        },
        "note": "약속을 지키는 것은 **meet/hit** the SLA, 어기는 것은 **breach/miss**입니다.\n보상은 service credits(요금 크레딧)로 처리하는 것이 일반적입니다."
      },
      {
        "term": "well-architected review",
        "kr": "아키텍처 점검(모범사례 진단)",
        "level": "C1",
        "collocations": [
          "run a review",
          "remediation items",
          "best practices"
        ],
        "example": {
          "en": "The review surfaced twelve remediation items, mostly on security.",
          "kr": "점검에서 개선 항목 12개가 나왔고 대부분 보안이었습니다."
        },
        "note": "무료 진단으로 다음 프로젝트를 여는 전형적인 영업 도구입니다.\n발견 사항은 **findings**, 개선 조치는 **remediation**이라고 부릅니다."
      }
    ]
  },
  {
    "key": "finops",
    "label": "FinOps · 비용",
    "desc": "TCO·약정 할인·비용 최적화와 과금 구조를 논의할 때 쓰는 표현",
    "entries": [
      {
        "term": "TCO",
        "kr": "총소유비용",
        "level": "B2",
        "collocations": [
          "a TCO comparison",
          "over three years",
          "hidden costs"
        ],
        "example": {
          "en": "The three-year TCO is 22% lower than the current setup.",
          "kr": "3년 총소유비용이 현재 구성보다 22% 낮습니다."
        },
        "note": "total cost of ownership. 단순 요금(price)이 아니라 **인건비·라이선스·전력·유지보수까지 합산**한 개념이라 설득력이 큽니다.\n짝 지표: ROI, payback period."
      },
      {
        "term": "committed spend",
        "kr": "약정 사용액",
        "level": "C1",
        "collocations": [
          "a committed spend agreement",
          "commit to $X over N years",
          "discount tier"
        ],
        "example": {
          "en": "A three-year committed spend unlocks the next discount tier.",
          "kr": "3년 약정 사용액을 걸면 다음 할인 구간이 열립니다."
        },
        "note": "'약정'을 contract로만 말하면 금액 약정이라는 뜻이 안 삽니다 — **commitment / committed spend**가 정확합니다.\n미달분 정산은 **true-up**, 초과분은 overage."
      },
      {
        "term": "Savings Plans / Reserved Instances",
        "kr": "약정 할인 상품",
        "level": "B2",
        "collocations": [
          "coverage and utilization",
          "commit for one or three years",
          "break-even point"
        ],
        "example": {
          "en": "Coverage is 60%, but utilization is only 80%.",
          "kr": "커버리지는 60%인데 사용률은 80%밖에 안 됩니다."
        },
        "note": "**coverage**(할인 적용 비율)와 **utilization**(약정을 얼마나 쓰는가)은 전혀 다른 지표인데 한국어로는 둘 다 '사용률'로 뭉뚱그려지기 쉽습니다.\n둘을 나눠 말하면 전문성이 바로 드러납니다."
      },
      {
        "term": "rightsizing",
        "kr": "적정 규모 조정",
        "level": "B2",
        "collocations": [
          "rightsize instances",
          "over-provisioned",
          "idle resources"
        ],
        "example": {
          "en": "Rightsizing idle instances cut 18% with no performance impact.",
          "kr": "유휴 인스턴스를 적정화해 성능 영향 없이 18%를 줄였습니다."
        },
        "note": "'다운사이징'은 인력 감축 뉘앙스가 있어 비용 최적화 문맥에서는 부적절합니다 — **rightsizing**을 쓰세요.\n짝 표현: over-/under-provisioned, idle."
      },
      {
        "term": "chargeback / showback",
        "kr": "비용 전가 / 비용 가시화",
        "level": "C1",
        "collocations": [
          "cost allocation tags",
          "chargeback model",
          "showback report"
        ],
        "example": {
          "en": "We started with showback before moving to full chargeback.",
          "kr": "전면 전가 전에 우선 비용 가시화부터 시작했습니다."
        },
        "note": "**showback**은 '너희 팀이 이만큼 썼다'를 보여만 주는 단계, **chargeback**은 실제로 예산에서 차감하는 단계입니다.\n전제 조건은 cost allocation tags(비용 태그) 정리."
      },
      {
        "term": "egress fee",
        "kr": "데이터 유출(외부 전송) 요금",
        "level": "B2",
        "collocations": [
          "data transfer out",
          "egress charges",
          "inter-region traffic"
        ],
        "example": {
          "en": "Most of the surprise bill came from egress charges.",
          "kr": "예상 밖 청구서의 대부분은 외부 전송 요금이었습니다."
        },
        "note": "들어오는 트래픽(ingress)은 대개 무료, **나가는 트래픽(egress)** 이 과금됩니다.\n한국어로 '아웃바운드 트래픽 비용'이라고 하면 통하지만, 영어 문서에서는 egress / data transfer out이 표준입니다."
      },
      {
        "term": "on-demand vs spot",
        "kr": "온디맨드 vs 스팟",
        "level": "B2",
        "collocations": [
          "spot interruption",
          "fault-tolerant workloads",
          "up to 90% cheaper"
        ],
        "example": {
          "en": "Batch jobs run on spot since they tolerate interruption.",
          "kr": "배치 작업은 중단을 견디니 스팟으로 돌립니다."
        },
        "note": "스팟은 **interruption**(회수) 가능성이 핵심 리스크라, 반드시 fault-tolerant(중단 감내) 워크로드에만 권해야 합니다.\n무턱대고 싸다고 제안하면 사고로 이어집니다."
      },
      {
        "term": "funding / credits",
        "kr": "지원금 · 크레딧",
        "level": "B2",
        "collocations": [
          "migration credits",
          "POC funding",
          "apply for funding"
        ],
        "example": {
          "en": "We can apply for migration credits to offset the PoC cost.",
          "kr": "이관 크레딧을 신청해 PoC 비용을 상쇄할 수 있습니다."
        },
        "note": "'지원받다'를 support로 옮기면 기술 지원처럼 들립니다 — 금전 지원은 **funding / credits**입니다.\n동사는 **apply for**(신청) / **offset**(상쇄)."
      },
      {
        "term": "consolidated billing",
        "kr": "통합 과금",
        "level": "B2",
        "collocations": [
          "a single invoice",
          "billing account",
          "volume discount"
        ],
        "example": {
          "en": "Consolidated billing gives them one invoice and volume discounts.",
          "kr": "통합 과금으로 청구서 하나에 물량 할인까지 받습니다."
        },
        "note": "계열사·부서가 많은 고객에게 효과적인 제안 포인트입니다.\ninvoice(청구서), PO(발주서), billing cycle(과금 주기)을 함께 정리해 말하세요."
      },
      {
        "term": "run rate",
        "kr": "연환산 지출 속도",
        "level": "C1",
        "collocations": [
          "annual run rate",
          "monthly cloud spend",
          "trending up"
        ],
        "example": {
          "en": "Their monthly run rate is trending up about 8% per quarter.",
          "kr": "월간 지출 속도가 분기당 8%가량 상승 추세입니다."
        },
        "note": "**burn rate**(현금 소진)와 달리 run rate는 '현재 속도를 연으로 환산하면'이라는 뜻입니다.\nARR(연간 반복 매출)과 헷갈리지 않게 문맥을 분명히 하세요."
      }
    ]
  },
  {
    "key": "konglish",
    "label": "콩글리시 교정",
    "desc": "한국 IT 업계에서 쓰지만 영어로는 통하지 않는 표현 바로잡기",
    "entries": [
      {
        "term": "systems integration (SI)",
        "kr": "시스템 통합(SI)",
        "level": "B2",
        "collocations": [
          "a systems integrator",
          "an SI partner",
          "implementation partner"
        ],
        "example": {
          "en": "We work with a local systems integrator on delivery.",
          "kr": "구축은 현지 시스템 통합 업체와 함께 진행합니다."
        },
        "note": "**주의**: 한국에서 흔히 쓰는 'SI'는 영어권에서 그대로 말하면 잘 통하지 않습니다.\n풀어서 **systems integrator**(회사) / **systems integration**(업무)이라고 하거나, implementation partner라고 부르세요."
      },
      {
        "term": "implement / build",
        "kr": "구축하다",
        "level": "B1",
        "collocations": [
          "implement the solution",
          "build the environment",
          "roll out"
        ],
        "example": {
          "en": "We implemented the environment in six weeks.",
          "kr": "6주 만에 환경을 구축했습니다."
        },
        "note": "'구축'을 **construct**로 옮기면 건설 공사처럼 들립니다.\nIT에서는 **implement / build / set up / deploy**를 씁니다.\n'구축비'는 implementation cost."
      },
      {
        "term": "point of contact",
        "kr": "담당자",
        "level": "B1",
        "collocations": [
          "the main point of contact",
          "reach out to",
          "working-level contact"
        ],
        "example": {
          "en": "Who is the main point of contact on their side?",
          "kr": "그쪽 주 담당자가 누구신가요?"
        },
        "note": "'담당자'를 person in charge로 직역하면 어색하고 다소 권위적으로 들립니다 — **point of contact**(POC)가 표준입니다.\n실무자는 **working-level contact**, 임원은 executive / C-level."
      },
      {
        "term": "client / customer",
        "kr": "고객사",
        "level": "B1",
        "collocations": [
          "our client",
          "the customer's requirements",
          "account"
        ],
        "example": {
          "en": "The client asked for a phased rollout.",
          "kr": "고객사가 단계적 출시를 요청했습니다."
        },
        "note": "'고객사'를 **customer company**로 직역하지 마세요 — client 또는 customer 하나면 충분합니다.\n영업 관리 단위로 말할 때는 **account**(담당 계정)."
      },
      {
        "term": "vendor",
        "kr": "벤더, 공급업체",
        "level": "B1",
        "collocations": [
          "a third-party vendor",
          "vendor lock-in",
          "vendor management"
        ],
        "example": {
          "en": "We want to avoid vendor lock-in on the database layer.",
          "kr": "데이터베이스 계층에서는 벤더 종속을 피하고 싶습니다."
        },
        "note": "'벤더사'는 vendor(업체)에 '사'가 겹친 중복 표현이라 영어로는 **vendor**만 씁니다.\n**vendor lock-in**(특정 업체 종속)은 클라우드 딜의 단골 반론입니다."
      },
      {
        "term": "sign-off / acceptance",
        "kr": "검수, 승인",
        "level": "B2",
        "collocations": [
          "get sign-off from",
          "acceptance testing",
          "formal approval"
        ],
        "example": {
          "en": "We need sign-off from the client before we invoice.",
          "kr": "청구 전에 고객사 검수 승인이 필요합니다."
        },
        "note": "'검수'를 inspection으로 옮기면 품질 검사처럼 들립니다 — **acceptance (testing)** 또는 **sign-off**가 정확합니다.\n사내 결재·품의는 **internal approval**."
      },
      {
        "term": "maintenance and support",
        "kr": "유지보수",
        "level": "B1",
        "collocations": [
          "M&S contract",
          "ongoing support",
          "support tier"
        ],
        "example": {
          "en": "The quote includes one year of maintenance and support.",
          "kr": "견적에는 1년 유지보수가 포함돼 있습니다."
        },
        "note": "'유지보수'를 maintenance 하나로만 쓰면 하드웨어 정비처럼 들립니다 — 계약서에서는 **maintenance and support(M&S)** 로 묶어 씁니다.\n등급은 support tier(예: 24/7, business hours)."
      },
      {
        "term": "place an order / issue a PO",
        "kr": "발주하다",
        "level": "B2",
        "collocations": [
          "issue a purchase order",
          "place an order",
          "PO number"
        ],
        "example": {
          "en": "They'll issue the PO once the budget is approved.",
          "kr": "예산 승인이 나면 발주서를 발행할 예정입니다."
        },
        "note": "'발주'는 **issue a PO / place an order**, '수주'는 win the deal / receive an order로 방향이 반대입니다.\n실무에서는 PO number(발주 번호)를 반드시 확인하세요."
      },
      {
        "term": "align on",
        "kr": "협의해 맞추다",
        "level": "B2",
        "collocations": [
          "align on the timeline",
          "get alignment",
          "internal alignment"
        ],
        "example": {
          "en": "Let's align on the timeline before we talk to the client.",
          "kr": "고객사와 얘기하기 전에 일정부터 맞추시죠."
        },
        "note": "'협의하다'를 discuss로만 쓰면 '논의는 했지만 결론은 없음'처럼 들립니다.\n**align on**은 '합의해 같은 방향으로 맞춘다'는 뜻이라 회의 목적을 분명히 해 줍니다."
      },
      {
        "term": "follow up",
        "kr": "후속 조치하다, 팔로업하다",
        "level": "B1",
        "collocations": [
          "follow up with the client",
          "a follow-up meeting",
          "circle back"
        ],
        "example": {
          "en": "I'll follow up with them early next week.",
          "kr": "다음 주 초에 그쪽에 후속 연락을 드리겠습니다."
        },
        "note": "동사는 띄어쓰기(follow up), 명사·형용사는 하이픈(a follow-up).\n'다시 연락드리겠습니다'는 **circle back** / get back to you도 자주 씁니다.\n한국식 '팔로업 치다'는 영어에 없는 표현입니다."
      }
    ]
  },
  {
    key: 'ai-data',
    label: 'AI · 데이터',
    desc: 'AI 도입 상담과 데이터 플랫폼 논의에서 쓰는 표현',
    entries: [
      {
        term: 'inference',
        kr: '추론(모델 실행)',
        level: 'B2',
        collocations: ['inference cost', 'run inference', 'inference latency'],
        example: { en: 'Inference costs dropped 40% after we switched models.', kr: '모델을 바꾼 뒤 추론 비용이 40% 줄었습니다.' },
        note: '학습(training)과 추론(inference)은 비용 구조가 다릅니다 — 고객 미팅에서 이 둘을 섞어 쓰면 신뢰를 잃습니다.\n"모델을 돌린다"는 run inference가 자연스럽습니다.',
      },
      {
        term: 'fine-tuning',
        kr: '미세 조정',
        level: 'B2',
        collocations: ['fine-tune a model', 'fine-tuning data', 'fine-tuned on'],
        example: { en: 'We fine-tuned the model on your support tickets.', kr: '귀사의 고객 문의 데이터로 모델을 미세 조정했습니다.' },
        note: '커스터마이징(customize)보다 구체적인 기술 용어입니다.\n"~데이터로 튜닝했다"는 fine-tuned **on** — 전치사 on을 빼면 어색합니다.',
      },
      {
        term: 'hallucination',
        kr: '환각(AI의 그럴듯한 오답)',
        level: 'B2',
        collocations: ['reduce hallucinations', 'hallucination rate', 'ground the model'],
        example: { en: 'Grounding the model on your docs reduces hallucinations.', kr: '귀사 문서에 기반을 두면 환각이 줄어듭니다.' },
        note: '고객이 가장 걱정하는 리스크라 정확히 발음해 두면 좋습니다(할루서네이션).\n대응책으로는 ground(근거를 대다)·guardrail(안전장치)이 함께 나옵니다.',
      },
      {
        term: 'pipeline',
        kr: '(데이터) 파이프라인',
        level: 'B1',
        collocations: ['data pipeline', 'build a pipeline', 'pipeline breaks'],
        example: { en: 'The nightly pipeline feeds the dashboard by 7 AM.', kr: '야간 파이프라인이 아침 7시까지 대시보드에 데이터를 공급합니다.' },
        note: '영업 파이프라인(sales pipeline)과 데이터 파이프라인은 완전히 다른 말입니다 — 문맥을 분명히 하세요.\n"파이프라인이 깨졌다"는 the pipeline broke/failed.',
      },
      {
        term: 'ingestion',
        kr: '(데이터) 수집·적재',
        level: 'C1',
        collocations: ['data ingestion', 'ingest logs', 'real-time ingestion'],
        example: { en: 'We ingest about two terabytes of logs per day.', kr: '하루 약 2테라바이트의 로그를 수집합니다.' },
        note: '단순히 collect보다 "시스템 안으로 넣는다"는 뉘앙스의 기술 용어입니다.\n동사는 ingest, 명사는 ingestion.',
      },
      {
        term: 'latency',
        kr: '지연 시간',
        level: 'B2',
        collocations: ['low latency', 'latency spike', 'p99 latency'],
        example: { en: 'P99 latency stayed under 200 milliseconds during the test.', kr: '테스트 동안 P99 지연이 200밀리초 이내로 유지됐습니다.' },
        note: '"느리다"를 slow로만 말하면 아마추어처럼 들립니다 — 수치와 함께 latency를 쓰세요.\np99(상위 1% 최악 케이스) 같은 백분위 표현은 기술 미팅의 공용어입니다.',
      },
      {
        term: 'throughput',
        kr: '처리량',
        level: 'C1',
        collocations: ['high throughput', 'throughput per second', 'trade latency for throughput'],
        example: { en: 'Batch mode doubles throughput at the cost of latency.', kr: '배치 모드는 지연을 대가로 처리량을 두 배로 만듭니다.' },
        note: 'latency(한 건의 속도)와 throughput(단위 시간당 총량)은 반대로 움직이는 경우가 많습니다.\n이 트레이드오프를 영어로 설명할 수 있으면 기술 신뢰도가 크게 올라갑니다.',
      },
      {
        term: 'governance',
        kr: '(데이터) 거버넌스',
        level: 'B2',
        collocations: ['data governance', 'governance policy', 'access control'],
        example: { en: 'Data governance is often the real blocker, not the technology.', kr: '진짜 걸림돌은 기술이 아니라 데이터 거버넌스인 경우가 많습니다.' },
        note: '"누가 어떤 데이터에 접근할 수 있는가"의 체계 전반을 가리킵니다.\n금융·공공 고객 미팅에서는 빠지지 않는 단어입니다.',
      },
      {
        term: 'benchmark',
        kr: '벤치마크, 성능 비교',
        level: 'B1',
        collocations: ['run a benchmark', 'benchmark against', 'industry benchmark'],
        example: { en: 'We benchmarked three models against your current setup.', kr: '현재 구성 대비 세 가지 모델을 벤치마크했습니다.' },
        note: '"~와 비교해서"는 benchmark **against**.\n명사로도 동사로도 쓰입니다 — run a benchmark / we benchmarked it.',
      },
      {
        term: 'proof of concept',
        kr: '개념 검증(PoC)',
        level: 'B1',
        collocations: ['run a PoC', 'PoC scope', 'graduate to production'],
        example: { en: 'The PoC graduated to production in six weeks.', kr: 'PoC가 6주 만에 운영 단계로 넘어갔습니다.' },
        note: '피오씨가 아니라 "피 오 씨" 또는 proof of concept로 또박또박.\nPoC가 성공해 운영으로 가는 것을 graduate to production이라고 하면 세련됩니다.',
      },
    ],
  },
  {
    key: 'negotiation',
    label: '협상 · 클로징',
    desc: '가격 협상과 계약 마무리 단계에서 쓰는 표현',
    entries: [
      {
        term: 'concession',
        kr: '양보(조건)',
        level: 'C1',
        collocations: ['make a concession', 'mutual concessions', 'concession in return'],
        example: { en: 'Every concession should get something in return.', kr: '모든 양보는 반대급부를 받아야 합니다.' },
        note: '할인해 준다를 give a discount로만 말하면 일방적입니다 — concession은 "교환하는 양보"라는 협상 프레임을 만듭니다.',
      },
      {
        term: 'leverage',
        kr: '지렛대, 협상력',
        level: 'B2',
        collocations: ['negotiating leverage', 'use as leverage', 'leverage our scale'],
        example: { en: 'The renewal date gives us some leverage.', kr: '갱신 시점이 우리에게 협상력을 줍니다.' },
        note: '동사로 쓰면 "~을 활용하다"(leverage our partnership).\n비즈니스 영어 최빈출 단어 중 하나 — 명사·동사 둘 다 익혀 두세요.',
      },
      {
        term: 'walk away',
        kr: '(협상에서) 물러나다',
        level: 'B1',
        collocations: ['walk away from the deal', 'walk-away point', 'willing to walk away'],
        example: { en: 'We need to know our walk-away point before the meeting.', kr: '미팅 전에 우리의 마지노선을 알아야 합니다.' },
        note: 'walk-away point는 "여기 밑으로는 안 한다"는 한계선입니다.\n"깨질 각오가 되어 있다"는 willing to walk away — 협상에서 가장 강한 카드입니다.',
      },
      {
        term: 'deal-breaker',
        kr: '거래를 깨는 조건',
        level: 'B1',
        collocations: ['a real deal-breaker', 'that would be a deal-breaker', 'no deal-breakers'],
        example: { en: 'Is the data residency requirement a deal-breaker?', kr: '데이터 국내 보관 요건이 결정적 조건인가요?' },
        note: '"이거 안 되면 계약 못 한다" 수준의 조건을 가리킵니다.\n질문으로 쓰면 상대의 진짜 우선순위를 빠르게 알 수 있습니다.',
      },
      {
        term: 'sweeten the deal',
        kr: '조건을 더 얹다',
        level: 'B2',
        collocations: ['sweeten the offer', 'to sweeten the deal', 'throw in'],
        example: { en: 'To sweeten the deal, we can throw in three months of support.', kr: '조건을 좋게 하기 위해 3개월 지원을 얹어드릴 수 있습니다.' },
        note: 'throw in(덤으로 얹다)과 세트로 쓰입니다.\n격식 문서에는 안 쓰지만, 미팅 구어에서는 아주 자연스럽습니다.',
      },
      {
        term: 'sign off',
        kr: '(최종) 승인하다',
        level: 'B1',
        collocations: ['sign off on the budget', 'get sign-off', 'who signs off'],
        example: { en: 'Who needs to sign off on this before we proceed?', kr: '진행 전에 누구의 승인이 필요한가요?' },
        note: 'approve보다 구어적이고 "서명해서 확정한다"는 뉘앙스입니다.\n전치사 on을 붙입니다 — sign off **on** the proposal.',
      },
      {
        term: 'procurement',
        kr: '구매(부서·절차)',
        level: 'B2',
        collocations: ['procurement process', 'go through procurement', 'procurement team'],
        example: { en: 'How long does your procurement process usually take?', kr: '귀사 구매 절차는 보통 얼마나 걸리나요?' },
        note: '한국의 "구매팀"에 해당하는 부서이자 절차입니다.\nB2B 딜의 마지막 관문이라, 일정 협의 때 반드시 물어봐야 하는 단어입니다.',
      },
      {
        term: 'redline',
        kr: '(계약서) 수정 요청 표시',
        level: 'C1',
        collocations: ['redline the contract', 'send back redlines', 'accept the redlines'],
        example: { en: 'Legal sent back the contract with a few redlines.', kr: '법무팀이 몇 군데 수정 표시와 함께 계약서를 돌려보냈습니다.' },
        note: '계약서에 빨간 줄로 수정을 표시하던 관행에서 온 말로, 동사로도 씁니다.\n"수정 요청이 왔다"는 we got redlines back.',
      },
      {
        term: 'mutually beneficial',
        kr: '상호 이익이 되는',
        level: 'B2',
        collocations: ['mutually beneficial partnership', 'win-win', 'work for both sides'],
        example: { en: "Let's structure this so it's mutually beneficial.", kr: '양쪽 모두에게 이익이 되도록 구조를 잡아보시죠.' },
        note: 'win-win은 다소 진부하게 들릴 수 있어, 격식 있는 자리에서는 mutually beneficial이 안전합니다.\n구어로는 work for both sides도 자연스럽습니다.',
      },
      {
        term: 'follow through',
        kr: '(약속을) 끝까지 이행하다',
        level: 'B1',
        collocations: ['follow through on commitments', 'follow-through', 'deliver on'],
        example: { en: 'We closed the deal because we followed through on every promise.', kr: '모든 약속을 끝까지 지켰기 때문에 계약을 따냈습니다.' },
        note: 'follow up(후속 연락)과 혼동 주의 — follow through는 "약속한 것을 실제로 해내는 것"입니다.\n유의어 deliver on(약속을 지키다)도 함께 익혀 두세요.',
      },
    ],
  },
];

/** 도메인 키로 찾기 — 없으면 첫 도메인. */
export function domainByKey(key: string): VocabDomain {
  return VOCAB_DOMAINS.find((d) => d.key === key) ?? VOCAB_DOMAINS[0];
}

export const VOCAB_TOTAL = VOCAB_DOMAINS.reduce((n, d) => n + d.entries.length, 0);
