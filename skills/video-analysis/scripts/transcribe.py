#!/usr/bin/env python3
"""Transcribe extracted audio into a timestamped transcript.

Takes the directory produced by audio.py (or a single audio file) and writes
transcript.json / .srt / .md. Chunk offsets from audio_index.json are added
back so every timecode refers to the original video, not the chunk.

    python3 scripts/transcribe.py AUDIO_DIR [--backend auto|groq|openai|local] [--language ko]
"""
from __future__ import annotations

import argparse
import glob
import json
import mimetypes
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ffkit import hms  # noqa: E402

ENDPOINTS = {
    "groq": ("https://api.groq.com/openai/v1/audio/transcriptions", "GROQ_API_KEY", "whisper-large-v3-turbo"),
    "openai": ("https://api.openai.com/v1/audio/transcriptions", "OPENAI_API_KEY", "whisper-1"),
}


def encode_multipart(fields: dict[str, str], file_path: str) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for key, value in fields.items():
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode()
        )
    filename = os.path.basename(file_path)
    ctype = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    with open(file_path, "rb") as fh:
        payload = fh.read()
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: {ctype}\r\n\r\n".encode()
    )
    parts.append(payload)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def call_api(backend: str, path: str, model: str, language: str | None, prompt: str | None) -> dict:
    url, key_env, _ = ENDPOINTS[backend]
    api_key = os.environ.get(key_env)
    if not api_key:
        raise RuntimeError(f"{key_env} is not set — export it or pick another --backend")

    fields = {"model": model, "response_format": "verbose_json"}
    if language:
        fields["language"] = language
    if prompt:
        fields["prompt"] = prompt
    body, content_type = encode_multipart(fields, path)

    last_error = ""
    for attempt in range(4):
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Authorization", f"Bearer {api_key}")
        req.add_header("Content-Type", content_type)
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:400]
            last_error = f"HTTP {exc.code}: {detail}"
            if exc.code not in (408, 429, 500, 502, 503, 504):
                break
        except Exception as exc:  # network hiccup
            last_error = str(exc)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"transcription request failed for {os.path.basename(path)} — {last_error}")


def call_local(path: str, model: str, language: str | None, workdir: str) -> dict:
    """openai-whisper CLI. Slow on CPU but needs no API key and no network."""
    binary = shutil.which("whisper")
    if not binary:
        raise RuntimeError("local backend needs the `whisper` CLI (pip install -U openai-whisper)")
    out = os.path.join(workdir, "_local")
    os.makedirs(out, exist_ok=True)
    cmd = [binary, path, "--model", model, "--output_format", "json", "--output_dir", out]
    if language:
        cmd += ["--language", language]
    proc = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if proc.returncode != 0:
        raise RuntimeError(f"whisper CLI failed: {proc.stderr[-800:]}")
    produced = os.path.join(out, os.path.splitext(os.path.basename(path))[0] + ".json")
    with open(produced, encoding="utf-8") as fh:
        return json.load(fh)


def resolve_backend(requested: str) -> str:
    if requested != "auto":
        return requested
    if os.environ.get("GROQ_API_KEY"):
        return "groq"
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    if shutil.which("whisper"):
        return "local"
    raise RuntimeError(
        "no transcription backend available. Set GROQ_API_KEY or OPENAI_API_KEY, "
        "or install the whisper CLI (pip install -U openai-whisper)."
    )


def load_parts(target: str) -> list[dict]:
    if os.path.isfile(target):
        return [{"file": target, "offset_sec": 0.0}]
    index_path = os.path.join(target, "audio_index.json")
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as fh:
            return json.load(fh)["parts"]
    found = sorted(glob.glob(os.path.join(target, "**", "*.mp3"), recursive=True))
    if not found:
        raise RuntimeError(f"no audio found in {target} — run scripts/audio.py first")
    return [{"file": f, "offset_sec": 0.0} for f in found]


def srt_time(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main() -> None:
    ap = argparse.ArgumentParser(description="Transcribe audio into a timestamped transcript.")
    ap.add_argument("target", help="directory from audio.py, or a single audio file")
    ap.add_argument("--backend", choices=["auto", "groq", "openai", "local"], default="auto")
    ap.add_argument("--model", default=None, help="override the backend's default model")
    ap.add_argument("--language", default=None, help="ISO code, e.g. ko or en. Omit to auto-detect")
    ap.add_argument("--prompt", default=None,
                    help="domain terms to bias recognition (product names, acronyms)")
    ap.add_argument("--outdir", default=None, help="defaults to the target directory")
    args = ap.parse_args()

    try:
        backend = resolve_backend(args.backend)
        parts = load_parts(args.target)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)

    outdir = args.outdir or (args.target if os.path.isdir(args.target) else os.path.dirname(args.target))
    os.makedirs(outdir, exist_ok=True)
    model = args.model or (ENDPOINTS[backend][2] if backend in ENDPOINTS else "small")

    segments: list[dict] = []
    detected_language = None
    for i, part in enumerate(parts, 1):
        print(f"[{i}/{len(parts)}] {backend}:{model} <- {os.path.basename(part['file'])}", flush=True)
        try:
            if backend == "local":
                result = call_local(part["file"], model, args.language, outdir)
            else:
                result = call_api(backend, part["file"], model, args.language, args.prompt)
        except RuntimeError as exc:
            print(f"error: {exc}", file=sys.stderr)
            raise SystemExit(1)
        detected_language = detected_language or result.get("language")
        offset = float(part.get("offset_sec") or 0.0)
        for seg in result.get("segments") or []:
            text = (seg.get("text") or "").strip()
            if not text:
                continue
            segments.append({
                "start": round(float(seg.get("start", 0.0)) + offset, 3),
                "end": round(float(seg.get("end", 0.0)) + offset, 3),
                "text": text,
            })
        if not result.get("segments") and result.get("text"):
            segments.append({"start": offset, "end": offset, "text": result["text"].strip()})

    segments.sort(key=lambda s: s["start"])
    for seg in segments:
        seg["timecode"] = hms(seg["start"])

    full_text = " ".join(s["text"] for s in segments)
    with open(os.path.join(outdir, "transcript.json"), "w", encoding="utf-8") as fh:
        json.dump({"backend": backend, "model": model, "language": detected_language,
                   "segment_count": len(segments), "text": full_text, "segments": segments},
                  fh, indent=2, ensure_ascii=False)
    with open(os.path.join(outdir, "transcript.srt"), "w", encoding="utf-8") as fh:
        for i, seg in enumerate(segments, 1):
            fh.write(f"{i}\n{srt_time(seg['start'])} --> {srt_time(seg['end'])}\n{seg['text']}\n\n")
    with open(os.path.join(outdir, "transcript.md"), "w", encoding="utf-8") as fh:
        for seg in segments:
            fh.write(f"[{seg['timecode']}] {seg['text']}\n")

    shutil.rmtree(os.path.join(outdir, "_local"), ignore_errors=True)
    words = len(full_text.split())
    print(f"\nsegments={len(segments)}  words~{words}  language={detected_language or 'unknown'}")
    print(f"read this: {os.path.join(outdir, 'transcript.md')}")
    if not segments:
        print("note: no speech detected — treat this as a silent/music-only video")


if __name__ == "__main__":
    main()
