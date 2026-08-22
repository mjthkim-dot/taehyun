"""
단일 요청 게이트웨이 — 모든 실 LLM API 호출이 이 관문 하나를 지난다.

유료 티어에서도 장애가 났다: 원인 후보가 (버스트 RPM 초과 / 지출 한도 /
재시도 폭풍 / 공급자측 5xx 오인) 넷이라, 이 모듈은 두 가지를 동시에 한다.

 1. **계측이 먼저다** — 모든 시도(재시도 포함)를 logs/api-trace.jsonl에 기록:
    시각·호출 유형·모델·직전 60초 발사 수·동시 진행 수·상태·오류 원문·
    Retry-After·재시도 차수·지연. incident.sh가 이 파일로 장애 구간을 진단한다.
 2. **버스트 자체를 없앤다** —
    · 동시 실행 상한 2 (in-flight, 스트림은 끝날 때까지 슬롯 점유)
    · 토큰 버킷: 분당 발사 수를 GW_RPM(무료 8 / 유료 60 기본) 이하로 평활화,
      버킷 용량 2라 순간 버스트도 2를 넘지 못한다
    · 우선순위 큐: 클릭 제안(0) > 번역·최종 요약(1) > 자산화·투기 제안(2)
      > 한줄 요약(3). 한줄 요약은 5초 이상 밀리면 드롭 — 지연된 요약은 가치가 없다
    · 서킷 브레이커: 연속 429 3회 → 30초 신규 발사 차단(큐는 유지),
      /api/usage의 breaker_until로 UI 배너가 카운트다운을 띄운다
    · **재시도도 토큰을 소비한다** (retry_wait) — 재시도 폭풍의 구조적 차단

 환경: GW_RPM(분당 발사 상한, 기본 free 8/paid 60) · GW_CONC(동시 2) ·
       GW_BURST(버킷 용량 2) · GW_DROP_S(한줄 요약 드롭 대기 5초) · GW_OFF=1(비활성)
"""
from __future__ import annotations

import heapq
import itertools
import json
import os
import random
import threading
import time
from collections import deque
from pathlib import Path

_TIER = os.environ.get("GEMINI_TIER", "free")
GW_RPM = int(os.environ.get("GW_RPM", "60" if _TIER == "paid" else "8"))
GW_CONC = int(os.environ.get("GW_CONC", "2"))
GW_BURST = float(os.environ.get("GW_BURST", "2"))
GW_DROP_S = float(os.environ.get("GW_DROP_S", "5"))
GW_BG_DROP_S = float(os.environ.get("GW_BG_DROP_S", "15"))
GW_OFF = os.environ.get("GW_OFF") == "1"
BREAKER_AFTER = 3          # 연속 429 이 횟수 → 브레이커
BREAKER_S = 30.0

_LOG_DIR = Path(os.environ.get("MC_DATA_DIR") or (Path(__file__).parent.parent)) / "logs"
TRACE_PATH = _LOG_DIR / "api-trace.jsonl"

# 우선순위 — 숫자가 작을수록 먼저. 클릭 제안이 최우선(사람이 기다리며 보고 있다).
_PRIO = {"suggest": 0, "translate": 1, "summary_final": 1, "assets": 2,
         "suggest_bg": 2, "summary": 3}
# 밀리면 버리는 유형 → 최대 대기 초. 지연된 한줄 요약은 무가치하고, 낡은 투기
# 제안은 클라이언트가 이미 abort한 뒤라 발사해봐야 토큰만 태운다 (내성 시뮬 실측:
# 폭주 구간에 투기 제안이 큐에서 250초 살아남아 번역까지 밀어냈다).
_DROP_AFTER = {"summary": GW_DROP_S, "suggest_bg": GW_BG_DROP_S,
               "suggest": 60.0}   # 클릭도 60초 넘으면 좀비(사용자는 이미 다음 클릭) — 회수만


class Dropped(Exception):
    """큐 대기 초과로 이 항목만 조용히 버림 — 전체 중단이 아니다."""


_cv = threading.Condition()
_seq = itertools.count()
_waiting: list[tuple[int, int]] = []       # (priority, seq) 힙
_inflight = 0
_tokens = GW_BURST
_last_refill = time.time()
_breaker_until = 0.0
_consec_429 = 0
_sent = deque()                            # 발사 시각 (직전 60초 집계용)
_stats = {"dispatched": 0, "retries": 0, "dropped": 0, "breaker_trips": 0,
          "by_kind": {}, "err_429": 0, "err_5xx": 0}
_trace_lock = threading.Lock()


class Ticket:
    __slots__ = ("kind", "fast", "provider", "model", "t_queued", "t_started", "waited_ms")

    def __init__(self, kind, fast, provider, model, t_queued, t_started):
        self.kind, self.fast = kind, fast
        self.provider, self.model = provider, model
        self.t_queued, self.t_started = t_queued, t_started
        self.waited_ms = round((t_started - t_queued) * 1000)


def _refill(now: float) -> None:
    global _tokens, _last_refill
    _tokens = min(GW_BURST, _tokens + (now - _last_refill) * GW_RPM / 60.0)
    _last_refill = now


def _fire(now: float) -> None:
    global _tokens
    _tokens -= 1
    _sent.append(now)
    while _sent and now - _sent[0] > 60:
        _sent.popleft()


def rpm60(now: float | None = None) -> int:
    now = now or time.time()
    return sum(1 for t in _sent if now - t <= 60)


def acquire(kind: str, fast: bool = False, bg: bool = False,
            provider: str = "", model: str = "") -> Ticket:
    """발사 허가를 기다린다. 한줄 요약이 GW_DROP_S 이상 밀리면 Dropped."""
    global _inflight
    t_q = time.time()
    if GW_OFF:
        return Ticket(kind, fast, provider, model, t_q, t_q)
    k = "suggest_bg" if (kind == "suggest" and bg) else kind
    ent = (_PRIO.get(k, 2), next(_seq))
    deadline = t_q + _DROP_AFTER[k] if k in _DROP_AFTER else None
    with _cv:
        heapq.heappush(_waiting, ent)
        while True:
            now = time.time()
            _refill(now)
            if (_waiting and _waiting[0] == ent and _inflight < GW_CONC
                    and _tokens >= 1 and now >= _breaker_until):
                heapq.heappop(_waiting)
                _inflight += 1
                _fire(now)
                _stats["dispatched"] += 1
                _stats["by_kind"][k] = _stats["by_kind"].get(k, 0) + 1
                _cv.notify_all()
                return Ticket(k, fast, provider, model, t_q, now)
            if deadline and now > deadline:
                _waiting.remove(ent)
                heapq.heapify(_waiting)
                _stats["dropped"] += 1
                _cv.notify_all()
                raise Dropped(k)
            _cv.wait(timeout=0.1)


def retry_wait(retry_after: str | float | None, attempt: int, base: float = 1.0) -> None:
    """재시도 전 대기 — Retry-After가 있으면 무조건 그 값, 없으면 지수 백오프+지터.
    대기 후 **토큰을 새로 소비**해야 발사할 수 있다 (재시도 폭풍의 구조적 차단)."""
    try:
        delay = float(retry_after) if retry_after is not None else None
    except (TypeError, ValueError):
        delay = None
    if delay is None:
        delay = min(base * (2 ** attempt), 4.0) + random.random() * 0.5
    time.sleep(min(delay, 30.0))
    if GW_OFF:
        return
    with _cv:
        _stats["retries"] += 1
        while True:
            now = time.time()
            _refill(now)
            if _tokens >= 1 and now >= _breaker_until:
                _fire(now)
                _cv.notify_all()
                return
            _cv.wait(timeout=0.1)


def release(ticket: Ticket | None) -> None:
    global _inflight
    if ticket is None or GW_OFF:
        return
    with _cv:
        _inflight = max(0, _inflight - 1)
        _cv.notify_all()


def record(ticket: Ticket, status: int, err: str = "",
           retry_after: str | None = None, attempt: int = 0,
           t0: float | None = None) -> None:
    """시도 1회(재시도 포함)마다 호출 — 트레이스 기록 + 서킷 브레이커 판정."""
    global _consec_429, _breaker_until
    now = time.time()
    if status == 429:
        with _cv:
            _stats["err_429"] += 1
            _consec_429 += 1
            if _consec_429 >= BREAKER_AFTER and now >= _breaker_until:
                _breaker_until = now + BREAKER_S
                _stats["breaker_trips"] += 1
                _consec_429 = 0
    elif 500 <= status < 600:
        with _cv:
            _stats["err_5xx"] += 1
    elif status == 200:
        with _cv:
            _consec_429 = 0
    rec = {
        "ts": round(now, 3),
        "t": time.strftime("%H:%M:%S", time.localtime(now)),
        "kind": ticket.kind, "model": ticket.model or ticket.provider,
        "rpm60": rpm60(now), "inflight": _inflight,
        "status": status, "err": err[:300] if err else "",
        "retry_after": retry_after, "attempt": attempt,
        "queued_ms": ticket.waited_ms,
        "latency_ms": round((now - t0) * 1000) if t0 else None,
    }
    try:
        _LOG_DIR.mkdir(parents=True, exist_ok=True)
        with _trace_lock, TRACE_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except OSError:
        pass


def state() -> dict:
    now = time.time()
    with _cv:
        return {"rpm_budget": GW_RPM, "rpm60": rpm60(now),
                "inflight": _inflight, "queue": len(_waiting),
                "breaker_until": _breaker_until if _breaker_until > now else 0,
                **{k: _stats[k] for k in
                   ("dispatched", "retries", "dropped", "breaker_trips",
                    "err_429", "err_5xx")}}


def stats() -> dict:
    with _cv:
        return {**_stats, "by_kind": dict(_stats["by_kind"])}
