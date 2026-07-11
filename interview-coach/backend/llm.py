"""
═══════════════════════════════════════════════════════════════
 LLM 프로바이더 추상화 — Groq(클라우드, 초고속) ↔ Ollama(로컬)

 GROQ_API_KEY 환경변수가 설정돼 있으면 Groq를, 없으면 로컬 Ollama를 쓴다.
 - Groq: llama-3.3-70b 기준 초당 수백 토큰 → 라이브 모드 답변이 1~2초
   (트레이드오프: 대화 내용이 Groq 서버로 전송됨)
 - Ollama: 완전 로컬/오프라인, 프라이버시 보장 (16GB 맥북 기준 15~30초)

 임베딩(nomic-embed-text)은 Groq가 제공하지 않으므로 항상 로컬 Ollama 사용.

 스트리밍은 어느 프로바이더든 Ollama NDJSON 형태({"message":{"content":...}})로
 통일해 내보내므로 프런트엔드는 수정 없이 그대로 동작한다.

 의존성 0 (stdlib urllib만 사용) — server.py 전용 (interview-coach는 독립 프로젝트).
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Iterator

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = os.environ.get("GROQ_URL", "https://api.groq.com/openai/v1")  # 테스트용 오버라이드 가능
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:12b")  # 16GB 맥북 기본값


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
