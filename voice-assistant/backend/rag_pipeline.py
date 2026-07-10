"""
═══════════════════════════════════════════════════════════════
 RAG 파이프라인 — 로컬 임베딩 검색 + 영어 답변셋 생성
 (smoothai_kr 벤치마크: "한국어 상황/질문 → 영어 답변 후보 여러 개")

 의존성 0 (stdlib만 사용, urllib으로 Ollama HTTP API 직접 호출) — server.py(로컬,
 stdlib+requests)와 backend/main.py(FastAPI) 양쪽에서 동일하게 import해 쓴다.

 파이프라인:
   1) build_rag_corpus.py가 next-app 레슨/시나리오 데이터에서 뽑은
      backend/data/rag_corpus.jsonl(KR↔EN 문장쌍)을 코퍼스로 사용.
   2) 최초 요청 시 Ollama 임베딩 모델(nomic-embed-text)로 전체 코퍼스를
      임베딩해 backend/data/rag_index.json에 캐시(이후 재사용).
   3) 사용자의 한국어 상황/질문을 같은 모델로 임베딩 → 코사인 유사도 top-k 검색.
   4) 검색된 참고 문장을 근거로 LLM에게 CEFR 레벨별 영어 답변 3개(격식차등)를
      단일 JSON 프롬프트로 생성시킨다(CAF 파이프라인과 동일한 설계 원칙).
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import math
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("RAG_EMBED_MODEL", "nomic-embed-text")
ANSWER_MODEL = os.environ.get("RAG_ANSWER_MODEL", os.environ.get("CAF_MODEL", "gemma3:27b"))

DATA_DIR = Path(__file__).parent / "data"
CORPUS_PATH = DATA_DIR / "rag_corpus.jsonl"
INDEX_PATH = DATA_DIR / "rag_index.json"

# 실시간 번역(스트리밍) 시스템 프롬프트 — server.py / backend/main.py 공용
TRANSLATE_SYSTEM_PROMPT = """You are a real-time Korean-English translator for a
speaking-practice app. Detect the input language automatically:
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


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _load_corpus() -> list[dict]:
    if not CORPUS_PATH.exists():
        return []
    entries = []
    with CORPUS_PATH.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


class RagIndex:
    """코퍼스 임베딩 인덱스. 최초 검색 시 빌드하고 디스크에 캐시한다."""

    def __init__(self) -> None:
        self._entries: list[dict] | None = None

    def _ensure_built(self) -> list[dict]:
        if self._entries is not None:
            return self._entries

        corpus = _load_corpus()
        if not corpus:
            self._entries = []
            return self._entries

        if INDEX_PATH.exists():
            try:
                cached = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
                if cached.get("model") == EMBED_MODEL and cached.get("count") == len(corpus):
                    self._entries = cached["entries"]
                    return self._entries
            except (json.JSONDecodeError, OSError):
                pass

        entries = []
        for item in corpus:
            vec = embed(f"{item.get('kr', '')} / {item.get('en', '')}")
            entries.append({**item, "embedding": vec})

        INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        INDEX_PATH.write_text(
            json.dumps({"model": EMBED_MODEL, "count": len(corpus), "entries": entries}, ensure_ascii=False),
            encoding="utf-8",
        )
        self._entries = entries
        return entries

    def status(self) -> dict[str, Any]:
        corpus = _load_corpus()
        return {
            "corpus_size": len(corpus),
            "index_built": INDEX_PATH.exists(),
            "embed_model": EMBED_MODEL,
            "answer_model": ANSWER_MODEL,
        }

    def rebuild(self) -> dict[str, Any]:
        """인덱스 캐시를 강제로 지우고 다시 빌드."""
        self._entries = None
        if INDEX_PATH.exists():
            INDEX_PATH.unlink()
        self._ensure_built()
        return self.status()

    def retrieve(self, query: str, k: int = 5, category: str | None = None) -> list[dict]:
        entries = self._ensure_built()
        if not entries:
            return []
        qvec = embed(query)
        if not qvec:
            return []
        scored = []
        for e in entries:
            if category and e.get("category") != category:
                continue
            score = _cosine(qvec, e.get("embedding", []))
            scored.append((score, e))
        scored.sort(key=lambda t: t[0], reverse=True)
        return [
            {
                "en": e.get("en"), "kr": e.get("kr"), "category": e.get("category"),
                "cefr": e.get("cefr"), "source": e.get("source"), "score": round(score, 4),
            }
            for score, e in scored[:k]
        ]


# 싱글톤 (main.py / server.py 공용)
index = RagIndex()


def build_answer_set_prompt(situation_ko: str, cefr: str, references: list[dict]) -> str:
    ref_lines = "\n".join(
        f'- ({r.get("category") or "general"}) KR: "{r["kr"]}" -> EN: "{r["en"]}"'
        for r in references if r.get("en")
    ) or "- (매칭되는 참고 문장 없음 - 일반 지식으로 답변)"

    return f"""You are a bilingual (Korean/English) speaking coach helping a Korean
learner produce natural English answers for a real-life situation.

Learner's CEFR level: {cefr}
Learner's situation or question (Korean): "{situation_ko}"

Relevant reference phrases retrieved from a Korean-English conversation bank
(use these as grounding when they genuinely fit; ignore ones that don't):
{ref_lines}

Produce exactly 3 candidate English answers the learner could say, ordered from
simplest to most natural/advanced, appropriate for CEFR {cefr} up to one level above.

Return ONLY valid JSON (no markdown) with this exact shape:
{{
  "answers": [
    {{
      "en": "candidate English sentence/reply",
      "kr_back_translation": "자연스러운 한국어 역번역",
      "register": "casual|neutral|formal",
      "note_ko": "이 표현을 언제/왜 쓰는지 한국어 한 줄 설명",
      "grounded_in": ["매칭된 참고 문장의 en 값들 (없으면 빈 배열)"]
    }}
  ]
}}

Rules:
- Exactly 3 answers, meaningfully different in phrasing (not just synonyms of each other).
- Natural spoken English, not textbook-stiff.
- If the situation is ambiguous, make a reasonable real-world assumption instead of asking back."""


def generate_answer_set(
    situation_ko: str,
    cefr: str = "B1",
    k: int = 5,
    category: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    situation_ko = (situation_ko or "").strip()
    references = index.retrieve(situation_ko, k=k, category=category)
    prompt = build_answer_set_prompt(situation_ko, cefr, references)
    data = _post_json(
        "/api/chat",
        {
            "model": model or ANSWER_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False, "format": "json", "keep_alive": "30m",
            "options": {"temperature": 0.5, "num_predict": 700},
        },
        timeout=180,
    )
    content = json.loads(data["message"]["content"])
    answers = (content.get("answers") or [])[:3]
    return {"situation_ko": situation_ko, "cefr": cefr, "references": references, "answers": answers}


if __name__ == "__main__":
    # 빠른 수동 테스트: python3 rag_pipeline.py "체크인 하려는데 창가 자리로 바꿀 수 있나요?"
    import sys

    query = sys.argv[1] if len(sys.argv) > 1 else "체크인 하려는데 창가 자리로 바꿀 수 있을까요?"
    print(json.dumps(generate_answer_set(query, "B1"), ensure_ascii=False, indent=2))
