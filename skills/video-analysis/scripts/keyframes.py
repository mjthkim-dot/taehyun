#!/usr/bin/env python3
"""Extract representative frames from a video and tile them into contact sheets.

Reading 40 separate images costs ~40 image payloads; reading 3 contact sheets
costs 3. The sheets are the deliverable — `index.json` maps every cell back to
its timecode so findings can be cited as [mm:ss].

    python3 scripts/keyframes.py VIDEO --outdir OUT [--mode auto|scene|interval]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ffkit import FFError, ffmpeg_bin, has_filter, hms, probe, run  # noqa: E402

PTS_RE = re.compile(r"pts_time:(\d+(?:\.\d+)?)")


def detect_scene_times(video: str, threshold: float, start: float, end: float | None) -> list[float]:
    """Scene cuts, found on a downscaled 4fps copy so long videos stay affordable."""
    cmd = [ffmpeg_bin(), "-hide_banner", "-nostdin"]
    if start:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += [
        "-i", video, "-an",
        "-vf", f"scale=320:-2,fps=4,select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr", "-f", "null", "-",
    ]
    stderr = run(cmd, check=False).stderr
    return [start + float(m) for m in PTS_RE.findall(stderr)]


def interval_times(start: float, end: float, step: float) -> list[float]:
    times, t = [], start
    while t < end:
        times.append(round(t, 3))
        t += step
    return times


def thin_out(times: list[float], limit: int) -> list[float]:
    """Even subsample that always keeps the first and last moment."""
    if len(times) <= limit:
        return times
    if limit == 1:
        return times[:1]
    stride = (len(times) - 1) / (limit - 1)
    return [times[round(i * stride)] for i in range(limit)]


def extract_frame(video: str, t: float, dest: str, width: int) -> bool:
    """Fast-seek to just before t, then accurate-seek the last second."""
    pre = max(0.0, t - 1.0)
    fine = t - pre
    cmd = [ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-nostdin"]
    if pre:
        cmd += ["-ss", f"{pre:.3f}"]
    cmd += ["-i", video]
    if fine:
        cmd += ["-ss", f"{fine:.3f}"]
    cmd += ["-frames:v", "1", "-vf", f"scale={width}:-2", "-q:v", "3", "-y", dest]
    run(cmd, check=False)
    return os.path.exists(dest) and os.path.getsize(dest) > 0


def label_frame(src: str, dest: str, text: str, fontfile: str | None) -> bool:
    draw = (
        f"drawtext=text='{text}':x=8:y=8:fontsize=22:fontcolor=white:"
        f"box=1:boxcolor=black@0.65:boxborderw=6"
    )
    if fontfile:
        draw += f":fontfile={fontfile}"
    proc = run([ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-nostdin",
                "-i", src, "-vf", draw, "-q:v", "3", "-y", dest], check=False)
    return proc.returncode == 0 and os.path.exists(dest)


def find_font() -> str | None:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ):
        if os.path.exists(path):
            return path
    return None


def build_sheet(frames: list[str], dest: str, cols: int, rows: int, cell_w: int, cell_h: int,
                workdir: str) -> None:
    """tile only emits a sheet once it has cols*rows frames, so pad short groups."""
    staged = os.path.join(workdir, "_stage")
    shutil.rmtree(staged, ignore_errors=True)
    os.makedirs(staged)
    fit = (f"scale={cell_w}:{cell_h}:force_original_aspect_ratio=decrease,"
           f"pad={cell_w}:{cell_h}:(ow-iw)/2:(oh-ih)/2:color=0x101014")
    for i, src in enumerate(frames):
        run([ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-nostdin", "-i", src,
             "-vf", fit, "-q:v", "3", "-y", os.path.join(staged, f"c{i:03d}.jpg")], check=False)
    for i in range(len(frames), cols * rows):
        run([ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-nostdin",
             "-f", "lavfi", "-i", f"color=c=0x101014:s={cell_w}x{cell_h}", "-frames:v", "1",
             "-y", os.path.join(staged, f"c{i:03d}.jpg")], check=False)
    run([ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-nostdin",
         "-i", os.path.join(staged, "c%03d.jpg"),
         "-vf", f"tile={cols}x{rows}:padding=6:margin=6:color=0x101014",
         "-frames:v", "1", "-q:v", "3", "-y", dest])
    shutil.rmtree(staged, ignore_errors=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract keyframes and build contact sheets.")
    ap.add_argument("video")
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--mode", choices=["auto", "scene", "interval"], default="auto")
    ap.add_argument("--max-frames", type=int, default=32)
    ap.add_argument("--interval", type=float, default=0, help="seconds between frames (interval mode)")
    ap.add_argument("--scene-threshold", type=float, default=0.30)
    ap.add_argument("--grid", default="4x4", help="contact sheet layout, e.g. 4x4 or 3x3")
    ap.add_argument("--width", type=int, default=480, help="extracted frame width in px")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--keep-frames", action="store_true", help="keep individual frames, not just sheets")
    args = ap.parse_args()

    try:
        info = probe(args.video)
    except FFError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
    if not info["has_video"]:
        print("error: no video stream — nothing to extract", file=sys.stderr)
        raise SystemExit(1)

    duration = info["duration_sec"]
    end = min(args.end, duration) if args.end else duration
    start = max(0.0, min(args.start, max(0.0, end - 0.1)))
    span = max(0.1, end - start)

    cols, rows = (int(x) for x in args.grid.lower().split("x"))
    os.makedirs(args.outdir, exist_ok=True)
    frames_dir = os.path.join(args.outdir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    mode = args.mode
    times: list[float] = []
    if mode in ("auto", "scene"):
        times = detect_scene_times(args.video, args.scene_threshold, start, end)
        used = "scene"
        if len(times) < 4 and mode == "auto":
            times, used = [], "interval"
    else:
        used = "interval"
    if not times:
        step = args.interval or max(1.0, span / max(1, args.max_frames))
        times = interval_times(start, end, step)
        used = "interval"

    if not times or times[0] > start + 0.5:
        times.insert(0, start)
    times = thin_out(sorted(set(round(t, 3) for t in times)), args.max_frames)

    cell_w = args.width
    cell_h = int(round(cell_w * (info["height"] or 9) / (info["width"] or 16) / 2)) * 2

    font = find_font()
    can_label = has_filter("drawtext") and font is not None

    records = []
    per_sheet = cols * rows
    for i, t in enumerate(times):
        raw = os.path.join(frames_dir, f"f{i:03d}.jpg")
        if not extract_frame(args.video, t, raw, cell_w):
            continue
        shown = raw
        if can_label:
            labeled = os.path.join(frames_dir, f"f{i:03d}_l.jpg")
            if label_frame(raw, labeled, hms(t), font):
                shown = labeled
        records.append({
            "index": len(records), "t_sec": round(t, 3), "timecode": hms(t),
            "frame": shown, "raw_frame": raw,
        })

    if not records:
        print("error: no frames could be extracted", file=sys.stderr)
        raise SystemExit(1)

    sheets = []
    for s, offset in enumerate(range(0, len(records), per_sheet)):
        group = records[offset:offset + per_sheet]
        dest = os.path.join(args.outdir, f"sheet_{s + 1:02d}.jpg")
        build_sheet([r["frame"] for r in group], dest, cols, rows, cell_w, cell_h, args.outdir)
        for cell, rec in enumerate(group):
            rec["sheet"] = os.path.basename(dest)
            rec["cell"] = f"R{cell // cols + 1}C{cell % cols + 1}"
        sheets.append({
            "file": os.path.basename(dest), "grid": args.grid,
            "from": group[0]["timecode"], "to": group[-1]["timecode"],
            "cells": [{"cell": r["cell"], "timecode": r["timecode"]} for r in group],
        })

    if not args.keep_frames:
        shutil.rmtree(frames_dir, ignore_errors=True)
        for rec in records:
            rec.pop("frame", None)
            rec.pop("raw_frame", None)

    index = {
        "video": info["path"], "duration_hms": info["duration_hms"],
        "window": {"start": hms(start), "end": hms(end)},
        "mode": used, "frame_count": len(records), "grid": args.grid,
        "labels_burned_in": can_label, "sheets": sheets, "frames": records,
    }
    with open(os.path.join(args.outdir, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, indent=2, ensure_ascii=False)

    print(f"mode={used}  frames={len(records)}  sheets={len(sheets)}  "
          f"labels={'burned-in' if can_label else 'index-only'}")
    for sheet in sheets:
        print(f"\n{sheet['file']}  ({sheet['grid']}, {sheet['from']} -> {sheet['to']})")
        for i in range(0, len(sheet["cells"]), cols):
            row = sheet["cells"][i:i + cols]
            print("  " + "  ".join(f"{c['cell']}={c['timecode']}" for c in row))
    print(f"\nindex: {os.path.join(args.outdir, 'index.json')}")


if __name__ == "__main__":
    main()
