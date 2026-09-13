#!/usr/bin/env python3
"""Extract a speech-optimised audio track from a video and split it for STT.

Hosted transcription APIs cap upload size (~25 MB). 16 kHz mono MP3 at 32 kbps
is about 14 MB/hour, so most videos stay in one piece; longer ones are split
and `audio_index.json` records each part's offset so timestamps stay absolute.

    python3 scripts/audio.py VIDEO --outdir OUT
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ffkit import FFError, ffmpeg_bin, hms, probe, run  # noqa: E402


def extract(video: str, dest: str, start: float, end: float | None, bitrate: str) -> None:
    cmd = [ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-nostdin"]
    if start:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-i", video, "-vn", "-ac", "1", "-ar", "16000", "-b:a", bitrate, "-y", dest]
    run(cmd)


def segment(src: str, outdir: str, chunk_seconds: int) -> list[str]:
    os.makedirs(outdir, exist_ok=True)
    pattern = os.path.join(outdir, "part_%03d.mp3")
    run([ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-nostdin", "-i", src,
         "-f", "segment", "-segment_time", str(chunk_seconds), "-reset_timestamps", "1",
         "-c", "copy", "-y", pattern])
    return sorted(glob.glob(os.path.join(outdir, "part_*.mp3")))


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract and chunk audio for transcription.")
    ap.add_argument("video")
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--chunk-seconds", type=int, default=900)
    ap.add_argument("--max-mb", type=float, default=24.0, help="split when the single file exceeds this")
    ap.add_argument("--bitrate", default="32k")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    args = ap.parse_args()

    try:
        info = probe(args.video)
    except FFError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
    if not info["has_audio"]:
        print("error: this file has no audio stream — skip transcription and analyse frames only",
              file=sys.stderr)
        raise SystemExit(2)

    os.makedirs(args.outdir, exist_ok=True)
    full = os.path.join(args.outdir, "audio.mp3")
    try:
        extract(args.video, full, args.start, args.end, args.bitrate)
    except FFError as exc:
        print(f"error: audio extraction failed: {exc}", file=sys.stderr)
        raise SystemExit(1)

    size_mb = os.path.getsize(full) / 1024 / 1024
    parts: list[dict] = []
    if size_mb <= args.max_mb:
        parts.append({"file": full, "offset_sec": args.start,
                      "duration_sec": probe(full)["duration_sec"]})
    else:
        offset = args.start
        for path in segment(full, os.path.join(args.outdir, "chunks"), args.chunk_seconds):
            dur = probe(path)["duration_sec"]
            if dur < 0.2:  # ffmpeg's segmenter can emit an empty tail chunk
                os.remove(path)
                continue
            parts.append({"file": path, "offset_sec": round(offset, 3), "duration_sec": dur})
            offset += dur
        os.remove(full)

    index = {
        "video": info["path"],
        "total_duration_hms": info["duration_hms"],
        "bitrate": args.bitrate, "sample_rate": 16000, "channels": 1,
        "part_count": len(parts),
        "parts": [dict(p, offset_hms=hms(p["offset_sec"]),
                       size_mb=round(os.path.getsize(p["file"]) / 1024 / 1024, 2)) for p in parts],
    }
    index_path = os.path.join(args.outdir, "audio_index.json")
    with open(index_path, "w", encoding="utf-8") as fh:
        json.dump(index, fh, indent=2, ensure_ascii=False)

    print(f"parts={len(parts)}  total={round(sum(p['duration_sec'] for p in parts), 1)}s")
    for p in index["parts"]:
        print(f"  {os.path.basename(p['file'])}  offset={p['offset_hms']}  {p['size_mb']} MB")
    print(f"index: {index_path}")


if __name__ == "__main__":
    main()
