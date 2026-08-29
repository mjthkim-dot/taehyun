"""답변 유닛 — 검색이 찾아낸 '대본'을 그대로 읽을 수 있게 만든 조각.

왜 필요한가: 노트의 대부분은 한국어 S/A/R 속기다("갱신이 커머디티화될 위기").
사용자는 답변을 **그대로 읽는다**. 한국어 속기는 읽을 수 없고, LLM에 매번
영작을 시키면 (1) 느리고 (2) 매번 문장이 달라지고 (3) 숫자가 흔들린다.

그래서 노트마다 **미리 검수한 영어 판본**을 얹는다. 검색이 그 노트를 1순위로
집으면 LLM을 부르지 않고 그대로 내보낸다 — 지연 ~0, 환각 0, 문장 고정.

파일은 backend/data/imported/answer_units.json (gitignore 대상 — 개인 자료다).
노트 제목으로 잇기 때문에 코퍼스를 --replace로 재적재해도 유지된다.

스키마 (항목 1개):
  note_title      잇는 노트 제목. 접두 일치로 찾는다(제목이 길어져도 버틴다).
  answer_en_30s   30초 판본 — 기본으로 읽는 문장.
  answer_en_90s   90초 판본 — 더 파고들 때(선택).
  intent_tags     이 유닛이 답하는 질문 유형. **게이트로 쓰인다**(아래 참고).
  key_numbers     이 답변이 말해도 되는 수치. 여기 없는 숫자는 말하지 않는다.
  gist            한 줄 요지(한국어) — 카드 상단에 뜬다.
  strategy        말하기 전략(한국어) — 어디에 힘을 줄지.
  reviewed        사용자가 검수했는가. false면 Tier A로 내보내지 않는다.
"""
from __future__ import annotations

import json
import os
import pathlib
import threading

UNITS_PATH = pathlib.Path(os.environ.get(
    "UNITS_PATH",
    pathlib.Path(__file__).parent / "data" / "imported" / "answer_units.json"))

# 미검수 유닛도 내보낼지 — 리허설용 탈출구. 기본은 끈다(그대로 읽히기 때문).
ALLOW_UNREVIEWED = os.environ.get("UNITS_ALLOW_UNREVIEWED", "0") == "1"

_lock = threading.Lock()
_cache: dict | None = None
_mtime: float = -1.0


def _norm(title: str) -> str:
    return " ".join((title or "").split()).lower()


def load(force: bool = False) -> list[dict]:
    """유닛을 읽는다. 파일이 바뀌면 자동 재적재(수동 동기화와 별개로 값싸다)."""
    global _cache, _mtime
    with _lock:
        try:
            mt = UNITS_PATH.stat().st_mtime
        except OSError:
            _cache, _mtime = [], -1.0
            return []
        if _cache is not None and not force and mt == _mtime:
            return _cache
        try:
            data = json.loads(UNITS_PATH.read_text(encoding="utf-8"))
            assert isinstance(data, list)
        except (json.JSONDecodeError, OSError, AssertionError):
            # 깨진 파일 하나가 면접을 망치면 안 된다 — 유닛 없이 계속 간다.
            _cache, _mtime = [], mt
            return []
        _cache, _mtime = data, mt
        return data


def matches_intent(query: str, unit: dict) -> bool:
    """이 대본이 **이 질문에 답하는가**. 어휘 겹침과는 다른 신호다.

    왜 필요한가(실측): 노트 하나가 서로 다른 의도의 질문에 동시에 1순위로 잡힌다.
    "네트워크 없이 파이프라인 만들기"는
      · "How do you find brand new customers from scratch?"  → 맞다
      · "What does your outbound motion look like day to day?" → 틀리다
    둘 다 어휘는 충분히 겹친다. 그래서 어휘 게이트(match_terms)만으로는 못 가른다.
    뒤엣것에 이 대본을 읽으면 "제 네트워크를 못 쓴다면…"으로 시작하는데,
    묻지도 않은 가정에 답하는 셈이라 회피로 들린다.

    판정은 **구(phrase) 단위 완전 일치**다. 낱말 하나만 겹쳐도 여는 방식은
    같은 실수를 반복한다("outbound"만 겹친 위 사례).
    """
    q = " " + " ".join((query or "").lower().replace("?", " ").replace(",", " ").split()) + " "
    for tag in unit.get("intent_tags") or []:
        t = " ".join(str(tag).lower().split())
        if t and f" {t} " in q:
            return True
    return False


def find(title: str) -> dict | None:
    """노트 제목으로 유닛을 찾는다. 검수 안 된 유닛은 돌려주지 않는다."""
    t = _norm(title)
    if not t:
        return None
    for u in load():
        nt = _norm(u.get("note_title", ""))
        if not nt:
            continue
        if t == nt or t.startswith(nt) or nt.startswith(t):
            if u.get("reviewed") or ALLOW_UNREVIEWED:
                return u
            return None
    return None


def stats() -> dict:
    """진단용 — /health와 자료 탭에 띄운다."""
    us = load()
    return {"total": len(us),
            "reviewed": sum(1 for u in us if u.get("reviewed")),
            "path": str(UNITS_PATH)}
