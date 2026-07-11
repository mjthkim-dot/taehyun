"""
═══════════════════════════════════════════════════════════════
 임베딩 유틸 — 로컬 Ollama의 nomic-embed-text로 텍스트를 벡터화.

 의존성 0 (stdlib urllib만 사용) — interview_pipeline.py가 질문/프로필/표현을
 검색(RAG)하는 데 쓴다. 답변 생성 자체는 llm.py(Groq 또는 Ollama)가 담당하고,
 임베딩은 Groq에 API가 없어 항상 로컬 Ollama를 사용한다.
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import math
import os
import urllib.error
import urllib.request

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")

# 실시간 번역(스트리밍) 시스템 프롬프트 — server.py / /api/translate 공용
TRANSLATE_SYSTEM_PROMPT = """You are a real-time Korean-English translator for a
job-interview preparation app. Detect the input language automatically:
- If the input is Korean, translate it into natural, spoken English.
- If the input is English, translate it into natural Korean.
Reply with ONLY the translation text - no quotes, no labels, no explanation."""


def _post_json(path: str, payload: dict, timeout: int = 60) -> dict:
    req = urllib.request.Request(
        f"{OLLAMA_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def embed(text: str) -> list[float]:
    """Ollama 임베딩 API 호출. Ollama 버전에 따라 엔드포인트가 다를 수 있어 순서대로 시도."""
    text = (text or "").strip()
    if not text:
        return []
    try:
        data = _post_json("/api/embed", {"model": EMBED_MODEL, "input": text})
        vec = (data.get("embeddings") or [[]])[0]
        if vec:
            return vec
    except (urllib.error.URLError, KeyError, IndexError, ValueError):
        pass
    data = _post_json("/api/embeddings", {"model": EMBED_MODEL, "prompt": text})
    return data.get("embedding", [])


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
