#!/usr/bin/env python3
"""붙여넣기 임포트 — 클립보드 순서 문제 없이 개인 코퍼스를 적재한다.

  python3 tools/paste_import.py

실행하면 터미널이 '붙여넣기 대기' 상태가 된다. 그 상태에서 코퍼스 JSON을
⌘V로 붙여넣으면 끝을 자동 감지해 검증 → 저장 → --replace 재학습까지 한 번에
처리한다. Ctrl+D도, 파일 다운로드도, 복사 순서도 필요 없다.

배경: pbpaste 방식은 '명령을 복사하는 순간 클립보드의 JSON이 지워지는'
순서 함정이 있다(맥북 실전에서 3회 재현). 이 도구는 명령을 먼저 실행해 두고
JSON을 나중에 붙여넣는 구조라 그 함정이 원천적으로 없다.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "backend" / "data" / "imported" / "workato-corpus.json"


def main() -> int:
    print()
    print("📋 코퍼스 붙여넣기 대기 중…")
    print("   1) Chrome의 전달함 페이지에서 [📋 코퍼스 JSON 복사] 클릭")
    print("   2) 이 터미널을 클릭하고 ⌘V (붙여넣기)")
    print("   붙여넣으면 끝을 자동으로 감지합니다. (취소: Ctrl+C)")
    print()

    buf: list[str] = []
    data = None
    try:
        while True:
            line = sys.stdin.readline()
            if line == "":                      # EOF (Ctrl+D도 허용)
                break
            buf.append(line)
            joined = "".join(buf).strip()
            # JSON 배열이 닫힌 것처럼 보일 때만 파싱 시도 — 붙여넣기 도중의
            # 불완전 상태에서 매번 파싱하는 낭비를 피한다
            if joined.endswith("]"):
                try:
                    data = json.loads(joined)
                    break
                except json.JSONDecodeError:
                    continue                    # 본문 속 ']' — 계속 수신
    except KeyboardInterrupt:
        print("\n취소했습니다.")
        return 1

    if not isinstance(data, list) or not data:
        got = "".join(buf).strip()
        print()
        if not got:
            print("❌ 아무것도 받지 못했습니다 — 페이지에서 JSON을 복사한 뒤 다시 실행하세요.")
        else:
            print(f"❌ JSON 배열이 아닙니다 (받은 내용 시작: {got[:60]!r})")
            print("   페이지의 [📋 코퍼스 JSON 복사] 버튼으로 복사했는지 확인하세요.")
        return 1

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n✅ 수신 완료 — {len(data)}개 항목 → {DEST}")
    print("   재학습(--replace) 실행 중…\n")
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "import_private.py"),
                        "--replace"])
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
