#!/usr/bin/env bash
# Check everything the video-analysis pipeline needs and print what to install.
# Exit 0 = ready for frames, 1 = ffmpeg missing (nothing will work).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$1"; }
bad()  { printf '  \033[31mmiss\033[0m  %s\n' "$1"; }

case "$(uname -s)" in
  Darwin) INSTALL="brew install ffmpeg" ;;
  Linux)  INSTALL="sudo apt install ffmpeg   # or: dnf/pacman install ffmpeg" ;;
  *)      INSTALL="winget install Gyan.FFmpeg" ;;
esac

echo "video-analysis preflight"
echo

FFMPEG_OK=1
if FF=$(python3 -c "import sys;sys.path.insert(0,'$HERE');import ffkit;print(ffkit.ffmpeg_bin())" 2>/dev/null); then
  ok "ffmpeg      $FF"
else
  bad "ffmpeg      not found  ->  $INSTALL"
  bad "            (or, no admin rights: pip install imageio-ffmpeg)"
  FFMPEG_OK=0
fi

if command -v ffprobe >/dev/null 2>&1; then
  ok "ffprobe     $(command -v ffprobe)"
else
  warn "ffprobe     not found — metadata falls back to parsing ffmpeg output (usually fine)"
fi

if [ "$FFMPEG_OK" = 1 ]; then
  if python3 -c "import sys;sys.path.insert(0,'$HERE');import ffkit;sys.exit(0 if ffkit.has_filter('drawtext') else 1)" 2>/dev/null; then
    ok "drawtext    timecodes will be burned into frames"
  else
    warn "drawtext    unavailable — sheets stay unlabelled; read index.json for cell->timecode"
  fi
fi

if [ -n "${GROQ_API_KEY:-}" ]; then
  ok "speech      GROQ_API_KEY set (whisper-large-v3-turbo, fastest)"
elif [ -n "${OPENAI_API_KEY:-}" ]; then
  ok "speech      OPENAI_API_KEY set"
elif command -v whisper >/dev/null 2>&1; then
  ok "speech      local whisper CLI (no network, slow on CPU)"
else
  warn "speech      no backend — frames only. Set GROQ_API_KEY (console.groq.com) or"
  warn "            OPENAI_API_KEY, or: pip install -U openai-whisper"
fi

echo
[ "$FFMPEG_OK" = 1 ] && echo "ready: run scripts/probe.py VIDEO next" || echo "blocked: install ffmpeg first"
exit $(( 1 - FFMPEG_OK ))
