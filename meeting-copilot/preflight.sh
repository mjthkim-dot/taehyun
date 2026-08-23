#!/bin/bash
# ⚡ 프리플라이트 — 실전 당일 아침용 30초 축약 점검 (doctor의 핵심만)
#   사용법: bash meeting-copilot/preflight.sh              (마이크 포함)
#           bash meeting-copilot/preflight.sh --skip-mic   (탭 오디오 전용이면)
#   마지막 줄이 판정: "✅ 실전 투입 가능" 또는 "❌ [항목] — [조치]"
DIR="$(cd "$(dirname "$0")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3 — xcode-select --install 후 재실행"
  exit 1
fi
exec python3 "$DIR/tools/fieldtest.py" preflight "$@"
