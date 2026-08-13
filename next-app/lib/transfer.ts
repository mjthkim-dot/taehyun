/**
 * 전이(transfer) 계층 — 배운 패턴이 진짜 대화에서 나오는지 추적한다 (PLAN.md D5).
 *
 * 판정은 AI가 아니라 결정적 문자열 매칭(stem)이다: 오탐이 없고 테스트 가능하며,
 * 오프라인에서도 돈다. stem은 패턴 콘텐츠와 분리해 여기 두어 기존 데이터/콘텐츠를
 * 건드리지 않는다.
 *
 * 함께: 회화 배경 교정에서 틀린 문장을 축적(va_mistakes)해 "자주 틀리는 패턴 →
 * 드릴로" 맞춤 훈련의 재료로 쓴다.
 */
import { load, store } from './state';
import { donePatterns } from './maturity';

/* ── 패턴 사용 감지 ── */

/** 패턴 키 → 대화에서 그 패턴이 쓰였다고 볼 소문자 매칭 문자열들 */
export const PATTERN_STEMS: Record<string, string[]> = {
  'id-like': ["i'd like to", 'i would like to'],
  'could-you': ['could you'],
  'get-back': ['get back to you'],
  'didnt-catch': ["didn't catch", 'did not catch'],
  'just-to-confirm': ['just to confirm'],
  'that-works': ['works for me'],
  'im-afraid': ["i'm afraid", 'i am afraid'],
  'thanks-time': ['thanks for your time', 'thank you for your time'],
  'looking-to': ['looking to'],
  'turns-out': ['turns out'],
  'thing-is': ['the thing is'],
  'wondering-if': ['wondering if'],
  'do-you-mind': ['do you mind if'],
  'kind-of': ['a bit ', 'kind of '],
  'touch-base': ['touch base'],
  'how-sound': ['how does that sound'],
  'run-through': ['run through'],
  'go-over': ['go over'],
  'follow-up-on': ['follow up on', 'following up on'],
  'sort-out': ['sort out', 'sort it out', 'sort this out'],
  'put-together': ['put together'],
  'reach-out': ['reach out'],
  'that-said': ['that said'],
  'moving-forward': ['moving forward'],
  'circle-back': ['circle back'],
  'touch-on': ['touch on'],
  'same-page': ['same page'],
  ballpark: ['ballpark'],
  'move-needle': ['move the needle'],
  'low-hanging': ['low-hanging fruit', 'low hanging fruit'],
  'ball-rolling': ['ball rolling'],
  'in-the-loop': ['in the loop'],
  'i-hear-you': ['i hear you'],
  'to-be-fair': ['to be fair'],
  'wouldnt-say': ["i wouldn't say", 'i would not say'],
  'worth-ing': ['might be worth'],
  'being-honest': ['being honest'],
  'fair-point': ['fair point'],
  'where-land': ['where do we land'],
  'happy-to': ['happy to'],
};

/** 발화에서 학습한 패턴의 사용을 찾는다 — 배운 것(정착 + 추가 후보)만 대상. */
export function detectPatternUse(utterance: string, extraKeys: string[] = []): string[] {
  const text = ` ${utterance.toLowerCase().replace(/\s+/g, ' ')} `;
  const candidates = new Set([...donePatterns(), ...extraKeys]);
  const hits: string[] = [];
  for (const key of candidates) {
    const stems = PATTERN_STEMS[key];
    if (stems && stems.some((s) => text.includes(s))) hits.push(key);
  }
  return hits;
}

/* ── 실전 사용 기록 ── */

const USE_KEY = 'va_pattern_use';

export function recordPatternUse(key: string) {
  const use = load<Record<string, number>>(USE_KEY, {});
  use[key] = (use[key] || 0) + 1;
  store(USE_KEY, use);
}

export function patternUseTotal(): number {
  return Object.values(load<Record<string, number>>(USE_KEY, {})).reduce((a, b) => a + b, 0);
}

export function patternUseMap(): Record<string, number> {
  return load<Record<string, number>>(USE_KEY, {});
}

/* ── 교정 축적 — 자주 틀리는 문장 ── */

export interface Mistake {
  /** 내가 말한 문장(틀린 형태) */
  wrong: string;
  /** 고친 문장 */
  right: string;
  /** 왜 — 한국어 피드백 */
  note: string;
  t: number;
  /** 오류 유형 — AI 교정이 분류한다(없으면 other). 약점 해상도를 높이는 태그. */
  type?: MistakeType;
}

export type MistakeType = 'tense' | 'article' | 'preposition' | 'word-order' | 'word-choice' | 'other';

export const MISTAKE_TYPE_LABEL: Record<string, string> = {
  tense: '시제',
  article: '관사',
  preposition: '전치사',
  'word-order': '어순',
  'word-choice': '단어 선택',
  other: '기타',
};

/** 모델 응답의 유형 문자열을 알려진 집합으로 정규화 — 모르는 값은 other */
export function sanitizeMistakeType(v: unknown): MistakeType {
  const s = String(v || '').toLowerCase().trim();
  const known: readonly string[] = ['tense', 'article', 'preposition', 'word-order', 'word-choice'];
  return known.includes(s) ? (s as MistakeType) : 'other';
}

/** 유형별 누적 — 약점 카드용(많은 순) */
export function mistakeTypeCounts(): { type: string; count: number }[] {
  const agg = new Map<string, number>();
  for (const m of getMistakes()) {
    const t = m.type || 'other';
    agg.set(t, (agg.get(t) || 0) + 1);
  }
  return [...agg.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
}

const MISTAKE_KEY = 'va_mistakes';
const MISTAKE_MAX = 200;

export function recordMistake(m: Mistake) {
  const list = load<Mistake[]>(MISTAKE_KEY, []);
  // 같은 교정문이 반복되면 최신 것만 남긴다(누적 수는 대시보드가 로그 길이로 본다)
  list.push(m);
  store(MISTAKE_KEY, list.length > MISTAKE_MAX ? list.slice(list.length - MISTAKE_MAX) : list);
}

export function getMistakes(): Mistake[] {
  return load<Mistake[]>(MISTAKE_KEY, []);
}

/** 특정 유형의 교정만 드릴 큐로 — 유형이 5건 이상 쌓이면 집중 훈련이 열린다. */
export function mistakesForDrillByType(type: string, max = 6): { en: string; kr: string }[] {
  const seen = new Set<string>();
  const out: { en: string; kr: string }[] = [];
  for (const m of getMistakes().slice().reverse()) {
    if ((m.type || 'other') !== type) continue;
    if (!m.right || seen.has(m.right)) continue;
    seen.add(m.right);
    out.push({ en: m.right, kr: m.note || '' });
    if (out.length >= max) break;
  }
  return out;
}

/** 최근 교정 N건을 드릴 큐 항목으로 — "고친 문장"을 소리 내어 말하는 훈련. */
export function mistakesForDrill(max = 5): { en: string; kr: string }[] {
  const seen = new Set<string>();
  const out: { en: string; kr: string }[] = [];
  for (const m of getMistakes().slice().reverse()) {
    if (!m.right || seen.has(m.right)) continue;
    seen.add(m.right);
    out.push({ en: m.right, kr: m.note || '' });
    if (out.length >= max) break;
  }
  return out;
}
