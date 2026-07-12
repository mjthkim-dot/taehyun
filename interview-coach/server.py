#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
 영어 면접 코치 — IT 영업 직군 (독립 프로젝트, 의존성 0)

 다른 앱과 완전히 분리된 단일 파일 서버. stdlib만 사용(urllib) —
 pip install 없이 macOS 기본 Python 3로 바로 실행된다.

 답변 생성: GROQ_API_KEY가 있으면 Groq(초당 수백 토큰), 없으면 로컬 Ollama.
 임베딩(질문/프로필 검색): 항상 로컬 Ollama(nomic-embed-text) — Groq는 임베딩 미제공.

 실행: python3 server.py  (또는 bash start.sh)
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import http.cookies
import http.server
import json
import os
import socket
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))
import interview_pipeline  # noqa: E402
import llm  # noqa: E402
from speech_metrics import deterministic_metrics  # noqa: E402

PORT = int(os.environ.get("PORT", "3778"))
# 기본은 로컬 전용 — LAN의 다른 기기가 이 서버(=내 Groq 키)를 쓰지 못하게 한다.
# 같은 Wi-Fi 기기에서 접속이 필요하면: HOST=0.0.0.0 bash start.sh
HOST = os.environ.get("HOST", "127.0.0.1")
# 클라우드 배포 시 필수 — 접속 코드를 모르면 아무것도 쓸 수 없게 막는다
# (고정 공개 URL + 내 Groq 키 조합이므로). 로컬 실행은 미설정 → 게이트 없음.
ACCESS_CODE = os.environ.get("ACCESS_CODE")

LOGIN_HTML = """<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>접속 코드</title>
<style>body{{background:#0B0C0F;color:#ECECF0;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0}}
form{{background:#17181D;border:1px solid #2A2B33;border-radius:16px;padding:28px;text-align:center;width:280px}}
h1{{font-size:16px;margin:0 0 6px}}p{{font-size:12.5px;color:#A7A7B6;margin:0 0 16px}}
input{{width:100%;box-sizing:border-box;background:#0B0C0F;color:#ECECF0;border:1px solid #2A2B33;
border-radius:10px;padding:11px;font-size:15px;text-align:center;margin-bottom:10px}}
button{{width:100%;border:none;border-radius:10px;padding:11px;background:#F7CE46;color:#16130A;
font-weight:800;font-size:14px;cursor:pointer}}.err{{color:#F06A6A;font-size:12px;margin-top:10px}}</style>
</head><body><form action="/login" method="get">
<h1>🎤 영어 면접 코파일럿</h1><p>접속 코드를 입력하세요</p>
<input type="password" name="code" autofocus autocomplete="current-password">
<button>입장</button>{err}</form></body></html>"""
APP_DIR = Path(__file__).parent

STATIC_FILES = {
    "/interview.html": "text/html; charset=utf-8",
    "/live.html": "text/html; charset=utf-8",
    "/interview.webmanifest": "application/manifest+json",
}


def _stream_llm_ndjson(handler, messages, temperature, max_tokens, model=None):
    """llm 모듈(Groq/Ollama)의 토큰 스트림을 NDJSON으로 클라이언트에 프록시.
    첫 청크를 먼저 당겨(next) 연결 실패가 200 OK 이후로 새지 않고 503으로 잡히게 한다."""
    it = llm.stream_ndjson(messages, temperature, max_tokens, model)
    first = next(it, None)
    handler.send_response(200)
    handler.send_header("Content-Type", "application/x-ndjson")
    handler._cors()
    handler.end_headers()
    if first:
        handler.wfile.write(first)
        handler.wfile.flush()
    for chunk in it:
        handler.wfile.write(chunk)
        handler.wfile.flush()


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _send_json(self, code, obj):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    # ── 접속 코드 게이트 (ACCESS_CODE 설정 시에만 활성) ─────
    def _authed(self) -> bool:
        if not ACCESS_CODE:
            return True
        cookies = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookies.get("ic_auth")
        return morsel is not None and morsel.value == ACCESS_CODE

    def _send_login(self, bad: bool = False):
        html = LOGIN_HTML.format(err='<div class="err">코드가 올바르지 않습니다</div>' if bad else '').encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(html)

    def _serve_static(self, path: str, content_type: str):
        try:
            data = (APP_DIR / path.lstrip("/")).read_bytes()
        except OSError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    # ── GET ────────────────────────────────────────────────
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path, query = parsed.path, urllib.parse.parse_qs(parsed.query)

        # 접속 코드 게이트 — /health(모니터링용)만 예외
        if ACCESS_CODE and path != "/health":
            if path == "/login":
                code = (query.get("code") or [""])[0]
                if code == ACCESS_CODE:
                    self.send_response(302)
                    self.send_header("Set-Cookie",
                                     f"ic_auth={ACCESS_CODE}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax")
                    self.send_header("Location", "/interview.html")
                    self.end_headers()
                else:
                    self._send_login(bad=bool(code))
                return
            if not self._authed():
                self._send_login()
                return

        if path in ("/", "/index.html"):
            self._serve_static("/interview.html", "text/html; charset=utf-8")

        elif path in STATIC_FILES:
            self._serve_static(path, STATIC_FILES[path])

        elif path == "/health":
            try:
                if llm.GROQ_API_KEY:
                    self._send_json(200, {"status": "ok", "provider": "groq",
                                          "model": llm.GROQ_MODEL, "stt": llm.GROQ_STT_MODEL})
                else:
                    req = urllib.request.Request(f"{llm.OLLAMA_URL}/api/tags")
                    with urllib.request.urlopen(req, timeout=3) as r:
                        models = [m["name"] for m in json.loads(r.read()).get("models", [])]
                    self._send_json(200, {"status": "ok", "provider": "ollama", "models": models,
                                          "warning": "GROQ_API_KEY가 없어 음성 인식(STT)을 쓸 수 없습니다."})
            except Exception as e:  # noqa: BLE001
                self._send_json(200, {"status": "error", "message": str(e)})

        elif path == "/api/interview/question":
            diff = (query.get("difficulty") or [None])[0]
            q = interview_pipeline.pick_question(
                category=(query.get("category") or [None])[0],
                difficulty=int(diff) if diff and diff.isdigit() else None,
                exclude=(query.get("exclude") or [""])[0].split(","),
            )
            if q:
                self._send_json(200, q)
            else:
                self._send_json(404, {"error": "조건에 맞는 질문이 없습니다."})

        elif path == "/api/interview/categories":
            self._send_json(200, interview_pipeline.list_categories())

        elif path == "/api/interview/status":
            self._send_json(200, interview_pipeline.status())

        # ⚡ 미리 생성된 맞춤 답변 매칭 (라이브에서 0초 응답)
        elif path == "/api/live/cached":
            q = (query.get("q") or [""])[0]
            entry = interview_pipeline.cached_answer(q)
            self._send_json(200, {"hit": entry is not None, "entry": entry})

        elif path == "/api/prep/status":
            self._send_json(200, interview_pipeline.prep_status())

        else:
            self.send_error(404)

    # ── POST ───────────────────────────────────────────────
    def do_POST(self):
        if not self._authed():
            self._send_json(401, {"error": "인증이 필요합니다 — 페이지를 새로고침해 접속 코드를 입력하세요."})
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        path = self.path.split("?", 1)[0]

        try:
            # ⚡ 맞춤 답변셋 사전 생성 — 백그라운드 스레드로 실행, /api/prep/status로 폴링
            if path == "/api/prep/build":
                if interview_pipeline.prep_status()["running"]:
                    self._send_json(409, {"error": "이미 생성 중입니다.", **interview_pipeline.prep_status()})
                    return
                req = json.loads(body or b"{}")
                threading.Thread(target=interview_pipeline.build_my_answers,
                                 args=(req.get("model"), req.get("cefr", "B1")), daemon=True).start()
                self._send_json(202, {"started": True, **interview_pipeline.prep_status()})
                return

            # 🎙 음성 인식 — 오디오 세그먼트(webm/wav 바이트) → Groq Whisper → 텍스트
            # lang 파라미터를 생략하면 Whisper가 언어 자동 감지 (한/영 혼용 면접 대응)
            if path == "/api/stt":
                qs = urllib.parse.parse_qs(self.path.partition("?")[2])
                lang = (qs.get("lang") or [None])[0]
                # iOS Safari는 audio/mp4로 녹음됨 — Content-Type을 보고 포맷 전달
                ct = (self.headers.get("Content-Type") or "audio/webm").split(";")[0].strip()
                ext = {"audio/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/wav": ".wav",
                       "audio/x-m4a": ".m4a"}.get(ct, ".webm")
                try:
                    text = llm.transcribe(body, filename=f"audio{ext}", language=lang or None)
                except RuntimeError as e:
                    self._send_json(503, {"error": str(e)})
                    return
                self._send_json(200, {"text": text})
                return

            if self.path == "/api/interview/answers":
                req = json.loads(body or b"{}")
                result = interview_pipeline.generate_answers(
                    req.get("question", ""), req.get("cefr", "B1"), req.get("model"))
                self._send_json(200, result)
                return

            if self.path == "/api/interview/feedback":
                req = json.loads(body or b"{}")
                result = interview_pipeline.feedback(
                    req.get("question", ""), req.get("transcript", ""),
                    req.get("cefr", "B1"), req.get("duration_sec"), req.get("model"))
                self._send_json(200, result)
                return

            if self.path == "/api/translate":
                req = json.loads(body or b"{}")
                _stream_llm_ndjson(self, [
                    {"role": "system", "content": llm.TRANSLATE_SYSTEM_PROMPT},
                    {"role": "user", "content": req.get("text", "")},
                ], temperature=0.3, max_tokens=300, model=req.get("model"))
                return

            if self.path == "/api/live/suggest":
                req = json.loads(body or b"{}")
                prompt = interview_pipeline.build_live_suggest_prompt(
                    req.get("question", ""), req.get("cefr", "B1"),
                    req.get("context", ""), req.get("intent", "answer"))
                # 답변 2개 + 한국어 번역 2개가 들어가므로 토큰을 넉넉히
                _stream_llm_ndjson(self, [{"role": "user", "content": prompt}],
                                  temperature=0.4, max_tokens=700, model=req.get("model"))
                return

            if self.path == "/api/live/summary":
                req = json.loads(body or b"{}")
                mode = req.get("mode", "full")
                prompt = interview_pipeline.build_live_summary_prompt(req.get("transcript", ""), mode)
                _stream_llm_ndjson(self, [{"role": "user", "content": prompt}],
                                  temperature=0.3,
                                  max_tokens=60 if mode == "line" else 400,
                                  model=req.get("model"))
                return

            # 📋 세션 종료 리포트 — 내 발화 분석 + 표현 업그레이드 + 예상 꼬리 질문
            if self.path == "/api/live/report":
                req = json.loads(body or b"{}")
                transcript = req.get("transcript", "")
                my_lines = " ".join(l.partition(":")[2] for l in transcript.splitlines()
                                    if l.strip().startswith("나:"))
                metrics = deterministic_metrics(my_lines, None)
                prompt = interview_pipeline.build_live_report_prompt(transcript, metrics)
                _stream_llm_ndjson(self, [{"role": "user", "content": prompt}],
                                  temperature=0.3, max_tokens=700, model=req.get("model"))
                return

            self.send_error(404)
        except urllib.error.HTTPError as e:
            self._send_json(e.code, {"error": f"LLM API 오류 ({e.code}) — API 키/요청 한도를 확인하세요."})
        except urllib.error.URLError:
            self._send_json(503, {"error": "LLM에 연결할 수 없습니다. (Groq: 인터넷 확인 / Ollama: 실행 여부 확인)"})
        except Exception as e:  # noqa: BLE001
            self._send_json(500, {"error": str(e)})

    def log_message(self, fmt, *args):
        if args and str(args[1]) not in ("200", "204"):
            print(f"  [{args[1]}] {args[0]}")


def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


if __name__ == "__main__":
    print()
    print("  🎤  영어 면접 코치 — IT 영업")
    print("  ─────────────────────────────")
    if llm.GROQ_API_KEY:
        print(f"  ⚡ Groq — LLM: {llm.GROQ_MODEL} · STT: {llm.GROQ_STT_MODEL}")
    else:
        print(f"  ⚠️  GROQ_API_KEY 없음 — LLM은 Ollama({llm.OLLAMA_MODEL}) 폴백, 음성 인식(STT)은 비활성!")
        print("     라이브 모드를 쓰려면: export GROQ_API_KEY=... 후 재실행")
    print(f"\n  🖥  연습 모드:      http://localhost:{PORT}/interview.html")
    print(f"  🔴 실전 라이브 모드: http://localhost:{PORT}/live.html")
    if HOST == "0.0.0.0":
        lan_ip = get_lan_ip()
        if lan_ip:
            print(f"  📱 같은 Wi-Fi 기기: http://{lan_ip}:{PORT}/interview.html")
    else:
        print("  🔒 로컬 전용 바인딩 (LAN 공유가 필요하면: HOST=0.0.0.0 bash start.sh)")
    print("  🛑 종료: Ctrl+C\n")

    if os.environ.get("NO_BROWSER") != "1":
        threading.Timer(0.5, lambda: webbrowser.open(f"http://localhost:{PORT}/interview.html")).start()

    server = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n  👋 서버가 종료되었습니다.\n")
