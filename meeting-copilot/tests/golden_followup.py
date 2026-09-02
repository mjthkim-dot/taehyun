#!/usr/bin/env python3
"""후속 질문 골든셋 — HM은 첫 답변의 세부를 판다. 여기서 지어내면 들킨다.

기존 골든셋 40문항은 전부 '첫 질문'이라 후속 질문이 0건이었다(실측 2026-09-02).
그런데 실제 면접의 절반은 후속이고, 후속에서 모델은 자료에 없는 세부를 채운다:
  "The deal took about four months. We started in early September."   ← 자료에 없음
  "I personally generate about three to five first meetings a month"   ← 자료에 없음
  "Around thirty to forty percent"                                     ← 자료에 없음
검증기는 아라비아 숫자만 봐서 전부 통과했다. 이 스위트는 numwords로 풀어 쓴
수까지 잡아 **자료에 없는 수치가 하나라도 나오면 실패**로 친다.

실행:  GEMINI_API_KEY=… python3 tests/golden_followup.py      (실 LLM 호출)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import llm  # noqa: E402
import numwords  # noqa: E402
import prompts  # noqa: E402
import rag  # noqa: E402

# (첫 질문, [후속 질문, ...]) — 후속은 앞 답변을 맥락으로 받는다.
# expect_hedge: 자료에 답이 없는 질문 → 답변에 '모른다/확인하겠다' 신호가 있어야 한다.
FLOWS: list[tuple[str, list[dict]]] = [
    ("Walk me through the biggest deal you've closed end to end.", [
        {"q": "You said you reframed it around their growth plan — how did you actually get access to their AI team?"},
        {"q": "And how long did that whole renewal take, from first conversation to signature?", "expect_hedge": True},
        {"q": "What would you have done if the CFO had pushed back on the three-year term?"},
    ]),
    ("Tell me about a deal you lost and what you learned.", [
        {"q": "Why did that account leave in the first place?", "expect_hedge": True},
        {"q": "What specifically did you change in your approach after that?"},
    ]),
    ("How do you generate new pipeline?", [
        {"q": "Give me a number. How many first meetings do you personally generate per month?", "expect_hedge": True},
        {"q": "What's your conversion from first meeting to qualified opportunity?", "expect_hedge": True},
    ]),
    ("Tell me about yourself.", [
        {"q": "You mentioned growth came from GenAI modernization — what share of the fifty million was that?", "expect_hedge": True},
        {"q": "Which of those thirty-eight accounts is the one you'd point to as your best work?"},
    ]),
    ("What's your sales methodology?", [
        {"q": "Walk me through 'why now' on a real deal — what was the trigger?"},
        {"q": "How often does a deal fail your four checks and you walk away? Give me a rough share.", "expect_hedge": True},
    ]),
]

HEDGE = ("don't have that", "don't have the exact", "need to check", "want to give you the exact",
         "rather than guess", "not in front of me", "i'd have to", "off the top of my head",
         "i can't give you", "rough", "roughly", "approximately")


def _answer(said: str, context: str) -> tuple[str, dict]:
    b = prompts.build_suggest(said, context, "reply", "B2", store=rag.default_store(), preset="interview")
    if b["tier"] == "A":
        return prompts.build_tier_a(b["unit"])["en"], b
    if b["tier"] == "C":
        return prompts.build_tier_c(said)["en"], b
    raw = llm.chat_once([{"role": "user", "content": b["prompt"]}], False, 0.4, 2400) or ""
    return raw.split("===")[0].replace("EN:", "").strip(), b


def run(verbose: bool = False) -> int:
    st = rag.default_store()
    total = fab = hedge_miss = 0
    for first, fups in FLOWS:
        en, b = _answer(first, "")
        ctx = f"Them: {first}\nMe: {en[:400]}"
        print(f"\n▶ {first[:60]}  [{b['tier']}]")
        for f in fups:
            total += 1
            en2, b2 = _answer(f["q"], ctx)
            known = set(b2.get("known_values") or [])
            bad = numwords.unverified(en2, known)
            hedged = any(h in en2.lower() for h in HEDGE)
            marks = []
            if bad:
                fab += 1; marks.append(f"❌ 날조 수치 {bad}")
            if f.get("expect_hedge") and not hedged and not bad:
                hedge_miss += 1; marks.append("⚠️ 모른다는 신호 없음")
            mark = " ".join(marks) or "✅"
            print(f"   ↳ [{b2['tier']}] {f['q'][:62]}\n      {mark}")
            if verbose or marks:
                print(f"      {en2[:200].replace(chr(10),' ')}")
            ctx += f"\nThem: {f['q']}\nMe: {en2[:300]}"
    print(f"\n  후속 {total}건 · 날조 수치 {fab}건 · 회피 신호 누락 {hedge_miss}건")
    return 1 if fab else 0


if __name__ == "__main__":
    sys.exit(run("-v" in sys.argv))
