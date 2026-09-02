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
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import llm  # noqa: E402
import rag  # noqa: E402

IMP = ROOT / "backend" / "data" / "imported"


def _active_company() -> str:
    """지원 중인 회사. 환경변수 > ACTIVE_COMPANY 파일 > 첫 번째 회사 파일."""
    env = os.environ.get("INTERVIEW_COMPANY", "").strip()
    if env:
        return env
    f = IMP / "ACTIVE_COMPANY"
    if f.exists():
        v = f.read_text(encoding="utf-8").strip()
        if v:
            return v
    cands = sorted((IMP / "company").glob("*.json"))
    return cands[0].stem if cands else ""


def _insert_link(text: str, link: str) -> str:
    """회사 연결 문구를 [검색어] 줄 **앞**에 끼운다.

    [검색어]는 검색 힌트 줄이라 항상 마지막이어야 한다 — 그 뒤에 문장을 붙이면
    검색어가 본문 중간에 묻혀 라우팅이 흔들린다."""
    lines = text.split("\n")
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].startswith("[검색어]"):
            body = "\n".join(lines[:i]).rstrip()
            return body + " " + link + "\n" + "\n".join(lines[i:])
    return text.rstrip() + " " + link


def _load_layers() -> tuple[dict, list[dict]]:
    """core(회사 무관) + company(회사 전용)를 합쳐 적재할 노트 목록을 만든다.

    왜 나눴나: 코퍼스 55개 중 38개는 어느 회사에 지원하든 그대로 쓰는 자산이고
    (딜 스토리·실적·헌팅·연봉·영어·소프트스킬), 17개만 회사 전용이다
    (제품·경쟁·재무·Why This Company). 섞여 있으면 회사가 바뀔 때마다 전체를
    다시 훑어야 한다. 이제 company/<회사>.json 하나만 새로 쓰면 된다.

    core 노트는 회사명을 {{COMPANY}}로 두고, 회사에만 통하는 마무리 문장은
    company 파일의 links에 노트 제목으로 걸어 둔다.
    """
    slug = _active_company()
    cfile = IMP / "company" / f"{slug}.json"
    company, links, extra = {"name": slug or "(미지정)", "slug": slug}, {}, []
    if cfile.exists():
        try:
            cj = json.loads(cfile.read_text(encoding="utf-8"))
            company = {**company, **(cj.get("company") or {})}
            links = cj.get("links") or {}
            extra = cj.get("notes") or []
        except json.JSONDecodeError as e:
            print(f"❌ {cfile.name}: JSON 파싱 실패 — {e}")
    elif slug:
        print(f"⚠️  회사 파일 없음: {cfile} — 회사 무관 자료만 적재합니다")

    name = company.get("name") or slug
    items: list[dict] = []
    # 하위 호환 — core/ 폴더가 없는 옛 구조(imported/*.json 한 파일)도 그대로 읽는다.
    # 맥북의 자료는 아직 옛 구조일 수 있다. 새 구조로 옮기지 않아도 동작해야 한다.
    core_dir = IMP / "core"
    if core_dir.is_dir():
        core_files = sorted(core_dir.glob("*.json"))
    else:
        core_files = [f for f in sorted(IMP.glob("*.json")) if f.name != "answer_units.json"]
        if core_files:
            print(f"ℹ️  옛 구조 감지 — {len(core_files)}개 파일을 회사 무관 자료로 적재합니다"
                  f" (새 구조: {IMP}/core/ + company/)")
    for f in core_files:
        try:
            for it in json.loads(f.read_text(encoding="utf-8")):
                t, x = it.get("title"), it.get("text")
                if not (t and x):
                    continue
                key = t                                   # links는 치환 전 제목으로 건다
                if key in links:
                    x = _insert_link(x, links[key])
                items.append({"title": t.replace("{{COMPANY}}", name),
                              "text": x.replace("{{COMPANY}}", name)})
        except json.JSONDecodeError as e:
            print(f"❌ {f.name}: JSON 파싱 실패 — {e}")
    items += [{"title": it["title"], "text": it["text"]} for it in extra
              if it.get("title") and it.get("text")]
    return company, items


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

    company, items = _load_layers()
    if not items:
        print(f"적재할 자료가 없습니다 — {IMP}/core/ 에 .json을 넣고 다시 실행하세요")
        return 1
    print(f"🏢 지원 회사: {company['name']}  (바꾸려면 {IMP/'ACTIVE_COMPANY'} 수정)")
    if "--replace" in sys.argv:
        with st.connect() as con:
            n = con.execute(
                "SELECT COUNT(*) FROM chunks WHERE uid LIKE 'private:%'").fetchone()[0]
            # 청크만 지우면 검색 인덱스(postings)와 벡터가 고아로 남는다.
            # 고아 posting은 BM25의 문서빈도를 부풀려 점수를 망가뜨린다 — 실측
            # 2026-09-01: 재적재를 반복한 저장소에서 postings의 34%(5,970행)가
            # 사라진 청크를 가리키고 있었고, 골든셋 2문항이 엉뚱한 노트로 갔다.
            con.execute("DELETE FROM postings WHERE chunk_id IN "
                        "(SELECT id FROM chunks WHERE uid LIKE 'private:%')")
            con.execute("DELETE FROM vecs WHERE chunk_id IN "
                        "(SELECT id FROM chunks WHERE uid LIKE 'private:%')")
            con.execute("DELETE FROM chunks WHERE uid LIKE 'private:%'")
            # 이전 버전이 남긴 고아까지 함께 쓸어낸다(1회 복구 겸 상시 청소).
            orph = con.execute(
                "SELECT COUNT(*) FROM postings p LEFT JOIN chunks c ON c.id=p.chunk_id "
                "WHERE c.id IS NULL").fetchone()[0]
            if orph:
                con.execute("DELETE FROM postings WHERE chunk_id NOT IN "
                            "(SELECT id FROM chunks)")
                con.execute("DELETE FROM vecs WHERE chunk_id NOT IN "
                            "(SELECT id FROM chunks)")
                print(f"🧯 고아 인덱스 {orph:,}행 제거 (이전 재적재가 남긴 것)")
            con.commit()
        print(f"🧹 기존 개인 노트 {n}개 삭제 (재적재 준비)")
    chunks = [{"source": "note", "title": it["title"], "text": it["text"],
               "uid": f"private:{it['title']}"} for it in items
              if it.get("title") and it.get("text")]
    r = st.add_chunks(chunks, embed=False)
    total = r.get("added", 0)
    print(f"✅ {total}개 청크 적재/갱신")
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
