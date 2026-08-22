#!/usr/bin/env python3
"""
실환경 최종 검증 키트 — doctor(사전 점검) · smoke(구간별 스모크) · report(실측 기록)

비개발자가 자기 맥북에서 "어느 구간이 문제인지"를 스스로 알 수 있게 만든다.
진입점은 doctor.sh / smoke.sh (이 파일을 부른다). 표준 라이브러리만 사용.

  python3 tools/fieldtest.py doctor [--yes]     # --yes: Whisper 자동 다운로드 승인
  python3 tools/fieldtest.py smoke  [--skip-mic] [--wav 파일] [--base URL]
  python3 tools/fieldtest.py report             # 실측값으로 docs/REPORT.md 갱신

smoke는 결과를 backend/data/field-latency.json 에 남기고 report를 자동 호출한다.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import socket
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # meeting-copilot/
DOCS = ROOT.parent / "docs"
LAT_JSON = ROOT / "backend" / "data" / "field-latency.json"
PORT = int(os.environ.get("PORT", "3799"))
IS_MAC = platform.system() == "Darwin"

# 수용 기준 (docs/PLAN.md)
BUDGET_MS = {"translate": 2000, "suggest": 3000}

# ── 출력 ──────────────────────────────────────────────────────
_TTY = sys.stdout.isatty()
RED = "\033[31m" if _TTY else ""
GRN = "\033[32m" if _TTY else ""
YLW = "\033[33m" if _TTY else ""
RST = "\033[0m" if _TTY else ""


def ok(msg, _fix=""):
    # _fix: (ok if 조건 else bad)(msg, fix) 형태로 쓸 수 있게 서명을 맞춘다
    print(f"  {GRN}✅ {msg}{RST}")


def bad(msg, fix=""):
    print(f"  {RED}❌ {msg}{RST}")
    if fix:
        for line in fix.splitlines():
            print(f"     {YLW}→ {line}{RST}")


def warn(msg, tip=""):
    print(f"  {YLW}⚠️ {msg}{RST}")
    if tip:
        print(f"     → {tip}")


def info(msg):
    print(f"  💡 {msg}")


def _backend():
    sys.path.insert(0, str(ROOT / "backend"))


# ══════════════════════════════════════════════════════════════
# doctor — 앱 실행 전 사전 점검
# ══════════════════════════════════════════════════════════════
def _check_python() -> bool:
    v = sys.version_info
    if v >= (3, 10):
        ok(f"Python {v.major}.{v.minor} — OK")
        return True
    bad(f"Python {v.major}.{v.minor} — 3.10 이상이 필요합니다",
        "brew install python3   (설치 후 새 터미널에서 다시 실행)")
    return False


def _list_mac_inputs() -> list[str]:
    try:
        out = subprocess.run(["system_profiler", "SPAudioDataType", "-json"],
                             capture_output=True, text=True, timeout=20).stdout
        data = json.loads(out)
    except Exception:  # noqa: BLE001
        return []
    names = []

    def walk(items):
        for it in items or []:
            if int(it.get("coreaudio_device_input") or 0) > 0:
                names.append(it.get("_name", "?"))
            walk(it.get("_items"))
    walk(data.get("SPAudioDataType"))
    return names


def _record_wav(path: Path, seconds: int) -> tuple[bool, str]:
    """ffmpeg로 기본 마이크에서 녹음. (성공 여부, 실패 사유)"""
    if not shutil.which("ffmpeg"):
        return False, "ffmpeg 없음"
    if IS_MAC:
        attempts = [["-f", "avfoundation", "-i", ":default"],
                    ["-f", "avfoundation", "-i", ":0"]]
    else:
        attempts = [["-f", "pulse", "-i", "default"],
                    ["-f", "alsa", "-i", "default"]]
    err = ""
    for src in attempts:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-y", *src,
                            "-t", str(seconds), "-ac", "1", "-ar", "16000", str(path)],
                           capture_output=True, text=True, timeout=seconds + 15)
        if r.returncode == 0 and path.exists() and path.stat().st_size > 1000:
            return True, ""
        err = (r.stderr or "").strip().splitlines()[-1] if r.stderr else "알 수 없음"
    return False, err


def _wav_level(path: Path) -> tuple[float, float]:
    """(피크 0~1, RMS 0~1) — audioop 없이 직접 계산 (3.13 대응)."""
    with wave.open(str(path), "rb") as w:
        raw = w.readframes(w.getnframes())
    n = len(raw) // 2
    if not n:
        return 0.0, 0.0
    vals = struct.unpack(f"<{n}h", raw[:n * 2])
    peak = max(abs(v) for v in vals) / 32768
    rms = (sum(v * v for v in vals) / n) ** 0.5 / 32768
    return peak, rms


def _check_mic() -> bool:
    if IS_MAC:
        devs = _list_mac_inputs()
        if not devs:
            bad("마이크 입력 장치를 찾지 못했습니다",
                "시스템 설정 → 사운드 → 입력에서 마이크가 보이는지 확인하세요")
            return False
        ok(f"마이크 장치 감지: {', '.join(devs[:3])}")
    else:
        cards = Path("/proc/asound/cards")
        if not (cards.exists() and cards.read_text().strip()):
            bad("오디오 입력 장치가 없습니다 (이 환경에는 마이크가 없을 수 있습니다)")
            return False
        ok("오디오 장치 감지")

    # 입력 레벨 — ffmpeg가 있으면 2초 녹음해 실제 신호를 확인
    if shutil.which("ffmpeg"):
        print("     🎙 2초간 아무 말이나 해보세요 (입력 레벨 측정)…")
        tmp = ROOT / "backend" / "data" / "_miccheck.wav"
        okrec, err = _record_wav(tmp, 2)
        if okrec:
            peak, rms = _wav_level(tmp)
            tmp.unlink(missing_ok=True)
            if peak < 0.02:
                warn(f"녹음은 됐지만 거의 무음입니다 (피크 {peak:.0%})",
                     "시스템 설정 → 개인정보 보호 → 마이크에서 '터미널' 허용 여부, 입력 볼륨을 확인하세요")
                return False
            ok(f"입력 레벨 정상 (피크 {peak:.0%})")
        else:
            warn(f"레벨 측정 실패: {err}",
                 "macOS: 시스템 설정 → 개인정보 보호 → 마이크에서 터미널을 허용하세요. "
                 "앱 자체는 브라우저 마이크를 쓰므로 브라우저 허용이 더 중요합니다.")
    else:
        info("입력 레벨 측정은 건너뜀 (brew install ffmpeg 하면 doctor가 직접 측정) — "
             "앱 실행 후 ▶를 누르고 말하면 브라우저에서 최종 확인됩니다")
    return True


def _check_llm() -> bool:
    keys = {k: bool(os.environ.get(k)) for k in
            ("ANTHROPIC_API_KEY", "CEREBRAS_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY")}
    have = [k for k, v in keys.items() if v]
    if not have:
        bad("LLM 키가 하나도 없습니다 — 번역·제안이 동작하지 않습니다",
            'export ANTHROPIC_API_KEY=sk-ant-...   # console.anthropic.com\n'
            '무료 대안: export CEREBRAS_API_KEY=... (cloud.cerebras.ai)')
        return False
    ok(f"키 감지: {', '.join(k.split('_')[0] for k in have)}")
    print("     실 호출 1회 테스트 중… (수 원 미만의 비용이 듭니다)")
    _backend()
    import llm
    t0 = time.time()
    try:
        out = llm.chat_once([{"role": "user", "content": "Reply with exactly: pong"}],
                            temperature=0, max_tokens=8)
        ms = (time.time() - t0) * 1000
        ok(f"실 호출 성공 — {llm.provider()} ({llm.model_name()}) · {ms:.0f}ms · 응답 \"{out.strip()[:20]}\"")
        return True
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        fix = ""
        if "401" in msg or "403" in msg:
            fix = "키가 잘못됐거나 만료됐습니다 — 콘솔에서 키를 다시 발급하세요"
        elif "429" in msg:
            fix = "요청 한도 초과 — 잠시 후 다시 시도하거나 결제 플랜을 확인하세요"
        elif "연결" in msg or "URLError" in msg:
            fix = "네트워크/방화벽 문제 — 회사망이면 Gemini 키(aistudio.google.com/apikey)가 통과율이 높습니다"
        bad(f"실 호출 실패: {msg[:120]}", fix)
        return False


def _whisper_cache_dir() -> Path:
    size = os.environ.get("STT_LOCAL_MODEL", "base")
    return Path.home() / ".cache" / "huggingface" / "hub" / f"models--Systran--faster-whisper-{size}"


def _check_whisper(auto_yes: bool) -> bool:
    """탭 오디오 캡처 경로용 — 마이크(Web Speech) 경로에는 필요 없다."""
    size = os.environ.get("STT_LOCAL_MODEL", "base")
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        if os.environ.get("GROQ_API_KEY"):
            warn("faster-whisper 미설치 — 탭 오디오 인식은 Groq Whisper(클라우드)로 동작합니다",
                 "무료·무제한·비공개로 하려면: pip3 install faster-whisper")
        else:
            warn("faster-whisper 미설치 — '탭 오디오' 모드가 동작하지 않습니다 (마이크 모드는 무관)",
                 "pip3 install faster-whisper   (약 100MB, 1~2분)")
        return False
    if _whisper_cache_dir().exists():
        ok(f"Whisper 모델({size}) 준비됨 — 탭 오디오 인식 가능")
        return True
    sizes = {"tiny": "약 75MB", "base": "약 145MB", "small": "약 480MB"}
    print(f"     Whisper 모델({size}, {sizes.get(size, '?')})이 아직 없습니다 — 최초 1회 다운로드 (1~3분)")
    if not auto_yes:
        if not sys.stdin.isatty():
            warn("모델 미다운로드 (비대화식 실행)", "bash doctor.sh --yes 로 자동 다운로드")
            return False
        ans = input("     지금 받을까요? [y/N] ").strip().lower()
        if ans != "y":
            info("건너뜀 — 첫 탭 캡처 사용 때 자동으로 받게 됩니다(그 순간 1~3분 지연)")
            return False
    t0 = time.time()
    try:
        from faster_whisper import WhisperModel
        WhisperModel(size, device="cpu", compute_type="int8")
        ok(f"모델 다운로드 완료 ({time.time() - t0:.0f}초)")
        return True
    except Exception as e:  # noqa: BLE001
        bad(f"다운로드 실패: {str(e)[:100]}",
            "네트워크 확인 후 재시도. 회사망이 huggingface.co를 막으면 집 네트워크에서 1회 받아두세요")
        return False


def _check_port() -> bool:
    s = socket.socket()
    s.settimeout(1)
    busy = s.connect_ex(("127.0.0.1", PORT)) == 0
    s.close()
    if not busy:
        ok(f"포트 {PORT} 비어 있음")
        return True
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=3) as r:
            if json.loads(r.read()).get("status") == "ok":
                ok(f"포트 {PORT}: 이 앱이 이미 실행 중입니다 (그대로 사용하면 됩니다)")
                return True
    except Exception:  # noqa: BLE001
        pass
    bad(f"포트 {PORT}를 다른 프로그램이 쓰고 있습니다",
        f"lsof -i tcp:{PORT}   # 무엇인지 확인\n"
        f"PORT=3800 bash start.sh   # 또는 다른 포트로 실행")
    return False


def _check_optional():
    if IS_MAC and not Path("/Applications/Google Chrome.app").exists() \
            and not shutil.which("google-chrome"):
        warn("Chrome이 안 보입니다 — 실시간 마이크 인식(Web Speech)은 Chrome/Edge 전용입니다",
             "Safari에서는 '탭 오디오' 모드를 쓰세요")
    try:
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=2) as r:
            if "bge-m3" in r.read().decode():
                ok("Ollama bge-m3 — 의미 검색(한↔영) 활성")
            else:
                info("의미 검색을 켜려면: ollama pull bge-m3 (선택 — 없어도 키워드로 동작)")
    except Exception:  # noqa: BLE001
        info("Ollama 미실행 (선택 사항 — 의미 검색용)")
    if not shutil.which("cloudflared"):
        info("폰에서 쓰려면: brew install cloudflared (start.sh가 자동으로 HTTPS 주소 발급)")


def cmd_doctor(args) -> int:
    print("\n🩺 사전 점검 — 실행 전에 막힐 곳을 미리 찾습니다")
    print("─" * 56)
    print("[1/5] Python")
    ok_py = _check_python()
    print("[2/5] 마이크")
    ok_mic = _check_mic()
    print("[3/5] LLM 키 + 실 호출")
    ok_llm = _check_llm() if ok_py else False
    print("[4/5] Whisper (탭 오디오용 — 선택)")
    _check_whisper(args.yes) if ok_py else None
    print("[5/5] 포트·부가 도구")
    ok_port = _check_port()
    _check_optional()
    print("─" * 56)
    required = {"Python": ok_py, "LLM 키": ok_llm, "포트": ok_port}
    fails = [k for k, v in required.items() if not v]
    if fails:
        print(f"{RED}⛔ 앱을 실행하기 전에 해결하세요: {', '.join(fails)} (위의 → 안내 참조){RST}\n")
        return 1
    if not ok_mic:
        print(f"{YLW}▲ 마이크는 미확인 — 앱 실행 후 ▶를 눌러 브라우저에서 확인하세요{RST}")
    print(f"{GRN}✅ 준비 완료 — bash start.sh 로 실행하세요{RST}\n")
    return 0


# ══════════════════════════════════════════════════════════════
# smoke — 구간별 스모크 테스트
# ══════════════════════════════════════════════════════════════
def _http_json(base, method, path, body=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(base + path, data=data,
                               headers={"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as x:
        return x.status, json.loads(x.read())


def _stream_timed(base, path, body, timeout=30):
    """스트림 호출 → (첫 내용 ms, 완료 ms, 전체 텍스트, meta)."""
    r = urllib.request.Request(base + path, data=json.dumps(body).encode(),
                               headers={"Content-Type": "application/json"})
    t0 = time.time()
    first = None
    text, meta = "", None
    with urllib.request.urlopen(r, timeout=timeout) as x:
        for line in x:
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "meta" in o:
                meta = o["meta"]
            elif "message" in o:
                tok = o["message"].get("content", "")
                if tok and first is None:
                    first = (time.time() - t0) * 1000
                text += tok
            elif "error" in o:
                raise RuntimeError(o["error"])
    return first or 0, (time.time() - t0) * 1000, text, meta


def _ensure_server(base) -> subprocess.Popen | None:
    try:
        st, h = _http_json(base, "GET", "/health", timeout=3)
        print(f"  서버 이미 실행 중 (공급자: {h.get('provider')})")
        return None
    except Exception:  # noqa: BLE001
        pass
    print("  서버를 임시로 띄웁니다…")
    proc = subprocess.Popen([sys.executable, str(ROOT / "server.py")],
                            env={**os.environ, "NO_BROWSER": "1"},
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try:
            _http_json(base, "GET", "/health", timeout=2)
            return proc
        except Exception:  # noqa: BLE001
            time.sleep(0.3)
    proc.kill()
    raise SystemExit(f"{RED}서버 기동 실패 — python3 server.py 를 직접 실행해 오류를 확인하세요{RST}")


def cmd_smoke(args) -> int:
    base = args.base
    print("\n🔬 구간별 스모크 테스트 — 어느 구간이 문제인지 바로 보입니다")
    print("─" * 56)
    started = _ensure_server(base)
    results: dict = {"ts": time.strftime("%Y-%m-%d %H:%M"),
                     "host": platform.node(), "stages": {}}
    stt_text = ""

    try:
        # 인증 켜진 서버면 스모크는 로컬 개인 모드 전용임을 안내
        st, me = _http_json(base, "GET", "/api/me")
        if me.get("auth_enabled") and not me.get("user"):
            print(f"{YLW}이 서버는 로그인이 필요합니다 — 스모크는 로컬 개인 모드에서 돌리세요"
                  f" (사용자 없는 데이터 폴더로: MC_DATA_DIR=/tmp/mc-smoke bash smoke.sh){RST}")
            return 1

        # ── [1단계] 마이크 → STT ──
        print("\n[1단계] 마이크 → 음성 인식 (STT)")
        wav = Path(args.wav) if args.wav else None
        if args.skip_mic:
            results["stages"]["stt"] = {"status": "SKIP", "reason": "--skip-mic"}
            print("  ⏭ 건너뜀 (--skip-mic)")
        else:
            if wav is None:
                if not shutil.which("ffmpeg"):
                    results["stages"]["stt"] = {"status": "SKIP", "reason": "ffmpeg 없음"}
                    warn("녹음 도구(ffmpeg)가 없어 건너뜁니다",
                         "brew install ffmpeg 후 재실행 — 또는 앱에서 ▶를 눌러 브라우저로 확인")
                else:
                    wav = ROOT / "backend" / "data" / "_smoke.wav"
                    print("  🎙 5초간 영어로 한 문장을 말하세요 — 예: "
                          "\"Can you walk me through the migration plan?\"")
                    for i in (3, 2, 1):
                        print(f"     {i}…", flush=True)
                        time.sleep(0.7)
                    print("     🔴 녹음 중")
                    okrec, err = _record_wav(wav, 5)
                    if not okrec:
                        results["stages"]["stt"] = {"status": "FAIL", "reason": err}
                        bad(f"녹음 실패: {err}",
                            "시스템 설정 → 개인정보 보호 → 마이크에서 터미널을 허용하세요")
                        wav = None
            if wav and wav.exists():
                t0 = time.time()
                r = urllib.request.Request(f"{base}/api/stt?lang=en", data=wav.read_bytes(),
                                           headers={"Content-Type": "audio/wav"})
                try:
                    with urllib.request.urlopen(r, timeout=120) as x:
                        text = json.loads(x.read()).get("text", "").strip()
                    ms = (time.time() - t0) * 1000
                    if text:
                        stt_text = text
                        results["stages"]["stt"] = {"status": "PASS", "ms": round(ms), "text": text}
                        ok(f"인식 성공 ({ms:.0f}ms): \"{text}\"")
                        print("     ↑ 방금 말한 내용과 다르면 마이크 품질/발음 문제입니다")
                    else:
                        results["stages"]["stt"] = {"status": "FAIL", "reason": "빈 결과"}
                        bad("인식 결과가 비었습니다 — 무음이었거나 마이크 입력이 약합니다")
                except urllib.error.HTTPError as e:
                    msg = json.loads(e.read()).get("error", str(e))
                    results["stages"]["stt"] = {"status": "FAIL", "reason": msg}
                    bad(f"STT 실패: {msg}",
                        "pip3 install faster-whisper  (또는 GROQ_API_KEY 설정) 후 doctor.sh로 재점검")

        # ── [2단계] 번역 ──
        print("\n[2단계] 인식 문장 → 한국어 번역")
        src = stt_text or "Honestly, your quote came in quite a bit higher than the other vendor."
        if not stt_text:
            print(f"  (1단계 결과가 없어 기본 문장으로 진행: \"{src[:46]}…\")")
        try:
            first, full, text, _ = _stream_timed(base, "/api/translate", {"text": src})
            ps = "PASS" if full <= BUDGET_MS["translate"] and re.search(r"[가-힣]", text) else "FAIL"
            results["stages"]["translate"] = {"status": ps, "first_ms": round(first),
                                              "full_ms": round(full), "text": text.strip()[:80]}
            (ok if ps == "PASS" else bad)(
                f"번역 {'성공' if ps == 'PASS' else '기준 미달'} — 첫 글자 {first:.0f}ms · "
                f"완료 {full:.0f}ms (기준 {BUDGET_MS['translate']}ms): {text.strip()[:40]}")
        except Exception as e:  # noqa: BLE001
            results["stages"]["translate"] = {"status": "FAIL", "reason": str(e)[:120]}
            bad(f"번역 실패: {str(e)[:100]}", "doctor.sh의 [3/5] LLM 점검을 다시 확인하세요")

        # ── [3단계] RAG 검색 ──
        print("\n[3단계] 내 자료 검색 (RAG)")
        hits_ok = 0
        for q in ["your quote is higher than the other vendor", "다음 미팅이 기대된다고 말하고 싶어요"]:
            st, d = _http_json(base, "GET", "/api/rag/search?k=3&q=" + urllib.parse.quote(q))
            hits = d.get("hits", [])
            hits_ok += bool(hits)
            print(f"  「{q[:34]}」 → {len(hits)}건")
            for h in hits[:3]:
                print(f"     · [{h['source_label']}] {h['title'][:44]}")
        results["stages"]["rag"] = {"status": "PASS" if hits_ok == 2 else "FAIL", "queries_ok": hits_ok}
        (ok if hits_ok == 2 else bad)(
            f"검색 {'정상' if hits_ok == 2 else '이상'} ({hits_ok}/2 질의에서 결과)",
            "" if hits_ok == 2 else "'자료' 탭에서 '지금 동기화'를 눌러 시드를 넣으세요")

        # ── [4단계] 퀵 리액션 파이프라인 ──
        print("\n[4단계] 퀵 리액션 (검색→생성) 파이프라인")
        try:
            first, full, text, meta = _stream_timed(
                base, "/api/suggest",
                {"said": src, "intent": "pushback", "context": "", "cefr": "B1"})
            en = re.findall(r"EN:\s*(.+)", text)
            ps = "PASS" if full <= BUDGET_MS["suggest"] and len(en) >= 2 else "FAIL"
            results["stages"]["suggest"] = {
                "status": ps, "first_ms": round(first), "full_ms": round(full),
                "options": len(en), "sources": (meta or {}).get("sources", [])}
            (ok if ps == "PASS" else bad)(
                f"제안 {'성공' if ps == 'PASS' else '기준 미달'} — 첫 내용 {first:.0f}ms · "
                f"2안 완성 {full:.0f}ms (기준 {BUDGET_MS['suggest']}ms)")
            for e in en[:2]:
                print(f"     EN: {e[:56]}")
            if meta and meta.get("sources"):
                print(f"     📎 근거: {' · '.join(meta['sources'][:2])}")
        except Exception as e:  # noqa: BLE001
            results["stages"]["suggest"] = {"status": "FAIL", "reason": str(e)[:120]}
            bad(f"제안 실패: {str(e)[:100]}")
    finally:
        if started:
            started.terminate()
            print("\n  (임시 서버 종료)")

    # ── 요약 + 기록 ──
    print("\n" + "─" * 56)
    print("결과 요약")
    label = {"stt": "1단계 마이크→STT", "translate": "2단계 번역",
             "rag": "3단계 RAG 검색", "suggest": "4단계 퀵 리액션"}
    fails = 0
    for k, name in label.items():
        r = results["stages"].get(k, {"status": "-"})
        s = r["status"]
        mark = {"PASS": f"{GRN}✅ 통과{RST}", "FAIL": f"{RED}❌ 실패{RST}",
                "SKIP": f"{YLW}⏭ 건너뜀{RST}"}.get(s, "—")
        ms = f" · {r['full_ms']}ms" if "full_ms" in r else (f" · {r.get('ms')}ms" if r.get("ms") else "")
        print(f"  {name:18s} {mark}{ms}")
        fails += s == "FAIL"
    LAT_JSON.parent.mkdir(parents=True, exist_ok=True)
    LAT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n  실측값 저장: {LAT_JSON.relative_to(ROOT)}")
    cmd_report(args)
    return 1 if fails else 0


# ══════════════════════════════════════════════════════════════
# report — 실측값을 docs/REPORT.md에 기록
# ══════════════════════════════════════════════════════════════
MARK_S = "<!-- FIELD-RESULTS:START -->"
MARK_E = "<!-- FIELD-RESULTS:END -->"


def cmd_report(args) -> int:
    if not LAT_JSON.exists():
        print("실측값이 없습니다 — 먼저 bash smoke.sh 를 실행하세요")
        return 1
    d = json.loads(LAT_JSON.read_text(encoding="utf-8"))
    stg = d["stages"]

    def row(name, key, budget=None):
        r = stg.get(key, {})
        s = r.get("status", "-")
        ms = r.get("full_ms") or r.get("ms")
        val = f"{ms}ms" if ms else (r.get("reason", "-")[:40] if s != "PASS" else "-")
        crit = f"{budget}ms 이내" if budget else "—"
        mark = {"PASS": "✅", "FAIL": "**🔴 미달**", "SKIP": "⏭ 미측정"}.get(s, "—")
        return f"| {name} | {val} | {crit} | {mark} |"

    block = f"""{MARK_S}
### 10.1 내 맥북 실측 (smoke.sh 자동 기록 — {d['ts']}, {d.get('host','')})

아래는 §10의 "지연 프로필 재현"을 대체하는 **실측값**이다.

| 구간 | 실측 | 수용 기준 | 판정 |
|---|---|---|---|
{row('마이크 → STT 인식', 'stt')}
{row('번역 (final → 한국어 완료)', 'translate', 2000)}
{row('RAG 검색 (질의 2건)', 'rag')}
{row('퀵 리액션 (클릭 → 2안 완성)', 'suggest', 3000)}

미달(🔴) 구간은 [FIELD-TEST.md](./FIELD-TEST.md)의 증상별 대응표를 참조.
{MARK_E}"""

    rp = DOCS / "REPORT.md"
    s = rp.read_text(encoding="utf-8")
    if MARK_S in s:
        s = re.sub(re.escape(MARK_S) + r".*?" + re.escape(MARK_E), block, s, flags=re.S)
    else:
        s += "\n\n" + block + "\n"
    rp.write_text(s, encoding="utf-8")
    # 터미널에도 판정 출력 (미달은 빨간색)
    print(f"  docs/REPORT.md §10.1 갱신 완료")
    for key, name, budget in [("translate", "번역", 2000), ("suggest", "퀵 리액션", 3000)]:
        r = stg.get(key, {})
        ms = r.get("full_ms")
        if ms and budget and ms > budget:
            print(f"  {RED}🔴 {name} {ms}ms — 기준 {budget}ms 미달{RST}")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("doctor")
    p.add_argument("--yes", action="store_true", help="Whisper 모델 자동 다운로드 승인")
    p.set_defaults(f=cmd_doctor)
    p = sub.add_parser("smoke")
    p.add_argument("--skip-mic", action="store_true")
    p.add_argument("--wav", help="녹음 대신 쓸 오디오 파일 (자동 검증용)")
    p.add_argument("--base", default=f"http://127.0.0.1:{PORT}")
    p.set_defaults(f=cmd_smoke)
    p = sub.add_parser("report")
    p.set_defaults(f=cmd_report)
    args = ap.parse_args()
    sys.exit(args.f(args))


if __name__ == "__main__":
    main()
