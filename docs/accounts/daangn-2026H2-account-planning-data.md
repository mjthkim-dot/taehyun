# 당근 / 당근페이 — 2026 하반기 Account Planning 데이터 수집

- **수집일:** 2026-09-22
- **목적:** 9/29(화) 당근마켓 Account Plan Review (1·2부문 합동 단일 세션) 대비
- **작성:** 김태현 (Cross Industry)
- **원칙:** 검증된 출처만 기재. 미확인 항목은 `[CONFIRM]` 표기.

---

## 0. 한 줄 요약

당근의 **메인 DW는 BigQuery(GCP)**인데 **워크로드 인프라는 AWS**다. 2026년 내내 데이터·AI 플랫폼을 전면 재설계 중이고, 우리는 이미 **AWS SCA GenAI Fund 3건 = USD 750,000**을 확보해 두고도 **아직 고객에 적용하지 못했다.** 2026 하반기 플랜의 축은 "DW 전환 + AI 워크로드 Winback"이며, 펀드 소진 계획이 곧 딜 플랜이다.

---

## 1. 실적 및 사업 현황 (verified)

### 1-1. 2025년 연간 실적 (2026.3.27 발표)

| 구분 | 금액 | YoY |
|---|---|---|
| 연결 매출 | 2,707억 원 | +43% |
| 연결 영업이익 | 146억 원 | +481% |
| 연결 당기순이익 | 230억 원 | — |
| **별도 매출** | 2,690억 원 | +42% |
| **별도 영업이익** | 671억 원 | +78% |

> 별도 671억 vs 연결 146억. **차이 약 525억이 자회사(당근페이·캐롯 해외법인) 적자**다. 본체는 광고로 흑자를 굳혔지만 연결 수익성은 자회사가 깎아먹는 구조.

출처: [당근 보도자료](https://about.daangn.com/company/pr/archive/%EB%8B%B9%EA%B7%BC-2025%EB%85%84-%EC%97%B0%EA%B0%84-%EC%8B%A4%EC%A0%81-%EB%B0%9C%ED%91%9C/), [바이라인네트워크](https://byline.network/2026/03/27_192874-2/), [플래텀](https://platum.kr/archives/284275), [디지털데일리](https://m.ddaily.co.kr/page/view/2026032717273655963)

### 1-2. 2026년 실적

- **2026 1Q 연결 총매출 783억 8,177만 원** — 출처: [Investing.com 공시](https://kr.investing.com/news/global-filings/article-93CH-1964745)
- **2026 상반기 영업이익 약 200억 원** `[CONFIRM]` — 딜사이트 보도, 원문 접근 차단(프록시)으로 수치 재확인 필요
- 2026 2Q 개별 실적 공식 수치 미확보 `[CONFIRM]`

### 1-3. 성장 지표 (2025 기준)

- 중고거래 **1억 9,000만 건**
- 당근알바 지원 **5,000만 회 돌파**
- 광고주 수 **+37%**, 집행 광고 수 **+29%**
- 비즈프로필 누적 **약 265만 개 (+32%)**
- 누적 모임 수 **+63%**, 모임 가입자 **+125%**

### 1-4. 글로벌 (Karrot)

- 캐나다·일본·미국 전개
- **캐나다 누적 가입자 200만 명 돌파** — [당근 보도자료](https://about.daangn.com/company/pr/archive/%EB%8B%B9%EA%B7%BC-%EA%B8%80%EB%A1%9C%EB%B2%8C-%EC%84%9C%EB%B9%84%EC%8A%A4-%EC%BA%90%EB%A1%AF-%EC%BA%90%EB%82%98%EB%8B%A4%EC%84%9C-%EB%88%84%EC%A0%81-%EA%B0%80%EC%9E%85%EC%9E%90-%EC%88%98-200%EB%A7%8C-%EB%AA%85-%EB%8F%8C%ED%8C%8C/)
- **캐롯 캐나다 순손실 375억 원**, 2026년 1월 **현금 202억 원 추가 출자**
- 글로벌 전략: 수익모델 도입 전 유저 확보 우선 (캐나다는 광고모델 미도입)

> 시사점: 해외법인은 **비용 통제 압박이 상시**. 한국·일본·캐나다 **멀티리전 운영 비용**이 FinOps 대화의 자연스러운 진입점.

### 1-5. IPO

- 회사 공식 입장은 **"IPO 계획 없음"**. 시장에서만 기대감 존재 (미국 증시 가능성 거론)
- 출처: [더벨](https://m.thebell.co.kr/m/newsview.asp?svccode=&newskey=202507081544430760109362)
- → **IPO를 컴플라이언스 트리거로 쓰는 건 현 시점 무리.** 쓰려면 "상장 전 재무 가시성/원가 구조 정리" 정도의 간접 화법까지만.

---

## 2. 당근페이 (verified)

| 항목 | 내용 |
|---|---|
| 손익 | **순손실 98억 원** `[CONFIRM: 기준 회계연도 2025로 추정]` — [서울경제TV](https://www.sentv.co.kr/article/view/sentv202604060128?d=pc) |
| 오프라인 확장 | 2026.1.5 **페이히어와 제휴, POS 기반 전국 8만여 매장** 결제 지원 |
| 결제 방식 | 단말 카메라로 당근페이 QR 스캔 |
| 연계 | 결제·포인트 적립 → 당근 리뷰 독려 알림톡 자동 발송, 동네지도 매장 소식 노출 |
| 서비스 범위 | 중고거래 송금 → 바로구매, 택배 예약, 현장결제, **부동산 안심송금**, 계좌송금 |
| 채용 | 2026.3 **전 직군 공개채용** ("서비스 고도화") — [네이트 뉴스](https://m.news.nate.com/view/20260323n33301) |

출처: [파이낸셜뉴스](https://www.fnnews.com/news/202601051556530655), [플래텀](https://platum.kr/archives/278659), [아시아경제](https://view.asiae.co.kr/article/2026010508354285650), [당근 보도자료](https://about.daangn.com/company/pr/archive/%EB%8B%B9%EA%B7%BC%ED%8E%98%EC%9D%B4-%EA%B3%84%EC%A2%8C%EC%86%A1%EA%B8%88-%EA%B8%B0%EB%8A%A5-%EC%8B%A0%EA%B7%9C-%EC%98%A4%ED%94%88/)

### 규제 환경 (외부 변수)

- 금융위 **'마이데이터 발전방안' 2026.8.25 발표** — 대상을 소상공인·개인사업자까지 확대, **AI 에이전트 기반 '실행형 서비스'로 진화**
- 출처: [한국데이터경제신문](https://www.dataeconomy.co.kr/news/articleView.html?idxno=42613)
- → 당근페이는 **소상공인 8만 가맹점 + 동네 상권 데이터**를 이미 쥐고 있다. 마이데이터 확대와 정확히 겹친다. `[CONFIRM: 당근페이의 마이데이터 사업자 라이선스 보유 여부 미확인]`

---

## 3. 기술 스택 및 테크 블로그 (2025.12 ~ 2026.9)

### 3-1. 확인된 스택 지도

| 레이어 | 스택 | 클라우드 |
|---|---|---|
| **데이터 웨어하우스** | **BigQuery (메인 DW, 단일)** | **GCP** |
| 이벤트 수집 | Pub/Sub → Dataflow(스트리밍 검증) → GCS / BigQuery, DLQ | GCP |
| ELT | **DT Platform** — Airflow 동적 DAG + **Spark on EMR/EKS**, JSON DSL, S3 연계 | **AWS + GCP 혼재** |
| 거버넌스 | 컬럼 레벨 리니지 (sqlglot + Spark + Airflow + BigQuery) | GCP |
| BI/지표 | Superset, KarrotMetrics(지표 플랫폼), 실험 플랫폼 | — |
| GenAI 플랫폼 | **LLM Router / Prompt Studio / KarrotChat** | `[CONFIRM]` |
| 서비스 인프라 | Kubernetes (검색 엔진 등), EKS, ECS | AWS |
| AI 개발 도구 | **Claude Code**, Linear, Slack AI Agent | — |

> **핵심 관찰: DW는 GCP, 워크로드는 AWS.** 데이터가 AWS(서비스 DB, S3, EMR/EKS)에서 GCP(BigQuery)로 상시 이동하는 구조다. **200개 이상 DB를 한국·일본·캐나다 리전, alpha/prod 환경별로 BigQuery에 전송**한다고 본인들이 공개했다. 여기서 발생하는 **크로스클라우드 egress와 이중 운영 비용**이 우리가 짚을 수 있는 가장 구체적인 숫자다.

### 3-2. 주요 테크 블로그 인벤토리

| 시점 | 제목 | 핵심 내용 | 세일즈 시사점 |
|---|---|---|---|
| 2025.12 | **당근의 GenAI 플랫폼** (Karrot's Generative AI Platform) | 2024년 초 LLM 시작 → 1년 반 만에 **수백 개 프로덕션 유스케이스**. **LLM Router**(통합 접근·비용관리·멀티프로바이더), **Prompt Studio**(개발·평가·배포·신뢰성), **KarrotChat**(사내 에이전트 플랫폼). **수억 건 요청 처리 + 정교한 폴백** | 이미 자체 GenAI 플랫폼 보유. **"플랫폼 팔기"는 실패한다. 모델·인프라·비용 레이어로 들어가야 함** |
| 2025.12 | 당근 데이터 지도를 그리다: 컬럼 레벨 리니지 구축기 | BigQuery INFORMATION_SCHEMA.JOBS + sqlglot AST 파싱. **일 약 15,000개 테이블 / 80만 개 컬럼 의존관계 추적**. 리니지 MCP 서버 제공. "**MCP Server 개발에 Claude Code가 큰 도움**" | DW 규모 정량 근거. Claude 친화적 조직 |
| 2026.2 | 이벤트센터 — 사용자 행동 로그 관리 플랫폼 | Pub/Sub → Dataflow → GCS/BigQuery, 스키마 자동 생성, CLI 타입 안전 코드 생성. 중고거래·동네생활·**당근페이** 서비스별 이벤트 분류 | 페이 데이터도 같은 파이프라인 |
| 2026.2 | LLM 기반 택소노미 관리 시스템 | Dataflow·BigQuery 파이프라인 + **LLM-as-judge 평가로 품질·비용 관리** | LLM 비용을 이미 의식적으로 관리 중 |
| 2026.4 | 모두가 데이터를 다루는 AI 시대, 지난 1년간 데이터 팀은 어떻게 달라졌을까 | 데이터팀의 AI 전환 회고 | — |
| 2026.6 | **당근 200+개 DB를 옮기는 ELT 플랫폼, DT Platform** | **200+ DB를 한국·일본·캐나다 리전 × alpha/prod로 BigQuery 전송.** JSON DSL로 설정/실행 분리, Airflow 동적 DAG + **Spark on EMR/EKS**. **Claude Code 기반 멀티에이전트로 203개 파이프라인을 2주 만에 이관** | **크로스클라우드 데이터 이동의 규모가 공개된 문서.** 우리 DW 전환 제안의 1차 근거 |
| — | 로컬 슈퍼앱에서 장기 유저 모델링 | 장기 유저 로그로 **Transformer 기반 유저 임베딩** → 추천·광고 적용. 지역 제약 반영 RCBS, 콘텐츠 임베딩으로 cold item 해결 | GPU 학습 워크로드 존재 |
| — | 당근마켓 검색 엔진, 쿠버네티스로 쉽게 운영하기 | 검색 플랫폼 K8s 운영 | — |
| — | 당근에서 LLM 활용하기 | 피드 품질팀 LLM 추천 | — |
| — | AI Show & Tell #1 — 비개발자 AI 도전기 | 전략지원팀 CEO Staff + 인프라팀 SRE 협업, 전사 AI 프로젝트 캐처 | **AI가 전사 어젠다. CEO Staff 레벨에서 관여** |

출처: [당근 테크 블로그](https://medium.com/daangn) (medium.com 프록시 차단 — Exa/미러 경유 수집), [Velopers 요약](https://velopers.kr/post/7001), [ZenML LLMOps DB](https://www.zenml.io/llmops-database/building-a-unified-genai-platform-for-hundreds-of-production-use-cases)

### 3-3. 데이터 가치화팀 2026 방향성 (조직 시그널)

LinkedIn 공개 채용 포스트 (2026.5, Dojin Kim) 요지 — **가장 중요한 단서:**

- **"저희 팀은 data-mcp를 직접 만들고 있습니다."** BigQuery, 실험 플랫폼, 로그 플랫폼, KarrotMetrics, 리니지, Superset **전부를 MCP 서버로 구성**해 자연어 탐색 지원
- AI Agent를 워크플로우에 태워 장애 원인 선분석, 온콜 내용 정리·후속조치 자동화
- 요청 인입 시 **Linear 티켓 + Claude Code / Slack AI Agent 동시 투입**
- 데이터팀 역할 전환: "LLM이 이 기능을 어떻게 호출할 것인가"까지 설계
- **"2025년은 AI 도입을 산발적으로 시도하며 실패하고 배운 해. 2026년은 그 흩어진 시도들을 하나의 흐름으로 통합하려고 합니다."**

> 이 한 문장이 2026 하반기 딜의 근거다. **고객 스스로 "통합"을 2026년 과제로 선언**했다. 우리 제안은 그 통합의 **인프라·비용·거버넌스 축**을 맡는 것이어야 한다.

출처: [LinkedIn](https://kr.linkedin.com/posts/dojin-henry-kim-64080a158_data-analytics-engineer-%ED%85%8C%ED%81%AC%EC%BD%94%EC%96%B4-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EA%B0%80%EC%B9%98%ED%99%94-activity-7454863858566971392-2FpU), [당근 채용](https://careers.daangn.com/jobs/role/4300801003/)

### 3-4. 최신 뉴스 — 미팅 2주 전 (2026.9.16)

**당근, 국내 광고 플랫폼 최초로 광고주 대상 MCP 도입.**

- '당근 광고 MCP' — 광고주가 쓰던 AI에 MCP 서버 주소 등록 + 당근비즈니스 계정 인증만으로 연동
- 계정 잔액 / 집행 광고 현황 / 기간별 성과를 대화로 조회
- **앤트로픽 Claude와 ChatGPT에서 이용 가능**
- 향후 **광고 생성·수정 기능까지 단계 확대 계획**

출처: [이코노미스트 2026.9.16](https://economist.co.kr/article/view/ecn202609160015)

> **9/29 리뷰에서 반드시 언급할 카드.** 당근이 외부 고객(광고주)향 AI 인터페이스를 열었다는 건, **AI가 내부 효율을 넘어 매출 채널로 전환**됐다는 뜻이다. 트래픽·추론 비용이 여기서부터 튄다.

---

## 4. MZC 내부 데이터 (Gmail/내부 기록 기준)

### 4-1. 클라우드 풋프린트 — 실측

| 항목 | 값 | 출처 |
|---|---|---|
| 당근마켓 월 비용 | **약 USD 2.6M** (Hyperbilling 기준) | 2026.5.18 AWS SBR |
| 당근페이 월 비용 | **약 USD 88K** (Hyperbilling 기준) | 2026.5.18 AWS SBR |
| **8월 총비용** | **USD 1.86M** (7월 대비 +0.6%) — **위 $2.6M와 집계 기준 상이** `[CONFIRM]` | 2026.9.15 AWS SBR |
| 5월 특이사항 | $201.2k — 3년 All Upfront Compute Savings Plan 추정 | SBR 회의록 `[CONFIRM]` |
| Support Plan | Enterprise | 신규 계정 통합빌링 요청 |
| 확인된 AWS 계정 | 314695318048, 651188579251, 123801804680, 516008589093(2026.6 신규) | 내부 메일 |

> **연 환산 약 USD 32M 규모** (2.6M × 12, 당근마켓 단독 기준). 별도 검증 필요하나, **Top 10 어카운트 위상에 부합**.

### 4-2. FinOps — 즉시 실행 가능한 절감 아이템 (Trusted Advisor, 2026.5)

| 대상 | 내용 | 연간 영향 |
|---|---|---|
| 당근마켓 EBS | 7일 이상 미연결/미사용 **볼륨 159개, 총 45TB** (대부분 1TB급) | **약 USD 50,000 낭비** |
| 당근페이 RDS | 14일 이상 미연결 **인스턴스 10개 (Multi-AZ)**, 스탠바이 비용 포함 | **약 USD 14,000 낭비** |
| MySQL 8.0 | 2026.7.31 표준지원 종료 → 8.1부터 **Extended Support 추가 과금**. **서울 리전 6개 인스턴스** 사전 업그레이드 권장 | `[CONFIRM: 9월 현재 업그레이드 완료 여부]` |

> **합계 연 약 USD 64,000의 순수 낭비가 5월에 식별됐다.** 9/29 리뷰 전에 **"5월 식별분 중 몇 건이 실제 제거됐는지"** 확인해야 한다. 안 됐다면 그 자체가 하반기 FinOps 어젠다의 오프닝이다.

### 4-3. AWS 펀드 확보 현황 — **가장 중요**

**SCA GenAI Fund 4건 승인, 총 USD 1,000,000 (각 250K)** *(2026-09-22 정정 — 4번째 건 및 집행 실적 확인)*

| # | 프로젝트명 | PO Number | 승인 | 집행 | 잔액 |
|---|---|---|---|---:|---:|
| 1 | Daangn - **Expanding AI Workload** | KA-H1ERFA4921 | 2026-06 | **$112,254**<br>(07월 $86,254 / 08월 $26,000) | **$137,746** |
| 2 | Daangn - **AI Data Platform Migration POC** (DW 전환) | `[CONFIRM]` | 2026-07 | 미적용 | $250,000 |
| 3 | Daangn - **AI Workload Winback Phase2** | KA-CUKWZGLH09 | 2026-09 | 미적용 | $250,000 |
| 4 | Daangn - **Claude Platform on AWS Migration** | KA-X34LECR46R | 2026-09-17 | 미적용 | $250,000 |
| | **합계** | | | **$112,254** | **$887,746** |

- Opportunity: O25059850 / O19498258
- 집행 계정: **324404180070**
- **현재 상태: 4건 중 1건만 부분 집행(11.2%). 나머지 $887,746은 "고객사와 논의 후 별도 적용 요청" 상태로 미집행.**

> **이게 9/29 리뷰의 핵심 액션이다.** 펀드 이름 세 개가 곧 하반기 플랜의 목차다: **① DW를 BigQuery에서 AWS로 ② 이탈한 AI 워크로드 되찾기 ③ Claude 플랫폼을 AWS 위로.** 750K를 어떤 순서로, 누구와, 언제 태울지가 정해지지 않으면 플랜은 문서로만 남는다.

### 4-4. 기타 계약·파이프라인

- **PagerDuty CPPO**: USD 10,476 / 2026.6.10~2027.6.9, Account ID 314695318048
- **광고실 PagerDuty 추가 도입**: 견적 작업 진행 중 (2026.6.1 기준) `[CONFIRM: 9월 현재 진행 상태]`
- 2026.6 신규 AWS 계정 516008589093 통합빌링 편입 (Enterprise Support)
- 2026.4 Hyperbilling 태그 이슈로 4월 비용 누락 → 재적재 완료 (EC2 일 약 $10,000 차이 발생했던 건)

### 4-5. 전담 인력 변경 (2026.5)

- **AWS TAM: 김호성 → 문태권**
- **MZC 전담 테크: 이슬비 신규 투입** (당근 슬랙 참여) — Cross Industry SA / AWS Account SA

> TAM 교체 직후는 **관계 재설정 구간**. 신임 TAM과 하반기 공동 어젠다를 먼저 맞추면 co-sell 속도가 달라진다.

### 4-6. 레퍼런스 자산

- 2026.7 HTC 조현규님 → **CJ올리브영 MSP 제안**에 당근마켓 운영 사례 활용 요청
  - RFP 요건: **MAU 500만 이상 대규모 트래픽 운영 사례**
  - 요청 항목: AS-IS→TO-BE 개선 사례 / 트러블슈팅·장애 대응 경험 / 기술 Use Case
- → 당근은 **MZC의 대외 레퍼런스 자산**이기도 하다. 고객사에 "레퍼런스 제공"을 협상 카드로 쓸 여지 있음 `[CONFIRM: 고객 동의 여부]`

### 4-7. 장애/운영 이슈 히스토리 (2026)

- 2026.5 **Amazon MQ (RabbitMQ) 장애** — 메모리 한계 초과, 퍼블리셔 차단
- 2026.4.19 **EKS 노드 CPU 사용률 급증** — 특정 AZ 노드 파드 CPU 급증

---

## 5. 이해관계자 맵

| 구분 | 이름/역할 | 관심사 | 분류 | 공략 각도 |
|---|---|---|---|---|
| 고객 | 데이터 가치화팀 (Tech Core) | BigQuery 운영, data-mcp, AI 통합 | **Technical Buyer** | "2026 통합" 과제의 인프라 축. DT Platform 크로스클라우드 비용 |
| 고객 | ML Applications팀 (Tech Core) | LLM Router / Prompt Studio / KarrotChat | **Technical Buyer** | 멀티프로바이더 비용·폴백 → Bedrock/Claude on AWS |
| 고객 | 인프라팀 SRE | EKS, 장애 대응, 비용 | Unknown | MQ·EKS 장애 후속, DevOps Agent |
| 고객 | 전략지원팀 CEO Staff | 전사 AI 프로젝트 가시성 | Unknown → **잠재 Champion** | AI 프로젝트 캐처 = 전사 AI ROI 가시성 니즈 |
| 고객 | 당근페이 기술/사업 | 8만 가맹점 결제, 규제 | Unknown | 페이 RDS 낭비 $14K + 전자금융 규제 대응 |
| 고객 | CFO/재무 | 연결 수익성, 자회사 적자 | **Economic Buyer** `[CONFIRM: 실명]` | 별도-연결 525억 갭. 해외법인 원가 |
| MZC | 이슬비 (전담 테크 SA) | 기술 지원 | 내부 | 슬랙 상주 — 기술 시그널 1차 소스 |
| MZC | 노영채 / 김원태 | FinOps / 빌링 | 내부 | 하이퍼빌링 권한 보유 |
| AWS | 문태권 (신임 TAM) | 계정 성장 | 파트너 | 하반기 공동 어젠다 정렬 필요 |
| AWS | Michelle Kim | SCA GenAI Fund | 파트너 | 펀드 3건 집행 |
| MZC | 주연나 (S&P Ops) | 리뷰 운영 | 내부 | **9/23까지 참석자 명단 회신** |

> **미확인 영역이 가장 큰 리스크.** 고객 측 실명 의사결정자가 이 표에 한 명도 없다. 9/29 전에 최소 **Economic Buyer 1명, Champion 1명**을 확정해야 플랜이 승인 가능한 형태가 된다.

---

## 6. 하반기 플랜 가설 (초안 — 9/29 논의용)

### 축 1. DW 전환 — "BigQuery 단일 DW의 대안"

- 근거: 200+ DB × 3개 리전 × 2개 환경 → BigQuery 전송. Spark는 이미 EMR/EKS(AWS).
- 펀드: **AI Data Platform Migration POC (USD 250K)** 사용처
- 리스크: **컬럼 레벨 리니지·이벤트센터·KarrotMetrics·data-mcp가 전부 BigQuery에 강결합.** 전면 전환은 비현실적. → **"전면 이관"이 아니라 "AI/ML 워크로드 데이터 레이어의 AWS 근접 배치"로 스코프를 좁혀야 한다.**

### 축 2. AI 워크로드 Winback

- 근거: 수백 개 GenAI 유스케이스, 수억 건 요청, LLM Router 멀티프로바이더
- 펀드: **AI Workload Winback Phase2 (USD 250K)**
- 각도: LLM Router가 멀티프로바이더라는 건 **라우팅 대상에 Bedrock을 넣을 자리가 이미 있다**는 뜻

### 축 3. Claude Platform on AWS

- 근거: 당근은 이미 Claude Code를 개발 워크플로우에 상시 사용. 광고 MCP도 Claude 지원.
- 펀드: **Claude Platform on AWS Migration (USD 250K)**
- 각도: **이미 쓰고 있는 Claude를 AWS Bedrock 경로로 옮기는 것** — 도입 설득이 아니라 경로 전환 설득. 난이도가 가장 낮다.

### 축 4. FinOps 상시화

- 근거: 5월 식별 낭비 연 USD 64K + 월 $2.6M 규모 + 해외법인 비용 압박
- 각도: 일회성 권고가 아니라 **월간 리포팅 체계**로

---

## 7. 9/29 리뷰 전 확인 필요 항목 (`[CONFIRM]` 목록)

| # | 항목 | 확인처 | 기한 |
|---|---|---|---|
| 1 | **추가 초대 인원 명단 (이름/소속) 회신** | 주연나 (S&P Ops) | **9/23(수)** |
| 2 | 1·2부문 발표 범위 사전 sync | 2부문 AM (hyeokjae) | 9/25 |
| 3 | SCA GenAI Fund 750K 적용 계획 — 3건 각각 대상 계정·시점 | 고객 + Michelle | 9/26 |
| 4 | 5월 Trusted Advisor 낭비 항목(EBS 159개 / RDS 10개) 실제 제거 여부 | 노영채 / 이슬비 | 9/25 |
| 5 | MySQL 8.0 서울 리전 6개 인스턴스 업그레이드 완료 여부 | 이슬비 / 문태권 | 9/25 |
| 6 | 광고실 PagerDuty 견적 진행 상태 | 내부 | 9/25 |
| 7 | 고객 측 Economic Buyer / Champion 실명 확정 | AM | 9/26 |
| 8 | 2026 상반기 실적 확정 수치 (영업이익 200억 건) | 공시/딜사이트 원문 | 9/25 |
| 9 | 당근페이 마이데이터 라이선스 보유 여부 | 고객 | 9/26 |
| 10 | 당근 레퍼런스 대외 활용(CJ올리브영) 고객 동의 여부 | 고객 | 9/26 |
| 11 | 2026 1Q 이후 월별 Hyperbilling 실적 추이 | 하이퍼빌링 | 9/25 |

---

## 8. 리뷰 일정 및 산출물

| 항목 | 내용 |
|---|---|
| 일시 | **2026-09-29(화) 15:30~17:00** (기존 9/18 금 10:30 → 카카오 리뷰와 슬롯 교환) |
| 장소 | **과천사옥 5층 CEO 미팅룸** (Google Meet 병행) |
| 형식 | **1·2부문 합동 단일 세션**, 발표는 부문별 개별 준비 |
| 필수 참석 | AM, Sales Leader + **Account Plan에 언급된 실행 주체(테크/오버레이 세일즈/마케팅)** |
| 1부문 문서 | [Account Plan — 1부문](https://docs.google.com/document/d/1Pf4GNpqXlFZiAiP5RMmQ6YW5u31DyR1J68A-mXUdwEU/edit) |
| 2부문 문서 | [Account Plan — 2부문](https://docs.google.com/document/d/1CcbLgIlG66owmXohAAH9lXhynbecSIEEJOTvDb3l3QE/edit) |
| 주관 | 주연나 (S&P Ops / Revenue Ops) |
| 리뷰 강조점 | 기존 진행내용 업데이트보다 **고객사 커버 플랜 및 전략, 필요사항**이 중요 (대표님 피드백, 정영석 리더 전달) |

---

## 9. 출처 목록

**실적·사업**
- [당근 2025년 연간 실적 발표 (보도자료)](https://about.daangn.com/company/pr/archive/%EB%8B%B9%EA%B7%BC-2025%EB%85%84-%EC%97%B0%EA%B0%84-%EC%8B%A4%EC%A0%81-%EB%B0%9C%ED%91%9C/)
- [바이라인네트워크 — 당근, 2025년 매출 2707억원, 전년 대비 43%↑](https://byline.network/2026/03/27_192874-2/)
- [플래텀 — 당근, 2025년 매출 2,707억 원](https://platum.kr/archives/284275)
- [디지털데일리 — 당근, 역대 최대 실적…광고·알바·모임 다 터졌다](https://m.ddaily.co.kr/page/view/2026032717273655963)
- [Investing.com — 당근마켓 2026년 1분기 실적](https://kr.investing.com/news/global-filings/article-93CH-1964745)
- [서울경제TV — 당근, 광고로 흑자 굳혔지만…해외·신사업 적자 발목](https://www.sentv.co.kr/article/view/sentv202604060128?d=pc)
- [포인트경제 — 동네 딛고 글로벌 도약, 광고 의존·매출 불균형은 숙제](https://www.pointe.co.kr/news/articleView.html?idxno=77877)
- [더벨 — 고개 드는 IPO 가능성, 미국증시 갈까](https://m.thebell.co.kr/m/newsview.asp?svccode=&newskey=202507081544430760109362)
- [딜사이트 — 당근, 상반기 영업익 200억](https://dealsite.co.kr/articles/126623)
- [당근 보도자료 — 캐롯 캐나다 누적 가입자 200만 돌파](https://about.daangn.com/company/pr/archive/%EB%8B%B9%EA%B7%BC-%EA%B8%80%EB%A1%9C%EB%B2%8C-%EC%84%9C%EB%B9%84%EC%8A%A4-%EC%BA%90%EB%A1%AF-%EC%BA%90%EB%82%98%EB%8B%A4%EC%84%9C-%EB%88%84%EC%A0%81-%EA%B0%80%EC%9E%85%EC%9E%90-%EC%88%98-200%EB%A7%8C-%EB%AA%85-%EB%8F%8C%ED%8C%8C/)

**당근페이**
- [파이낸셜뉴스 — 페이히어, 당근과 손 잡았다](https://www.fnnews.com/news/202601051556530655)
- [플래텀 — 당근페이, 오프라인 결제처 8만 곳으로 확대](https://platum.kr/archives/278659)
- [아시아경제 — 당근페이, 전국 8만여 동네 매장에서 결제](https://view.asiae.co.kr/article/2026010508354285650)
- [당근 보도자료 — 당근페이 계좌송금 기능 신규 오픈](https://about.daangn.com/company/pr/archive/%EB%8B%B9%EA%B7%BC%ED%8E%98%EC%9D%B4-%EA%B3%84%EC%A2%8C%EC%86%A1%EA%B8%88-%EA%B8%B0%EB%8A%A5-%EC%8B%A0%EA%B7%9C-%EC%98%A4%ED%94%88/)
- [네이트 뉴스 — 당근페이 전직군 공개채용](https://m.news.nate.com/view/20260323n33301)
- [한국데이터경제신문 — 마이데이터 발전방안 (2026.8.25)](https://www.dataeconomy.co.kr/news/articleView.html?idxno=42613)

**기술**
- [당근 테크 블로그](https://medium.com/daangn)
- [Karrot's Generative AI Platform (2025.12)](https://medium.com/daangn/karrots-genai-platform-5cf6e813838e)
- [당근의 GenAI 플랫폼](https://medium.com/daangn/%EB%8B%B9%EA%B7%BC%EC%9D%98-genai-%ED%94%8C%EB%9E%AB%ED%8F%BC-ee2ac8953046)
- [ZenML LLMOps DB — Karrot: Building a Unified GenAI Platform](https://www.zenml.io/llmops-database/building-a-unified-genai-platform-for-hundreds-of-production-use-cases)
- [당근 데이터 지도를 그리다: 컬럼 레벨 리니지 구축기](https://medium.com/daangn/%EB%8B%B9%EA%B7%BC-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EC%A7%80%EB%8F%84%EB%A5%BC-%EA%B7%B8%EB%A6%AC%EB%8B%A4-%EC%BB%AC%EB%9F%BC-%EB%A0%88%EB%B2%A8-%EB%A6%AC%EB%8B%88%EC%A7%80-%EA%B5%AC%EC%B6%95%EA%B8%B0-15cd862c7743)
- [Velopers — 당근 200+개 DB를 옮기는 ELT 플랫폼, DT Platform](https://velopers.kr/post/7001)
- [로컬 슈퍼앱에서 장기 유저 모델링은 어떻게 달라질까](https://medium.com/daangn/%EB%A1%9C%EC%BB%AC-%EC%8A%88%ED%8D%BC-%EC%95%B1%EC%97%90%EC%84%9C-%EC%9E%A5%EA%B8%B0-%EC%9C%A0%EC%A0%80-%EB%AA%A8%EB%8D%B8%EB%A7%81%EC%9D%80-%EC%96%B4%EB%96%BB%EA%B2%8C-%EB%8B%AC%EB%9D%BC%EC%A7%88%EA%B9%8C-d10cf75845bd)
- [이벤트센터 개발기 리뷰](https://ars420.tistory.com/242)
- [당근 채용 — Software Engineer, Data (데이터 가치화)](https://careers.daangn.com/jobs/role/4300801003/)
- [LinkedIn — 테크코어 데이터 가치화팀 2026 방향성](https://kr.linkedin.com/posts/dojin-henry-kim-64080a158_data-analytics-engineer-%ED%85%8C%ED%81%AC%EC%BD%94%EC%96%B4-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EA%B0%80%EC%B9%98%ED%99%94-activity-7454863858566971392-2FpU)
- [이코노미스트 — 당근, 국내 광고 플랫폼 최초 MCP 도입 (2026.9.16)](https://economist.co.kr/article/view/ecn202609160015)

**내부 (Gmail / MZC)**
- 2026.5.18 AWS SBR & 비용 리뷰 회의록 (이슬비, 2026.6.1 공유)
- SCA GenAI Fund 신청 스레드 3건 (Michelle Kim, 2026.7~9)
- 당근마켓 Pagerduty CPPO Offer 생성 요청 (2026.6)
- 당근마켓 AWS 신규 계정 통합빌링 요청 (2026.6)
- 당근마켓/페이 하이퍼빌링 금액 오류 문의 (2026.4)
- Account Plan Review 일정 변경 안내 (주연나, 2026.9.9 / 리마인드 9.20)
- CJ올리브영 MSP 제안 지원 요청 (조현규, 2026.7)

---

> **가드레일 주의:** 이 문서의 모든 금액은 위 출처 기준이며, 고객 제출 자료에 인용하기 전 Hyperbilling 실측과 대조할 것. `[CONFIRM]` 항목은 확인 전까지 고객 대면 자료에 쓰지 않는다.
