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
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "http://localhost:3799"
TS = Path(__file__).with_name("ooc-eval.ts")
REPORT = Path(__file__).resolve().parent.parent.parent / "docs" / "REPORT.md"
MARK_S = "<!-- OOC-RESULTS:START -->"
MARK_E = "<!-- OOC-RESULTS:END -->"
EVASIVE = re.compile(r"i'?m not sure|i don'?t know|hard to say|cannot answer|no idea", re.I)


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
    if len(en) < 2:
        problems.append("2안 미생성")
    if any(EVASIVE.search(e) for e in en):
        problems.append("회피성 답변")
    if any(len(e.split()) > 15 for e in en):
        problems.append("15단어 초과")
    srcs = (meta or {}).get("sources", [])
    joined = " ".join(srcs).lower()
    if c["tier"] == "A" and not any(e.lower() in joined for e in c["expect"]):
        problems.append(f"기대 시드 미검색 (실제: {', '.join(srcs) or '없음'})")
    if c["tier"] == "C" and (meta or {}).get("rag_used") \
            and not re.search(r"loss lesson|career move|weakness", joined):
        problems.append(f"무관 시드 인용 의심: {', '.join(srcs)}")
    return problems


def main() -> int:
    # 실 키인지 모의인지 표에 기록 — "이 표는 무엇의 실측인가"가 명확해야 한다
    try:
        with urllib.request.urlopen(BASE + "/health", timeout=5) as r:
            h = json.loads(r.read())
        backend = f"{h.get('provider')} ({h.get('model')})"
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
        rows.append(
            f"| {c['tier']} | {esc(c['q'])} | "
            f"{esc('<br>'.join(s.split(': ')[-1] for s in srcs)) or '— (프로필 폴백)'} | "
            f"{esc('<br>'.join(e[:90] for e in en[:2]))} | "
            f"{'✅' if ok else '❌ ' + esc('; '.join(problems))} |")

    tier_line = " · ".join(f"{t} {v[0]}/{v[1]}" for t, v in per_tier.items())
    print(f"\n결과: {npass}/15 ({tier_line})")

    block = f"""{MARK_S}
### 13.1 결과 표 (ooc_eval.py 자동 기록 — {time.strftime('%Y-%m-%d %H:%M')} · 공급자: {backend})

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
