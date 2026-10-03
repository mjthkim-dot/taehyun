/**
 * AI 응답 방어 유틸 — "한국어로 설명하라"는 지시를 모델(llama)이 무시하고 영어로
 * 답하는 사고가 드릴 코칭에서 실제로 났다(v0.90.0에서 수정). 같은 방어를 모든 AI
 * 표면이 재사용할 수 있게 공용화한다:
 *   ① 응답 JSON을 안전하게 파싱하고(절단·비JSON이면 조용히 실패로 처리)
 *   ② 호출부가 준 검증 함수(pick)로 형태·언어를 확인한 뒤
 *   ③ 어긋나면 "한국어로 다시 쓰라"는 지시를 붙여 딱 한 번 다시 묻는다.
 * 그래도 실패하면 null — 호출부는 영어 덩어리 대신 한국어 실패 안내를 띄운다.
 * 네트워크·키 오류(GroqError)는 재시도 대상이 아니므로 그대로 던진다.
 */
import { groqComplete } from './groq';

export const HANGUL_RE = /[가-힣]/;

/** 문자열에 한글이 실제로 들어 있는가 — 한국어 기대 필드의 최소 검증 */
export function hasHangul(s: unknown): boolean {
  return typeof s === 'string' && HANGUL_RE.test(s);
}

/** 배열이고 모든 요소가 한글을 포함하는가 (빈 배열은 통과 여부를 호출부가 정한다) */
export function allHangul(arr: unknown): boolean {
  return Array.isArray(arr) && arr.every((s) => hasHangul(s));
}

const KO_RETRY_NUDGE =
  ' 직전 답변이 언어 규칙을 어겼다. 이번에는 한국어로 쓰라고 지정된 필드를 반드시 전부 한국어로만 작성하라.';

/** JSON.parse의 안전판 — 빈 문자열·절단·비JSON이면 null (throw하지 않는다) */
export function safeJson(raw: string): unknown {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * JSON 모드 완성 + 검증 + 1회 재시도.
 * pick은 파싱된 데이터에서 원하는 값을 꺼내되, 형태가 틀리거나 한국어여야 할 필드가
 * 영어면 null을 반환한다(= 이 응답은 못 쓴다). 두 번 다 실패하면 null.
 */
export async function groqKoJson<T>(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number },
  pick: (data: unknown) => T | null
): Promise<T | null> {
  const ask = (extraSys: string) => {
    const msgs = messages.map((m, i) =>
      i === 0 && m.role === 'system' ? { ...m, content: m.content + extraSys } : m
    );
    return groqComplete(msgs, { ...opts, json: true });
  };
  const first = pick(safeJson(await ask('')));
  if (first !== null) return first;
  return pick(safeJson(await ask(KO_RETRY_NUDGE)));
}

/**
 * 평문 완성 + 한국어 검증 + 1회 재시도 (숙제 추가 질문 등 JSON이 아닌 답변용).
 * 두 번 다 한글이 없으면 null.
 */
export async function groqKoText(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  const ask = (extraSys: string) => {
    const msgs = messages.map((m, i) =>
      i === 0 && m.role === 'system' ? { ...m, content: m.content + extraSys } : m
    );
    return groqComplete(msgs, opts);
  };
  const first = (await ask('')).trim();
  if (hasHangul(first)) return first;
  const second = (await ask(' 직전 답변이 영어였다. 반드시 한국어로 다시 답하라.')).trim();
  return hasHangul(second) ? second : null;
}

/** 사용자에게 보여줄 공통 실패 문구 — JS 원시 에러 대신 이걸 쓴다 */
export const AI_FAIL_KO = 'AI 응답을 만들지 못했어요 — 잠시 후 다시 시도해 주세요.';
