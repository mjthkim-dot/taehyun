#!/usr/bin/env python3
"""리허설 — 골든셋 40문항에 앱이 **실제로 뭐라고 답하는지** 전부 뽑는다.

왜 필요한가: 유닛(Tier A)은 6문항만 덮는다. 나머지는 생성(Tier B)인데,
그 문장을 면접장에서 처음 본다면 그때 품질을 확인하는 셈이다. 미리 본다.

실제 LLM을 호출한다(문항당 ~2초, 40문항 ≈ 1.5분). 실키가 필요하다.

  GEMINI_API_KEY=... python3 tools/rehearse.py          # 전체
  GEMINI_API_KEY=... python3 tools/rehearse.py -n 8     # 앞 8문항만

결과: docs/REHEARSAL.md (로컬 전용 — 실명 고객사·실적이 들어간다)
"""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tests"))
import llm  # noqa: E402
import prompts  # noqa: E402
import rag  # noqa: E402
import golden_routing as G  # noqa: E402

DEST = ROOT / "docs" / "REHEARSAL.md"
# 축 이름 — 골든셋의 순서가 곧 축의 순서다(딜 → 파이프라인 → 숫자 → …).
AXES = [(0, "딜 딥다이브"), (8, "파이프라인"), (13, "숫자"), (17, "제품·경쟁"),
        (23, "방법론·프레임워크"), (27, "파트너"), (29, "동기"), (33, "실행"),
        (35, "협업·영어"), (37, "보상"), (38, "코퍼스 밖 (지어내면 안 됨)")]


def axis_of(i: int) -> str:
    name = ""
    for start, n in AXES:
        if i >= start:
            name = n
    return name


def main() -> int:
    n = int(sys.argv[sys.argv.index("-n") + 1]) if "-n" in sys.argv else len(G.CASES)
    st = rag.default_store()
    out: list[str] = []
    w = out.append
    w("# 리허설 — 면접 40문항에 앱이 실제로 하는 답\n")
    w("> **로컬 전용.** 실명 고객사·실적이 들어 있어 커밋하지 않습니다.\n")
    w("보는 법 — 각 답변에 대해 세 가지만 봐 주세요.\n")
    w("1. **사실이 틀린 곳** — 특히 숫자와 고객사. 틀리면 그대로 나갑니다.")
    w("2. **내 말투가 아닌 곳** — 어색하면 읽을 때 티가 납니다.")
    w("3. **질문에 답하지 않는 곳** — 딴 얘기를 하면 회피로 들립니다.\n")
    import os as _os
    if _os.environ.get("UNITS_ALLOW_UNREVIEWED") == "1":
        w("> ⚠️ **검수 후 상태**로 뽑았습니다 — 유닛을 승인했다고 가정한 결과입니다.")
        w("> 지금 앱은 미검수 유닛을 쓰지 않으므로 실제 동작은 이보다 보수적입니다.\n")
    w("`📌 검수된 대본`은 제가 쓴 초안을 그대로 읽는 경로(Tier A)이고,")
    w("나머지는 자료를 근거로 그때그때 생성됩니다(Tier B).")
    w("`📭 대본 없음`은 근거를 못 찾아 **일부러 생성하지 않은** 것입니다.\n")
    w("---\n")

    last_axis = None
    t_all = time.time()
    for i, c in enumerate(G.CASES[:n]):
        ax = axis_of(i)
        if ax != last_axis:
            w(f"\n# {ax}\n")
            last_axis = ax
        b = prompts.build_suggest(c["q"], "", "reply", "B2", store=st, preset="interview")
        tier = b["tier"]
        t0 = time.time()
        if tier == "A":
            a = prompts.build_tier_a(b["unit"])
            en, gist, strat = a["en"], a["gist"], a["strategy"]
            src = f"📌 검수된 대본 — {a['note_title']}"
        elif tier == "C":
            cc = prompts.build_tier_c(c["q"], store=st)
            en, gist, strat = cc["en"], cc["gist"], cc["strategy"]
            src = "📭 대본 없음 — 생성하지 않음"
        else:
            raw = llm.chat_once([{"role": "user", "content": b["prompt"]}],
                                False, 0.4, 2400) or ""
            en = (re.search(r"EN\s*[:：]\s*([\s\S]*?)(?:\n===|$)", raw) or [None, raw])[1]
            en = (en or "").strip().replace(" / ", " ")
            gist = (re.search(r"요지\s*=\s*([^|]+)", raw) or [None, ""])[1].strip()
            strat = (re.search(r"전략\s*=\s*(.+)", raw) or [None, ""])[1].strip()
            src = " · ".join(b["sources"]) or "(근거 없음)"
        dt = time.time() - t0
        w(f"## {i+1}. {c['q']}\n")
        w(f"- **경로** `{tier}` · {dt:.1f}초 · {src}")
        if gist:
            w(f"- **요지** {gist}")
        if strat:
            w(f"- **전략** {strat}")
        w(f"- **판정** ☐ 그대로 좋음   ☐ 사실 틀림   ☐ 말투 어색   ☐ 질문에 답 안 함\n")
        w(f"> {en}\n")
        w("**고칠 점:**\n")
        print(f"  [{tier}] {dt:4.1f}s  {c['q'][:56]}")

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text("\n".join(out), encoding="utf-8")
    print(f"\n✅ {DEST}  ({n}문항 · 총 {time.time()-t_all:.0f}초)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
