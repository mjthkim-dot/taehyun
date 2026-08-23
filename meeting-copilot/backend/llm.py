"""
═══════════════════════════════════════════════════════════════
 LLM(답변/번역/요약) 다중 공급자 + Whisper STT(음성 인식)

 - LLM:  Groq → Cerebras → Gemini → Ollama 자동 전환 (LLM_ORDER로 조정)
         실시간 퀄리티가 핵심이라 70B급 클라우드를 앞순위로 유지한다.
 - STT:  whisper-large-v3-turbo (Groq 전용 — 기본 엔진은 브라우저 Web Speech)

 스트리밍은 어느 프로바이더든 Ollama NDJSON 형태({"message":{"content":...}})로
 통일해 내보내므로 프런트엔드는 수정 없이 그대로 동작한다.

 의존성 0 (stdlib urllib만 사용) — server.py 전용 (interview-coach는 독립 프로젝트).
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Iterator

# ═══ 다중 공급자 자동 전환 (Groq → Cerebras → Gemini → Ollama) ═══
# 실시간 번역·답변 '퀄리티'가 핵심이므로 70B급 클라우드 모델을 앞순위로 유지한다.
# 회사망이 api.groq.com을 차단해도 Cerebras(오픈소스 70B, 무료 1M토큰/일)나
# Gemini(구글 도메인 — 대부분 허용), 로컬 Ollama로 자동 전환되어
# 하나만 살아있으면 번역·답변이 계속 동작한다.
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = os.environ.get("GROQ_URL", "https://api.groq.com/openai/v1")  # 테스트용 오버라이드 가능
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_STT_MODEL = os.environ.get("GROQ_STT_MODEL", "whisper-large-v3-turbo")
CEREBRAS_API_KEY = os.environ.get("CEREBRAS_API_KEY")  # 무료 발급: https://cloud.cerebras.ai
CEREBRAS_URL = os.environ.get("CEREBRAS_URL", "https://api.cerebras.ai/v1")  # OpenAI 호환
CEREBRAS_MODEL = os.environ.get("CEREBRAS_MODEL", "llama-3.3-70b")
# Gemini — 기본 공급자. 무료 티어(키만 발급하면 됨)로 전 기능이 돌고,
# 회사망 통과율이 높다. OpenAI 호환 엔드포인트도 있지만 네이티브 API가
# 이미 이 추상화(chat/stream/json_mode/system)에 맞으므로 네이티브를 유지한다.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")   # 무료 발급: https://aistudio.google.com/apikey
GEMINI_URL = os.environ.get("GEMINI_URL", "https://generativelanguage.googleapis.com/v1beta")
# 모델 티어링 (무료 티어 = Flash 계열 전제, 하드코딩 금지 — env로 교체 가능):
#  · 번역·한줄요약(고빈도) → Flash-Lite: 무료 RPM이 가장 높다 (15 RPM/1,000 RPD)
#  · 퀵 리액션·전체 요약·자산화 → Flash (10 RPM/250 RPD)
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_FAST_MODEL = os.environ.get("GEMINI_FAST_MODEL", "gemini-2.5-flash-lite")
# 무료 티어 한도(구글 공시값에서 여유 1~2를 뺀 내부 예산 — 초과 429를 예방)
GEMINI_FAST_RPM = int(os.environ.get("GEMINI_FAST_RPM", "13"))
GEMINI_MAIN_RPM = int(os.environ.get("GEMINI_MAIN_RPM", "9"))
GEMINI_FAST_RPD = int(os.environ.get("GEMINI_FAST_RPD", "1000"))
GEMINI_MAIN_RPD = int(os.environ.get("GEMINI_MAIN_RPD", "250"))
# 무료 티어는 입력이 모델 개선에 사용될 수 있다(구글 약관) — 유료 결제 계정이면
# GEMINI_TIER=paid 로 선언 (API로는 티어를 조회할 수 없어 선언 기반이다)
GEMINI_TIER = os.environ.get("GEMINI_TIER", "free")
# 폴백용 로컬 모델 — 한국어 자연스러움이 소형 오픈소스 중 최상위 + 16GB에서 여유(Q4 ≈ 5GB)
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:8b")
# 검색용 임베딩 — 한·영 교차 검색에 강한 오픈소스 (설치: ollama pull bge-m3, ~1GB)
# 없으면 키워드 검색으로 자동 폴백되므로 필수는 아니다.
EMBED_MODEL = os.environ.get("EMBED_MODEL", "bge-m3")
# Claude(Anthropic) — 번역·요약의 기본 공급자. 미팅 어시스턴트는 구어체 한국어
# 품질이 곧 체감 품질이라 여기를 1순위로 둔다.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_URL = os.environ.get("ANTHROPIC_URL", "https://api.anthropic.com/v1")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
# 실시간 경로(자막 번역·한 줄 요약)는 지연이 품질이다 → 빠른 모델을 따로 둔다
ANTHROPIC_FAST_MODEL = os.environ.get("ANTHROPIC_FAST_MODEL", "claude-haiku-4-5-20251001")
# 기본 체인: Gemini 우선 (무료 티어로 전 기능 동작). 다른 키가 있으면 자동 폴백.
LLM_ORDER = [p.strip() for p in
             os.environ.get("LLM_ORDER", "gemini,anthropic,cerebras,groq,ollama").split(",")
             if p.strip()]

# 공급자별 '빠른 모델' — fast=True로 호출하면 이걸 쓴다 (없으면 기본 모델)
FAST_MODELS = {"anthropic": ANTHROPIC_FAST_MODEL, "gemini": GEMINI_FAST_MODEL}

# 🆓 로컬 STT — faster-whisper가 설치돼 있으면 맥에서 직접 인식 (무료·무제한·비공개)
# STT_LOCAL=0 으로 끌 수 있고, 미설치 시 자동으로 Groq Whisper로 폴백된다.
STT_LOCAL = os.environ.get("STT_LOCAL", "1") != "0"
STT_LOCAL_MODEL = os.environ.get("STT_LOCAL_MODEL", "base")   # tiny/base/small/medium
_local_model = None
_local_failed = False

# 실시간 번역 시스템 프롬프트 (KR↔EN 자동 감지)
TRANSLATE_SYSTEM_PROMPT = """You are a real-time Korean-English translator for a
job-interview copilot. Detect the input language automatically:
- If the input is Korean, translate it into natural, spoken English.
- If the input is English, translate it into natural Korean.
Reply with ONLY the translation text - no quotes, no labels, no explanation."""


def _open(url: str, payload: dict, headers: dict | None = None, timeout: int = 300):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})}, method="POST",
    )
    return urllib.request.urlopen(req, timeout=timeout)


# ─────────────────────────────────────────────────────────────
#  공급자별 구현 — chat(단발) / stream(NDJSON 토큰)
# ─────────────────────────────────────────────────────────────
# Groq·Cerebras 공통 (OpenAI 호환 API)
def _oai_chat(base, key, default_model, messages, json_mode, temperature, max_tokens, model):
    payload: dict = {
        "model": model or default_model, "messages": messages,
        "temperature": temperature, "max_tokens": max_tokens, "stream": False,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    with _open(f"{base}/chat/completions", payload,
               {"Authorization": f"Bearer {key}"}) as r:
        return json.loads(r.read())["choices"][0]["message"]["content"]


def _oai_stream(base, key, default_model, messages, temperature, max_tokens, model):
    payload = {
        "model": model or default_model, "messages": messages,
        "temperature": temperature, "max_tokens": max_tokens, "stream": True,
    }
    with _open(f"{base}/chat/completions", payload,
               {"Authorization": f"Bearer {key}"}, timeout=120) as resp:
        for raw in resp:  # SSE: "data: {...}\n"
            line = raw.decode("utf-8", "ignore").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                tok = json.loads(data)["choices"][0]["delta"].get("content")
            except (json.JSONDecodeError, KeyError, IndexError):
                continue
            if tok:
                yield (json.dumps({"message": {"content": tok}}) + "\n").encode("utf-8")
    yield (json.dumps({"done": True}) + "\n").encode("utf-8")


def _groq_chat(messages, json_mode, temperature, max_tokens, model):
    return _oai_chat(GROQ_URL, GROQ_API_KEY, GROQ_MODEL,
                     messages, json_mode, temperature, max_tokens, model)


def _groq_stream(messages, temperature, max_tokens, model):
    return _oai_stream(GROQ_URL, GROQ_API_KEY, GROQ_MODEL,
                       messages, temperature, max_tokens, model)


def _cerebras_chat(messages, json_mode, temperature, max_tokens, model):
    return _oai_chat(CEREBRAS_URL, CEREBRAS_API_KEY, CEREBRAS_MODEL,
                     messages, json_mode, temperature, max_tokens, model)


def _cerebras_stream(messages, temperature, max_tokens, model):
    return _oai_stream(CEREBRAS_URL, CEREBRAS_API_KEY, CEREBRAS_MODEL,
                       messages, temperature, max_tokens, model)


def _anthropic_payload(messages, temperature, max_tokens, model, stream):
    """Anthropic은 system을 messages가 아니라 최상위 필드로 받는다."""
    sys_parts = [m["content"] for m in messages if m["role"] == "system"]
    conv = [{"role": ("assistant" if m["role"] == "assistant" else "user"),
             "content": m["content"]} for m in messages if m["role"] != "system"]
    payload = {"model": model or ANTHROPIC_MODEL, "messages": conv or [{"role": "user", "content": ""}],
               "max_tokens": max_tokens, "temperature": temperature}
    if sys_parts:
        payload["system"] = "\n\n".join(sys_parts)
    if stream:
        payload["stream"] = True
    return payload


def _anthropic_headers():
    return {"x-api-key": ANTHROPIC_API_KEY or "", "anthropic-version": "2023-06-01"}


def _anthropic_chat(messages, json_mode, temperature, max_tokens, model):
    payload = _anthropic_payload(messages, temperature, max_tokens, model, False)
    if json_mode:   # JSON 강제 문법이 없으므로 프리필로 유도한다
        payload["messages"] = payload["messages"] + [{"role": "assistant", "content": "{"}]
    with _open(f"{ANTHROPIC_URL}/messages", payload, _anthropic_headers()) as r:
        blocks = json.loads(r.read()).get("content") or []
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    if not json_mode:
        return text
    # 프리필("{")을 쓰면 모델은 그 뒤부터 이어 쓴다. 다만 모델이 여는 중괄호를
    # 다시 내보내는 경우도 있어, 무조건 붙이면 '{{'가 되어 파싱이 깨진다.
    t = text.lstrip()
    return t if t.startswith("{") else "{" + text


def _anthropic_stream(messages, temperature, max_tokens, model):
    payload = _anthropic_payload(messages, temperature, max_tokens, model, True)
    with _open(f"{ANTHROPIC_URL}/messages", payload, _anthropic_headers(), timeout=120) as resp:
        for raw in resp:                      # SSE: event: ... / data: {...}
            line = raw.decode("utf-8", "ignore").strip()
            if not line.startswith("data:"):
                continue
            try:
                ev = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            if ev.get("type") == "content_block_delta":
                tok = (ev.get("delta") or {}).get("text")
                if tok:
                    yield (json.dumps({"message": {"content": tok}}) + "\n").encode("utf-8")
            elif ev.get("type") == "message_stop":
                break
    yield (json.dumps({"done": True}) + "\n").encode("utf-8")


def _gemini_payload(messages, json_mode, temperature, max_tokens):
    system_parts, contents = [], []
    for m in messages:
        if m["role"] == "system":
            system_parts.append({"text": m["content"]})
        else:
            contents.append({"role": "model" if m["role"] == "assistant" else "user",
                             "parts": [{"text": m["content"]}]})
    payload: dict = {"contents": contents,
                     "generationConfig": {"temperature": temperature,
                                          "maxOutputTokens": max_tokens}}
    if system_parts:
        payload["systemInstruction"] = {"parts": system_parts}
    if json_mode:
        payload["generationConfig"]["responseMimeType"] = "application/json"
    return payload


def _gemini_text(obj) -> str:
    try:
        return "".join(p.get("text", "") for p in obj["candidates"][0]["content"]["parts"])
    except (KeyError, IndexError, TypeError):
        return ""


def _gemini_chat(messages, json_mode, temperature, max_tokens, model):
    payload = _gemini_payload(messages, json_mode, temperature, max_tokens)
    url = f"{GEMINI_URL}/models/{model or GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    with _open(url, payload, timeout=120) as r:
        return _gemini_text(json.loads(r.read()))


def _gemini_stream(messages, temperature, max_tokens, model):
    payload = _gemini_payload(messages, False, temperature, max_tokens)
    url = f"{GEMINI_URL}/models/{model or GEMINI_MODEL}:streamGenerateContent?alt=sse&key={GEMINI_API_KEY}"
    with _open(url, payload, timeout=120) as resp:
        for raw in resp:  # SSE: "data: {...}\n"
            line = raw.decode("utf-8", "ignore").strip()
            if not line.startswith("data:"):
                continue
            try:
                tok = _gemini_text(json.loads(line[5:].strip()))
            except json.JSONDecodeError:
                continue
            if tok:
                yield (json.dumps({"message": {"content": tok}}) + "\n").encode("utf-8")
    yield (json.dumps({"done": True}) + "\n").encode("utf-8")


_ollama_model_cache: tuple[float, str | None] = (0.0, None)


def _ollama_pick_model() -> str | None:
    """설치된 모델 중에서 선택 — OLLAMA_MODEL이 있으면 그것, 없으면 첫 모델(자동 적응)."""
    global _ollama_model_cache
    ts, cached = _ollama_model_cache
    if time.time() - ts < 60:
        return cached
    picked = None
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=3) as r:
            names = [m["name"] for m in json.loads(r.read()).get("models", [])]
        if names:
            picked = next((n for n in names if n.startswith(OLLAMA_MODEL)), names[0])
    except Exception:  # noqa: BLE001
        picked = None
    _ollama_model_cache = (time.time(), picked)
    return picked


def _ollama_chat(messages, json_mode, temperature, max_tokens, model):
    m = model or _ollama_pick_model() or OLLAMA_MODEL
    payload = {
        "model": m, "messages": messages, "stream": False, "keep_alive": "30m",
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    if json_mode:
        payload["format"] = "json"
    with _open(f"{OLLAMA_URL}/api/chat", payload) as r:
        return json.loads(r.read())["message"]["content"]


def _ollama_stream(messages, temperature, max_tokens, model):
    m = model or _ollama_pick_model() or OLLAMA_MODEL
    payload = {
        "model": m, "messages": messages, "stream": True, "keep_alive": "30m",
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    with _open(f"{OLLAMA_URL}/api/chat", payload) as resp:
        for raw in resp:
            if raw.strip():
                yield raw if raw.endswith(b"\n") else raw + b"\n"


# ─────────────────────────────────────────────────────────────
#  디스패처 — 순서대로 시도, 실패한 공급자는 60초 건너뜀
# ─────────────────────────────────────────────────────────────
_CHAT = {"anthropic": _anthropic_chat, "groq": _groq_chat, "cerebras": _cerebras_chat,
         "gemini": _gemini_chat, "ollama": _ollama_chat}
_STREAM = {"anthropic": _anthropic_stream, "groq": _groq_stream, "cerebras": _cerebras_stream,
           "gemini": _gemini_stream, "ollama": _ollama_stream}
_bad_until: dict[str, float] = {}
_last_error: dict[str, str] = {}
_active: str | None = None

# ── 사용량 추적 (RPM 슬라이딩 윈도 + RPD 영속) ─────────────────
# 무료 티어에서는 호출 수가 곧 가용성이다. 분당은 메모리, 일일은 파일로 영속
# (재시작해도 잊지 않게). RPD는 태평양 시간 자정에 리셋되므로 날짜 키도 PT 기준.
import threading
from collections import deque as _deque

_DATA_DIR = Path(os.environ.get("MC_DATA_DIR") or (Path(__file__).parent / "data"))
_USAGE_PATH = _DATA_DIR / "usage-llm.json"
_usage_lock = threading.Lock()
_rpm_win: dict[str, _deque] = {"fast": _deque(), "main": _deque()}
_rpd_cache: dict | None = None          # {"day": "YYYY-MM-DD", "fast": n, "main": n}
_rpd_notice_until: float = 0.0          # RPD 소진 감지 → 리셋 시각(epoch)


def _pt_now():
    import datetime as dt
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo("America/Los_Angeles"))
    except Exception:  # noqa: BLE001 — tzdata 없는 환경은 PST 고정으로 근사
        return dt.datetime.now(dt.timezone(dt.timedelta(hours=-8)))


def _pt_reset_epoch() -> float:
    import datetime as dt
    now = _pt_now()
    nxt = (now + dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return nxt.timestamp()


def _rpd_load() -> dict:
    global _rpd_cache
    day = _pt_now().strftime("%Y-%m-%d")
    if _rpd_cache is None:
        try:
            _rpd_cache = json.loads(_USAGE_PATH.read_text())
        except Exception:  # noqa: BLE001
            _rpd_cache = {"day": day, "fast": 0, "main": 0}
    if _rpd_cache.get("day") != day:            # PT 자정 리셋
        _rpd_cache = {"day": day, "fast": 0, "main": 0}
    return _rpd_cache


def _usage_record(fast: bool) -> None:
    lane = "fast" if fast else "main"
    now = time.time()
    with _usage_lock:
        win = _rpm_win[lane]
        win.append(now)
        while win and now - win[0] > 60:
            win.popleft()
        d = _rpd_load()
        d[lane] = d.get(lane, 0) + 1
        try:
            _DATA_DIR.mkdir(parents=True, exist_ok=True)
            _USAGE_PATH.write_text(json.dumps(d))
        except OSError:
            pass


def usage() -> dict:
    # UI 표시·클라이언트 스로틀용. 한도(limit)는 Gemini가 쓰일 때만 의미가 있다.
    now = time.time()
    with _usage_lock:
        d = dict(_rpd_load())
        rpm = {lane: sum(1 for t in _rpm_win[lane] if now - t <= 60)
               for lane in ("fast", "main")}
    gem_first = _configured("gemini") and _usable("gemini")
    out = {"provider": provider(), "tier": GEMINI_TIER if _configured("gemini") else None,
           "fast": {"rpm_used": rpm["fast"], "rpd_used": d.get("fast", 0)},
           "main": {"rpm_used": rpm["main"], "rpd_used": d.get("main", 0)}}
    if gem_first or provider() == "gemini":
        out["fast"].update(rpm_limit=GEMINI_FAST_RPM, rpd_limit=GEMINI_FAST_RPD)
        out["main"].update(rpm_limit=GEMINI_MAIN_RPM, rpd_limit=GEMINI_MAIN_RPD)
    if _rpd_notice_until > now:
        out["rpd_exhausted_until"] = _rpd_notice_until
    out["gateway"] = gateway.state()   # 브레이커·큐·발사율 — UI 배너와 REPORT 통계용
    return out


def _handle_429(name: str, body: str, fast: bool) -> str:
    # 429 분류: RPD(일일) 소진이면 PT 자정까지 안내, 아니면 짧은 제외.
    # 반환값은 사용자에게 보여줄 사유 문자열.
    global _rpd_notice_until
    if name == "gemini" and ("PerDay" in body or "per day" in body.lower()):
        reset = _pt_reset_epoch()
        _rpd_notice_until = reset
        hours = max(1, round((reset - time.time()) / 3600))
        # 재확인은 1시간 주기 — 하루 종일 죽었다고 단정하지 않는다
        _mark_bad(name, "일일 한도(RPD) 소진", seconds=min(int(reset - time.time()), 3600))
        return f"오늘 무료 한도 소진 — 약 {hours}시간 후(태평양 자정) 리셋됩니다."
    _mark_bad(name, "HTTP 429")
    return "분당 요청 한도(429)"


import gateway


class _EmptyResp(Exception):
    """HTTP 200인데 텍스트 0자 — 실 Gemini의 안전 필터·빈 candidate에서 실제로
    난다. 모의 서버는 절대 재현하지 않아 테스트가 못 잡는 유형이라, 성공으로
    흘려보내지 않고 실패로 분류해 재시도 1회 → 항목 스킵으로 처리한다."""


def _require_text(out: str) -> str:
    if not (out or "").strip():
        raise _EmptyResp()
    return out


def _first_is_empty(first) -> bool:
    # 스트림이 토큰 없이 종료 마커만 내보낸 경우 (빈 응답의 스트림 버전)
    if first is None:
        return True
    try:
        o = json.loads(first)
        return bool(o.get("done")) and not (o.get("message") or {}).get("content")
    except (json.JSONDecodeError, AttributeError):
        return False


def _retry_after_of(e) -> str | None:
    try:
        return e.headers.get("Retry-After") if e.headers else None
    except Exception:  # noqa: BLE001
        return None


def _gw_attempts(ticket, name: str, fast: bool, fn):
    """게이트웨이 재시도 규율로 fn()을 실행한다. fn은 1회 시도(예외 전파).

    · 429: Retry-After 무조건 준수(없으면 백오프+지터), **최대 2회 재시도**,
      그 이상은 이 항목만 포기 (전체 중단 금지). RPD 소진은 재시도 없이 포기.
    · 500/502/503: 짧은 백오프 1회 재시도, 실패 시 항목 스킵 — 한도 초과로
      오인하지 않도록 공급자 제외도 5초만 (일시 오류는 금방 지나간다)
    · 재시도도 gateway.retry_wait()로 토큰을 소비한다 (재시도 폭풍 차단)
    반환: (결과, None) 또는 (None, 사유문자열)."""
    n429 = n5xx = 0
    lane = "fast" if fast else "main"
    while True:
        t0 = time.time()
        try:
            out = fn()
            gateway.record(ticket, 200, attempt=n429 + n5xx, t0=t0)
            return out, None
        except (_EmptyResp, json.JSONDecodeError, KeyError, IndexError) as e:
            # 빈 응답 + 깨진 200 본문(프록시 오류 페이지 등) 공통 규율:
            # 짧은 백오프 1회 재시도(토큰 소비), 그래도 안 되면 이 항목만 스킵
            what = ("빈 응답 — 안전 필터/빈 candidate 의심" if isinstance(e, _EmptyResp)
                    else f"응답 형식 깨짐({type(e).__name__})")
            gateway.record(ticket, 204, what, attempt=n429 + n5xx, t0=t0)
            if n5xx >= 1:
                _mark_bad(name, "빈 응답", seconds=5)
                return None, f"{name}: 빈 응답 반복 — 이 항목만 건너뜀"
            gateway.retry_wait(None, 0, base=0.3, lane=lane)
            n5xx += 1
            continue
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "ignore")[:500]
            except Exception:  # noqa: BLE001
                pass
            ra = _retry_after_of(e)
            gateway.record(ticket, e.code, body, ra, n429 + n5xx, t0)
            if e.code == 429:
                reason = _handle_429(name, body, fast)
                if "무료 한도 소진" in reason or n429 >= 2:
                    return None, f"{name}: {reason}"
                gateway.retry_wait(ra, n429, lane="fast" if fast else "main")
                n429 += 1
                continue
            if e.code in (500, 502, 503):
                if n5xx >= 1:
                    _mark_bad(name, f"HTTP {e.code}(일시 오류)", seconds=5)
                    return None, f"{name}: HTTP {e.code} 일시 오류 — 이 항목만 건너뜀"
                gateway.retry_wait(None, 0, base=0.4, lane="fast" if fast else "main")
                n5xx += 1
                continue
            if e.code in (401, 403, 404):
                _mark_bad(name, f"HTTP {e.code}")
                return None, f"{name}: HTTP {e.code}"
            raise
        except urllib.error.URLError as e:
            gateway.record(ticket, 0, str(getattr(e, "reason", e))[:200],
                           attempt=n429 + n5xx, t0=t0)
            _mark_bad(name, f"연결 실패({getattr(e, 'reason', e)})")
            return None, f"{name}: 연결 실패"




def _configured(name: str) -> bool:
    if name == "anthropic":
        return bool(ANTHROPIC_API_KEY)
    if name == "groq":
        return bool(GROQ_API_KEY)
    if name == "cerebras":
        return bool(CEREBRAS_API_KEY)
    if name == "gemini":
        return bool(GEMINI_API_KEY)
    if name == "ollama":
        return _ollama_pick_model() is not None
    return False


def _mark_bad(name: str, err: str, seconds: int = 60) -> None:
    _bad_until[name] = time.time() + seconds
    _last_error[name] = err


def _usable(name: str) -> bool:
    return _configured(name) and time.time() >= _bad_until.get(name, 0)


def _try_order() -> list[str]:
    # 이번 호출에서 시도할 공급자 순서.
    # 전부 일시 제외 상태면(키가 하나뿐인데 순단이 났던 경우) 제외를 무시하고
    # 다시 찔러본다(half-open). 60초 페널티는 다중 공급자 전환용인데, 공급자가
    # 하나면 살아난 뒤에도 최대 60초간 계속 실패하는 문제가 QA에서 실측됐다.
    # 여전히 죽어 있으면 연결 실패가 빨리 나 추가 비용은 거의 없다.
    usable = [n for n in LLM_ORDER if _usable(n)]
    return usable or [n for n in LLM_ORDER if _configured(n)]


def _no_provider_error(errs: list[str]) -> RuntimeError:
    return RuntimeError(
        "사용 가능한 LLM이 없습니다 [" + "; ".join(errs or ["설정된 공급자 없음"]) + "] — "
        "무료 키를 하나 넣으세요: Cerebras(cloud.cerebras.ai → CEREBRAS_API_KEY) 또는 "
        "Gemini(aistudio.google.com/apikey → GEMINI_API_KEY), "
        "오프라인은 ollama pull qwen3:8b")


def provider() -> str:
    if _active and _usable(_active):
        return _active
    return next((n for n in LLM_ORDER if _usable(n)),
                next((n for n in LLM_ORDER if _configured(n)), "none"))


def model_name() -> str:
    p = provider()
    return {"anthropic": ANTHROPIC_MODEL, "groq": GROQ_MODEL,
            "cerebras": CEREBRAS_MODEL, "gemini": GEMINI_MODEL,
            "ollama": _ollama_pick_model() or OLLAMA_MODEL}.get(p, "-")


def _pick_model(name: str, model: str | None, fast: bool) -> str | None:
    """fast=True면 그 공급자의 빠른 모델을 쓴다 (실시간 자막 번역·한 줄 요약용)."""
    if model:
        return model
    return FAST_MODELS.get(name) if fast else None


def _model_label(name: str, mdl: str | None) -> str:
    # 트레이스용 실제 모델명 — mdl=None(공급자 기본)일 때도 이름을 남긴다
    return mdl or {"gemini": GEMINI_MODEL, "anthropic": ANTHROPIC_MODEL,
                   "groq": GROQ_MODEL, "cerebras": CEREBRAS_MODEL,
                   "ollama": OLLAMA_MODEL}.get(name, name)


def chat_once(messages: list[dict], json_mode: bool = False, temperature: float = 0.3,
              max_tokens: int = 800, model: str | None = None, fast: bool = False,
              kind: str = "assets", bg: bool = False) -> str:
    """단발 호출 → 응답 텍스트. 전 호출이 게이트웨이(큐·토큰버킷·재시도 규율)를 지난다."""
    global _active
    errs: list[str] = []
    for name in _try_order():
        mdl = _pick_model(name, model, fast)
        ticket = gateway.acquire(kind, fast, bg, provider=name, model=_model_label(name, mdl))
        try:
            out, err = _gw_attempts(
                ticket, name, fast,
                lambda: _require_text(
                    _CHAT[name](messages, json_mode, temperature, max_tokens, mdl)))
        finally:
            gateway.release(ticket)
        if err is None:
            _active = name
            _usage_record(fast)
            return out
        errs.append(err)
    raise _no_provider_error(errs)


def stream_ndjson(messages: list[dict], temperature: float = 0.4,
                  max_tokens: int = 400, model: str | None = None,
                  fast: bool = False, kind: str = "suggest",
                  bg: bool = False) -> Iterator[bytes]:
    """토큰 스트림 (Ollama NDJSON 통일 형식). 첫 청크 전 실패 시 다음 공급자로 전환.
    스트림이 흐르는 동안 게이트웨이 in-flight 슬롯을 계속 점유한다 — 동시 상한(2)이
    '연결 수'가 아니라 '실제 진행 중인 생성 수'를 제한해야 버스트가 없다."""
    global _active
    errs: list[str] = []
    for name in _try_order():
        mdl = _pick_model(name, model, fast)
        ticket = gateway.acquire(kind, fast, bg, provider=name, model=_model_label(name, mdl))

        def attempt():
            it = _STREAM[name](messages, temperature, max_tokens, mdl)
            first = next(it, None)
            if _first_is_empty(first):
                raise _EmptyResp()
            return first, it

        try:
            res, err = _gw_attempts(ticket, name, fast, attempt)
            if err is not None:
                errs.append(err)
                continue
            first, it = res
            _active = name
            _usage_record(fast)
            if first is not None:
                yield first
            yield from it
            return
        finally:
            gateway.release(ticket)
        # (성공 스트림은 위 return으로 종료 — 여기 도달하면 실패라 다음 공급자로)
    raise _no_provider_error(errs)


def probe() -> list[dict]:
    """각 공급자에 초소형 요청을 보내 실제 사용 가능 여부를 확인 (시작 시 1회)."""
    results = []
    for name in LLM_ORDER:
        if not _configured(name):
            results.append({"name": name, "state": "미설정",
                            "detail": {"anthropic": "ANTHROPIC_API_KEY 없음", "groq": "GROQ_API_KEY 없음",
                                       "cerebras": "CEREBRAS_API_KEY 없음",
                                       "gemini": "GEMINI_API_KEY 없음",
                                       "ollama": "미실행/모델 없음"}.get(name, "")})
            continue
        try:
            _CHAT[name]([{"role": "user", "content": "Reply with OK"}], False, 0.0, 5, None)
            _bad_until.pop(name, None)
            results.append({"name": name, "state": "ok", "detail": model_name() if provider() == name else ""})
        except urllib.error.HTTPError as e:
            _mark_bad(name, f"HTTP {e.code}")
            results.append({"name": name, "state": "차단/오류", "detail": f"HTTP {e.code}"})
        except Exception as e:  # noqa: BLE001
            _mark_bad(name, str(e)[:80])
            results.append({"name": name, "state": "연결 실패", "detail": str(e)[:80]})
    return results


_probe_cache: list[dict] = []


def probe_cached(refresh: bool = False) -> list[dict]:
    global _probe_cache
    if refresh or not _probe_cache:
        _probe_cache = probe()
    return _probe_cache


# ── 🔎 로컬 임베딩 (Ollama /api/embed) — 날리지베이스 의미 검색용 ──
_embed_ok_cache: tuple[float, bool] = (0.0, False)


def embed_available() -> bool:
    """EMBED_MODEL이 Ollama에 설치돼 있는지 (60초 캐시). 없으면 키워드 검색 폴백."""
    global _embed_ok_cache
    ts, ok = _embed_ok_cache
    if time.time() - ts < 60:
        return ok
    ok = False
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=2) as r:
            names = [m["name"] for m in json.loads(r.read()).get("models", [])]
        ok = any(n.startswith(EMBED_MODEL) for n in names)
    except Exception:  # noqa: BLE001
        ok = False
    _embed_ok_cache = (time.time(), ok)
    return ok


def embed(texts: list[str]) -> list[list[float]] | None:
    """텍스트들 → 임베딩 벡터 (로컬 bge-m3, 한·영 교차). 불가하면 None."""
    if not texts or not embed_available():
        return None
    try:
        with _open(f"{OLLAMA_URL}/api/embed",
                   {"model": EMBED_MODEL, "input": texts}, timeout=60) as r:
            vecs = json.loads(r.read()).get("embeddings")
        return vecs if vecs and len(vecs) == len(texts) else None
    except Exception:  # noqa: BLE001
        return None


def transcribe(audio: bytes, filename: str = "audio.webm",
               language: str | None = None, model: str | None = None) -> str:
    """오디오 바이트 → 텍스트 (Groq Whisper). STT는 Groq 전용 — 키 없으면 에러.
    language=None이면 Whisper가 언어를 자동 감지한다 (한국어/영어 혼용 면접 대응)."""
    if not GROQ_API_KEY:
        raise RuntimeError(
            "음성 인식 수단이 없습니다 — 무료·무제한 로컬 STT는 pip3 install faster-whisper, "
            "또는 GROQ_API_KEY를 넣으면 Groq Whisper를 씁니다.")

    boundary = uuid.uuid4().hex
    parts: list[bytes] = []

    def field(name: str, value: str) -> None:
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        )

    field("model", model or GROQ_STT_MODEL)
    if language:
        field("language", language)
    field("response_format", "json")
    field("temperature", "0")
    content_type = {
        ".wav": "audio/wav", ".mp4": "audio/mp4", ".m4a": "audio/mp4", ".mp3": "audio/mpeg",
    }.get(Path(filename).suffix, "audio/webm")
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n".encode() + audio + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{GROQ_URL}/audio/transcriptions", data=b"".join(parts),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                 "Authorization": f"Bearer {GROQ_API_KEY}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read()).get("text", "").strip()


# ── 🆓 로컬 Whisper (faster-whisper) — 무료·무제한·비공개 ───────
_local_lock = threading.Lock()


def _get_local_model():
    """faster-whisper 모델을 lazy-load. 미설치/실패 시 None (→ Groq 폴백).

    잠금 필수: 로드는 수 초~수십 초(첫 실행은 모델 다운로드)라, /health 폴링이
    겹치면 잠금 없이는 같은 로드가 여러 번 동시에 돈다 — 콜드 스타트 18초의
    원인으로 실측돼 고쳤다(한 번만 시도, 나머지는 결과를 기다림)."""
    global _local_model, _local_failed
    if _local_model is not None or _local_failed or not STT_LOCAL:
        return _local_model
    with _local_lock:
        if _local_model is not None or _local_failed:
            return _local_model
        return _load_local_model()


def _load_local_model():
    global _local_model, _local_failed
    try:
        from faster_whisper import WhisperModel
        _local_model = WhisperModel(STT_LOCAL_MODEL, device="cpu", compute_type="int8")
        print(f"  🆓 로컬 STT 활성 — faster-whisper ({STT_LOCAL_MODEL}), 무료·무제한")
    except Exception as e:  # noqa: BLE001 (미설치 포함)
        _local_failed = True
        print(f"  ℹ️  로컬 STT 미사용 (faster-whisper 미설치 → Groq 사용): {e}")
    return _local_model


_local_kicked = False


def stt_local_available() -> bool:
    """비차단 — /health가 이걸 부르는데, 모델 로드는 수 초~수십 초(첫 실행은
    다운로드)다. 기다리지 않고 백그라운드 로드를 1회만 시작하고 현재 상태를
    답한다 (콜드 스타트 14.7초 → 2초대, 실측). 실제 STT 사용(transcribe_local)은
    여전히 로드를 기다린다."""
    global _local_kicked
    if _local_model is not None:
        return True
    if _local_failed or not STT_LOCAL:
        return False
    if not _local_kicked:
        _local_kicked = True
        threading.Thread(target=_get_local_model, daemon=True).start()
    return False


def transcribe_local(audio: bytes, filename: str = "audio.webm",
                     language: str | None = None) -> str:
    """오디오 바이트 → 텍스트 (로컬 faster-whisper). 클라우드 전송 없음."""
    import tempfile
    model = _get_local_model()
    if model is None:
        raise RuntimeError("로컬 Whisper를 사용할 수 없습니다.")
    suffix = Path(filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio)
        tmp = f.name
    try:
        segments, _ = model.transcribe(tmp, language=language, beam_size=1, vad_filter=True)
        return " ".join(s.text for s in segments).strip()
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
