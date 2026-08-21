"""
═══════════════════════════════════════════════════════════════
 RAG 레이어 — SQLite 벡터 스토어 + 하이브리드 검색

 설계 근거는 docs/ARCHITECTURE.md 4장. 요약하면:
  · 저장은 표준 라이브러리 sqlite3만 쓴다 (설치 불필요, 파일 1개, 백업 쉬움)
  · 임베딩은 로컬 Ollama bge-m3 — $0이고 한국어 노트 ↔ 영어 발언이 교차 검색된다
  · 개인용 규모(수천~수만 청크)에서 ANN은 불필요하므로 브루트포스 코사인
  · 임베딩이 없어도 키워드(BM25) 단독으로 쓸 만해야 한다 ← 설계 원칙

 검색: 키워드 순위 + 벡터 순위를 RRF로 융합한 뒤 소스 다양성을 보정한다.
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import math
import re
import sqlite3
import struct
import threading
import time
from pathlib import Path

import llm

DB_PATH = Path(__file__).parent / "data" / "store.db"

# 소스 종류 (docs/ARCHITECTURE.md 5장)
SOURCES = {
    "note": "Notion 수업 노트",
    "transcript": "미팅 트랜스크립트",
    "glossary": "도메인 용어집",
}

_lock = threading.Lock()
_vec_cache: dict | None = None       # {"ids": [...], "vecs": [[float]], "stamp": float}

# ── 토크나이저 ────────────────────────────────────────────────
# 영어는 소문자 단어, 한국어는 어절 + 2-gram(조사·어미 변화를 흡수하기 위해).
_WORD = re.compile(r"[a-zA-Z][a-zA-Z0-9'-]*|[가-힣]+|[0-9]+(?:\.[0-9]+)?%?")
_STOP = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
    "to", "of", "in", "on", "for", "with", "that", "this", "it", "as", "at", "by",
    "we", "you", "i", "they", "he", "she", "our", "your", "so", "do", "does", "did",
    "have", "has", "had", "will", "would", "can", "could", "should", "about",
    "그리고", "그런데", "하지만", "이다", "있다", "없다", "합니다", "입니다", "해서", "하는",
}


def tokenize(text: str) -> list[str]:
    out: list[str] = []
    for w in _WORD.findall(text.lower()):
        if w in _STOP or len(w) < 2:
            continue
        out.append(w)
        # 한국어는 형태 변화가 심해 어절 그대로는 잘 안 맞는다 → 2-gram을 함께 넣는다
        if len(w) >= 3 and "가" <= w[0] <= "힣":
            out.extend(w[i:i + 2] for i in range(len(w) - 1))
    return out


# ── 스키마 ────────────────────────────────────────────────────
def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.execute("PRAGMA journal_mode=WAL")       # 읽기 중 쓰기 허용 (미팅 중 적재)
    con.executescript("""
      CREATE TABLE IF NOT EXISTS chunks(
        id INTEGER PRIMARY KEY, source TEXT NOT NULL, title TEXT, text TEXT NOT NULL,
        meta TEXT, n_tokens INTEGER, created_at TEXT, uid TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS postings(
        term TEXT NOT NULL, chunk_id INTEGER NOT NULL, tf INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS ix_post_term ON postings(term);
      CREATE INDEX IF NOT EXISTS ix_post_chunk ON postings(chunk_id);
      CREATE TABLE IF NOT EXISTS vecs(
        chunk_id INTEGER PRIMARY KEY, dim INTEGER, vec BLOB, model TEXT);
      CREATE INDEX IF NOT EXISTS ix_chunk_source ON chunks(source);
    """)
    return con


def _pack(v: list[float]) -> bytes:
    return struct.pack(f"{len(v)}f", *v)


def _unpack(b: bytes) -> list[float]:
    return list(struct.unpack(f"{len(b) // 4}f", b))


# ── 적재 ──────────────────────────────────────────────────────
def add_chunks(items: list[dict], embed: bool = True) -> dict:
    """items: [{source, title, text, meta?, uid?}] → 저장 + 색인.
    uid가 같으면 갱신한다(같은 노트를 다시 넣어도 중복되지 않게)."""
    if not items:
        return {"added": 0, "embedded": 0}
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    added, ids, texts = 0, [], []
    with _lock, connect() as con:
        for it in items:
            text = (it.get("text") or "").strip()
            if len(text) < 8:
                continue
            src = it.get("source", "note")
            uid = it.get("uid") or f"{src}:{abs(hash(text)) & 0xffffffff:x}"
            toks = tokenize(f"{it.get('title','')} {text}")
            cur = con.execute(
                "INSERT INTO chunks(source,title,text,meta,n_tokens,created_at,uid) "
                "VALUES(?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET "
                "text=excluded.text, title=excluded.title, meta=excluded.meta, "
                "n_tokens=excluded.n_tokens RETURNING id",
                (src, it.get("title", ""), text, json.dumps(it.get("meta") or {},
                 ensure_ascii=False), len(toks), now, uid))
            cid = cur.fetchone()[0]
            con.execute("DELETE FROM postings WHERE chunk_id=?", (cid,))
            tf: dict[str, int] = {}
            for t in toks:
                tf[t] = tf.get(t, 0) + 1
            con.executemany("INSERT INTO postings(term,chunk_id,tf) VALUES(?,?,?)",
                            [(t, cid, n) for t, n in tf.items()])
            added += 1
            ids.append(cid)
            texts.append(f"{it.get('title','')}\n{text}"[:2000])
    embedded = _embed_chunks(ids, texts) if (embed and ids) else 0
    _invalidate()
    return {"added": added, "embedded": embedded}


def _embed_chunks(ids: list[int], texts: list[str], batch: int = 16) -> int:
    """임베딩은 실패해도 적재를 되돌리지 않는다 — 키워드 검색만으로도 동작해야 하므로."""
    if not llm.embed_available():
        return 0
    done = 0
    for i in range(0, len(ids), batch):
        vs = llm.embed(texts[i:i + batch])
        if not vs:
            break
        with _lock, connect() as con:
            con.executemany(
                "INSERT INTO vecs(chunk_id,dim,vec,model) VALUES(?,?,?,?) "
                "ON CONFLICT(chunk_id) DO UPDATE SET dim=excluded.dim, vec=excluded.vec",
                [(cid, len(v), _pack(v), llm.EMBED_MODEL)
                 for cid, v in zip(ids[i:i + batch], vs)])
        done += len(vs)
    return done


def reembed_missing(limit: int = 500) -> int:
    """나중에 Ollama를 설치했을 때 비어 있는 벡터를 채운다."""
    with connect() as con:
        rows = con.execute(
            "SELECT c.id, c.title, c.text FROM chunks c "
            "LEFT JOIN vecs v ON v.chunk_id=c.id WHERE v.chunk_id IS NULL LIMIT ?",
            (limit,)).fetchall()
    if not rows:
        return 0
    n = _embed_chunks([r[0] for r in rows], [f"{r[1]}\n{r[2]}"[:2000] for r in rows])
    _invalidate()
    return n


def _invalidate() -> None:
    global _vec_cache
    _vec_cache = None


# ── 검색 ──────────────────────────────────────────────────────
def _bm25(query: str, k: int, k1: float = 1.2, b: float = 0.75) -> list[tuple[int, float]]:
    """역색인 덕에 질의어를 포함한 청크만 점수 계산한다 (전체 스캔 없음)."""
    qt = tokenize(query)
    if not qt:
        return []
    with connect() as con:
        N, avgdl = con.execute(
            "SELECT COUNT(*), COALESCE(AVG(n_tokens),1) FROM chunks").fetchone()
        if not N:
            return []
        lens = {}
        scores: dict[int, float] = {}
        seen = set()
        for term in qt:
            if term in seen:
                continue
            seen.add(term)
            rows = con.execute(
                "SELECT chunk_id, tf FROM postings WHERE term=?", (term,)).fetchall()
            df = len(rows)
            if not df or df > N * 0.9:          # 너무 흔한 말은 변별력이 없다
                continue
            idf = math.log(1 + (N - df + 0.5) / (df + 0.5))
            for cid, tf in rows:
                if cid not in lens:
                    r = con.execute("SELECT n_tokens FROM chunks WHERE id=?", (cid,)).fetchone()
                    lens[cid] = (r[0] or 1) if r else 1
                dl = lens[cid]
                scores[cid] = scores.get(cid, 0.0) + idf * (tf * (k1 + 1)) / (
                    tf + k1 * (1 - b + b * dl / avgdl))
    return sorted(scores.items(), key=lambda t: -t[1])[:k]


def _load_vecs() -> dict:
    global _vec_cache
    if _vec_cache is not None:
        return _vec_cache
    with connect() as con:
        rows = con.execute("SELECT chunk_id, vec FROM vecs").fetchall()
    _vec_cache = {"ids": [r[0] for r in rows], "vecs": [_unpack(r[1]) for r in rows]}
    return _vec_cache


def _vector(query: str, k: int) -> list[tuple[int, float]]:
    cache = _load_vecs()
    if not cache["ids"]:
        return []
    qv = llm.embed([query])
    if not qv:
        return []
    q = qv[0]
    qn = math.sqrt(sum(x * x for x in q)) or 1.0
    out = []
    for cid, v in zip(cache["ids"], cache["vecs"]):
        if len(v) != len(q):
            continue
        dot = sum(a * bb for a, bb in zip(q, v))
        vn = math.sqrt(sum(x * x for x in v)) or 1.0
        out.append((cid, dot / (qn * vn)))
    out.sort(key=lambda t: -t[1])
    return out[:k]


def search(query: str, k: int = 6, per_source: int = 3,
           sources: list[str] | None = None) -> list[dict]:
    """하이브리드 검색 — 키워드 순위와 벡터 순위를 RRF로 융합.

    RRF를 쓰는 이유: BM25 점수와 코사인 유사도는 스케일이 달라 가중합을 쓰면
    튜닝이 필요하지만, 순위만 쓰는 RRF는 스케일에서 자유롭다.
    per_source: 한 소스가 결과를 독점하지 못하게 막는다(용어집만 6개 나오면 문맥이 빈다).
    """
    if not query.strip():
        return []
    pool = max(k * 4, 20)
    kw = _bm25(query, pool)
    vec = _vector(query, pool) if llm.embed_available() else []

    RRF_K = 60
    fused: dict[int, float] = {}
    for rank, (cid, _) in enumerate(kw):
        fused[cid] = fused.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
    for rank, (cid, _) in enumerate(vec):
        fused[cid] = fused.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
    if not fused:
        return []

    order = sorted(fused.items(), key=lambda t: -t[1])
    ids = [c for c, _ in order]
    ph = ",".join("?" * len(ids))
    with connect() as con:
        rows = {r[0]: r for r in con.execute(
            f"SELECT id,source,title,text,meta FROM chunks WHERE id IN ({ph})", ids)}

    kwr = {c: i for i, (c, _) in enumerate(kw)}
    vcr = {c: i for i, (c, _) in enumerate(vec)}
    picked: list[dict] = []
    per: dict[str, int] = {}
    for cid, score in order:
        r = rows.get(cid)
        if not r:
            continue
        src = r[1]
        if sources and src not in sources:
            continue
        if per.get(src, 0) >= per_source:
            continue
        per[src] = per.get(src, 0) + 1
        picked.append({
            "id": cid, "source": src, "source_label": SOURCES.get(src, src),
            "title": r[2] or "", "text": r[3],
            "meta": json.loads(r[4] or "{}"),
            "score": round(score, 5),
            "via": ("키워드+의미" if cid in kwr and cid in vcr
                    else "의미" if cid in vcr else "키워드"),
        })
        if len(picked) >= k:
            break
    return picked


def stats() -> dict:
    with connect() as con:
        by = dict(con.execute("SELECT source, COUNT(*) FROM chunks GROUP BY source").fetchall())
        total = con.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        vecn = con.execute("SELECT COUNT(*) FROM vecs").fetchone()[0]
    return {
        "total": total, "by_source": by, "embedded": vecn,
        "embed_ready": llm.embed_available(), "embed_model": llm.EMBED_MODEL,
        "mode": "하이브리드(키워드+의미)" if vecn and llm.embed_available() else "키워드 전용",
        "db": str(DB_PATH),
    }


def clear(source: str | None = None) -> int:
    with _lock, connect() as con:
        if source:
            ids = [r[0] for r in con.execute("SELECT id FROM chunks WHERE source=?", (source,))]
            if ids:
                ph = ",".join("?" * len(ids))
                con.execute(f"DELETE FROM postings WHERE chunk_id IN ({ph})", ids)
                con.execute(f"DELETE FROM vecs WHERE chunk_id IN ({ph})", ids)
                con.execute(f"DELETE FROM chunks WHERE id IN ({ph})", ids)
            n = len(ids)
        else:
            n = con.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
            con.executescript("DELETE FROM postings; DELETE FROM vecs; DELETE FROM chunks;")
    _invalidate()
    return n
