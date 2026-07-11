"""
═══════════════════════════════════════════════════════════════
 영어 면접 파이프라인 — IT 영업 직군 모의 면접 (맥북 로컬/Ollama, 또는 Groq)

 구성 요소:
   · 질문 은행     data/interview_bank.json — 빈출 질문 + 답변용 표현(KR↔EN)
   · 내 프로필     data/my_profile.md — 이력·성과 (수정하면 다음 요청에 자동 반영)
   · 검색 인덱스   표현 + 프로필을 Ollama 임베딩으로 색인 → 질문과 유사한 것 검색
   · 답변 생성     질문 → 프로필 근거 + 표현 은행 근거 → 30초/60초/90초 3단계 영어 답변
   · 답변 피드백   내가 말한 답변(STT 텍스트) → STAR 구조 체크 + 표현 업그레이드

 완전히 독립된 프로젝트 — 다른 앱의 코드/데이터에 의존하지 않는다.
 의존성 0 (stdlib만 사용).
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path
from typing import Any

import llm
from embeddings import EMBED_MODEL, cosine, embed
from speech_metrics import deterministic_metrics

DATA_DIR = Path(__file__).parent / "data"
BANK_PATH = DATA_DIR / "interview_bank.json"
PROFILE_PATH = DATA_DIR / "my_profile.md"
INDEX_PATH = DATA_DIR / "interview_index.json"


# ─────────────────────────────────────────────────────────────
#  질문 은행
# ─────────────────────────────────────────────────────────────
def _load_bank() -> dict:
    if not BANK_PATH.exists():
        return {"meta": {"category_labels": {}}, "questions": [], "phrases": []}
    return json.loads(BANK_PATH.read_text(encoding="utf-8"))


def list_categories() -> list[dict]:
    bank = _load_bank()
    labels = bank.get("meta", {}).get("category_labels", {})
    counts: dict[str, int] = {}
    for q in bank.get("questions", []):
        counts[q["category"]] = counts.get(q["category"], 0) + 1
    return [
        {"id": cat, "label_ko": labels.get(cat, cat), "count": n}
        for cat, n in counts.items()
    ]


def pick_question(category: str | None = None, difficulty: int | None = None,
                  exclude: list[str] | None = None) -> dict | None:
    """조건에 맞는 질문을 무작위로 하나 뽑는다. exclude로 이미 나온 질문 제외."""
    bank = _load_bank()
    exclude_set = {e for e in (exclude or []) if e}
    pool = [
        q for q in bank.get("questions", [])
        if (not category or q["category"] == category)
        and (not difficulty or q.get("difficulty") == difficulty)
        and q["id"] not in exclude_set
    ]
    if not pool:
        # 전부 소진됐으면 exclude를 풀고 다시 (무한 연습 가능하도록)
        pool = [
            q for q in bank.get("questions", [])
            if (not category or q["category"] == category)
            and (not difficulty or q.get("difficulty") == difficulty)
        ]
    if not pool:
        return None
    q = dict(random.choice(pool))
    labels = bank.get("meta", {}).get("category_labels", {})
    q["category_label_ko"] = labels.get(q["category"], q["category"])
    return q


# ─────────────────────────────────────────────────────────────
#  프로필 청크 — my_profile.md를 '섹션 + 불릿 한 줄' 단위로 쪼갠다
# ─────────────────────────────────────────────────────────────
def _profile_chunks() -> list[str]:
    if not PROFILE_PATH.exists():
        return []
    chunks: list[str] = []
    section = ""
    for raw in PROFILE_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("## "):
            section = line[3:].strip()
        elif line.startswith("- ") and len(line) > 6:
            text = line[2:].strip()
            chunks.append(f"[{section}] {text}" if section else text)
    return chunks


# ─────────────────────────────────────────────────────────────
#  검색 인덱스 — 표현 은행 + 프로필. 파일 내용 해시로 자동 재빌드.
# ─────────────────────────────────────────────────────────────
def _signature() -> str:
    h = hashlib.md5()
    h.update(EMBED_MODEL.encode())
    for p in (BANK_PATH, PROFILE_PATH):
        h.update(p.read_bytes() if p.exists() else b"")
    return h.hexdigest()


class InterviewIndex:
    def __init__(self) -> None:
        self._entries: list[dict] | None = None
        self._sig: str | None = None

    def _build_entries(self) -> list[dict]:
        entries: list[dict] = []
        for ph in _load_bank().get("phrases", []):
            text = f"{ph.get('kr', '')} / {ph.get('en', '')}"
            entries.append({"kind": "phrase", "text": text, "payload": ph})
        for chunk in _profile_chunks():
            entries.append({"kind": "profile", "text": chunk, "payload": {"kr": chunk}})
        for e in entries:
            e["embedding"] = embed(e["text"])
        return entries

    def _ensure_built(self) -> list[dict]:
        sig = _signature()
        if self._entries is not None and self._sig == sig:
            return self._entries

        if INDEX_PATH.exists():
            try:
                cached = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
                if cached.get("signature") == sig:
                    self._entries, self._sig = cached["entries"], sig
                    return self._entries
            except (json.JSONDecodeError, OSError, KeyError):
                pass

        entries = self._build_entries()
        INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        INDEX_PATH.write_text(
            json.dumps({"signature": sig, "entries": entries}, ensure_ascii=False),
            encoding="utf-8",
        )
        self._entries, self._sig = entries, sig
        return entries

    def retrieve(self, query: str, k_phrases: int = 6, k_profile: int = 4) -> dict[str, list[dict]]:
        """질문과 유사한 표현/프로필 청크를 종류별로 top-k 검색."""
        entries = self._ensure_built()
        qvec = embed(query)
        if not qvec:
            return {"phrases": [], "profile": []}
        scored: dict[str, list[tuple[float, dict]]] = {"phrase": [], "profile": []}
        for e in entries:
            scored[e["kind"]].append((cosine(qvec, e.get("embedding", [])), e))
        for lst in scored.values():
            lst.sort(key=lambda t: t[0], reverse=True)
        return {
            "phrases": [{**e["payload"], "score": round(s, 4)} for s, e in scored["phrase"][:k_phrases]],
            "profile": [{"text": e["text"], "score": round(s, 4)} for s, e in scored["profile"][:k_profile]],
        }

    def status(self) -> dict[str, Any]:
        bank = _load_bank()
        return {
            "questions": len(bank.get("questions", [])),
            "phrases": len(bank.get("phrases", [])),
            "profile_chunks": len(_profile_chunks()),
            "profile_exists": PROFILE_PATH.exists(),
            "index_built": INDEX_PATH.exists(),
            "embed_model": EMBED_MODEL,
            "provider": llm.provider(),
            "answer_model": llm.model_name(),
        }


index = InterviewIndex()


def _safe_retrieve(query: str, k_phrases: int = 6, k_profile: int = 4) -> dict[str, list[dict]]:
    """임베딩(로컬 Ollama)이 죽어 있어도 답변은 나가야 한다 —
    검색 실패 시 프로필 전체를 그대로 근거로 사용(작아서 프롬프트에 다 들어감)."""
    try:
        return index.retrieve(query, k_phrases, k_profile)
    except Exception:  # noqa: BLE001
        return {"phrases": [], "profile": [{"text": c, "score": 0.0} for c in _profile_chunks()[:14]]}


# ─────────────────────────────────────────────────────────────
#  모범 답변 생성 — 30초/60초/90초 3단계
# ─────────────────────────────────────────────────────────────
def _answers_prompt(question: str, cefr: str, refs: dict[str, list[dict]]) -> str:
    profile_lines = "\n".join(f"- {r['text']}" for r in refs["profile"]) or "- (프로필 정보 없음)"
    phrase_lines = "\n".join(
        f'- "{r["en"]}" ({r["kr"]})' for r in refs["phrases"] if r.get("en")
    ) or "- (none)"

    return f"""You are an expert English interview coach preparing a Korean candidate
for an IT sales (cloud/SaaS solution sales) job interview conducted in English.

Interview question: "{question}"
Candidate CEFR level: {cefr} (write answers the candidate can realistically speak;
the 90s version may stretch one level above)

Candidate background facts (Korean, from their profile — personalize the answers
with these; where a fact contains a placeholder like [X], substitute a plausible
round number and stay consistent across all three answers; do NOT invent
achievements that contradict these facts):
{profile_lines}

Reference expressions from an interview phrase bank (reuse them where natural):
{phrase_lines}

Write 3 versions of a strong SPOKEN answer to the interview question:
1. version "30s" — concise core answer, ~60-80 words
2. version "60s" — standard answer with one concrete example, ~120-150 words
3. version "90s" — advanced answer with clear STAR structure and numbers, ~180-220 words

Return ONLY valid JSON (no markdown) with this exact shape:
{{
  "answers": [
    {{
      "version": "30s|60s|90s",
      "en": "the full spoken answer",
      "kr_gist": "한국어로 답변 요지 1~2문장",
      "key_expressions": [{{"en": "phrase worth memorizing", "kr": "뜻"}}],
      "tip_ko": "이 버전을 말할 때의 전달 팁 한 줄 (한국어)"
    }}
  ]
}}

Rules:
- First person, natural spoken English with contractions (I'm, I've, that's).
- Sound like a native speaker in a US business setting: natural rhythm, light
  discourse markers (Well / Actually / To be honest), no textbook or
  translated-sounding phrasing.
- No bullet points inside "en" — it must flow as speech.
- key_expressions: 2-3 phrases per answer, taken FROM that answer.
- All three answers must tell a consistent story (same numbers, same facts)."""


def generate_answers(question: str, cefr: str = "B1", model: str | None = None) -> dict[str, Any]:
    question = (question or "").strip()
    refs = _safe_retrieve(question)
    content = json.loads(llm.chat_once(
        [{"role": "user", "content": _answers_prompt(question, cefr, refs)}],
        json_mode=True, temperature=0.5, max_tokens=1600, model=model,
    ))
    return {
        "question": question,
        "cefr": cefr,
        "answers": (content.get("answers") or [])[:3],
        "profile_refs": refs["profile"],
        "phrase_refs": refs["phrases"],
        "provider": llm.provider(),
    }


# ─────────────────────────────────────────────────────────────
#  내 답변 피드백 — STAR 구조 체크 + 표현 업그레이드
# ─────────────────────────────────────────────────────────────
def _feedback_prompt(question: str, transcript: str, cefr: str, metrics: dict) -> str:
    wpm = metrics.get("wpm")
    wpm_line = f"- Speaking rate: {wpm:.0f} WPM" if wpm else "- Speaking rate: not measured"
    return f"""You are an expert interview coach evaluating a Korean candidate's spoken
English answer in an IT sales job interview. Be encouraging but concrete.

Interview question: "{question}"
Candidate CEFR level: {cefr}
Measured delivery metrics:
{wpm_line}
- Filler word ratio: {metrics.get('filler_ratio', 0)}

Candidate's answer transcript:
\"\"\"{transcript}\"\"\"

Return ONLY valid JSON (no markdown) with this exact shape:
{{
  "score": <0-10 float: overall interview-answer quality>,
  "star": {{
    "situation": <true|false>, "task": <true|false>,
    "action": <true|false>, "result": <true|false>,
    "note_ko": "STAR 구조 관점 코멘트 한 줄 (한국어)"
  }},
  "good_points_ko": ["잘한 점 (한국어, 최대 2개)"],
  "improvements": [
    {{"original": "candidate's phrase", "upgraded": "more professional interview English", "note_ko": "왜 더 나은지 한국어 한 줄"}}
  ],
  "summary_ko": "한국어 2문장 총평 — 격려 톤, 다음에 시도할 것 1가지 포함"
}}

Rules:
- Max 3 improvements, most impactful first.
- "upgraded" must sound like confident interview English, not just grammar fixes.
- If the question is not behavioral (e.g. "Why our company?"), judge STAR loosely
  and say so in note_ko.
- If the transcript is very short, score low and say more detail is needed."""


def feedback(question: str, transcript: str, cefr: str = "B1",
             duration_sec: float | None = None, model: str | None = None) -> dict[str, Any]:
    transcript = (transcript or "").strip()
    metrics = deterministic_metrics(transcript, duration_sec)
    if metrics["word_count"] < 5:
        return {
            "score": 0, "star": {"situation": False, "task": False, "action": False,
                                 "result": False, "note_ko": "답변이 너무 짧아 구조를 평가할 수 없어요."},
            "good_points_ko": [], "improvements": [], "metrics": metrics,
            "summary_ko": "답변이 너무 짧아요. 최소 3~4문장으로 다시 말해 보세요!",
        }
    content = json.loads(llm.chat_once(
        [{"role": "user", "content": _feedback_prompt(question, transcript, cefr, metrics)}],
        json_mode=True, temperature=0.3, max_tokens=800, model=model,
    ))
    try:
        score = max(0.0, min(10.0, float(content.get("score", 0))))
    except (TypeError, ValueError):
        score = 0.0
    star = content.get("star") or {}
    return {
        "score": round(score, 1),
        "star": {
            "situation": bool(star.get("situation")), "task": bool(star.get("task")),
            "action": bool(star.get("action")), "result": bool(star.get("result")),
            "note_ko": str(star.get("note_ko", "")).strip(),
        },
        "good_points_ko": (content.get("good_points_ko") or [])[:2],
        "improvements": (content.get("improvements") or [])[:3],
        "summary_ko": str(content.get("summary_ko", "")).strip(),
        "metrics": metrics,
    }


# ─────────────────────────────────────────────────────────────
#  🔴 라이브 모드 — 실전 화상 면접 중 실시간 답변 제안 / 세션 요약
#  (스트리밍 출력용 프롬프트만 만들고, 실제 스트리밍은 서버가 프록시)
# ─────────────────────────────────────────────────────────────
def build_live_suggest_prompt(question: str, cefr: str = "B1", context: str = "") -> str:
    """면접관 질문 → 즉시 읽을 수 있는 짧은 답변. 저지연을 위해 답변 1개만.
    context: 직전 대화(자막 로그) — 꼬리 질문(follow-up)에 맥락 있는 답변을 위해."""
    refs = _safe_retrieve(question, k_phrases=4, k_profile=4)
    profile_lines = "\n".join(f"- {r['text']}" for r in refs["profile"]) or "- (none)"
    phrase_lines = "\n".join(f'- "{r["en"]}"' for r in refs["phrases"] if r.get("en")) or "- (none)"
    context_block = (
        "\nRecent conversation transcript (interviewer and candidate mixed; use it to"
        f" resolve what a follow-up question refers to):\n\"\"\"{context}\"\"\"\n"
        if context.strip() else ""
    )
    return f"""You are a real-time interview copilot for a Korean candidate who is IN A LIVE
English video interview for an IT sales (cloud/SaaS) position RIGHT NOW.
{context_block}
The interviewer just asked:

"{question}"

Candidate background facts (Korean; personalize with these, substitute plausible
round numbers for [placeholders], never contradict them):
{profile_lines}

Useful phrases (reuse where natural):
{phrase_lines}

Respond in EXACTLY this format, nothing else:
전략: <한국어로 답변 전략 한 줄 — 아주 짧게>
---
<A natural spoken English answer the candidate can read aloud immediately.
60-90 words, first person, confident tone, around CEFR {cefr} but natural.
Sound like a native speaker in a US business setting: contractions, natural
rhythm, a light discourse marker to open (e.g. "Well," / "That's a great
question —" / "Sure,"), absolutely no textbook or translated-sounding phrasing.
If it was a follow-up, connect to what was said before instead of repeating it.>"""


def build_live_summary_prompt(transcript: str) -> str:
    """지금까지의 면접 트랜스크립트 → 한국어 중간 요약."""
    return f"""Below is the live transcript of an ongoing English job interview
(IT sales position). It mixes the interviewer's and the candidate's speech.

Transcript:
\"\"\"{transcript}\"\"\"

한국어로 짧게 정리해 주세요 (전체 120단어 이내, 마크다운 헤더 없이):
📌 지금까지 나온 질문: (불릿 2~4개)
⚠️ 주의/보완할 점: (불릿 1~2개 — 아직 안 나왔지만 준비할 질문 예상 포함)"""


if __name__ == "__main__":
    # 수동 테스트: python3 interview_pipeline.py "Tell me about yourself."
    import sys

    q = sys.argv[1] if len(sys.argv) > 1 else "Tell me about yourself."
    print(json.dumps(generate_answers(q, "B1"), ensure_ascii=False, indent=2))
