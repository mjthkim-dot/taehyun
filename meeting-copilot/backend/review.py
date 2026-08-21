"""
미팅 종료 → 복습 자산화 (P1)

미팅이 끝난 직후가 학습 효율이 가장 높다. 그 순간의 트랜스크립트에서
 · 다음에 쓸 만한 표현 10개
 · 내가 못 알아들었을 법한 구간 (빠른 말·관용구·숫자·낯선 용어)
 · 상대에게 물어봤어야 할 질문
을 뽑아 카드로 만들고, 1일/3일/7일 간격으로 다시 띄운다.

원칙 두 가지
 · Notion 쓰기는 기본 OFF다. 사용자가 확인 버튼을 누른 요청(confirm=true)만
   실제로 페이지에 쓴다 — 학습 기록은 사용자의 공간이지 앱의 공간이 아니다.
 · SRS 일정은 자동으로 배경에서 돌지 않는다. 앱을 열었을 때 '오늘 볼 카드'를
   계산해 보여줄 뿐이다.
"""
from __future__ import annotations

import json
import re
import time

import llm
import rag

# 간격 반복 — 1일 / 3일 / 7일 뒤. 세 번 통과하면 졸업.
INTERVALS_DAYS = [1, 3, 7]
DAY = 86400


def _connect():
    con = rag.connect()
    con.executescript("""
      CREATE TABLE IF NOT EXISTS cards(
        id INTEGER PRIMARY KEY, en TEXT NOT NULL, ko TEXT, note TEXT,
        meeting TEXT, created_at INTEGER, stage INTEGER DEFAULT 0,
        due_at INTEGER, reviews INTEGER DEFAULT 0, lapses INTEGER DEFAULT 0,
        uid TEXT UNIQUE);
      CREATE INDEX IF NOT EXISTS ix_cards_due ON cards(due_at);
    """)
    return con


# ── 1. 추출 ───────────────────────────────────────────────────
_PROMPT = """Below is the transcript of an English business meeting (cloud sales).
The user is a Korean professional who was speaking English in this meeting.

Transcript:
\"\"\"{tr}\"\"\"

Produce review material for them. Reply with ONLY a JSON object:

{{
  "expressions": [
    {{"en": "<a useful English phrase FROM or FOR this meeting, max 12 words>",
      "ko": "<한국어 뜻>",
      "why": "<언제 쓰는지 한국어 한 줄>"}}
  ],
  "missed": [
    {{"quote": "<the exact line from the transcript they likely did not catch>",
      "ko": "<한국어 뜻>",
      "why": "<왜 어려웠는지 한국어 한 줄 — 빠른 축약/관용구/숫자/전문용어 등>"}}
  ],
  "questions": ["<다음 미팅에서 물어볼 질문 (English), max 15 words>"]
}}

Rules:
- expressions: EXACTLY 10 items when the transcript allows it, otherwise as many
  as the material honestly supports. Prefer phrases the other side used well and
  phrases the user struggled to produce.
- missed: 2~5 items. Quote the transcript verbatim. If nothing was hard, return [].
- questions: 3~5 items, concrete and answerable, tied to open points in this meeting.
- Never invent content that is not grounded in the transcript."""


def build(lines: list[str], meeting: str = "미팅") -> dict:
    """트랜스크립트 → 복습 자산. LLM이 JSON을 깨뜨려도 앱이 죽지 않게 방어한다."""
    tr = "\n".join(l for l in lines if str(l).strip())[-8000:]
    if len(tr) < 40:
        return {"expressions": [], "missed": [], "questions": [],
                "error": "트랜스크립트가 너무 짧습니다."}
    raw = llm.chat_once([{"role": "user", "content": _PROMPT.format(tr=tr)}],
                        json_mode=True, temperature=0.3, max_tokens=1800)
    data = _parse(raw)
    exps = [e for e in data.get("expressions", []) if (e.get("en") or "").strip()][:10]
    return {"meeting": meeting,
            "expressions": exps,
            "missed": [m for m in data.get("missed", []) if (m.get("quote") or "").strip()][:5],
            "questions": [q for q in data.get("questions", []) if str(q).strip()][:5]}


def _parse(raw: str) -> dict:
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        m = re.search(r"\{.*\}", raw or "", re.S)
        if not m:
            return {}
        try:
            return json.loads(m.group(0))
        except Exception:  # noqa: BLE001
            return {}


# ── 2. SRS ────────────────────────────────────────────────────
def add_cards(expressions: list[dict], meeting: str = "미팅") -> dict:
    """복습 카드를 저장한다. 첫 복습은 내일(1일 뒤).
    같은 표현을 다시 넣어도 uid로 합쳐지고, 진행 중인 일정은 건드리지 않는다."""
    now = int(time.time())
    added = 0
    with _connect() as con:
        for e in expressions:
            en = (e.get("en") or "").strip()
            if len(en) < 3:
                continue
            uid = "card:" + re.sub(r"[^a-z0-9]+", "", en.lower())[:60]
            cur = con.execute(
                "INSERT INTO cards(en,ko,note,meeting,created_at,stage,due_at,uid) "
                "VALUES(?,?,?,?,?,0,?,?) ON CONFLICT(uid) DO UPDATE SET "
                "ko=excluded.ko, note=excluded.note RETURNING id",
                (en, (e.get("ko") or "").strip(), (e.get("why") or "").strip(),
                 meeting, now, now + INTERVALS_DAYS[0] * DAY, uid))
            cur.fetchone()
            added += 1
    return {"added": added, **counts()}


def due_cards(limit: int = 20, include_future: bool = False) -> list[dict]:
    now = int(time.time())
    sql = ("SELECT id,en,ko,note,meeting,stage,due_at,reviews FROM cards "
           + ("" if include_future else "WHERE due_at<=? AND stage<? ")
           + "ORDER BY due_at ASC LIMIT ?")
    args = (limit,) if include_future else (now, len(INTERVALS_DAYS), limit)
    with _connect() as con:
        rows = con.execute(sql, args).fetchall()
    return [{"id": r[0], "en": r[1], "ko": r[2], "note": r[3], "meeting": r[4],
             "stage": r[5], "due_at": r[6], "reviews": r[7]} for r in rows]


def grade(card_id: int, ok: bool) -> dict:
    """맞히면 다음 간격으로, 틀리면 1일 뒤로 되돌린다."""
    now = int(time.time())
    with _connect() as con:
        row = con.execute("SELECT stage FROM cards WHERE id=?", (card_id,)).fetchone()
        if not row:
            return {"error": "카드를 찾을 수 없습니다."}
        stage = row[0] + 1 if ok else 0
        idx = min(stage, len(INTERVALS_DAYS) - 1)
        con.execute(
            "UPDATE cards SET stage=?, due_at=?, reviews=reviews+1, lapses=lapses+? "
            "WHERE id=?",
            (stage, now + INTERVALS_DAYS[idx] * DAY, 0 if ok else 1, card_id))
    return {"id": card_id, "stage": stage, **counts()}


def counts() -> dict:
    now = int(time.time())
    with _connect() as con:
        total = con.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
        due = con.execute("SELECT COUNT(*) FROM cards WHERE due_at<=? AND stage<?",
                          (now, len(INTERVALS_DAYS))).fetchone()[0]
        done = con.execute("SELECT COUNT(*) FROM cards WHERE stage>=?",
                           (len(INTERVALS_DAYS),)).fetchone()[0]
    return {"total": total, "due": due, "graduated": done}


# ── 3. 사람이 읽는 형태 ────────────────────────────────────────
def to_markdown(rev: dict) -> str:
    """Notion 저장·복사용. 사용자가 확인을 눌렀을 때만 쓰인다."""
    when = time.strftime("%Y-%m-%d %H:%M")
    out = [f"# 📚 {rev.get('meeting', '미팅')} 복습 ({when})", "", "## 🗣 이번 미팅 표현"]
    for e in rev.get("expressions", []):
        out.append(f"- **{e.get('en','')}** — {e.get('ko','')}"
                   + (f"  _{e.get('why','')}_" if e.get("why") else ""))
    if rev.get("missed"):
        out += ["", "## 🔍 놓쳤을 구간"]
        for m in rev["missed"]:
            out.append(f"- \"{m.get('quote','')}\" — {m.get('ko','')}"
                       + (f"  _{m.get('why','')}_" if m.get("why") else ""))
    if rev.get("questions"):
        out += ["", "## ❓ 다음에 물어볼 질문"]
        out += [f"- {q}" for q in rev["questions"]]
    return "\n".join(out)
