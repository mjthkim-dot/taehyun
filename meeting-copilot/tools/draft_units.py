#!/usr/bin/env python3
"""답변 은행 초안 — 예상 질문마다 '그대로 읽을' 대본 초안을 만든다 (v6.6).

  GEMINI_API_KEY=... python3 tools/draft_units.py            # 예상 질문 전부
  GEMINI_API_KEY=... python3 tools/draft_units.py -n 10      # 앞 10문항만
  GEMINI_API_KEY=... python3 tools/draft_units.py --force    # 이미 초안이 있는 질문도 다시

왜 필요한가: 검수된 대본(Tier A)은 0.7초에 뜨고 문장이 고정되며 환각이 0이다.
생성(Tier B)은 약 2초에 뜨고 매번 문장이 다르다. 그런데 대본은 사람이 써야 했다 —
37개를 쓰는 데 며칠이 걸렸고, 회사가 바뀌면 다시 써야 했다. 이 도구가 **자료를 근거로
초안**을 만들고 기계 검사(길이·난이도·숫자·근거)를 붙여 두면, 사람은 읽고 고치고
승인만 하면 된다(앱 '자료' 탭의 📝 답변 은행).

원칙:
  · 초안은 reviewed:false — 승인 전에는 한 번도 화면에 뜨지 않는다(Tier A 원칙).
  · 회사 무관 질문의 대본은 회사 이름을 {{COMPANY}}로 바꿔 둔다 — 다음 회사에서도 쓴다.
    회사 전용 질문(회사 파일 golden)의 대본은 company 필드로 그 회사에만 묶인다.
  · 검사에 걸린 초안도 저장한다(checks 필드에 사유) — 검수 화면에서 ⚠️로 보인다.
  · 기존 대본은 건드리지 않는다. 같은 질문의 초안이 있으면 건너뛴다(--force로 덮어씀).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tests"))
import company  # noqa: E402
import grounding  # noqa: E402
import llm  # noqa: E402
import mock  # noqa: E402
import numwords  # noqa: E402
import prompts  # noqa: E402
import rag  # noqa: E402
import readability  # noqa: E402
import units  # noqa: E402

LEN_30 = (25, 55)
LEN_90 = (80, 160)


def questions() -> list[dict]:
    """예상 질문 = 골든셋(코어 + 회사) + 모의 면접 세트. 중복 제거, 회사 질문 표시."""
    import golden_routing as G
    nm = company.name() or "your company"
    out, seen = [], set()

    def add(q: str, is_company: bool):
        k = " ".join(q.lower().split())
        if k in seen or not q.strip():
            return
        seen.add(k)
        out.append({"q": q.strip(), "company": company.slug() if is_company else ""})

    n_core = len(G.CORE_CASES)                       # CASES = 코어(치환됨) + 회사 순서
    for i, c in enumerate(G.CASES):
        add(c["q"], i >= n_core)
    for g in company.data().get("golden") or []:
        if g.get("q"):
            add(str(g["q"]).replace("{{COMPANY}}", nm), True)
    for q in mock.CORE:
        add(q.replace("{{COMPANY}}", nm), False)
    for q in mock.FOLLOWUPS.values():
        add(q, False)
    return out


def _parse(raw: str) -> tuple[str, str, str]:
    en = (re.search(r"EN\s*[:：]\s*([\s\S]*?)(?:\n(?:KR|PR)\s*[:：]|\n===|$)", raw) or [None, ""])[1]
    en = re.sub(r"\s*/\s*", " ", (en or "")).strip()
    en = re.sub(r"\s{2,}", " ", en)
    gist = (re.search(r"요지\s*=\s*([^|\n]+)", raw) or [None, ""])[1].strip()
    strat = (re.search(r"전략\s*=\s*([^\n]+)", raw) or [None, ""])[1].strip()
    return en, gist, strat


def _gen(prompt: str) -> str:
    return llm.chat_once([{"role": "user", "content": prompt}], False, 0.4, 2400,
                         kind="assets", bg=True) or ""


def _tags(q: str) -> list[str]:
    """면접관이 이 질문을 할 때 쓸 법한 2~4단어 구 — 의도 게이트(units.matches_intent)."""
    p = ("An interviewer asked a sales candidate:\n\"" + q + "\"\n"
         "List 3 short phrases (2-4 words each, lowercase, exactly as an interviewer would say them) "
         "that identify THIS question's intent and would appear in most rephrasings of it. "
         "Prefer content words (\"biggest deal\", \"first ninety days\", \"why are you leaving\"). "
         "JSON only: {\"tags\": [\"...\", \"...\", \"...\"]}")
    try:
        out = llm.chat_once([{"role": "user", "content": p}], True, 0.0, 120, fast=True,
                            kind="assets", bg=True)
        tags = json.loads(out).get("tags") or []
    except Exception:  # noqa: BLE001
        tags = []
    clean = []
    for t in tags:
        t = " ".join(str(t).lower().replace("?", "").split())
        if 1 <= len(t.split()) <= 4 and t not in clean:
            clean.append(t)
    return clean[:4]


def _fallback_tag(q: str) -> str:
    """질문 자체에서 **연속된** 마지막 3어절 — matches_intent는 구(phrase) 완전 일치라
    질문에 그대로 들어 있는 구여야 한다(v6.6 실측: 불연속 낱말 조합은 발동하지 않았다)."""
    words = q.lower().replace("?", " ").replace(",", " ").split()
    return " ".join(words[-3:]) if len(words) >= 3 else " ".join(words)


def checks_for(en: str, max_words: int, known: set, q: str, material: str, profile: str,
               ground: bool) -> list[str]:
    probs = []
    n = len(en.split())
    lo = LEN_30[0] if max_words == LEN_30[1] else LEN_90[0]
    if n < lo:
        probs.append(f"너무 짧음 ({n}단어 < {lo})")
    probs += readability.check(en, max_words)
    bad = numwords.unverified(en, known)
    if bad:
        probs.append("자료에 없는 숫자: " + ", ".join(bad[:4]))
    if ground:
        try:
            for f in grounding.check(en, q, material, profile):
                probs.append(f"근거 없음: {f['sentence'][:50]}… ({f['why']})")
        except Exception as e:  # noqa: BLE001
            probs.append(f"근거 확인 실패: {str(e)[:40]}")
    return probs


def _mask_company(text: str, is_company: bool) -> str:
    if is_company or not text:
        return text
    for n in sorted(company.names(), key=len, reverse=True):
        text = re.sub(rf"(?<![A-Za-z0-9]){re.escape(n)}(?![A-Za-z0-9])", "{{COMPANY}}", text)
    return text


def uid(q: str) -> str:
    return hashlib.sha1(" ".join(q.lower().split()).encode()).hexdigest()[:8]


def main() -> int:
    ap = argparse.ArgumentParser(description="답변 은행 초안 만들기")
    ap.add_argument("-n", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--no-ground", action="store_true", help="근거 확인 생략(빠름)")
    a = ap.parse_args()
    if not llm.GEMINI_API_KEY:
        print("❌ GEMINI_API_KEY가 필요합니다")
        return 1
    st = rag.default_store()
    profile = prompts._profile(st)
    path = units.UNITS_PATH
    existing = units.load(force=True)
    have = {u.get("id") for u in existing if u.get("id")} | {
        uid(u["question"]) for u in existing if u.get("question")}
    # 승인된 대본은 --force로도 건드리지 않는다 — 사람이 고친 문장이 우선이다
    approved = {u.get("id") for u in existing if u.get("reviewed") and u.get("id")}
    qs = questions()
    if a.n:
        qs = qs[:a.n]
    print(f"🏢 {company.name() or '(회사 미지정)'} · 예상 질문 {len(qs)}개 · 기존 대본 {len(existing)}개")
    made, skipped, t_all = [], 0, time.time()
    for i, item in enumerate(qs, 1):
        q, is_co = item["q"], bool(item["company"])
        if uid(q) in approved or (uid(q) in have and not a.force):
            skipped += 1
            continue
        b = prompts.build_suggest(q, "", "reply", "B1", store=st, preset="interview")
        if b["tier"] != "B" or not b["hits"]:
            print(f"  [{i:2d}] {'📭 근거 없음' if b['tier'] == 'C' else '📌 대본 있음'} — {q[:60]}")
            continue
        t0 = time.time()
        en30, gist, strat = _parse(_gen(b["prompt"]))
        # 90초 판본 — 같은 근거로, 길이 규칙만 발표형으로 바꿔 한 번 더
        p90 = b["prompt"] + ("\n\nOVERRIDE for this request: give the 90-SECOND version — 12-16 short "
                             "sentences, 100-150 words, three concrete points from THEIR OWN MATERIAL, "
                             "same facts and numbers as above, still one idea per sentence.")
        en90, _, _ = _parse(_gen(p90))
        if not en30:
            print(f"  [{i:2d}] ❌ 생성 실패 — {q[:60]}")
            continue
        known = set(b.get("known_values") or [])
        material = grounding.material_of(b["hits"])
        probs = [f"30초: {p}" for p in checks_for(en30, LEN_30[1], known, q, material, profile,
                                                   not a.no_ground)]
        if en90:
            probs += [f"90초: {p}" for p in checks_for(en90, LEN_90[1], known, q, material,
                                                        profile, False)]
        tags = _tags(q)
        top = b["hits"][0]["title"]
        unit = {
            "id": uid(q), "question": q, "note_title": _mask_company(top, is_co),
            "answer_en_30s": _mask_company(en30, is_co),
            "answer_en_90s": _mask_company(en90, is_co),
            "intent_tags": tags, "key_numbers": [numwords.fmt(v) for v in known
                                                 if numwords.fmt(v) in en30 + " " + en90][:6],
            "gist": _mask_company(gist, is_co) or q, "strategy": _mask_company(strat, is_co),
            "reviewed": False, "draft": True, "checks": probs,
            "sources": b["sources"][:3], "company": item["company"],
            "made": time.strftime("%Y-%m-%d"),
        }
        if not units.matches_intent(q, unit):
            fb = _fallback_tag(q)
            if fb:
                unit["intent_tags"].append(fb)
            assert units.matches_intent(q, unit), "발동 구가 질문에 없음"
        made.append(unit)
        flag = "⚠️ " + str(len(probs)) if probs else "✅"
        print(f"  [{i:2d}] {flag:5s} {time.time()-t0:4.1f}s · {len(en30.split()):3d}/{len(en90.split()):3d}단어 · {q[:52]}")
    if made:
        # 같은 id의 옛 초안(--force)은 교체, 나머지는 보존
        ids = {u["id"] for u in made}
        keep = [u for u in existing if not (u.get("draft") and u.get("id") in ids)]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(keep + made, ensure_ascii=False, indent=1), encoding="utf-8")
    n_ok = sum(1 for u in made if not u["checks"])
    print(f"\n✅ 초안 {len(made)}개 저장 (검사 통과 {n_ok} · 확인 필요 {len(made)-n_ok} · 건너뜀 {skipped})"
          f" · {time.time()-t_all:.0f}초\n   → {path}\n"
          "   앱 '자료' 탭 → 📝 답변 은행에서 읽고 고치고 [승인]하세요. 승인한 것만 화면에 뜹니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
