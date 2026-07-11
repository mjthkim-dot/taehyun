#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 🎤 영어 면접 코치 — 실행 스크립트 (독립 프로젝트, 의존성 0)
#
# 사용법:  bash start.sh
# 종료:    Ctrl+C
# ─────────────────────────────────────────────────────────────

set -u
PORT="${PORT:-3778}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  🎤 영어 면접 코치 — IT 영업"
echo "  ═══════════════════════════════════════════"

# ── Groq 모드 안내 ───────────────────────────────
# GROQ_API_KEY가 있으면 답변 생성/번역이 Groq(초당 수백 토큰)로 동작한다.
# 임베딩(nomic-embed-text)은 Groq에 없어 항상 로컬 Ollama를 사용한다.
if [ -n "${GROQ_API_KEY:-}" ]; then
  echo "  ⚡ Groq 모드 활성 — 답변/번역: ${GROQ_MODEL:-llama-3.3-70b-versatile}"
else
  echo "  🔒 로컬 모드 — 답변 생성도 Ollama 사용 (빠른 응답 원하면: export GROQ_API_KEY=...)"
fi

# ── Ollama 확인 (임베딩 검색에 필요, Groq 모드에서도 필요) ──
if ! curl -s --max-time 2 "http://localhost:11434/api/tags" >/dev/null; then
  echo "  ⚠️  Ollama가 실행 중이 아닙니다. 백그라운드로 시작합니다..."
  if command -v ollama &>/dev/null; then
    nohup ollama serve >/dev/null 2>&1 &
    sleep 2
  else
    echo "  ❌ ollama 명령을 찾을 수 없습니다. https://ollama.com 에서 설치 후 재실행하세요."
  fi
fi

if command -v ollama &>/dev/null; then
  EMBED_MODEL="${EMBED_MODEL:-nomic-embed-text}"
  if ! ollama list 2>/dev/null | grep -q "$EMBED_MODEL"; then
    echo ""
    echo "  💡 임베딩 모델($EMBED_MODEL)이 없습니다. 질문/프로필 검색에 필요합니다 (~270MB):"
    echo "     ollama pull $EMBED_MODEL"
    echo ""
  fi

  # 로컬 모드일 때만 답변 생성용 모델도 확인 (Groq 모드면 불필요)
  if [ -z "${GROQ_API_KEY:-}" ]; then
    OLLAMA_MODEL="${OLLAMA_MODEL:-gemma3:12b}"
    if ! ollama list 2>/dev/null | grep -q "$OLLAMA_MODEL"; then
      echo ""
      echo "  💡 답변 생성 모델($OLLAMA_MODEL)이 없습니다. 먼저 다운로드하세요:"
      echo "     ollama pull $OLLAMA_MODEL"
      echo ""
    fi
  fi
fi

# ── 기존 서버 정리 후 실행 ───────────────────────
EXISTING=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
[ -n "$EXISTING" ] && kill $EXISTING 2>/dev/null && sleep 1

exec python3 "$DIR/server.py"
