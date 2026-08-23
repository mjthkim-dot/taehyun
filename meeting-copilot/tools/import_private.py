#!/usr/bin/env python3
"""개인 면접·미팅 코퍼스 임포트 — backend/data/imported/*.json → 로컬 RAG.

  python3 tools/import_private.py          # imported/ 폴더의 모든 .json 적재
  python3 tools/import_private.py --list   # 적재된 개인 노트 확인

파일 형식: [{"title": "...", "text": "..."}] 배열. text 끝에 "[검색어] ..." 줄을
붙이면 검색 트리거로만 쓰이고 답변 인용에서는 제외된다.

개인 데이터 원칙: imported/ 는 .gitignore 대상이라 GitHub에 절대 올라가지 않는다.
같은 title은 재실행 시 갱신된다(중복 없음). 색인은 이 명령을 직접 실행할 때만
일어난다 — 자동 백그라운드 색인 없음.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import rag  # noqa: E402

IMP = ROOT / "backend" / "data" / "imported"


def main() -> int:
    st = rag.default_store()
    if "--list" in sys.argv:
        with st.connect() as con:
            rows = con.execute(
                "SELECT title, length(text) FROM chunks WHERE uid LIKE 'private:%' "
                "ORDER BY title").fetchall()
        for t, n in rows:
            print(f"  · {t} ({n}자)")
        print(f"개인 노트 {len(rows)}개")
        return 0

    files = sorted(IMP.glob("*.json"))
    if not files:
        print(f"적재할 파일이 없습니다 — {IMP}/ 에 .json을 넣고 다시 실행하세요")
        return 1
    total = 0
    for f in files:
        try:
            items = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"❌ {f.name}: JSON 파싱 실패 — {e}")
            continue
        chunks = [{"source": "note", "title": it["title"], "text": it["text"],
                   "uid": f"private:{it['title']}"} for it in items
                  if it.get("title") and it.get("text")]
        r = st.add_chunks(chunks, embed=False)
        total += r.get("added", 0)
        print(f"✅ {f.name}: {r.get('added', 0)}개 청크 적재/갱신")
    print(f"완료 — 총 {total}개. 앱을 재시작하거나 '자료' 탭에서 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
