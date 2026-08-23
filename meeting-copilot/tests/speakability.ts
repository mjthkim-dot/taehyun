/**
 * Speakability 평가기 — "읽는 영어"가 아니라 "말하는 영어"인지 자동 검사한다.
 *
 * 긴장한 비원어민이 즉시 입으로 뱉을 수 있어야 하므로(CEFR B1~B2 구어체),
 * 지시(프롬프트)만으로는 부족하고 검증으로 강제한다:
 *   1. 문장당 단어 수 ≤ 12 (생성 답변의 첫 문장은 ≤ 8 — 즉답 오프너)
 *   2. 축약 가능한데 안 한 표현 금지 (I am / do not / that is ...)
 *   3. 문어체·고급 어휘 금지어 검출 (utilize, furthermore, leverage ...)
 *
 * 실행:  npx tsx tests/speakability.ts     — 인터뷰 시드 70개 전수 검사
 *        (생성문 검사는 ooc-eval.ts / ooc_eval.py가 이 규칙을 가져다 쓴다.
 *         파이썬 러너는 아래 BANNED/UNCONTRACTED 배열을 그대로 파싱하므로
 *         목록은 반드시 이 파일 한 곳에서만 고칠 것)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** 문어체·고급 어휘 금지어 — 어간 매칭 (utiliz → utilize/utilizing/utilization) */
export const BANNED = [
  "utiliz", "facilitat", "furthermore", "moreover", "in addition",
  "elaborat", "trajector", "leverag", "demonstrat", "commenc",
  "acquir", "endeavor", "subsequent", "consequent", "nevertheless",
  "notwithstanding", "aforementioned", "paradigm", "entrepreneur",
  "differentiat", "methodolog", "henceforth", "prior to", "with regard to",
  "obtain", "possess", "aggregat", "expedit",
];

/** 축약해야 하는데 안 한 표현 — 소문자 어절 경계 매칭 */
export const UNCONTRACTED = [
  "i am", "i will", "i would", "do not", "does not", "did not",
  "is not", "are not", "was not", "were not", "cannot", "can not",
  "will not", "would not", "could not", "should not", "have not",
  "has not", "that is ", "it is ", "there is ", "they are ", "we are ",
];

const words = (s: string) =>
  s.split(/\s+/).filter(t => /[A-Za-z0-9]/.test(t));

/** 한 덩어리 발화(문장 여러 개 가능)의 speakability 위반 목록. cap=문장당 상한 */
export function speakProblems(text: string, cap = 12): string[] {
  const out: string[] = [];
  for (const sent of text.split(/(?<=[.!?])\s+/)) {
    const n = words(sent).length;
    if (n > cap) out.push(`${n}단어>${cap}: "${sent.trim()}"`);
  }
  const low = " " + text.toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ") + " ";
  for (const u of UNCONTRACTED) {
    if (low.includes(` ${u.trim()} `)) out.push(`미축약: "${u.trim()}"`);
  }
  for (const b of BANNED) {
    const re = b.includes(" ") ? ` ${b} ` : ` ${b}`;
    if (low.includes(re)) out.push(`금지어: "${b}"`);
  }
  return out;
}

// ── 시드 전수 검사 (직접 실행 시) ──
async function main() {
  const dir = dirname(fileURLToPath(import.meta.url));
  const seeds = JSON.parse(
    readFileSync(join(dir, "..", "backend", "data", "interview-corpus.json"), "utf-8"));
  let bad = 0;
  for (const s of seeds) {
    const ps = speakProblems(s.say, 12);
    if (ps.length) { bad++; console.log(`❌ [${s.term}] ${s.say}\n   ${ps.join("; ")}`); }
  }
  console.log(`\n시드 ${seeds.length}개 중 위반 ${bad}개 ${bad === 0 ? "✅" : "❌"}`);
  process.exit(bad === 0 ? 0 : 1);
}

if (process.argv[1] && process.argv[1].includes("speakability")) main();
