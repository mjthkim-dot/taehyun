"""결정론적 발화 지표 — 모델 호출 없이 계산 (WPM, 군말 비율). 의존성 0."""
from __future__ import annotations

import re

FILLERS = re.compile(r"\b(um+|uh+|er+|like|you know|i mean|kind of|sort of|well)\b", re.I)


def deterministic_metrics(transcript: str, duration_sec: float | None) -> dict[str, float]:
    words = re.findall(r"[A-Za-z']+", transcript or "")
    n = len(words)
    fillers = len(FILLERS.findall(transcript or ""))
    filler_ratio = (fillers / n) if n else 0.0
    wpm = (n / (duration_sec / 60.0)) if duration_sec and duration_sec > 0 else None
    return {
        "word_count": float(n),
        "filler_ratio": round(filler_ratio, 3),
        "wpm": round(wpm, 1) if wpm else None,
    }
