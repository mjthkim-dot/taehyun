"""
═══════════════════════════════════════════════════════════════
 RAG 레이어 — SQLite 벡터 스토어 + 하이브리드 검색

 설계 근거는 docs/ARCHITECTURE.md 4장. 요약하면:
  · 저장은 표준 라이브러리 sqlite3만 쓴다 (설치 불필요, 파일 1개, 백업 쉬움)
  · 임베딩은 로컬 Ollama bge-m3 우선(왕복 0), 없으면 Gemini(설치 불필요).
    질의 임베딩은 실측 0.43~0.68초라 매 검색에 쓰지 않는다 — BM25(1ms)로 먼저
    찾고, 비었을 때만 의미검색 2차 패스를 돌린다(prompts.build_suggest)
  · 개인용 규모(수천~수만 청크)에서 ANN은 불필요하므로 브루트포스 코사인
  · 임베딩이 없어도 키워드(BM25) 단독으로 쓸 만해야 한다 ← 설계 원칙

 검색: 키워드 순위 + 벡터 순위를 RRF로 융합한 뒤 소스 다양성을 보정한다.

 다중 사용자(웹): 사용자 1명 = Store 인스턴스 1개 = SQLite 파일 1개.
 컬럼에 user_id를 넣는 대신 파일을 나눈 이유 —
  · 격리가 물리적이다 (쿼리 하나 잘못 써도 남의 데이터가 섞일 수 없다)
  · 검색 직렬화 락이 사용자별로 쪼개져 서로의 지연에 영향을 주지 않는다
  · 백업·탈퇴 시 삭제가 파일 단위로 끝난다
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

# 런타임 데이터 위치 — 기본은 저장소 안(backend/data)이지만, 배포에서는
# MC_DATA_DIR로 밖(예: /var/lib/meeting-copilot)에 둘 수 있다.
# 시드 파일(domain-corpus.json 등)은 코드 자산이라 항상 저장소 안에서 읽는다.
import os as _os
DATA_DIR = Path(_os.environ.get("MC_DATA_DIR") or (Path(__file__).parent / "data"))
DB_PATH = DATA_DIR / "store.db"                         # 단일 사용자(로컬) 기본 경로

# 소스 종류 (docs/ARCHITECTURE.md 5장)
SOURCES = {
    "note": "Notion 수업 노트",
    "transcript": "미팅 트랜스크립트",
    "glossary": "도메인 용어집",
}

# ── 토크나이저 (스토어와 무관한 순수 함수) ─────────────────────
# 영어는 소문자 단어, 한국어는 어절 + 2-gram(조사·어미 변화를 흡수하기 위해).
_WORD = re.compile(r"[a-zA-Z][a-zA-Z0-9'-]*|[가-힣]+|[0-9]+(?:\.[0-9]+)?%?")
_STOP = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
    "to", "of", "in", "on", "for", "with", "that", "this", "it", "as", "at", "by",
    "we", "you", "i", "they", "he", "she", "our", "your", "so", "do", "does", "did",
    "me", "my", "us", "them", "him", "her", "his", "its", "mine", "yours",
    # 의문사 — 의도를 나르지 않으면서 문서 절반과 겹쳐 매칭 폭 판정을 오염시킨다
    "what", "when", "where", "which", "who", "whom", "whose", "how", "why",
    "have", "has", "had", "will", "would", "can", "could", "should", "about",
    "그리고", "그런데", "하지만", "이다", "있다", "없다", "합니다", "입니다", "해서", "하는",
}


# 어미·조사에서 나오는 2-gram은 의미가 없는데 문서 절반에 나타나 순위를 오염시킨다.
# 실측: "감사하다고 말하고 싶어요"의 '어요' 조각이 "잘 지냈어요"가 든 인사 노트와
# 매칭돼, 정작 감사 표현 노트를 top-3 밖으로 밀어냈다 (rag-eval 회귀로 발견).
_GRAM_STOP = {
    "어요", "아요", "여요", "에요", "예요", "해요", "게요", "네요", "세요", "지요", "고요",
    "니다", "합니", "습니", "됩니", "입니", "니까",
    "하다", "하고", "하는", "하면", "해서", "하지", "했다", "한다", "다고", "라고", "다는",
    "이다", "있다", "없다", "된다", "지만",
    "어서", "아서", "었어", "았어", "겠어", "싶어", "싶다",
    "에서", "에게", "으로", "까지", "부터", "처럼", "보다", "밖에",
}


def tokenize(text: str) -> list[str]:
    out: list[str] = []
    for w in _WORD.findall(text.lower()):
        if w in _STOP or len(w) < 2:
            continue
        out.append(w)
        # 한국어는 형태 변화가 심해 어절 그대로는 잘 안 맞는다 → 2-gram을 함께 넣는다
        if len(w) >= 3 and "가" <= w[0] <= "힣":
            out.extend(g for i in range(len(w) - 1)
                       if (g := w[i:i + 2]) not in _GRAM_STOP)
    return out


def _pack(v: list[float]) -> bytes:
    return struct.pack(f"{len(v)}f", *v)


def _unpack(b: bytes) -> list[float]:
    return list(struct.unpack(f"{len(b) // 4}f", b))


class Store:
    """사용자 1명의 색인 전체 — 청크·역색인·벡터·복습 카드가 한 파일에 산다."""

    def __init__(self, db_path: Path | str):
        self.db_path = Path(db_path)
        self._lock = threading.Lock()          # 쓰기 직렬화
        # 검색은 한 번에 하나만 돌린다. 검색의 본체는 CPU 바운드 파이썬 루프라
        # 병렬로 돌리면 GIL 콘보이가 생겨 오히려 전부 느려진다 — QA 실측:
        # 1,700청크에서 단독 14ms인 검색이 동시 4건이면 1,268ms, 8건이면 3,327ms.
        # 직렬화하면 같은 부하에서 p50 12.6ms. 락이 사용자별이라 남에게 안 번진다.
        self._search_lock = threading.Lock()
        self._vec_cache: dict | None = None

    # ── 스키마 ────────────────────────────────────────────────
    def connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(self.db_path, timeout=10)
        con.execute("PRAGMA journal_mode=WAL")   # 읽기 중 쓰기 허용 (미팅 중 적재)
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
          CREATE TABLE IF NOT EXISTS cards(
            id INTEGER PRIMARY KEY, en TEXT NOT NULL, ko TEXT, note TEXT,
            meeting TEXT, created_at INTEGER, stage INTEGER DEFAULT 0,
            due_at INTEGER, reviews INTEGER DEFAULT 0, lapses INTEGER DEFAULT 0,
            uid TEXT UNIQUE);
          CREATE INDEX IF NOT EXISTS ix_cards_due ON cards(due_at);
        """)
        return con

    # ── 적재 ──────────────────────────────────────────────────
    def add_chunks(self, items: list[dict], embed: bool = True) -> dict:
        """items: [{source, title, text, meta?, uid?}] → 저장 + 색인.
        uid가 같으면 갱신한다(같은 노트를 다시 넣어도 중복되지 않게)."""
        if not items:
            return {"added": 0, "embedded": 0}
        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        added, ids, texts = 0, [], []
        with self._lock, self.connect() as con:
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
        embedded = self._embed_chunks(ids, texts) if (embed and ids) else 0
        self._invalidate()
        return {"added": added, "embedded": embedded}

    def _embed_chunks(self, ids: list[int], texts: list[str], batch: int = 16) -> int:
        """임베딩은 실패해도 적재를 되돌리지 않는다 — 키워드 검색만으로도 동작해야 하므로."""
        if not llm.embed_available():
            return 0
        done = 0
        for i in range(0, len(ids), batch):
            vs = llm.embed(texts[i:i + batch])
            if not vs:
                break
            with self._lock, self.connect() as con:
                con.executemany(
                    "INSERT INTO vecs(chunk_id,dim,vec,model) VALUES(?,?,?,?) "
                    "ON CONFLICT(chunk_id) DO UPDATE SET dim=excluded.dim, vec=excluded.vec",
                    [(cid, len(v), _pack(v), llm.EMBED_MODEL)
                     for cid, v in zip(ids[i:i + batch], vs)])
            done += len(vs)
        return done

    def reembed_missing(self, limit: int = 500) -> int:
        """나중에 Ollama를 설치했을 때 비어 있는 벡터를 채운다."""
        with self.connect() as con:
            rows = con.execute(
                "SELECT c.id, c.title, c.text FROM chunks c "
                "LEFT JOIN vecs v ON v.chunk_id=c.id WHERE v.chunk_id IS NULL LIMIT ?",
                (limit,)).fetchall()
        if not rows:
            return 0
        n = self._embed_chunks([r[0] for r in rows], [f"{r[1]}\n{r[2]}"[:2000] for r in rows])
        self._invalidate()
        return n

    def _invalidate(self) -> None:
        self._vec_cache = None

    # ── 검색 ──────────────────────────────────────────────────
    def _bm25(self, query: str, k: int,
              k1: float = 1.2, b: float = 0.75) -> list[tuple[int, float, int]]:
        """역색인 덕에 질의어를 포함한 청크만 점수 계산한다 (전체 스캔 없음).

        반환: (chunk_id, 점수, 매칭된 서로 다른 '어절' 질의어 수).
        세 번째 값은 관련성 컷용이다 — 시드 밖 질문이 흔한 단어 하나로
        무관 시드를 끌어오는 것을 생성 단계에서 걸러낸다 (한국어 2-gram은
        보조 신호라 세지 않는다)."""
        qt = tokenize(query)
        if not qt:
            return []
        # 어절 단위 질의어만 (2-gram 제외) — 매칭 폭 판정용
        qwords = {t for t in dict.fromkeys(qt)
                  if not ("가" <= t[0] <= "힣" and len(t) == 2)}
        with self.connect() as con:
            N, avgdl = con.execute(
                "SELECT COUNT(*), COALESCE(AVG(n_tokens),1) FROM chunks").fetchone()
            if not N:
                return []
            scores: dict[int, float] = {}
            nmatch: dict[int, int] = {}
            for term in dict.fromkeys(qt):
                # 문서 길이(n_tokens)를 JOIN으로 함께 가져온다. 청크마다 점 조회를
                # 하면(N+1) 흔한 단어에서 검색 1회에 소형 쿼리 수천 번이 나가는데,
                # QA에서 이게 동시 접속 시 지연 폭증의 한 축으로 실측됐다.
                rows = con.execute(
                    "SELECT p.chunk_id, p.tf, c.n_tokens FROM postings p "
                    "JOIN chunks c ON c.id = p.chunk_id WHERE p.term=?",
                    (term,)).fetchall()
                df = len(rows)
                if not df or df > N * 0.9:          # 너무 흔한 말은 변별력이 없다
                    continue
                idf = math.log(1 + (N - df + 0.5) / (df + 0.5))
                for cid, tf, dl in rows:
                    dl = dl or 1
                    scores[cid] = scores.get(cid, 0.0) + idf * (tf * (k1 + 1)) / (
                        tf + k1 * (1 - b + b * dl / avgdl))
                    if term in qwords:
                        nmatch[cid] = nmatch.get(cid, 0) + 1
        ranked = sorted(scores.items(), key=lambda t: -t[1])[:k]
        return [(cid, sc, nmatch.get(cid, 0)) for cid, sc in ranked]

    def _load_vecs(self) -> dict:
        if self._vec_cache is not None:
            return self._vec_cache
        with self.connect() as con:
            rows = con.execute("SELECT chunk_id, vec FROM vecs").fetchall()
        self._vec_cache = {"ids": [r[0] for r in rows],
                           "vecs": [_unpack(r[1]) for r in rows]}
        return self._vec_cache

    def _vector(self, q: list[float], k: int) -> list[tuple[int, float]]:
        # q: 미리 계산한 질의 임베딩. 임베딩(네트워크 호출)은 락 밖에서 하고
        # 여기서는 CPU 바운드 코사인 계산만 한다.
        cache = self._load_vecs()
        if not cache["ids"]:
            return []
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

    def search(self, query: str, k: int = 6, per_source: int = 3,
               sources: list[str] | None = None,
               semantic: bool | None = None) -> list[dict]:
        """하이브리드 검색 — 키워드 순위와 벡터 순위를 RRF로 융합.

        RRF를 쓰는 이유: BM25 점수와 코사인 유사도는 스케일이 달라 가중합을 쓰면
        튜닝이 필요하지만, 순위만 쓰는 RRF는 스케일에서 자유롭다.
        per_source: 한 소스가 결과를 독점하지 못하게 막는다(용어집만 6개 나오면 문맥이 빈다).

        semantic: 질의를 임베딩할지. None이면 **공짜일 때만**(로컬 모델) 한다.
          Gemini 임베딩은 질의당 실측 0.43~0.68초라 매 질문에 얹으면 답변이
          그만큼 늦어진다. 그래서 기본은 BM25(1ms)로 가고, 호출부가 '적중이
          약하다'고 판단했을 때만 semantic=True로 두 번째 패스를 돌린다.
        """
        if not query.strip():
            return []
        pool = max(k * 4, 20)
        use_vec = semantic if semantic is not None else llm._ollama_embed_available()
        # 질의 임베딩은 네트워크 호출이라 락 밖에서 — 락은 CPU 구간만 지킨다
        qv = (llm.embed([query]) or [None])[0] if use_vec else None
        with self._search_lock:
            kw = self._bm25(query, pool)
            vec = self._vector(qv, pool) if qv else []

        RRF_K = 60
        fused: dict[int, float] = {}
        match_terms = {cid: n for cid, _, n in kw}
        for rank, (cid, _, _n) in enumerate(kw):
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
        for rank, (cid, _) in enumerate(vec):
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
        if not fused:
            return []

        order = sorted(fused.items(), key=lambda t: -t[1])
        ids = [c for c, _ in order]
        ph = ",".join("?" * len(ids))
        with self.connect() as con:
            rows = {r[0]: r for r in con.execute(
                f"SELECT id,source,title,text,meta FROM chunks WHERE id IN ({ph})", ids)}

        kwr = {c: i for i, (c, _, _n) in enumerate(kw)}
        vcr = {c: i for i, (c, _) in enumerate(vec)}
        # 코사인 유사도 원값 — 벡터 검색은 아무리 멀어도 최근접 k개를 돌려주므로,
        # '의미로 걸렸다'만으로는 관련성 판정이 안 된다. 호출부가 하한을 건다.
        vsim = {c: sim for c, sim in vec}
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
                # 관련성 신호: 매칭된 어절 질의어 수. 의미(벡터) 히트는 키워드가
                # 없어도 정당하므로 컷 판정에서 via를 함께 본다
                "match_terms": match_terms.get(cid, 0),
                "sim": round(vsim.get(cid, 0.0), 4),
                "via": ("키워드+의미" if cid in kwr and cid in vcr
                        else "의미" if cid in vcr else "키워드"),
            })
            if len(picked) >= k:
                break
        return picked

    # ── 상태·정리 ─────────────────────────────────────────────
    def stats(self) -> dict:
        with self.connect() as con:
            by = dict(con.execute(
                "SELECT source, COUNT(*) FROM chunks GROUP BY source").fetchall())
            total = con.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
            vecn = con.execute("SELECT COUNT(*) FROM vecs").fetchone()[0]
        return {
            "total": total, "by_source": by, "embedded": vecn,
            "embed_ready": llm.embed_available(), "embed_model": llm.EMBED_MODEL,
            "mode": "하이브리드(키워드+의미)" if vecn and llm.embed_available() else "키워드 전용",
            "db": str(self.db_path),
        }

    def clear(self, source: str | None = None) -> int:
        with self._lock, self.connect() as con:
            if source:
                ids = [r[0] for r in con.execute(
                    "SELECT id FROM chunks WHERE source=?", (source,))]
                if ids:
                    ph = ",".join("?" * len(ids))
                    con.execute(f"DELETE FROM postings WHERE chunk_id IN ({ph})", ids)
                    con.execute(f"DELETE FROM vecs WHERE chunk_id IN ({ph})", ids)
                    con.execute(f"DELETE FROM chunks WHERE id IN ({ph})", ids)
                n = len(ids)
            else:
                n = con.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
                con.executescript(
                    "DELETE FROM postings; DELETE FROM vecs; DELETE FROM chunks;")
        self._invalidate()
        return n

    def backup(self, dest: Path | str) -> Path:
        """일관된 스냅샷 백업 (WAL 중이어도 안전한 sqlite backup API)."""
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as src, sqlite3.connect(dest) as out:
            src.backup(out)
        return dest


# ── 단일 사용자(로컬) 호환 계층 ────────────────────────────────
# 인증을 켜지 않은 로컬 모드와 기존 스크립트·테스트는 이 기본 스토어를 쓴다.
_default = Store(DB_PATH)


def default_store() -> Store:
    return _default


def connect():
    return _default.connect()


def add_chunks(items: list[dict], embed: bool = True) -> dict:
    return _default.add_chunks(items, embed)


def reembed_missing(limit: int = 500) -> int:
    return _default.reembed_missing(limit)


def search(query: str, k: int = 6, per_source: int = 3,
           sources: list[str] | None = None,
           semantic: bool | None = None) -> list[dict]:
    return _default.search(query, k, per_source, sources, semantic)


def stats() -> dict:
    return _default.stats()


def clear(source: str | None = None) -> int:
    return _default.clear(source)


def _invalidate() -> None:
    _default._invalidate()
