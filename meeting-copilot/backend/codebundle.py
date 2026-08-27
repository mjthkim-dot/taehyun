"""코드 스냅샷 번들 — Claude에 붙여넣어 분석시키기 위한 텍스트 묶음을 만든다.

왜 필요한가: 이 앱은 소스가 310KB라 한 번에 붙여넣기 어렵다. 그래서
 · 논리 단위(서버 / 프론트 / LLM / RAG / 테스트)로 나누고
 · 각 조각을 붙여넣기 편한 크기(기본 55,000자)로 자르고
 · **개인 데이터와 비밀은 원천 제외·마스킹**한 뒤
 · 각 조각 머리에 "이게 무엇이고 무엇을 봐 달라"는 안내를 붙인다.

절대 포함하지 않는 것: backend/data/(미팅 트랜스크립트·개인 노트·인증 DB),
logs/(호출 트레이스), .git, __pycache__. 여기에 개인 코퍼스가 들어가면
회사 실명·실적이 외부 대화로 나간다 — 파일 목록은 화이트리스트로만 정한다.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_CHARS = 55_000            # 조각 하나의 상한 — 붙여넣기가 버거워지지 않는 선

# 화이트리스트: 여기 없는 파일은 절대 번들에 들어가지 않는다.
GROUPS: list[tuple[str, list[str]]] = [
    ("서버·셸", ["server.py", "sw.js", "app.webmanifest"]),
    ("프론트엔드", ["app.html"]),
    ("LLM·게이트웨이", ["backend/llm.py", "backend/gateway.py"]),
    ("RAG·프롬프트", ["backend/rag.py", "backend/prompts.py", "backend/ingest.py"]),
    ("부가 백엔드", ["backend/auth.py", "backend/review.py", "backend/notion.py"]),
    ("테스트", ["tests/e2e.mjs", "tests/mock_gemini.py", "tests/resilience-sim.mjs"]),
]

_LANG = {".py": "python", ".html": "html", ".js": "javascript",
         ".mjs": "javascript", ".json": "json", ".webmanifest": "json"}

# 비밀 마스킹 — 소스에 하드코딩은 없지만, 실수로 섞여도 밖으로 나가지 않게 이중 방어.
_SECRETS = [
    (re.compile(r"AQ\.[A-Za-z0-9_\-]{10,}"), "[REDACTED_API_KEY]"),
    (re.compile(r"\bsk-[A-Za-z0-9]{10,}"), "[REDACTED_API_KEY]"),
    (re.compile(r"\bghp_[A-Za-z0-9]{10,}"), "[REDACTED_TOKEN]"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"), "[REDACTED_TOKEN]"),
    (re.compile(r"(?<=key=)[A-Za-z0-9_\-]{16,}"), "[REDACTED]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[EMAIL]"),
]


def _scrub(text: str) -> str:
    for pat, to in _SECRETS:
        text = pat.sub(to, text)
    return text


HEADER = """\
# 실시간 영어 미팅 어시스턴트 — 코드 스냅샷 ({part}/{total})

비개발자(B2B 세일즈)가 영어 면접·미팅에서 쓰는 로컬 PWA입니다. 상대 발화를
실시간 인식→한국어 번역하고, 개인 자료(RAG)에 근거한 영어 답변을 제안합니다.
파이썬 표준 라이브러리 HTTP 서버 + 단일 HTML 프론트, LLM은 Gemini입니다.

핵심 설계 세 가지만 미리 알려드립니다.
 1) 속도 계층: ⚡오프너(작은 모델, ~1초)를 먼저 띄우고 본답변(~2초)이 교체합니다.
 2) 게이트웨이: 모든 LLM 호출이 fast/main 레인으로 나뉘어 동시 실행·우선순위·
    재시도·서킷브레이커를 통과합니다. 번역이 배경 작업에 밀리지 않게 슬롯을 예약합니다.
 3) 턴 정착: STT가 질문을 여러 조각으로 뱉으므로, 턴이 멈춘 뒤 답변을 1회만 만듭니다.

**개인 데이터(미팅 기록·개인 노트)와 API 키는 이 스냅샷에서 제외했습니다.**
분석 시 그 부분은 "있다고 가정"만 해 주세요.

이 조각에 담긴 파일: {files}
{note}
---
"""

NOTE_MULTI = ("\n(전체 {total}조각 중 {part}번째입니다. 모두 붙여넣은 뒤에 "
              "질문하시면 가장 정확합니다.)\n")


def _read(rel: str) -> str | None:
    p = ROOT / rel
    if not p.is_file():
        return None
    try:
        return _scrub(p.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError):
        return None


def _blocks() -> list[tuple[str, str]]:
    """(파일명, ```펜스 블록```) 목록. 큰 파일은 줄 경계에서 나눈다."""
    out: list[tuple[str, str]] = []
    for _group, files in GROUPS:
        for rel in files:
            text = _read(rel)
            if text is None:
                continue
            lang = _LANG.get(Path(rel).suffix, "")
            if len(text) <= MAX_CHARS:
                out.append((rel, f"## `{rel}`\n\n```{lang}\n{text}\n```\n"))
                continue
            lines, chunk, size, idx = text.split("\n"), [], 0, 1
            pieces: list[list[str]] = []
            for ln in lines:
                if size + len(ln) + 1 > MAX_CHARS and chunk:
                    pieces.append(chunk)
                    chunk, size = [], 0
                chunk.append(ln)
                size += len(ln) + 1
            if chunk:
                pieces.append(chunk)
            for idx, piece in enumerate(pieces, 1):
                label = f"{rel} ({idx}/{len(pieces)})"
                body = "\n".join(piece)
                out.append((label,
                            f"## `{label}`\n\n```{lang}\n{body}\n```\n"))
    return out


def parts(max_chars: int = MAX_CHARS) -> list[str]:
    """붙여넣기 단위 목록. 각 조각은 안내 머리말 + 파일 블록들."""
    packed: list[list[tuple[str, str]]] = []
    cur: list[tuple[str, str]] = []
    size = 0
    for name, block in _blocks():
        if cur and size + len(block) > max_chars:
            packed.append(cur)
            cur, size = [], 0
        cur.append((name, block))
        size += len(block)
    if cur:
        packed.append(cur)

    total = len(packed)
    out = []
    for i, group in enumerate(packed, 1):
        names = ", ".join(n for n, _ in group)
        note = NOTE_MULTI.format(total=total, part=i) if total > 1 else ""
        head = HEADER.format(part=i, total=total, files=names, note=note)
        out.append(head + "\n" + "\n".join(b for _, b in group))
    return out


def manifest() -> list[dict]:
    return [{"part": i, "chars": len(t)} for i, t in enumerate(parts(), 1)]
