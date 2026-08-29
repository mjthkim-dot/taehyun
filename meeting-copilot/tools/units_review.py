#!/usr/bin/env python3
"""유닛 검수 문서 생성 — 사람이 읽고 고칠 수 있는 형태로 뽑는다.

그대로 읽을 문장이므로, 기계 검사(tools/check_units.py)가 통과해도
사실관계와 말투는 본인만 판단할 수 있다. 이 문서가 그 판단의 입력이다.

  python3 tools/units_review.py            # docs/UNITS-REVIEW.md 생성 (로컬 전용)

검수 방법: 각 유닛의 ✅/✏️/❌를 정하고, 고칠 문장은 그 자리에 바로 적는다.
끝나면 answer_units.json의 reviewed를 true로 바꾼다(승인한 것만).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "backend" / "data" / "imported" / "answer_units.json"
# docs/ 아래지만 이 파일은 개인 자료다 — 저장소 .gitignore가 막는지 확인할 것.
DEST = ROOT / "docs" / "UNITS-REVIEW.md"


def main() -> int:
    units = json.loads(SRC.read_text(encoding="utf-8"))
    out: list[str] = []
    w = out.append

    w("# 답변 유닛 검수 — 그대로 읽을 문장입니다\n")
    w("> 이 문서는 **로컬 전용**입니다. 실명 고객사·실적이 들어 있어 커밋하지 않습니다.\n")
    w(f"유닛 {len(units)}개 · 승인 {sum(1 for u in units if u.get('reviewed'))}개\n")
    w("## 검수 기준 4가지\n")
    w("1. **사실이 맞는가** — 특히 숫자와 고객사. 틀리면 면접에서 그대로 나갑니다.")
    w("2. **내가 말할 법한가** — 남의 문장 같으면 읽을 때 티가 납니다.")
    w("3. **30초 판본이 30초인가** — 소리 내어 읽어 보세요. 길면 잘라 주세요.")
    w("4. **빠진 게 있는가** — 이 질문에 꼭 넣고 싶은 한 문장이 빠졌다면 적어 주세요.\n")
    w("고칠 곳은 문장 아래에 그대로 적어 주시면 제가 반영합니다.")
    w("승인한 것만 `reviewed: true`로 바꿔 발동시킵니다 — 승인 전까지 이 대본은")
    w("한 번도 뜨지 않습니다.\n")
    w("---\n")

    for i, u in enumerate(units, 1):
        n30 = len(u.get("answer_en_30s", "").split())
        n90 = len(u.get("answer_en_90s", "").split())
        w(f"## {i}. {u['note_title']}\n")
        w(f"- **요지** {u.get('gist','')}")
        w(f"- **전략** {u.get('strategy','')}")
        w(f"- **이 질문들에 뜹니다** {', '.join(u.get('intent_tags') or [])}")
        kn = ", ".join(u.get("key_numbers") or []) or "없음"
        w(f"- **말해도 되는 수치** {kn}")
        w(f"- **판정** ☐ 승인   ☐ 수정 필요   ☐ 폐기\n")
        w(f"### 30초 판본 ({n30}단어)\n")
        w(f"> {u.get('answer_en_30s','')}\n")
        w(f"### 90초 판본 ({n90}단어)\n")
        w(f"> {u.get('answer_en_90s','')}\n")
        w("**고칠 점:**\n")
        w("---\n")

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text("\n".join(out), encoding="utf-8")
    print(f"✅ {DEST}  ({len(units)}개 유닛)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
