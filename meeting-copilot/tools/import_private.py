#!/usr/bin/env python3
"""개인 면접·미팅 코퍼스 임포트 — backend/data/imported/*.json → 로컬 RAG.

  python3 tools/import_private.py            # imported/ 폴더의 모든 .json 적재
  python3 tools/import_private.py --replace  # 기존 개인 노트 전부 지우고 새로 적재
  python3 tools/import_private.py --list     # 적재된 개인 노트 확인

--replace 는 제목이 바뀌거나 삭제된 옛 청크가 남지 않도록, 개인 노트(private:*)만
전부 지운 뒤 다시 적재한다. 코퍼스를 수정 학습할 때는 --replace 를 쓴다.

파일 형식: [{"title": "...", "text": "..."}] 배열. text 끝에 "[검색어] ..." 줄을
붙이면 검색 트리거로만 쓰이고 답변 인용에서는 제외된다.

개인 데이터 원칙: imported/ 는 .gitignore 대상이라 GitHub에 절대 올라가지 않는다.
같은 title은 재실행 시 갱신된다(중복 없음). 색인은 이 명령을 직접 실행할 때만
일어난다 — 자동 백그라운드 색인 없음.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import llm  # noqa: E402
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

    # answer_units.json은 코퍼스가 아니라 '대본'이다(backend/units.py가 읽는다).
    # 같은 폴더에 살지만 스키마가 달라 청크로 적재하면 안 된다.
    NOT_CORPUS = {"answer_units.json"}
    files = [f for f in sorted(IMP.glob("*.json")) if f.name not in NOT_CORPUS]
    if not files:
        print(f"적재할 파일이 없습니다 — {IMP}/ 에 .json을 넣고 다시 실행하세요")
        return 1
    if "--replace" in sys.argv:
        with st.connect() as con:
            n = con.execute(
                "SELECT COUNT(*) FROM chunks WHERE uid LIKE 'private:%'").fetchone()[0]
            con.execute("DELETE FROM chunks WHERE uid LIKE 'private:%'")
            con.commit()
        print(f"🧹 기존 개인 노트 {n}개 삭제 (재적재 준비)")
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
    # 재적재는 원본 JSON이 이긴다 — 예전에 정정한 과장 주장이 그대로 되살아난다
    # (실측 2026-08-29: --replace 후 "Author of the L1-L4…" 4문구가 전부 복귀).
    # 정정은 한 번 하고 끝나는 일이 아니라서, 적재 직후 매번 다시 건다.
    print()
    subprocess.run([sys.executable, str(ROOT / "tools" / "fix_claims.py")])

    # --replace는 청크를 지우고 새 id로 다시 넣는다 → 옛 벡터가 고아가 되어
    # **의미검색이 통째로 죽는다**(실측 2026-08-29: note 벡터 72개 → 17개).
    # 붙여넣기 임포트가 --replace를 쓰므로, 코퍼스를 갱신할 때마다 조용히
    # 죽던 자리다. 골든셋 기준 top3 100% → 89%, 티어 100% → 90%.
    if llm.embed_available():
        n_emb = st.reembed_missing()
        if n_emb:
            print(f"🧠 임베딩 {n_emb}개 재생성 (의미검색 복구)")
    else:
        print("⚠️  임베딩 백엔드 없음 — 의미검색이 꺼진 상태입니다"
              " (GEMINI_API_KEY를 설정하고 다시 실행하세요)")

    print(f"완료 — 총 {total}개. 앱을 재시작하거나 '자료' 탭에서 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
