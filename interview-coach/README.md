# 🎤 영어 면접 코파일럿 — IT 영업 직군

Smooth AI를 벤치마킹한 **실시간 영어 면접 비서** (완전 독립 프로젝트).
핵심은 두 가지: **실시간 음성 번역**(영어 발화 → 한국어 자막)과
**실시간 답변 추천**(질문 감지 → 바로 읽을 수 있는 영어 답변 + 한국어 번역).
백엔드는 **Groq 하나로 통일** — LLM(llama-3.3-70b)과 STT(whisper-large-v3-turbo)
모두 Groq라 답변까지 1~2초.

## 실행

```bash
export GROQ_API_KEY=gsk_...   # 필수 — https://console.groq.com 에서 발급
bash start.sh
# → http://localhost:3778/live.html       (🔴 실전 화상 면접 코파일럿)
# → http://localhost:3778/interview.html  (연습 모드)
```

의존성 0 — stdlib만 사용하는 단일 파일 Python 서버라 `pip install`이 필요 없다.
반드시 **Chrome**에서 열 것 (탭 오디오 캡처 사용).

## 🔴 라이브 모드 — 화자 자동 분리 구조

Smooth AI처럼 오디오 소스를 둘로 받아 화자를 자동 분리한다:

```
▶ 시작
 ├─ 화상회의가 열린 'Chrome 탭' 선택 + '오디오도 공유' 체크
 │    └─ 탭 오디오 스트림 = 상대(면접관) 목소리
 └─ 마이크 권한 허용
      └─ 마이크 스트림 = 나(지원자) 목소리

각 스트림 → VAD(0.8초 침묵 시 문장 단위 컷) → /api/stt → Groq Whisper
 → 상대 발화: 자막 + 한국어 번역 + 질문 감지 시 답변 카드 자동 생성
 → 내 발화:   갈색 버블로 기록 (요약·맥락에 사용)
```

- **이어폰 사용 가능** — 상대 음성을 스피커가 아니라 탭 오디오로 직접 캡처하므로.
- macOS에서 Zoom은 **웹 클라이언트**로 접속해야 탭 오디오가 잡힌다
  (Google Meet/Teams는 원래 브라우저라 그대로 동작).

### 화면 구성 (Smooth AI 벤치마킹)

| 요소 | 동작 |
|---|---|
| 상단 탭 `라이브 · 요약 · 번역` | 요약 = 전체 세션 한국어 정리, 번역 = 독립 KR↔EN 번역기 |
| `● 실시간 요약` 바 | 3발화마다 대화 핵심을 한국어 한 줄로 자동 갱신 |
| 채팅 버블 자막 | 상대/나 자동 구분 + 타임스탬프, 영어 아래 한국어 번역 스트리밍 |
| ✦ 답변 카드 | 질문 요지(한국어) → `전략` → `답변` 2개 (영어 볼드 + 한국어 번역 + 🔊) |
| 퀵 액션 | 👍 동의하기 · 👎 반박하기 · 💬 질문하기 · 💡 제안하기 — 의도별 문장 생성 |
| 하단 입력 | 한국어 문장/단어 → 즉시 영어 변환 |

## 내 프로필 개인화

`backend/data/my_profile.md`를 실제 경력·성과로 채우면 저장 즉시 반영된다.
답변 생성 시 프로필 전체가 근거로 들어가므로(임베딩·벡터DB 불필요),
숫자·회사명이 구체적일수록 답변의 설득력이 올라간다.
질문·표현 은행은 `backend/data/interview_bank.json`에서 직접 수정.

## 파일 구조

```
interview-coach/
├── server.py              단일 파일 stdlib HTTP 서버 (의존성 0, 포트 3778)
├── start.sh                실행 스크립트
├── live.html                🔴 실전 라이브 코파일럿 (이중 스트림 캡처 + VAD)
├── interview.html            연습 모드 UI
├── interview.webmanifest    PWA 매니페스트
└── backend/
    ├── llm.py               Groq API — LLM 스트리밍/JSON + Whisper STT (Ollama 폴백)
    ├── speech_metrics.py     WPM·군말 비율 등 결정론적 발화 지표
    ├── interview_pipeline.py 질문은행/근거선택/답변·피드백·라이브 프롬프트
    └── data/
        ├── interview_bank.json  질문 27개 + 표현 48개 (IT 영업)
        └── my_profile.md         내 프로필 (직접 채워 넣기)
```

## API

| 엔드포인트 | 동작 |
|---|---|
| `POST /api/stt?lang=en` (body: 오디오 바이트) | Groq Whisper 음성 인식 → `{text}` |
| `POST /api/live/suggest` `{question, cefr, context, intent}` | 답변 카드 (요지/전략/답변 2개+KR, NDJSON 스트리밍). intent: answer·agree·disagree·ask·propose |
| `POST /api/live/summary` `{transcript, mode}` | mode=line: 실시간 한 줄 요약 / full: 전체 정리 (스트리밍) |
| `POST /api/translate` `{text}` | KR↔EN 자동감지 번역 (스트리밍) |
| `GET /api/interview/question·categories·status` | 연습 모드 질문 은행 |
| `POST /api/interview/answers·feedback` | 연습 모드 모범답변/STAR 피드백 |
| `GET /health` | 프로바이더/모델 상태 |

## 폴백 동작

`GROQ_API_KEY`가 없으면: 답변 생성·번역은 로컬 Ollama(`OLLAMA_MODEL`, 기본 gemma3:12b)로
폴백되지만 **음성 인식(STT)은 비활성** — 라이브 모드의 핵심이 Groq이므로 키 설정을 권장.
API 키는 코드/저장소에 넣지 말고 환경변수로만 관리할 것.
