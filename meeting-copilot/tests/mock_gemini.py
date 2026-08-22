"""Gemini API 모의 — 무료 티어 RPM을 실제로 강제한다 (테스트 인프라).

 · 한도: MOCK_RPM_LITE(기본 15) / MOCK_RPM_FLASH(기본 10) — 모델명 기준 슬라이딩 60초.
   기능 테스트(E2E)는 한도를 높여 돌리고, rpm-sim은 기본값(무료 티어 실값)으로 강제한다
 · 지연 프로필: lite TTFT 0.4s·140tok/s, flash TTFT 0.8s·80tok/s
 · POST /__rpd_on|/__rpd_off : RPD 소진 상태 토글 (PerDay 429 재현)
 · POST /__err {"mode":"429"|"503","p":0.3,"retry_after":2} : 무작위 오류 주입
   ({"mode":"off"}로 해제) — 게이트웨이 서킷브레이커·항목 스킵 검증용
 · GET  /__stats : 모델별 호출 수 + 주입 오류 수

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
_err_mode = {"mode": "off", "p": 0.0, "retry_after": None}   # 무작위 오류 주입
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
    # 출력은 speakability 규칙을 지킨다: 1안(Safe) ≤9단어, 2안(Rich) ≤12단어, 축약형.
    m = re.search(r'THEIR OWN MATERIAL.*?"""(.*?)"""', user, re.S)
    picked = ""
    if m:
        # [검색어] 꼬리는 검색 다리용 키워드 나열이라 '말할 문장'이 아니다 — 제외
        mat = re.sub(r"\[검색어\][^\n]*", "", m.group(1))
        c = [x.strip() for x in re.findall(r"([A-Za-z][A-Za-z',\- ]{12,80})", mat) if len(x.split()) >= 4]
        if c:
            # 자료 문장을 '연속 어절 그대로' 9단어까지 — 📚 뱃지(연속 3어절 일치) 검증 유지
            picked = " ".join(max(c, key=len).split()[:9]).rstrip(",.")
    if not picked:
        picked = "I'm a B2B sales hunter at a cloud MSP"
    return (f"EN: {picked}.\nKR: (모의 번역) 한국어 뜻입니다.\n===\n"
            f"EN: So let me share one example from a recent deal.\n"
            f"KR: 최근 딜에서 예를 하나 말씀드릴게요.\n===\n"
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
        if self.path == "/__err":
            cfg = json.loads(body or b"{}")
            _err_mode.update(mode=cfg.get("mode","off"), p=float(cfg.get("p",0)),
                             retry_after=cfg.get("retry_after"))
            self._json(200, dict(_err_mode)); return
        m = re.search(r"/models/([^:]+):(\w+)", self.path)
        if not m: self.send_error(404); return
        model, verb = m.group(1), m.group(2)
        # 무작위 오류 주입 — 429는 Retry-After 헤더 포함(게이트웨이가 준수하는지 검증)
        import random as _r
        if _err_mode["mode"] != "off" and _r.random() < _err_mode["p"]:
            _counts[f"inject_{_err_mode['mode']}"] += 1
            if _err_mode["mode"] == "429":
                b = json.dumps({"error":{"code":429,"status":"RESOURCE_EXHAUSTED",
                    "message":"Quota exceeded ... GenerateRequestsPerMinutePerProjectPerModel"}}).encode()
                self.send_response(429)
                self.send_header("Content-Type","application/json")
                if _err_mode["retry_after"] is not None:
                    self.send_header("Retry-After", str(_err_mode["retry_after"]))
                self.send_header("Content-Length", str(len(b))); self.end_headers()
                self.wfile.write(b); return
            self._json(503, {"error":{"code":503,"status":"UNAVAILABLE",
                             "message":"The service is currently unavailable."}})
            return
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
