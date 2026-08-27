#!/usr/bin/env python3
"""코드를 Claude에 붙여넣기 좋은 조각으로 묶는다.

  python3 tools/code_bundle.py          # 조각 목록 + 바탕화면에 파일로 저장
  python3 tools/code_bundle.py 2        # 2번 조각을 클립보드로 복사 (⌘V로 붙여넣기)
  python3 tools/code_bundle.py all      # 전체를 한 파일로 (드래그해서 첨부할 때)
  python3 tools/code_bundle.py json     # JSON 구조로 (파일 경계가 명확 — 분석에 유리)

개인 데이터(미팅 기록·개인 노트·인증 DB)와 API 키는 들어가지 않는다 —
포함 파일은 backend/codebundle.py의 화이트리스트로만 정해진다.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import codebundle as cb  # noqa: E402

OUT = Path.home() / "Desktop" / "meeting-copilot-code"


def _copy(text: str) -> bool:
    for cmd in (["pbcopy"], ["xclip", "-selection", "clipboard"], ["wl-copy"]):
        try:
            subprocess.run(cmd, input=text.encode(), check=True)
            return True
        except (OSError, subprocess.CalledProcessError):
            continue
    return False


def main() -> int:
    parts = cb.parts()
    arg = sys.argv[1] if len(sys.argv) > 1 else ""

    if arg == "json":
        OUT.mkdir(parents=True, exist_ok=True)
        import json
        full = cb.as_json()
        f = OUT / "전체코드.json"
        f.write_text(json.dumps(full, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\n✅ 전체 JSON — {f}  ({f.stat().st_size:,} bytes · 파일 {len(full['files'])}개)")
        for i, g in enumerate(cb.json_groups(), 1):
            part = cb.as_json(g)
            if not part["files"]:
                continue
            pf = OUT / f"코드-{i}-{g.replace('·', '_')}.json"
            pf.write_text(json.dumps(part, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"   {i}) {pf.name}  ({pf.stat().st_size:,} bytes)")
        print("\n   조각 파일도 각각 그 자체로 유효한 JSON입니다 — 나눠 넣어도 파싱됩니다.")
        return 0

    if arg == "all":
        OUT.mkdir(parents=True, exist_ok=True)
        f = OUT / "전체코드.md"
        f.write_text("\n\n".join(parts), encoding="utf-8")
        print(f"\n✅ 한 파일로 저장 — {f}")
        print("   Claude 대화창에 이 파일을 드래그해서 넣으면 됩니다 (붙여넣기보다 편합니다).")
        return 0

    if arg.isdigit():
        n = int(arg)
        if not 1 <= n <= len(parts):
            print(f"❌ 1~{len(parts)} 사이의 번호를 넣어주세요.")
            return 1
        text = parts[n - 1]
        if _copy(text):
            print(f"\n✅ {n}번 조각({len(text):,}자)을 복사했습니다.")
            print("   Claude 대화창에서 ⌘V로 붙여넣으세요.")
            if n < len(parts):
                print(f"   다음: python3 tools/code_bundle.py {n + 1}")
            else:
                print("   마지막 조각입니다 — 이제 질문하시면 됩니다.")
        else:
            print("⚠️ 클립보드 복사에 실패했습니다 — 아래 파일을 여세요.")
            OUT.mkdir(parents=True, exist_ok=True)
            f = OUT / f"코드-{n}.md"
            f.write_text(text, encoding="utf-8")
            print(f"   {f}")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    print(f"\n📦 코드 스냅샷 — 조각 {len(parts)}개 (개인 데이터·API 키 제외됨)\n")
    for i, t in enumerate(parts, 1):
        files = t.split("이 조각에 담긴 파일: ")[1].split("\n")[0]
        (OUT / f"코드-{i}.md").write_text(t, encoding="utf-8")
        print(f"  {i}) {len(t):>7,}자  {files}")
    print(f"\n✅ 파일로 저장했습니다 — {OUT}")
    print("\n둘 중 편한 방법으로 Claude에 넘기세요:")
    print("  · 파일 드래그(권장): 위 폴더의 .md 파일들을 Claude 대화창에 끌어다 놓기")
    print("  · 복사·붙여넣기   : python3 tools/code_bundle.py 1 → ⌘V → 2 → ⌘V …")
    return 0


if __name__ == "__main__":
    sys.exit(main())
