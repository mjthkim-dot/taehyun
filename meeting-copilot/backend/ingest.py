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

import rag

SEED = Path(__file__).parent / "data" / "glossary_seed.json"


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


def _with_keywords(text: str) -> str:
    """본문에서 상황을 감지해 영문 검색어를 덧붙인다 (검색 전용 꼬리표)."""
    hits: list[str] = []
    for pat, kws in _BRIDGE.items():
        if re.search(pat, text):
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
    if not SEED.exists():
        return []
    return chunks_from_glossary(json.loads(SEED.read_text(encoding="utf-8")))


def ensure_seeded() -> dict:
    """용어집이 비어 있으면 시드를 넣는다 — 처음 켰을 때 검색이 빈손이 아니게."""
    st = rag.stats()
    if st["by_source"].get("glossary"):
        return {"seeded": 0, **st}
    items = load_seed_glossary()
    r = rag.add_chunks(items) if items else {"added": 0}
    return {"seeded": r.get("added", 0), **rag.stats()}
