"""
발언 제안 프롬프트 — 검색된 내 자료에 근거해 '내가 실제로 말할 법한' 문장을 만든다.

이 앱의 차별점이 여기 있다. 일반 번역기·범용 코파일럿과 달리
 · 내 수업 노트에서 배운 표현을 우선 쓰고
 · 내 과거 미팅에서 실제로 쓴 말투를 따르고
 · 용어집의 정확한 도메인 단어를 쓴다
지어내기는 금지다 — 자료에 없는 수치·고객사명은 만들지 않는다.
"""
from __future__ import annotations

import re

import rag

# 퀵 액션 의도
INTENTS = {
    "reply": "Respond directly to what was just said.",
    "agree": "AGREE and reinforce it with one concrete supporting point.",
    "pushback": "Politely PUSH BACK with one respectful, concrete reason.",
    "ask": "ASK one sharp clarifying question about what was just said.",
    "propose": "Propose one concrete next step.",
    "buytime": "Buy a few seconds gracefully while staying in control — "
               "acknowledge, restate what you heard, and signal you're about to answer.",
}

_PLACEHOLDER = re.compile(r"\[[^\]\n]{1,30}\]")


def _evidence_block(hits: list[dict]) -> tuple[str, list[str]]:
    if not hits:
        return "(no personal material retrieved — keep the reply generic and safe)", []
    lines, labels = [], []
    for h in hits:
        lines.append(f"[{h['source_label']} · {h['title']}]\n{h['text'][:600]}")
        labels.append(f"{h['source_label']}: {h['title']}")
    return "\n\n".join(lines), labels


def build_suggest(said: str, context: str = "", intent: str = "reply",
                  cefr: str = "B1", k: int = 6) -> dict:
    """검색 → 프롬프트. 반환에 근거(sources)를 함께 실어 UI가 표시할 수 있게 한다."""
    query = f"{context}\n{said}".strip()[-800:] if context else said
    hits = rag.search(query, k=k)
    evidence, labels = _evidence_block(hits)
    # [대괄호] 미입력 표기는 사용자가 직접 쓰는 노트·용어집의 규약이다.
    # 트랜스크립트는 그런 규약이 없으므로 대괄호가 있어도 경고하지 않는다(오탐 방지).
    has_ph = any(_PLACEHOLDER.search(h["text"])
                 for h in hits if h["source"] in ("note", "glossary"))
    goal = INTENTS.get(intent, INTENTS["reply"])
    ctx = (f"\nRecent meeting transcript (for resolving references):\n\"\"\"{context}\"\"\"\n"
           if context.strip() else "")

    prompt = f"""You are a real-time meeting copilot for a Korean cloud-sales professional
who is IN A LIVE English business meeting RIGHT NOW. Speed matters — they are about to speak.
{ctx}
The other side just said:

"{said}"

Their goal right now: {goal}
Their spoken English level: CEFR {cefr} — the sentences must be comfortably sayable at that level.

THEIR OWN MATERIAL (retrieved from their study notes, past meeting transcripts and
domain glossary — this is the whole point: make them sound like themselves, not like a
translation engine):
\"\"\"{evidence}\"\"\"

How to use the material:
- If a study note gives a phrase for this exact situation, USE that phrase.
- If a past transcript shows how they actually phrase things, match that rhythm.
- If the glossary has the precise domain term, use it instead of a vague word.

TRUTHFULNESS (they will say this out loud to a real customer):
- Use ONLY numbers, company names and commitments that appear in the material above.
- NEVER invent a figure, a customer name, or a promise. If a value is missing,
  speak qualitatively ("a significant share", "a major account").

Respond in EXACTLY this format (plain text, no markdown), nothing else —
the first EN line MUST come first so they can start speaking immediately:
EN: <Option 1 — short and safe, 15-30 words>
KR: <자연스러운 한국어 번역>
===
EN: <Option 2 — stronger, uses a specific term or example from the material, 35-60 words>
KR: <자연스러운 한국어 번역>
===
META: 요지=<상대 발언의 핵심 한국어 한 줄> | 전략=<지금 말하기 전략 한국어 한 줄>

Rules for the EN options:
- First person, natural spoken business English, contractions, a light opener
  ("Sure —", "That's fair,", "Good question —").
- The two options must take different angles, not paraphrases of each other.
- No bullet points inside EN — it has to flow as speech."""
    return {"prompt": prompt, "sources": labels, "hits": hits,
            "has_placeholder": has_ph}


TRANSLATE_SYSTEM = """You translate a live business meeting for a Korean professional.
Detect the language: English → natural Korean, Korean → natural spoken English.
Keep it concise and idiomatic. Reply with ONLY the translation."""


def build_summary(transcript: str, mode: str = "line") -> str:
    if mode == "line":
        return f"""Below is the live transcript of an ongoing English business meeting.

Transcript (most recent last):
\"\"\"{transcript}\"\"\"

지금 대화의 핵심을 한국어 한 문장(40자 이내)으로 요약하세요.
문장 하나만 출력하고 다른 말은 붙이지 마세요."""
    return f"""Below is the transcript of an English business meeting (cloud sales).

Transcript:
\"\"\"{transcript}\"\"\"

한국어로 정리해 주세요 (마크다운 헤더 없이, 전체 150단어 이내):
📌 논의 요점: (불릿 2~4개)
🤝 내가 한 약속: (불릿 0~3개 — 없으면 '없음')
✅ 후속 액션: (불릿 1~3개, 담당이 나인 것 위주)
🗣 다음에 쓸 표현: (이번 대화에서 막혔던 부분을 영어 문장 1~2개로)"""
