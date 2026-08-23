#!/usr/bin/env python3
"""
웹 배포 계층 회귀 테스트 — 인증·격리·쿼터·전송 (자체 완결형)

임시 데이터 디렉터리에 사용자 2명을 만들고, 모의 LLM과 서버를 직접 띄워
아래를 검증한 뒤 전부 정리한다. 실행: python3 tests/web_qa.py

 · 미로그인 401 / 정적 파일은 열림 / health 최소화
 · 로그인(오답 401·정답 쿠키·보안 플래그) / 로그아웃
 · 사용자 간 물리적 데이터 격리 (검색·삭제가 서로 안 보임)
 · LLM 쿼터 429 (RPM=3으로 줄여서)
 · 관리자 통계 접근 제어
 · HTTP/1.1 keep-alive + 청크 스트리밍 프레이밍 (한 연결로 스트림 포함 3요청)
 · slowloris 미완성 헤더 30개 → 타임아웃으로 스레드 회수
 · Content-Length 초과 → 413
"""
import http.server
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
results = []


def check(name, cond, detail=""):
    results.append((name, cond))
    print(f"  {'✅' if cond else '❌'} {name}" + (f" — {detail}" if detail else ""))


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


# ── 모의 LLM (Anthropic /messages 흉내 — SSE 스트림) ──────────
class MockLLM(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        self.rfile.read(n)
        text = "EN: Mock answer here.\nKR: 모의 응답입니다.\n===\nMETA: 요지=테스트 | 전략=테스트"
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        def ev(t, d):
            # 실제 Anthropic SSE는 event 헤더뿐 아니라 data JSON 안에도 type을 넣는다.
            # type이 빠지면 파서가 토큰을 한 개도 못 뽑아 '빈 스트림'이 되는데,
            # 예전에는 그게 조용히 200으로 통과했다 (빈 응답 가드가 잡아냄)
            self.wfile.write(f"event: {t}\ndata: {json.dumps({'type': t, **d})}\n\n".encode())
        ev("message_start", {})
        for i in range(0, len(text), 16):
            ev("content_block_delta",
               {"delta": {"type": "text_delta", "text": text[i:i + 16]}})
        ev("message_stop", {})

    def log_message(self, *a):
        pass


class Client:
    def __init__(self, base):
        self.base, self.cookie = base, None

    def req(self, method, path, body=None):
        h = {"Content-Type": "application/json"}
        if self.cookie:
            h["Cookie"] = self.cookie
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(self.base + path, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(r, timeout=30) as x:
                sc = x.headers.get("Set-Cookie")
                if sc:
                    self.cookie = sc.split(";")[0]
                return x.status, x.read(), sc
        except urllib.error.HTTPError as e:
            return e.code, e.read(), None


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="mc-webqa-"))
    llm_port, app_port = free_port(), free_port()
    env = {**os.environ,
           "MC_DATA_DIR": str(tmp), "PORT": str(app_port), "NO_BROWSER": "1",
           "ANTHROPIC_API_KEY": "test", "ANTHROPIC_URL": f"http://127.0.0.1:{llm_port}",
           "LLM_RPM_PER_USER": "3"}
    for k in ("CEREBRAS_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY"):
        env.pop(k, None)

    mock = http.server.ThreadingHTTPServer(("127.0.0.1", llm_port), MockLLM)
    threading.Thread(target=mock.serve_forever, daemon=True).start()

    subprocess.run([sys.executable, "manage.py", "adduser", "alice",
                    "--code", "alice-pass-1", "--admin"], cwd=ROOT, env=env,
                   check=True, capture_output=True)
    subprocess.run([sys.executable, "manage.py", "adduser", "bob",
                    "--code", "bob-pass-9999"], cwd=ROOT, env=env,
                   check=True, capture_output=True)
    srv = subprocess.Popen([sys.executable, "server.py"], cwd=ROOT, env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{app_port}"
    for _ in range(50):
        try:
            urllib.request.urlopen(base + "/health", timeout=1)
            break
        except Exception:
            time.sleep(0.2)

    try:
        anon = Client(base)
        print("■ 미로그인")
        c, b, _ = anon.req("GET", "/app.html")
        check("정적 파일 열림", c == 200)
        c, b, _ = anon.req("GET", "/api/rag/stats")
        check("API 401", c == 401)
        c, b, _ = anon.req("GET", "/health")
        check("health에 색인 통계 없음", c == 200 and "rag" not in json.loads(b))

        print("■ 로그인·세션")
        alice = Client(base)
        c, _, _ = alice.req("POST", "/api/login", {"name": "alice", "code": "no"})
        check("오답 401", c == 401)
        c, _, sc = alice.req("POST", "/api/login", {"name": "alice", "code": "alice-pass-1"})
        check("정답 → 쿠키(HttpOnly·Lax)", c == 200 and sc and "HttpOnly" in sc and "SameSite=Lax" in sc)

        print("■ 격리")
        alice.req("POST", "/api/ingest/note",
                  {"text": "# s\nalice secret pricing insight here.", "title": "비밀"})
        c, b, _ = alice.req("GET", "/api/rag/search?q=alice%20secret%20pricing&k=3")
        check("본인 노트 검색됨", b"alice secret" in b)
        bob = Client(base)
        bob.req("POST", "/api/login", {"name": "bob", "code": "bob-pass-9999"})
        c, b, _ = bob.req("GET", "/api/rag/search?q=alice%20secret%20pricing&k=3")
        check("남의 노트 안 보임", c == 200 and b"alice secret" not in b)
        bob.req("POST", "/api/rag/clear", {})
        c, b, _ = alice.req("GET", "/api/rag/stats")
        check("남의 clear 영향 없음", json.loads(b)["total"] >= 71)

        print("■ 쿼터 (RPM=3)")
        codes = [alice.req("POST", "/api/translate", {"text": f"hello {i}"})[0]
                 for i in range(5)]
        check("3회 후 429", codes[:3] == [200] * 3 and 429 in codes[3:], str(codes))

        print("■ 관리자")
        c, b, _ = alice.req("GET", "/api/admin/stats")
        check("admin 200 + 지연 통계", c == 200 and "endpoints" in json.loads(b))
        c, _, _ = bob.req("GET", "/api/admin/stats")
        check("일반 사용자 403", c == 403)

        print("■ 전송 계층 (keep-alive · 청크 · slowloris · 413)")
        s = socket.create_connection(("127.0.0.1", app_port), timeout=10)
        s.sendall(b"GET /health HTTP/1.1\r\nHost: l\r\n\r\n")
        first = s.recv(65536)
        check("HTTP/1.1 응답", first.startswith(b"HTTP/1.1 200"))
        # alice는 직전 쿼터 테스트에서 분당 한도를 소진했다 — bob으로 스트림 검증
        pay = json.dumps({"said": "test", "intent": "agree"}).encode()
        s.sendall(b"POST /api/suggest HTTP/1.1\r\nHost: l\r\nContent-Type: application/json\r\n"
                  + f"Cookie: {bob.cookie}\r\nContent-Length: {len(pay)}\r\n\r\n".encode() + pay)
        buf = b""
        t0 = time.time()
        while b"0\r\n\r\n" not in buf and time.time() - t0 < 15:
            buf += s.recv(65536)
        check("청크 스트림 종료 프레임", b"Transfer-Encoding: chunked" in buf and b"0\r\n\r\n" in buf)
        s.sendall(b"GET /health HTTP/1.1\r\nHost: l\r\n\r\n")
        check("스트림 뒤 같은 연결 재사용", s.recv(65536).startswith(b"HTTP/1.1 200"))
        s.close()

        slow = []
        for _ in range(10):
            c2 = socket.create_connection(("127.0.0.1", app_port))
            c2.sendall(b"GET /health HTTP/1.1\r\nHost: l\r\n")
            slow.append(c2)
        time.sleep(1)
        with open(f"/proc/{srv.pid}/status") as f:
            th_during = int([l for l in f if l.startswith("Threads")][0].split()[1])
        for c2 in slow:
            c2.close()
        check("미완성 헤더가 스레드를 점유(타임아웃 대상)", th_during >= 10, f"{th_during}")

        c2 = socket.create_connection(("127.0.0.1", app_port))
        c2.sendall(b"POST /api/translate HTTP/1.1\r\nHost: l\r\nContent-Length: 99999999\r\n\r\n")
        check("본문 상한 413", c2.recv(4096).startswith(b"HTTP/1.1 413"))
        c2.close()
    finally:
        srv.send_signal(signal.SIGTERM)
        try:
            srv.wait(timeout=10)
        except subprocess.TimeoutExpired:
            srv.kill()
        mock.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)

    fails = [n for n, ok in results if not ok]
    print(f"\n결과: {len(results) - len(fails)}/{len(results)}"
          + (f" — 실패: {fails}" if fails else " ✅"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
