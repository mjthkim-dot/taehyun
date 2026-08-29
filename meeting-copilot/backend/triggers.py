"""질의 확장 — 면접관의 말과 내 자료의 어휘를 잇는다.

왜 필요한가: 노트에는 답이 있는데 **면접관이 쓰는 표현**이 노트의 [검색어]에
없으면 검색이 놓친다. 골든셋 실측에서 놓친 문항 대부분이 이 유형이었다
("sales methodology" → 딜 검증 습관 노트, "AI maturity" → L1-L4 노트).

왜 코드에 두는가: 코퍼스는 사용자의 것이고 통째로 재적재된다. 여기 두면
재적재해도 유지되고, 골든셋으로 효과를 잴 수 있고, 되돌리기도 쉽다.
질의에만 붙이고 **프롬프트에는 넣지 않는다** — 답변 문장에 영향을 주지 않는다.

원칙: 사실을 추가하지 않는다. 어휘만 잇는다.
"""
from __future__ import annotations

import re

# (면접관 표현 패턴, 내 자료 어휘) — 소문자 기준
EXPANSIONS: list[tuple[str, str]] = [
    # 딜 딥다이브
    (r"\b(lost|losing|lose)\b.{0,20}\bdeal\b|\bdeal\b.{0,20}\b(lost|fell through|didn't close)\b",
     "failure resilience setback win-back 실패 회복탄력성"),
    (r"\bsales cycle\b|\bhow long\b.{0,24}\b(close|deal)\b",
     "deal size spectrum 실적 숫자 average deal enterprise cycle"),
    (r"\b(methodology|sales process|how do you sell|qualify|qualification)\b",
     "MEDDPICC validate discovery why now 딜 검증 습관 technical fit business value"),
    (r"\bdefend\b.{0,16}\bprice\b|\bprice pressure\b|\bdiscount\b",
     "반론 대응 확장 전략 land expand value"),
    # 파이프라인
    (r"\b(from scratch|brand new customers|no network|cold)\b",
     "cold outbound prospecting without network LinkedIn inbound 네트워크 없이"),
    (r"\boutbound\b.{0,20}\b(motion|look like|day to day)\b|\bprospecting\b.{0,20}\bdaily\b",
     "cold outbound prospecting LinkedIn campaign hunting 헌팅"),
    # 숫자
    (r"\bhow many\b.{0,16}\baccounts\b|\baccounts do you (manage|own|carry)\b",
     "portfolio accounts 실적 숫자 track record 내 프로필"),
    # 제품·경쟁
    (r"\b(product line|product portfolio|your product|our product)\b",
     "genies agent studio enterprise MCP platform recipes connectors Workato 제품"),
    # 프레임워크
    (r"\b(ai maturity|maturity model|maturity of|adoption stages)\b",
     "framework L1 L2 L3 L4 maturity 프레임워크 execution grounding connection governance"),
    (r"\b(where|how).{0,24}\b(money|value|revenue)\b.{0,24}\b(made|come from)\b",
     "L4 세일즈 논리 governance gartner agent failures who pays"),
    # 동기
    (r"\b(motivating|motivates|why (a )?change|why (are you )?(looking|leaving))\b",
     "why workato why leave motivation career move 이직 사유"),
]

_COMPILED = [(re.compile(p, re.I), t) for p, t in EXPANSIONS]


def expand(query: str) -> str:
    """질의에 자료 어휘를 덧붙인다. 매칭이 없으면 원문 그대로."""
    if not query:
        return query
    extra = [t for rx, t in _COMPILED if rx.search(query)]
    return query + " " + " ".join(extra) if extra else query
