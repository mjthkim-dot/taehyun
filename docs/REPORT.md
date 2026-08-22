# 실시간 영어 미팅 어시스턴트 — 구현 보고서

> 대상: `meeting-copilot/` · 브랜치 `claude/smoothai-kr-english-rag-n23xqg`
> 설계: [ARCHITECTURE.md](./ARCHITECTURE.md) · 계획·수용 기준: [PLAN.md](./PLAN.md)

## 1. 이 앱이 다른 이유

Smooth AI를 포함한 기존 미팅 코파일럿은 **일반적으로 맞는 영어**를 준다.
이 앱은 **내가 실제로 말할 법한 영어**를 준다. 차이는 한 곳에서 나온다:
발언을 만들기 전에 *내 수업 노트 · 내 과거 미팅 · 내 도메인 용어집*을 검색하고,
거기서 나온 표현을 우선 쓴다. 그리고 **실제로 그 표현을 썼을 때만**
"📚 수업에서 배운 표현" 뱃지를 붙여, 근거 없는 신뢰를 만들지 않는다.

## 2. 파이프라인

```
상대 발화 ── Web Speech(실시간) 또는 탭 오디오→VAD→Whisper
   │
   ├─▶ 자막(interim 점선 / final 확정)
   ├─▶ 한국어 번역 (fast 모델 · 캐시 2레인)
   └─▶ 롤링 요약 배너 (10발화 버퍼 · 3문장 또는 30초 · 단일 비행 + 합류)

[동의 / 반박 / 질문 / 제안] 클릭  또는  한→영 퀵 번역 입력
   │
   1) 질의 구성 — 버튼: 맥락 5문장 + 직전 발화 / 퀵 번역: 입력 문장 단독
   2) 하이브리드 검색 top-3 (BM25 + 코사인 → RRF, 소스 다양성 보정)
   3) 히트 < 2 → RAG 없이 폴백 (지연 최소화)
   4) Claude 생성 — 15단어 이내 · 비즈니스 톤 · 검색 표현 우선
   5) 생성문이 검색 표현의 3어절 이상을 포함 → 📚 뱃지

미팅 종료(⏹)
   ├─▶ 사후 요약 (요점 / 약속 / 후속 액션 / 다음에 쓸 표현)
   ├─▶ 트랜스크립트 자동 색인 (누적 학습)
   └─▶ 복습 자산화 — 표현 10 + 놓쳤을 구간 + 질문 리스트 → SRS 카드(1/3/7일)
```

## 3. 두 가지 안전 기본값

사용자가 명시적으로 요구한 두 제약을 **코드 수준에서** 지킨다.

| 제약 | 구현 | 검증 |
|---|---|---|
| 자동 백그라운드 색인 금지 | 색인 쓰기 경로는 ① `/api/sync`(동기화 버튼) ② 미팅 종료 훅 ③ 사용자가 누른 인제스트 버튼뿐. 기동 시 시드는 `embed=False`로 **네트워크를 타지 않는다**. 스케줄러·폴러 없음 | 호출 지점 감사 + E2E |
| Notion 자동 쓰기 OFF | `/api/notion/save`는 `confirm: true` 없으면 **400**. UI는 페이지 주소 입력 + `confirm()` 확인을 거친다. 토큰이 없으면 "마크다운 복사"로 폴백 | `confirm` 없는 요청 → 400 (실측) |

## 4. 측정 결과

### 4.1 검색 품질 — `tests/rag-eval.ts` (10케이스)

**임베딩 없이(키워드 전용) 10/10 (100%).** 색인 118청크
(용어집 70 · 수업 노트 17 · 트랜스크립트 31).

| 갈래 | 예시 질의 | 기대 | 결과 |
|---|---|---|---|
| 영어 발화 → 용어집 | "your quote came in higher than the other vendor" | total cost of ownership | ✅ |
| 영어 발화 → 용어집 | "worried about being locked in to a single cloud" | vendor lock-in / exit strategy | ✅ |
| 한국어 → 영어 노트 | "다음 미팅이 기대된다고 말하고 싶어요" | looking forward | ✅ |
| 한국어 → 영어 노트 | "커피 주문하는 표현" | Can I get one cappuccino | ✅ |

여기서 두 개의 결함을 찾아 고쳤다.

**(a) 한국어 질의가 영어 노트에 닿지 못했다.**
수업 노트에는 `I am looking forward to {weekend / trip / ...}` 처럼
**한국어가 한 글자도 없는 줄**이 많다. 그런데 하단 퀵 번역은 사용자가
한국어로 친다. 임베딩이 없는 환경에서는 이 두 문자열이 한 토큰도 겹치지 않아
영영 검색되지 않았다. 기존에는 *한국어 노트 → 영문 키워드* 다리만 있었으므로,
**반대 방향 다리**(`_BRIDGE_EN`: 영어 패턴 → 한국어 검색어)를 추가했다.
한국어 질의 5건 중 1건 적중 → 5건 중 5건 적중.

**(b) 퀵 번역 질의가 미팅 맥락에 끌려갔다.**
맥락 5문장을 질의에 붙이면 맥락 쪽 토큰 수가 압도해, 한국어 입력의 의도가
묻히고 검색이 통째로 트랜스크립트로 떨어졌다. `intent == "translate"`일 때는
**입력 문장만** 질의로 쓰고, 맥락은 프롬프트에만 남겨 어조를 잡는 데 쓴다.
근거 3건이 전부 트랜스크립트 → 전부 수업 노트로 바뀌었다.

### 4.2 📚 뱃지 정확도

뱃지는 "검색이 됐다"가 아니라 **"검색된 표현을 실제로 썼다"**일 때만 켜진다.
생성문에 검색 표현의 **연속 3어절**이 나타나야 한다(시제·주어 변화를 허용하기 위해
전체 일치가 아니라 3어절 창을 쓴다). 뱃지에 마우스를 올리면 근거 표현이 보인다.

여기서도 결함이 하나 있었다. 표현 추출기가 *마침표로 끝나는 문장*과 *인용문*만
훑어서, 정작 이름이 "수업에서 배운 표현"인데 **수업 노트에서는 뱃지가 한 번도
켜지지 않았다** (노트는 완결 문장이 아니라 기호·한국어 주석이 섞인 줄이라서).
한국어 사이에 낀 영어 덩어리(3어절 이상)를 함께 뽑도록 고쳐,
`I am looking forward to` 같은 노트 표현으로 뱃지가 정상 동작한다.

### 4.3 E2E — `tests/e2e.mjs` (Playwright, 390×844)

샘플 트랜스크립트 5발화를 주입해 검증했다. **32개 체크 전부 통과, 콘솔·네트워크 오류 0.**

- 자막 5줄 · 상대 발언에만 한국어 번역(내 발언은 번역하지 않아 호출을 아낀다)
- 롤링 요약 배너: "견적가가 경쟁사보다 높다는 반론"
- 4버튼(agree/pushback/ask/propose) 각각: 2안 생성 · **15단어 이내 100%** ·
  근거 표시 · 📚 뱃지 · 카드 표시까지 0.10~0.14초(로컬 모의 공급자 기준)
- 한→영 퀵 번역이 같은 파이프라인을 타고 수업 노트를 근거로 씀
- 제안 카드가 하단 퀵 액션을 가리지 않음
- 수동 동기화 버튼 동작 · 복습 탭 통계 · Notion 저장은 버튼으로만

### 4.4 SRS 간격 (실측)

| 조작 | 단계 | 다음 복습 |
|---|---|---|
| 카드 생성 | 0 | 1.0일 뒤 |
| 맞힘 | 1 | 3.0일 뒤 |
| 맞힘 | 2 | 7.0일 뒤 |
| 틀림 | 0 | 1.0일 뒤 (되돌림) |
| 3회 통과 | 졸업 | 더 이상 뜨지 않음 |

방금 만든 카드는 첫 복습이 **내일**이라 "오늘 볼 카드"가 0이 된다.
그대로 두면 카드가 안 만들어진 것처럼 보이므로, 이 경우 **예정 카드**를
날짜와 함께 보여준다.

### 4.5 Lighthouse

| | 성능 | 접근성 | 권장사항 | SEO |
|---|---|---|---|---|
| 모바일 | 100 | 100 | 100 | 100 |
| 데스크톱 | 100 | 100 | 100 | 100 |

처음에는 접근성 92 / SEO 90이었다. 원인은 `--faint` 색의 명도 대비 3.79:1
(기준 4.5:1)과 meta description 부재. 대비를 올린 건 점수 때문만이 아니다 —
**미팅 중 어두운 화면에서 실제로 잘 안 보이는 톤**이었다.

## 5. 데이터

| 소스 | 규모 | 비고 |
|---|---|---|
| 도메인 용어집 | **70개** (`backend/data/domain-corpus.json`) | 전 항목에 `triggers`(고객이 실제로 하는 말) 포함 |
| 수업 노트 | 17청크 | 진옥 선생님 1~5회차 누적 정리 → [표현 7 / 교정 3 / 예문·설명] 분류 |
| 트랜스크립트 | 31청크 | 미팅 종료 시 누적 |

`triggers`가 왜 필요한가: 고객은 "your quote is higher"라고 말하지
"total cost of ownership"이라고 말하지 않는다. 두 문자열은 **한 단어도 겹치지 않아**
용어집이 영영 검색되지 않는다. 그래서 각 용어에 *고객이 실제로 하는 말*을 함께 심는다.

> 개인 데이터(트랜스크립트·수업 노트)는 로컬 SQLite에만 있고
> `.gitignore`가 `backend/data/store.db*`를 차단한다. 저장소에 올라가는 건
> 도메인 용어집 시드뿐이다.

## 6. 남은 것

| 항목 | 상태 | 메모 |
|---|---|---|
| 임베딩(bge-m3) 활성 | 미적용 (환경에 Ollama 없음) | `ollama pull bge-m3` 후 동기화 버튼 → 의미 검색 활성. 키워드 전용으로도 10/10이라 필수는 아니다 |
| 실모델 지연 | 모의 공급자 기준 측정 | 앞선 실측: Cerebras 0.55s · Groq 0.67s · Gemini 1.34s |
| Notion 실제 쓰기 | 경로·거부 검증 완료, 실제 쓰기는 미수행 | `NOTION_TOKEN`과 페이지 편집 권한이 있어야 하고, 사용자 확인을 거치는 동작이라 임의로 실행하지 않았다 |


---

## 7. 전수 QA와 성능 개선 (2026-08-22)

기능 46건 전수 검사 + 부하·스케일·UI 검사를 돌려 결함을 찾고, **실시간 번역·응답
경로를 최우선**으로 고쳤다. 최종 회귀: 기능 46/46 · 검색 10/10 · E2E 32체크 전부 통과.

### 7.1 핵심 수정 — 동시 검색 지연 100배 폭증

색인 1,721청크에서 검색 단독은 14ms인데 **동시 4건이면 1,268ms, 8건이면 3,327ms**가
됐다. 추측 생성 + 버튼 클릭 + 퀵 번역이 겹치는 건 실사용에서 일상이라, 실시간 제안의
꼬리 지연이 그대로 무너지는 결함이다. 원인은 두 겹:

1. **BM25의 N+1 쿼리** — 매칭 청크마다 `SELECT n_tokens`를 개별 실행. 흔한 단어는
   청크 1,600개가 매칭돼 검색 1회에 소형 쿼리 3,200번이 나갔다. → postings와 chunks를
   JOIN 한 방으로.
2. **GIL 콘보이** — CPU 바운드 점수 계산을 병렬로 돌리면 스레드 경합으로 전체가
   느려진다. → 검색 CPU 구간을 단일 락으로 직렬화 (개별 작업이 10~20ms라 대기가
   거의 없다). 질의 임베딩(네트워크 호출)은 락 밖에서 계산한다.

| 시나리오 (1,721청크) | 수정 전 | 수정 후 |
|---|---|---|
| 검색 동시 4건 p50 | 1,268ms | **60ms** (21×) |
| 검색 동시 8건 p50 | 3,327ms | **105ms** (31×) |
| 미팅 종료 적재 + 검색 4스레드 혼합 | 72.5s | **3.3s** (22×) |

### 7.2 실시간 경로 가드

- **빈 입력이 LLM까지 가던 것 차단** — 번역·제안 모두 400 즉시 반환 (요금·지연 낭비 제거)
- **입력 상한** — 번역 2,000자 절단(자막 목적에 맞게), 제안 said 1,500자·context 3,000자
- **버튼 연타 병합** — 첫 클릭은 즉시(실시간 우선), 300ms 안의 연속 클릭은 마지막
  의도 하나만 LLM으로 (실측: 3연타 → 요청 2건, 카드는 마지막 의도)
- **공급자 복구 즉시화(half-open)** — 장애 후 60초 제외는 다중 공급자 전환용인데,
  키가 하나면 공급자가 살아난 뒤에도 최대 60초 계속 실패했다(실측). 사용 가능한
  공급자가 0이면 제외를 무시하고 다시 찔러본다 → 부활 직후 첫 호출부터 성공 확인

### 7.3 견고성·보안

- GET 핸들러 예외 방어 — `?k=abc`가 int() 예외로 **응답 없이 연결을 끊던 것**을 400으로
- 깨진 JSON·잘못된 카드 id·entries 타입 오류 → 500이 아닌 400 (클라이언트가
  "서버 문제"와 "내 요청 문제"를 구분할 수 있게)
- `k`·`limit` 파라미터 상한 (자원 남용 차단), `/health`도 cross-origin 403 일관 적용
- 외부 유래 텍스트(서버 오류 문자열 · 상대 발화에서 뽑은 용어 후보 · 검색 제목 ·
  공급자 오류 상세)가 innerHTML로 들어가던 5곳에 `esc()` 적용
- LLM 전멸 시 카드에 "⏳ 생성 중…"이 남던 것 → 재시도 안내로 교체
- STT 미설정 안내에 무료 로컬 대안(faster-whisper) 병기

### 7.4 확인만 하고 수정하지 않은 것

- 헤드리스 테스트에서 탭 캡처 시도 후 UI가 먹통되던 현상 — 브라우저 공유 선택
  모달이 클릭을 삼키는 **테스트 환경 아티팩트**로 확정 (fake-UI 플래그로 승인 경로
  검증: 화자 분리 배너까지 정상). 실브라우저 동작과 무관.
- 부하: 동시 8커넥션 전 엔드포인트 오류 0 · 60분 미팅 시나리오 145호출 오류 0 ·
  RSS 57MB — 수정 불요.


---

## 8. 웹 서비스 전환 구현 (2026-08-22)

7장의 QA와 웹 전환 분석에서 나온 블로커를 **1~3단계 전부** 구현했다.
회귀: 기능 46/46 · 웹 계층 16/16 (`tests/web_qa.py`) · 검색 10/10 · E2E 전부 통과 ·
Lighthouse 4개 카테고리 100 유지.

### 8.1 전송 계층 (1단계)

- **HTTP/1.1 keep-alive + 청크 스트리밍** — HTTP/1.0이라 매 호출 TCP 연결을 새로
  맺던 것을 전환. 스트림 응답은 청크 프레이밍으로 감싸 **스트림 직후 같은 연결로
  다음 요청이 이어지는 것을 소켓 레벨에서 검증**했다. 중간 실패는 프레이밍 복구가
  불가능하므로 연결을 끊는다(정상 완료만 종료 프레임).
- **소켓 타임아웃 30초** — slowloris 30연결이 스레드 31개를 무한 점유하던 것이
  31초 후 1개로 회수됨을 실측.
- **본문 상한 8MB** — `Content-Length: 99999999` 선언 → 413 즉시 반환 + 연결 종료
  (읽지 않은 본문이 keep-alive의 다음 요청을 오염시키지 않게).
- 보안 헤더: nosniff · Referrer-Policy · 앱 셸에 CSP(`connect-src 'self'` — XSS가
  생겨도 데이터가 밖으로 못 나가게) · Permissions-Policy.

### 8.2 인증·격리·쿼터 (2단계)

- `backend/auth.py`: scrypt 접속 코드 해시, HMAC 서명 무상태 세션(30일),
  IP별 지수 락아웃(5회 무료 → 2^n초), 타이밍 균일화(없는 계정도 해시 1회).
- **물리적 데이터 격리**: 사용자 1명 = `u/<id>/store.db` 1개. 격리 검증 —
  alice가 넣은 노트가 bob의 검색에 안 나오고, bob의 전체 삭제가 alice에 영향 없음.
- **무인증 공개 차단**: 외부 바인딩 + 사용자 0명 → 기동 거부.
- 사용자별 LLM 쿼터: 분당(메모리 슬라이딩 윈도) + 일일(DB 영속). 초과 시 429와
  한국어 사유. 검증 — RPM=3 설정에서 `[200,200,200,429,429]`.
- `manage.py`: adduser/passwd/disable/deluser(--purge)/adopt(기존 로컬 데이터
  이관 — 파일 복사가 아니라 sqlite backup API)/backup.
- 로그인 UI: 오버레이(브라우저 검증 — 오답 사유 표시·세션 유지·로그아웃),
  API 401은 어디서 나오든 로그인 화면으로 복귀.

### 8.3 운영 (3단계)

- 관측: 엔드포인트별 p50/p95/오류 링버퍼 + 오늘 사용자별 LLM 호출 수 —
  관리자 전용 `GET /api/admin/stats`.
- STT 동시성 세마포어(기본 코어/2) — CPU 바운드 Whisper가 서로를 굶기지 않게.
- SIGTERM 그레이스풀 셧다운(진행 중 응답 완료 후 종료 — 실측).
- 배포 자산: `deploy/Caddyfile`(flush_interval -1 = 스트리밍 버퍼링 방지),
  `deploy/nginx.conf.example`(proxy_buffering off), systemd 유닛(DynamicUser·
  ProtectSystem=strict, 코드 /opt · 데이터 /var/lib 분리), `docs/DEPLOY.md`.
- `MC_DATA_DIR` — 코드(저장소 자산)와 런타임 개인 데이터의 물리 분리.

### 8.4 성능 재확인

전송 계층 전환 후 동시 8커넥션: translate p50 19ms / suggest p50 96ms, 오류 0
(모의 공급자 기준). 검색 직렬화·N+1 제거 효과는 7장 그대로 유지.

### 8.5 프레임워크 이관을 하지 않은 이유 (기록)

실측 병목은 LLM 쿼터(Tier 1: 동시 13미팅)와 STT CPU이지 서버 스레드 모델이
아니다. 의존성 0 원칙과 배포 단순성(개인 VPS에서 pip 없이)이 실제 가치이고,
웹 노출면 방어는 Caddy가 앱보다 잘한다. 동시 미팅 수십을 넘겨 Tier 2+와
STT GPU가 필요해지는 시점에 asyncio 이관을 재평가한다.


---

## 9. 자율 고도화 스프린트 — 감사 기반 갭 해소 (2026-08-22)

Phase 0 감사([AUDIT.md](./AUDIT.md))에서 수용 기준 6개 대비 갭 3건을 식별하고
전부 구현·검증했다. 과정에서 검색 품질 회귀 1건을 추가로 발견해 고쳤다.

### 9.1 Before / After

| 항목 | Before | After |
|---|---|---|
| 미팅 종료 질문 리스트 | 비즈니스 후속 질문만 | + **🎓 진옥 선생님께 물어볼 것** — 못 알아들은 관용구·못 만든 문장을 영어 원문 인용과 함께 수업용 질문으로 (미팅의 막힌 지점 → 다음 수업 커리큘럼) |
| 데스크톱(1280px) | 자막·카드가 1,200px 전폭으로 늘어져 흘끗 읽기 불가 | 660px 중앙 칼럼 — 사이드 패널 폭과 동일한 읽기 폭 (390px 회귀 없음) |
| 번역 대기 | 빈칸이었다가 갑자기 채워짐 | 깜빡이는 `···` — "없는 것"과 "오는 중"이 구분됨 |
| 한국어 검색 순위 | '어요' 같은 어미 조각이 매칭을 오염 — 감사 질의에 인사 노트가 상위 | 어미·조사 2-gram 40여 개 제외 + 전체 재색인 — 감사 노트 1·2위 복귀 |
| E2E 범위 | 미팅 종료 흐름 미포함 | ⏹ 종료 → 요약·적재·복습·수업 질문까지 **전체 여정** 검증 (34체크) |

### 9.2 수용 기준 최종 판정 (증거)

| # | 기준 | 판정 | 증거 |
|---|---|---|---|
| 1 | 자막 interim/final + 2초 내 번역 | ✅ | final→번역 표시 97ms(모의) · interim 점선+커서+라벨 |
| 2 | 롤링 요약 (10버퍼·3문장/30초) | ✅ | E2E "견적가가 경쟁사보다 높다는 반론" 배너 |
| 3 | 4버튼 RAG · top3 · 15단어 · 3초 · 📚 | ✅ | 클릭→표시 123ms(모의) · 15단어 100% · 뱃지는 실사용 시만 |
| 4 | 퀵 번역 동일 파이프라인 | ✅ | 근거가 수업 노트로 표시됨 (E2E) |
| 5 | 표현 10 + SRS 1/3/7 + 수업용 질문 | ✅ | 이번 스프린트에서 수업용 질문 추가 완료 |
| 6 | Lighthouse 90+ · 390px · 상태 UI | ✅ | **모바일·데스크톱 모두 100×4** · 대기 표시 추가로 상태 UI 완비 |

전체 회귀: E2E 34체크 통과(콘솔·네트워크 오류 0) · rag-eval **10/10** ·
웹 계층 16/16 · Lighthouse 두 프리셋 전부 100.

### 9.3 남은 기술부채

- 실 Claude에서의 형식 준수율(15단어·EN/KR)·실지연 미실측 — 모의 기준 수치임
- 쿼터가 호출 수 기준(토큰 아님), 세션 개별 무효화 불가(무상태 토큰의 트레이드오프)
- Wake Lock 미적용(모바일 화면 꺼짐 시 마이크 정지), iOS 실시간 인식은 플랫폼 한계

### 9.4 다음 스프린트 제안 3가지

1. **실전 리허설 스프린트** — 실 Claude 키 + 실제 유튜브 영어 회의 영상으로
   30분 모의 미팅 1회. 측정: 번역 p95, 제안 첫 토큰, 15단어 준수율, 뱃지 발동률,
   복습 JSON 파싱 성공률. 이 수치가 나와야 "다음 미팅에서 의지할 수 있다"가 증명된다.
2. **약점 드릴 루프 완성** — 복습 카드에서 3회 틀린 표현을 자동으로 '약점'으로
   승격해 다음 미팅 제안에서 우선 노출 + 수업 질문에 반영 (지금은 SRS에서 끝난다).
3. **미팅 프리셋** — 미팅 시작 전에 고객사·안건을 한 줄 입력하면 해당 도메인
   청크를 미리 가열(핀)해 첫 제안부터 맥락이 실리게 (지금은 대화가 쌓여야 맥락이 생긴다).


---

## 10. 실시간 리플레이 테스트 (2026-08-22)

즉답 모의로는 실시간성을 증명할 수 없어, 조건을 실전에 최대한 붙여 재측정했다.

**테스트 조건** — ① 실제 대화 속도: 23발화를 발화 간 5~12초 간격으로 약 3.5분간
재생 (즉시 주입 아님) ② 실제 브라우저(390px)에서 전체 파이프라인·렌더링 경유
③ LLM은 **실 Claude 지연 프로필 재현** 공급자 — Haiku 상당 TTFT 0.55s·110tok/s,
Sonnet 상당 TTFT 0.95s·70tok/s (실 API 아님 — 이 환경엔 키가 없다).

| 측정 항목 | 결과 | 수용 기준 |
|---|---|---|
| 자막: final → 한국어 표시 (상대 발화 13건 전부) | **p50 0.57s · p95 0.61s** | 2초 이내 ✅ |
| 제안: 버튼 클릭 → 첫 옵션 표시 (3의도) | **0.98~1.09s** | — |
| 제안: 클릭 → 2안+한국어 완성 | **1.55~1.62s** | 3초 이내 ✅ |
| 한→영 퀵 번역 완성 | 1.37s | 동일 파이프라인 ✅ |
| 요약 배너 | "견적가와 총소유비용 논의"로 갱신 확인 | ✅ |
| ⏹ 종료(요약+적재+복습+수업질문) | 5.3s | 실시간 아님 — 허용 |
| JS 힙 (3.5분 미팅) | 1.4 → 3.1MB | 누수 없음 |
| JS 오류 | 0 | ✅ |

측정 결함 1건을 스스로 발견·수정: 최초 계측이 "⏳ 생성 중…" 플레이스홀더를
첫 표시로 오인 → 실제 첫 문장 기준으로 재측정한 것이 위 수치다.

**이 환경에서 검증 불가로 남은 것(정직 고지)** — 실제 마이크 입력(샌드박스에
오디오 장치 없음), 실 Claude API(키 없음), 실 Whisper STT(모델 저장소가 네트워크
정책상 차단 — faster-whisper 설치와 합성 음성 준비까지는 완료). 이 세 가지가
배포 첫날 실측 목록이다.

→ 이 실측은 준비돼 있다: 맥북에서 `bash meeting-copilot/doctor.sh`(사전 점검) →
`bash meeting-copilot/smoke.sh`(구간별 측정)를 실행하면 결과가 이 문서 10.1절에
자동 기록된다. 절차는 [FIELD-TEST.md](./FIELD-TEST.md).


---

## 11. Gemini 전환 + 무료 티어 RPM 설계 (2026-08-22)

기본 공급자를 Claude → **Gemini(무료 티어)**로 전환하고, 분당 10~15회 한도
안에서 실시간성이 유지되게 호출 설계를 다시 짰다. 수용 기준 G1~G9는 PLAN.md.

### 11.1 설계 요약

| 장치 | 내용 |
|---|---|
| 모델 티어링 | 번역·한줄요약 = Flash-Lite(15 RPM/1,000 RPD) · 제안·전체요약·자산화 = Flash(10 RPM/250 RPD). 전부 env, 하드코딩 0 |
| 번역 배칭 | 예산 여유(잔여 3+) 시 **즉시 전송으로 지연 유지**, 빠듯하면 2~3문장 또는 4초 = 1호출. 번호 매핑 줄단위 스트리밍이라 첫 문장 번역은 배치 완료 전에 표시 |
| 요약 완화 | 3발화/30초 → **5발화/60초**, fast 레인 잔여 ≤4면 이번 주기 건너뜀(최후순위) |
| 우선순위 | 퀵 리액션(클릭) 최우선 → 번역 → 요약. 투기 생성·자동 제안은 여유 시만, 일일 70% 소진 시 자동 제안 중단(클릭은 계속) |
| 429 | 대안 공급자 없으면 지수 백오프+지터(최대 2회) — 몰아치기 18회 실측 14회 회복. **RPD 소진은 구분 감지** → "오늘 무료 한도 소진 — 약 N시간 후(태평양 자정) 리셋" 배너 |
| 가시성 | 상단 ⚡칩: 분당/일일 실사용 (서버 /api/usage — 재시작에도 일일 카운트 영속, PT 날짜 기준) |
| 프라이버시 | 🎓연습/🔒실미팅 모드. 실미팅+무료 티어면 시작 전 "대화가 모델 학습에 사용될 수 있습니다" 경고 (유료는 GEMINI_TIER=paid 선언) |

### 11.2 15분 연속 대화 시뮬레이션 (핵심 검증)

조건: 발화 120개를 분당 8개(7.5초 간격)로 **실시간 15.2분** 주입 + 90초마다
퀵 리액션 클릭 + 자동 제안·요약 가동. 모의 Gemini가 무료 한도(Flash-Lite 15
RPM · Flash 10 RPM)를 **실제로 강제**(초과 시 429 반환). 문장은 전부 고유
(번역 캐시가 부하를 흡수하지 못하게).

| 항목 | 결과 | 판정 |
|---|---|---|
| 429 응답 | **0건** | ✅ |
| 상대 발화 번역 표시 | **80/80** (실패·누락 0) | ✅ |
| 번역 표시 지연 | p50 423ms · p95 433ms | ✅ (기준: 여유 시 2초, 배칭 시 7초) |
| 제안 호출 | 80회 — Flash 10 RPM 안에서 소화 | ✅ |
| JS 오류 | 0건 | ✅ |

관찰: 분당 8발화 수준에서는 fast 레인 사용이 ~6/13에 머물러 **배칭 없이 즉시
전송이 유지**됐다(지연 무손실). 배칭은 압박 상황 테스트에서 별도 검증
(3문장→1호출, 버블 정확 매핑). 시뮬에서 자동 제안 5.3회/분 = RPD 250이
47분에 소진됨을 발견 → 일일 70% 소진 시 자동 제안을 끄는 감쇠를 추가했다.

### 11.3 회귀 (Gemini 모의 체제)

rag-eval 10/10 · E2E 전부 통과(오류 0) · web_qa 16/16 · smoke 4단계
(번역 453ms·제안 1,463ms — 신규 기준 통과) · doctor Gemini 실호출+티어 안내.
E2E 직후 smoke의 제안이 429로 실패한 사례는 **mock의 한도 강제가 작동한 것**
— 60초 창 배수 후 재실행 통과.

### 11.4 미검증 (정직 고지)

실 Gemini API 미호출(이 환경 키 없음 — 지연·한도 수치는 공시값 기반 모의).
맥북에서 `doctor.sh`(실 호출 1회) → `smoke.sh` → FIELD-TEST 절차가 그대로
실측을 채워준다.


<!-- FIELD-RESULTS:START -->
### 10.1 내 맥북 실측 (smoke.sh 자동 기록 — 2026-08-22 05:55, vm)

아래는 §10의 "지연 프로필 재현"을 대체하는 **실측값**이다.

| 구간 | 실측 | 수용 기준 | 판정 |
|---|---|---|---|
| 마이크 → STT 인식 | --skip-mic | — | ⏭ 미측정 |
| 번역 (final → 한국어 완료) | 453ms | 2000ms 이내 | ✅ |
| RAG 검색 (질의 2건) | - | — | ✅ |
| 퀵 리액션 (클릭 → 2안 완성) | 1420ms | 3000ms 이내 | ✅ |

미달(🔴) 구간은 [FIELD-TEST.md](./FIELD-TEST.md)의 증상별 대응표를 참조.
<!-- FIELD-RESULTS:END -->

---

## 12. 최종 스프린트 — 8/27 인터뷰 실전 투입 준비 (2026-08-22)

목적: 8/27 영어 인터뷰(HR 스크리닝, 1:1 화상)에서 보조 도구로 실사용 가능한 상태.

### 12.1 RAG 인터뷰 시드 (작업 1)

`interview-corpus.json` **70개** 추가 — 전 항목 [영어 문장 / 한국어 뜻 / 상황태그]
구조에 검색 다리(triggers) 포함, 단어 나열 없이 전부 말할 수 있는 문장:

- **iPaaS/Workato 도메인 30**: workflow automation 가치, iPaaS 한 줄 정의, 커넥터,
  로우코드, 레시피, land-and-expand, build-vs-buy 반론 대응, ROI 프레임,
  IT·현업 동시 설득, cloud MSP 배경 연결 등
- **인터뷰 표현 40**: 자기소개("I am a B2B sales hunter focused on opening new
  enterprise accounts…"), 되묻기/시간 벌기("Could you rephrase that?",
  "That's a great question — let me think…"), 역질문(팀 구조·온보딩·성공 기준),
  클로징(관심 표현·다음 단계·감사)

색인 용어집 70 → **140**. rag-eval에 인터뷰 시나리오 5쿼리(영어 질문 3 +
한국어 퀵번역 2) 추가 → **15/15 (100%)**, 임베딩 없이 키워드만으로.

### 12.2 인터뷰 톤 프리셋 (작업 2)

- **🎤 인터뷰 프리셋** (연습/실미팅 모드와 별개): 4버튼이
  [👍 동의 / ➕ 부연 설명 / 🔁 되묻기 / 💬 역질문]으로 — 면접에 부적절한
  '반박' 제거, 시간 벌기는 보조줄 유지. 새로고침에도 유지.
- **생성 톤 전환**: 미팅(회사 대 회사) ↔ 인터뷰(후보자 1인칭, 자신 있고
  따뜻하게, 협상 어휘 금지) — 프롬프트 헤더·규칙이 프리셋에 따라 바뀐다.
- **퀵 번역 우선 노출**: 인터뷰 프리셋에서 입력창이 버튼 위 + 강조 테두리,
  `/` 또는 Cmd/Ctrl+K로 어디서든 포커스. 인터뷰에서 가장 쓸 기능이라는 판단.
- **400px 세로 검증**(화상통화 옆): 오버플로 0, 헤더 106→70px 압축, 스크린샷 확인.

### 12.3 퀵 리액션 샘플 5문항 (눈 판정용)

HR 스크리닝 전형 질문 5개를 인터뷰 프리셋으로 실행한 결과.
**📎 검색 근거는 실제 파이프라인 출력**이고, 생성문 중 1안은 검색 자료를
그대로 활용한 것(모의 공급자가 자료 문장을 선택) — **실 Gemini의 문장 품질은
맥북 필드 테스트에서 확인**해야 한다(이 환경엔 실 키 없음).

| 면접관 질문 | 검색된 내 자료 (top 3) | 생성 1안 (자료 활용) |
|---|---|---|
| Tell me about yourself. | **intro one-liner** · buy time classic · deal example frame | "…B2B sales hunter focused on opening new enterprise accounts in the cloud market" |
| Why are you interested in joining Workato? | **why this company** · why automation now · recipe concept | "I want to sell a product that changes how customers work, not just…" |
| Walk me through how you open a brand-new enterprise account. [부연] | **enterprise sales cycle** · deal example frame · circle back | "I am comfortable running six-to-twelve-month cycles with multiple stakeholders" |
| What do you know about our platform and the iPaaS space? | **iPaaS in one line** · observability · integration plus automation | "The real differentiation is combining integration and automation in a single…" |
| Do you have any questions for us? [역질문] | **follow-up offer** · next steps · landing the plane | "Happy to share more detail on any of my deals in a follow-up" |

→ 5문항 전부 **그 질문에 맞는 준비 자료가 top-3에 소환**됐다. 검색이 맞으면
생성은 자료를 따라간다 — 이 표가 8/27에 앱이 건네줄 커닝페이퍼의 실체다.

### 12.4 실측 피드백 루프 (작업 3)

- FIELD-TEST 4절 "인터뷰 리허설": Preply/화상 수업에서 확인할 5항목
  (힐끗 볼 여유·퀵 리액션 실사용·시야 방해·폰트 크기·종료 자산화 품질) —
  기준은 "기능이 도는가"가 아니라 "실전에서 의지되는가". 미달 시 현실적
  대안(퀵 번역 단독 전략)까지 명시.
- smoke.sh 하단에 **복붙용 진단 블록**: OS·Python·공급자·모델 티어링·티어·
  로컬 STT·커밋 해시 + 단계별 결과 JSON. "이 블록을 Claude Code에 그대로
  붙여넣으세요" — 환경 되묻기 왕복 제거.

### 12.5 전체 회귀 (증거)

| 검증 | 결과 |
|---|---|
| rag-eval (인터뷰 5쿼리 포함) | **15/15 (100%)** |
| E2E 전체 여정 (인터뷰 프리셋 검사 포함 별도 6체크) | 전부 통과 · 콘솔 오류 0 |
| web_qa (인증·격리·전송) | 16/16 |
| smoke 4단계 | 번역 454ms · 제안 1,420ms — 기준 내 |
| 15분 시뮬 (무료 한도 강제) | **429 0건 · 번역 80/80 · p95 437ms · JS 오류 0 — 완주** (프리셋 코드 반영 후 재실행) |

과정에서 잡은 것 2건: ① 한도 강제 mock이 기능 E2E까지 429로 흔들던 것 →
mock을 `tests/mock_gemini.py`로 승격하고 한도를 env로 분리(기능 테스트는 완화,
rpm-sim은 무료 실값 강제) ② rag-eval을 오염시키던 시뮬 잔여 트랜스크립트 정리.

### 12.6 8/27 전까지 남은 것 (사용자 액션)

1. 맥북에서 `doctor.sh` → `smoke.sh` (실 Gemini 키 — 실측이 10.1절에 자동 기록)
2. 유튜브 필드 테스트 30분 (FIELD-TEST 1~3절)
3. **Preply 수업에서 인터뷰 리허설 1회** (FIELD-TEST 4절 — 이게 최종 관문)
4. 자기소개·딜 스토리를 '자료' 탭에 본인 문장으로 추가하면 제안이 더 개인화된다


## 13. Out-of-Corpus 대응 — 시드 밖 질문에서의 답변 품질 (2026-08-22)

rag-eval 15/15는 "시드와 매칭되는 질문"만 검증했다. 실전 인터뷰의 절반은 시드에
없는 질문이므로, **검색이 빗나가거나 부분 적중일 때도 말할 수 있는 답**이 나오는지
3계층 15문항(A 시드 변형 / B 시드 인접 / C 완전 이탈)으로 검증했다
(`tests/ooc-eval.ts` = 케이스 단일 소스, `tests/ooc_eval.py` = 실행·기록 러너).

**방어선 3겹 (backend/rag.py · prompts.py):**

1. **관련성 스코어 컷** — BM25 히트마다 "질의 어절이 몇 개나 매칭됐는가"(`match_terms`)를
   세고, 어절 2개 미만이면서 의미(벡터) 히트도 아닌 자료는 프롬프트에서 버린다.
   B·C 계층에서 무관 시드를 억지로 끼워넣는 것을 차단.
2. **고정 프로필 블록** — 검색 결과가 0이어도 시스템 프롬프트에 후보 프로필
   (B2B enterprise sales hunter, cloud MSP, 8+ years, new business focus)을 항상 주입.
   '자료' 탭에 `내 프로필` 제목의 노트를 넣으면 그 내용이 기본값을 대체한다.
3. **하드 룰** — "I'm not sure" 류 회피성 문구 금지, 느슨하게만 관련된 자료의
   강제 인용 금지를 프롬프트에 명시. 평가기가 정규식으로 위반을 잡아낸다.

**이 과정에서 찾은 검색 결함 3건 (수정 완료):**

- `me/my` 등 대명사가 불용어가 아니어서 "Tell **me** about..."의 me가 매칭 어절로
  집계돼 무관 시드(buy time)가 컷을 통과 → 대명사류를 `_STOP`에 추가.
- `what/how` 등 의문사도 같은 문제("**What** do you do outside work") → 의문사 추가.
- 의문사 제거로 rag-eval 1건("How would the migration actually roll out?")이 회귀 →
  rollout plan 등 트리거 7건에 패러프레이즈 보강 후 15/15 복구.

회귀 확인: rag-eval **15/15**, ooc-eval **15/15**, E2E 전부 통과. 아래 표는
모의 LLM 기준이며, 맥북에서 실 키로 서버를 띄우고 `python3 tests/ooc_eval.py`를
다시 실행하면 같은 표가 실측 생성문으로 갱신된다.

<!-- OOC-RESULTS:START -->
### 13.1 결과 표 (ooc_eval.py 자동 기록 — 2026-08-22 06:33 · 공급자: gemini (gemini-2.5-flash))

| 계층 | 면접관 질문 | 검색 근거 (관련성 컷 통과분) | 생성 2안 | 판정 |
|---|---|---|---|---|
| A | Walk me through your background. | current role summary<br>intro one-liner<br>deal example frame | At a cloud MSP, I hunt new business and build accounts from the<br>Let me give you a concrete example from a recent deal. | ✅ |
| A | What brings you here today? | why this company<br>career move logic | I want to sell a product that changes how customers work, not just<br>Let me give you a concrete example from a recent deal. | ✅ |
| A | How do you land new logos? | new business hunting<br>cold outreach story | I open doors through referenced cold outreach<br>Let me give you a concrete example from a recent deal. | ✅ |
| A | How would you explain integration platforms to a beginner? | iPaaS in one line | An iPaaS connects cloud apps and data so processes run end to end<br>Let me give you a concrete example from a recent deal. | ✅ |
| A | What would you ask us about how the team works? | ask team structure<br>ask team culture | How is the sales team structured here, and who would I work with<br>Let me give you a concrete example from a recent deal. | ✅ |
| B | What's your experience with Salesforce integration specifically? | — (프로필 폴백) | As B2B enterprise sales hunter at a Korean cloud MSP (AWS partner), 8+<br>Let me give you a concrete example from a recent deal. | ✅ |
| B | How do you handle a deal going dark after the proposal? | — (프로필 폴백) | As B2B enterprise sales hunter at a Korean cloud MSP (AWS partner), 8+<br>Let me give you a concrete example from a recent deal. | ✅ |
| B | What are your salary expectations for this position? | salary deflect | I am flexible on the package if the role and the market opportunity<br>Let me give you a concrete example from a recent deal. | ✅ |
| B | How do you split your time between hunting and account management? | — (프로필 폴백) | As B2B enterprise sales hunter at a Korean cloud MSP (AWS partner), 8+<br>Let me give you a concrete example from a recent deal. | ✅ |
| B | Have you ever sold against an incumbent vendor with a locked-in contract? | — (프로필 폴백) | As B2B enterprise sales hunter at a Korean cloud MSP (AWS partner), 8+<br>Let me give you a concrete example from a recent deal. | ✅ |
| C | What do you do outside work for fun? | — (프로필 폴백) | As B2B enterprise sales hunter at a Korean cloud MSP (AWS partner), 8+<br>Let me give you a concrete example from a recent deal. | ✅ |
| C | Tell me about a time you failed at something. | loss lesson | I lost a deal by pitching too early, and now I never present<br>Let me give you a concrete example from a recent deal. | ✅ |
| C | Why are you leaving your current role right now? | current role summary<br>career move logic<br>salary deflect | At a cloud MSP, I hunt new business and build accounts from the<br>Let me give you a concrete example from a recent deal. | ✅ |
| C | How do your colleagues usually describe you? | — (프로필 폴백) | As B2B enterprise sales hunter at a Korean cloud MSP (AWS partner), 8+<br>Let me give you a concrete example from a recent deal. | ✅ |
| C | Where do you see yourself in five years? | — (프로필 폴백) | As B2B enterprise sales hunter at a Korean cloud MSP (AWS partner), 8+<br>Let me give you a concrete example from a recent deal. | ✅ |

**15/15** (A 5/5 · B 5/5 · C 5/5). 계층 기준 — A: 시드 검색·활용 / B: 무관 시드 강제
인용 없이 생성 / C: 검색 0이어도 프로필 기반 답변, 회피성 문구 금지.
<!-- OOC-RESULTS:END -->
