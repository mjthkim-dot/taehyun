"""
Notion 수업 노트 → [표현 / 예문 / 교정받은 문장] 단위 청킹 (P0-1)

왜 이 단위인가: 미팅 중에 필요한 건 "3회차 문법 진도" 같은 덩어리가 아니라
**지금 바로 쓸 수 있는 한 문장**이다. 그래서 표현 하나 = 청크 하나로 쪼갠다.

가져오는 경로 2가지
 · NOTION_TOKEN이 있으면 Notion API로 직접 (page ID는 하이픈 UUID로 정규화 — 하이픈
   없는 32자를 그대로 넣으면 일부 엔드포인트에서 불안정하다)
 · 없으면 Notion에서 내보낸/복사한 내용을 붙여넣는 경로

인덱스 갱신은 자동으로 돌지 않는다 — 수동 '동기화' 버튼과 미팅 종료 훅에서만.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

import ingest

NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
NOTION_VERSION = "2022-06-28"
API = "https://api.notion.com/v1"

# 분류 규칙 — 무엇이 '표현'이고 '교정'인지
_CORRECTION = re.compile(
    r"(→|➜|=>|\bnot\b\s+\w|대신|아니라|주의|교정|틀림|✗|❌|지적|하지 말)", re.I)
_HAS_EN = re.compile(r"[A-Za-z][A-Za-z' ,.\-]{6,}")
_QUOTED = re.compile(r'["“]([^"”]{6,120})["”]')


def normalize_page_id(raw: str) -> str:
    """URL이든 32자 hex든 하이픈 UUID로 정규화한다."""
    s = (raw or "").strip()
    m = re.search(r"([0-9a-fA-F]{32})", s.replace("-", ""))
    if not m:
        return s
    h = m.group(1).lower()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _api(path: str) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        headers={"Authorization": f"Bearer {NOTION_TOKEN}",
                 "Notion-Version": NOTION_VERSION,
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def _rich(blocks: list) -> str:
    return "".join(b.get("plain_text", "") for b in blocks or [])


def fetch_blocks(page_id: str, depth: int = 2) -> list[dict]:
    """페이지의 블록을 평평하게 편다. 표는 행 단위 텍스트로."""
    pid = normalize_page_id(page_id)
    out: list[dict] = []

    def walk(bid: str, level: int):
        cursor = None
        while True:
            q = f"/blocks/{bid}/children?page_size=100" + (f"&start_cursor={cursor}" if cursor else "")
            data = _api(q)
            for b in data.get("results", []):
                t = b.get("type")
                body = b.get(t) or {}
                text = _rich(body.get("rich_text"))
                if t == "table_row":
                    text = " | ".join(_rich(c) for c in body.get("cells", []))
                if text.strip():
                    out.append({"type": t, "text": text.strip()})
                if b.get("has_children") and level < depth:
                    walk(b["id"], level + 1)
            if not data.get("has_more"):
                break
            cursor = data.get("next_cursor")

    walk(pid, 0)
    return out


def page_title(page_id: str) -> str:
    try:
        p = _api(f"/pages/{normalize_page_id(page_id)}")
        for v in (p.get("properties") or {}).values():
            if v.get("type") == "title":
                return _rich(v.get("title")) or "수업 노트"
    except Exception:  # noqa: BLE001
        pass
    return "수업 노트"


# ── 청킹 ──────────────────────────────────────────────────────
def _kind(line: str) -> str:
    if _CORRECTION.search(line):
        return "correction"
    if _QUOTED.search(line) or _HAS_EN.search(line):
        return "expression"
    return "example"


_KIND_LABEL = {"expression": "배운 표현", "correction": "교정받은 문장", "example": "예문·설명"}


def chunks_from_lines(lines: list[str], source_title: str) -> list[dict]:
    """불릿/표 행 하나 = 청크 하나. 영어가 없는 순수 문법 설명은 섹션으로 묶는다."""
    items: list[dict] = []
    section = source_title
    buf: list[str] = []

    def flush_section():
        if len(buf) >= 2:
            body = "\n".join(buf)
            items.append({"source": "note", "title": f"{source_title} · {section}",
                          "text": ingest._with_keywords(body),
                          "meta": {"kind": "example", "section": section},
                          "uid": f"nt:{source_title}:{section}:{abs(hash(body)) & 0xffff:x}"})
        buf.clear()

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#") or re.match(r"^[🗓📖🗣🔊✅📈🎯📚]", line):
            flush_section()
            section = re.sub(r"^#+\s*", "", line)[:60]
            continue
        # 영어 표현이 들어 있으면 그 줄 자체가 하나의 청크가 된다
        if _HAS_EN.search(line) and len(line) > 12:
            flush_section()
            kind = _kind(line)
            items.append({
                "source": "note",
                "title": f"{_KIND_LABEL[kind]} · {section}"[:70],
                # 검색 다리를 함께 심는다 — 영어만 있는 줄도 한국어 질의로 찾히게
                "text": ingest._with_keywords(line),
                "meta": {"kind": kind, "section": section, "from": source_title},
                "uid": f"nt:{source_title}:{abs(hash(line)) & 0xffffff:x}",
            })
        else:
            buf.append(line)
    flush_section()
    return items


def chunks_from_markdown(text: str, title: str = "수업 노트") -> list[dict]:
    body = re.sub(r"^\s*[-*·]\s*", "", text, flags=re.M)
    return chunks_from_lines(body.splitlines(), title)


def chunks_from_page(page_id: str) -> list[dict]:
    if not NOTION_TOKEN:
        raise RuntimeError(
            "NOTION_TOKEN이 없습니다 — Notion 통합 토큰을 발급해 "
            "export NOTION_TOKEN=ntn_... 후 다시 시도하거나, 노트를 붙여넣기로 넣으세요.")
    title = page_title(page_id)
    blocks = fetch_blocks(page_id)
    return chunks_from_lines([b["text"] for b in blocks], title)


# ── 쓰기 (P1 복습 저장) ───────────────────────────────────────
# 기본 OFF다. 서버는 confirm=true인 요청만 여기로 내려보낸다 —
# 학습 기록은 사용자의 공간이고, 자동으로 남의 페이지에 쓰는 앱은 신뢰를 잃는다.
def _api_write(path: str, payload: dict, method: str = "PATCH") -> dict:
    req = urllib.request.Request(
        f"{API}{path}", method=method,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {NOTION_TOKEN}",
                 "Notion-Version": NOTION_VERSION,
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def _text_block(line: str) -> dict:
    """마크다운 한 줄 → Notion 블록. 지원 범위를 좁게 둔다(헤딩·불릿·문단)."""
    s = line.rstrip()
    kind, body = "paragraph", s
    if s.startswith("### "):
        kind, body = "heading_3", s[4:]
    elif s.startswith("## "):
        kind, body = "heading_2", s[3:]
    elif s.startswith("# "):
        kind, body = "heading_1", s[2:]
    elif re.match(r"^\s*[-*]\s+", s):
        kind, body = "bulleted_list_item", re.sub(r"^\s*[-*]\s+", "", s)
    body = re.sub(r"\*\*(.+?)\*\*|_(.+?)_", lambda m: m.group(1) or m.group(2), body)
    return {"object": "block", "type": kind,
            kind: {"rich_text": [{"type": "text",
                                  "text": {"content": body[:1900]}}]}}


def append_markdown(page_id: str, markdown: str) -> dict:
    """마크다운을 페이지 끝에 덧붙인다. 한 번에 100블록이 API 상한이라 나눠 보낸다."""
    if not NOTION_TOKEN:
        raise RuntimeError(
            "NOTION_TOKEN이 없습니다 — 저장하려면 Notion 통합 토큰이 필요합니다. "
            "토큰 없이 쓰려면 아래 마크다운을 직접 복사해 붙여넣으세요.")
    pid = normalize_page_id(page_id)
    lines = [l for l in (markdown or "").splitlines() if l.strip()]
    if not lines:
        raise RuntimeError("저장할 내용이 없습니다.")
    blocks = [_text_block(l) for l in lines]
    written = 0
    for i in range(0, len(blocks), 100):
        _api_write(f"/blocks/{pid}/children", {"children": blocks[i:i + 100]})
        written += len(blocks[i:i + 100])
    return {"page_id": pid, "blocks": written}
