"""
데이터 소스 3종 → RAG 청크 (docs/ARCHITECTURE.md 5장)

  note       Notion 수업 노트 — 마크다운/텍스트를 블록 단위로 쪼갠다
  transcript 미팅 트랜스크립트 — 발화를 주제 묶음으로 쪼갠다
  glossary   도메인 용어집 — 용어 1개 = 1청크

공통 원칙: 청크에 **영문 키워드를 함께 심는다.**
한국어 노트를 영어 발언으로 검색해야 하는데, 임베딩이 없는 환경에서는
키워드가 유일한 다리이기 때문이다. (앞 프로젝트에서 이게 없어 검색이
전부 첫 문서로 떨어지는 결함을 겪었다 — ARCHITECTURE.md 4.2 참조)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import llm
import rag

# 도메인 용어집 시드 — 클라우드/AWS 세일즈 표현 70개(domain-corpus.json).
# glossary_seed.json은 초기 20개 버전으로, 파일이 없는 환경을 위한 폴백으로만 둔다.
_DATA = Path(__file__).parent / "data"
SEED = _DATA / "domain-corpus.json"
SEED_FALLBACK = _DATA / "glossary_seed.json"


def _clean(t: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", t.replace("\r\n", "\n")).strip()


# ── 1. Notion 수업 노트 ────────────────────────────────────────
def notes_from_markdown(text: str, title_hint: str = "수업 노트") -> list[dict]:
    """`#` 헤딩을 경계로 자르고, 헤딩이 없으면 빈 줄 문단으로 자른다."""
    text = _clean(text)
    blocks: list[tuple[str, str]] = []
    if re.search(r"^#{1,6}\s", text, re.M):
        parts = re.split(r"^(#{1,6}\s+.*)$", text, flags=re.M)
        cur = title_hint
        buf: list[str] = []
        for p in parts:
            if re.match(r"^#{1,6}\s", p or ""):
                if buf and "".join(buf).strip():
                    blocks.append((cur, "".join(buf).strip()))
                cur, buf = p.lstrip("# ").strip(), []
            else:
                buf.append(p or "")
        if buf and "".join(buf).strip():
            blocks.append((cur, "".join(buf).strip()))
    else:
        for i, para in enumerate([p for p in text.split("\n\n") if len(p.strip()) > 20], 1):
            blocks.append((f"{title_hint} {i}", para.strip()))
    return [{"source": "note", "title": t, "text": _with_keywords(b),
             "uid": f"note:{t}:{abs(hash(b)) & 0xffff:x}"}
            for t, b in blocks if len(b) > 20]


# 노트에서 자주 나오는 상황을 영어 검색어로 잇는 다리
_BRIDGE = {
    "가격|비싸|할인|단가|견적": "price expensive quote discount cost objection budget",
    "일정|날짜|조율|미팅 잡": "schedule date meeting time availability follow-up reschedule",
    "인사|스몰토크|시작": "greeting small talk kick off get started agenda opening",
    "반대|반박|이견|다르게": "disagree differently push back objection alternative view",
    "이해|못 알아|다시|되묻": "repeat clarify didn't catch pardon walk me through again",
    "거절|사양|어렵": "decline say no turn down politely refuse",
    "요청|부탁": "request ask for favor need",
    "설명|소개|제안": "explain introduce propose present pitch",
    "마무리|정리|후속": "wrap up summarize next steps follow-up action items close",
    "보안|규제|인증|컴플라": "security compliance regulation certification audit risk",
    "계약|협상|조건": "contract negotiation terms commitment agreement",
    "발음|억양|교정": "pronunciation accent correction fluency",
}


# 반대 방향 다리 — 영어만 있는 줄에 한국어 검색어를 심는다.
# 수업 노트에는 "I am looking forward to ..." 처럼 한국어가 한 글자도 없는 줄이 많은데,
# 하단 퀵 번역은 사용자가 **한국어로** 친다. 임베딩이 없는 환경에서는 이 줄이
# 한국어 질의와 한 토큰도 겹치지 않아 영영 검색되지 않는다.
_BRIDGE_EN = {
    r"look(ing)? forward|can't wait": "기대 기대된다 기대돼요 고대 설렌다 다음이 기대",
    r"\bgrateful|thank(s| you)|appreciate": "감사 고맙다 감사합니다 고마워요 사의",
    r"\bsorry|apolog": "사과 미안 죄송 유감",
    r"can i get|i'?ll (have|take)|order|please\b.*(hot|iced|medium)": "주문 카페 커피 시키다 주문하기",
    r"how have you been|it'?s been a while|nice to (meet|see)": "인사 안부 오랜만 스몰토크 잘 지냈어요",
    r"\bprice|quote|discount|cost|budget|expensive": "가격 비싸다 견적 할인 단가 예산 비용",
    r"schedul|reschedul|availab|next week|deadline|timeline": "일정 날짜 조율 마감 스케줄 시간",
    r"\bagree|makes sense|fair point": "동의 맞아요 공감 인정",
    r"disagree|push back|however|that said|i'?m not sure": "반박 이견 반대 다르게 생각",
    r"could you|would you mind|can you (share|explain|walk)": "요청 부탁 물어보기 질문 되묻기",
    r"next steps|follow up|recap|wrap up|action item": "마무리 정리 후속 다음 단계 액션",
    r"\bcompliance|security|audit|certif": "보안 규제 인증 컴플라이언스 감사",
    r"contract|terms|commitment|sign off": "계약 조건 협상 약정 승인",
    r"pronunciation|accent|intonation|syllab": "발음 억양 교정 소리",
    r"tense|verb|preposition|article|grammar|-ing\b": "문법 시제 동사 전치사 관사 어미",
    r"i'?m going to|gonna|will\b": "미래 예정 계획 하려고",
    r"\bdid\b|\bwas\b|\bwere\b|yesterday|last (night|week)": "과거 시제 지난 어제",
}


def _with_keywords(text: str) -> str:
    """본문에서 상황을 감지해 반대 언어의 검색어를 덧붙인다 (검색 전용 꼬리표).

    한국어 노트 → 영문 키워드, 영어 노트 → 한국어 키워드. 양방향 모두 필요하다:
    미팅 중에는 영어 발화로 검색하고, 퀵 번역에서는 한국어로 검색하기 때문이다."""
    hits: list[str] = []
    for pat, kws in _BRIDGE.items():
        if re.search(pat, text):
            hits.append(kws)
    low = text.lower()
    for pat, kws in _BRIDGE_EN.items():
        if re.search(pat, low):
            hits.append(kws)
    return text + ("\n\n[검색어] " + " ".join(hits) if hits else "")


# ── 2. 미팅 트랜스크립트 ───────────────────────────────────────
def chunks_from_transcript(lines: list[dict], meeting: str,
                           group: int = 6) -> list[dict]:
    """lines: [{who, text}] → 발화 group개씩 묶어 하나의 문맥으로."""
    out = []
    buf: list[str] = []
    for i, ln in enumerate(lines):
        who = ln.get("who") or "?"
        txt = (ln.get("text") or "").strip()
        if not txt:
            continue
        buf.append(f"{who}: {txt}")
        if len(buf) >= group:
            out.append("\n".join(buf))
            buf = buf[-2:]           # 문맥이 끊기지 않게 2줄 겹침
    if len(buf) >= 2:
        out.append("\n".join(buf))
    return [{"source": "transcript", "title": f"{meeting} #{i + 1}",
             "text": _with_keywords(t), "meta": {"meeting": meeting},
             "uid": f"tr:{meeting}:{i}"}
            for i, t in enumerate(out)]


# ── 3. 도메인 용어집 ──────────────────────────────────────────
def chunks_from_glossary(entries: list[dict]) -> list[dict]:
    out = []
    for e in entries:
        term = (e.get("term") or "").strip()
        if not term:
            continue
        body = (f"{term} — {e.get('ko','')}\n{e.get('note','')}\n"
                f"실제 문장: {e.get('say','')}")
        # 고객이 실제로 하는 말(triggers)을 함께 심는다 — 이게 없으면 "quote is higher"
        # 같은 발언이 'total cost of ownership' 용어와 한 단어도 겹치지 않아 검색이 실패한다
        trig = (e.get("triggers") or "").strip()
        if trig:
            body += f"\n[검색어] {trig}"
        out.append({"source": "glossary", "title": term,
                    "text": _with_keywords(body.strip()),
                    "meta": {"ko": e.get("ko", "")}, "uid": f"gl:{term}"})
    return out


def load_seed_glossary() -> list[dict]:
    path = SEED if SEED.exists() else SEED_FALLBACK
    if not path.exists():
        return []
    return chunks_from_glossary(json.loads(path.read_text(encoding="utf-8")))


def ensure_seeded(store: rag.Store | None = None) -> dict:
    """시드 용어집 중 아직 색인에 없는 것만 넣는다.

    "비어 있을 때만"으로 하면 시드가 20개→70개로 늘어도 기존 사용자는 영영
    20개에 머문다. uid(`gl:{term}`)가 유일키라 이미 있는 항목을 다시 넣어도
    중복되지 않지만, 매 기동마다 70개를 재임베딩하는 건 낭비라 차집합만 넣는다."""
    store = store or rag.default_store()
    items = load_seed_glossary()
    if not items:
        return {"seeded": 0, **store.stats()}
    with store.connect() as con:
        have = {r[0] for r in con.execute(
            "SELECT uid FROM chunks WHERE source='glossary'")}
    todo = [c for c in items if c["uid"] not in have]
    # embed=False: 기동 시에는 네트워크를 타지 않는다. 임베딩 채우기는 사용자가
    # '동기화'를 눌렀을 때만 — "자동 백그라운드 색인 금지" 원칙(docs/PLAN.md A16).
    # 임베딩이 없어도 키워드 경로로 검색은 동작한다(설계 원칙).
    r = store.add_chunks(todo, embed=False) if todo else {"added": 0}
    return {"seeded": r.get("added", 0), **store.stats()}


# ── 4. 용어집 자동 성장 (P1) ─────────────────────────────────
# 미팅에서 반복해서 나오는 도메인 표현을 후보로 뽑는다.
# 자동 승격하지 않는다 — 잘못된 용어가 들어가면 제안 문장이 통째로 틀어지므로
# 사용자가 승인한 것만 용어집이 된다.
# 용어의 양 끝에 올 수 없는 기능어 — "the data", "along with" 같은 쓰레기를 걸러낸다
_EDGE_STOP = {
    "the", "a", "an", "of", "in", "on", "to", "for", "with", "and", "or", "but",
    "is", "are", "was", "were", "be", "been", "will", "would", "can", "could",
    "we", "you", "i", "they", "it", "he", "she", "our", "your", "their", "my",
    "this", "that", "these", "those", "there", "here", "also", "along", "yes",
    "no", "so", "just", "very", "about", "from", "at", "by", "as", "than", "then",
    "do", "does", "did", "have", "has", "had", "get", "got", "make", "made",
    "let", "like", "want", "need", "think", "know", "see", "say", "said", "go",
    "up", "out", "off", "over", "into", "when", "what", "how", "why", "who",
}
# 동사가 끼면 명사구가 아니다 → 용어 후보에서 제외
_VERBS = {
    "handle", "handles", "handled", "review", "reviews", "reviewed", "send",
    "sends", "sent", "lower", "lowers", "lowered", "align", "aligns", "aligned",
    "keep", "keeps", "kept", "move", "moves", "moved", "model", "models",
    "walk", "walks", "put", "puts", "take", "takes", "took",
    "provide", "provides", "stay", "stays", "give", "gives", "bring", "brings",
    "help", "helps", "use", "uses", "used", "build", "builds", "built",
}
# run/model/scope/cover/commit/rate 등은 명사로도 쓰인다(run rate, cost model,
# commitment). 통계 단계에서 미리 죽이면 LLM이 볼 기회조차 없어진다.
# 전부 흔한 단어면 도메인 용어가 아니다
_COMMON = _EDGE_STOP | {
    "time", "thing", "things", "people", "team", "work", "one", "two", "way",
    "day", "week", "month", "year", "side", "point", "part", "case", "sure",
    "good", "great", "right", "well", "much", "more", "most", "some", "any",
    "other", "next", "last", "first", "back", "still", "even", "really",
}


def _sentences(text: str) -> list[str]:
    """문장 경계를 넘어 n-gram이 만들어지지 않게 자른다.
    (청크가 2줄 겹치도록 만들어져 있어 'backups yes backups' 같은 게 생겼다)"""
    body = re.sub(r"^\s*(상대|나|Me|Them)\s*:", "\n", text, flags=re.M)
    body = body.split("[검색어]")[0]
    return [x for x in re.split(r"[.!?;\n]+", body) if x.strip()]


def _ngrams(tokens: list[str], n: int):
    for i in range(len(tokens) - n + 1):
        yield " ".join(tokens[i:i + n])


def glossary_candidates(store: rag.Store | None = None,
                        min_count: int = 3, limit: int = 40) -> list[dict]:
    """트랜스크립트에서 반복 등장하는 2~3어절 도메인 표현을 뽑는다.
    자동 승격하지 않는다 — 틀린 용어가 들어가면 제안 문장이 통째로 틀어지므로
    사용자가 승인한 것만 용어집이 된다.
    limit은 넉넉히 둔다 — 여기서 자르면 LLM 판별 단계가 볼 기회조차 없어진다."""
    store = store or rag.default_store()
    with store.connect() as con:
        texts = [r[0] for r in con.execute(
            "SELECT text FROM chunks WHERE source='transcript'")]
        known = {r[0].lower() for r in con.execute(
            "SELECT title FROM chunks WHERE source='glossary'")}
    if not texts:
        return []

    counts: dict[str, int] = {}
    for t in texts:
        seen_here: set[str] = set()
        for sent in _sentences(t):
            toks = re.findall(r"[a-zA-Z][a-zA-Z0-9-]{1,}", sent.lower())
            for n in (3, 2):
                for g in _ngrams(toks, n):
                    w = g.split()
                    # 통계 단계는 재현율만 담당한다 — 경계의 기능어·동사만 막고,
                    # 무엇이 진짜 용어인지는 LLM 판별 단계가 정한다.
                    if w[0] in _EDGE_STOP or w[-1] in _EDGE_STOP:
                        continue
                    if w[0] in _VERBS or w[-1] in _VERBS:
                        continue
                    if all(x in _COMMON for x in w):
                        continue
                    if any(len(x) <= 2 for x in w) or g in known:
                        continue
                    if g in seen_here:                 # 한 청크 안 중복은 1회
                        continue
                    seen_here.add(g)
                    counts[g] = counts.get(g, 0) + 1

    # 포함 관계 정리: "data residency"와 같은 횟수면 "residency"류 짧은 건 버린다
    # 포함 관계 정리 — 짧은 표현이 '항상 더 긴 표현의 일부로만' 등장할 때만 지운다.
    # (횟수가 같다 = 독립적으로 쓰인 적이 없다) 조금이라도 단독 등장하면 남긴다.
    kept: dict[str, int] = dict(counts)
    for g, c in list(counts.items()):
        for k, ck in counts.items():
            if g != k and f" {g} " in f" {k} " and ck >= c:
                kept.pop(g, None)
                break

    cands = [{"term": g, "count": c} for g, c in kept.items() if c >= min_count]
    cands.sort(key=lambda d: (-d["count"], -len(d["term"].split()), d["term"]))
    return cands[:limit]


def refine_candidates(cands: list[dict], model: str | None = None) -> list[dict]:
    """통계로 뽑은 후보를 LLM이 걸러내고 한국어 뜻을 붙인다.

    불용어 목록을 손으로 늘리는 방식은 한계가 분명하다("annual not three",
    "rate significantly" 같은 조각이 계속 새어 나온다). 후보 추출은 재현율만
    담당하고, 무엇이 도메인 용어인지는 LLM이 판단하게 한다.
    미팅 중이 아니라 사후에 도는 경로라 호출 1회로 충분하다.
    실패하면 통계 결과를 그대로 돌려준다 — 이 기능 때문에 앱이 멈추면 안 된다.
    """
    if not cands:
        return []
    listed = "\n".join(f"- {c['term']} ({c['count']}x)" for c in cands[:40])
    prompt = f"""These phrases were extracted from a Korean cloud-sales professional's
English business meeting transcripts by frequency counting. Most are sentence
fragments, not real terms.

Candidates:
{listed}

Keep ONLY the ones that are genuine domain terms or fixed business expressions
worth adding to a sales glossary (cloud infrastructure, pricing/FinOps, security,
compliance, contracts, procurement). Drop sentence fragments, adjective+noun
combinations that are not terms, and anything containing a number or adverb.

Return ONLY valid JSON:
{{"terms": [{{"term": "exact phrase from the list", "ko": "짧은 한국어 뜻"}}]}}"""
    try:
        out = json.loads(llm.chat_once([{"role": "user", "content": prompt}],
                                       json_mode=True, temperature=0.1,
                                       max_tokens=900, model=model))
    except Exception:  # noqa: BLE001 — 판별 실패가 기능을 막지 않게
        return cands
    by_count = {c["term"]: c["count"] for c in cands}
    kept = []
    for t in (out.get("terms") or []):
        term = (t.get("term") or "").strip().lower()
        if term in by_count:
            kept.append({"term": term, "ko": (t.get("ko") or "").strip(),
                         "count": by_count[term]})
    return kept or cands
