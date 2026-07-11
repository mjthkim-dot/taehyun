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
  # macOS 최신 Python(PEP 668)은 시스템 전역 설치를 막는 경우가 있어 폴백을 둔다.
  pip3 install --quiet requests \
    || pip3 install --quiet --break-system-packages requests \
    || pip3 install --quiet --user requests \
    || { echo "  ❌ pip3 install requests 실패 — 수동 설치: pip3 install --user requests"; exit 1; }
fi

# ── 2. cloudflared 확인/설치 (모바일 접속용, 선택 사항) ──
# 없어도 로컬(맥북) 사용에는 지장 없음 — 실패해도 서버는 계속 켠다.
TUNNEL_AVAILABLE=1
if ! command -v cloudflared &>/dev/null; then
  if command -v brew &>/dev/null; then
    echo "  📦 cloudflared 설치 중... (모바일 접속용, 최초 1회)"
    brew install cloudflared || { echo "  ⚠️  cloudflared 설치 실패 — 모바일 터널 없이 로컬로만 실행합니다."; TUNNEL_AVAILABLE=0; }
  else
    echo "  ℹ️  Homebrew가 없어 모바일 터널은 건너뜁니다 (로컬 PC 사용에는 영향 없음)."
    echo "     모바일 접속을 원하면 https://brew.sh 설치 후 재실행하세요."
    TUNNEL_AVAILABLE=0
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

# ── 3-1. 맥북 RAM에 맞는 모델 자동 선택 ──────────
# gemma3:27b는 16GB 맥북에서 스왑을 유발해 오히려 느려진다.
# CAF_MODEL을 직접 지정하면(예: CAF_MODEL=gemma3:27b bash start.sh) 그 값을 우선한다.
if [ -z "${CAF_MODEL:-}" ]; then
  MEM_GB=0
  if sysctl -n hw.memsize &>/dev/null; then                     # macOS
    MEM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
  elif [ -r /proc/meminfo ]; then                               # Linux
    MEM_GB=$(( $(awk '/MemTotal/{print $2}' /proc/meminfo) / 1048576 ))
  fi
  if   [ "$MEM_GB" -ge 24 ]; then CAF_MODEL="gemma3:27b"
  elif [ "$MEM_GB" -ge 12 ]; then CAF_MODEL="gemma3:12b"        # 16GB 맥북 최적
  else                            CAF_MODEL="gemma3:4b"
  fi
  export CAF_MODEL
  echo "  🧠 RAM ${MEM_GB}GB 감지 → 모델 ${CAF_MODEL} 사용 (변경: CAF_MODEL=모델명 bash start.sh)"
fi

# ── 3-1a. Groq 모드 안내 ─────────────────────────
# GROQ_API_KEY가 설정돼 있으면 답변 생성/번역이 Groq(초당 수백 토큰)로 동작한다.
# 임베딩(nomic-embed-text)과 CAF 분석은 여전히 로컬 Ollama 사용.
if [ -n "${GROQ_API_KEY:-}" ]; then
  echo "  ⚡ Groq 모드 활성 — 답변/번역: ${GROQ_MODEL:-llama-3.3-70b-versatile} (임베딩·CAF는 로컬 Ollama)"
else
  echo "  🔒 로컬 모드 — 전 기능 오프라인 (빠른 답변 원하면: export GROQ_API_KEY=... 후 재실행)"
fi

if command -v ollama &>/dev/null; then
  if ! ollama list 2>/dev/null | grep -q "$CAF_MODEL"; then
    echo ""
    echo "  💡 사용할 모델($CAF_MODEL)이 아직 없습니다. 먼저 다운로드하세요:"
    echo "     ollama pull $CAF_MODEL"
    echo ""
  fi

  # 🆕 면접 답변 검색(RAG)에 쓰는 임베딩 모델
  EMBED_MODEL="nomic-embed-text"
  if ! ollama list 2>/dev/null | grep -q "$EMBED_MODEL"; then
    echo ""
    echo "  💡 RAG 임베딩 모델($EMBED_MODEL)이 없습니다. 면접 모범 답변 기능에 필요합니다 (~270MB):"
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
  echo "  ❌ 서버 시작 실패 — 아래 명령으로 직접 실행해 에러 메시지를 확인하세요:"
  echo "     cd \"$DIR\" && python3 server.py"
  exit 1
fi

# ── 5. HTTPS 터널 생성 (cloudflared 있을 때만) ───
URL=""
if [ "$TUNNEL_AVAILABLE" = "1" ]; then
  echo ""
  echo "  🌍 모바일용 HTTPS 터널 생성 중... (몇 초 걸립니다)"
  cloudflared tunnel --url "http://localhost:${PORT}" >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!

  for i in $(seq 1 30); do
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
    [ -n "$URL" ] && break
    sleep 1
  done
fi

# ── 6. 접속 주소 안내 ────────────────────────────
echo ""
echo "  ═══════════════════════════════════════════"
echo "  ✅ 준비 완료!"
echo ""
echo "  🖥  PC:      http://localhost:${PORT}"
echo "  🎤 영어 면접 연습:  http://localhost:${PORT}/interview.html"
echo "  🔴 실전 라이브 모드: http://localhost:${PORT}/live.html"
if [ -n "$URL" ]; then
  echo "  📱 모바일:  ${URL}"
  echo ""
  echo "     ↑ 이 주소를 휴대폰 브라우저에 입력하세요."
  echo "       (https라서 🎙️ 마이크도 동작합니다)"
elif [ "$TUNNEL_AVAILABLE" = "1" ]; then
  echo "  ⚠️  터널 주소를 가져오지 못했습니다. 로그: $TUNNEL_LOG"
fi
echo ""
echo "  🛑 종료: Ctrl+C"
echo "  ═══════════════════════════════════════════"
echo ""

wait
