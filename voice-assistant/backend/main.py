"""
═══════════════════════════════════════════════════════════════
 TBLT LMS — FastAPI 백엔드 (클라우드-레디 풀스택 경로)

 server.py(stdlib, 의존성 0)의 상위 호환 버전.
 동일 포트(3777)에서 동작하며 기존 프론트엔드와 100% 호환:

   기존 유지   POST /api/chat   → Ollama NDJSON 스트리밍 프록시
   기존 유지   GET  /health     → Ollama 연결 + 모델 목록
   기존 유지   GET  /           → index.html
   🆕 추가     POST /api/caf     → STT 텍스트 CAF 분석 + 파라프레이즈
   🆕 추가     POST /api/session → CAF 결과 영속화 (폴리글랏 스토어)
   🆕 추가     GET  /api/storage → 활성 스토리지 백엔드 상태
   🆕 추가     WS   /ws/audio    → 실시간 오디오 스트리밍 (Whisper STT 대비)
   🆕 면접     GET  /api/interview/question|categories|status → 질문 은행
   🆕 면접     POST /api/interview/answers  → 30/60/90초 모범 답변 (프로필 근거)
   🆕 면접     POST /api/interview/feedback → 내 답변 STAR 구조 + 표현 피드백
   🆕 번역     POST /api/translate → 실시간 KR↔EN 번역 (NDJSON 스트리밍)

 실행:  uvicorn backend.main:app --host 0.0.0.0 --port 3777
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import os
import urllib.error
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

import interview_pipeline
from caf_pipeline import analyze_caf
from rag_pipeline import ANSWER_MODEL, TRANSLATE_SYSTEM_PROMPT, generate_answer_set
from rag_pipeline import index as rag_index
from storage import store

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
HTML_FILE = Path(__file__).parent.parent / "index.html"
ANSWER_SET_HTML_FILE = Path(__file__).parent.parent / "answer-set.html"
INTERVIEW_HTML_FILE = Path(__file__).parent.parent / "interview.html"

app = FastAPI(title="TBLT LMS — AI Speech Pipeline", version="1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# ── index.html 서빙 (캐시 금지) ────────────────────────────────
@app.get("/")
@app.get("/index.html")
def index():
    return FileResponse(HTML_FILE, media_type="text/html",
                        headers={"Cache-Control": "no-store, must-revalidate"})


# ── /health (기존 호환) ────────────────────────────────────────
@app.get("/answer-set.html")
def answer_set_page():
    return FileResponse(ANSWER_SET_HTML_FILE, media_type="text/html",
                        headers={"Cache-Control": "no-store, must-revalidate"})


@app.get("/interview.html")
def interview_page():
    return FileResponse(INTERVIEW_HTML_FILE, media_type="text/html",
                        headers={"Cache-Control": "no-store, must-revalidate"})


@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in r.json().get("models", [])]
        return {"status": "ok", "models": models, "storage": store.enabled}
    except Exception as e:  # noqa: BLE001
        return {"status": "error", "message": str(e)}


# ── /api/chat (기존 호환 — NDJSON 스트리밍 프록시) ─────────────
@app.post("/api/chat")
async def chat(request: Request):
    body = await request.body()

    async def stream():
        # 대형 모델 첫 토큰 로딩 대기를 위해 read 타임아웃을 넉넉히 둔다
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0)) as c:
            async with c.stream("POST", f"{OLLAMA_URL}/api/chat", content=body,
                                headers={"Content-Type": "application/json"}) as r:
                async for chunk in r.aiter_bytes():
                    if chunk:
                        yield chunk

    return StreamingResponse(stream(), media_type="application/x-ndjson")


# ── 🆕 /api/caf — CAF 분석 엔진 ────────────────────────────────
class CafRequest(BaseModel):
    transcript: str
    cefr: str = "A2"
    duration_sec: float | None = None
    model: str | None = None


@app.post("/api/caf")
def caf(req: CafRequest):
    try:
        return analyze_caf(req.transcript, req.cefr, req.duration_sec, req.model)
    except httpx.ConnectError:
        return JSONResponse(
            status_code=503,
            content={"error": "Ollama에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요."},
        )
    except httpx.TimeoutException:
        return JSONResponse(
            status_code=503,
            content={"error": "모델 응답이 지연되고 있습니다. 대형 모델은 처음 로딩에 시간이 걸려요. 잠시 후 다시 시도하세요."},
        )
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── 🆕 /api/session — CAF 결과 영속화 ─────────────────────────
class SessionRequest(BaseModel):
    user_id: int = 1
    lesson_id: int
    caf: dict
    transcript: str = ""


@app.post("/api/session")
def save_session(req: SessionRequest):
    refs = store.save_session(req.user_id, req.lesson_id, req.caf, req.transcript)
    return {"saved": True, "refs": refs, "storage": store.enabled}


# ── 🆕 /api/storage — 활성 백엔드 상태 ────────────────────────
@app.get("/api/storage")
def storage_status():
    return store.enabled


# ── 🆕 /api/translate — 실시간 KR↔EN 번역 (NDJSON 스트리밍) ────
# smoothai_kr 벤치마크: 방향(한→영/영→한) 자동 감지, 토큰 스트리밍으로
# 대화 중 지연 없이 자막처럼 번역이 흘러나오도록 한다.
class TranslateRequest(BaseModel):
    text: str
    model: str | None = None


@app.post("/api/translate")
async def translate(req: TranslateRequest):
    body = json.dumps({
        "model": req.model or ANSWER_MODEL,
        "messages": [
            {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT},
            {"role": "user", "content": req.text},
        ],
        "stream": True,
    }).encode()

    async def stream():
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as c:
                async with c.stream("POST", f"{OLLAMA_URL}/api/chat", content=body,
                                    headers={"Content-Type": "application/json"}) as r:
                    async for chunk in r.aiter_bytes():
                        if chunk:
                            yield chunk
        except httpx.ConnectError:
            yield json.dumps({"error": "Ollama에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요."}).encode() + b"\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


# ── 🆕 /api/answer-set — RAG 기반 영어 답변셋 생성 ─────────────
# 한국어 상황/질문 → 레슨·시나리오 코퍼스에서 관련 문장 검색(RAG) →
# CEFR 레벨별 영어 답변 후보 3개(격식 단계별)를 생성한다.
class AnswerSetRequest(BaseModel):
    situation_ko: str
    cefr: str = "B1"
    k: int = 5
    category: str | None = None
    model: str | None = None


@app.post("/api/answer-set")
def answer_set(req: AnswerSetRequest):
    # rag_pipeline은 stdlib(urllib)로 Ollama를 호출하므로 httpx가 아닌 URLError를 던진다.
    try:
        return generate_answer_set(req.situation_ko, req.cefr, req.k, req.category, req.model)
    except urllib.error.URLError:
        return JSONResponse(
            status_code=503,
            content={"error": "Ollama에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요."},
        )
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── 🆕 면접 모드 — 질문 은행 / 모범 답변 / 피드백 ───────────────
@app.get("/api/interview/question")
def interview_question(category: str | None = None, difficulty: int | None = None,
                       exclude: str = ""):
    q = interview_pipeline.pick_question(category, difficulty, exclude.split(","))
    if not q:
        return JSONResponse(status_code=404, content={"error": "조건에 맞는 질문이 없습니다."})
    return q


@app.get("/api/interview/categories")
def interview_categories():
    return interview_pipeline.list_categories()


@app.get("/api/interview/status")
def interview_status():
    return interview_pipeline.index.status()


class InterviewAnswersRequest(BaseModel):
    question: str
    cefr: str = "B1"
    model: str | None = None


@app.post("/api/interview/answers")
def interview_answers(req: InterviewAnswersRequest):
    try:
        return interview_pipeline.generate_answers(req.question, req.cefr, req.model)
    except urllib.error.URLError:
        return JSONResponse(
            status_code=503,
            content={"error": "Ollama에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요."},
        )
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


class InterviewFeedbackRequest(BaseModel):
    question: str
    transcript: str
    cefr: str = "B1"
    duration_sec: float | None = None
    model: str | None = None


@app.post("/api/interview/feedback")
def interview_feedback(req: InterviewFeedbackRequest):
    try:
        return interview_pipeline.feedback(req.question, req.transcript, req.cefr,
                                           req.duration_sec, req.model)
    except urllib.error.URLError:
        return JSONResponse(
            status_code=503,
            content={"error": "Ollama에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요."},
        )
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── 🆕 /api/rag/status — RAG 인덱스 상태 (코퍼스 크기/임베딩 모델) ─
@app.get("/api/rag/status")
def rag_status():
    return rag_index.status()


@app.post("/api/rag/rebuild")
def rag_rebuild():
    try:
        return rag_index.rebuild()
    except urllib.error.URLError:
        return JSONResponse(
            status_code=503,
            content={"error": "Ollama에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요."},
        )
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── 🆕 /ws/audio — 실시간 오디오 스트리밍 ─────────────────────
# 브라우저가 오디오 청크를 보내면 누적 → (Whisper STT 연동 지점) →
# 일정 길이마다 CAF 부분 분석을 돌려줄 수 있는 골격.
@app.websocket("/ws/audio")
async def ws_audio(ws: WebSocket):
    await ws.accept()
    cefr = "A2"
    audio_buffer = bytearray()
    try:
        while True:
            msg = await ws.receive()
            if "bytes" in msg and msg["bytes"]:
                audio_buffer.extend(msg["bytes"])
                await ws.send_json({"type": "ack", "bytes": len(audio_buffer)})
            elif "text" in msg and msg["text"]:
                ctrl = json.loads(msg["text"])
                if ctrl.get("type") == "config":
                    cefr = ctrl.get("cefr", cefr)
                    await ws.send_json({"type": "ready", "cefr": cefr})
                elif ctrl.get("type") == "transcript":
                    # 브라우저 Web Speech STT 결과를 그대로 받아 CAF 분석
                    result = analyze_caf(ctrl.get("text", ""), cefr,
                                         ctrl.get("duration_sec"))
                    await ws.send_json({"type": "caf", "result": result})
                elif ctrl.get("type") == "end":
                    await ws.send_json({"type": "closed", "bytes": len(audio_buffer)})
                    break
    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "3777")))
