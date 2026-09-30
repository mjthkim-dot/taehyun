#!/usr/bin/env python3
"""
Out-of-Corpus 평가 러너 (파이썬) — ooc-eval.ts와 같은 케이스를 실행하고,
결과 표를 docs/REPORT.md 13장에 기록한다 (마커 기반 멱등 갱신).

모의 LLM으로 파이프라인 로직을 검증한 뒤, 맥북에서 실 GEMINI_API_KEY로
서버를 띄우고 이 스크립트를 다시 실행하면 **같은 표가 실측값으로 갱신**된다:

    bash start.sh                      # 실 키로 서버 기동 (다른 터미널)
    python3 tests/ooc_eval.py          # → REPORT 13장이 실측 생성문으로 교체됨

케이스 정의는 ooc-eval.ts 한 곳에만 둔다 (두 벌이면 반드시 어긋난다).
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "http://localhost:3799"
TS = Path(__file__).with_name("ooc-eval.ts")
SPEAK_TS = Path(__file__).with_name("speakability.ts")
REPORT = Path(__file__).resolve().parent.parent.parent / "docs" / "REPORT.md"
MARK_S = "<!-- OOC-RESULTS:START -->"
MARK_E = "<!-- OOC-RESULTS:END -->"
EVASIVE = re.compile(r"i'?m not sure|i don'?t know|hard to say|cannot answer|no idea", re.I)


def _speak_lists() -> tuple[list[str], list[str]]:
    # 금지어·미축약 목록은 speakability.ts 한 곳에만 둔다 (케이스와 같은 원칙)
    src = SPEAK_TS.read_text(encoding="utf-8")
    def arr(name: str) -> list[str]:
        body = src.split(f"const {name} = [", 1)[1].split("];", 1)[0]
        return [m for m in re.findall(r'"([^"]+)"', body)]
    return arr("BANNED"), arr("UNCONTRACTED")


_BANNED, _UNCONTR = _speak_lists()


def speak_problems(text: str, cap: int = 12) -> list[str]:
    """speakability.ts speakProblems()의 파이썬 미러 — 규칙 동일해야 한다."""
    out = []
    for sent in re.split(r"(?<=[.!?])\s+", text):
        n = len([t for t in sent.split() if re.search(r"[A-Za-z0-9]", t)])
        if n > cap:
            out.append(f'{n}단어>{cap}: "{sent.strip()}"')
    low = " " + re.sub(r"\s+", " ", re.sub(r"[^a-z' ]+", " ", text.lower())) + " "
    for u in _UNCONTR:
        if f" {u.strip()} " in low:
            out.append(f'미축약: "{u.strip()}"')
    for b in _BANNED:
        if (f" {b} " if " " in b else f" {b}") in low:
            out.append(f'금지어: "{b}"')
    return out


def cases() -> list[dict]:
    src = TS.read_text(encoding="utf-8")
    body = src.split("const CASES: Case[] = [", 1)[1].split("\n];", 1)[0]
    out = []
    for blk in re.findall(r"\{(.*?)\}", body, re.S):
        tier = re.search(r'tier:\s*"([ABC])"', blk)
        q = re.search(r'q:\s*"(.*?)",', blk, re.S)
        if not (tier and q):
            continue
        seeds = re.search(r"expectSeed:\s*\[(.*?)\]", blk, re.S)
        intent = re.search(r'intent:\s*"(\w+)"', blk)
        out.append({"tier": tier.group(1), "q": q.group(1),
                    "intent": intent.group(1) if intent else "reply",
                    "expect": re.findall(r'"(.*?)"', seeds.group(1)) if seeds else []})
    return out


def suggest(q: str, intent: str) -> tuple[dict | None, list[str]]:
    r = urllib.request.Request(
        BASE + "/api/suggest",
        data=json.dumps({"said": q, "intent": intent, "preset": "interview",
                         "cefr": "B1"}).encode(),
        headers={"Content-Type": "application/json"})
    meta, text = None, ""
    with urllib.request.urlopen(r, timeout=60) as x:
        for ln in x.read().decode().splitlines():
            try:
                o = json.loads(ln)
            except json.JSONDecodeError:
                continue
            if "meta" in o:
                meta = o["meta"]
            elif "message" in o:
                text += o["message"].get("content", "")
    return meta, [m.strip() for m in re.findall(r"EN:\s*(.+)", text)]


def judge(c: dict, meta: dict | None, en: list[str]) -> list[str]:
    problems = []
    if len(en) < 1:
        problems.append("답변 미생성")
    if any(EVASIVE.search(e) for e in en):
        problems.append("회피성 답변")
    # 구어체 계약(단일 답변): 문장당 ≤12단어 — 첫 문장(≤8, 즉답 오프너)은
    # 프롬프트 규칙이고 여기서는 상한 12로 일괄 검사한다 (형식 회귀 감지가 목적)
    for e in en[:1]:
        problems += list(speak_problems(e, 12))
    srcs = (meta or {}).get("sources", [])
    joined = " ".join(srcs).lower()
    if c["tier"] == "A" and not any(e.lower() in joined for e in c["expect"]):
        problems.append(f"기대 시드 미검색 (실제: {', '.join(srcs) or '없음'})")
    if c["tier"] == "C" and (meta or {}).get("rag_used") \
            and not re.search(r"loss lesson|career move|weakness|자기소개", joined):
        problems.append(f"무관 시드 인용 의심: {', '.join(srcs)}")
    return problems


def main() -> int:
    # 실 키인지 모의인지 표에 기록 — "이 표는 무엇의 실측인가"가 명확해야 한다
    try:
        with urllib.request.urlopen(BASE + "/health", timeout=5) as r:
            h = json.loads(r.read())
        backend = f"{h.get('provider')} ({h.get('model')})"
        mock = bool(h.get("gemini_custom_url"))
    except Exception:  # noqa: BLE001
        sys.exit("서버가 없습니다 — bash start.sh 로 먼저 기동하세요")

    cs = cases()
    assert len(cs) == 15, f"케이스 파싱 이상: {len(cs)}"
    rows, npass = [], 0
    per_tier = {"A": [0, 0], "B": [0, 0], "C": [0, 0]}
    for c in cs:
        meta, en = suggest(c["q"], c["intent"])
        problems = judge(c, meta, en)
        ok = not problems
        npass += ok
        per_tier[c["tier"]][0] += ok
        per_tier[c["tier"]][1] += 1
        srcs = (meta or {}).get("sources", [])
        print(f"{'✅' if ok else '❌'} [{c['tier']}] {c['q']}")
        print(f"   근거: {' · '.join(srcs) or '(없음 → 프로필 폴백)'}")
        for e in en[:2]:
            print(f"   EN: {e[:80]}")
        if not ok:
            print(f"   문제: {'; '.join(problems)}")
        esc = lambda t: t.replace("|", "\\|")
        # 공개 문서(REPORT.md)에 쓰는 표다 — 개인 노트 제목·그 노트로 만든 문장은
        # 고객사명·실적을 담는다(실측: v6.4까지 이 표에 고객사 실명이 기록됐다).
        # 시드(도메인 용어집)가 아닌 근거는 '개인 노트'로 가리고, 개인 근거로
        # 만든 답변 문장도 생략한다. 판정은 그대로 남긴다.
        private = [x for x in srcs if not x.startswith("도메인 용어집")]
        shown = ["개인 노트" if not x.startswith("도메인 용어집") else x.split(': ')[-1] for x in srcs]
        rows.append(
            f"| {c['tier']} | {esc(c['q'])} | "
            f"{esc('<br>'.join(dict.fromkeys(shown))) or '— (프로필 폴백)'} | "
            f"{'(개인 자료 근거 — 생략)' if private else esc('<br>'.join(e[:90] for e in en[:2]))} | "
            f"{'✅' if ok else '❌ ' + esc('; '.join(x for x in problems if x.startswith('회피') or ':' not in x) or '기준 미달')} |")

    try:
        rs = json.load(urllib.request.urlopen(f"{BASE}/api/rag/stats"))
        bs = rs.get("by_source") or {}
        env_line = (f"노트 {bs.get('note', 0)} · 용어집 {bs.get('glossary', 0)}"
                    + (" · **mock LLM** (생성 문장은 형식 검증용, 품질 실측 아님)" if mock else ""))
    except Exception:  # noqa: BLE001
        env_line = "(색인 통계 없음)"
    tier_line = " · ".join(f"{t} {v[0]}/{v[1]}" for t, v in per_tier.items())
    print(f"\n결과: {npass}/15 ({tier_line})")

    block = f"""{MARK_S}
### 13.1 결과 표 (ooc_eval.py 자동 기록 — {time.strftime('%Y-%m-%d %H:%M')} · 공급자: {backend})

환경: {env_line}

| 계층 | 면접관 질문 | 검색 근거 (관련성 컷 통과분) | 생성 2안 | 판정 |
|---|---|---|---|---|
{chr(10).join(rows)}

**{npass}/15** ({tier_line}). 계층 기준 — A: 시드 검색·활용 / B: 무관 시드 강제
인용 없이 생성 / C: 검색 0이어도 프로필 기반 답변, 회피성 문구 금지.
{MARK_E}"""
    s = REPORT.read_text(encoding="utf-8")
    if MARK_S in s:
        s = re.sub(re.escape(MARK_S) + r".*?" + re.escape(MARK_E), block, s, flags=re.S)
    else:
        s += "\n\n" + block + "\n"
    REPORT.write_text(s, encoding="utf-8")
    print(f"docs/REPORT.md 13장 갱신 완료")
    return 0 if npass == 15 else 1


if __name__ == "__main__":
    sys.exit(main())
