# 학습 온톨로지 — 콘텐츠를 지식 그래프로 (v1.22.0)

> "온톨로지 기반의 DB 형태로 회차별 / 상황별 / 실전형 등 연속성 있게 학습할 수 있게 구조화"

## 문제 — 콘텐츠는 많은데 서로를 모른다

| 모듈 | 모양 | 진행 키 |
|---|---|---|
| realCourse.json | Track › Scenario(dialogue, expressions, grounding) | va_course_seen |
| careerPack.json | 위와 동일 | va_career_seen |
| dailyMission.ts | Mission(phrases, dialogue, talkPrompt) | va_mission_done · va_mission_progress |
| salesScenarios.ts | Scenario(steps › lines, checklist) | (없음) |
| maturity.ts + patternStories.ts | Pattern(key, en, ex) + Story | va_maturity_patterns · va_pattern_srs |
| immersion.ts | Episode(sentences, quiz) | va_immersion_read |
| workatoPrep.ts / interview.ts | Question(q, guide.sample) | va_interview_history |
| lessons.json | Lesson(examples, dialogue) ×3 종 | va_stats · va_hw_done |

여덟 모듈, 여섯 가지 모양, 여덟 개의 진행 키. **"비용 리뷰 미팅"을 코스에서 연습한
사실을 미션도, 세션도, 면접도 알 수 없었다.** 화면마다 처음부터 다시 시작했고,
학습은 이어지지 않았다.

## 해법 — 콘텐츠를 다시 쓰지 않고 공통 어휘를 얹는다

```
Situation(상황, 2단)  ←covers──  Unit(회차)  ──in(order)──►  Track(트랙)
        ▲                          │ contains
        │ situations               ▼
   Expression(표현)  ──uses──►  Pattern(패턴)  ──serves──►  Function(기능)
                                   │ level
                                   ▼
                                Level(CEFR)
```

| 노드 | 수 | 출처 |
|---|---|---|
| Situation | 11 최상위 / 45 하위 | `schema.ts` 분류표(수작업) |
| Function | 15 | `schema.ts` |
| Pattern | 40 | maturity.STAGE_PATTERNS (5단계 × 8) |
| Expression | 869 (레슨 제외) | 모든 유닛의 문장 — **같은 문장은 한 노드** |
| Unit | 105 (+ 레슨 62) | 8개 어댑터 |
| Track | 18 (+ 레슨 8) | 코스 6·커리어 3·단계 5·미션·스크립트·시리즈·면접 |

### 원칙

1. **콘텐츠 무수정.** 어댑터(`graph.ts`)가 원본 모듈을 읽어 노드를 만든다. AI가 코스
   시나리오를 추가하거나 새 에피소드가 생기면 다음 빌드에 자동으로 들어온다.
2. **패턴은 자동 감지.** "I'd like to ..." 같은 템플릿을 정규식으로 바꿔 869개 문장에서
   찾는다(`patternDetect.ts`). 세션에서 배운 패턴이 실제로 어느 상황에 쓰이는지가
   그래프에 남는다. 오탐이 있는 패턴(kind of의 명사 용법, go over의 경유 의미)은
   손으로 좁혔다.
3. **학습자 상태도 새로 만들지 않는다.** 이미 쌓이는 신호(va_weak SRS 상자, 발화 점수,
   열람 키, 정착 패턴)를 노드에 투영한다(`mastery.ts`). 그래서 **미션에서 정착시킨
   표현이 같은 문장을 쓰는 코스 유닛의 점수에도 반영된다** — 화면을 넘어 이어진다.

## 세 가지 연속성 (`planner.ts`)

| 축 | 규칙 | 예 |
|---|---|---|
| **회차별** | 시작한 트랙의 다음 회차 (`continueTrack`) | 비용 리뷰 1/3 → 2/3 |
| **상황별** | 만진 상황의 다른 출처 유닛 | 미션 "미팅 오프닝" → 스크립트 "고객 미팅 오프닝" |
| **실전형** | grounding(실제 메일·경력·JD) 있는 유닛 우선 (2·3단계) | 여기어때 SBR 회의록 기반 시나리오 |

추천 순위: 회차 연속(100) › 상황 연속(70+) › 약점 보강(60+) › 새 상황(40).
실전형 +15, 주차의 실전 화면 +25, 선수 미완 −30. 한 트랙이 상위를 독점하지 않게
트랙당 최대 2.

## 어디에 쓰이나

- **12주 프로그램의 실전 블록** — 이전엔 "쉐도잉 화면"만 열었다. 이제 플래너가 고른
  구체 유닛(예: `실전 · 월간 비용 리뷰 브리핑 — 비용 리뷰 & FinOps 1/3 — 이어서`)을
  띄우고, 누르면 그 화면의 그 항목이 바로 펼쳐진다.
- **학습 지도 화면** (더보기 › 학습 지도) — 상황별 숙련도 / 회차별 트랙 진행 /
  실전형 목록 + 추천 3.
- **핸드오프** (`handoff.ts`) — `setUnitHandoff(ref)` → 화면이 마운트 시 `takeUnitHandoff(source)`로
  꺼내 해당 항목을 연다. 코스·커리어·스크립트·스토리·면접·세션·미션 7개 화면이 소비한다.

## 파일

```
lib/ontology/
  schema.ts         노드 타입, 상황 분류표(11/45), 기능 15, 패턴→기능
  patternDetect.ts  템플릿→정규식, 오탐 오버라이드
  graph.ts          8개 어댑터 + 빌더 + 캐시(getGraph)
  mastery.ts        학습자 상태 투영(표현·유닛·패턴·상황)
  planner.ts        recommend / continueTrack / nextAfter
  handoff.ts        화면 간 유닛 전달
  index.ts
```

## 테스트

- `tests/unit/ontology.test.ts` (vitest) — 그래프 무결성(id 유일·상황 존재·트랙 순서·선수),
  패턴 감지(40개 자기 예문 전부, 오탐 2건), 학습자 투영(열람→상황 점수, SRS→공유 표현),
  플래너 3축 연속성, 핸드오프.
- `tests/e2e/72-knowledge-map.mjs` — 지도 3탭, 코스 시나리오 핸드오프, 열람 후 추천이
  "이어서"로 바뀌는 흐름.

## 다음 단계(제안)

- 표현 SRS(va_weak)를 Expression id 기준으로 옮겨 문자열 정규화 의존 제거
- 스크립트 열람 기록 추가(현재 표현 점수로만 반영)
- 회화(TalkScreen) 대화 로그에서 사용된 표현·패턴을 감지해 "실제 사용" 증거로 투영
