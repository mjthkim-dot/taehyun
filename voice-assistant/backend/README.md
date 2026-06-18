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

두 경로 모두 `/api/chat`·`/health`·`/api/caf`를 동일 스펙으로 제공하므로
프론트엔드 코드 수정 없이 전환됩니다.

## 아키텍처

```
Browser (index.html)
  │  HTTP(SSE)  ── POST /api/chat ──────────► Ollama /api/chat (NDJSON 스트리밍)
  │  HTTP       ── POST /api/caf  ──► CAF 파이프라인 ─► Ollama (format=json)
  │  HTTP       ── POST /api/session ─► PolyglotStore (Mongo 원문 + PG 점수)
  │  WebSocket  ── /ws/audio ───────► (Whisper STT 연동 지점) ─► CAF
  └─ localStorage: va_profile / va_skill_stats / va_sessions (오프라인 진실원천)
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
```
