/**
 * 직무 도메인 어휘 뱅크 — 재무·법무·HR·기술.
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
];

/** 도메인 키로 찾기 — 없으면 첫 도메인. */
export function domainByKey(key: string): VocabDomain {
  return VOCAB_DOMAINS.find((d) => d.key === key) ?? VOCAB_DOMAINS[0];
}

export const VOCAB_TOTAL = VOCAB_DOMAINS.reduce((n, d) => n + d.entries.length, 0);
