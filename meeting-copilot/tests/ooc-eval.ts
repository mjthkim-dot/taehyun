/**
 * Out-of-Corpus 평가 — 시드 밖 질문에서의 답변 품질 (8/27 인터뷰 대비)
 *
 * rag-eval이 "시드가 검색되는가"를 본다면, 이 테스트는 그 반대편 —
 * **검색이 빗나가거나 부분 적중일 때도 말할 수 있는 답이 나오는가**를 본다.
 *
 * 3계층 × 5문항, 계층별 자동 판정:
 *  A. 시드 변형   — 같은 의도·다른 표현. 시드가 검색·활용돼야 함(관련 근거 ≥1)
 *  B. 시드 인접   — 도메인은 맞지만 시드에 없는 주제. 무관 시드를 억지로
 *                   끼워넣지 않아야 함(관련성 컷) + 회피 없는 2안 생성
 *  C. 완전 이탈   — 시드 무관. 검색 0이어도 프로필 기반 자연 답변(회피 금지)
 *
 * 실행:  python3 tests/mock_gemini.py (또는 실 GEMINI_API_KEY) + 서버 기동 후
 *        npx tsx tests/ooc-eval.ts
 *        (node/실키 환경 공용 러너: python3 tests/ooc_eval.py — 같은 케이스를
 *         읽어 REPORT.md 13장 표를 실측값으로 갱신한다)
 */

const BASE = process.env.MC_BASE ?? "http://localhost:3799";

type Case = {
  tier: "A" | "B" | "C";
  q: string;
  intent?: string;
  /** A계층: top 근거에 이 중 하나가 있어야 통과 */
  expectSeed?: string[];
  note: string;
};

const CASES: Case[] = [
  // ── A. 시드 변형 (같은 의도, 다른 표현) ──
  { tier: "A", q: "Walk me through your background.",
    expectSeed: ["intro one-liner", "current role", "deal example"], note: "자기소개 변형" },
  { tier: "A", q: "What brings you here today?",
    expectSeed: ["why this company", "career move"], note: "지원 동기 변형" },
  { tier: "A", q: "How do you land new logos?",
    expectSeed: ["new business hunting", "cold outreach", "land and expand"], note: "신규 개척 변형" },
  { tier: "A", q: "How would you explain integration platforms to a beginner?",
    expectSeed: ["ipaas in one line", "enterprise integration"], note: "도메인 설명 변형" },
  { tier: "A", q: "What would you ask us about how the team works?",
    expectSeed: ["ask team structure", "ask team culture", "ask onboarding"], note: "역질문 유도 변형" },

  // ── B. 시드 인접 (도메인 맞음, 시드에 없는 주제) ──
  { tier: "B", q: "What's your experience with Salesforce integration specifically?",
    note: "구체 제품 경험 — 시드엔 일반 통합만 있음" },
  { tier: "B", q: "How do you handle a deal going dark after the proposal?",
    note: "고스팅 대응 — 시드에 없는 세일즈 상황" },
  { tier: "B", q: "What are your salary expectations for this position?",
    intent: "reply", note: "연봉 — salary deflect 시드가 잡히면 가점, 무관 시드 강제는 감점" },
  { tier: "B", q: "How do you split your time between hunting and account management?",
    note: "업무 배분 — 인접 주제" },
  { tier: "B", q: "Have you ever sold against an incumbent vendor with a locked-in contract?",
    note: "경쟁 대체 — 도메인 인접" },

  // ── C. 완전 이탈 (시드 무관) ──
  { tier: "C", q: "What do you do outside work for fun?", note: "취미" },
  { tier: "C", q: "Tell me about a time you failed at something.", note: "실패담 — loss lesson 시드가 잡히면 보너스" },
  { tier: "C", q: "Why are you leaving your current role right now?", note: "이직 사유" },
  { tier: "C", q: "How do your colleagues usually describe you?", note: "평판" },
  { tier: "C", q: "Where do you see yourself in five years?", note: "커리어 전망" },
];

const EVASIVE = /i'?m not sure|i don'?t know|hard to say|cannot answer|no idea/i;

// 구어체 검사(문장당 단어 수·미축약·금지어)는 speakability.ts의 규칙을 그대로 쓴다
import { speakProblems } from "./speakability.ts";

type Hit = { title: string; source_label: string; match_terms?: number; via?: string };

async function suggest(q: string, intent = "reply") {
  const res = await fetch(`${BASE}/api/suggest`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ said: q, intent, preset: "interview", cefr: "B1" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let meta: any = null, out = "";
  for (const ln of text.split("\n")) {
    try {
      const o = JSON.parse(ln);
      if (o.meta) meta = o.meta;
      else if (o.message) out += o.message.content ?? "";
    } catch { /* skip */ }
  }
  const en = [...out.matchAll(/EN:\s*(.+)/g)].map(m => m[1].trim());
  return { meta, en };
}

function judge(c: Case, meta: any, en: string[]) {
  const problems: string[] = [];
  if (en.length < 2) problems.push("2안 미생성");
  if (en.some(e => EVASIVE.test(e))) problems.push("회피성 답변");
  // 구어체 계약: 1안(Safe) 문장당 ≤9단어, 2안(Rich) ≤12단어 + 축약형·금지어
  en.slice(0, 2).forEach((e, i) =>
    speakProblems(e, i === 0 ? 9 : 12).forEach(p => problems.push(`${i + 1}안 ${p}`)));
  const srcs: string[] = meta?.sources ?? [];
  if (c.tier === "A") {
    const hitOk = c.expectSeed!.some(e => srcs.join(" ").toLowerCase().includes(e.toLowerCase()));
    if (!hitOk) problems.push(`기대 시드 미검색 (실제: ${srcs.join(", ") || "없음"})`);
  }
  if (c.tier === "C") {
    // 완전 이탈: 관련성 컷이 무관 시드를 걸러야 정상 (rag_used=false가 기본).
    // 단, 진짜 관련 시드(예: 실패담→loss lesson)가 잡힌 것은 통과로 본다.
    if (meta?.rag_used && !/loss lesson|career move|weakness/i.test(srcs.join(" ")))
      problems.push(`무관 시드 인용 의심: ${srcs.join(", ")}`);
  }
  return problems;
}

async function main() {
  let pass = 0;
  const rows: string[] = [];
  for (const c of CASES) {
    const { meta, en } = await suggest(c.q, c.intent);
    const problems = judge(c, meta, en);
    const ok = problems.length === 0;
    pass += ok ? 1 : 0;
    console.log(`${ok ? "✅" : "❌"} [${c.tier}] ${c.q}`);
    console.log(`   근거: ${(meta?.sources ?? []).join(" · ") || "(없음 → 프로필 폴백)"}`);
    en.slice(0, 2).forEach(e => console.log(`   EN: ${e}`));
    if (!ok) console.log(`   문제: ${problems.join("; ")}`);
    rows.push(`| ${c.tier} | ${c.q} | ${(meta?.sources ?? []).join("<br>") || "—"} | ${en.slice(0, 2).join("<br>")} | ${ok ? "✅" : "❌ " + problems.join("; ")} |`);
  }
  console.log(`\n결과: ${pass}/${CASES.length}`);
  process.exit(pass === CASES.length ? 0 : 1);
}

main();
