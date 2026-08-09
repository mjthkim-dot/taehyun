# 프렌즈 잉글리시 — Friends English

미드 **프렌즈(Friends)** 의 명장면 속 실생활 영어를 "회차(에피소드) → 장면(상황) →
표현/대화" 구조로 배우는 학습 앱. `next-app/`(Preply English Coach)과는 독립된
신규 프로젝트로, 서버 없이 완전 정적으로 동작한다.

## 무엇을 배우나

| 수록 | 규모 |
|---|---|
| 에피소드 | 11편 (S01E01 파일럿 ~ S10E18 마지막 회) |
| 장면(상황) | 22개 — 첫 만남·스몰토크·다툼과 사과·내기·프러포즈·반품/환불·작별 등 |
| 실생활 표현 | 67개 — "How you doin'?", "We were on a break!", "Pivot!"부터 실전 관용구까지 |

각 장면은 **상황 브리핑 → 표현 카드(뜻·뉘앙스·예문) → 오리지널 연습 대화**로
구성된다. 저작권 보호를 위해 원작 대본은 수록하지 않으며, 연습 대화는 장면에서
유래한 표현을 익히도록 새로 쓴 창작 대화다(짧은 관용 표현과 등장인물 이름만
원작에서 왔다).

## 기능

- **에피소드 학습** — 장면별 상황 브리핑 + 표현 카드 + 대화 읽기
- **듣기(TTS)** — 문장별/전체 재생, 0.75배속 천천히 듣기 (Web Speech API)
- **롤플레이(STT)** — 배역을 골라 내 대사를 말하면 단어 매칭 채점 + 놓친 단어 피드백 (Chrome/Edge)
- **퀴즈** — 뜻 맞추기 / 상황에 맞는 표현 고르기, 회차별·전체 랜덤 8문항
- **복습** — Leitner 3-box SRS 플래시카드 (틀리면 1일, 맞히면 3일 → 7일 간격)
- **진도** — 스트릭, 장면 완료율, 회차별 진행, 퀴즈 정답률 (전부 localStorage, 서버 전송 없음)

## 기술 스택

- Next.js 14 (App Router) + TypeScript strict — `output: 'export'` 완전 정적 빌드
- 런타임 의존성은 react/react-dom/next 뿐. 음성은 브라우저 내장 Web Speech API
- Pretendard 가변 폰트 자체 호스팅, 인라인 SVG 아이콘 (외부 요청 0)

## 실행

```bash
cd friends-app
npm install
npm run dev          # http://localhost:3200

npm run build        # 정적 사이트 → out/
npx serve out        # 프로덕션 확인
```

## 품질 파이프라인

```bash
npx tsc --noEmit     # 타입 체크
npm run validate     # 커리큘럼 데이터 무결성 (id 규칙·필수 필드·대화-표현 연결)
npm run build        # 프로덕션 빌드
npm run test:e2e     # Playwright 스모크 11종 (홈→레슨→퀴즈→복습→진도 여정)
```

CI(`.github/workflows/ci.yml`)가 위 파이프라인 전체를 `friends-app` 잡으로 실행한다.
로컬에 Playwright 브라우저가 따로 있다면 `PLAYWRIGHT_CHROMIUM_PATH=<경로>`로
지정할 수 있다.

## 배포

이 저장소의 Vercel 배포(루트 정적 사이트)에 `/friends/` 경로로 함께 실린다.
저장소 루트의 `friends/` 디렉터리가 그 정적 산출물이며, 앱을 수정한 뒤에는

```bash
npm run build:vercel   # BASE_PATH=/friends 빌드 → ../friends 갱신
```

로 재생성해 함께 커밋한다. GitHub Pages(`gh-pages` 브랜치, `/taehyun` 하위 경로)
배포도 `.github/workflows/deploy-pages.yml`이 자동으로 수행한다.

## 구조

```
friends-app/
├── data/
│   ├── episodes/         # 에피소드별 데이터 (1파일 1회차 — 여기만 추가하면 확장)
│   └── curriculum.ts     # 집계·헬퍼 (평탄화, 시즌 그룹, 오늘의 표현)
├── lib/
│   ├── types.ts          # 데이터 모델 (Episode > Scene > Expression/Dialogue)
│   ├── speech.ts         # TTS/STT 래퍼 (미지원 브라우저 안내 포함)
│   ├── scoring.ts        # 발화 채점 (축약형 정규화 + 단어 매칭)
│   ├── progress.ts       # localStorage 진도 스토어 + Leitner SRS + 스트릭
│   ├── quiz.ts           # 퀴즈 생성기 (시드 고정 가능한 PRNG)
│   └── characters.ts     # 캐릭터 메타 (이름·아바타 색)
├── components/           # 화면 (홈/에피소드/레슨/퀴즈/복습/진도) + 공용 UI
├── scripts/
│   ├── validate-data.mjs # 데이터 무결성 검증 (CI 게이트)
│   └── gen-icons.mjs     # 의존성 없는 PNG 아이콘 생성기
└── tests/e2e/run.mjs     # 정적 서버 + Playwright 스모크 러너
```

## 콘텐츠 추가 방법

1. `data/episodes/sXXeYY.ts` 파일을 기존 형식대로 작성 (장면 1개 이상, 장면당 표현 3개 이상, 대화 4~10라인)
2. `data/curriculum.ts`의 import/EPISODES 배열에 추가
3. `npm run validate`로 id 규칙·대화-표현 연결 검증 → 통과하면 앱 전체(목록·퀴즈·복습·진도)에 자동 반영
