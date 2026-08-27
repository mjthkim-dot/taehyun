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


# ── JSON 출력 ───────────────────────────────────────────────
#  Claude가 파일 경계를 정확히 알고 읽게 하려면 마크다운 펜스보다 구조가 낫다.
#  조각을 나눠도 각 조각이 **그 자체로 유효한 JSON**이 되게 한다 — 잘린 JSON은
#  파싱이 안 돼 쓸모가 없다.
PURPOSE = {
    "server.py": "HTTP 서버·라우팅. /api/suggest(답변 스트리밍)·/api/translate·"
                 "/api/stt·/api/code 등 모든 엔드포인트가 여기 모인다.",
    "app.html": "프론트 전체(단일 파일). STT 수신→턴 정착→답변 요청→렌더까지 "
                "클라이언트 로직 일체와 CSS·오버레이(PiP)·프롬프터 레이아웃.",
    "sw.js": "서비스워커. 앱 셸만 캐싱하고 대화·번역은 절대 캐싱하지 않는다.",
    "app.webmanifest": "PWA 매니페스트 — 홈 화면 설치·아이콘·표시 모드.",
    "backend/llm.py": "LLM 공급자 추상화(Gemini 주력). 모델 티어·thinking 협상·"
                      "스트리밍·STT(gemini-3.5-transcribe) 전사.",
    "backend/gateway.py": "모든 LLM 호출의 단일 관문. fast/main 레인·토큰버킷·"
                          "우선순위 큐·동시 슬롯·재시도·서킷브레이커.",
    "backend/rag.py": "SQLite 기반 개인 자료 색인·검색(키워드+선택적 임베딩).",
    "backend/prompts.py": "답변·번역·요약 프롬프트 계약. 답변 깊이 티어, 구어체 "
                          "규칙, 소유권 승격 금지 등 품질 규율이 전부 여기 있다.",
    "backend/ingest.py": "노트·트랜스크립트를 청크로 쪼개 색인에 넣는 적재기.",
    "backend/auth.py": "초대제 인증·사용자별 데이터 격리·쿼터.",
    "backend/review.py": "미팅 종료 후 복습 카드(SRS) 생성·스케줄.",
    "backend/notion.py": "Notion 페이지 가져오기(선택 기능).",
    "tests/e2e.mjs": "Playwright E2E — 자막·번역·답변·오버레이·회귀 계약 전체.",
    "tests/mock_gemini.py": "Gemini 모의 서버(RPM 강제·오류 주입) — 테스트 인프라.",
    "tests/resilience-sim.mjs": "429/503 폭탄 내성 시뮬레이션.",
}

META = {
    "project": "실시간 영어 미팅 어시스턴트 (meeting-copilot)",
    "what": "비개발자(B2B 세일즈)가 영어 면접·미팅에서 쓰는 로컬 PWA. 상대 발화를 "
            "실시간 인식→한국어 번역하고, 개인 자료(RAG) 근거로 영어 답변을 제안한다.",
    "stack": "Python 표준 라이브러리 HTTP 서버 + 단일 HTML 프론트 + SQLite + Gemini",
    "design_notes": [
        "속도 계층: ⚡오프너(작은 모델 ~1초)를 먼저 띄우고 본답변(~2초)이 교체한다.",
        "게이트웨이: 모든 LLM 호출이 fast/main 레인을 통과한다. 배경 작업이 레인의 "
        "마지막 슬롯을 못 채우게 예약해, 번역이 굶지 않는다.",
        "턴 정착: STT가 질문을 여러 조각으로 뱉으므로, 턴이 멈춘 뒤 답변을 1회만 만든다.",
    ],
    "excluded": [
        "backend/data/ — 미팅 트랜스크립트·개인 노트·인증 DB (개인 데이터)",
        "logs/ — API 호출 트레이스",
        "API 키·토큰 (패턴 마스킹까지 적용)",
    ],
    "caveat": "개인 자료(RAG 코퍼스)는 제외했다. 검색·근거 부분은 '자료가 있다고 가정'하고 봐 달라.",
}


def as_json(group_only: str | None = None) -> dict:
    """구조화 스냅샷. group_only를 주면 그 그룹만 담는다(조각별 유효 JSON)."""
    files = []
    for group, rels in GROUPS:
        if group_only and group != group_only:
            continue
        for rel in rels:
            text = _read(rel)
            if text is None:
                continue
            files.append({
                "path": rel,
                "group": group,
                "lang": _LANG.get(Path(rel).suffix, "text"),
                "purpose": PURPOSE.get(rel, ""),
                "lines": text.count("\n") + 1,
                "chars": len(text),
                "content": text,
            })
    out = dict(META)
    out["group"] = group_only or "전체"
    out["files"] = files
    return out


def json_groups() -> list[str]:
    return [g for g, _ in GROUPS]
