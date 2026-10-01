#!/usr/bin/env python3
"""tests/rag-eval.ts와 같은 케이스를 돌리는 파이썬 러너 (node/deno 없이 검증용)."""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

BASE = os.environ.get("MC_BASE", "http://localhost:3799")
TS = (__file__).replace("rag_eval.py", "rag-eval.ts")


def cases() -> list[dict]:
    """케이스를 두 벌 관리하면 반드시 어긋난다 → .ts에서 그대로 읽어 쓴다."""
    src = open(TS, encoding="utf-8").read()
    body = src.split("const CASES: Case[] = [", 1)[1].split("\n];", 1)[0]
    out = []
    for blk in re.findall(r"\{(.*?)\},\n", body + "\n", re.S):
        q = re.search(r'q:\s*"(.*?)",\n', blk, re.S)
        ex = re.search(r"expect:\s*\[(.*?)\]", blk, re.S)
        if q and ex:
            out.append({"q": q.group(1),
                        "expect": re.findall(r'"(.*?)"', ex.group(1))})
    return out


def _in_corpus(phrases: list[str]) -> bool | None:
    """기대 문구가 색인 어딘가에 있기는 한가 — 없으면 검색 실패가 아니라 자료 부재다.

    일부 케이스는 사용자의 개인 수업 노트(grateful·cappuccino 구문)를 기대한다.
    시드만 있는 환경(새 체크아웃·CI)에서는 원천적으로 못 찾으므로 SKIP으로 센다.
    서버와 같은 저장소를 직접 읽는다(MC_DATA_DIR 존중). 못 읽으면 None."""
    import os
    import sqlite3
    from pathlib import Path
    db = Path(os.environ.get("MC_DATA_DIR") or Path(__file__).resolve().parent.parent
              / "backend" / "data") / "store.db"
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        for e in phrases:
            if con.execute("SELECT 1 FROM chunks WHERE source IN ('note','glossary') "
                           "AND lower(title||' '||text) LIKE ? LIMIT 1",
                           (f"%{e.lower()}%",)).fetchone():
                return True
        return False
    except sqlite3.Error:
        return None


def main() -> int:
    st = json.load(urllib.request.urlopen(f"{BASE}/api/rag/stats"))
    print(f"📚 색인 {st['total']}개 · 모드 {st['mode']}\n")
    cs = cases()
    assert cs, "케이스를 읽지 못했습니다 (rag-eval.ts 형식 확인)"
    ok_n = skip_n = 0
    for c in cs:
        hits = json.load(urllib.request.urlopen(
            f"{BASE}/api/rag/search?k=3&q=" + urllib.parse.quote(c["q"])))["hits"]
        blob = "\n".join(f"{h['title']} {h['text']}" for h in hits).lower()
        ok = any(e.lower() in blob for e in c["expect"])
        if not ok and _in_corpus(c["expect"]) is False:
            skip_n += 1
            print(f"⏭  {c['q']}  (기대 문구가 색인에 없음 — 개인 자료 필요, SKIP)")
            continue
        ok_n += ok
        print(f"{'✅' if ok else '❌'} {c['q']}")
        print(f"   기대: {' | '.join(c['expect'])}")
        if not ok:
            for i, h in enumerate(hits, 1):
                print(f"   {i}. [{h['source_label']}] {h['title']}")
    n = len(cs) - skip_n
    print(f"\n결과: {ok_n}/{n} ({round(ok_n / max(1, n) * 100)}%)"
          + (f" · SKIP {skip_n} (자료 부재)" if skip_n else ""))
    return 0 if ok_n >= n - 2 else 1


if __name__ == "__main__":
    sys.exit(main())
