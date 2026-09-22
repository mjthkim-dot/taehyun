# 당근 / 당근페이 — 2026 하반기 Account Plan 작성용 분석

- **작성일:** 2026-09-22 (리뷰 D-7)
- **대상 회의:** 2026-09-29(화) 15:30~17:00, 과천사옥 5층 CEO 미팅룸, 1·2부문 합동 단일 세션
- **작성:** 김태현 (Cross Industry / CN & Startup 1 Team)
- **선행 문서:** `daangn-2026H2-account-planning-data.md` (외부 시장·기술 데이터)
- **본 문서 범위:** 현행 Account Plan v2.0 진단 + 재무 갭 + 파이프라인 실사 + MEDDPICC + 하반기 플랜 골격

---

## 0. 결론 먼저 — 세 문장

1. **현행 Account Plan v2.0은 2026.05.15 작성본이고, 액션 날짜 대부분이 이미 지났다.** 9/29는 "업데이트 보고"가 아니라 **재작성 보고**여야 한다.
2. **2026 목표 595.4억 vs 전망 576.5억 — 18.9억 미달.** 그런데 증분 88.5억을 **Infra+Support 단독(+90.2억)** 이 떠받치고 AIR·HALO·MS·PS는 **전부 0**이다. 성장 전량이 AWS 리셀에 의존한다.
3. **8월 실측이 5월 플랜의 핵심 가설을 반박한다.** Bedrock(Marketplace) 비용은 **-61%** 로 줄고, 대신 **GPU(g7e/g6)·Trainium CapacityBlock·karrot-llm-router-vllm**이 증가했다. 당근은 매니지드 LLM이 아니라 **자체 서빙(vLLM on EC2/Trainium)** 으로 기울고 있다. "Bedrock Winback" 프레이밍은 하반기에 **"AI 인프라 Winback"으로 바꿔야 한다.**

---

## 1. 현행 Account Plan v2.0 진단

### 1-1. 문서 메타

| 항목 | 값 | 판정 |
|---|---|---|
| 작성일 | 2026.05.15 | **4개월 경과** |
| 버전 | v2.0 | Change Log **비어 있음** |
| 리뷰 주기 / 최종 리뷰일 | **공란** | 미기재 |
| 고객 등급 (Tier) | **미선택** (Tier 1/2/3 그대로) | 미기재 |
| 핵심 AI/보안 목표 | **공란** | 미기재 |
| 2부문 문서 | **접근 권한 없음** (Requested entity was not found) | **9/29 전 권한 요청 필수** |

### 1-2. 액션 아이템 6종 — 5월 계획 vs 9/22 현재

| # | 실행 항목 | 5월 계획 | 9/22 실제 | 판정 |
|---|---|---|---|---|
| 1 | LLM 워크로드 (Gemini → Bedrock Nova Lite) | 7/31 PoC 결과 + 본전환 계약서 초안 | **8월 Bedrock 비용 -61% 감소.** 대신 GPU/Trainium 증가 | 🔴 **가설 수정 필요** |
| 2 | BigQuery → AWS on Databricks ($1.2M) | 6월 말 PoC 착수 → 9월 말 결과+견적 | PoC 착수 근거 미확인. 별도로 **Snowflake가 "함께 딜 진행 중"** | 🔴 **노선 충돌** |
| 3 | WAF 전사 PPA (약 25억) | 10/1 계약시작 | **DMS 0RJE2Z1ZD2H2N 고객 검토 단계 진입(9/10), 9/22 계약 담당 댓글** | 🟢 **유일하게 궤도** |
| 4 | CloudWAN + Network Firewall | 6/18 PoC → 8월 본도입 | 진행 근거 미확인 | 🟡 **확인 필요** |
| 5 | AI 기본법 거버넌스 컨설팅 (HALO, 1.5억) | 3Q 출시 → 9월 제안서 | Offering 출시 근거 미확인 | 🔴 **정체 추정** |
| 6 | Wiz CNAPP 도입 | 8월 PoC 착수 | 진행 근거 미확인 | 🔴 **정체 추정** |

> **6개 중 궤도에 있는 건 WAF PPA 하나다.** 9/29에서 이걸 감추면 신뢰를 잃고, 드러내면 "그래서 하반기엔 뭘 다르게 할 건가"를 답해야 한다. **후자로 간다.**

### 1-3. 5월 플랜이 놓친 것 — 8월 이후 발생한 사실

| 신규 사실 | 시점 | 플랜 반영 여부 |
|---|---|---|
| WAF/Shield PPA 사업성검토 **결재 종결** (문서 2026-58266, 최종결재 강승백) | 9/8 | 미반영 |
| WAF PPA **DMS 계약 고객 검토 단계** 진입 | 9/10 | 미반영 |
| **SCA GenAI Fund 4번째 건** 존재 확인, 총 **USD 1,000,000** | 6~9월 | 미반영 |
| 펀드 #1 **$112,254 집행 완료 / 잔액 $137,746** | 7~8월 | 미반영 |
| **Trainium trn2.3xlarge CapacityBlock** 사용 시작 | 8/11 | 미반영 |
| **karrot-neurondeepdive2026** 계정 비용 1위 증가 (+$24,430) | 8월 | 미반영 |
| **karrot-llm-router-vllm** ElastiCache 증가 | 8월 | 미반영 |
| Bedrock 비용 감소 (Claude Opus 4.8 / Sonnet 4.6) | 8월 | 미반영 |
| **당근 광고 MCP** 대외 출시 (국내 광고 플랫폼 최초) | 9/16 | 미반영 |
| CSM **김원태** 정식 배정 (당근마켓 00056906 / 당근페이 00056943) | 9/1 | 미반영 |
| **Snowflake Joint Account Drive** — 당근마켓 딜 진행 중 | 9/8 | 미반영 |
| Account Presales R&R 재편 — **이슬비 Account SA 공수 재배치 논의** | 9/8~18 | 미반영 |
| 9월 **당근 Meet-up 스폰서십** 집행 (MZC 주최) | 9월 | 미반영 |

---

## 2. 재무 분석

### 2-1. 목표 vs 전망 (플랜 v2.0 기재값, 단위: 백만원)

| 매출 스트림 | 2025 Run-Rate | 2026 목표 | 증분 | 증분 비중 |
|---|---:|---:|---:|---:|
| Infra + Support | 48,446 | 57,462 | **+9,016** | **101.9%** |
| ISV Solutions | 2,183 | 2,074 | **-109** | -1.2% |
| Professional Services | 57 | 0 | -57 | -0.6% |
| Managed Services | 0 | 0 | 0 | 0% |
| AIR Services | *(공란)* | *(공란)* | — | — |
| HALO Services | *(공란)* | *(공란)* | — | — |
| **합계** | **50,686** | **59,536** | **+8,850** | 100% |

- **2026 FY Forecast: 57,648** → **목표 대비 -1,888백만원 (약 18.9억 미달)**
- YoY: 목표 +17.5% / 전망 +13.7% (57,648 ÷ 50,686 = 1.1374)
- 플랜 기재 **YTD YoY +69.0%** 는 위 FY 수치와 정합되지 않음 → **기준 시점·산식 확인 필요** `[CONFIRM]`

> **구조적 문제 두 개.**
> ① **성장의 101.9%가 Infra+Support 한 줄에 몰려 있다.** 리셀 단가 압박(구매팀 경쟁입찰)이 현실화되면 방어 수단이 없다.
> ② **AIR·HALO·MS·PS 네 줄이 전부 0 또는 공란이다.** 5월 플랜이 그렸던 AI 거버넌스 컨설팅 1.5억, Databricks $1.2M, Wiz는 **매출 목표표에 한 줄도 반영되지 않았다.** 전략과 숫자가 분리돼 있다.

### 2-2. 하반기에 메워야 할 18.9억 — 후보 재원

| 후보 | 근거 금액 | 인식 가능 시점 | 확실성 |
|---|---|---|---|
| **WAF/Shield PPA** | 플랜 기재 **약 25억 규모** (24개월) | 26.10.1 계약 시작 | 🟢 높음 — DMS 고객 검토 단계 |
| SCA GenAI Fund 잔여 집행 | 잔액 **$862K** (총 $1M − 집행 $112K − 미적용분) | 4Q | 🟡 고객 합의 필요 |
| AI 기본법 거버넌스 컨설팅 (HALO) | 1.5억 | 4Q | 🔴 Offering 상태 미확인 |
| Databricks / Snowflake DW 전환 | $1.2M (약 17억) | 27년 이월 가능성 | 🔴 노선 미정 |
| ISV CPPO 통합 (Pinecone/Atlassian/PagerDuty) | PagerDuty $10,476 확정 외 미산정 | 4Q | 🟡 |
| FinOps 절감분 재투자 | 연 $64K(5월분) + 8월 신규 절감안 | 상시 | 🟡 |

> **계산:** 18.9억을 WAF PPA 단독으로 메우려면 24개월 계약 중 **2026년 내 인식분이 18.9억을 넘어야** 한다. 25억 ÷ 24개월 × 3개월(10~12월) ≈ **3.1억**. **WAF만으로는 못 메운다.** 나머지 약 15.8억의 출처를 9/29에 제시하지 못하면 목표는 미달로 확정된다. `[CONFIRM: 25억이 총계약금액인지 연간인지 — 플랜 기재만으로 불명]`

---

## 3. 클라우드 실측 — 2026년 8월 (9/15 SBR)

### 3-1. 전체

| 항목 | 값 |
|---|---|
| **8월 총비용** | **USD 1.86M** |
| 7월 대비 | +0.6% (+$11.5K) |
| EDP·Support·Credit 제외 | **+1.7% (+$34.5K)** |
| 5월 SBR 기재값 | 당근마켓 $2.6M / 당근페이 $88K (Hyperbilling 기준) |

> **$2.6M(5월) vs $1.86M(8월)은 기준이 다르다.** 감소가 아니라 집계 기준 차이일 가능성이 높다(5월 SBR은 Hyperbilling, 9월 SBR은 Payer 기준 추정). **어느 숫자를 Account Plan의 공식 Run-Rate로 쓸지 9/29 전에 확정해야 한다.** 재무표(Infra+Support 574.6억/년 ≈ 월 47.9억)와도 자릿수를 맞춰야 함. `[CONFIRM — 김원태 CSM]`

### 3-2. 증가 Top 3 — 서비스

| 서비스 | 증감 | 원인 | 해석 |
|---|---:|---|---|
| **EC2** | **+$117,183 (+26%)** | 7/6·7/21 이후 **GPU(g7e, g6)** 사용량 증가, **8/11 Trainium trn2.3xlarge CapacityBlock**, 서울 EBS gp3 처리량·PIOPS 증가 | **AI 학습/서빙이 AWS로 들어오고 있다** |
| CloudFront | +$22,762 (+19%) | 7/18 이후 **HTTPS-Proxy(POST/OPTIONS)** 증가 | 최적화 제안 여지 |
| DynamoDB | +$20,235 (+13%) | 8/26~30 Read/Write 일시 증가 | Standard-IA 전환 시 **$6,711 절감 가능** |

### 3-3. 증가 Top 3 — 계정

| 계정 | 증감 | 해석 |
|---|---:|---|
| **karrot-neurondeepdive2026** | **+$24,430** | **AWS Neuron(Trainium/Inferentia) 딥다이브 전용 계정.** 자체 모델 서빙 검증 중이라는 가장 강한 증거 |
| Daangn-main | +$21,797 | 본 서비스 |
| Daangn-alpha | +$4,229 | 개발 |

### 3-4. 감소 항목 — **주의 신호**

| 항목 | 증감 | 원인 |
|---|---:|---|
| **Marketplace** | **-$160,298 (-61%)** | 7월 Okta 라이선스 선납 영향 + **Bedrock 사용 감소 — Claude Opus 4.8, Sonnet 4.6 등 주요 모델 비용 감소** |
| DataTransfer | -$22,971 (-6%) | MSK 트래픽 40%+ 감소 (7/16 이후) |

> **핵심 해석.** Bedrock은 줄고 GPU·Trainium·vLLM은 는다. ElastiCache 증가 노드 목록에 **`karrot-llm-router-vllm`** 이 직접 찍혀 있다. 즉 **LLM Router가 vLLM 자체 서빙 경로를 AWS 위에서 키우는 중**이다.
> → 5월 플랜의 "Bedrock Nova Lite 전환" 단일 시나리오는 유효하지 않다. 다만 **AWS 이탈이 아니라 AWS 내 이동**이므로 매출 관점에서는 오히려 Infra+Support에 유리하다. **프레이밍을 "Bedrock Winback" → "AI 인프라 Winback (Bedrock + Trainium/GPU 서빙 + Neuron 최적화)"로 바꾸면 현실과 플랜이 다시 붙는다.**

### 3-5. 약정(RI/SP) 현황

| 항목 | 사용률 | 커버리지 | 미사용 |
|---|---:|---:|---:|
| Compute SP | 96.4% | 82.0% (-2.7%) | **$27,089 (-$9,600)** |
| DB SP | 100% | 6.5% (-0.8%) | — |
| RDS RI | 98.1% | 80.3% (-0.5%) | $973 → **9/1 갱신 후 커버리지 92%** |
| ElastiCache RI | 86.0% | 57.6% (-4.5%) | **$12,970** → 9/1 갱신 후 사용률 94.7% |
| DynamoDB RI | 87.6% | 57.3% (-5.5%) | **$6,766** |

**DynamoDB 저활용 약정 ARN (최근 3개월 70% 미만) — 2027-01-01 갱신 시 재검토 대상**

| 리전 | 사용률 | 약정 수량 |
|---|---:|---:|
| 런던 `6b26d851…` | **0%** | 1,000 |
| 런던 `905ea203…` | **0%** | 1,100 |
| 서울 `2295038d…` | 7.4% | 200 |
| 캐나다 `cc28e135…` | 41.3% | 1,700 |
| 서울 `8928b70f…` | 67.8% | 1,800 |

> **런던 2개 ARN이 사용률 0%다.** 글로벌(캐롯) 축소·이전의 흔적일 가능성. **해외법인 비용 압박 서사와 정확히 맞물리는 FinOps 대화 소재.**

### 3-6. Extended Support — 과금 진행 중

| 대상 | 상태 |
|---|---|
| **RDS MySQL 8** | 8/1부 일반지원 종료 → **연장지원 비용 발생 중.** 엔진 버전 마이그레이션 필요 |
| **EKS 1.34 이전 클러스터** | 8/10 이후 **연장지원 비용 발생 중** |

> 5월 SBR에서 "서울 리전 6개 인스턴스 사전 업그레이드 권장"이 나왔는데 **8월에 실제 과금이 시작됐다. 즉 권고가 실행되지 않았다.** 이건 우리가 지적한 걸 고객이 안 한 것이므로, **하반기 Managed/PS 매출(현재 0원)의 명분**으로 쓸 수 있다.

### 3-7. 즉시 제안 가능한 절감 패키지 (8월 데이터 기준)

| # | 항목 | 절감 추정 | 근거 |
|---|---|---:|---|
| 1 | DynamoDB Standard-IA 전환 (Top 3 테이블) | **$6,711 / 월** | prod-ads-mediation-common-session $3.5K, audit_information_production $1.3K, big-picture-prod $676 |
| 2 | 미사용 Compute SP 해소 | $27,089 / 월 | 커버리지 82%, 미사용분 |
| 3 | 미사용 ElastiCache RI | $12,970 / 월 | 9/1 갱신으로 일부 개선(사용률 94.7%) |
| 4 | DynamoDB RI 저활용 5개 ARN 재조정 | $6,766 / 월 | 2027-01-01 갱신 시점 |
| 5 | CloudFront POST→GET 전환 + OPTIONS Edge 종결 | 미산정 | +$22,762 증가분의 상당 부분 |
| 6 | 미사용 EBS 159개 / 45TB 정리 | **연 ~$50,000** | 5월 Trusted Advisor |
| 7 | 당근페이 미사용 RDS 10개 (Multi-AZ) | **연 ~$14,000** | 5월 Trusted Advisor |
| 8 | MySQL 8 / EKS 1.34 업그레이드 | Extended Support 과금 중단 | 금액 미산정 `[CONFIRM]` |

> 1~4번 월간 합계 **약 $53,536**. 단순 연환산 시 **약 $642K**. 단 항목별 성격이 달라(일부는 커버리지 재조정, 일부는 실제 낭비) **단순 합산을 고객 제출 자료에 그대로 쓰지 말 것.** 항목별로 "낭비 제거 / 약정 재조정 / 아키텍처 개선"으로 분리해 제시한다.

---

## 4. SCA GenAI Fund — 총 USD 1,000,000

| # | PO Number | Cash Name | 승인 | 금액 | 집행 | 잔액 |
|---|---|---|---|---:|---:|---:|
| 1 | **KA-H1ERFA4921** | Daangn-**Expanding AI Workload** | 2026-06 | $250,000 | **$112,254**<br>(07월 $86,254 / 08월 $26,000) | **$137,746** |
| 2 | *(미확인)* | Daangn-**AI Data Platform Migration POC** (DW 전환) | 2026-07 | $250,000 | 미적용 | $250,000 |
| 3 | **KA-CUKWZGLH09** | Daangn-**AI Workload Winback Phase2** | 2026-09 | $250,000 | 미적용 | $250,000 |
| 4 | **KA-X34LECR46R** | Daangn-**Claude Platform on AWS Migration** | 2026-09 | $250,000 | 미적용 | $250,000 |
| | | **합계** | | **$1,000,000** | **$112,254** | **$887,746** |

- 집행처: Account ID **324404180070** (8월 $26K 적용)
- 3·4번은 2026.9 승인, 인보이스 제출 완료 → AWS→MZC 실지급 **인보이스 제출 후 약 30일 이상 소요**
- Opportunity: O25059850 / O19498258

> **하반기 플랜의 가장 강력한 카드이자 가장 큰 리스크.** $887,746이 미집행 상태다. 펀드는 **소진 실적이 다음 펀드 승인의 근거**가 된다. 9/29에 **"어느 계정에 · 언제 · 얼마씩"** 의 집행 캘린더를 못 내면, 내년 펀드 확보 논리까지 약해진다.
>
> 그리고 펀드 이름 4개가 정확히 하반기 플랜의 4개 축이다 — **AI 워크로드 확장 / DW 전환 / AI 워크로드 Winback / Claude on AWS.**

---

## 5. 이해관계자 맵 (실명·연락처 확보분)

### 5-1. 고객 측

| 성명/직책 | 이메일 | 관계 | 분류 | 하반기 액션 |
|---|---|---|---|---|
| **강진우 / 인프라실 실장** (Alden) | alden@daangn.com | **High Touch** | **Champion** | 위버스 시절부터 6년. **1인 의존이 최대 리스크** |
| Alan Kim | alan.kim@daangn.com | Active | Technical Buyer | WAF PPA 계약 검토 창구, AWS MBR 주최자 |
| Harry H | harry@daangn.com | Active | Technical Buyer | 9/11 PPA 논의 수락 후 거절 |
| Wayland Byeon | wayland@daangn.com | Active | Technical Buyer | 9/11 휴가로 불참 |
| SRE팀 / SRE 클라우드 파트 | team.infra.sre@daangn.com<br>team.infra.sre.cloud@daangn.com | 그룹 | Technical Buyer | MBR 정기 참석 |
| 인프라 | infra@daangn.com | 그룹 | — | SBR 비용리뷰 수신처 |
| **당근페이 인프라** | pay.infra@daangn.com | 그룹 | Technical Buyer | MBR 참석 |
| **당근페이 보안 챕터** | karrotpay-chapter-security-engineers@daangnpay.com | 그룹 | **Security Buyer** | HALO·Wiz 침투 대상 |
| Yany | yany@daangnpay.com | Accepted | — | 당근페이 MBR 상시 참석 |
| **정창훈 / CTO** | `[CONFIRM]` | Neutral | **AI 예산 책임자** | **미접촉.** 5월 플랜 "CEO/CRO 1:1 ~5/31" 미실행 |
| **최진원 / CISO** | `[CONFIRM]` | Neutral | **보안 예산 책임자** | 1월 초도미팅 후 정체 |
| **엄상돈 / 구매팀 실장** | `[CONFIRM]` | Neutral | **Detractor** | IPO 대비 **경쟁입찰 의무화 추진** |
| **권상윤 / 데이터가치화팀 리더** | `[CONFIRM]` | Neutral | **Detractor** | GCP 이탈 검토 중, **Azure 동시 검토** |
| 조쉬 / 버티컬 서비스팀 실장 | `[CONFIRM]` | — | AI팀 관할 | 코딩에이전트·온톨로지 |

### 5-2. MZC / 파트너

| 이름 | 역할 | 비고 |
|---|---|---|
| 김태현 | Account Manager (1부문) | 본 플랜 Owner |
| hyeokjae@mz.co.kr | 2부문 AM | **9/29 합동 세션 — 사전 sync 필수** |
| 정영석 / 김지웅 | 유닛장 | 경쟁사 대응 Owner |
| 이재성 | 팀장 (CloudNative) | PPA 사업성 검토 |
| **김원태** | **CSM / FinOps Consulting Unit Leader** | **9/1 정식 배정** (마켓 00056906 / 페이 00056943), SBR 비용리뷰 작성자 |
| 이슬비 | Account SA | **R&R 재배치 논의 중 — 이탈 시 기술 커버 공백** |
| 노영채 / zerochae | FinOps | 하이퍼빌링 |
| 한상현 | Contract Mgnt | DMS 0RJE2Z1ZD2H2N |
| 주연나 | S&P Ops | 리뷰 주관 |
| **최낙권** | **AWS AM** | nakkwonc@amazon.com — PPA 동행 방문 |
| 문태권 | AWS TAM | 5월 교체 (前 김호성) |
| Michelle Kim | MZC AWS Alliance | SCA Fund 4건 |
| aws-daangn-team@amazon.com | AWS 전담팀 | SBR 수신 |
| **Sam Um (엄상렬)** | **Snowflake Commercial 이사** | **"당근마켓 — 메가존과 sync-up하며 함께 딜 진행 중"** |

---

## 6. MEDDPICC 헬스체크 (2026-09-22 기준)

| 항목 | 판정 | 근거 |
|---|:---:|---|
| **M**etrics | 🟡 | Gemini ARR $1M / BigQuery $800K·년 / Outbound $130K·월 / WAF $18K·월 — **전부 5월 기준. 8월 실측과 재대조 안 됨** |
| **E**conomic Buyer | 🔴 | **CTO·CFO 라인 미접촉.** 5월 플랜의 CEO/CRO 1:1(~5/31) 실행 근거 없음 |
| **D**ecision Criteria | 🟡 | WAF=단가, LLM=Time-to-PoC·추론비용, DW=TCO 50%+ — 기준은 있으나 **고객 확인 문서 없음** |
| **D**ecision Process | 🔴 | 바텀업 분산 + **구매팀 경쟁입찰 의무화 추진.** 단일 결재자 부재 |
| **P**aper Process | 🟢 | WAF PPA: 사업성검토 결재 종결(9/8) → DMS 고객 검토(9/10) → 계약 댓글(9/22). **유일하게 프로세스가 도는 딜** |
| **I**dentify Pain | 🟢 | Gemini EOL **10/16 (D-24)**, WAF 과금 변경, GCP 빌링 오류·쿼터 제한, Extended Support 과금 시작 |
| **C**hampion | 🟡 | 강진우 실장 High Touch — 다만 **1인 의존**. 5월 플랜의 백업 관계 구축(~6/30) 실행 근거 없음 |
| **C**ompetition | 🔴 | Azure 직거래(High) / SK AX(High) / 베스핀(Med) / LG CNS(Med) **+ 내부 노선 충돌(Databricks vs Snowflake)** |

**🔴 3개 (EB, Decision Process, Competition).** 백본 규칙상 🔴 2개 이상이면 qualify-out 질문을 던져야 하지만, 이 계정은 **연 500억+ 기존 매출 Top 10 어카운트**이므로 qualify-out 대상이 아니다. 대신 질문을 바꾼다:

> **"이 계정에서 우리가 실제로 통제할 수 있는 건 무엇인가?"**
> 통제 가능: WAF PPA 클로징, 펀드 $887K 집행, FinOps 절감 실행, MBR 월례 접점.
> 통제 불가: 구매팀 경쟁입찰 방침, 고객의 자체 서빙 전략, Azure 검토.
> **하반기 플랜은 통제 가능 영역에 자원을 몰고, 통제 불가 영역은 "지연·완화" 목표로만 잡는다.**

---

## 7. 하반기 플랜 골격 제안 (9/29 발표용)

### 축 1. WAF/Shield PPA 클로징 — **10/1 계약 시작 사수**

| 항목 | 내용 |
|---|---|
| 계약 | 2026.10.1 ~ 2028.9.30 (24개월), 당근 Payer **9775-2092-8651** 하위 |
| 대상 | AWS Shield Advanced DTO, AWS WAF Shield-Protected Capped Requests |
| 현재 사용량 | **Shield Advanced DTO 624TB/월 (커버리지 26%)**, WAF Request **약 535억 건/월**, Shield Advanced 월 이용료 $2,425.50 |
| 전사 확대 시 | **3PB/월 (3,304,448GB)** |
| 조건 | 약 **+50% 할인율** (winning rate) |
| 상태 | 사업성검토 결재 종결(9/8) → DMS 고객 검토(9/10) → **9/22 계약 담당 댓글 수신** |
| **리스크** | **추석 연휴로 물리적 시간 부족.** 기준 단가 미충족 시 3rd Party WAF 또는 자체 도입 전환 (김지웅 유닛장 지적) |
| 하반기 액션 | 커버리지 **26% → 전사 확대**가 곧 매출 확대. 확대 로드맵을 계약과 동시에 합의 |

### 축 2. AI 인프라 Winback — **프레이밍 전환**

| 5월 플랜 | 하반기 수정안 |
|---|---|
| "Gemini → Bedrock Nova Lite 전환" | **"AI 인프라 Winback"** — Bedrock + **Trainium/GPU 자체 서빙** + Neuron 최적화 |
| 근거: Gemini EOL 10/16 | 근거 유지 + **8월 실측(GPU/Trainium/vLLM 증가, Bedrock 감소)** |
| 펀드: $250K 1건 | **$887,746 미집행 잔액 전체** |

- **Gemini 2.5 Flash EOL 10/16 — D-24.** 하반기 플랜에서 **가장 시급한 단일 날짜.**
- `karrot-neurondeepdive2026` 계정이 이미 존재 → **Neuron/Trainium 최적화 PS 프로젝트**가 가장 자연스러운 진입 (현재 PS 매출 0원)
- `karrot-llm-router-vllm` → **vLLM 서빙 아키텍처 리뷰 + Inferentia 전환 TCO 분석**

### 축 3. 데이터 플랫폼 — **노선 정리 먼저**

- 1부문 플랜: **BigQuery → AWS on Databricks ($1.2M)**
- 9/8 Snowflake 메일: **"당근마켓 — 메가존과 sync-up하면서 함께 딜 진행 중"** (Sam Um 담당)
- **두 노선이 병존하면 고객 앞에서 메시지가 깨진다.** 9/29 합동 세션 전 **1·2부문 + Data Unit sync 필수** (주연나 메일도 사전 sync 요청)
- 기술 제약: 컬럼 리니지·이벤트센터·KarrotMetrics·data-mcp가 **전부 BigQuery 강결합** → **전면 이관 비현실적.** 스코프를 "AI/ML 워크로드 데이터 레이어의 AWS 근접 배치"로 좁힐 것

### 축 4. FinOps 상시화 — **Managed/PS 매출 0원 탈출**

- 8월 기준 즉시 절감안 **월 약 $53.5K** + 5월 Trusted Advisor 연 $64K
- **Extended Support 과금이 이미 시작됐다**(MySQL 8, EKS 1.34) — 우리가 5월에 권고했으나 미실행. **유상 업그레이드 PS의 명분**
- CSM 김원태 정식 배정 + **월례 AWS MBR(10/20, 11/17, 12/15)** 이라는 고정 접점 확보 → **SBR을 Notion 페이지로 상시화하자는 김원태 제안을 플랜에 공식 편입**

### 축 5. 보안 — **당근페이로 진입**

- 당근페이 보안 챕터(`karrotpay-chapter-security-engineers@daangnpay.com`)가 MBR 상시 참석 → **이미 접점이 있다**
- AI 기본법 + 마이데이터 확대(2026.8.25 발표) + 당근페이 고영향 서비스 = 외부 강제 트리거
- **단, HALO Offering 출시 상태를 확인하기 전엔 CISO 미팅을 잡지 말 것** (5월 플랜의 자체 경고)

### 축 6. 관계 리스크 해소 — **Champion 다각화**

- 강진우 실장 1인 의존 → 5월 계획(SRE 리드 2명 백업 관계, ~6/30) **미실행**
- 9월 Meet-up 스폰서십 집행 = **관계 자산이 이미 만들어졌다.** 이걸 개인 관계로 전환
- Alan Kim / Harry / Wayland / 당근페이 Yany — **MBR 참석자를 개별 관계로 승격**

---

## 8. 리스크 등록부

| # | 리스크 | 영향 | 현재 상태 | 하반기 대응 |
|---|---|---|---|---|
| 1 | **구매팀 경쟁입찰 의무화** (IPO 대비) | 신규·연장 계약 전부 경쟁 노출 | 진행 중 | 입찰로 확보 불가한 재무 Benefit(PPA·EDP·CPPO) 선제 제시. **CFO↔CFO 라인 필요** |
| 2 | **Gemini EOL 10/16** | $1M ARR 워크로드 향방 결정 | **D-24** | 자체 서빙(Trainium/GPU) 경로로 프레이밍 전환 + 펀드 즉시 집행 |
| 3 | **Bedrock 사용 감소 (-61%)** | Winback 서사 붕괴 | 8월 실측 | "Bedrock" → "AI 인프라"로 전환. Neuron 최적화로 대체 |
| 4 | **Databricks vs Snowflake 내부 충돌** | 고객 앞 메시지 분열 | 미해결 | **9/29 전 1·2부문 sync** |
| 5 | **이슬비 Account SA 공수 재배치** | 기술 커버 공백 | 논의 중 (9/8~18) | 9/29에서 **Dedicated SA 유지 요청**을 공식 Request로 |
| 6 | **Champion 1인 의존** | 부재 시 관계 단절 | 5월 대책 미실행 | MBR 참석자 개별 관계 승격 |
| 7 | **Extended Support 과금 진행** | 고객 불만 + 우리 권고 무시 이력 | 8월부 발생 중 | 유상 업그레이드 PS로 전환 |
| 8 | **DynamoDB 런던 약정 2건 사용률 0%** | 글로벌 축소 신호 | 8월 확인 | 캐롯 해외 전략 확인 후 약정 재조정 제안 |
| 9 | **2부문 플랜 접근 불가** | 합동 세션 준비 불가 | 권한 없음 | **즉시 권한 요청** |
| 10 | **Run-Rate 기준 불일치** ($2.6M vs $1.86M) | 플랜 재무표 신뢰도 | 미해결 | 김원태 CSM과 기준 확정 |

---

## 9. 9/29까지 액션 캘린더

| 기한 | 액션 | 대상 |
|---|---|---|
| **9/23(수)** | **참석자 추가 명단 회신** — 제안: 김원태(CSM), 이슬비(Account SA), 노영채(FinOps), 한상현(Contract) | 주연나 |
| **9/23(수)** | **2부문 Account Plan 문서 열람 권한 요청** | hyeokjae / 주연나 |
| 9/24(목) | WAF PPA DMS 계약 검토 상태 확인 + 연휴 前 클로징 일정 확정 | 한상현 / 이재성 |
| 9/24(목) | **Run-Rate 기준 확정** ($2.6M vs $1.86M) + 2026 YTD 실적 확정 | 김원태 |
| 9/25(금) | **펀드 $887,746 집행 계획 초안** — 계정별·월별 배분 | Michelle / 고객 |
| 9/25(금) | Extended Support 과금 규모 산출 (MySQL 8, EKS 1.34) | 이슬비 / 문태권 |
| **9/26(토)** | **1·2부문 sync — Databricks vs Snowflake 노선 단일화** | hyeokjae / Data Unit |
| 9/26(토) | 5월 Trusted Advisor 낭비 항목 제거 실적 확인 | 노영채 |
| 9/28(월) | 발표 자료 확정 + Account Plan v3.0 문서 업데이트 | 본인 |
| **9/29(화) 15:30** | **Account Plan Review** (과천 5층 CEO 미팅룸) | — |

### 이어지는 고정 접점

| 일시 | 일정 |
|---|---|
| 10/20(화) 16:00 | **AWS MBR 세션** (교보타워 10B) — 당근마켓·당근페이 합동 |
| 11/17(화) 16:00 | AWS MBR 세션 |
| 12/15(화) 16:00 | AWS MBR 세션 |

> MBR 3회가 4분기 내내 열려 있다. **하반기 플랜의 액션을 이 3개 날짜에 매핑하면 실행 가능성이 급상승한다.** 플랜에 "3Q/4Q" 같은 분기 표기 대신 **MBR 날짜를 박아 넣을 것.**

---

## 10. 확인 필요 항목 (`[CONFIRM]`)

| # | 항목 | 확인처 |
|---|---|---|
| 1 | Run-Rate 공식 기준 — $2.6M(5월 Hyperbilling) vs $1.86M(8월 Payer) | 김원태 |
| 2 | 플랜 기재 "YTD YoY +69.0%" 의 기준 시점·산식 | 재무 / 주연나 |
| 3 | WAF PPA "약 25억" — 총계약금액인지 연간인지 | 이재성 / 한상현 |
| 4 | 2026 YTD 실적 (1~8월 누계) — 목표 대비 달성률 | 김원태 |
| 5 | 펀드 #2 (AI Data Platform Migration POC) PO Number | Michelle |
| 6 | 액션 #4 CloudWAN/NetworkFirewall PoC 실제 진행 여부 | 이슬비 |
| 7 | HALO AI 거버넌스 Offering 출시 상태 | 위수영 / 김진호 |
| 8 | Wiz 인증 SA 양성 및 데모 진행 여부 | HALO |
| 9 | 정창훈 CTO / 최진원 CISO / 엄상돈 구매팀 실장 / 권상윤 리더 — 연락처 및 최근 접촉 이력 | 본인 기록 / 강진우 |
| 10 | Databricks PoC 실제 착수 여부 + Snowflake 딜 내용 | Data Unit / 2부문 |
| 11 | Extended Support 과금 실제 금액 (MySQL 8, EKS) | 김원태 |
| 12 | 이슬비 Account SA 당근 배정 유지 여부 | 배승일 / 이재성 |
| 13 | 당근 레퍼런스 대외 활용(CJ올리브영) 고객 동의 | 강진우 |

---

## 11. 데이터 출처

**내부 (Gmail / Drive / Calendar, 2026)**
- [Account Plan] v2 (주)당근마켓 — Google Docs, 2026.05.15 작성, v2.0
- 당근마켓 9월 AWS SBR 비용리뷰 (김원태, 2026.9.16) — **8월 실측 데이터 원천**
- [당근/당근페이] AWS SBR & 비용 리뷰 회의록 (이슬비, 2026.6.1) — 5월 실측
- 당근마켓 WAF/Shield Advanced Single PPA 계약 검토 요청 (2026.9.3~9.22, 이재성·김지웅·한상현)
- 당근 WAF·Shield Advanced Private Pricing 제안 조건 안내 (→ alden@daangn.com, 2026.9.8)
- 당근마켓 8월 AWS 사용료 Credit 적용 요청 (서영규, 2026.9.7) — **펀드 잔액 원천**
- SCA GenAI Fund 신청 스레드 3건 (Michelle Kim, 2026.7~9)
- \<Snowflake\> Cross Industry 팀 Joint Account Drive (2026.9.8)
- Account Presales 업무 지원 요청 (배승일, 2026.9.8~18)
- SFDC CSM 배정 알림 (2026.9.1) — 사례 00056906 / 00056943
- Account Plan Review 일정 변경 안내 (주연나, 2026.9.9 / 리마인드 9.20)
- Google Calendar — [Internal] Account Planning 당근마켓 (9/29), AWS MBR 세션 (10/20·11/17·12/15)

**외부** — 선행 문서 `daangn-2026H2-account-planning-data.md` §9 참조

---

> **가드레일:** 본 문서의 모든 금액은 위 출처 기준이다. §3-7의 절감 합계와 §2-2의 재원 추정은 **성격이 다른 항목의 산술 합**이므로, 고객 제출 자료에 단일 숫자로 옮기지 않는다. `[CONFIRM]` 13건은 확인 전까지 대외 자료에 사용하지 않는다.
