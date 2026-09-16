#!/usr/bin/env bash
# 새 고객사 폴더 개설 — _TEMPLATE 복사 + 플레이스홀더 치환.
# 사용법: ./automation/scripts/new-account.sh <slug> "<고객사명>"
set -euo pipefail

SLUG="${1:-}"
NAME="${2:-}"

if [[ -z "$SLUG" || -z "$NAME" ]]; then
  echo "사용법: $0 <slug> \"<고객사명>\"" >&2
  echo "  slug: 영문 소문자+하이픈만 (예: lg-cns)" >&2
  exit 1
fi

if [[ ! "$SLUG" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  echo "오류: slug 는 영문 소문자·숫자·하이픈만 허용한다 (받은 값: $SLUG)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST="$ROOT/accounts/$SLUG"

if [[ -e "$DEST" ]]; then
  echo "오류: 이미 존재한다 — $DEST" >&2
  exit 1
fi

cp -R "$ROOT/accounts/_TEMPLATE" "$DEST"

TODAY="$(date +%F)"
for f in "$DEST/account.md" "$DEST/timeline.md"; do
  tmp="$f.tmp"
  sed -e "s|<고객사명>|$NAME|g" -e "s|<slug>|$SLUG|g" -e "s|YYYY-MM-DD|$TODAY|g" "$f" > "$tmp"
  mv "$tmp" "$f"
done

echo "생성됨: work/accounts/$SLUG"
echo "다음: account.md 의 §3 MEDDPICC 갭을 채우고 pipeline.csv 에 행을 추가한다."
