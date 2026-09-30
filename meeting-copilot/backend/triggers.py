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

import company

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
    # 프레임워크
    (r"\b(ai maturity|maturity model|maturity of|adoption stages)\b",
     "framework L1 L2 L3 L4 maturity 프레임워크 execution grounding connection governance"),
    (r"\b(where|how).{0,24}\b(money|value|revenue)\b.{0,24}\b(made|come from)\b",
     "L4 세일즈 논리 governance gartner agent failures who pays"),
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
     r"|\bwhat.{0,16}\bsee\b.{0,20}\bmarket\b"
     # "go-to-market structure in South Korea", "presence in Korea" — 순서가 뒤집힌 표현(v6.5)
     r"|\b(korea|korean)\b.{0,40}\b(market|go-to-market|gtm|footprint|presence|team|office)\b"
     r"|\b(market|go-to-market|gtm|footprint|presence|team|office)\b.{0,40}\b(korea|korean)\b",
     "korea market opportunity AI native production PoC customer pain 한국 시장 현황 presence"),
]

_COMPILED = [(re.compile(p, re.I), t) for p, t in EXPANSIONS]


def _company_rules() -> list[tuple[re.Pattern, str]]:
    """회사에 따라 달라지는 규칙 — v6.5 전에는 워카토가 코드에 박혀 있었다.

    · 동기: "Why <회사>, and why now?"는 leaving/motivating 어느 쪽도 안 쓴다.
      유닛 라우팅 점검에서 이 표현이 '프레임워크 매핑' 노트로 새는 것을 잡았다.
      core 노트 제목은 {{COMPANY}}가 회사 이름으로 바뀌어 적재되므로
      "why <회사>" 어휘를 실어 주면 그 노트로 간다.
    · 제품: 회사 이름 + 제품 어휘. 제품명 같은 세부는 회사 파일 triggers에 둔다.
    · 회사 파일(또는 vocab.json의 회사 절)의 triggers를 뒤에 붙인다."""
    nms = company.names()
    nm = nms[0] if nms else ""
    alt = "|".join(re.escape(n.lower()) for n in nms)
    who = (alt + "|") if alt else ""
    rules = [
        (r"\b(motivating|motivates|why (a )?change|why (are you )?(looking|leaving))\b"
         rf"|\bwhy ({who}us|this company|here|now)\b|\breason for (the )?(change|move)\b"
         # "Why are you interested in joining X", "what attracts you to us" — 'why X'가
         # 없는 동기 질문(v6.5 실측: 레퍼런스 카드로 샜다)
         r"|\b(interested in (joining|working)|want to (join|work (at|for|with|here)))\b"
         r"|\b(attracts?|attracted|drew|draws|excites?) you\b",
         f"why {nm.lower()} why leave motivation career move 이직 사유 platform scale consultants"),
        (r"\b(product lines?|product portfolio|your products?|our products?)\b",
         f"{nm} 제품 product platform"),
        # "What do you know about us / our company?" — 면접 첫 질문의 단골.
        # 템플릿의 '회사·재무 팩트' 노트 어휘로 잇는다(v6.5 실측: 이 질문이 Tier C였다).
        (rf"\bwhat do you know about (us|our company|the company|{who}our business)\b"
         r"|\b(researched|research on|know about) (us|our company)\b",
         f"{nm} 회사 재무 팩트 company financials revenue growth customers news"),
    ] + company.triggers()
    out = []
    for p, t in rules:
        try:
            out.append((re.compile(p, re.I), t))
        except re.error:
            continue
    return out


def expand(query: str) -> str:
    """질의에 자료 어휘를 덧붙인다. 매칭이 없으면 원문 그대로."""
    if not query:
        return query
    extra = [t for rx, t in _COMPILED + _company_rules() if rx.search(query)]
    return query + " " + " ".join(extra) if extra else query
