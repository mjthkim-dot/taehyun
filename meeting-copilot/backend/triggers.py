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
    # 동기 — "Why Workato, and why now?"는 leaving/motivating 어느 쪽도 안 쓴다.
    # 유닛 라우팅 점검에서 이 표현이 '프레임워크 매핑' 노트로 새는 것을 잡았다.
    (r"\b(motivating|motivates|why (a )?change|why (are you )?(looking|leaving))\b"
     r"|\bwhy (workato|us|this company|here|now)\b|\breason for (the )?(change|move)\b",
     "why workato why leave motivation career move 이직 사유 platform scale consultants"),
    # 규모 — "biggest/largest deal"은 랜드앤익스팬드 노트와 경합한다. 최대 딜은
    # EDP 갱신 쪽이므로 그 어휘를 실어 준다(작은 딜 노트를 지우지는 않는다).
    (r"\b(biggest|largest|best)\b.{0,20}\b(deal|contract|account)\b"
     r"|\bdeal\b.{0,16}\b(proud|proudest)\b",
     "renewal early renewal EDP commoditization expansion architecture 딜 스토리 A"),
    # 실행 계획 — 노트가 둘이다(GitLab 시절 일반론 vs 워카토용 상세).
    # 면접에서는 상세한 쪽을 읽어야 하므로 그 어휘를 실어 준다.
    (r"\b(first (90|ninety) days|30.?60.?90|what would you do first|your plan if we hire)\b",
     "6개월 실행 계획 new logo quick win AM 네트워크 반복 가능한 GTM 모션 온보딩"),
    (r"\bterritory (plan|strategy)\b|\bbuild a territory\b",
     "한국 테리토리 전략 시장 진단 온프렘 계열사 자율성 규제 비치헤드 L3 L4 공백"),
    # 시장
    (r"\b(korean market|market in korea|korea opportunity|territory)\b"
     r"|\bwhat.{0,16}\bsee\b.{0,20}\bmarket\b",
     "korea market opportunity AI native production PoC customer pain 한국 시장"),
]

_COMPILED = [(re.compile(p, re.I), t) for p, t in EXPANSIONS]


def expand(query: str) -> str:
    """질의에 자료 어휘를 덧붙인다. 매칭이 없으면 원문 그대로."""
    if not query:
        return query
    extra = [t for rx, t in _COMPILED if rx.search(query)]
    return query + " " + " ".join(extra) if extra else query
