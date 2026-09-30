"""모의 면접 (v6.5) — 질문 세트와 결과 기록.

실전과 같은 경로를 탄다: 면접관 질문을 TTS 음성으로 만들어 브라우저 오디오 그래프로
흘리면, 실시간 인식(Gemini Live) → 자막 → 질문 감지 → 답변 카드가 그대로 돈다.
그래서 여기서 재는 지연은 텍스트 주입 테스트가 한 번도 재지 못한
"면접관이 말을 끝낸 뒤 읽을 문장이 뜨기까지"다.

질문 구성: 오프너 1 → (공통 + 지원 회사 골든) 섞어서 → 후속 질문 1~2 → 마무리 1.
후속 질문은 일부러 넣는다 — 자료에 없는 숫자를 묻는 후속에서 날조가 가장 잦았다(§60).
"""
from __future__ import annotations

import json
import os
import random
import time
from pathlib import Path

import company

OPENER = "Thanks for joining today. To start, could you tell me a little about yourself?"
CLOSER = "We're almost out of time. Do you have any questions for me?"

# 회사와 무관한 영업직 면접 단골 — {{COMPANY}}는 지금 회사 이름으로 바뀐다
CORE = [
    "Walk me through the biggest deal you've closed, end to end.",
    "How do you build pipeline when you're starting from scratch?",
    "Tell me about a deal you lost. What did you learn from it?",
    "What does your sales process look like, from first call to close?",
    "Why {{COMPANY}}, and why now?",
    "What would your first ninety days look like here?",
    "How do you keep a manager in another time zone informed about your deals?",
    "Tell me about a time you had to win over a skeptical executive.",
    "What are your compensation expectations?",
    "How do you work with partners to close a deal?",
]

# (앞 질문에 붙는 후속) — 자료에 없는 수치·사유를 캐묻는 유형
FOLLOWUPS = {
    "Walk me through the biggest deal you've closed, end to end.":
        "How long did that deal take from first meeting to signature?",
    "Tell me about a deal you lost. What did you learn from it?":
        "What specifically did you change in your approach after that?",
    "How do you build pipeline when you're starting from scratch?":
        "What's your typical conversion rate from first meeting to opportunity?",
    "Tell me about a time you had to win over a skeptical executive.":
        "What was the one thing that finally changed their mind?",
}

_DIR = Path(os.environ.get("MC_DATA_DIR") or (Path(__file__).parent / "data")) / "mock"


def questions(n: int = 7, seed: int | None = None) -> list[dict]:
    """n = 오프너·마무리 포함 총 문항 수(3~15)."""
    n = max(3, min(15, int(n)))
    rnd = random.Random(seed)
    nm = company.name() or "your company"
    sub = lambda t: t.replace("{{COMPANY}}", nm)
    comp = [sub(str(g.get("q"))) for g in (company.data().get("golden") or []) if g.get("q")]
    pool = [sub(q) for q in CORE]
    rnd.shuffle(pool)
    rnd.shuffle(comp)
    body_n = n - 2
    # 회사 질문을 절반까지 섞는다(회사 파일이 있으면) — 실제 HM 면접의 비율
    k_comp = min(len(comp), body_n // 2)
    picked = comp[:k_comp] + pool[:body_n - k_comp]
    rnd.shuffle(picked)
    out = [{"q": OPENER, "kind": "opener"}]
    fu_left = 2 if body_n >= 5 else 1
    for q in picked:
        if len(out) >= n - 1:
            break
        out.append({"q": q, "kind": "company" if q in comp else "core"})
        raw = next((c for c in CORE if sub(c) == q), None)
        if fu_left and raw in FOLLOWUPS and len(out) < n - 1:
            out.append({"q": FOLLOWUPS[raw], "kind": "followup"})
            fu_left -= 1
    out.append({"q": CLOSER, "kind": "closer"})
    return out


def save(report: dict) -> str:
    _DIR.mkdir(parents=True, exist_ok=True)
    name = time.strftime("%Y%m%d-%H%M%S") + ".json"
    report = {**report, "saved_at": time.strftime("%Y-%m-%d %H:%M"), "company": company.slug()}
    (_DIR / name).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    return name


def history(limit: int = 10) -> list[dict]:
    """최근 세션 요약 — 연습이 쌓이며 지연·말하기 속도가 어떻게 변하는지."""
    if not _DIR.is_dir():
        return []
    out = []
    for f in sorted(_DIR.glob("*.json"), reverse=True)[:limit]:
        try:
            r = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        out.append({"file": f.name, "saved_at": r.get("saved_at"), "company": r.get("company"),
                    "summary": r.get("summary") or {}})
    return out
