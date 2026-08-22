#!/bin/bash
# 🩺 사전 점검 — 앱 실행 전에 마이크·키·모델·포트를 확인합니다
#   사용법: bash meeting-copilot/doctor.sh        (Whisper 다운로드는 물어봄)
#           bash meeting-copilot/doctor.sh --yes  (자동 다운로드 승인)
DIR="$(cd "$(dirname "$0")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3가 없습니다 — 먼저 설치하세요:"
  echo "   → xcode-select --install   (또는 brew install python3)"
  exit 1
fi
exec python3 "$DIR/tools/fieldtest.py" doctor "$@"
