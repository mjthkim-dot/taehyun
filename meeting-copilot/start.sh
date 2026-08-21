#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 🗣 실시간 영어 미팅 어시스턴트
#
# LLM 키는 하나만 있으면 됨 (Groq → Cerebras → Gemini → Ollama 자동 전환):
#   export CEREBRAS_API_KEY=csk-...  # cloud.cerebras.ai (무료·가장 빠름)
#   export GEMINI_API_KEY=...        # aistudio.google.com/apikey (회사망 통과율↑)
# 의미 검색(선택): ollama pull bge-m3   ← 한국어 노트를 영어로 검색
# ─────────────────────────────────────────────────────────────
set -u
PORT="${PORT:-3799}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  🗣  실시간 영어 미팅 어시스턴트"
echo "  ═══════════════════════════════════════"
[ -n "${CEREBRAS_API_KEY:-}" ] && echo "  · Cerebras 키 설정됨 (오픈소스 70B — 가장 빠름)"
[ -n "${GROQ_API_KEY:-}" ]     && echo "  · Groq 키 설정됨"
[ -n "${GEMINI_API_KEY:-}" ]   && echo "  · Gemini 키 설정됨"
if [ -z "${CEREBRAS_API_KEY:-}" ] && [ -z "${GROQ_API_KEY:-}" ] && [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "  ⚠️ 클라우드 LLM 키가 없습니다 — 무료 키를 하나 넣으세요:"
  echo "       https://cloud.cerebras.ai  →  export CEREBRAS_API_KEY=..."
fi
if curl -s --max-time 2 "http://localhost:11434/api/tags" 2>/dev/null | grep -q bge-m3; then
  echo "  · bge-m3 감지 — 의미 검색 활성 (한국어 노트 ↔ 영어 발언)"
else
  echo "  💡 의미 검색을 켜려면: ollama pull bge-m3  (무료·로컬, 없어도 키워드로 동작)"
fi

EXISTING=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
[ -n "$EXISTING" ] && kill $EXISTING 2>/dev/null && sleep 1

SERVER_PID=""; TUNNEL_PID=""; TUNNEL_LOG="/tmp/meeting-copilot-tunnel-$$.log"
cleanup(){ [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
           [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
           rm -f "$TUNNEL_LOG"; echo ""; echo "  👋 종료되었습니다."; exit 0; }
trap cleanup INT TERM

python3 "$DIR/server.py" &
SERVER_PID=$!
sleep 1.5

# 📱 폰에서 쓰려면 HTTPS 필요 (브라우저가 http에서 마이크를 막는다)
if command -v cloudflared &>/dev/null; then
  cloudflared tunnel --url "http://localhost:${PORT}" >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!
  for i in $(seq 1 30); do
    TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
    [ -n "${TUNNEL_URL:-}" ] && break
    sleep 1
  done
  [ -n "${TUNNEL_URL:-}" ] && echo "" && echo "  📱 폰에서: ${TUNNEL_URL}/app.html"
fi
echo ""
wait "$SERVER_PID"
cleanup
