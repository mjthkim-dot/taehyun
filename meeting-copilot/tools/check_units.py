#!/usr/bin/env python3
"""답변 유닛 검사 — 그대로 읽을 문장이므로 사람 검수 전에 기계가 먼저 잡는다.

검사 4가지:
  1. 노트 연결   note_title이 실제 저장소의 노트와 이어지는가 (오타·제목 변경)
  2. 수치 근거   답변에 쓴 숫자가 코퍼스에 실재하는가 (지어낸 수치 차단)
  3. 라우팅      이 유닛의 질문 유형이 실제로 이 노트를 1순위로 부르는가
  4. 발화 길이   30초/90초 판본이 실제로 그 길이인가

실행:  python3 tools/check_units.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import prompts  # noqa: E402
import rag  # noqa: E402
import readability  # noqa: E402
import units  # noqa: E402

# 영어가 약한 사용자가 소리 내어 읽는 속도 ≈ 100 wpm. 30초 = 55단어, 90초 = 160단어.
# (원래 150 wpm 기준 75/225였다 — 원어민 기준이라 실측 45초 넘게 걸렸다.)
LEN_30 = (25, 55)
LEN_90 = (80, 160)

# 주장하는 수치만 잡는다. 라벨(L4, D2C, 30/60/90)과 연도(2025)는 주장이 아니다.
_NUM = re.compile(r"(?<![A-Za-z0-9])\d[\d,.]*(?![A-Za-z])")
_YEAR = re.compile(r"^(19|20)\d\d$")
# 영어로 풀어 쓴 수치는 정규식으로 못 잡는다. 검수자가 눈으로 보라고 따로 센다.
_SPELLED = re.compile(
    r"\b(thirty-eight|fifty|seventy-five|fifty-five|eighty-nine|thirty|twenty|"
    r"hundred|thousand|million|billion|quarter|ninety|sixty)\b", re.I)


def main() -> int:
    st = rag.default_store()
    titles = {r["title"] for r in st.all_chunks()} if hasattr(st, "all_chunks") else set()
    if not titles:                                  # 저장소 API가 다르면 직접 읽는다
        import sqlite3
        con = sqlite3.connect(str(rag.DB_PATH) if hasattr(rag, "DB_PATH")
                              else str(ROOT / "backend" / "data" / "store.db"))
        titles = {t for (t,) in con.execute(
            "select title from chunks where source in ('note','glossary')")}

    us = units.load(force=True)
    print(f"\n유닛 {len(us)}개 · 검수 완료 {sum(1 for u in us if u.get('reviewed'))}개\n")
    bad = 0

    for u in us:
        t = u.get("note_title", "")
        probs: list[str] = []

        # 1. 노트 연결
        if not any(t == x or x.startswith(t) or t.startswith(x) for x in titles):
            probs.append("노트 없음 — 제목이 저장소와 안 맞음")

        # 2. 수치 근거 — key_numbers에 없는 아라비아 숫자를 본문에 쓰면 경고
        allowed = {n.lower().replace(",", "").replace("$", "").rstrip("%")
                   for n in (u.get("key_numbers") or [])}
        for depth in ("answer_en_30s", "answer_en_90s"):
            for m in _NUM.findall(u.get(depth) or ""):
                k = m.replace(",", "").rstrip(".")
                if _YEAR.match(k):
                    continue
                if k not in allowed and not any(k in a or a in k for a in allowed):
                    probs.append(f"{depth}: 근거 없는 숫자 {m!r}")

        # 4. 길이 + B1 가독성 — 그대로 읽는 대본이라 문장 길이·어려운 단어를 본다
        for depth, (lo, hi) in (("answer_en_30s", LEN_30), ("answer_en_90s", LEN_90)):
            n = len((u.get(depth) or "").split())
            if n < lo:
                probs.append(f"{depth}: {n}단어 (기대 {lo}~{hi})")
            for pr in readability.check(u.get(depth) or "", hi):
                probs.append(f"{depth}: {pr}")

        mark = "❌" if probs else "✅"
        if probs:
            bad += 1
        n30 = len((u.get("answer_en_30s") or "").split())
        n90 = len((u.get("answer_en_90s") or "").split())
        sp = len(_SPELLED.findall(u.get("answer_en_30s") or ""))
        print(f"{mark} {t}")
        print(f"     30s {n30}단어 · 90s {n90}단어 · 30s 풀어쓴 수치 {sp}개")
        for p in probs:
            print(f"     ⚠️  {p}")

    print(f"\n── 라우팅 — 이 유닛을 부르는 질문이 실제로 이 노트를 1순위로 집는가 ──")
    miss = 0
    for u in us:
        tags = u.get("intent_tags") or []
        if not tags:
            continue
        q = tags[0]
        hits = st.search(prompts.triggers.expand(q), k=3, sources=["note", "glossary"])
        top = hits[0]["title"] if hits else "—"
        ok = any(top == u["note_title"] or top.startswith(u["note_title"])
                 or u["note_title"].startswith(top) for _ in (0,))
        if not ok:
            miss += 1
            print(f"  ⚠️  {q!r}\n        기대: {u['note_title']}\n        실제: {top}")
    print(f"  1순위 일치 {len(us)-miss}/{len(us)}")

    print(f"\n결과: 형식 문제 {bad}건 · 라우팅 불일치 {miss}건")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
