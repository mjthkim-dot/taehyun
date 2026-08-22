#!/bin/bash
# 🔬 구간별 스모크 테스트 — 마이크→STT→번역→검색→제안을 단계별로 검증합니다
#   사용법: bash meeting-copilot/smoke.sh
#           bash meeting-copilot/smoke.sh --skip-mic   (마이크 없이 2~4단계만)
#   결과는 화면 + docs/REPORT.md 10.1절에 실측값으로 기록됩니다
DIR="$(cd "$(dirname "$0")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3가 없습니다 — bash doctor.sh 를 먼저 실행하세요"
  exit 1
fi
exec python3 "$DIR/tools/fieldtest.py" smoke "$@"
