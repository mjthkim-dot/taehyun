#!/usr/bin/env python3
"""근거 확인(grounding) 평가 — 가상 인물 픽스처 + 실제 생성 + 심은 날조문.

  GEMINI_API_KEY=... python3 tests/grounding_eval.py

세 가지를 잰다:
  1) 재현율 — 일부러 심은 날조 문장(고객사·사유·도구·기간)을 잡는가
  2) 오탐 — 노트를 바꿔 말한 문장·일반적인 방법론 문장을 잡지 않는가
  3) 실제 생성 — 후속 질문(사유·사람·도구·기간을 캐묻는)에 대한 실제 답에서 무엇을 잡는가(사람이 읽고 판정)
통과 기준: 심은 날조 재현율 ≥ 80%, 통제 문장 오탐 0.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if not os.environ.get("GEMINI_API_KEY"):
    sys.exit("GEMINI_API_KEY가 필요합니다")
TMP = Path(tempfile.mkdtemp(prefix="mc-ground-"))
shutil.copytree(ROOT / "tests" / "fixtures" / "imported", TMP / "imported")
(TMP / "data").mkdir()
os.environ.update({"MC_IMPORTED_DIR": str(TMP / "imported"), "MC_DATA_DIR": str(TMP / "data")})
os.environ.pop("GEMINI_URL", None)
subprocess.run([sys.executable, str(ROOT / "tools" / "import_private.py"), "--replace"],
               capture_output=True, text=True, timeout=300)
sys.path.insert(0, str(ROOT / "backend"))
import grounding  # noqa: E402
import llm  # noqa: E402
import prompts  # noqa: E402
import rag  # noqa: E402

st = rag.default_store()
profile = prompts._profile(st)


def mat(q: str) -> tuple[str, dict]:
    b = prompts.build_suggest(q, "", "reply", "B1", store=st, preset="interview")
    return grounding.material_of(b["hits"]), b


# 1·2) 심은 문장 — 기반 답 + 날조(잡혀야 함) + 통제(잡히면 안 됨)
BASE_Q = "Walk me through the biggest deal you've closed."
PLANTED = [
    ("I closed that deal with Samsung Electronics in 2023.", True),
    ("The customer almost left because our support team was too slow.", True),
    ("I used Salesforce and Gong every day to track it.", True),
    ("The whole renewal took about nine months.", True),
    ("My VP, Sarah Kim, joined the final meeting.", True),
    ("It was a three-year renewal worth twelve point four million.", False),   # 노트에 있음
    ("It was turning into a price fight, so I moved the talk to their growth plan.", False),
    ("I focus on understanding the customer's business first.", False),        # 일반 방법론
    ("Thank you for the question.", False),
    ("I would do the same thing again at Acme.", False),                        # 의도
]

print("\n■ 1·2) 심은 문장 — 재현율·오탐")
m, _ = mat(BASE_Q)
answer = " ".join(s for s, _ in PLANTED)
flags = grounding.check(answer, BASE_Q, m, profile)
flagged = {f["sentence"] for f in flags}
tp = sum(1 for s, bad in PLANTED if bad and s in flagged)
fp = [(s, next(f["why"] for f in flags if f["sentence"] == s)) for s, bad in PLANTED if not bad and s in flagged]
nbad = sum(1 for _, bad in PLANTED if bad)
for s, bad in PLANTED:
    hit = s in flagged
    mark = ("✅" if hit else "❌") if bad else ("❌ 오탐" if hit else "✅")
    why = next((f["why"] for f in flags if f["sentence"] == s), "")
    print(f"  {mark} {'[날조]' if bad else '[통제]'} {s}" + (f"  — {why}" if why else ""))
recall = tp / nbad
print(f"  → 재현율 {tp}/{nbad} ({recall:.0%}) · 통제 오탐 {len(fp)}")

print("\n■ 3) 실제 생성 — 후속 질문이 사실을 캐물을 때")
FOLLOW = [
    "Walk me through the biggest deal you've closed.",
    "Why did the customer almost go with a competitor on that deal?",
    "Who was the executive sponsor on that deal?",
    "What tools do you use to manage your pipeline?",
    "How long did that renewal take from first meeting to signature?",
    "Tell me about a deal you lost. Why exactly did you lose it?",
]
for q in FOLLOW:
    m, b = mat(q)
    if b["tier"] != "B":
        print(f"  · {q}  [{b['tier']}] — 생성 안 함")
        continue
    out = llm.chat_once([{"role": "user", "content": b["prompt"]}], temperature=0.4, max_tokens=900)
    en = out.split("EN:", 1)[-1].split("===")[0].split("\nKR:")[0].strip()
    fl = grounding.check(en, q, m, profile)
    print(f"\n  Q: {q}\n  A: {grounding.sentences(en)}")
    for f in fl:
        print(f"     ⚠️ {f['sentence']}  — {f['why']}")
    if not fl:
        print("     (표시 없음)")

shutil.rmtree(TMP, ignore_errors=True)
ok = recall >= 0.8 and not fp
print(f"\n{'✅ 통과' if ok else '❌ 기준 미달'} — 재현율 {recall:.0%} (기준 80%) · 통제 오탐 {len(fp)} (기준 0)")
sys.exit(0 if ok else 1)
