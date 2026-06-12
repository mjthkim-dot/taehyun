"""
═══════════════════════════════════════════════════════════════
 AI CAF 엔진 — Complexity · Accuracy · Fluency 분석 파이프라인
 (LangChain + Ollama)

 입력 : STT 트랜스크립트 + 사용자 CEFR 레벨 (+ 선택: 발화 시간)
 출력 : 정오답 판별이 아닌 ──
        · CAF 3축 점수 (각 0~10)
        · 문법 오류 태깅 (tense/agreement/article/preposition...)
        · CEFR +1 레벨 '세련된 대체 구문(paraphrase)'

 설계: 단일 구조화 프롬프트(JSON 강제) 1콜 → 저지연.
       LangChain의 PromptTemplate + JsonOutputParser로 체인 구성.
       LangChain 미설치 환경을 위해 httpx 직접 폴백 제공.
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("CAF_MODEL", "gemma3:27b")

# CEFR → 한 단계 위 (paraphrase 목표 레벨)
CEFR_NEXT = {"A1": "A2", "A2": "B1", "B1": "B2", "B2": "C1", "C1": "C2", "C2": "C2"}

# Filler words (유창성 감점 요소)
FILLERS = re.compile(r"\b(um+|uh+|er+|like|you know|i mean|kind of|sort of|well)\b", re.I)


# ─────────────────────────────────────────────────────────────
#  프롬프트 빌더 (LangChain / 폴백 양쪽 공유)
# ─────────────────────────────────────────────────────────────
def build_caf_prompt(transcript: str, cefr: str, wpm: float | None) -> str:
    target = CEFR_NEXT.get(cefr, "B1")
    wpm_line = f"- 측정된 발화 속도(WPM): {wpm:.0f}" if wpm else "- 발화 속도: 미측정(텍스트만으로 추정)"
    return f"""You are an expert CEFR-certified speech examiner running a CAF
(Complexity, Accuracy, Fluency) analysis. Analyze the learner's English speech.

Learner CEFR level: {cefr}
Paraphrase target level (one step up): {target}
{wpm_line}

Learner transcript:
\"\"\"{transcript}\"\"\"

Return ONLY valid JSON (no markdown) with this exact shape:
{{
  "complexity": <0-10 float: clause variety, subordination, lexical range>,
  "accuracy":   <0-10 float: grammatical correctness; deduct for errors>,
  "fluency":    <0-10 float: flow, low filler use, sentence completeness>,
  "error_density": <errors per 100 words, float>,
  "errors": [
    {{"wrong": "...", "right": "...", "type": "tense|agreement|article|preposition|word-choice|other", "why_ko": "한국어로 한 줄 설명"}}
  ],
  "paraphrases": [
    {{"original": "learner phrase", "upgraded": "{target}-level natural rephrasing", "note_ko": "왜 더 세련됐는지 한국어로"}}
  ],
  "summary_ko": "한국어로 2문장 총평 (격려 톤)"
}}

Rules:
- Max 3 errors (most important first), max 3 paraphrases.
- "upgraded" must be natural {target}-level English, NOT just longer.
- If transcript is too short/empty, still return the JSON with low scores and empty arrays."""


# ─────────────────────────────────────────────────────────────
#  결정론적 보조 지표 (모델 호출 없이 계산 → fluency 보정)
# ─────────────────────────────────────────────────────────────
def deterministic_metrics(transcript: str, duration_sec: float | None) -> dict[str, float]:
    words = re.findall(r"[A-Za-z']+", transcript)
    n = len(words)
    fillers = len(FILLERS.findall(transcript))
    filler_ratio = (fillers / n) if n else 0.0
    wpm = (n / (duration_sec / 60.0)) if duration_sec and duration_sec > 0 else None
    return {
        "word_count": float(n),
        "filler_ratio": round(filler_ratio, 3),
        "wpm": round(wpm, 1) if wpm else None,
    }


def _coerce_scores(data: dict[str, Any]) -> dict[str, Any]:
    """모델 출력 방어적 정규화 — 점수 0~10 클램프, 필수 키 보장."""
    def clamp(v, lo=0.0, hi=10.0):
        try:
            return max(lo, min(hi, float(v)))
        except (TypeError, ValueError):
            return 0.0

    return {
        "complexity": round(clamp(data.get("complexity", 0)), 1),
        "accuracy": round(clamp(data.get("accuracy", 0)), 1),
        "fluency": round(clamp(data.get("fluency", 0)), 1),
        "error_density": clamp(data.get("error_density", 0), 0, 100),
        "errors": (data.get("errors") or [])[:3],
        "paraphrases": (data.get("paraphrases") or [])[:3],
        "summary_ko": str(data.get("summary_ko", "")).strip(),
    }


# ─────────────────────────────────────────────────────────────
#  LangChain 체인 (있으면 사용)
# ─────────────────────────────────────────────────────────────
def _run_langchain(prompt: str, model: str) -> dict[str, Any]:
    from langchain_ollama import ChatOllama
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import JsonOutputParser

    llm = ChatOllama(
        base_url=OLLAMA_URL, model=model, format="json", temperature=0.3,
        keep_alive="30m", num_predict=700,
    )
    chain = (
        ChatPromptTemplate.from_messages([("human", "{p}")])
        | llm
        | JsonOutputParser()
    )
    return chain.invoke({"p": prompt})


# ─────────────────────────────────────────────────────────────
#  httpx 직접 폴백 (LangChain 미설치 시)
# ─────────────────────────────────────────────────────────────
def _run_httpx(prompt: str, model: str) -> dict[str, Any]:
    import httpx

    r = httpx.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False, "format": "json", "keep_alive": "30m",
            "options": {"temperature": 0.3, "num_predict": 700},
        },
        timeout=120,
    )
    r.raise_for_status()
    content = r.json()["message"]["content"]
    return json.loads(content)


# ─────────────────────────────────────────────────────────────
#  공개 진입점
# ─────────────────────────────────────────────────────────────
def analyze_caf(
    transcript: str,
    cefr: str = "A2",
    duration_sec: float | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """STT 트랜스크립트 → CAF 분석 결과 dict."""
    model = model or DEFAULT_MODEL
    transcript = (transcript or "").strip()
    metrics = deterministic_metrics(transcript, duration_sec)

    if metrics["word_count"] < 3:
        return {
            **_coerce_scores({}),
            "metrics": metrics,
            "summary_ko": "분석할 발화가 너무 짧아요. 한두 문장 더 말해 보세요!",
        }

    prompt = build_caf_prompt(transcript, cefr, metrics.get("wpm"))
    try:
        raw = _run_langchain(prompt, model)
    except ImportError:
        raw = _run_httpx(prompt, model)

    result = _coerce_scores(raw)
    result["metrics"] = metrics
    # 결정론적 fluency 보정: filler가 많으면 모델 점수를 살짝 끌어내림
    if metrics["filler_ratio"] > 0.1:
        result["fluency"] = round(max(0.0, result["fluency"] - metrics["filler_ratio"] * 10), 1)
    return result


if __name__ == "__main__":
    # 빠른 수동 테스트:  python backend/caf_pipeline.py "I go to gym a lot um and I eat..."
    import sys
    text = sys.argv[1] if len(sys.argv) > 1 else "Yesterday I go to the store and buy some apple."
    print(json.dumps(analyze_caf(text, "A2", duration_sec=12), ensure_ascii=False, indent=2))
