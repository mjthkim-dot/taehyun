#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 🗣️ 로컬 한국어 자연 음성(MeloTTS) 설치 — 선택 사항
#
# 기본 앱은 브라우저 내장 음성으로도 동작합니다. 이 스크립트는
# 외부 API(Azure 등) 없이 "오픈소스 로컬 음성"으로 한국어 내레이션을
# 더 자연스럽게 들으려는 분을 위한 1회성 설치입니다.
#
# MeloTTS(MIT) + PyTorch(CPU)를 설치하므로 용량이 큽니다(수 GB).
# 설치 후 voice-assistant/start.sh 를 다시 실행하면 자동으로 사용됩니다.
#
# 사용법:  bash voice-assistant/tts-setup.sh
# ─────────────────────────────────────────────────────────────
set -u

echo ""
echo "  🗣️  로컬 한국어 음성(MeloTTS) 설치"
echo "  ═══════════════════════════════════════════"
echo "  · 오픈소스(MIT) · 외부 API/키 불필요 · PyTorch(CPU) 포함"
echo "  · 용량이 큽니다(수 GB). 네트워크에 따라 수 분 걸릴 수 있어요."
echo ""

if ! command -v python3 &>/dev/null; then
  echo "  ❌ python3 가 필요합니다."
  exit 1
fi

if python3 -c "import melo" 2>/dev/null; then
  echo "  ✅ 이미 설치되어 있습니다. start.sh 를 실행하세요."
  exit 0
fi

echo "  📦 MeloTTS 설치 중... (git+PyPI)"
# MeloTTS는 PyPI 패키지명이 일정치 않아 공식 GitHub에서 설치하는 것이 가장 안정적이다.
pip3 install --quiet "git+https://github.com/myshell-ai/MeloTTS.git" || {
  echo "  ⚠️  GitHub 설치 실패 → PyPI(melotts)로 재시도"
  pip3 install --quiet melotts || { echo "  ❌ MeloTTS 설치 실패"; exit 1; }
}

# 일부 환경에서 한국어 G2P(g2pkk)와 일본어 사전(unidic)이 import 시 필요할 수 있어 미리 준비.
echo "  📦 한국어 G2P(g2pkk) 확인..."
python3 -c "import g2pkk" 2>/dev/null || pip3 install --quiet g2pkk || true
echo "  📦 unidic 사전 다운로드(선택)..."
python3 -m unidic download 2>/dev/null || true

echo ""
if python3 -c "import melo" 2>/dev/null; then
  echo "  ✅ 설치 완료! 이제 다음을 실행하세요:"
  echo "       bash voice-assistant/start.sh"
  echo "     서버가 한국어 음성을 자동으로 로컬에서 합성합니다."
else
  echo "  ⚠️  설치는 끝났지만 import 확인에 실패했습니다. 위 로그를 확인하세요."
  echo "     (앱은 브라우저 내장 음성으로 계속 정상 동작합니다.)"
fi
echo "  ═══════════════════════════════════════════"
echo ""
