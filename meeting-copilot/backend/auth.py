"""
인증 · 세션 · 사용자별 쿼터 (표준 라이브러리만)

웹에 여는 순간 지켜야 하는 세 가지를 이 모듈이 담당한다:
 1. 신원 — 접속 코드(scrypt 해시)로 로그인, HMAC 서명 세션 쿠키
 2. 격리 — 사용자마다 data/u/<uid>/store.db (물리적 분리, rag.Store 참조)
 3. 비용 — 사용자별 LLM 분당/일일 호출 상한 (서버 키가 곧 내 지갑이므로)

동작 모드
 · 사용자가 한 명도 없으면: 인증 비활성(로컬 개인 모드). 단, 이 상태로
   0.0.0.0 등 외부 인터페이스에 바인딩하면 서버가 기동을 거부한다 — 실수로
   무인증 공개가 되지 않게(fail-safe).
 · 사용자가 있으면: 모든 /api/* 가 세션을 요구한다. 사용자 추가는
   `python3 manage.py adduser <이름>` (웹에서 가입받지 않는다 — 초대제).

세션 토큰: v1.<uid>.<만료epoch>.<HMAC-SHA256 hex>
 서버 상태를 저장하지 않아 재시작해도 로그인이 유지되고, 서명 비밀은
 data/secret.key(0600, 자동 생성)에만 있다.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import threading
import time
from collections import deque
from pathlib import Path

import os as _os
DATA_DIR = Path(_os.environ.get("MC_DATA_DIR") or (Path(__file__).parent / "data"))
AUTH_DB = DATA_DIR / "auth.db"
SECRET_PATH = DATA_DIR / "secret.key"
USERS_DIR = DATA_DIR / "u"

SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "30"))
COOKIE_NAME = "mc_session"

# 사용자별 LLM 호출 상한 — 실측 기준 미팅 1개 ≈ 3.8콜/분이라
# 기본 15 RPM은 정상 사용의 4배 여유, 600/일은 미팅 2~3시간 분량이다.
LLM_RPM_PER_USER = int(os.environ.get("LLM_RPM_PER_USER", "15"))
LLM_DAILY_PER_USER = int(os.environ.get("LLM_DAILY_PER_USER", "600"))

_lock = threading.Lock()
_secret_cache: bytes | None = None


# ── 저장소 ────────────────────────────────────────────────────
def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(AUTH_DB, timeout=10)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript("""
      CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL,
        code_hash BLOB NOT NULL, salt BLOB NOT NULL,
        admin INTEGER DEFAULT 0, disabled INTEGER DEFAULT 0,
        created_at TEXT);
      CREATE TABLE IF NOT EXISTS usage(
        uid INTEGER NOT NULL, day TEXT NOT NULL, calls INTEGER DEFAULT 0,
        PRIMARY KEY (uid, day));
    """)
    return con


def secret() -> bytes:
    """세션 서명 비밀 — 없으면 생성해 0600으로 저장한다."""
    global _secret_cache
    if _secret_cache:
        return _secret_cache
    with _lock:
        if SECRET_PATH.exists():
            _secret_cache = SECRET_PATH.read_bytes()
        else:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            _secret_cache = secrets.token_bytes(32)
            SECRET_PATH.write_bytes(_secret_cache)
            os.chmod(SECRET_PATH, 0o600)
    return _secret_cache


# ── 사용자 관리 (manage.py가 호출) ─────────────────────────────
def _hash_code(code: str, salt: bytes) -> bytes:
    # scrypt: GPU 무차별 대입에 비싸다. n=2^14는 로그인 1회 ~50ms — 체감 없음.
    return hashlib.scrypt(code.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)


def add_user(name: str, code: str, admin: bool = False) -> dict:
    name = name.strip()
    if not name or len(name) > 40:
        raise ValueError("이름은 1~40자여야 합니다.")
    if len(code) < 8:
        raise ValueError("접속 코드는 8자 이상이어야 합니다 (외부에서 로그인하는 비밀번호입니다).")
    salt = secrets.token_bytes(16)
    with _connect() as con:
        try:
            cur = con.execute(
                "INSERT INTO users(name, code_hash, salt, admin, created_at) "
                "VALUES(?,?,?,?,datetime('now')) RETURNING id",
                (name, _hash_code(code, salt), salt, int(admin)))
            uid = cur.fetchone()[0]
        except sqlite3.IntegrityError:
            raise ValueError(f"이미 있는 이름입니다: {name}") from None
    return {"id": uid, "name": name, "admin": admin}


def set_code(name: str, code: str) -> None:
    if len(code) < 8:
        raise ValueError("접속 코드는 8자 이상이어야 합니다.")
    salt = secrets.token_bytes(16)
    with _connect() as con:
        n = con.execute("UPDATE users SET code_hash=?, salt=? WHERE name=?",
                        (_hash_code(code, salt), salt, name)).rowcount
    if not n:
        raise ValueError(f"사용자를 찾을 수 없습니다: {name}")


def set_disabled(name: str, disabled: bool) -> None:
    with _connect() as con:
        n = con.execute("UPDATE users SET disabled=? WHERE name=?",
                        (int(disabled), name)).rowcount
    if not n:
        raise ValueError(f"사용자를 찾을 수 없습니다: {name}")


def delete_user(name: str) -> int | None:
    with _connect() as con:
        row = con.execute("SELECT id FROM users WHERE name=?", (name,)).fetchone()
        if not row:
            return None
        con.execute("DELETE FROM users WHERE id=?", (row[0],))
        con.execute("DELETE FROM usage WHERE uid=?", (row[0],))
    return row[0]


def list_users() -> list[dict]:
    with _connect() as con:
        rows = con.execute(
            "SELECT id, name, admin, disabled, created_at FROM users ORDER BY id").fetchall()
    return [{"id": r[0], "name": r[1], "admin": bool(r[2]),
             "disabled": bool(r[3]), "created_at": r[4]} for r in rows]


def enabled() -> bool:
    """사용자가 1명이라도 있으면 인증을 강제한다."""
    if not AUTH_DB.exists():
        return False
    with _connect() as con:
        return con.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0


def user_data_dir(uid: int) -> Path:
    d = USERS_DIR / str(uid)
    d.mkdir(parents=True, exist_ok=True)
    return d


# ── 로그인 (락아웃 포함) ───────────────────────────────────────
# 앞 프로젝트 QA에서 무제한 무차별 대입이 초당 122회 나왔다 → 5회 무료,
# 이후 2^n초 지수 대기(최대 300초). 키는 클라이언트 IP.
_fails: dict[str, tuple[int, float]] = {}     # ip -> (연속 실패 수, 다음 허용 시각)


def _lockout_left(ip: str) -> int:
    n, until = _fails.get(ip, (0, 0.0))
    return max(0, int(until - time.time()))


def _record_fail(ip: str) -> None:
    n, _ = _fails.get(ip, (0, 0.0))
    n += 1
    wait = 0 if n <= 5 else min(2 ** (n - 5), 300)
    _fails[ip] = (n, time.time() + wait)
    if len(_fails) > 10000:                    # 메모리 방어
        _fails.clear()


def login(name: str, code: str, ip: str = "-") -> dict:
    """성공 시 {token, user}. 실패는 ValueError(사유 포함)."""
    left = _lockout_left(ip)
    if left:
        raise ValueError(f"시도가 너무 많습니다 — {left}초 후 다시 시도하세요.")
    with _connect() as con:
        row = con.execute(
            "SELECT id, code_hash, salt, admin, disabled FROM users WHERE name=?",
            (name.strip(),)).fetchone()
    # 사용자가 없어도 해시를 한 번 계산한다 — 응답 시간으로 계정 존재가 새지 않게
    salt = row[2] if row else b"x" * 16
    calc = _hash_code(code, salt)
    ok = bool(row) and hmac.compare_digest(calc, row[1]) and not row[4]
    if not ok:
        _record_fail(ip)
        raise ValueError("이름 또는 접속 코드가 맞지 않습니다.")
    _fails.pop(ip, None)
    exp = int(time.time()) + SESSION_DAYS * 86400
    payload = f"v1.{row[0]}.{exp}"
    sig = hmac.new(secret(), payload.encode(), hashlib.sha256).hexdigest()
    return {"token": f"{payload}.{sig}",
            "user": {"id": row[0], "name": name.strip(), "admin": bool(row[3])}}


def verify(token: str | None) -> dict | None:
    """세션 토큰 → {id, name, admin} 또는 None."""
    if not token:
        return None
    parts = token.split(".")
    if len(parts) != 4 or parts[0] != "v1":
        return None
    payload = ".".join(parts[:3])
    want = hmac.new(secret(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(want, parts[3]):
        return None
    try:
        uid, exp = int(parts[1]), int(parts[2])
    except ValueError:
        return None
    if time.time() > exp:
        return None
    with _connect() as con:
        row = con.execute(
            "SELECT name, admin, disabled FROM users WHERE id=?", (uid,)).fetchone()
    if not row or row[2]:
        return None
    return {"id": uid, "name": row[0], "admin": bool(row[1])}


# ── 사용자별 LLM 쿼터 ─────────────────────────────────────────
# 분당은 메모리 슬라이딩 윈도, 일일은 auth.db에 영속(재시작해도 리셋되지 않게).
_rpm_win: dict[int, deque] = {}
_daily_cache: dict[tuple[int, str], int] = {}


def check_llm_quota(uid: int) -> str | None:
    """호출 가능하면 None, 초과면 사용자에게 보여줄 사유 문자열."""
    now = time.time()
    with _lock:
        win = _rpm_win.setdefault(uid, deque())
        while win and now - win[0] > 60:
            win.popleft()
        if len(win) >= LLM_RPM_PER_USER:
            return (f"요청이 너무 잦습니다 — 분당 {LLM_RPM_PER_USER}회 상한. "
                    f"{int(61 - (now - win[0]))}초 후 다시 시도하세요.")
        day = time.strftime("%Y-%m-%d")
        used = _daily_used(uid, day)
        if used >= LLM_DAILY_PER_USER:
            return (f"오늘의 사용량({LLM_DAILY_PER_USER}회)을 다 썼습니다 — "
                    "내일 초기화됩니다.")
        win.append(now)
        _daily_cache[(uid, day)] = used + 1
    # DB 기록은 락 밖에서 (짧은 쓰기지만 핫패스 지연을 만들지 않게)
    with _connect() as con:
        con.execute(
            "INSERT INTO usage(uid, day, calls) VALUES(?,?,1) "
            "ON CONFLICT(uid, day) DO UPDATE SET calls = calls + 1", (uid, day))
    return None


def _daily_used(uid: int, day: str) -> int:
    key = (uid, day)
    if key in _daily_cache:
        return _daily_cache[key]
    with _connect() as con:
        row = con.execute("SELECT calls FROM usage WHERE uid=? AND day=?",
                          (uid, day)).fetchone()
    _daily_cache[key] = row[0] if row else 0
    if len(_daily_cache) > 5000:
        _daily_cache.clear()
        _daily_cache[key] = row[0] if row else 0
    return _daily_cache[key]


def quota_status(uid: int) -> dict:
    day = time.strftime("%Y-%m-%d")
    win = _rpm_win.get(uid) or ()
    now = time.time()
    return {"rpm_used": sum(1 for t in win if now - t <= 60),
            "rpm_limit": LLM_RPM_PER_USER,
            "daily_used": _daily_used(uid, day),
            "daily_limit": LLM_DAILY_PER_USER}


def usage_today() -> list[dict]:
    """관리자 통계용 — 오늘 사용자별 호출 수."""
    day = time.strftime("%Y-%m-%d")
    with _connect() as con:
        rows = con.execute(
            "SELECT u.name, s.calls FROM usage s JOIN users u ON u.id=s.uid "
            "WHERE s.day=? ORDER BY s.calls DESC", (day,)).fetchall()
    return [{"name": r[0], "calls": r[1]} for r in rows]
