#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 📱 모바일 마이크(음성인식)용 HTTPS 터널
#
# 브라우저 보안 정책상 마이크는 https 주소에서만 동작합니다.
# Cloudflare 빠른 터널로 무료 https 주소를 발급받습니다 (가입 불필요).
#
# 사용법:
#   터미널 1:  python3 voice-assistant/server.py   ← 서버 먼저 실행
#   터미널 2:  bash voice-assistant/mobile.sh      ← 이 스크립트 실행
#   휴대폰:    출력되는 https://xxxx.trycloudflare.com 주소로 접속
# ─────────────────────────────────────────────────────────────

PORT="${PORT:-3000}"

if ! command -v cloudflared &> /dev/null; then
  echo "📦 cloudflared가 설치되어 있지 않습니다. 설치를 시작합니다..."
  if command -v brew &> /dev/null; then
    brew install cloudflared || { echo "❌ 설치 실패"; exit 1; }
  else
    echo "❌ Homebrew가 없습니다. 먼저 https://brew.sh 에서 Homebrew를 설치하세요."
    exit 1
  fi
fi

if ! curl -s -o /dev/null --max-time 2 "http://localhost:${PORT}"; then
  echo "⚠️  서버가 실행 중이 아닙니다. 다른 터미널에서 먼저 실행하세요:"
  echo "    python3 voice-assistant/server.py"
  echo ""
fi

echo ""
echo "  🌍 HTTPS 터널 생성 중..."
echo "  ───────────────────────────────────────────────"
echo "  아래에 나오는 https://xxxx.trycloudflare.com 주소를"
echo "  휴대폰 브라우저에 입력하세요. (마이크 🎙️ 사용 가능)"
echo "  종료: Ctrl+C"
echo ""

cloudflared tunnel --url "http://localhost:${PORT}"
