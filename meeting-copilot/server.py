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
import re
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
import notion  # noqa: E402
import prompts  # noqa: E402
import rag  # noqa: E402
import review  # noqa: E402

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
        # /health도 API와 같이 취급한다 — 데이터가 있는 GET은 전부 같은 규칙로
        if (path.startswith("/api/") or path == "/health") and self._cross_origin():
            self._json(403, {"error": "cross-origin 요청은 허용되지 않습니다."})
            return
        try:
            self._get(path, q)
        except ValueError as e:
            # 잘못된 파라미터(k=abc 등)는 서버 잘못이 아니다 → 400
            self._json(400, {"error": f"잘못된 파라미터입니다 — {e}"})
        except BrokenPipeError:
            pass                                   # 클라이언트가 먼저 끊음
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": str(e)})

    def _get(self, path, q):
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
                             "stt_local": llm.stt_local_available(),
                             "stt_ready": bool(llm.stt_local_available() or llm.GROQ_API_KEY),
                             "rag": rag.stats()})
        elif path == "/api/glossary/candidates":
            # raw=1이면 통계 결과 그대로(디버깅), 기본은 LLM 판별을 거친 것
            raw = ingest.glossary_candidates(min_count=int((q.get("min") or ["3"])[0]))
            self._json(200, {"candidates": raw if "raw" in q
                             else ingest.refine_candidates(raw)})

        elif path == "/api/review/cards":
            self._json(200, {"cards": review.due_cards(
                limit=max(1, min(int((q.get("limit") or ["20"])[0]), 200)),
                include_future="all" in q), **review.counts()})
        elif path == "/api/rag/stats":
            self._json(200, rag.stats())
        elif path == "/api/rag/search":            # 검색 단독 확인용 (디버깅·설명)
            k = max(1, min(int((q.get("k") or ["6"])[0]), 20))
            self._json(200, {"hits": rag.search((q.get("q") or [""])[0], k=k)})
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
            # /api/stt만 바이너리(오디오)라 JSON 파싱 대상이 아니다
            try:
                req = {} if path == "/api/stt" else json.loads(body or b"{}")
            except json.JSONDecodeError as e:
                self._json(400, {"error": f"JSON 형식이 아닙니다 — {e}"})
                return
            if not isinstance(req, dict):
                self._json(400, {"error": "JSON 객체({...})가 필요합니다."})
                return

            # 🎙 오디오 세그먼트 → 텍스트 (탭 오디오 캡처 경로)
            #   Web Speech는 MediaStream을 입력으로 받지 못한다. 그래서 탭 오디오는
            #   VAD로 문장 단위로 잘라 여기로 보내 Whisper로 인식한다.
            if path == "/api/stt":
                qs = urllib.parse.parse_qs(self.path.partition("?")[2])
                lang = (qs.get("lang") or [None])[0]
                ct = (self.headers.get("Content-Type") or "audio/webm").split(";")[0].strip()
                ext = {"audio/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/wav": ".wav",
                       "audio/ogg": ".ogg", "audio/x-m4a": ".m4a"}.get(ct, ".webm")
                try:
                    if llm.stt_local_available():      # 로컬 우선 — 무료·무제한·비공개
                        text = llm.transcribe_local(body, filename=f"a{ext}", language=lang or None)
                    else:
                        text = llm.transcribe(body, filename=f"a{ext}", language=lang or None)
                except RuntimeError as e:
                    self._json(503, {"error": str(e)})
                    return
                self._json(200, {"text": text})
                return

            if path == "/api/translate":
                # 자막 번역은 지연이 곧 품질 → 빠른 모델 경로.
                # 빈 입력은 LLM까지 보내지 않는다(요금·지연 낭비, QA에서 확인).
                # 발화 하나가 2,000자를 넘을 일은 없다 — 넘으면 자막 목적에 맞게 자른다.
                text = (req.get("text") or "").strip()[:2000]
                if not text:
                    self._json(400, {"error": "번역할 텍스트가 없습니다."})
                    return
                _stream(self, [{"role": "system", "content": prompts.TRANSLATE_SYSTEM},
                               {"role": "user", "content": text}],
                        0.3, 300, fast=True)
                return

            if path == "/api/suggest":
                said = str(req.get("said") or "").strip()[:1500]
                if not said:
                    self._json(400, {"error": "직전 발화(said)가 없습니다."})
                    return
                built = prompts.build_suggest(
                    said, str(req.get("context") or "")[-3000:],
                    req.get("intent", "reply"), req.get("cefr", "B1"))
                _stream(self, [{"role": "user", "content": built["prompt"]}], 0.4, 700,
                        meta={"sources": built["sources"],
                              "phrases": built["phrases"],
                              "rag_used": built["rag_used"],
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

            if path == "/api/ingest/notes_bulk":
                # 여러 노트를 한 번에 (Notion 내보내기 폴더를 통째로 붙여넣는 경우).
                # 각 파일은 "=== 파일명 ===" 로 구분한다.
                raw = req.get("text", "")
                docs = re.split(r"^===\s*(.+?)\s*===$", raw, flags=re.M)
                items = []
                if len(docs) > 1:
                    for i in range(1, len(docs), 2):
                        items += ingest.notes_from_markdown(docs[i + 1], docs[i])
                else:
                    items = ingest.notes_from_markdown(raw, req.get("title", "수업 노트"))
                self._json(200, {**rag.add_chunks(items), "chunks": len(items),
                                 "docs": max(1, (len(docs) - 1) // 2)})
                return

            if path == "/api/ingest/glossary":
                entries = req.get("entries") or []
                if not isinstance(entries, list) or any(not isinstance(e, dict) for e in entries):
                    self._json(400, {"error": "entries는 {term, ko, ...} 객체의 배열이어야 합니다."})
                    return
                items = ingest.chunks_from_glossary(entries)
                self._json(200, {**rag.add_chunks(items), "chunks": len(items)})
                return

            # Notion 수업 노트 → [표현/예문/교정받은 문장] 청킹
            #   page: 페이지 ID 또는 URL (NOTION_TOKEN 필요)
            #   text: 붙여넣기 (토큰 없이도 되는 경로)
            if path == "/api/ingest/notion":
                title = req.get("title") or "수업 노트"
                if (req.get("text") or "").strip():
                    items = notion.chunks_from_markdown(req["text"], title)
                else:
                    page = (req.get("page") or "").strip()
                    if not page:
                        self._json(400, {"error": "page(페이지 ID/URL) 또는 text가 필요합니다."})
                        return
                    try:
                        items = notion.chunks_from_page(page)
                    except RuntimeError as e:
                        self._json(400, {"error": str(e)})
                        return
                    except urllib.error.HTTPError as e:
                        self._json(e.code, {"error":
                            f"Notion {e.code} — 페이지가 통합에 공유되어 있는지 확인하세요."})
                        return
                self._json(200, {**rag.add_chunks(items), "chunks": len(items)})
                return

            # 수동 '동기화' — 자동 백그라운드 갱신은 하지 않는다(설계 결정).
            # 시드 보충 + 임베딩 누락분 채우기를 한 번에 처리한다.
            if path == "/api/sync":
                seeded = ingest.ensure_seeded()
                pages = [p for p in (req.get("pages") or []) if str(p).strip()]
                notes, errors = 0, []
                for pg in pages:
                    try:
                        items = notion.chunks_from_page(pg)
                        notes += rag.add_chunks(items).get("added", 0)
                    except Exception as e:  # noqa: BLE001
                        errors.append(f"{pg}: {e}")
                embedded = rag.reembed_missing() if req.get("embed", True) else 0
                self._json(200, {"seeded": seeded.get("seeded", 0), "notes": notes,
                                 "embedded": embedded, "errors": errors,
                                 "rag": rag.stats()})
                return

            # ── 복습 자산화 (P1) ──
            if path == "/api/review/build":
                rev = review.build(req.get("lines") or [], req.get("meeting") or "미팅")
                if req.get("save_cards", True) and rev.get("expressions"):
                    rev["srs"] = review.add_cards(rev["expressions"], rev.get("meeting"))
                rev["markdown"] = review.to_markdown(rev)
                self._json(200, rev)
                return

            if path == "/api/review/grade":
                try:
                    cid = int(req.get("id", 0))
                except (TypeError, ValueError):
                    self._json(400, {"error": "카드 id가 숫자가 아닙니다."})
                    return
                self._json(200, review.grade(cid, bool(req.get("ok"))))
                return

            # Notion 쓰기는 명시적 확인이 있어야만 — 기본 OFF
            if path == "/api/notion/save":
                if not req.get("confirm"):
                    self._json(400, {"error": "확인되지 않은 저장 요청입니다 "
                                              "(Notion 쓰기는 기본 꺼져 있습니다)."})
                    return
                try:
                    self._json(200, notion.append_markdown(
                        req.get("page") or "", req.get("markdown") or ""))
                except RuntimeError as e:
                    self._json(400, {"error": str(e)})
                except urllib.error.HTTPError as e:
                    self._json(e.code, {"error":
                        f"Notion {e.code} — 페이지가 통합에 공유·편집 허용되어 있는지 확인하세요."})
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
