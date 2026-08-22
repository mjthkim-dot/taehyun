"""Gemini API 모의 — 무료 티어 RPM을 실제로 강제한다 (테스트 인프라).

 · 한도: MOCK_RPM_LITE(기본 15) / MOCK_RPM_FLASH(기본 10) — 모델명 기준 슬라이딩 60초.
   기능 테스트(E2E)는 한도를 높여 돌리고, rpm-sim은 기본값(무료 티어 실값)으로 강제한다
 · 지연 프로필: lite TTFT 0.4s·140tok/s, flash TTFT 0.8s·80tok/s
 · POST /__rpd_on|/__rpd_off : RPD 소진 상태 토글 (PerDay 429 재현)
 · GET  /__stats : 모델별 호출 수

 사용: python3 tests/mock_gemini.py  →  GEMINI_API_KEY=test
       GEMINI_URL=http://127.0.0.1:3898 python3 server.py
"""
import http.server, json, os, re, threading, time
from collections import deque, Counter

PORT = int(os.environ.get("MOCK_PORT", "3898"))
_lock = threading.Lock()
_wins = {}                      # model -> deque[ts]
_counts = Counter()
_rpd_mode = {"on": False}
RPM = {"lite": int(os.environ.get("MOCK_RPM_LITE", "15")),
       "flash": int(os.environ.get("MOCK_RPM_FLASH", "10"))}

def limit_for(model):
    return RPM["lite"] if "lite" in model else RPM["flash"]

def make_text(payload, model):
    user = "\n".join(p.get("text","") for c in payload.get("contents",[])
                     for p in c.get("parts",[]))
    sysp = "\n".join(p.get("text","") for p in
                     payload.get("systemInstruction",{}).get("parts",[]))
    # 배치 번역: "1) ..." 줄들이 오면 같은 번호로 돌려준다
    nums = re.findall(r"^(\d+)\)\s*(.+)$", user, re.M)
    if nums and "번호" in user + sysp:
        return "\n".join(f"{n}) {t.split()[0]} 문장의 한국어 번역입니다." for n, t in nums)
    if "subtitling" in sysp:
        return "그 부분은 비용이 더 들 것 같다는 이야기예요."
    if "JSON object" in user:
        return json.dumps({"expressions":[{"en":f"Phrase {i}.","ko":f"표현{i}","why":"t"} for i in range(1,11)],
                           "missed":[],"questions":["When is the deadline?"],
                           "lesson_questions":["'circle back' 관용구를 연습하고 싶어요"]}, ensure_ascii=False)
    if "무슨 주제를 논의 중인지" in user:
        return "가격과 총소유비용 논의"
    # 생성 재현 규칙: ① 자료가 있으면 자료 문장을 그대로 활용(뱃지 검증용)
    # ② 자료가 없으면 프로필 블록에서 답을 구성(폴백 검증용) — 회피성 문구는 절대 없음
    m = re.search(r'THEIR OWN MATERIAL.*?"""(.*?)"""', user, re.S)
    picked = ""
    if m:
        c = [x.strip() for x in re.findall(r"([A-Z][A-Za-z',\- ]{12,80})", m.group(1)) if len(x.split()) >= 4]
        if c:
            picked = " ".join(max(c, key=len).split()[:13])
    if not picked:
        pm = re.search(r'CANDIDATE PROFILE.*?"""(.*?)"""', user, re.S)
        if pm:
            lines = [l.strip("- ").strip() for l in pm.group(1).splitlines() if l.strip().startswith("-")]
            if lines:
                base = lines[0]
                picked = "As " + " ".join(base.split()[:12]).rstrip(",.")
    a = picked or "Let me check that internally and come back to you."
    return (f"EN: {a}\nKR: (모의 번역) 한국어 뜻입니다.\n===\n"
            f"EN: Let me give you a concrete example from a recent deal.\n"
            f"KR: 최근 딜에서 구체적인 예를 들어볼게요.\n===\n"
            f"META: 요지=면접 질문 | 전략=프로필 근거 답변")

class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type","application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/__stats":
            self._json(200, dict(_counts)); return
        self.send_error(404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        if self.path == "/__rpd_on":  _rpd_mode["on"]=True;  self._json(200,{"ok":1}); return
        if self.path == "/__rpd_off": _rpd_mode["on"]=False; self._json(200,{"ok":1}); return
        m = re.search(r"/models/([^:]+):(\w+)", self.path)
        if not m: self.send_error(404); return
        model, verb = m.group(1), m.group(2)
        if _rpd_mode["on"]:
            self._json(429, {"error":{"code":429,"status":"RESOURCE_EXHAUSTED",
                "message":"Quota exceeded for quota metric ... GenerateRequestsPerDayPerProjectPerModel"}})
            return
        now = time.time()
        with _lock:
            w = _wins.setdefault(model, deque())
            while w and now - w[0] > 60: w.popleft()
            if len(w) >= limit_for(model):
                self._json(429, {"error":{"code":429,"status":"RESOURCE_EXHAUSTED",
                    "message":"Quota exceeded ... GenerateRequestsPerMinutePerProjectPerModel"}})
                return
            w.append(now); _counts[model]+=1
        payload = json.loads(body or b"{}")
        text = make_text(payload, model)
        ttft = 0.4 if "lite" in model else 0.8
        cps = (140 if "lite" in model else 80) * 4
        if verb == "generateContent":
            time.sleep(ttft + len(text)/cps)
            self._json(200, {"candidates":[{"content":{"parts":[{"text":text}]}}]})
            return
        # streamGenerateContent?alt=sse
        self.send_response(200)
        self.send_header("Content-Type","text/event-stream")
        self.send_header("Transfer-Encoding","chunked"); self.end_headers()
        def ev(txt):
            d = json.dumps({"candidates":[{"content":{"parts":[{"text":txt}]}}]})
            payload = f"data: {d}\n\n".encode()
            self.wfile.write(f"{len(payload):x}\r\n".encode()+payload+b"\r\n"); self.wfile.flush()
        time.sleep(ttft)
        step = 14
        for i in range(0, len(text), step):
            ev(text[i:i+step]); time.sleep(step/cps)
        self.wfile.write(b"0\r\n\r\n"); self.wfile.flush()
    def log_message(self,*a): pass

http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
