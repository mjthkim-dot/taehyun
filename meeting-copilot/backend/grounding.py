"""근거 확인 (v6.5) — 생성된 답변에서 '자료에 없는 구체적 주장'이 든 문장을 찾는다.

왜 필요한가: 숫자는 허용 목록 + 풀어 쓴 수 검증(numwords)으로 잡는다. 그런데 후속
질문에서 가장 흔한 날조는 숫자가 아니라 **사유·사건·고유명사**였다(§60 실측:
"why did they leave?"에 지어낸 이유를 절반쯤 말했다). 화면 문장은 그대로 읽히므로
지어낸 사유는 곧 거짓 경력 진술이다.

동작: 본답변 스트림이 끝난 뒤 빠른 모델(fast 레인)이 문장마다 판정한다.
  · 표시하는 것 — 내 과거에 대한 구체적 사실 주장인데 노트·프로필에 근거가 없는 것:
    고객사·회사·사람·팀 이름, 특정 사건·결과, 무엇이 왜 일어났는지(사유), 쓴 도구·제품,
    날짜·기간, 수상
  · 표시하지 않는 것 — 의견·의도·일반적인 방법론("I focus on…"), 인사말, 질문 되받기,
    노트를 바꿔 말한 것
화면에서는 그 문장 조각에 점선 밑줄 + "건너뛰어도 됩니다". 읽기 시작을 늦추지 않는다
(스트림이 끝난 뒤 약 0.7초에 도착 — 사용자는 위에서부터 읽고 있다).
"""
from __future__ import annotations

import json
import re

import llm

_SENT = re.compile(r"(?<=[.!?])\s+")

PROMPT = """You check a job candidate's spoken interview answer against their own notes.

Flag a sentence ONLY if it states a SPECIFIC FACT ABOUT THE CANDIDATE'S OWN PAST that
the NOTES and PROFILE below do not support. Specific facts are:
 - a named customer, company, person, or team they worked with
 - a specific event, deal, project, or outcome ("we won the renewal", "the CFO signed")
 - a REASON why something happened ("they left because the price was too high")
 - a tool, product, or method they claim to have used
 - a date, duration, frequency, or award

Do NOT flag:
 - opinions, intentions, plans, or what they WOULD do ("I would start by…")
 - general descriptions of how they work ("I focus on clear updates", "I build trust")
 - polite phrases, thanks, restating the question, questions back to the interviewer
 - facts about the interviewer's company that are general knowledge or in the notes
 - paraphrases or simplifications of something the notes DO say
When unsure, do NOT flag. False alarms make the candidate stop mid-sentence.

QUESTION: {question}

PROFILE:
\"\"\"{profile}\"\"\"

NOTES:
\"\"\"{material}\"\"\"

ANSWER SENTENCES:
{sentences}

Return JSON only: {{"flag": [{{"i": <sentence number>, "why": "<Korean, 4-10 words>"}}]}}
Return {{"flag": []}} if nothing is unsupported."""


def sentences(en: str) -> list[str]:
    clean = re.sub(r"\s*/\s*", " ", en or "")
    clean = re.sub(r"\s{2,}", " ", clean).strip()
    return [s.strip() for s in _SENT.split(clean) if len(s.strip().split()) >= 3]


def check(answer_en: str, question: str, material: str, profile: str) -> list[dict]:
    """→ [{"sentence": 원문, "why": 한국어 사유}] — 근거 없는 구체적 주장이 든 문장."""
    ss = sentences(answer_en)
    if not ss:
        return []
    listing = "\n".join(f"{i}. {s}" for i, s in enumerate(ss, 1))
    prompt = PROMPT.format(question=question[:400], profile=profile[:1500],
                           material=material[:5000] or "(none)", sentences=listing)
    out = llm.chat_once([{"role": "user", "content": prompt}], json_mode=True,
                        temperature=0.0, max_tokens=300, fast=True, kind="verify", bg=True)
    try:
        data = json.loads(out)
    except (json.JSONDecodeError, TypeError):
        m = re.search(r"\{.*\}", out or "", re.S)
        data = json.loads(m.group(0)) if m else {}
    flags = []
    for f in (data.get("flag") or []) if isinstance(data, dict) else []:
        try:
            i = int(f.get("i"))
        except (TypeError, ValueError, AttributeError):
            continue
        if 1 <= i <= len(ss):
            flags.append({"sentence": ss[i - 1], "why": str(f.get("why") or "")[:60]})
    return flags


def material_of(hits: list[dict], unit_texts: list[str] | None = None) -> str:
    parts = [f"[{h.get('title', '')}]\n{str(h.get('text', '')).split('[검색어]')[0][:700]}"
             for h in hits]
    parts += [f"[reviewed script]\n{t}" for t in (unit_texts or []) if t]
    return "\n\n".join(parts)
