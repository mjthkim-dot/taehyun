'use client';

/**
 * 튜터 교차 세션 기억(P1-A) — 회화가 매번 초면으로 시작하지 않게 한다.
 * 세션 중 최근 대화 몇 턴을 스냅숏으로 남기고, 다음 세션의 시스템 프롬프트에
 * "지난 세션 기억"으로 주입한다. 최근 교정 2건도 함께 — 튜터가 같은 실수를
 * 이어서 봐줄 수 있게. 전부 로컬(localStorage), AI 추가 호출 없음.
 */
import { load, store } from './state';
import { getMistakes } from './transfer';

interface TutorMemory {
  date: string;
  /** "U: ..." / "A: ..." 형태의 마지막 몇 턴 */
  lines: string[];
}

const KEY = 'va_tutor_memory';
const MAX_LINES = 6;
const MAX_LINE_CHARS = 120;

/** 대화가 한 턴 진행될 때마다 호출 — 마지막 N턴을 덮어쓴다(가벼움 우선). */
export function saveTutorSnapshot(history: { role: string; content: string }[]) {
  const lines = history
    .filter((h) => h.role === 'user' || h.role === 'assistant')
    .slice(-MAX_LINES)
    .map((h) => `${h.role === 'user' ? 'U' : 'A'}: ${h.content.slice(0, MAX_LINE_CHARS)}`);
  if (!lines.length) return;
  store(KEY, { date: new Date().toISOString().slice(0, 10), lines } satisfies TutorMemory);
}

/** 시스템 프롬프트에 붙일 기억 블록 — 기억이 없으면 빈 문자열. */
export function tutorMemoryBlock(): string {
  const m = load<TutorMemory | null>(KEY, null);
  const parts: string[] = [];
  if (m && Array.isArray(m.lines) && m.lines.length) {
    parts.push(`[지난 세션 기억 (${m.date})]`, ...m.lines);
  }
  const recent = getMistakes().slice(-2);
  if (recent.length) {
    parts.push('[최근 교정받은 실수]', ...recent.map((x) => `"${x.wrong.slice(0, 60)}" → "${x.right.slice(0, 60)}"`));
  }
  if (!parts.length) return '';
  parts.push('위 기억은 참고용이다 — 자연스러울 때만 이어가고, 억지로 언급하지 마라.');
  return `\n\n${parts.join('\n')}`;
}
