#!/bin/bash
# 자료 묶음(zip) 적용 — 맥북에서 한 번만 실행.
#   bash meeting-copilot/tools/apply_bundle.sh ~/Downloads/mc-data-v6.2.zip
# 하는 일: 기존 자료 백업 → zip 풀기 → 재적재(임베딩·사실 정정 포함) → 프리플라이트
set -eu
ZIP="${1:?사용법: bash tools/apply_bundle.sh <zip 경로>}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$DIR/backend/data"
[ -f "$ZIP" ] || { echo "❌ 파일 없음: $ZIP"; exit 1; }
[ -n "${GEMINI_API_KEY:-}" ] || { echo "❌ GEMINI_API_KEY가 없습니다 — export GEMINI_API_KEY=... 후 재실행"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
if [ -d "$DATA/imported" ]; then
  mkdir -p "$DATA/backups"
  cp -R "$DATA/imported" "$DATA/backups/imported-$STAMP"
  echo "📦 기존 자료 백업 → backend/data/backups/imported-$STAMP"
fi
mkdir -p "$DATA"
unzip -qo "$ZIP" -d "$DATA"
echo "📂 자료 적용 완료:"
ls "$DATA/imported" "$DATA/imported/core" "$DATA/imported/company" 2>/dev/null | sed 's/^/   /'
echo
python3 "$DIR/tools/import_private.py" --replace
echo
bash "$DIR/preflight.sh" --skip-mic
