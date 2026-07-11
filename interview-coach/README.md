# 🎤 영어 면접 코치 — IT 영업 직군

다른 프로젝트(Preply 앱 등)와 **완전히 독립된** 영어 모의 면접 프로그램.
맥북(Ollama)에서 로컬로 동작하거나, `GROQ_API_KEY`를 설정하면 초저지연 답변을
받을 수 있다. IT 영업(클라우드/SaaS) 직군에 맞춘 질문·표현 은행이 기본 내장.

## 실행

```bash
bash start.sh
# → http://localhost:3778/interview.html  (연습 모드)
# → http://localhost:3778/live.html       (실전 화상 면접용 라이브 코파일럿)
```

의존성은 stdlib뿐이라 `pip install` 없이 macOS 기본 Python 3로 바로 실행된다.
음성 인식(STT)·음성 합성(TTS)은 브라우저 기능(Web Speech API / macOS 내장 음성)을
쓰므로 **Chrome에서 여는 것을 권장**한다.

## 두 가지 모드

| 모드 | 페이지 | 용도 |
|---|---|---|
| 연습 모드 | `/interview.html` | 질문 은행에서 문제를 받아 STT로 답변 → STAR 구조 피드백 → 프로필 근거 30/60/90초 모범 답변 비교 |
| 🔴 라이브 모드 | `/live.html` | 실전 화상면접(Zoom/Meet) 창 옆에 띄워 실시간 자막+번역, 질문 자동 감지 시 즉시 답변 제안 |

## LLM 백엔드 — 로컬 Ollama ↔ Groq

`backend/llm.py`가 프로바이더를 추상화한다:

```bash
export GROQ_API_KEY=gsk_...     # 설정 시 Groq(llama-3.3-70b, 초당 수백 토큰) 사용
bash start.sh
```

| | 로컬 Ollama (기본) | Groq (`GROQ_API_KEY` 설정 시) |
|---|---|---|
| 라이브 답변 지연 | 15~30초 (16GB 맥북 gemma3:12b) | **1~2초** |
| 인터넷 | 불필요 | 필요 |
| 프라이버시 | 완전 로컬 | 대화·프로필이 Groq 서버로 전송 |

임베딩(질문/프로필 의미 검색용, `nomic-embed-text`)은 Groq에 API가 없어
**항상 로컬 Ollama**를 사용한다. Ollama가 꺼져 있어도 검색 없이 프로필 전체를
근거로 답변은 계속 생성된다(`interview_pipeline._safe_retrieve`).

```bash
ollama pull nomic-embed-text     # 검색용 (필수, ~270MB)
ollama pull gemma3:12b           # 로컬 답변 생성용 (Groq 쓰면 생략 가능)
```

## 내 프로필 개인화

`backend/data/my_profile.md`를 열어 실제 경력·성과로 채워 넣으면
**저장 즉시 다음 요청부터 자동 반영**된다 (파일 해시로 검색 인덱스가 자동 재빌드됨).
숫자·회사명이 구체적일수록 생성되는 답변의 설득력이 올라간다.

## 질문·표현 은행 수정

`backend/data/interview_bank.json`에 질문/표현을 직접 추가·수정할 수 있다.
실제 기출 질문이나 면접 후기를 이 형식으로 넣으면 그대로 반영된다.

```json
{
  "questions": [{"id": "q28", "category": "experience", "difficulty": 2,
                 "en": "...", "kr": "...", "tip_ko": "..."}],
  "phrases":   [{"en": "...", "kr": "...", "category": "..."}]
}
```

## 파일 구조

```
interview-coach/
├── server.py              단일 파일 stdlib HTTP 서버 (의존성 0)
├── start.sh                실행 스크립트
├── interview.html           연습 모드 UI
├── live.html                라이브 모드 UI
├── interview.webmanifest    PWA 매니페스트 (홈 화면 추가용)
└── backend/
    ├── llm.py               Groq ↔ Ollama 프로바이더 추상화
    ├── embeddings.py        로컬 임베딩(nomic-embed-text) 유틸
    ├── speech_metrics.py     WPM·군말 비율 등 결정론적 발화 지표
    ├── interview_pipeline.py 질문/답변/피드백/라이브 파이프라인
    └── data/
        ├── interview_bank.json  질문 27개 + 표현 48개 (IT 영업)
        └── my_profile.md         내 프로필 (직접 채워 넣기)
```

## API

| 엔드포인트 | 동작 |
|---|---|
| `GET /api/interview/question?category=&difficulty=&exclude=` | 질문 출제 |
| `GET /api/interview/categories` | 카테고리 목록 |
| `GET /api/interview/status` | 질문/표현/프로필/인덱스 상태 |
| `POST /api/interview/answers` `{question, cefr}` | 프로필 근거 모범 답변 3버전 |
| `POST /api/interview/feedback` `{question, transcript, cefr, duration_sec}` | STAR 구조 + 표현 피드백 |
| `POST /api/live/suggest` `{question, cefr, context}` | 실시간 답변 제안 (NDJSON 스트리밍) |
| `POST /api/live/summary` `{transcript}` | 지금까지 대화 한국어 요약 (스트리밍) |
| `POST /api/translate` `{text}` | KR↔EN 자동감지 번역 (스트리밍) |
| `GET /health` | LLM 프로바이더/연결 상태 |
