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
from embeddings import OLLAMA_URL, TRANSLATE_SYSTEM_PROMPT  # noqa: E402

PORT = int(os.environ.get("PORT", "3778"))
HOST = os.environ.get("HOST", "0.0.0.0")
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

        if path in ("/", "/index.html"):
            self._serve_static("/interview.html", "text/html; charset=utf-8")

        elif path in STATIC_FILES:
            self._serve_static(path, STATIC_FILES[path])

        elif path == "/health":
            try:
                if llm.GROQ_API_KEY:
                    self._send_json(200, {"status": "ok", "provider": "groq", "model": llm.GROQ_MODEL})
                else:
                    req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
                    with urllib.request.urlopen(req, timeout=3) as r:
                        models = [m["name"] for m in json.loads(r.read()).get("models", [])]
                    self._send_json(200, {"status": "ok", "provider": "ollama", "models": models})
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
            self._send_json(200, interview_pipeline.index.status())

        else:
            self.send_error(404)

    # ── POST ───────────────────────────────────────────────
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
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
                    {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT},
                    {"role": "user", "content": req.get("text", "")},
                ], temperature=0.3, max_tokens=300, model=req.get("model"))
                return

            if self.path == "/api/live/suggest":
                req = json.loads(body or b"{}")
                prompt = interview_pipeline.build_live_suggest_prompt(
                    req.get("question", ""), req.get("cefr", "B1"), req.get("context", ""))
                _stream_llm_ndjson(self, [{"role": "user", "content": prompt}],
                                  temperature=0.4, max_tokens=350, model=req.get("model"))
                return

            if self.path == "/api/live/summary":
                req = json.loads(body or b"{}")
                prompt = interview_pipeline.build_live_summary_prompt(req.get("transcript", ""))
                _stream_llm_ndjson(self, [{"role": "user", "content": prompt}],
                                  temperature=0.3, max_tokens=400, model=req.get("model"))
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
    print(f"  ⚡ LLM: {'Groq (' + llm.GROQ_MODEL + ')' if llm.GROQ_API_KEY else 'Ollama 로컬 (' + llm.OLLAMA_MODEL + ')'}")
    print(f"\n  🖥  연습 모드:      http://localhost:{PORT}/interview.html")
    print(f"  🔴 실전 라이브 모드: http://localhost:{PORT}/live.html")
    lan_ip = get_lan_ip()
    if lan_ip:
        print(f"  📱 같은 Wi-Fi 기기: http://{lan_ip}:{PORT}/interview.html")
    print("  🛑 종료: Ctrl+C\n")

    if os.environ.get("NO_BROWSER") != "1":
        threading.Timer(0.5, lambda: webbrowser.open(f"http://localhost:{PORT}/interview.html")).start()

    server = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n  👋 서버가 종료되었습니다.\n")
