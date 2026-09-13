"""Shared ffmpeg/ffprobe helpers for the video-analysis skill.

Stdlib only. Every script in this skill imports from here so that binary
discovery, probing and time formatting behave identically everywhere.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys


class FFError(RuntimeError):
    pass


def _imageio_binary() -> str | None:
    """imageio-ffmpeg ships a static ffmpeg. Useful fallback when PATH has none."""
    try:
        import imageio_ffmpeg  # type: ignore
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def ffmpeg_bin() -> str:
    for candidate in (os.environ.get("VIDEO_ANALYSIS_FFMPEG"), shutil.which("ffmpeg"), _imageio_binary()):
        if candidate and os.path.exists(candidate):
            return candidate
    raise FFError(
        "ffmpeg not found. Install it (macOS: brew install ffmpeg / Ubuntu: sudo apt install ffmpeg / "
        "Windows: winget install Gyan.FFmpeg), or `pip install imageio-ffmpeg` for a bundled static build."
    )


def ffprobe_bin() -> str | None:
    """ffprobe is preferred but optional — probe() falls back to parsing ffmpeg stderr."""
    for candidate in (os.environ.get("VIDEO_ANALYSIS_FFPROBE"), shutil.which("ffprobe")):
        if candidate and os.path.exists(candidate):
            return candidate
    return None


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if check and proc.returncode != 0:
        raise FFError(f"command failed ({proc.returncode}): {' '.join(cmd[:6])} ...\n{proc.stderr[-2000:]}")
    return proc


def has_filter(name: str) -> bool:
    """Static ffmpeg builds often lack drawtext (no libfreetype at link time)."""
    try:
        out = run([ffmpeg_bin(), "-hide_banner", "-filters"], check=False).stdout
    except FFError:
        return False
    return re.search(rf"^\s*\S+\s+{re.escape(name)}\s", out, re.M) is not None


def hms(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def _parse_fraction(value: str) -> float:
    try:
        if "/" in value:
            num, den = value.split("/", 1)
            return float(num) / float(den) if float(den) else 0.0
        return float(value)
    except Exception:
        return 0.0


def _probe_with_ffprobe(path: str) -> dict:
    proc = run([
        ffprobe_bin(), "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", path,
    ])
    raw = json.loads(proc.stdout)
    video = next((s for s in raw.get("streams", []) if s.get("codec_type") == "video"), None)
    audio = next((s for s in raw.get("streams", []) if s.get("codec_type") == "audio"), None)
    fmt = raw.get("format", {})
    duration = float(fmt.get("duration") or (video or {}).get("duration") or 0.0)
    return {
        "duration_sec": round(duration, 3),
        "width": (video or {}).get("width"),
        "height": (video or {}).get("height"),
        "fps": round(_parse_fraction((video or {}).get("avg_frame_rate", "0/1")), 3) or None,
        "video_codec": (video or {}).get("codec_name"),
        "has_video": video is not None,
        "has_audio": audio is not None,
        "audio_codec": (audio or {}).get("codec_name"),
        "audio_channels": (audio or {}).get("channels"),
        "audio_sample_rate": int((audio or {}).get("sample_rate") or 0) or None,
        "probe_source": "ffprobe",
    }


_DUR_RE = re.compile(r"Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)")
_VID_RE = re.compile(r"Stream #\d+:\d+.*?: Video: (\w+).*?, (\d+)x(\d+).*?(\d+(?:\.\d+)?) fps", re.S)
_AUD_RE = re.compile(r"Stream #\d+:\d+.*?: Audio: (\w+).*?, (\d+) Hz, (\w+)")


def _probe_with_ffmpeg(path: str) -> dict:
    err = run([ffmpeg_bin(), "-hide_banner", "-i", path], check=False).stderr
    info: dict = {
        "duration_sec": 0.0, "width": None, "height": None, "fps": None,
        "video_codec": None, "has_video": False, "has_audio": False,
        "audio_codec": None, "audio_channels": None, "audio_sample_rate": None,
        "probe_source": "ffmpeg-stderr",
    }
    m = _DUR_RE.search(err)
    if m:
        info["duration_sec"] = round(int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)), 3)
    m = _VID_RE.search(err)
    if m:
        info.update(has_video=True, video_codec=m.group(1), width=int(m.group(2)),
                    height=int(m.group(3)), fps=float(m.group(4)))
    m = _AUD_RE.search(err)
    if m:
        info.update(has_audio=True, audio_codec=m.group(1), audio_sample_rate=int(m.group(2)),
                    audio_channels={"mono": 1, "stereo": 2}.get(m.group(3)))
    return info


def probe(path: str) -> dict:
    if not os.path.exists(path):
        raise FFError(f"file not found: {path}")
    info = _probe_with_ffprobe(path) if ffprobe_bin() else _probe_with_ffmpeg(path)
    info["path"] = os.path.abspath(path)
    info["size_mb"] = round(os.path.getsize(path) / 1024 / 1024, 2)
    info["duration_hms"] = hms(info["duration_sec"])
    return info


def die(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)
