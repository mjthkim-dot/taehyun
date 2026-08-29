#!/usr/bin/env python3
"""라우팅 골든셋 — Workato 하이어링 매니저 면접 기준 40문항.

무엇을 재는가: "면접관이 이렇게 물으면 내 자료의 **어느 대본**이 뜨는가."
이게 없으면 어떤 수정도 개선인지 개악인지 알 수 없다(진단 #13).

기준 3가지를 함께 본다.
  · top1 적중 — 첫 근거가 기대한 대본인가 (Tier A 조회의 전제)
  · top3 적중 — 기대 대본이 근거 안에 들어오는가 (Tier B 생성의 전제)
  · 티어 정확도 — 대본이 있는 질문을 C로 떨구거나, 없는 질문을 B로 새게 하지 않는가

실행:  python3 tests/golden_routing.py          (요약)
       python3 tests/golden_routing.py -v       (문항별)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import prompts  # noqa: E402
import rag  # noqa: E402

# expect: 이 문자열 중 하나가 근거 제목에 들어오면 적중.
# tier:  B = 대본이 있어야 함 / C = 대본이 없어야 함(지어내면 안 됨)
CASES: list[dict] = [
    # ── 딜 딥다이브 (HM이 가장 깊게 파는 축) ──
    {"q": "Walk me through the biggest deal you've closed end to end.",
     "expect": ["딜 스토리 A", "딜 사례", "deal example"], "tier": "B"},
    {"q": "What's the largest contract you have ever signed?",
     "expect": ["딜 스토리 A", "실적 숫자", "딜 사례"], "tier": "B"},
    {"q": "Tell me about a complex deal with many stakeholders.",
     "expect": ["L4 클로징", "딜 스토리", "멀티스레딩"], "tier": "B"},
    {"q": "How did you qualify that opportunity? What made you confident?",
     "expect": ["딜 검증 습관", "딜 사례"], "tier": "B"},
    {"q": "Tell me about a deal you lost and what you learned.",
     "expect": ["딜 스토리 F", "실패"], "tier": "B"},
    {"q": "Give me an example where you had to defend your price.",
     "expect": ["반론 대응", "딜 사례", "확장 전략"], "tier": "B"},
    {"q": "How long is your typical sales cycle?",
     "expect": ["딜 사례", "실적 숫자", "확장 전략"], "tier": "B"},
    {"q": "What was the ROI story you told that customer?",
     "expect": ["딜 스토리 D", "ROI"], "tier": "B"},

    # ── 파이프라인 생성 (JD 핵심) ──
    {"q": "How do you generate new pipeline?",
     "expect": ["메가존 네트워크", "파이프라인"], "tier": "B"},
    {"q": "How do you find brand new customers from scratch?",
     "expect": ["네트워크 없이 파이프라인", "메가존 네트워크"], "tier": "B"},
    {"q": "If you had no existing network here, what would you do in week one?",
     "expect": ["네트워크 없이 파이프라인", "첫 90일"], "tier": "B"},
    {"q": "What does your outbound motion actually look like day to day?",
     "expect": ["네트워크 없이 파이프라인", "딜 스토리 G", "헌팅"], "tier": "B"},
    {"q": "Which accounts would you target first in Korea?",
     "expect": ["Warm Target", "한국 테리토리", "한국 시장"], "tier": "B"},

    # ── 숫자 검증 (HM은 반드시 판다) ──
    {"q": "What was your quota last year and did you hit it?",
     "expect": ["실적 숫자"], "tier": "B"},
    {"q": "What's your average deal size?",
     "expect": ["실적 숫자", "확장 전략", "딜 사례"], "tier": "B"},
    {"q": "How much of your number came from new logos versus expansion?",
     "expect": ["실적 숫자", "확장 전략", "리텐션"], "tier": "B"},
    {"q": "How many accounts do you manage today?",
     "expect": ["실적 숫자", "내 프로필"], "tier": "B"},

    # ── 제품·경쟁 (Workato 특화) ──
    {"q": "What do you know about Workato's product line?",
     "expect": ["Workato 제품"], "tier": "B"},
    {"q": "How would you position us against MuleSoft or Boomi?",
     "expect": ["경쟁", "MuleSoft"], "tier": "B"},
    {"q": "A customer says n8n is free, why would they pay us?",
     "expect": ["n8n", "반론 대응"], "tier": "B"},
    {"q": "Our prospect is all-in on AWS. Why not just use native services?",
     "expect": ["AWS 네이티브", "반론 대응"], "tier": "B"},
    {"q": "What if they say they'll just build their own MCP layer?",
     "expect": ["MCP", "반론 대응", "Build"], "tier": "B"},
    {"q": "What do you know about our company and financials?",
     "expect": ["Workato 회사", "Workato 제품"], "tier": "B"},

    # ── 방법론·프레임워크 ──
    {"q": "What's your sales methodology?",
     "expect": ["딜 검증 습관", "L1-L4", "L4 세일즈"], "tier": "B"},
    {"q": "Walk me through how you think about AI maturity with customers.",
     "expect": ["L1-L4", "프레임워크"], "tier": "B"},
    {"q": "Where exactly does the money get made in that framework?",
     "expect": ["L4 세일즈 논리"], "tier": "B"},
    {"q": "How do you multithread into an account?",
     "expect": ["L4 클로징", "멀티스레딩"], "tier": "B"},

    # ── 파트너·채널 ──
    {"q": "How do you work with partners in a co-sell motion?",
     "expect": ["파트너 전략", "딜 스토리 E"], "tier": "B"},
    {"q": "Tell me about a time a partner conflict threatened a deal.",
     "expect": ["딜 스토리 E", "파트너 충돌"], "tier": "B"},

    # ── 동기·적합성 ──
    {"q": "Why Workato, and why now?",
     "expect": ["이직 사유", "Why Workato"], "tier": "B"},
    {"q": "What's motivating you to make a change right now?",
     "expect": ["이직 사유"], "tier": "B"},
    {"q": "Why should we hire you over other candidates?",
     "expect": ["왜 나인가", "발표 — 마무리"], "tier": "B"},
    {"q": "Tell me about yourself.",
     "expect": ["자기소개", "내 프로필"], "tier": "B"},

    # ── 실행 계획 ──
    {"q": "What would your first 90 days look like here?",
     "expect": ["첫 90일", "6개월 실행"], "tier": "B"},
    {"q": "How would you build a territory plan for Korea?",
     "expect": ["한국 테리토리", "한국 시장", "6개월 실행"], "tier": "B"},

    # ── 협업·언어 ──
    {"q": "Are you comfortable running meetings in English with a global team?",
     "expect": ["영어 커뮤니케이션", "영어 리스크"], "tier": "B"},
    {"q": "How do you keep a remote manager informed about your deals?",
     "expect": ["영어 커뮤니케이션", "소프트스킬"], "tier": "B"},

    # ── 보상 ──
    {"q": "What are your compensation expectations?",
     "expect": ["연봉"], "tier": "B"},

    # ── 대본이 없어야 하는 것 (지어내면 안 된다) ──
    {"q": "What is your favorite pizza topping in Naples?",
     "expect": [], "tier": "C"},
    {"q": "How do you make authentic carbonara at home?",
     "expect": [], "tier": "C"},
]


def run(verbose: bool = False) -> int:
    st = rag.default_store()
    top1 = top3 = tier_ok = 0
    a_fired = a_right = 0
    a_wrong: list[tuple[str, str]] = []
    b_cases = [c for c in CASES if c["tier"] == "B"]
    misses: list[tuple[str, str]] = []
    for c in CASES:
        built = prompts.build_suggest(c["q"], "", "reply", "B2",
                                      store=st, preset="interview")
        titles = [h["title"] for h in built["hits"]]
        hit1 = bool(titles) and any(e in titles[0] for e in c["expect"])
        hit3 = any(any(e in t for t in titles) for e in c["expect"]) if c["expect"] else False
        if c["tier"] == "B":
            top1 += hit1
            top3 += hit3
            if not hit3:
                misses.append((c["q"], titles[0] if titles else "—"))
        # Tier A는 '검수한 대본을 그대로 읽는' 경로다. 티어 판정에서는 B로 친다
        # (둘 다 '대본이 있다'는 뜻). 대신 아래에서 따로, 더 엄하게 잰다.
        eff = "B" if built["tier"] == "A" else built["tier"]
        tier_ok += eff == c["tier"]
        if built["tier"] == "A":
            ut = (built.get("unit") or {}).get("note_title", "")
            a_fired += 1
            if any(e in ut for e in c["expect"]):
                a_right += 1
            else:
                a_wrong.append((c["q"], ut))
        if verbose:
            mark = "✅" if (hit3 if c["expect"] else built["tier"] == "C") else "❌"
            print(f"  {mark} [{built['tier']}] {c['q'][:52]:54} → {titles[0][:34] if titles else '—'}")
    n_b = len(b_cases)
    print(f"\n  top1 적중  {top1}/{n_b} ({top1/n_b*100:.0f}%)")
    print(f"  top3 적중  {top3}/{n_b} ({top3/n_b*100:.0f}%)")
    print(f"  티어 정확  {tier_ok}/{len(CASES)} ({tier_ok/len(CASES)*100:.0f}%)")
    # Tier A는 생성 없이 그대로 발화된다 — 틀린 유닛이 하나라도 뜨면 실패다.
    # 커버리지가 낮은 건 견딜 수 있다(Tier B로 떨어질 뿐). 오발화는 못 견딘다.
    print(f"  Tier A 발동 {a_fired}/{n_b} · 맞음 {a_right} · 틀림 {len(a_wrong)}")
    for q, ut in a_wrong:
        print(f"   ✗ {q[:56]}\n       → 틀린 대본: {ut[:46]}")
    if misses:
        print(f"\n  ── 놓친 문항 {len(misses)}건 (다음 유닛 승격의 입력) ──")
        for q, got in misses:
            print(f"   · {q[:60]}\n     → 대신 나온 것: {got[:50]}")
    return 0 if top3 == n_b and tier_ok == len(CASES) and not a_wrong else 1


if __name__ == "__main__":
    sys.exit(run("-v" in sys.argv))
