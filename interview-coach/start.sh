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

exec python3 "$DIR/server.py"
