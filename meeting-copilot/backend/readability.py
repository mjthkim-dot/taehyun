"""읽기 난이도 — 영어가 약한 사용자가 소리 내어 읽을 대본의 게이트.

B1 기준(CEFR): 한 문장 평균 ≤ 16단어(최장 20), 4음절 이상 어려운 단어는 문장당 0~1개,
도메인 용어(pipeline·enterprise·integration…)는 예외. 30초 판본은 ≤ 55단어,
90초 판본은 ≤ 160단어 — 비원어민이 읽는 속도(≈100~110wpm)에 맞춘 값이다.
(원어민 기준 75/225로 쓰인 원본은 실측 45초 넘게 걸렸다.)
"""
from __future__ import annotations

import re

# 어려워 보여도 이 사용자에겐 일상 용어 — 세일즈·클라우드 도메인
DOMAIN = {
    "enterprise", "integration", "automation", "orchestration", "pipeline", "opportunity",
    "opportunities", "customer", "customers", "governance", "architecture", "infrastructure",
    "modernization", "methodology", "salesforce", "megazonecloud", "megazone", "workato",
    "platform", "expansion", "renewal", "commitment", "relationship", "relationships",
    "conversation", "conversations", "presentation", "organization", "affiliates", "affiliate",
    "application", "applications", "onboarding", "prototype", "prototypes", "production",
    "security", "operations", "engineering", "technical", "commission", "accelerators",
    "transparent", "transparency", "documentation", "responsibility", "identity", "delegation",
    "qualification", "validation", "generation", "conversion", "commodity", "consultants",
    "daangn", "databricks", "analytics", "capability", "capabilities", "reliability",
    "orchestrate", "monetize", "differentiation", "acquisition", "certification", "regulation",
    "regulatory", "compliance", "prioritize", "prioritizing", "repeatable", "measurable",
    "automation", "immediately", "specifically", "financials", "valuation", "development",
    "environment", "ecosystem", "evaluation", "conversion", "individual", "operational",
    "authentication", "microservices", "kubernetes", "management", "manager", "managers",
    "experience", "everything", "anything", "everyone", "already", "usually", "actually",
    "especially", "definitely", "obviously", "honestly", "basically", "generally",
    "maturity", "execution", "verification", "diagnose", "diagnostic", "components", "component",
    "developer", "developers", "category", "environments", "environment", "completely", "operating",
    "commitment", "connectors", "connector", "delegation", "monitoring", "satisfaction", "projection",
    "identified", "identify", "analysis", "organized", "organize", "original", "authority", "authorship",
    "objections", "objection", "negotiation", "renegotiation", "procurement", "provisioning",
    "traditional", "delivery", "deliverable", "productivity",
}
_VOWELS = re.compile(r"[aeiouy]+")


def syllables(w: str) -> int:
    w = w.lower().strip("'\".,;:!?()")
    if not w:
        return 0
    n = len(_VOWELS.findall(w))
    if w.endswith("e") and not w.endswith(("le", "ee", "ye")) and n > 1:
        n -= 1
    return max(1, n)


def hard_words(text: str) -> list[str]:
    out = []
    for w in re.findall(r"[A-Za-z][A-Za-z'-]+", text):
        base = w.lower().strip("'-")
        if base in DOMAIN or "-" in w:
            continue
        if syllables(base) >= 4:
            out.append(w)
    return out


def score(text: str) -> dict:
    """{words, sentences, avg_len, max_len, hard, hard_ratio, ok}"""
    clean = text.replace(" / ", " ")
    sents = [s for s in re.split(r"(?<=[.!?])\s+", clean.strip()) if s.strip()]
    lens = [len(s.split()) for s in sents] or [0]
    words = sum(lens)
    hard = hard_words(clean)
    return {
        "words": words, "sentences": len(sents),
        "avg_len": round(words / max(1, len(sents)), 1), "max_len": max(lens),
        "hard": hard, "hard_ratio": round(len(hard) / max(1, words), 3),
    }


def check(text: str, max_words: int, max_sent: int = 16, max_hard_ratio: float = 0.04) -> list[str]:
    """B1 게이트 위반 목록. 비어 있으면 통과."""
    s = score(text)
    probs = []
    if s["words"] > max_words:
        probs.append(f"{s['words']}단어 > {max_words}")
    if s["max_len"] > max_sent + 4:
        probs.append(f"최장 문장 {s['max_len']}단어 > {max_sent + 4}")
    if s["avg_len"] > max_sent:
        probs.append(f"평균 문장 {s['avg_len']}단어 > {max_sent}")
    if s["hard_ratio"] > max_hard_ratio and len(s["hard"]) > 1:
        probs.append(f"어려운 단어 {len(s['hard'])}개 ({', '.join(s['hard'][:5])})")
    return probs
