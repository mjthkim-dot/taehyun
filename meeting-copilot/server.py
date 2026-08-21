#!/usr/bin/env python3
"""
실시간 영어 미팅 어시스턴트 — 로컬 서버 (표준 라이브러리만)

설계: docs/ARCHITECTURE.md · 계획: docs/PLAN.md
보안 기본값은 앞 프로젝트에서 실제 취약점을 찾아 고친 결과를 계승한다:
 · CORS를 열지 않는다 (프런트가 같은 출처 — 열면 임의 사이트가 트랜스크립트를 읽는다)
 · 127.0.0.1 바인딩이 기본
 · 리슨 백로그 128 (기본 5는 동시 스트리밍에서 연결 거부가 난다)
"""
from __future__ import annotations

import http.server
import json
import os
import sys
import threading
import urllib.error
import urllib.parse
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))
import ingest  # noqa: E402
import llm  # noqa: E402
import prompts  # noqa: E402
import rag  # noqa: E402

PORT = int(os.environ.get("PORT", "3799"))
HOST = os.environ.get("HOST", "127.0.0.1")
APP_DIR = Path(__file__).parent
STATIC = {
    "/app.html": "text/html; charset=utf-8",
    "/app.webmanifest": "application/manifest+json",
    "/sw.js": "application/javascript; charset=utf-8",
}


def _stream(handler, messages, temperature, max_tokens, meta=None, fast=False):
    """LLM 토큰 스트림을 NDJSON으로 프록시. 첫 청크를 당겨 연결 실패가 200 뒤로 새지 않게."""
    it = llm.stream_ndjson(messages, temperature, max_tokens, None, fast=fast)
    first = next(it, None)
    handler.send_response(200)
    handler.send_header("Content-Type", "application/x-ndjson")
    handler.end_headers()
    if meta:
        handler.wfile.write((json.dumps({"meta": meta}, ensure_ascii=False) + "\n").encode())
        handler.wfile.flush()
    if first:
        handler.wfile.write(first)
        handler.wfile.flush()
    for chunk in it:
        handler.wfile.write(chunk)
        handler.wfile.flush()


class Handler(http.server.BaseHTTPRequestHandler):
    # CORS를 열지 않는다 — 같은 출처이므로 불필요하고, 열면 미팅 기록이 외부로 읽힌다
    def _cross_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return False
        host = (self.headers.get("Host") or "").split(":")[0]
        try:
            return (urllib.parse.urlparse(origin).hostname or "") != host
        except ValueError:
            return True

    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _static(self, path, ctype):
        try:
            data = (APP_DIR / path.lstrip("/")).read_bytes()
        except OSError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        p = urllib.parse.urlparse(self.path)
        path, q = p.path, urllib.parse.parse_qs(p.query)
        if path.startswith("/api/") and self._cross_origin():
            self._json(403, {"error": "cross-origin 요청은 허용되지 않습니다."})
            return

        if path in ("/", "/index.html"):
            self._static("/app.html", "text/html; charset=utf-8")
        elif path in STATIC:
            self._static(path, STATIC[path])
        elif path == "/favicon.ico":
            icon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
                    '<rect width="32" height="32" rx="7" fill="#0E1116"/>'
                    '<text x="16" y="23" font-size="18" text-anchor="middle">🗣</text></svg>').encode()
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(icon)))
            self.end_headers()
            self.wfile.write(icon)
        elif path == "/health":
            self._json(200, {"status": "ok", "provider": llm.provider(),
                             "model": llm.model_name(),
                             "llm": llm.probe_cached(refresh="probe" in q),
                             "rag": rag.stats()})
        elif path == "/api/rag/stats":
            self._json(200, rag.stats())
        elif path == "/api/rag/search":            # 검색 단독 확인용 (디버깅·설명)
            self._json(200, {"hits": rag.search((q.get("q") or [""])[0],
                                                k=int((q.get("k") or ["6"])[0]))})
        else:
            self.send_error(404)

    def do_POST(self):
        if self._cross_origin():
            self._json(403, {"error": "cross-origin 요청은 허용되지 않습니다."})
            return
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        path = self.path.split("?", 1)[0]
        try:
            req = json.loads(body or b"{}")

            if path == "/api/translate":
                # 자막 번역은 지연이 곧 품질 → 빠른 모델 경로
                _stream(self, [{"role": "system", "content": prompts.TRANSLATE_SYSTEM},
                               {"role": "user", "content": req.get("text", "")}],
                        0.3, 300, fast=True)
                return

            if path == "/api/suggest":
                built = prompts.build_suggest(
                    req.get("said", ""), req.get("context", ""),
                    req.get("intent", "reply"), req.get("cefr", "B1"))
                _stream(self, [{"role": "user", "content": built["prompt"]}], 0.4, 700,
                        meta={"sources": built["sources"],
                              "has_placeholder": built["has_placeholder"]})
                return

            if path == "/api/summary":
                mode = req.get("mode", "line")
                _stream(self, [{"role": "user", "content":
                                prompts.build_summary(req.get("transcript", ""), mode)}],
                        0.3, 60 if mode == "line" else 500, fast=(mode == "line"))
                return

            # ── 인제스트 ──
            if path == "/api/ingest/note":
                items = ingest.notes_from_markdown(req.get("text", ""),
                                                   req.get("title", "수업 노트"))
                self._json(200, {**rag.add_chunks(items), "chunks": len(items)})
                return

            if path == "/api/ingest/glossary":
                items = ingest.chunks_from_glossary(req.get("entries") or [])
                self._json(200, {**rag.add_chunks(items), "chunks": len(items)})
                return

            if path == "/api/session/archive":
                lines = req.get("lines") or []
                name = req.get("meeting") or "미팅"
                items = ingest.chunks_from_transcript(lines, name)
                self._json(200, {**rag.add_chunks(items), "chunks": len(items)})
                return

            if path == "/api/rag/reembed":
                self._json(200, {"embedded": rag.reembed_missing(), **rag.stats()})
                return

            if path == "/api/rag/clear":
                self._json(200, {"removed": rag.clear(req.get("source")), **rag.stats()})
                return

            self.send_error(404)
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode("utf-8", "ignore")[:300]
            except Exception:  # noqa: BLE001
                pass
            self._json(e.code, {"error": f"LLM {e.code}: {detail or '(본문 없음)'}"})
        except urllib.error.URLError as e:
            self._json(503, {"error": f"LLM에 연결할 수 없습니다 — {getattr(e, 'reason', e)}"})
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": str(e)})

    def log_message(self, fmt, *args):
        if args and str(args[1]) not in ("200", "204", "304"):
            print(f"  [{args[1]}] {args[0]}")


def _banner():
    res = llm.probe_cached()
    icons = {"ok": "✅", "차단/오류": "❌", "연결 실패": "❌", "미설정": "—"}
    print("\n  🧠 번역·제안 LLM (자동 전환 순서):")
    for r in res:
        print(f"     {icons.get(r['state'], '?')} {r['name']:<9} {r['state']} {r.get('detail','')}")
    if not any(r["state"] == "ok" for r in res):
        print("     ⚠️ 살아있는 공급자가 없습니다 — 무료 키를 하나 넣으세요:")
        print("        https://cloud.cerebras.ai  또는  https://aistudio.google.com/apikey")


if __name__ == "__main__":
    seeded = ingest.ensure_seeded()
    st = rag.stats()
    print("\n  🗣  실시간 영어 미팅 어시스턴트")
    print("  ─────────────────────────────────")
    print(f"  📚 내 자료: {st['total']}청크 "
          f"(노트 {st['by_source'].get('note',0)} · "
          f"미팅 {st['by_source'].get('transcript',0)} · "
          f"용어 {st['by_source'].get('glossary',0)})"
          + (f"  ← 용어집 {seeded['seeded']}개 시드 적재" if seeded.get("seeded") else ""))
    print(f"  🔎 검색 모드: {st['mode']}"
          + ("" if st["embed_ready"] else "  (ollama pull bge-m3 하면 의미검색 활성)"))
    print(f"\n  🖥  앱: http://localhost:{PORT}/app.html")
    print("  🛑 종료: Ctrl+C")
    threading.Thread(target=_banner, daemon=True).start()
    if os.environ.get("NO_BROWSER") != "1":
        threading.Timer(0.6, lambda: webbrowser.open(f"http://localhost:{PORT}/app.html")).start()

    class Server(http.server.ThreadingHTTPServer):
        request_queue_size = 128      # 기본 5는 동시 스트리밍에서 연결 거부가 난다
        daemon_threads = True

    try:
        Server((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n\n  👋 종료되었습니다.\n")
