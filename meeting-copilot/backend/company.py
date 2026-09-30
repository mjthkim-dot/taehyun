"""지원 회사 레이어 — 런타임 (v6.5).

왜 필요한가: v6.0에서 자료를 core(회사 무관)와 company(회사 전용)로 나눴지만,
그 구분은 **임포터**만 알고 있었다. 서버는 지금 어느 회사 면접인지 몰랐다.
그래서 회사를 바꿔도
  · 워카토 전용 대본("Why Workato…")이 다른 회사 면접에서 그대로 읽힐 수 있었고
  · iPaaS 시드 용어집이 항상 적재돼 검색이 자동화 쪽으로 끌렸고
  · 질의 확장·음성 인식 어휘에 회사명이 코드로 박혀 있었다.
이 모듈이 "지금 어느 회사인가"와 그 회사의 어휘·금지어를 한곳에서 답한다.

파일 (전부 backend/data/imported/ 아래, gitignore — 개인 자료):
  ACTIVE_COMPANY              지금 지원 중인 회사 slug (한 줄)
  company/<slug>.json         회사 파일. 아래 키는 전부 선택:
     company       {"name", "aliases": [...]}          회사명·별칭
     domain_packs  ["ipaas", ...]                       이 회사에 맞는 시드 묶음.
                   키가 없으면 전부 적재(옛 파일 하위 호환)
     vocab         ["Genie", ...]                       음성 인식 어휘
     name_fixes    [["\\bwalkato\\b", "Workato"], ...]  오인식 교정(정규식, 대소문자 무시)
     triggers      [["\\bproduct line\\b", "어휘 …"], ...] 질의 확장
     units         [...]                                 회사 전용 대본(answer_units 스키마)
     notes / links / golden / unit_ok                    (임포터·골든셋이 쓴다)
  vocab.json                  회사와 무관한 개인 어휘 — 고객사명 등 **코드에 둘 수 없는 것**.
     {"stt_vocab": [...], "name_fixes": [[pat, repl], ...],
      "companies": {"<slug>": {"vocab": [...], "name_fixes": [...], "triggers": [...]}}}

회사 우선순위: 환경변수 INTERVIEW_COMPANY > ACTIVE_COMPANY 파일 > company/ 첫 파일.
"""
from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path

IMP = Path(os.environ.get("MC_IMPORTED_DIR") or (Path(__file__).parent / "data" / "imported"))

_lock = threading.Lock()
_cache: dict[str, tuple[float, dict]] = {}


def _read_json(path: Path) -> dict:
    """mtime 캐시로 읽는다. 깨진 파일은 빈 dict — 면접을 멈추게 하지 않는다."""
    try:
        mt = path.stat().st_mtime
    except OSError:
        return {}
    key = str(path)
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] == mt:
            return hit[1]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            data = {}
    except (OSError, json.JSONDecodeError):
        data = {}
    with _lock:
        _cache[key] = (mt, data)
    return data


def available() -> list[str]:
    d = IMP / "company"
    return sorted(p.stem for p in d.glob("*.json")) if d.is_dir() else []


def slug() -> str:
    env = os.environ.get("INTERVIEW_COMPANY", "").strip()
    if env:
        return env
    f = IMP / "ACTIVE_COMPANY"
    try:
        v = f.read_text(encoding="utf-8").strip()
        if v:
            return v
    except OSError:
        pass
    av = available()
    return av[0] if av else ""


def data(s: str | None = None) -> dict:
    s = slug() if s is None else s
    return _read_json(IMP / "company" / f"{s}.json") if s else {}


def _private() -> dict:
    return _read_json(IMP / "vocab.json")


def name(s: str | None = None) -> str:
    s = slug() if s is None else s
    c = data(s).get("company") or {}
    return (c.get("name") or s or "").strip()


def names(s: str | None = None) -> list[str]:
    """회사명 + 별칭 (중복 없이, 원래 표기)."""
    s = slug() if s is None else s
    c = data(s).get("company") or {}
    out: list[str] = []
    for n in [name(s), *(c.get("aliases") or [])]:
        n = str(n).strip()
        if n and n.lower() not in {x.lower() for x in out}:
            out.append(n)
    return out


def others() -> list[str]:
    """지금 회사가 아닌, 다른 지원 회사들의 이름·별칭.

    면접에서 다른 회사 이름을 말하는 건 치명적이다("Why Workato"를 다른 회사에서).
    지금 회사 이름과 겹치는 이름(모회사·제품군 공유 등)은 뺀다."""
    cur = slug()
    mine = {n.lower() for n in names(cur)}
    out: list[str] = []
    for s in available():
        if s == cur:
            continue
        for n in names(s):
            if n.lower() not in mine and n.lower() not in {x.lower() for x in out}:
                out.append(n)
    return out


def _word_rx(words: list[str]) -> re.Pattern | None:
    ws = [w for w in words if w and len(w) >= 2]
    if not ws:
        return None
    alt = "|".join(re.escape(w) for w in sorted(ws, key=len, reverse=True))
    return re.compile(rf"(?<![A-Za-z0-9])(?:{alt})(?![A-Za-z0-9])", re.I)


def mentions_other(text: str) -> list[str]:
    """글에 **다른** 지원 회사 이름이 나오면 그 이름들을 돌려준다."""
    rx = _word_rx(others())
    if not rx or not text:
        return []
    seen: list[str] = []
    for m in rx.finditer(text):
        w = m.group(0)
        if w.lower() not in {x.lower() for x in seen}:
            seen.append(w)
    return seen


def domain_packs() -> list[str] | None:
    """이 회사에 적재할 시드 묶음. None = 키 없음 → 전부(옛 회사 파일 하위 호환)."""
    d = data()
    if "domain_packs" not in d:
        return None
    return [str(x) for x in (d.get("domain_packs") or [])]


def vocab() -> list[str]:
    """음성 인식 커스텀 어휘 — 개인(vocab.json) + 회사 파일 + vocab.json의 회사 절."""
    p = _private()
    s = slug()
    out: list[str] = []
    for src in (p.get("stt_vocab") or [],
                ((p.get("companies") or {}).get(s) or {}).get("vocab") or [],
                names(s),
                data(s).get("vocab") or []):
        for w in src:
            w = str(w).strip()
            if w and w not in out:
                out.append(w)
    return out


def name_fixes() -> list[list[str]]:
    """오인식 교정 [정규식, 바꿀 말] — 브라우저가 받아 자막에 적용한다."""
    p = _private()
    s = slug()
    out: list[list[str]] = []
    for src in (p.get("name_fixes") or [],
                ((p.get("companies") or {}).get(s) or {}).get("name_fixes") or [],
                data(s).get("name_fixes") or []):
        for it in src:
            if isinstance(it, (list, tuple)) and len(it) == 2:
                try:
                    re.compile(str(it[0]))
                except re.error:
                    continue                    # 깨진 패턴 하나가 전체를 막지 않게
                out.append([str(it[0]), str(it[1])])
    return out


def triggers() -> list[tuple[str, str]]:
    """질의 확장 규칙 — 회사 파일 + vocab.json의 회사 절(옛 회사 파일 보강용)."""
    out = []
    extra = ((_private().get("companies") or {}).get(slug()) or {}).get("triggers") or []
    for it in list(data().get("triggers") or []) + list(extra):
        if isinstance(it, (list, tuple)) and len(it) == 2:
            try:
                re.compile(str(it[0]))
            except re.error:
                continue
            out.append((str(it[0]), str(it[1])))
    return out


def units() -> list[dict]:
    u = data().get("units") or []
    return [x for x in u if isinstance(x, dict)]


def summary() -> dict:
    return {"slug": slug(), "name": name(), "aliases": names()[1:],
            "available": available(), "others": others(),
            "domain_packs": domain_packs(), "vocab": len(vocab()),
            "name_fixes": len(name_fixes()), "units": len(units())}
