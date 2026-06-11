#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 🔊 고품질 영어 음성 설치 도우미 (macOS)
#
# 하는 일:
#   1. 지금 설치된 영어 음성 진단 (고품질 음성 보유 여부)
#   2. 시스템 설정의 음성 다운로드 화면 자동 열기
#   3. 남은 클릭 2번 안내
#
# 사용법:  bash voice-assistant/voices.sh
# ─────────────────────────────────────────────────────────────

echo ""
echo "  🔊 고품질 영어 음성 설치 도우미"
echo "  ═══════════════════════════════════════════"

if ! command -v say &>/dev/null; then
  echo "  ❌ macOS가 아닌 것 같습니다. 이 스크립트는 Mac 전용입니다."
  exit 1
fi

# ── 1. 현재 설치된 고품질 영어 음성 진단 ──────────
PREMIUM=$(say -v '?' 2>/dev/null | grep -iE '\((enhanced|premium)\)' | grep -E 'en[_-]' )

if [ -n "$PREMIUM" ]; then
  echo ""
  echo "  ✅ 이미 고품질 영어 음성이 설치되어 있습니다:"
  echo "$PREMIUM" | sed 's/^/     ⭐ /' | sed 's/#.*//'
  echo ""
  echo "  앱을 새로고침하면 자동으로 ⭐ 음성을 사용합니다."
  echo "  (헤더의 음성 메뉴에서 ⭐ 표시로 확인 가능)"
  echo ""
  exit 0
fi

echo ""
echo "  ⚠️  고품질(Enhanced/Premium) 영어 음성이 아직 없습니다."
echo "     기본 음성은 기계음처럼 들립니다. 1분이면 무료로 설치돼요."
echo ""
echo "  📌 잠시 후 설정 창이 열리면 이렇게 하세요:"
echo "  ───────────────────────────────────────────"
echo "   1️⃣  왼쪽에서 [손쉬운 사용] → [콘텐츠 말하기] 클릭"
echo "   2️⃣  [시스템 음성] 줄의 음성 이름 클릭 → [관리...] 선택"
echo "       (또는 음성 옆 ⓘ 아이콘)"
echo "   3️⃣  목록에서 English (US) 를 펼치고 아래 음성의"
echo "       내려받기(⬇️) 버튼 클릭:"
echo ""
echo "       ⭐ Samantha (Enhanced)   ← 추천"
echo "       ⭐ Ava (Premium)         ← 가장 자연스러움 (용량 큼)"
echo "       ⭐ Allison (Enhanced)    ← 음성 B용으로 하나 더"
echo ""
echo "   4️⃣  다운로드가 끝나면 앱(브라우저)을 새로고침"
echo "       → 자동으로 ⭐ 음성이 적용됩니다"
echo "  ───────────────────────────────────────────"
echo ""
read -p "  ⏎ Enter를 누르면 설정 창을 엽니다... "

# ── 2. 설정 화면 열기 (macOS 13+ / 이전 버전 폴백) ──
open "x-apple.systempreferences:com.apple.Accessibility-Settings.extension" 2>/dev/null \
  || open "/System/Library/PreferencePanes/UniversalAccessPref.prefPane" 2>/dev/null \
  || open -b com.apple.systempreferences

echo ""
echo "  설치 후 다시 실행하면 설치 여부를 확인해 줍니다:"
echo "    bash voice-assistant/voices.sh"
echo ""
