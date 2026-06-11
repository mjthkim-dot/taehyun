#!/usr/bin/env python3
"""
AI 영어 회화 파트너 — Proxy Server
Gemma4 (Ollama) ↔ Web Browser
"""

import http.server
import json
import os
import socket
import sys
import webbrowser
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌ requests 패키지가 필요합니다: pip3 install requests")
    sys.exit(1)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
PORT = int(os.environ.get("PORT", "3777"))
HOST = os.environ.get("HOST", "0.0.0.0")  # 0.0.0.0 = 같은 Wi-Fi의 모바일에서도 접속 가능
HTML_FILE = Path(__file__).parent / "index.html"


def get_lan_ip():
    """모바일에서 접속할 수 있는 이 컴퓨터의 로컬 네트워크 IP를 찾는다."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # 실제 전송 없음 — 라우팅 인터페이스 확인용
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


class Handler(http.server.BaseHTTPRequestHandler):

    # ── CORS headers ──────────────────────────────────────
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # ── Serve index.html ──────────────────────────────────
    def do_GET(self):
        if self.path in ("/", "/index.html"):
            data = HTML_FILE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            # 코드 업데이트가 즉시 반영되도록 브라우저/터널 캐시 금지
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self._cors()
            self.end_headers()
            self.wfile.write(data)

        elif self.path == "/health":
            # Check if Ollama is reachable
            try:
                r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
                models = [m["name"] for m in r.json().get("models", [])]
                payload = json.dumps({"status": "ok", "models": models}).encode()
            except Exception as e:
                payload = json.dumps({"status": "error", "message": str(e)}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(payload)

        else:
            self.send_error(404)

    # ── Proxy /api/chat → Ollama (streaming) ──────────────
    def do_POST(self):
        if self.path != "/api/chat":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            resp = requests.post(
                f"{OLLAMA_URL}/api/chat",
                data=body,
                headers={"Content-Type": "application/json"},
                stream=True,
                timeout=120,
            )
            self.send_response(resp.status_code)
            self.send_header("Content-Type", "application/x-ndjson")
            self._cors()
            self.end_headers()

            for chunk in resp.iter_content(chunk_size=None):
                if chunk:
                    self.wfile.write(chunk)
                    self.wfile.flush()

        except requests.exceptions.ConnectionError:
            err = json.dumps({"error": "Ollama에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요."}).encode()
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(err)
        except Exception as e:
            err = json.dumps({"error": str(e)}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(err)

    def log_message(self, fmt, *args):
        # Only log errors, not every request
        if args and str(args[1]) not in ("200", "204"):
            print(f"  [{args[1]}] {args[0]}")


def check_ollama():
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        models = [m["name"] for m in r.json().get("models", [])]
        gemma = [m for m in models if "gemma" in m.lower()]
        print(f"✅ Ollama 연결됨 ({OLLAMA_URL})")
        if gemma:
            print(f"   Gemma 모델: {', '.join(gemma)}")
        else:
            print(f"   ⚠️  Gemma 모델 없음. ollama pull gemma4 실행 필요")
        return True
    except Exception:
        print(f"⚠️  Ollama 미연결 ({OLLAMA_URL})")
        print("   → Ollama를 먼저 실행하세요: ollama serve")
        return False


if __name__ == "__main__":
    print()
    print("  🎓  PREPLY AI 스피킹 코치")
    print("  ─────────────────────────────")
    check_ollama()
    print(f"\n  🖥  PC 브라우저:    http://localhost:{PORT}")
    lan_ip = get_lan_ip()
    if lan_ip:
        print(f"  📱 모바일 브라우저: http://{lan_ip}:{PORT}")
        print("     (같은 Wi-Fi에 연결된 기기에서 접속하세요)")
    print("  🛑 종료: Ctrl+C\n")

    webbrowser.open(f"http://localhost:{PORT}")

    # ThreadingHTTPServer: 스트리밍 응답 중에도 다른 요청(모바일 동시 접속, /health) 처리 가능
    server = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n  👋 서버가 종료되었습니다.\n")
