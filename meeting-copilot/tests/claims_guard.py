#!/usr/bin/env python3
"""사실 가드 — 과장된 주장이 코퍼스·유닛에 되살아났는지 본다.

왜 필요한가(실측 2026-08-29): tools/fix_claims.py로 한 번 정정했는데,
그 뒤 코퍼스를 --replace로 재적재하면서 **네 문구가 전부 되살아났다.**
저장소에 "Author of the L1-L4 AI Agent Maturity Framework"가 남아 있었고,
그대로 두면 면접에서 그 문장을 읽게 된다.

정정은 한 번 하고 끝나는 일이 아니다. 재적재할 때마다 원본이 이긴다.
그래서 회귀 스위트에 넣는다 — 되살아나면 여기서 걸린다.

실행:  python3 tests/claims_guard.py     (0 = 통과)
되살아났다면:  python3 tools/fix_claims.py
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "backend" / "data" / "store.db"
UNITS = ROOT / "backend" / "data" / "imported" / "answer_units.json"

# (금지 문구, 왜 거짓인가) — 사용자 확인 2026-08-25.
# L1-L4 프레임워크는 본인이 개발한 것이 아니라, 레벨별 성숙도에 따른 제안 방법을
# 익혀 실무에 적용하는 것이다. USE/APPLY를 built/authored로 승격하지 않는다.
BANNED: list[tuple[str, str]] = [
    ("Author of the L1-L4", "저작 주장 — 활용이 사실이다"),
    ("유닛 전체 GTM 방법론", "전사 채택 주장"),
    ("GTM 방법론 채택", "채택 주장"),
    ("실행 프레임을 만들었습니다", "제작 주장"),
    ("16개 컴포넌트로 구조화했고", "구조화 저작 주장"),
    ("I organized that into an L1-to-L4", "저작 주장(영문)"),
    ("I organized what I learned into a maturity framework", "저작 주장(영문)"),
    ("adopted it as its go-to-market methodology", "채택 주장(영문)"),
    ("framework I built", "제작 주장(영문)"),
    ("I created the L1", "제작 주장(영문)"),
]


def main() -> int:
    bad = 0

    if DB.exists():
        con = sqlite3.connect(str(DB))
        for phrase, why in BANNED:
            rows = con.execute(
                "select id, title from chunks where text like ?", (f"%{phrase}%",)).fetchall()
            for cid, title in rows:
                bad += 1
                print(f"  ❌ 코퍼스 [{cid}] {title}\n      {phrase!r} — {why}")
    else:
        print("  ℹ️  store.db 없음 — 코퍼스 검사 건너뜀")

    if UNITS.exists():
        for u in json.loads(UNITS.read_text(encoding="utf-8")):
            blob = " ".join(str(u.get(k, "")) for k in
                            ("answer_en_30s", "answer_en_90s", "gist", "strategy"))
            for phrase, why in BANNED:
                if phrase in blob:
                    bad += 1
                    print(f"  ❌ 유닛 [{u.get('note_title','?')}]\n      {phrase!r} — {why}")
    else:
        print("  ℹ️  answer_units.json 없음 — 유닛 검사 건너뜀")

    if bad:
        print(f"\n❌ 과장 주장 {bad}건 — 재적재로 되살아났을 수 있습니다.")
        print("   고치기:  python3 tools/fix_claims.py")
        return 1
    print("✅ 과장 주장 없음 (코퍼스 + 유닛)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
