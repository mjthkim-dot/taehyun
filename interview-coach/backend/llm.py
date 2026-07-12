"""
═══════════════════════════════════════════════════════════════
 Groq 백엔드 — LLM(답변/번역/요약) + Whisper STT(음성 인식)

 실시간성이 핵심이므로 모든 AI 호출을 Groq로 통일한다:
 - LLM:  llama-3.3-70b (초당 수백 토큰 → 답변 1~2초)
 - STT:  whisper-large-v3-turbo (세그먼트당 수백 ms)
 GROQ_API_KEY가 없으면 LLM만 로컬 Ollama로 폴백한다 (STT는 Groq 전용).

 스트리밍은 어느 프로바이더든 Ollama NDJSON 형태({"message":{"content":...}})로
 통일해 내보내므로 프런트엔드는 수정 없이 그대로 동작한다.

 의존성 0 (stdlib urllib만 사용) — server.py 전용 (interview-coach는 독립 프로젝트).
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import os
import urllib.request
import uuid
from typing import Iterator

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = os.environ.get("GROQ_URL", "https://api.groq.com/openai/v1")  # 테스트용 오버라이드 가능
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_STT_MODEL = os.environ.get("GROQ_STT_MODEL", "whisper-large-v3-turbo")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:12b")  # 폴백용 (16GB 맥북 기본값)

# 실시간 번역 시스템 프롬프트 (KR↔EN 자동 감지)
TRANSLATE_SYSTEM_PROMPT = """You are a real-time Korean-English translator for a
job-interview copilot. Detect the input language automatically:
- If the input is Korean, translate it into natural, spoken English.
- If the input is English, translate it into natural Korean.
Reply with ONLY the translation text - no quotes, no labels, no explanation."""


def provider() -> str:
    return "groq" if GROQ_API_KEY else "ollama"


def model_name() -> str:
    return GROQ_MODEL if GROQ_API_KEY else OLLAMA_MODEL


def _open(url: str, payload: dict, headers: dict | None = None, timeout: int = 300):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})}, method="POST",
    )
    return urllib.request.urlopen(req, timeout=timeout)


def chat_once(messages: list[dict], json_mode: bool = False, temperature: float = 0.3,
              max_tokens: int = 800, model: str | None = None) -> str:
    """단발 호출 → 응답 텍스트. json_mode=True면 JSON 출력 강제."""
    if GROQ_API_KEY:
        payload: dict = {
            "model": model or GROQ_MODEL, "messages": messages,
            "temperature": temperature, "max_tokens": max_tokens, "stream": False,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        with _open(f"{GROQ_URL}/chat/completions", payload,
                   {"Authorization": f"Bearer {GROQ_API_KEY}"}) as r:
            return json.loads(r.read())["choices"][0]["message"]["content"]

    payload = {
        "model": model or OLLAMA_MODEL, "messages": messages,
        "stream": False, "keep_alive": "30m",
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    if json_mode:
        payload["format"] = "json"
    with _open(f"{OLLAMA_URL}/api/chat", payload) as r:
        return json.loads(r.read())["message"]["content"]


def stream_ndjson(messages: list[dict], temperature: float = 0.4,
                  max_tokens: int = 400, model: str | None = None) -> Iterator[bytes]:
    """토큰 스트림을 Ollama NDJSON 라인(bytes)으로 yield. 연결 실패는 첫 next()에서 예외."""
    if GROQ_API_KEY:
        payload = {
            "model": model or GROQ_MODEL, "messages": messages,
            "temperature": temperature, "max_tokens": max_tokens, "stream": True,
        }
        with _open(f"{GROQ_URL}/chat/completions", payload,
                   {"Authorization": f"Bearer {GROQ_API_KEY}"}, timeout=120) as resp:
            for raw in resp:  # SSE: "data: {...}\n"
                line = raw.decode("utf-8", "ignore").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    tok = json.loads(data)["choices"][0]["delta"].get("content")
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if tok:
                    yield (json.dumps({"message": {"content": tok}}) + "\n").encode("utf-8")
        yield (json.dumps({"done": True}) + "\n").encode("utf-8")
        return

    payload = {
        "model": model or OLLAMA_MODEL, "messages": messages,
        "stream": True, "keep_alive": "30m",
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    with _open(f"{OLLAMA_URL}/api/chat", payload) as resp:
        for raw in resp:
            if raw.strip():
                yield raw if raw.endswith(b"\n") else raw + b"\n"


def transcribe(audio: bytes, filename: str = "audio.webm",
               language: str | None = None, model: str | None = None) -> str:
    """오디오 바이트 → 텍스트 (Groq Whisper). STT는 Groq 전용 — 키 없으면 에러.
    language=None이면 Whisper가 언어를 자동 감지한다 (한국어/영어 혼용 면접 대응)."""
    if not GROQ_API_KEY:
        raise RuntimeError("음성 인식에는 GROQ_API_KEY가 필요합니다 (Groq Whisper STT).")

    boundary = uuid.uuid4().hex
    parts: list[bytes] = []

    def field(name: str, value: str) -> None:
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        )

    field("model", model or GROQ_STT_MODEL)
    if language:
        field("language", language)
    field("response_format", "json")
    field("temperature", "0")
    content_type = "audio/wav" if filename.endswith(".wav") else "audio/webm"
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n".encode() + audio + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{GROQ_URL}/audio/transcriptions", data=b"".join(parts),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                 "Authorization": f"Bearer {GROQ_API_KEY}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read()).get("text", "").strip()
