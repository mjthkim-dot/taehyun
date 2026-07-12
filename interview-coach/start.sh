#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 🎤 영어 면접 코파일럿 — 실행 스크립트 (Groq 단일 백엔드)
#
# 필수:   export GROQ_API_KEY=gsk_...   (~/.zshrc에 넣어두면 편함)
# 사용법: bash start.sh
# 종료:   Ctrl+C
# ─────────────────────────────────────────────────────────────

set -u
PORT="${PORT:-3778}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  🎤 영어 면접 코파일럿 — IT 영업"
echo "  ═══════════════════════════════════════════"

if [ -n "${GROQ_API_KEY:-}" ]; then
  echo "  ⚡ Groq 모드 — LLM: ${GROQ_MODEL:-llama-3.3-70b-versatile} · STT: ${GROQ_STT_MODEL:-whisper-large-v3-turbo}"
else
  echo "  ❌ GROQ_API_KEY가 설정되지 않았습니다!"
  echo "     실시간 음성 인식(STT)과 빠른 답변 생성에 Groq가 필요합니다:"
  echo "       export GROQ_API_KEY=gsk_...   # https://console.groq.com 에서 발급"
  echo "     (키 없이 실행하면: 답변 생성은 로컬 Ollama 폴백, 라이브 음성 인식은 비활성)"
fi

# ── 기존 서버 정리 후 실행 ───────────────────────
EXISTING=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
[ -n "$EXISTING" ] && kill $EXISTING 2>/dev/null && sleep 1

SERVER_PID=""
TUNNEL_PID=""
TUNNEL_LOG="/tmp/interview-coach-tunnel-$$.log"

cleanup() {
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  rm -f "$TUNNEL_LOG"
  echo ""
  echo "  👋 종료되었습니다."
  exit 0
}
trap cleanup INT TERM

python3 "$DIR/server.py" &
SERVER_PID=$!
sleep 1.5

# ── 📱 아이폰용 HTTPS 터널 (마이크는 https에서만 동작) ──
# cloudflared가 있으면 자동 생성 (없으면: brew install cloudflared)
if command -v cloudflared &>/dev/null; then
  cloudflared tunnel --url "http://localhost:${PORT}" >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!
  TUNNEL_URL=""
  for i in $(seq 1 30); do
    TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
    [ -n "$TUNNEL_URL" ] && break
    sleep 1
  done
  echo ""
  if [ -n "$TUNNEL_URL" ]; then
    echo "  📱 아이폰(사파리): ${TUNNEL_URL}/interview.html"
    echo "     └ 공유 → '홈 화면에 추가'로 앱처럼 설치 가능 (주소는 실행마다 바뀜)"
    echo "     └ 라이브 모드(탭 오디오 캡처)는 데스크톱 Chrome 전용입니다"
  else
    echo "  ⚠️  터널 주소를 가져오지 못했습니다. 로그: $TUNNEL_LOG"
  fi
else
  echo ""
  echo "  📱 아이폰에서 쓰려면 HTTPS 터널이 필요합니다 (최초 1회):"
  echo "     brew install cloudflared   → 재실행하면 아이폰용 주소가 자동 출력됩니다"
fi
echo ""

wait "$SERVER_PID"
cleanup
