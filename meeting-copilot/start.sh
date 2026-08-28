#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 🗣 실시간 영어 미팅 어시스턴트
#
# LLM 키는 하나만 있으면 됨 (Gemini → Claude → Cerebras → Groq → Ollama 자동 전환):
#   export GEMINI_API_KEY=...            # 기본 공급자 — aistudio.google.com/apikey (무료)
#   export ANTHROPIC_API_KEY=sk-ant-...  # 대안 (유료·학습 미사용 — 실미팅 권장)
#   export CEREBRAS_API_KEY=csk-...      # cloud.cerebras.ai (무료·가장 빠름)
# 의미 검색(선택): ollama pull bge-m3     ← 한국어 노트를 영어로 검색
# Notion 수업 노트 동기화(선택): export NOTION_TOKEN=ntn_...
#   (페이지를 통합에 '연결'해 두어야 읽을 수 있습니다)
# ─────────────────────────────────────────────────────────────
set -u
PORT="${PORT:-3799}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  🗣  실시간 영어 미팅 어시스턴트"
echo "  ═══════════════════════════════════════"
if [ -n "${GEMINI_API_KEY:-}" ]; then
  # 구글 키는 형식이 여러 가지(AIza…, AQ.…) — 접두사 대신 한글·공백 혼입만 검사.
  # 글롭 범위([!-~])는 맥 기본 bash 3.2 + UTF-8 로케일에서 콜레이션 순서를 타
  # 정상 키에도 오탐한다(맥북 실측: 리눅스 정상·맥 경고) → 로케일 무관한
  # LC_ALL=C tr 로 "출력 가능한 ASCII 밖 문자"만 남겨 검사한다.
  BAD_CHARS=$(printf %s "$GEMINI_API_KEY" | LC_ALL=C tr -d '\41-\176')
  if [ -n "$BAD_CHARS" ]; then
    echo "  ⚠️ GEMINI_API_KEY에 한글·공백이 섞여 있습니다 (붙여넣기에서 딸려 온 글자)"
    echo "     → aistudio.google.com/apikey 의 '키 복사' 버튼으로 키만 다시 넣으세요"
  else
    echo "  · Gemini 키 설정됨 (기본 공급자)"
  fi
fi
[ -n "${ANTHROPIC_API_KEY:-}" ] && echo "  · Claude 키 설정됨 (폴백 — 학습 미사용, 실미팅 적합)"
[ -n "${CEREBRAS_API_KEY:-}" ] && echo "  · Cerebras 키 설정됨 (오픈소스 70B — 가장 빠름)"
[ -n "${GROQ_API_KEY:-}" ]     && echo "  · Groq 키 설정됨"
if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${CEREBRAS_API_KEY:-}" ] && [ -z "${GROQ_API_KEY:-}" ] && [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "  ⚠️ 클라우드 LLM 키가 없습니다 — 무료 키를 하나 넣으세요:"
  echo "       https://aistudio.google.com/apikey  →  export GEMINI_API_KEY=..."
fi
if curl -s --max-time 2 "http://localhost:11434/api/tags" 2>/dev/null | grep -q bge-m3; then
  echo "  · bge-m3 감지 — 의미 검색 활성 (한국어 노트 ↔ 영어 발언)"
else
  echo "  · 의미 검색: Gemini 임베딩 사용 (설치 불필요 — 자료 탭에서 '지금 동기화' 한 번)"
  echo "    더 빠르게 하려면(로컬·무료): ollama pull bge-m3"
fi
if [ -n "${NOTION_TOKEN:-}" ]; then
  echo "  · NOTION_TOKEN 설정됨 — '자료' 탭에서 수업 노트 페이지를 당겨올 수 있습니다"
else
  echo "  💡 수업 노트는 '자료' 탭에 붙여넣거나, NOTION_TOKEN을 넣으면 페이지째 가져옵니다"
fi

EXISTING=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
[ -n "$EXISTING" ] && kill $EXISTING 2>/dev/null && sleep 1

SERVER_PID=""; TUNNEL_PID=""; TUNNEL_LOG="/tmp/meeting-copilot-tunnel-$$.log"
cleanup(){ [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
           [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
           rm -f "$TUNNEL_LOG"; echo ""; echo "  👋 종료되었습니다."; exit 0; }
trap cleanup INT TERM

T0=$(python3 -c 'import time; print(time.time())')
python3 "$DIR/server.py" &
SERVER_PID=$!
for i in $(seq 1 120); do
  curl -s --max-time 1 "http://localhost:${PORT}/health" >/dev/null 2>&1 && break
  sleep 0.5
done

# ── 기동 요약 4줄: 로드 컴포넌트 / 콜드 스타트 / 공급자 / 잔여 한도 ──
python3 - "$T0" "$PORT" <<'PYEOF'
import json, sys, time, urllib.request
t0, port = float(sys.argv[1]), sys.argv[2]
def get(p):
    with urllib.request.urlopen(f"http://localhost:{port}{p}", timeout=5) as r:
        return json.loads(r.read())
try:
    h, s, u = get("/health"), get("/api/rag/stats"), get("/api/usage")
except Exception as e:  # 요약은 참고 정보 — 실패해도 기동을 막지 않는다
    print(f"  (기동 요약 생략: {e})"); raise SystemExit
llms = ", ".join(f"{x['name']} {x['state']}" for x in h.get("llm", []) if x["state"] == "ok") or "없음"
gw = u.get("gateway", {})
f_, m_ = u.get("fast", {}), u.get("main", {})
lim = (f"분당 번역 {f_.get('rpm_limit')} · 제안 {m_.get('rpm_limit')} / "
       f"오늘 번역 {f_.get('rpd_limit', 0) - f_.get('rpd_used', 0)} · "
       f"제안 {m_.get('rpd_limit', 0) - m_.get('rpd_used', 0)} 남음"
       if f_.get("rpm_limit") else "한도 없는 공급자")
print( "  ── 기동 요약 ──────────────────────────────")
print(f"  · 로드: 색인 {s.get('total')}청크({s.get('mode')}) · LLM [{llms}] · 게이트웨이 {gw.get('rpm_budget')}/분")
print(f"  · 콜드 스타트: {time.time() - t0:.1f}초")
print(f"  · 공급자: {h.get('provider')} ({h.get('model')}) · 티어 {u.get('tier') or '-'}")
print(f"  · 잔여 한도: {lim}")
if u.get("tier") == "paid":
    # paid는 게이트웨이 60/분으로 동작한다. 결제가 실제로 활성일 때 정상이며,
    # 크레딧이 소진되면 429("prepayment credits depleted")가 뜬다 — 그때는
    # ai.studio/projects 에서 충전하거나 이 설정을 지워 무료 한도로 낮춘다.
    print( "  · 티어 paid — 결제 활성 기준 60회/분. 크레딧 소진 시 429가 뜨면"
           " ai.studio/projects 에서 충전")
PYEOF
UI_VER=$(grep -o 'id="app-ver">[^<]*' "$DIR/app.html" | cut -d'>' -f2)
echo "  · UI 버전: ${UI_VER:-?} — 브라우저 헤더의 버전 칩과 같아야 최신입니다 (다르면 ⌘⇧R)"

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
