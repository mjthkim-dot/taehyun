#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 🚀 PREPLY AI 스피킹 코치 — 원클릭 실행
#
# 이 스크립트 하나로 전부 자동 처리됩니다:
#   1. 의존성 확인/설치 (requests, cloudflared)
#   2. 서버 실행
#   3. 모바일용 HTTPS 터널 생성
#   4. PC/모바일 접속 주소 출력
#
# 사용법:  bash voice-assistant/start.sh
# 종료:    Ctrl+C (서버와 터널 모두 함께 종료됩니다)
# ─────────────────────────────────────────────────────────────

set -u
PORT="${PORT:-3777}"
DIR="$(cd "$(dirname "$0")" && pwd)"
TUNNEL_LOG="/tmp/preply-tunnel-$$.log"  # macOS/Linux 양쪽 호환 (mktemp 접미사 문제 회피)
SERVER_PID=""
TUNNEL_PID=""

cleanup() {
  echo ""
  echo "  🛑 종료 중..."
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  rm -f "$TUNNEL_LOG"
  echo "  👋 서버와 터널이 모두 종료되었습니다."
  exit 0
}
trap cleanup INT TERM

echo ""
echo "  🎓 PREPLY AI 스피킹 코치 — 자동 실행"
echo "  ═══════════════════════════════════════════"

# ── 1. Python requests 확인/설치 ──────────────────
if ! python3 -c "import requests" 2>/dev/null; then
  echo "  📦 requests 설치 중..."
  pip3 install --quiet requests || { echo "  ❌ pip3 install requests 실패"; exit 1; }
fi

# ── 2. cloudflared 확인/설치 ─────────────────────
if ! command -v cloudflared &>/dev/null; then
  echo "  📦 cloudflared 설치 중... (최초 1회)"
  if command -v brew &>/dev/null; then
    brew install cloudflared || { echo "  ❌ cloudflared 설치 실패"; exit 1; }
  else
    echo "  ❌ Homebrew가 없습니다. https://brew.sh 에서 설치 후 다시 실행하세요."
    exit 1
  fi
fi

# ── 3. Ollama 확인 ───────────────────────────────
if ! curl -s --max-time 2 "http://localhost:11434/api/tags" >/dev/null; then
  echo "  ⚠️  Ollama가 실행 중이 아닙니다. 백그라운드로 시작합니다..."
  if command -v ollama &>/dev/null; then
    nohup ollama serve >/dev/null 2>&1 &
    sleep 2
  else
    echo "  ❌ ollama 명령을 찾을 수 없습니다. Ollama 앱을 먼저 실행해 주세요."
  fi
fi

# ── 3-1. 권장 모델 확인 ──────────────────────────
RECOMMENDED="gemma3:27b"
if command -v ollama &>/dev/null; then
  if ! ollama list 2>/dev/null | grep -q "$RECOMMENDED"; then
    echo ""
    echo "  💡 권장 모델($RECOMMENDED)이 없습니다."
    echo "     최고 품질을 위해 아래 명령으로 다운로드하세요 (약 17GB):"
    echo "     ollama pull $RECOMMENDED"
    echo "     저사양: ollama pull gemma3:12b  또는  ollama pull gemma3:4b"
    echo ""
  fi

  # 🆕 실시간 번역 / 영어 답변셋(RAG)에 쓰는 임베딩 모델
  EMBED_MODEL="nomic-embed-text"
  if ! ollama list 2>/dev/null | grep -q "$EMBED_MODEL"; then
    echo ""
    echo "  💡 RAG 임베딩 모델($EMBED_MODEL)이 없습니다. 영어 답변셋 기능에 필요합니다:"
    echo "     ollama pull $EMBED_MODEL"
    echo ""
  fi
fi

# ── 4. 기존 서버 정리 후 서버 실행 ─────────────────
EXISTING=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
[ -n "$EXISTING" ] && kill $EXISTING 2>/dev/null && sleep 1

# 백엔드 선택:
#   · BACKEND=fastapi 이고 uvicorn/fastapi 설치돼 있으면 풀스택(FastAPI+LangChain) 경로
#   · 그 외에는 의존성 0 stdlib server.py (CAF 분석 포함, 항상 동작)
if [ "${BACKEND:-}" = "fastapi" ] && python3 -c "import fastapi, uvicorn" 2>/dev/null; then
  echo "  🧠 FastAPI 백엔드로 실행 (AI 스피치 파이프라인 + WebSocket)"
  ( cd "$DIR/backend" && python3 -m uvicorn main:app --host "${HOST:-0.0.0.0}" --port "$PORT" ) &
else
  [ "${BACKEND:-}" = "fastapi" ] && echo "  ℹ️  FastAPI 미설치 → stdlib server.py로 폴백 (pip install -r backend/requirements.txt 로 활성화)"
  python3 "$DIR/server.py" &
fi
SERVER_PID=$!
sleep 2

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "  ❌ 서버 시작 실패"
  exit 1
fi

# ── 5. HTTPS 터널 생성 ───────────────────────────
echo ""
echo "  🌍 모바일용 HTTPS 터널 생성 중... (몇 초 걸립니다)"
cloudflared tunnel --url "http://localhost:${PORT}" >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

URL=""
for i in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

# ── 6. 접속 주소 안내 ────────────────────────────
echo ""
echo "  ═══════════════════════════════════════════"
echo "  ✅ 준비 완료!"
echo ""
echo "  🖥  PC:      http://localhost:${PORT}"
if [ -n "$URL" ]; then
  echo "  📱 모바일:  ${URL}"
  echo ""
  echo "     ↑ 이 주소를 휴대폰 브라우저에 입력하세요."
  echo "       (https라서 🎙️ 마이크도 동작합니다)"
else
  echo "  ⚠️  터널 주소를 가져오지 못했습니다. 로그: $TUNNEL_LOG"
fi
echo ""
echo "  🛑 종료: Ctrl+C"
echo "  ═══════════════════════════════════════════"
echo ""

wait
