# 코드 리뷰 — 전수 진단 (2026-09-24, v1.22.0 기준)

범위: `next-app/` 전체 — lib 51개(≈12k줄), components 78개(≈14k줄), API 라우트 9개,
e2e 72파일. 도구: tsc(strict), grep 기반 정적 스캔, 데이터 모듈 구조 분석, 런타임 재현.

## 요약

| 등급 | 항목 | 상태 |
|---|---|---|
| **P0** | F1 · 날짜 키가 UTC/로컬 두 체계로 분열 — 아침 시간대 발화 카운터·스트릭 오류 | **수정됨** (`lib/dates.ts`) |
| **P0** | F2 · 콘텐츠 14개 모듈이 서로를 모름 — 학습 연속성 부재 | **수정됨** (`lib/ontology/`) |
| P1 | F3 · lib 순수 로직에 단위 테스트 없음(e2e만 72개) | **수정됨** (vitest 도입, 31건) |
| P1 | F4 · API 라우트가 무인증 — 서버 키를 익명 호출자가 소진 가능 | 권고 (아래) |
| P1 | F5 · 신(god) 컴포넌트 3개(TalkScreen 1,250줄·InterviewScreen 840·HomeworkScreen 572) | 권고 |
| P2 | F6 · localStorage 71키에 스키마 버전/마이그레이션 없음 | 권고 |
| P2 | F7 · rate limiter가 인스턴스 메모리 기반(서버리스에서 무력) | 권고(코드 주석에 이미 인지) |
| P2 | F8 · JSON 데이터 `as unknown as` 캐스팅 5곳 | 권고 |

잘 된 것(유지할 것): TypeScript strict + `any` 0건 · 화면 레지스트리(`SCREENS: Record<Mode,…>`)로
누락을 컴파일 에러로 잡는 구조 · 화면별 dynamic import(홈 첫 페인트 보호) · `load()`의
손상 데이터 방어 · 모델 폴백 체인 · aiGuard 한국어 검증 · 저장 용량 초과 시 EVICTABLE 정리 ·
에러 바운더리 · e2e 72파일이 실제 사용자 흐름을 덮음.

---

## F1 · 날짜 키 분열 (P0, 수정됨)

**증상 재현.** 같은 뜻의 "오늘" 헬퍼가 9곳에 따로 있었다.

| 파일 | 방식 |
|---|---|
| lib/state.ts `todayKey` | `toISOString().slice(0,10)` — **UTC** |
| lib/program.ts `todayKey` | UTC |
| lib/state.ts `calcStreak`, `weeklyCounts`, `addPronLapses` 내부 | UTC |
| components 5곳(Pitch·Session·WeeklyTest·TrainingDashboard·tutorMemory·maturity) | UTC |
| dailyMission·streak·habits·meetingPrep·reminders·session·missionProgress | **로컬** |

한국(UTC+9)에서 00:00–09:00 사이에 두 "오늘"이 다르다. 결과:
- 아침 7시에 말한 문장은 `va_spoken`(UTC)에 어제 날짜로 쌓였다가 **9시에 0으로 리셋**돼 보인다.
- `va_days`(학습일, UTC)와 미션·세션 완료(로컬)가 어긋나 **스트릭이 하루 늦게 켜지거나 끊긴다**.
- `spokenHistory()`는 로컬 키로 조회하고 `bumpSpoken()`은 UTC 키로 기록 → **주간 차트가 하루 밀린다**.

**수정.** `lib/dates.ts` 단일 정의(`todayKey`/`dateKey`/`daysBetween`/`shiftKey`/`daySeed`, 로컬 기준).
9개 헬퍼와 컴포넌트 UTC 사용처 전부 교체. 저장 형식(YYYY-MM-DD)은 동일해 기존 데이터와
호환되며, 경계 시각의 귀속만 바뀐다. 단위 테스트 `tests/unit/dates.test.ts`.

## F2 · 콘텐츠 사일로 (P0, 수정됨)

8개 콘텐츠 모듈이 6가지 다른 모양과 8개의 진행 키를 갖고 서로를 몰랐다. "비용 리뷰"를
코스에서 연습해도 같은 상황의 미션·스크립트·패턴은 그 사실을 모르고, 12주 프로그램의
실전 블록은 "쉐도잉 화면"이라는 **화면 이름**만 가리켰다.

**수정.** `lib/ontology/` — Situation/Function/Pattern/Expression/Unit/Track/Level 노드와
관계. 콘텐츠는 손대지 않고 어댑터가 읽는다. 학습자 상태는 기존 신호를 투영한다.
플래너가 회차·상황·실전형 세 축의 연속성을 계산해 프로그램과 학습 지도에 공급한다.
상세: `docs/ONTOLOGY.md`.

부수 발견: 세일즈 스크립트에는 열람 기록이 전혀 없었고, 미션은 "오늘 완료" 플래그만 있어
**어떤 미션을 완주했는지 영구 기록이 없었다** → `va_mission_done_keys` 추가.

## F3 · 단위 테스트 부재 (P1, 수정됨)

e2e 72파일은 훌륭하지만 느리고(전체 ~12분), `deliveryMetrics`·SRS 간격·프로그램 진도
같은 순수 로직의 회귀는 e2e가 놓치기 쉽다(실제로 F1은 e2e가 UTC 컨테이너에서 돌아
잡지 못했다). vitest 도입(`npm run test:unit`, 1초), 메모리 localStorage 셋업.
현재 31건(dates 5 · ontology 23 · program 3). **권고:** `deliveryMetrics`, `srsDue/gradeWeakItem`,
`pickTodayPattern` 로테이션, `calcStreak`에 단위 테스트 추가.

## F4 · API 무인증 (P1, 권고)

`/api/groq`·`/api/tts`·`/api/stt`는 인증 없이 호출 가능하고, 서버 `GROQ_API_KEY`가 있으면
익명 호출자가 그 키로 요청할 수 있다(코드 주석이 이미 Vercel Deployment Protection을
권장). 현재 방어는 IP당 30/min 제한(F7 참조)과 입력 크기 상한뿐이다.

**권고(작은 변경).** 환경변수 `APP_ACCESS_TOKEN`이 설정돼 있으면 `x-app-token` 헤더를
요구하고, 클라이언트는 AI 키 등록 화면에서 같은 토큰을 한 번 저장해 보낸다. 개인용
배포에서 20줄로 익명 소진을 막는다. 상용화 시엔 로그인 + 사용자 단위 메터링.

## F5 · 신 컴포넌트 (P1, 권고)

| 컴포넌트 | 줄 | 책임 |
|---|---|---|
| TalkScreen | 1,250 | 회화 UI + 음성 루프 + 이중언어 규칙 + 돌발 모드 + 로그 저장 |
| InterviewScreen | 840 | 설정·진행·리포트 3단계 + 실전 모드 오디오 루프 + 오프닝 |
| HomeworkScreen | 572 | — |

동작은 문제없지만 변경 비용이 높다(이번 세션에서도 InterviewScreen 편집마다 ref 동기화를
손으로 맞췄다). **권고:** 음성 루프(`recordAndTranscribe` + TTS onend 체인)를
`useLiveTurn()` 훅으로 추출해 Talk/Interview가 공유; Interview는 Setup/Running/Report 세
컴포넌트로 분리. 기능 변경 없이 순수 이동만.

## F6 · 저장 스키마 버전 없음 (P2, 권고)

`va_*` 키 71개. `load()`가 모양 불일치를 방어하지만, 필드 의미가 바뀌는 변경(예: F1의
날짜 귀속)은 감지·이관되지 않는다. **권고:** `va_schema` 정수 하나와 `migrations[]`를
`backup.ts` 옆에 두고 앱 시작 시 순차 실행. 백업 파일에도 버전을 넣어 복원 시 이관.

## F7 · 인스턴스 메모리 rate limiter (P2)

`lib/rateLimit.ts`는 Map 기반이라 Vercel 서버리스에서 인스턴스마다 따로 센다. 코드 주석이
한계를 정확히 적고 있어(Upstash로 교체 예정) 추가 지적은 없다. F4와 함께 처리.

## F8 · JSON 캐스팅 (P2)

`realCourse.ts`/`careerPack.ts`가 `pack as unknown as { tracks: … }`로 타입을 우회한다.
`resolveJsonModule`이 켜져 있으니 JSON에 맞는 타입을 `satisfies`로 선언하거나 zod로
런타임 검증하면 데이터 편집 실수가 빌드에서 잡힌다.

---

## 데이터 모듈 품질 메모

- `salesScenarios.ts`(1,143줄)와 `domainVocab.ts`(1,192줄)는 사실상 데이터인데 `.ts`에
  있다 → `data/*.json`으로 옮기면 lessons.json처럼 지연 청크가 되어 초기 번들이 준다.
- `dailyMission.ts`(786줄)는 데이터 24개 + 로직이 섞여 있다. 데이터를 분리하면 온톨로지
  어댑터도 JSON을 직접 읽는다.

## 테스트 인프라 메모

- e2e는 헤드리스에도 `getUserMedia`가 있어 `whisperAvailable()`이 true → 텍스트 플로우
  테스트는 `연습 모드` 클릭이 필요하다(이미 반영). helpers의 `launch()`가 newPage를 패치해
  온보딩을 시드하므로 커스텀 컨텍스트는 우회된다(62번에서 확인).
- e2e 실행 시간 ~12분. 단위 테스트가 순수 로직을 맡으면 e2e는 흐름 검증에 집중할 수 있다.
