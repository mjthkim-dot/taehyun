#!/usr/bin/env python3
"""
AI 영어 회화 파트너 — Proxy Server
Gemma4 (Ollama) ↔ Web Browser
"""

import http.server
import json
import os
import re
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
CAF_MODEL = os.environ.get("CAF_MODEL", "gemma4:e2b")

# CEFR → 한 단계 위 (paraphrase 목표 레벨)
CEFR_NEXT = {"A1": "A2", "A2": "B1", "B1": "B2", "B2": "C1", "C1": "C2", "C2": "C2"}
FILLER_RE = re.compile(r"\b(um+|uh+|er+|like|you know|i mean|kind of|sort of|well)\b", re.I)


def _caf_prompt(transcript, cefr, wpm):
    """CAF 분석용 단일 구조화 프롬프트 (JSON 강제)."""
    target = CEFR_NEXT.get(cefr, "B1")
    wpm_line = f"- 측정된 발화 속도(WPM): {wpm:.0f}" if wpm else "- 발화 속도: 미측정"
    return (
        "You are an expert CEFR-certified speech examiner running a CAF "
        "(Complexity, Accuracy, Fluency) analysis. Analyze the learner's English speech.\n\n"
        f"Learner CEFR level: {cefr}\n"
        f"Paraphrase target level (one step up): {target}\n"
        f"{wpm_line}\n\n"
        f'Learner transcript:\n"""{transcript}"""\n\n'
        "Return ONLY valid JSON (no markdown) with this exact shape:\n"
        "{\n"
        '  "complexity": <0-10 float: clause variety, subordination, lexical range>,\n'
        '  "accuracy":   <0-10 float: grammatical correctness; deduct for errors>,\n'
        '  "fluency":    <0-10 float: flow, low filler use, sentence completeness>,\n'
        '  "error_density": <errors per 100 words, float>,\n'
        '  "errors": [{"wrong":"...","right":"...","type":"tense|agreement|article|preposition|word-choice|other","why_ko":"한국어 한 줄"}],\n'
        f'  "paraphrases": [{{"original":"learner phrase","upgraded":"{target}-level natural rephrasing","note_ko":"왜 더 세련됐는지 한국어"}}],\n'
        '  "summary_ko": "한국어로 2문장 총평 (격려 톤)"\n'
        "}\n\n"
        f"Rules:\n- Max 3 errors (most important first), max 3 paraphrases.\n"
        f"- 'upgraded' must be natural {target}-level English, NOT just longer.\n"
        "- If transcript too short/empty, return JSON with low scores and empty arrays."
    )


def _clamp(v, lo=0.0, hi=10.0):
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return 0.0


def analyze_caf(transcript, cefr="A2", duration_sec=None, model=None):
    """STT 트랜스크립트 → CAF 분석 결과 dict. (stdlib + requests, 의존성 0)"""
    transcript = (transcript or "").strip()
    words = re.findall(r"[A-Za-z']+", transcript)
    n = len(words)
    fillers = len(FILLER_RE.findall(transcript))
    filler_ratio = round(fillers / n, 3) if n else 0.0
    wpm = round(n / (duration_sec / 60.0), 1) if duration_sec and duration_sec > 0 else None
    metrics = {"word_count": float(n), "filler_ratio": filler_ratio, "wpm": wpm}

    if n < 3:
        return {"complexity": 0, "accuracy": 0, "fluency": 0, "error_density": 0,
                "errors": [], "paraphrases": [], "metrics": metrics,
                "summary_ko": "분석할 발화가 너무 짧아요. 한두 문장 더 말해 보세요!"}

    r = requests.post(
        f"{OLLAMA_URL}/api/chat",
        json={"model": model or CAF_MODEL,
              "messages": [{"role": "user", "content": _caf_prompt(transcript, cefr, wpm)}],
              "stream": False, "format": "json", "keep_alive": "30m",
              "options": {"temperature": 0.3, "num_predict": 700}},
        timeout=120,
    )
    r.raise_for_status()
    data = json.loads(r.json()["message"]["content"])
    result = {
        "complexity": round(_clamp(data.get("complexity", 0)), 1),
        "accuracy": round(_clamp(data.get("accuracy", 0)), 1),
        "fluency": round(_clamp(data.get("fluency", 0)), 1),
        "error_density": _clamp(data.get("error_density", 0), 0, 100),
        "errors": (data.get("errors") or [])[:3],
        "paraphrases": (data.get("paraphrases") or [])[:3],
        "summary_ko": str(data.get("summary_ko", "")).strip(),
        "metrics": metrics,
    }
    if filler_ratio > 0.1:
        result["fluency"] = round(max(0.0, result["fluency"] - filler_ratio * 10), 1)
    return result


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

    def _send_json(self, code, obj):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    # ── Proxy /api/chat → Ollama (streaming) + /api/caf ───
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        # 🆕 CAF 분석 엔드포인트
        if self.path == "/api/caf":
            try:
                req = json.loads(body or b"{}")
                result = analyze_caf(
                    req.get("transcript", ""), req.get("cefr", "A2"),
                    req.get("duration_sec"), req.get("model"),
                )
                self._send_json(200, result)
            except requests.exceptions.ConnectionError:
                self._send_json(503, {"error": "Ollama에 연결할 수 없습니다."})
            except Exception as e:  # noqa: BLE001
                self._send_json(500, {"error": str(e)})
            return

        if self.path != "/api/chat":
            self.send_error(404)
            return

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
