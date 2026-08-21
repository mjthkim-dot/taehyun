#!/usr/bin/env python3
"""tests/rag-eval.ts와 같은 케이스를 돌리는 파이썬 러너 (node/deno 없이 검증용)."""
import json
import re
import sys
import urllib.parse
import urllib.request

BASE = "http://localhost:3799"
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


def main() -> int:
    st = json.load(urllib.request.urlopen(f"{BASE}/api/rag/stats"))
    print(f"📚 색인 {st['total']}개 · 모드 {st['mode']}\n")
    cs = cases()
    assert cs, "케이스를 읽지 못했습니다 (rag-eval.ts 형식 확인)"
    ok_n = 0
    for c in cs:
        hits = json.load(urllib.request.urlopen(
            f"{BASE}/api/rag/search?k=3&q=" + urllib.parse.quote(c["q"])))["hits"]
        blob = "\n".join(f"{h['title']} {h['text']}" for h in hits).lower()
        ok = any(e.lower() in blob for e in c["expect"])
        ok_n += ok
        print(f"{'✅' if ok else '❌'} {c['q']}")
        print(f"   기대: {' | '.join(c['expect'])}")
        if not ok:
            for i, h in enumerate(hits, 1):
                print(f"   {i}. [{h['source_label']}] {h['title']}")
    print(f"\n결과: {ok_n}/{len(cs)} ({round(ok_n / len(cs) * 100)}%)")
    return 0 if ok_n >= 8 else 1


if __name__ == "__main__":
    sys.exit(main())
