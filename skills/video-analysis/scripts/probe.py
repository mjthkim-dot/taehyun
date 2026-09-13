#!/usr/bin/env python3
"""Probe a video and print metadata plus a recommended sampling plan.

Always run this first: the plan tells you how many frames and audio chunks the
rest of the pipeline will produce, so you can size the job before spending
tokens on it.

    python3 scripts/probe.py VIDEO [--json]
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ffkit import FFError, hms, probe  # noqa: E402

# Longest dimension of a contact sheet, in tokens: roughly (w*h)/750.
TOKENS_PER_SHEET = 1600


def plan_for(duration_sec: float) -> dict:
    """Pick a sampling plan. Longer videos get sparser sampling, not more frames —
    the budget is Claude's context, and 40-ish well-chosen frames beat 400 blurry ones."""
    minutes = duration_sec / 60
    if minutes <= 2:
        mode, interval, max_frames, grid = "scene", 4, 16, "4x4"
    elif minutes <= 15:
        mode, interval, max_frames, grid = "scene", 15, 32, "4x4"
    elif minutes <= 60:
        mode, interval, max_frames, grid = "scene", 45, 48, "4x4"
    else:
        mode, interval, max_frames, grid = "scene", 120, 64, "4x4"
    cells = int(grid.split("x")[0]) * int(grid.split("x")[1])
    sheets = max(1, -(-max_frames // cells))
    return {
        "mode": mode,
        "fallback_interval_sec": interval,
        "max_frames": max_frames,
        "grid": grid,
        "expected_sheets": sheets,
        "audio_chunk_seconds": 900,
        "expected_audio_chunks": max(1, -(-int(duration_sec) // 900)),
        "estimated_image_tokens": sheets * TOKENS_PER_SHEET,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Probe a video and recommend a sampling plan.")
    ap.add_argument("video")
    ap.add_argument("--json", action="store_true", help="machine-readable output only")
    args = ap.parse_args()

    try:
        info = probe(args.video)
    except FFError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)

    info["plan"] = plan_for(info["duration_sec"])
    if args.json:
        print(json.dumps(info, indent=2, ensure_ascii=False))
        return

    p = info["plan"]
    print(f"file        : {info['path']}  ({info['size_mb']} MB)")
    print(f"duration    : {info['duration_hms']}  ({info['duration_sec']}s)")
    if info["has_video"]:
        print(f"video       : {info['width']}x{info['height']} @ {info['fps']}fps  {info['video_codec']}")
    else:
        print("video       : (none — audio-only file, skip keyframes.py)")
    if info["has_audio"]:
        print(f"audio       : {info['audio_codec']} {info['audio_sample_rate']}Hz "
              f"{info['audio_channels']}ch")
    else:
        print("audio       : (none — skip audio.py/transcribe.py, this is a silent video)")
    print()
    print("recommended plan")
    print(f"  frames    : {p['mode']} detection, cap {p['max_frames']} -> "
          f"{p['expected_sheets']} contact sheet(s) of {p['grid']}")
    print(f"  audio     : {p['expected_audio_chunks']} chunk(s) of {p['audio_chunk_seconds']}s")
    print(f"  est. image cost ~{p['estimated_image_tokens']:,} tokens")
    if info["duration_sec"] > 3600:
        print("  note      : over 1h — consider analyzing a --start/--end window first")
    if not info["has_audio"] and not info["has_video"]:
        print("  warning   : no decodable streams found; is this really a media file?")


if __name__ == "__main__":
    main()
