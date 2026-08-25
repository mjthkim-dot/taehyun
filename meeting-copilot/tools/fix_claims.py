#!/usr/bin/env python3
"""코퍼스 사실 정정 — 과장된 주장(프레임워크 '개발/채택')을 실제 사실로.

사용자 확인(2026-08-25): L1-L4 성숙도 프레임워크는 본인이 개발한 것이 아니라
**레벨별 성숙도에 따른 제안 방법을 익혀 실무에 적용**하는 것. 코퍼스에 남은
저작·채택 주장을 정정한다. 멱등 — 여러 번 실행해도 안전하다.

실행:  python3 tools/fix_claims.py        (meeting-copilot/ 에서)
       변경된 청크의 검색 인덱스(postings)도 함께 재구축한다.
"""
from __future__ import annotations

import re
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from rag import tokenize  # noqa: E402  (검색 인덱스 재구축용 — 서버와 동일 토크나이저)

DB = Path(__file__).resolve().parent.parent / "backend" / "data" / "store.db"

# (패턴, 교체문) — 저작/채택 주장 → 활용 사실. 패턴은 개행·공백 변형을 허용한다.
FIXES: list[tuple[str, str]] = [
    (r"Author of the L1-L4 AI Agent Maturity Framework \(16 components\)\s*—\s*"
     r"adopted as unit-wide GTM methodology",
     "Applies an L1-L4 AI agent maturity framework (16 components) to structure "
     "proposals by the customer's maturity level"),
    (r"2026\.07 발표,\s*유닛 전체 GTM 방법론 채택 \+ 1H 전략 키노트\.",
     "부서 단위 성숙도 진단에 따라 제안을 구조화하는 실무 방법론으로 활용."),
    (r"저는 그 원인을 설계 대상으로 바꾼 실행 프레임을 만들었습니다",
     "저는 그 분석을 제안 설계에 적용합니다"),
    (r"반복 관찰한 패턴을 16개 컴포넌트로 구조화했고,\s*유닛 GTM 방법론으로\s*"
     r"채택돼 실계정에서 돌고 있습니다",
     "반복 관찰한 패턴을 성숙도 레벨별 제안 방법으로 정리해 실무에서 쓰고 있습니다"),
]


def main() -> int:
    if not DB.exists():
        print(f"❌ DB 없음: {DB} — meeting-copilot/ 에서 실행했는지 확인")
        return 1
    con = sqlite3.connect(DB)
    changed = 0
    for cid, title, text in con.execute("SELECT id, title, text FROM chunks").fetchall():
        new = text
        for pat, rep in FIXES:
            new = re.sub(pat, rep, new)
        if new == text:
            continue
        toks = tokenize(f"{title} {new}")
        con.execute("UPDATE chunks SET text=?, n_tokens=? WHERE id=?", (new, len(toks), cid))
        con.execute("DELETE FROM postings WHERE chunk_id=?", (cid,))
        tf: dict[str, int] = {}
        for t in toks:
            tf[t] = tf.get(t, 0) + 1
        con.executemany("INSERT INTO postings(term,chunk_id,tf) VALUES(?,?,?)",
                        [(t, cid, n) for t, n in tf.items()])
        changed += 1
        print(f"✏️  정정: [{cid}] {title}")
    con.commit()
    # 남은 과장 주장 검사 — 정정 후에도 남아 있으면 알려준다
    left = con.execute(
        "SELECT id, title FROM chunks WHERE text LIKE '%프레임을 만들었%' "
        "OR text LIKE '%Author of the L1-L4%' OR text LIKE '%GTM 방법론 채택%'").fetchall()
    for cid, title in left:
        print(f"⚠️  잔존 의심: [{cid}] {title} — 직접 확인 필요")
    print(f"\n{'✅' if changed or not left else 'ℹ️'} 정정 {changed}건"
          + (" · 잔존 의심 0건" if not left else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
