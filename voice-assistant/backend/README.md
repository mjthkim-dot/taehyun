# TBLT LMS — 백엔드 AI 스피치 파이프라인

PREPLY AI 스피킹 코치를 **TBLT(과업 중심 언어 교수)** 기반 글로벌 어학 LMS로
고도화하기 위한 백엔드 레이어입니다. 기존 단일 파일 앱(`index.html` + `server.py`)을
**비파괴적으로 확장**합니다 — 로컬은 의존성 0으로 그대로 동작하고, 클라우드 이전 시
이 디렉토리의 FastAPI + LangChain 스택으로 무중단 승격합니다.

## 두 가지 실행 경로

| 경로 | 진입점 | 의존성 | CAF 분석 | WebSocket | 폴리글랏 저장 |
|---|---|---|---|---|---|
| **로컬(기본)** | `../server.py` | 0 (stdlib + requests) | ✅ | — | localStorage |
| **클라우드** | `backend/main.py` | FastAPI+LangChain | ✅ | ✅ `/ws/audio` | PostgreSQL·Mongo·Qdrant·S3 |

두 경로 모두 `/api/chat`·`/health`·`/api/caf`·`/api/translate`·`/api/answer-set`을
동일 스펙으로 제공하므로 프론트엔드 코드 수정 없이 전환됩니다.

## 아키텍처

```
Browser (index.html)
  │  HTTP(SSE)  ── POST /api/chat      ──────────► Ollama /api/chat (NDJSON 스트리밍)
  │  HTTP       ── POST /api/caf       ──► CAF 파이프라인 ─► Ollama (format=json)
  │  HTTP       ── POST /api/translate ──► Ollama /api/chat (NDJSON 스트리밍, KR↔EN 자동감지)
  │  HTTP       ── POST /api/answer-set──► RAG 검색(로컬 임베딩) + Ollama (format=json)
  │  HTTP       ── GET  /api/rag/status ─► 코퍼스/인덱스 상태
  │  HTTP       ── POST /api/session   ─► PolyglotStore (Mongo 원문 + PG 점수)
  │  WebSocket  ── /ws/audio ───────► (Whisper STT 연동 지점) ─► CAF
  └─ localStorage: va_profile / va_skill_stats / va_sessions (오프라인 진실원천)
```

### 🎤 영어 면접 코치 (IT 영업 직군) — 메인 기능

맥북(16GB 권장)에서 Ollama만으로 동작하는 **영어 면접 준비 프로그램**.
접속: `bash start.sh` 후 **http://localhost:3777/interview.html**

```
질문 받기 (질문 은행 27개, 카테고리별) ─► 🔊 질문 듣기 (macOS 내장 TTS)
  → 🎙 영어로 답변 (Web Speech STT, Chrome)
  → 📋 피드백: STAR 구조 체크 + 표현 업그레이드 + 점수 (WPM·군말 비율 측정)
  → 💬 모범 답변: 내 프로필 근거 30초/60초/90초 3버전 (핵심 표현 + 전달 팁)
  → 🇰🇷 말문 막히면: 한국어 입력 → 실시간 영어 힌트
```

| 구성 요소 | 파일 | 설명 |
|---|---|---|
| 질문 은행 | `data/interview_bank.json` | IT 영업 빈출 질문 27개(카테고리 8종·난이도·팁) + 면접 표현 48개(KR↔EN) — 직접 추가/수정 가능 |
| **내 프로필** | `data/my_profile.md` | 이력·성과 (수정 후 저장하면 **다음 요청에 자동 반영** — 파일 해시로 인덱스 자동 재빌드) |
| 파이프라인 | `interview_pipeline.py` | 질문 선택 → 프로필+표현 검색(RAG) → 답변 생성/피드백 |
| UI | `../interview.html` | 모의 면접 화면 (질문/녹음/피드백/모범답변/힌트) |

| 엔드포인트 | 동작 |
|---|---|
| `GET /api/interview/question?category=&difficulty=&exclude=` | 질문 출제 (exclude로 중복 방지) |
| `GET /api/interview/categories` | 카테고리 목록 |
| `POST /api/interview/answers` `{question, cefr}` | 프로필 근거 모범 답변 3버전 |
| `POST /api/interview/feedback` `{question, transcript, cefr, duration_sec}` | STAR 구조 + 표현 피드백 |
| `GET /api/interview/status` | 질문/표현/프로필 청크 수, 인덱스 상태 |

### 🔴 라이브 모드 — 실전 화상 면접 코파일럿 (`/live.html`)

Zoom/Meet 옆에 띄워두는 실시간 비서 (Smooth AI 방식):

```
🎧 연속 음성 인식(en) ─► 실시간 영어 자막 + 한국어 번역
   └─ 질문 패턴 감지(what/why/tell me/...) ─► 자동으로 답변 제안 (스트리밍)
        전략(한국어 한 줄) + 바로 읽을 수 있는 60~90단어 영어 답변 (프로필 근거)
📌 요약 버튼 ─► 지금까지 나온 질문 + 예상 질문 한국어 브리핑
🇰🇷 하단 입력창 ─► 하고 싶은 말 한국어 입력 → Enter → 영어 문장
```

| 엔드포인트 | 동작 |
|---|---|
| `POST /api/live/suggest` `{question, cefr}` | 질문 → 저지연 답변 1개 (NDJSON 스트리밍, RAG 근거) |
| `POST /api/live/summary` `{transcript}` | 트랜스크립트 → 한국어 중간 요약 (스트리밍) |

주의사항:
- 면접관 목소리가 **스피커로** 나와야 마이크가 인식합니다 (이어폰 사용 시 불가).
  이어폰이 필요하면 macOS 시스템 오디오 루프백(BlackHole 등) 설정이 필요.
- 음성 인식은 Chrome의 Web Speech API 사용 — Chrome에서 열어야 합니다.
- 새 질문이 감지되면 진행 중이던 답변 생성은 자동 중단되고 새 답변으로 교체됩니다.
- 한국어 자막 번역은 답변 제안이 없을 때만 처리됩니다 (답변 제안이 항상 우선).

**모델 자동 선택**: `start.sh`가 RAM을 감지해 16GB 맥북이면 `gemma3:12b`를 기본으로
사용한다 (27b는 16GB에서 스왑 발생). `CAF_MODEL=gemma3:27b bash start.sh`로 강제 가능.

### ⚡ Groq 모드 — 실시간 품질 (권장: 라이브 모드)

`GROQ_API_KEY`만 설정하면 답변 생성·번역이 Groq(`llama-3.3-70b-versatile`,
초당 수백 토큰)로 전환된다 — 라이브 답변이 15~30초 → **1~2초**로 단축되고
영어 품질도 로컬 12b보다 좋다. 코드는 `backend/llm.py`가 프로바이더를 추상화하며,
어느 쪽이든 프런트엔드가 받는 스트림 형식은 동일하다.

```bash
export GROQ_API_KEY=gsk_...        # ~/.zshrc에 넣어두면 편함
bash voice-assistant/start.sh      # "⚡ Groq 모드 활성" 출력 확인
# 모델 변경: export GROQ_MODEL=llama-3.3-70b-versatile (기본값)
```

| | 로컬 (기본) | Groq (`GROQ_API_KEY` 설정 시) |
|---|---|---|
| 라이브 답변 지연 | 15~30초 (gemma3:12b) | **1~2초** |
| 영어 품질 | 중상 | 상 (70B급) |
| 프라이버시 | 완전 로컬 | 대화·프로필이 Groq 서버로 전송됨 |
| 인터넷 | 불필요 | 필요 |

임베딩(`nomic-embed-text`)과 CAF 분석은 Groq 모드에서도 로컬 Ollama를 쓴다
(Groq는 임베딩 API가 없음). Ollama가 꺼져 있으면 검색 없이 프로필 전체를
근거로 사용해 답변은 계속 나온다(graceful fallback).

```bash
# 맥북 최초 설정 (합계 약 8.5GB 다운로드)
ollama pull gemma3:12b
ollama pull nomic-embed-text

bash voice-assistant/start.sh
# → http://localhost:3777/interview.html (STT는 Chrome에서)

# CLI로 빠른 확인:
python3 backend/interview_pipeline.py "Tell me about a time you exceeded your sales target."
```

### 🆕 실시간 번역 + 영어 답변셋 (RAG) — smoothai_kr 벤치마크

맥북에서 인터넷 없이(Ollama만으로) 동작하는 것을 목표로 한다.

| 기능 | 엔드포인트 | 동작 |
|---|---|---|
| 실시간 KR↔EN 번역 | `POST /api/translate` | 입력 언어를 자동 감지해 반대 언어로 번역, NDJSON으로 토큰 스트리밍(자막처럼 실시간 표시) |
| 영어 답변셋 (RAG) | `POST /api/answer-set` | 한국어 상황/질문 → 레슨·시나리오 코퍼스에서 관련 문장 검색 → CEFR 레벨별 영어 답변 후보 3개(격식 단계별 + 근거 문장 + 한국어 역번역) 생성 |
| RAG 인덱스 상태 | `GET /api/rag/status` | 코퍼스 크기, 인덱스 빌드 여부, 임베딩/생성 모델 |
| RAG 인덱스 재빌드 | `POST /api/rag/rebuild` | 코퍼스가 바뀌었을 때 임베딩 캐시 강제 재생성 |

- **코퍼스**: `next-app/data/lessons.json`(레슨/마스터코스/시나리오 라이브러리)에서
  `backend/build_rag_corpus.py`로 KR↔EN 문장쌍 697개를 뽑아 `backend/data/rag_corpus.jsonl`에 저장.
  레슨 데이터가 바뀌면 다시 실행: `python3 backend/build_rag_corpus.py`
- **임베딩**: Ollama `nomic-embed-text` 모델로 코퍼스를 임베딩해 `backend/data/rag_index.json`에
  캐시(최초 요청 시 자동 빌드, 이후 재사용). 별도 벡터DB(Qdrant 등) 없이 코사인 유사도로 검색 —
  코퍼스 규모(수백~수천 문장)에서는 순수 Python 계산으로 충분히 빠르다.
- **의존성**: `rag_pipeline.py`는 stdlib(urllib)만 사용 — `server.py`(로컬, 의존성 0)와
  `backend/main.py`(FastAPI) 양쪽에서 동일 모듈을 공유한다.

```bash
ollama pull nomic-embed-text     # 임베딩 모델 (최초 1회, ~270MB)

curl -s localhost:3777/api/answer-set -H 'Content-Type: application/json' -d '{
  "situation_ko": "체크인 하려는데 창가 자리로 바꿀 수 있을까요?",
  "cefr": "B1"
}' | python3 -m json.tool

curl -s -N localhost:3777/api/translate -H 'Content-Type: application/json' \
  -d '{"text": "이 근처에 괜찮은 식당 있어요?"}'
```

### CAF 엔진 (`caf_pipeline.py`)
STT 트랜스크립트 + 학습자 CEFR → 단일 구조화 프롬프트 1콜로:
- **Complexity** (절 다양성·종속·어휘폭), **Accuracy** (문법 정확도), **Fluency** (흐름·군말)
- 문법 오류 태깅(tense/agreement/article/preposition/word-choice)
- **CEFR +1 레벨 파라프레이즈** (예: A2 "I go to gym a lot" → B1 "I work out regularly")
- 결정론적 보조지표(WPM·filler ratio)로 fluency 보정

### 폴리글랏 스토리지 (`storage.py`)
환경변수로 활성화, 미설정 시 graceful no-op:
- `POSTGRES_DSN` — 정형(점수/세션) · `MONGO_URI` — 비정형(원문 트랜스크립트)
- `QDRANT_URL` — 발화 벡터 · `S3_BUCKET` — 원본 오디오

## 설치 & 실행 (클라우드 경로)

```bash
pip install -r backend/requirements.txt

# 권장 모델 (Google Gemma 3 — 최고 품질 오픈소스)
ollama pull gemma3:27b           # ⭐ 27B 풀모델 — VRAM 16GB+ 권장
# 저사양 대안:
# ollama pull gemma3:12b         # 8GB VRAM 이상
# ollama pull gemma3:4b          # 4GB VRAM, 빠른 응답

BACKEND=fastapi bash start.sh    # FastAPI로 기동 (없으면 자동 server.py 폴백)
# 또는 직접:
cd backend && uvicorn main:app --host 0.0.0.0 --port 3777
```

PostgreSQL 스키마 적용(선택):
```bash
psql "$POSTGRES_DSN" -f backend/schema.sql   # 전부 IF NOT EXISTS — 비파괴적
```

## 테스트 방법

```bash
# 1) CAF 파이프라인 단독 (Ollama만 필요)
python3 backend/caf_pipeline.py "Yesterday I go to the store and buy some apple."
#    → complexity/accuracy/fluency 점수 + errors + paraphrases JSON 출력

# 2) 로컬 server.py의 CAF 엔드포인트
bash start.sh                    # 다른 터미널에서:
curl -s localhost:3777/api/caf -H 'Content-Type: application/json' \
  -d '{"transcript":"I go gym everyday and I very like it","cefr":"A2"}' | python3 -m json.tool

# 3) FastAPI 경로 + 스토리지 상태
BACKEND=fastapi bash start.sh
curl -s localhost:3777/health    # storage: {postgres,mongo,qdrant,s3} 활성 여부 포함

# 4) 프론트 통합: 회화 탭에서 영어로 3문장+ 말한 뒤 🎯 CAF 클릭
#    → 채팅에 CAF 카드, 📊 진도 탭에 4대 스킬 GSE 게이지 갱신 확인

# 5) RAG 영어 답변셋 (Ollama + nomic-embed-text 필요, 최초 호출은 인덱스 빌드로 수 초 소요)
ollama pull nomic-embed-text
python3 backend/rag_pipeline.py "체크인 하려는데 창가 자리로 바꿀 수 있을까요?"
#    → references(검색된 유사 문장) + answers(영어 답변 3개, 격식별 + 한국어 역번역)

# 6) 실시간 번역 스트리밍
curl -s -N localhost:3777/api/translate -H 'Content-Type: application/json' \
  -d '{"text":"이 근처에 괜찮은 식당 있어요?"}'
```
