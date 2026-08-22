/**
 * RAG 품질 테스트 — 테스트 쿼리 10개에 대해 기대 표현이 top 3에 들어오는지 검증한다.
 *
 * 이 앱의 차별점은 "내 자료에서 찾아 내 말투로 말한다"이므로, 검색이 틀리면
 * 나머지가 아무리 좋아도 제품이 실패한다. 그래서 이걸 회귀 테스트로 고정한다.
 *
 * 실행:  bash start.sh   (다른 터미널에서)
 *        npx tsx tests/rag-eval.ts        또는  deno run -A tests/rag-eval.ts
 *        (런타임이 없으면 python3 tests/rag_eval.py — 같은 케이스를 씁니다)
 */

const BASE = process.env.MC_BASE ?? "http://localhost:3799";

type Case = {
  /** 검색 질의 — 미팅 중 실제로 들어올 법한 발화 또는 퀵번역 입력 */
  q: string;
  /** top 3 안에 이 문자열 중 하나가 들어와야 통과 (대소문자 무시) */
  expect: string[];
  why: string;
};

/** 케이스는 세 갈래를 고루 덮는다: 영어 발화 → 용어집 / 영어 발화 → 노트·트랜스크립트 /
 *  한국어 퀵번역 → 영어 노트 (임베딩 없이도 되어야 하는 가장 어려운 방향) */
const CASES: Case[] = [
  { q: "Honestly, your quote came in higher than the other vendor.",
    expect: ["total cost of ownership"],
    why: "가격 반론 → 단가가 아닌 TCO로 프레임을 옮기는 표현" },
  { q: "We're worried about being locked in to a single cloud.",
    expect: ["vendor lock-in", "exit strategy"],
    why: "종속성 우려 → 이탈 계획/포터빌리티" },
  { q: "Can you commit to an uptime number?",
    expect: ["SLA"],
    why: "가용성 질문 → SLA 수치" },
  { q: "Our budget for this year is already allocated.",
    expect: ["budget cycle"],
    why: "예산 소진 → 예산 주기 표현" },
  { q: "How would the migration actually roll out?",
    expect: ["rollout plan", "migration"],
    why: "실행 방식 질문 → 단계적 전개 계획" },
  { q: "I need to check with my team before deciding.",
    expect: ["align internally"],
    why: "상대가 시간을 벌 때 받아주는 표현" },
  { q: "다음 미팅이 기대된다고 말하고 싶어요",
    expect: ["looking forward"],
    why: "한국어 퀵번역 → 영어만 있는 수업 노트 (양방향 검색 다리)" },
  { q: "감사하다고 말하고 싶어요",
    expect: ["grateful"],
    why: "한국어 퀵번역 → 수업에서 배운 grateful 구문" },
  { q: "오랜만이라고 인사하고 싶어요",
    expect: ["it's been a while", "how have you been"],
    why: "한국어 퀵번역 → 스몰토크 노트" },
  { q: "커피 주문하는 표현",
    expect: ["can i get one cappuccino", "medium, please"],
    why: "한국어 질의 → 카페 주문 노트" },
  // ── 인터뷰 시나리오 (8/27 HR 스크리닝 대비 — interview-corpus.json) ──
  { q: "Tell me about yourself and your current role.",
    expect: ["b2b sales hunter", "cloud msp"],
    why: "자기소개 질문 → 인터뷰 자기소개 시드" },
  { q: "Why do you want to join an automation company like this?",
    expect: ["why this company", "changes how customers work", "workflow automation"],
    why: "지원 동기 질문 → 동기·도메인 시드" },
  { q: "What do you know about iPaaS and our platform?",
    expect: ["ipaas", "connects cloud apps"],
    why: "도메인 지식 질문 → iPaaS 정의 시드" },
  { q: "면접관 말이 너무 빨라서 다시 말해달라고 하고 싶어",
    expect: ["could you rephrase", "slow down"],
    why: "한국어 퀵번역 → 되묻기 시드" },
  { q: "인터뷰 마무리에 관심 있다고 말하고 싶어요",
    expect: ["excited about the role", "move forward", "thank you for your time"],
    why: "한국어 퀵번역 → 클로징 시드" },
];

type Hit = { title: string; text: string; source_label: string };

async function search(q: string, k = 3): Promise<Hit[]> {
  const res = await fetch(`${BASE}/api/rag/search?k=${k}&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`검색 실패 HTTP ${res.status}`);
  return (await res.json()).hits as Hit[];
}

async function main() {
  const stats = await (await fetch(`${BASE}/api/rag/stats`)).json();
  console.log(`📚 색인 ${stats.total}개 · 모드 ${stats.mode}\n`);

  let pass = 0;
  for (const c of CASES) {
    let hits: Hit[] = [];
    try { hits = await search(c.q); }
    catch (e) { console.log(`❌ ${c.q}\n   ${(e as Error).message}`); continue; }

    const blob = hits.map(h => `${h.title} ${h.text}`).join("\n").toLowerCase();
    const ok = c.expect.some(e => blob.includes(e.toLowerCase()));
    if (ok) pass++;
    console.log(`${ok ? "✅" : "❌"} ${c.q}`);
    console.log(`   기대: ${c.expect.join(" | ")}  (${c.why})`);
    if (!ok) {
      hits.forEach((h, i) =>
        console.log(`   ${i + 1}. [${h.source_label}] ${h.title}`));
    }
  }
  const rate = Math.round((pass / CASES.length) * 100);
  console.log(`\n결과: ${pass}/${CASES.length} (${rate}%)`);
  // 임베딩 없이 키워드 전용으로 돌 때도 ~85% 밑으로 떨어지면 회귀로 본다
  if (pass < CASES.length - 2) {
    console.error("⚠️ 검색 품질이 기준(8/10) 아래입니다 — 검색 다리(_BRIDGE)를 점검하세요.");
    process.exit(1);
  }
}

main();
