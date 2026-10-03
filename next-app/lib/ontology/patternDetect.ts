/**
 * 표현 → 패턴 자동 감지.
 *
 * 성숙도 커리큘럼의 패턴 40개는 "I'd like to ...", "circle back"처럼 템플릿 문자열로
 * 정의돼 있다. 코스·미션·스크립트의 문장 수백 개에 어떤 패턴이 들어 있는지 사람이
 * 태깅하는 대신, 템플릿을 정규식으로 바꿔 문장에서 찾는다. 그래서 "비용 리뷰"
 * 시나리오의 "Let me get back to you on that."이 자동으로 get-back 패턴의 실전
 * 예문이 되고, 세션에서 배운 패턴이 실제로 어느 상황에 쓰이는지가 그래프에 남는다.
 */
import { STAGE_PATTERNS } from '../maturity';

/** 템플릿으로 못 만드는 것들만 손으로 */
const OVERRIDES: Record<string, RegExp> = {
  // 완충의 kind of만("feels kind of tight") — "what kind of budget"의 명사 용법은 제외
  'kind-of': /\b(feels?|is|was|seems?|looks?|sounds?|'s|’s|are|were|be|being|still)\s+(kind of|a bit|a little bit|sort of)\b/i,
  'worth-ing': /\bworth \w+ing\b/i,
  'in-the-loop': /\bin the loop\b/i,
  'i-hear-you': /\bI hear you\b/i,
  'where-land': /\bwhere (do|did) we land\b/i,
  'wouldnt-say': /\bI wouldn['’]t say\b/i,
  'being-honest': /\b(if I['’]m being honest|to be honest|honestly speaking)\b/i,
  'happy-to': /\b(happy|glad) to\b/i,
  'looking-to': /\b(we['’]re|I['’]m|are|am) looking to\b/i,
  'im-afraid': /\bI['’]m afraid\b/i,
  'didnt-catch': /\b(didn['’]t|did not) catch\b/i,
  'follow-up-on': /\bfollow(ing)? up\b/i,
  'ballpark': /\bballpark\b/i,
  'low-hanging': /\blow[- ]hanging\b/i,
  'ball-rolling': /\bball rolling\b/i,
  'move-needle': /\bmove(s|d)? the needle\b/i,
  'circle-back': /\bcircle back\b/i,
  'touch-base': /\btouch base\b/i,
  'reach-out': /\breach(ed|ing)? out\b/i,
  'sort-out': /\bsort(ed|ing)? (it |that |this |things )?out\b/i,
  'put-together': /\bput(ting)? (it |that |this |something |a \w+ )?together\b/i,
  'run-through': /\brun(ning)? (you |us |them )?through\b/i,
  // "go over the terms"(검토)만 — "goes over the internet"(경유)은 제외
  'go-over': /\b(go|going|went|gone) over (the|this|that|it|our|your|a|an|some|each|what|everything)\b/i,
  'touch-on': /\btouch(ed|ing)? on\b/i,
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "I'd like to ..." → /\bI['’]d like to\b/i */
function fromTemplate(en: string): RegExp {
  const core = en
    .replace(/\.\.\./g, ' ')
    .replace(/[?,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const src = escapeRe(core).replace(/['’]/g, "['’]").replace(/ /g, '\\s+');
  return new RegExp(`\\b${src}\\b`, 'i');
}

let cache: { key: string; re: RegExp }[] | null = null;

export function patternMatchers(): { key: string; re: RegExp }[] {
  if (cache) return cache;
  const out: { key: string; re: RegExp }[] = [];
  for (const list of Object.values(STAGE_PATTERNS)) {
    for (const p of list) out.push({ key: p.key, re: OVERRIDES[p.key] || fromTemplate(p.en) });
  }
  cache = out;
  return out;
}

/** 문장에 들어 있는 패턴 키 목록 */
export function detectPatterns(en: string): string[] {
  const hits: string[] = [];
  for (const m of patternMatchers()) if (m.re.test(en)) hits.push(m.key);
  return hits;
}
