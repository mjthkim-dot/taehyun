#!/usr/bin/env python3
"""
실시간 영어 미팅 어시스턴트 — 서버 (표준 라이브러리만)

설계: docs/ARCHITECTURE.md · 계획: docs/PLAN.md · 배포: docs/DEPLOY.md
보안 기본값은 앞 프로젝트와 이번 웹 전환 QA에서 실제 취약점을 찾아 고친 결과다:
 · CORS를 열지 않는다 (프런트가 같은 출처 — 열면 임의 사이트가 트랜스크립트를 읽는다)
 · 127.0.0.1 바인딩이 기본. 외부 인터페이스 바인딩은 사용자가 등록돼 있어야만
   기동된다(무인증 공개 실수 방지 — fail-safe)
 · HTTP/1.1 keep-alive + 청크 스트리밍 — 웹에서는 호출마다 TCP/TLS 핸드셰이크가
   지연으로 직결된다 (QA: HTTP/1.0이라 매 호출 연결을 새로 맺고 있었다)
 · 소켓 타임아웃 30초 — 헤더를 끝내지 않는 연결(slowloris)이 스레드를 무한히
   잡던 것을 QA에서 실측, 차단
 · 요청 본문 상한 — Content-Length를 그대로 믿고 메모리에 읽던 것을 제한
 · 사용자별 데이터 격리(rag.Store)와 LLM 쿼터(auth.check_llm_quota)
"""
from __future__ import annotations

import http.cookies
import http.server
import json
import os
import re
import signal
import sys
import threading
import time
import urllib.error
import urllib.parse
import webbrowser
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))
import auth  # noqa: E402
import ingest  # noqa: E402
import gateway
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
# 요청 본문 상한 — 오디오 세그먼트(30초 webm ≈ 수백 KB)에 여유를 둔 값.
# QA: 상한이 없어 Content-Length 선언만으로 메모리를 내주고 있었다.
MAX_BODY = int(os.environ.get("MAX_BODY_MB", "8")) * 1024 * 1024
# 리버스 프록시(Caddy/nginx) 뒤에서만 1로 — X-Forwarded-* 를 신뢰하게 된다
TRUST_PROXY = os.environ.get("TRUST_PROXY") == "1"
# 로컬 Whisper는 CPU를 통째로 쓴다 — 동시 인식 수를 코어 절반으로 제한
STT_MAX_CONC = int(os.environ.get("STT_MAX_CONC", str(max(1, (os.cpu_count() or 2) // 2))))
_stt_sem = threading.BoundedSemaphore(STT_MAX_CONC)

# ── 사용자별 스토어 레지스트리 ─────────────────────────────────
_stores: dict[int, rag.Store] = {}
_stores_lock = threading.Lock()


def store_for(user: dict | None) -> rag.Store:
    """인증 꺼짐(로컬 개인 모드) → 기본 스토어, 켜짐 → 사용자별 파일."""
    if user is None:
        return rag.default_store()
    uid = user["id"]
    with _stores_lock:
        st = _stores.get(uid)
        if st is None:
            st = rag.Store(auth.user_data_dir(uid) / "store.db")
            # 새 사용자도 첫 화면부터 검색이 빈손이 아니게 — 시드 용어집만,
            # 네트워크 없이(embed=False). '자동 백그라운드 색인 금지' 원칙과
            # 충돌하지 않는다: 사용자의 요청을 처리하는 스레드에서 1회 일어난다.
            ingest.ensure_seeded(st)
            _stores[uid] = st
    return st


# ── 관측 — 엔드포인트별 지연·오류 (관리자 통계용) ───────────────
START_TS = time.time()
_metrics: dict[str, dict] = {}
_metrics_lock = threading.Lock()


def _record(key: str, status: int, ms: float) -> None:
    with _metrics_lock:
        m = _metrics.setdefault(key, {"n": 0, "err": 0, "lat": deque(maxlen=500)})
        m["n"] += 1
        if status >= 500 or status < 0:
            m["err"] += 1
        m["lat"].append(ms)


def _metrics_snapshot() -> list[dict]:
    out = []
    with _metrics_lock:
        for key, m in sorted(_metrics.items()):
            lat = sorted(m["lat"])
            pct = lambda q: round(lat[min(len(lat) - 1, int(len(lat) * q))], 1) if lat else 0
            out.append({"endpoint": key, "count": m["n"], "err5xx": m["err"],
                        "p50_ms": pct(.5), "p95_ms": pct(.95), "max_ms": pct(1.0)})
    return out


def _stream(handler, messages, temperature, max_tokens, meta=None, fast=False,
            kind="suggest", bg=False):
    """LLM 토큰 스트림을 NDJSON으로 프록시.

    · 첫 청크를 당겨 연결 실패가 200 뒤로 새지 않게 한다
    · HTTP/1.1 keep-alive에서는 스트림 길이를 모르는 응답을 청크 인코딩으로
      프레이밍해야 다음 요청이 같은 연결을 계속 쓸 수 있다
    · 중간 실패는 프레이밍을 복구할 수 없으므로 연결을 끊는 것이 정답이다
    """
    it = llm.stream_ndjson(messages, temperature, max_tokens, None, fast=fast,
                           kind=kind, bg=bg)
    first = next(it, None)
    handler.send_response(200)
    handler.send_header("Content-Type", "application/x-ndjson")
    handler.send_header("Transfer-Encoding", "chunked")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Accel-Buffering", "no")   # nginx가 스트림을 모아 보내지 않게
    handler.end_headers()
    handler._streaming = True

    def w(b: bytes) -> None:
        handler.wfile.write(f"{len(b):x}\r\n".encode() + b + b"\r\n")
        handler.wfile.flush()

    try:
        if meta:
            w((json.dumps({"meta": meta}, ensure_ascii=False) + "\n").encode())
        if first:
            w(first)
        for chunk in it:
            w(chunk)
        handler.wfile.write(b"0\r\n\r\n")
        handler.wfile.flush()
    except (BrokenPipeError, ConnectionResetError):
        handler.close_connection = True          # 클라이언트가 먼저 끊음(중단 버튼 등)
    except Exception:
        handler.close_connection = True          # 프레이밍 깨짐 — 연결 재사용 불가
        raise


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"    # keep-alive — 웹에서 호출당 핸드셰이크를 없앤다
    timeout = 30                     # slowloris 차단 (QA: 미완성 헤더가 스레드를 무한 점유)
    server_version = "mc"            # 파이썬 버전을 광고하지 않는다
    sys_version = ""

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

    def send_response(self, code, message=None):
        super().send_response(code, message)
        self._status = code
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")

    # ── 요청 컨텍스트 ────────────────────────────────────────
    def _client_ip(self) -> str:
        if TRUST_PROXY:
            fwd = (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
            if fwd:
                return fwd
        return self.client_address[0]

    def _https(self) -> bool:
        return TRUST_PROXY and self.headers.get("X-Forwarded-Proto") == "https"

    def _user(self) -> dict | None:
        c = http.cookies.SimpleCookie(self.headers.get("Cookie") or "")
        tok = c.get(auth.COOKIE_NAME)
        return auth.verify(tok.value if tok else None)

    def _session_cookie(self, token: str | None) -> str:
        c = f"{auth.COOKIE_NAME}={token or ''}; Path=/; HttpOnly; SameSite=Lax; "
        c += f"Max-Age={auth.SESSION_DAYS * 86400 if token else 0}"
        if self._https():
            c += "; Secure"
        return c

    # ── 응답 유틸 ────────────────────────────────────────────
    def _json(self, code, obj, set_cookie: str | None = None):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
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
        if "html" in ctype:
            # 앱 셸은 인라인 스크립트 하나로 되어 있어 'unsafe-inline'이 필요하다.
            # 대신 외부 출처는 전부 막는다 — XSS가 생겨도 데이터가 밖으로 못 나가게.
            self.send_header("Content-Security-Policy",
                             "default-src 'self'; script-src 'self' 'unsafe-inline'; "
                             "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
                             "connect-src 'self'; media-src 'self' blob:; "
                             "worker-src 'self'; base-uri 'self'; frame-ancestors 'none'")
            self.send_header("Permissions-Policy",
                             "microphone=(self), display-capture=(self), camera=()")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ── GET ──────────────────────────────────────────────────
    def do_GET(self):
        self._streaming = False
        self._status = 0
        t0 = time.time()
        p = urllib.parse.urlparse(self.path)
        path, q = p.path, urllib.parse.parse_qs(p.query)
        try:
            self._do_get(path, q)
        except ValueError as e:
            # 잘못된 파라미터(k=abc 등)는 서버 잘못이 아니다 → 400
            self._json(400, {"error": f"잘못된 파라미터입니다 — {e}"})
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as e:  # noqa: BLE001
            if self._streaming:
                self.close_connection = True
            else:
                self._json(500, {"error": str(e)})
        finally:
            if path.startswith("/api/") or path == "/health":
                _record(f"GET {path}", self._status, (time.time() - t0) * 1000)

    def _do_get(self, path, q):
        if (path.startswith("/api/") or path == "/health") and self._cross_origin():
            self._json(403, {"error": "cross-origin 요청은 허용되지 않습니다."})
            return

        # 정적 파일과 로그인 상태 확인은 인증 없이 — 로그인 화면이 떠야 하므로
        if path in ("/", "/index.html"):
            self._static("/app.html", "text/html; charset=utf-8")
            return
        if path in STATIC:
            self._static(path, STATIC[path])
            return
        if path == "/favicon.ico":
            icon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
                    '<rect width="32" height="32" rx="7" fill="#0E1116"/>'
                    '<text x="16" y="23" font-size="18" text-anchor="middle">🗣</text></svg>').encode()
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(icon)))
            self.end_headers()
            self.wfile.write(icon)
            return

        gate = auth.enabled()
        user = self._user() if gate else None

        if path == "/api/usage":
            # 무료 티어 예산 표시·클라이언트 스로틀용 — LLM을 부르지 않는다
            self._json(200, llm.usage())
            return

        if path == "/api/me":
            self._json(200, {"auth_enabled": gate,
                             "user": user,
                             "quota": auth.quota_status(user["id"]) if user else None})
            return

        if path == "/health":
            base = {"status": "ok", "provider": llm.provider(), "model": llm.model_name(),
                    "llm": llm.probe_cached(refresh="probe" in q),
                    "stt_local": llm.stt_local_available(),
                    "stt_ready": bool(llm.stt_local_available() or llm.GROQ_API_KEY)}
            # 인증이 켜져 있으면 색인 통계(개인 데이터의 윤곽)는 로그인한 사람에게만
            if not gate or user:
                base["rag"] = store_for(user).stats()
            self._json(200, base)
            return

        if gate and not user:
            self._json(401, {"error": "로그인이 필요합니다.", "auth": True})
            return
        store = store_for(user)

        if path == "/api/glossary/candidates":
            # raw=1이면 통계 결과 그대로(디버깅), 기본은 LLM 판별을 거친 것
            raw = ingest.glossary_candidates(store, min_count=int((q.get("min") or ["3"])[0]))
            if "raw" in q:
                self._json(200, {"candidates": raw})
                return
            if user and (msg := auth.check_llm_quota(user["id"])):
                self._json(429, {"error": msg})
                return
            self._json(200, {"candidates": ingest.refine_candidates(raw)})
        elif path == "/api/review/cards":
            self._json(200, {"cards": review.due_cards(
                store, limit=max(1, min(int((q.get("limit") or ["20"])[0]), 200)),
                include_future="all" in q), **review.counts(store)})
        elif path == "/api/rag/stats":
            self._json(200, store.stats())
        elif path == "/api/rag/search":            # 검색 단독 확인용 (디버깅·설명)
            k = max(1, min(int((q.get("k") or ["6"])[0]), 20))
            self._json(200, {"hits": store.search((q.get("q") or [""])[0], k=k)})
        elif path == "/api/admin/stats":
            if not (user and user.get("admin")):
                self._json(403, {"error": "관리자만 볼 수 있습니다."})
                return
            self._json(200, {
                "uptime_s": int(time.time() - START_TS),
                "endpoints": _metrics_snapshot(),
                "llm_usage_today": auth.usage_today(),
                "users": [{k: v for k, v in u.items() if k != "created_at"}
                          for u in auth.list_users()],
                "stores_loaded": len(_stores),
                "stt_max_concurrency": STT_MAX_CONC,
            })
        else:
            self.send_error(404)

    # ── POST ─────────────────────────────────────────────────
    def do_POST(self):
        self._streaming = False
        self._status = 0
        t0 = time.time()
        path = self.path.split("?", 1)[0]
        try:
            self._do_post(path)
        except gateway.Dropped:
            if self._streaming:
                self.close_connection = True
                return
            self._json(200, {"dropped": True})   # 밀린 한줄 요약 등 — 항목만 버림
        except urllib.error.HTTPError as e:
            if self._streaming:
                self.close_connection = True
                return
            detail = ""
            try:
                detail = e.read().decode("utf-8", "ignore")[:300]
            except Exception:  # noqa: BLE001
                pass
            self._json(e.code, {"error": f"LLM {e.code}: {detail or '(본문 없음)'}"})
        except urllib.error.URLError as e:
            if self._streaming:
                self.close_connection = True
                return
            self._json(503, {"error": f"LLM에 연결할 수 없습니다 — {getattr(e, 'reason', e)}"})
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as e:  # noqa: BLE001
            if self._streaming:
                self.close_connection = True
                return
            self._json(500, {"error": str(e)})
        finally:
            _record(f"POST {path}", self._status, (time.time() - t0) * 1000)

    def _read_body(self) -> bytes | None:
        """본문을 상한 안에서 읽는다. 초과·불명이면 응답 후 None (연결은 닫는다 —
        읽지 않은 본문이 keep-alive 연결의 다음 요청 파싱을 오염시키므로)."""
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            self.close_connection = True
            self._json(411, {"error": "Content-Length가 필요합니다."})
            return None
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            self.close_connection = True
            self._json(400, {"error": "Content-Length가 올바르지 않습니다."})
            return None
        if n < 0 or n > MAX_BODY:
            self.close_connection = True
            self._json(413, {"error": f"요청이 너무 큽니다 (상한 {MAX_BODY // (1024*1024)}MB)."})
            return None
        return self.rfile.read(n)

    def _do_post(self, path):
        if self._cross_origin():
            self._json(403, {"error": "cross-origin 요청은 허용되지 않습니다."})
            return
        body = self._read_body()
        if body is None:
            return

        # /api/stt만 바이너리(오디오)라 JSON 파싱 대상이 아니다
        try:
            req = {} if path == "/api/stt" else json.loads(body or b"{}")
        except json.JSONDecodeError as e:
            self._json(400, {"error": f"JSON 형식이 아닙니다 — {e}"})
            return
        if not isinstance(req, dict):
            self._json(400, {"error": "JSON 객체({...})가 필요합니다."})
            return

        # ── 인증 ──
        gate = auth.enabled()
        if path == "/api/login":
            if not gate:
                self._json(400, {"error": "인증이 꺼져 있습니다 (로컬 개인 모드)."})
                return
            try:
                r = auth.login(str(req.get("name") or ""), str(req.get("code") or ""),
                               ip=self._client_ip())
            except ValueError as e:
                self._json(401, {"error": str(e)})
                return
            self._json(200, {"user": r["user"]},
                       set_cookie=self._session_cookie(r["token"]))
            return
        if path == "/api/logout":
            self._json(200, {"ok": True}, set_cookie=self._session_cookie(None))
            return

        user = self._user() if gate else None
        if gate and not user:
            self._json(401, {"error": "로그인이 필요합니다.", "auth": True})
            return
        store = store_for(user)

        def over_quota() -> bool:
            """LLM을 부르는 경로만 호출 직전에 검사한다."""
            if user is None:
                return False
            msg = auth.check_llm_quota(user["id"])
            if msg:
                self._json(429, {"error": msg})
                return True
            return False

        # 🎙 오디오 세그먼트 → 텍스트 (탭 오디오 캡처 경로)
        #   Web Speech는 MediaStream을 입력으로 받지 못한다. 그래서 탭 오디오는
        #   VAD로 문장 단위로 잘라 여기로 보내 Whisper로 인식한다.
        if path == "/api/stt":
            qs = urllib.parse.parse_qs(self.path.partition("?")[2])
            lang = (qs.get("lang") or [None])[0]
            ct = (self.headers.get("Content-Type") or "audio/webm").split(";")[0].strip()
            ext = {"audio/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/wav": ".wav",
                   "audio/ogg": ".ogg", "audio/x-m4a": ".m4a"}.get(ct, ".webm")
            # 로컬 Whisper는 CPU 바운드 — 동시 인식이 몰리면 전부 느려지므로 상한
            if not _stt_sem.acquire(timeout=10):
                self._json(503, {"error": "지금 음성 인식이 몰려 있습니다 — 잠시 후 다시."})
                return
            try:
                if llm.stt_local_available():      # 로컬 우선 — 무료·무제한·비공개
                    text = llm.transcribe_local(body, filename=f"a{ext}", language=lang or None)
                else:
                    text = llm.transcribe(body, filename=f"a{ext}", language=lang or None)
            except RuntimeError as e:
                self._json(503, {"error": str(e)})
                return
            finally:
                _stt_sem.release()
            self._json(200, {"text": text})
            return

        if path == "/api/translate":
            # 자막 번역은 지연이 곧 품질 → 빠른 모델(Flash-Lite) 경로.
            # 빈 입력은 LLM까지 보내지 않는다(요금·지연 낭비, QA에서 확인).
            # texts 배열이 오면 배칭 — 문장 2~3개 = 호출 1회 (무료 티어 RPM 절약).
            texts = req.get("texts")
            if isinstance(texts, list):
                texts = [str(t).strip()[:2000] for t in texts if str(t).strip()][:3]
                if not texts:
                    self._json(400, {"error": "번역할 텍스트가 없습니다."})
                    return
                if over_quota():
                    return
                _stream(self, [{"role": "system", "content": prompts.TRANSLATE_SYSTEM},
                               {"role": "user", "content": prompts.build_translate_batch(texts)}],
                        0.3, 200 * len(texts), fast=True, kind="translate")
                return
            text = (req.get("text") or "").strip()[:2000]
            if not text:
                self._json(400, {"error": "번역할 텍스트가 없습니다."})
                return
            if over_quota():
                return
            _stream(self, [{"role": "system", "content": prompts.TRANSLATE_SYSTEM},
                           {"role": "user", "content": text}],
                    0.3, 300, fast=True, kind="translate")
            return

        if path == "/api/suggest":
            said = str(req.get("said") or "").strip()[:1500]
            if not said:
                self._json(400, {"error": "직전 발화(said)가 없습니다."})
                return
            if over_quota():
                return
            preset = req.get("preset") if req.get("preset") in ("meeting", "interview") else "meeting"
            built = prompts.build_suggest(
                said, str(req.get("context") or "")[-3000:],
                req.get("intent", "reply"), req.get("cefr", "B1"), store=store,
                preset=preset)
            # 900: 행동 딥다이브 티어(5~8문장) × EN+KR 병기 2안 + META면 700이
            # 빠듯하다 — 상한에 걸려 잘린 응답은 형식 파손(KR 누락)으로 이어진다
            _stream(self, [{"role": "user", "content": built["prompt"]}], 0.4, 900,
                    kind="suggest", bg=bool(req.get("bg")),
                    meta={"sources": built["sources"],
                          "phrases": built["phrases"],
                          "rag_used": built["rag_used"],
                          "has_placeholder": built["has_placeholder"]})
            return

        if path == "/api/summary":
            if over_quota():
                return
            mode = req.get("mode", "line")
            _stream(self, [{"role": "user", "content":
                            prompts.build_summary(req.get("transcript", ""), mode)}],
                    0.3, 60 if mode == "line" else 500, fast=(mode == "line"),
                    kind=("summary" if mode == "line" else "summary_final"))
            return

        # ── 인제스트 ──
        if path == "/api/ingest/note":
            items = ingest.notes_from_markdown(req.get("text", ""),
                                               req.get("title", "수업 노트"))
            self._json(200, {**store.add_chunks(items), "chunks": len(items)})
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
            self._json(200, {**store.add_chunks(items), "chunks": len(items),
                             "docs": max(1, (len(docs) - 1) // 2)})
            return

        if path == "/api/ingest/glossary":
            entries = req.get("entries") or []
            if not isinstance(entries, list) or any(not isinstance(e, dict) for e in entries):
                self._json(400, {"error": "entries는 {term, ko, ...} 객체의 배열이어야 합니다."})
                return
            items = ingest.chunks_from_glossary(entries)
            self._json(200, {**store.add_chunks(items), "chunks": len(items)})
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
            self._json(200, {**store.add_chunks(items), "chunks": len(items)})
            return

        # 수동 '동기화' — 자동 백그라운드 갱신은 하지 않는다(설계 결정).
        # 시드 보충 + 임베딩 누락분 채우기를 한 번에 처리한다.
        if path == "/api/sync":
            seeded = ingest.ensure_seeded(store)
            pages = [p for p in (req.get("pages") or []) if str(p).strip()]
            notes, errors = 0, []
            for pg in pages:
                try:
                    items = notion.chunks_from_page(pg)
                    notes += store.add_chunks(items).get("added", 0)
                except Exception as e:  # noqa: BLE001
                    errors.append(f"{pg}: {e}")
            embedded = store.reembed_missing() if req.get("embed", True) else 0
            self._json(200, {"seeded": seeded.get("seeded", 0), "notes": notes,
                             "embedded": embedded, "errors": errors,
                             "rag": store.stats()})
            return

        # ── 복습 자산화 (P1) ──
        if path == "/api/review/build":
            if over_quota():
                return
            rev = review.build(req.get("lines") or [], req.get("meeting") or "미팅")
            if req.get("save_cards", True) and rev.get("expressions"):
                rev["srs"] = review.add_cards(store, rev["expressions"], rev.get("meeting"))
            rev["markdown"] = review.to_markdown(rev)
            self._json(200, rev)
            return

        if path == "/api/review/grade":
            try:
                cid = int(req.get("id", 0))
            except (TypeError, ValueError):
                self._json(400, {"error": "카드 id가 숫자가 아닙니다."})
                return
            self._json(200, review.grade(store, cid, bool(req.get("ok"))))
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
            self._json(200, {**store.add_chunks(items), "chunks": len(items)})
            return

        if path == "/api/rag/reembed":
            self._json(200, {"embedded": store.reembed_missing(), **store.stats()})
            return

        if path == "/api/rag/clear":
            self._json(200, {"removed": store.clear(req.get("source")), **store.stats()})
            return

        self.send_error(404)

    def log_message(self, fmt, *args):
        # 접근 로그는 do_GET/do_POST의 _record + 아래 오류 라인으로 충분하다.
        # 인자 1개짜리 오류 로그(유휴 keep-alive 소켓 타임아웃 등)는 args[1]이
        # 없어 IndexError로 터미널을 도배했다(맥북 실측) — 조용히 무시한다.
        if len(args) > 1 and str(args[1]) not in ("200", "204", "304"):
            print(f"  [{args[1]}] {self._client_ip()} {args[0]}", flush=True)


def _banner():
    res = llm.probe_cached()
    icons = {"ok": "✅", "차단/오류": "❌", "연결 실패": "❌", "미설정": "—"}
    print("\n  🧠 번역·제안 LLM (자동 전환 순서):")
    for r in res:
        print(f"     {icons.get(r['state'], '?')} {r['name']:<9} {r['state']} {r.get('detail','')}")
    if not any(r["state"] == "ok" for r in res):
        print("     ⚠️ 살아있는 공급자가 없습니다 — 무료 키를 하나 넣으세요:")
        print("        https://cloud.cerebras.ai  또는  https://aistudio.google.com/apikey")


def main():
    gate = auth.enabled()
    public = HOST not in ("127.0.0.1", "localhost", "::1")
    if public and not gate:
        sys.exit(
            "\n  ⛔ 외부 인터페이스 바인딩(HOST=%s)인데 사용자가 없습니다.\n"
            "     무인증 공개는 미팅 기록·수업 노트가 그대로 노출되고, 서버의 LLM 키가\n"
            "     누구에게나 열립니다. 먼저 사용자를 만드세요:\n"
            "       python3 manage.py adduser <이름> --admin\n" % HOST)

    if not gate:
        seeded = ingest.ensure_seeded()
        st = rag.stats()
    print("\n  🗣  실시간 영어 미팅 어시스턴트")
    print("  ─────────────────────────────────")
    if gate:
        users = auth.list_users()
        print(f"  🔐 인증 활성 — 사용자 {len(users)}명 "
              f"({', '.join(u['name'] for u in users[:5])}"
              + (" …" if len(users) > 5 else "") + ")")
        print(f"  📊 쿼터: 사용자당 {auth.LLM_RPM_PER_USER}회/분 · "
              f"{auth.LLM_DAILY_PER_USER}회/일")
        if public and not TRUST_PROXY:
            print("  ⚠️ 외부 바인딩인데 TRUST_PROXY=1이 아닙니다 — TLS 프록시(Caddy) 뒤에서"
                  " 실행하는 구성을 권장합니다 (docs/DEPLOY.md)")
    else:
        print(f"  📚 내 자료: {st['total']}청크 "
              f"(노트 {st['by_source'].get('note',0)} · "
              f"미팅 {st['by_source'].get('transcript',0)} · "
              f"용어 {st['by_source'].get('glossary',0)})"
              + (f"  ← 용어집 {seeded['seeded']}개 시드 적재" if seeded.get("seeded") else ""))
        print(f"  🔎 검색 모드: {st['mode']}"
              + ("" if st["embed_ready"] else "  (ollama pull bge-m3 하면 의미검색 활성)"))
    print(f"\n  🖥  앱: http://localhost:{PORT}/app.html")
    print("  🛑 종료: Ctrl+C (SIGTERM도 정상 종료)")
    threading.Thread(target=_banner, daemon=True).start()
    if os.environ.get("NO_BROWSER") != "1" and not public:
        threading.Timer(0.6, lambda: webbrowser.open(f"http://localhost:{PORT}/app.html")).start()

    class Server(http.server.ThreadingHTTPServer):
        request_queue_size = 128      # 기본 5는 동시 스트리밍에서 연결 거부가 난다
        daemon_threads = True

    srv = Server((HOST, PORT), Handler)

    def _term(signum, frame):
        # systemd stop 등에서 진행 중인 응답을 마치고 내려간다
        print("\n  ⏹ 종료 신호 수신 — 정리 중…", flush=True)
        threading.Thread(target=srv.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, _term)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
        print("\n  👋 종료되었습니다.\n")


if __name__ == "__main__":
    main()
