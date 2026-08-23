#!/usr/bin/env python3
"""붙여넣기 임포트 — 클립보드 순서 문제 없이 개인 코퍼스를 적재한다.

  python3 tools/paste_import.py

실행하면 터미널이 '붙여넣기 대기' 상태가 된다. 그 상태에서 코퍼스 JSON을
⌘V로 붙여넣으면 끝을 자동 감지해 검증 → 저장 → --replace 재학습까지 한 번에
처리한다. Enter도, Ctrl+D도, 파일 다운로드도, 복사 순서도 필요 없다.

구현 노트 (맥북 실측 2건):
 · pbpaste 방식은 '명령을 복사하는 순간 클립보드의 JSON이 지워지는' 순서
   함정이 있다 → 먼저 실행해 두고 나중에 붙여넣는 구조로 제거.
 · 기본(canonical) 터미널 입력은 한 줄 1,024바이트 제한이 있어 한글 포함
   긴 JSON 줄이 중간에서 잘린다(정확히 같은 지점에서 2회 재현) → termios로
   raw(cbreak) 모드 전환 후 os.read로 바이트를 직접 읽어 제한을 우회한다.
"""
from __future__ import annotations

import json
import os
import select
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "backend" / "data" / "imported" / "workato-corpus.json"


def _read_paste() -> str | None:
    """stdin에서 붙여넣기 전체를 수신한다. JSON 배열이 완성되면 즉시 반환."""
    fd = sys.stdin.fileno()
    tty_mode = sys.stdin.isatty()
    old = None
    if tty_mode:
        import termios
        import tty
        old = termios.tcgetattr(fd)
        tty.setcbreak(fd)                      # 줄 길이 제한(1024B) 해제
    buf = bytearray()
    try:
        while True:
            r, _, _ = select.select([fd], [], [], 0.4)
            if r:
                d = os.read(fd, 65536)
                if not d:                      # EOF (파이프 입력)
                    break
                buf += d
                print(f"\r   수신 중… {len(buf):,}바이트", end="", flush=True)
            else:
                if not buf:
                    continue                   # 아직 붙여넣기 전 — 계속 대기
                # 0.4초 조용 → 붙여넣기가 끝났을 가능성. 완성됐는지 확인.
                try:
                    s = bytes(buf).decode("utf-8").strip()
                except UnicodeDecodeError:
                    continue                   # 멀티바이트 경계 — 더 기다림
                if s.endswith("]"):
                    try:
                        json.loads(s)
                        print()
                        return s
                    except json.JSONDecodeError:
                        pass                   # 본문 속 ']' — 더 기다림
        s = bytes(buf).decode("utf-8", "replace").strip()
        print()
        return s or None
    except KeyboardInterrupt:
        print("\n취소했습니다.")
        return None
    finally:
        if tty_mode and old is not None:
            import termios
            termios.tcsetattr(fd, termios.TCSADRAIN, old)


def main() -> int:
    print()
    print("📋 코퍼스 붙여넣기 대기 중…")
    print("   1) Chrome의 전달함 페이지에서 [📋 코퍼스 JSON 복사] 클릭")
    print("   2) 이 터미널을 클릭하고 ⌘V — 수신 바이트가 올라가다 자동으로 끝납니다")
    print("   (붙여넣은 내용은 화면에 표시되지 않습니다 · 취소: Ctrl+C)")
    print()

    s = _read_paste()
    if s is None:
        return 1
    try:
        data = json.loads(s)
        assert isinstance(data, list) and data
    except (json.JSONDecodeError, AssertionError):
        print()
        print(f"❌ 완전한 JSON 배열이 아닙니다 (수신 {len(s):,}자, 시작: {s[:50]!r})")
        print("   페이지의 [📋 코퍼스 JSON 복사] 버튼으로 다시 복사한 뒤 재실행하세요.")
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
