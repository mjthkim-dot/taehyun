/**
 * 단어 뜻 즉답 — "대화에 모르는 단어가 너무 많다"에 대한 답.
 * 회화 말풍선의 아무 단어나 탭하면 문맥 속 한국어 뜻을 바로 보여준다.
 * 한 번 찾은 단어는 기기에 캐시된다(같은 단어를 다시 찾을 때 즉시·무료).
 */
import { groqKoJson, hasHangul } from './aiGuard';
import { load, store } from './state';

const CACHE_KEY = 'va_gloss_cache';
const CACHE_MAX = 300;

export interface Gloss {
  ko: string;
}

function norm(word: string): string {
  return word.toLowerCase().replace(/[^a-z'-]/g, '');
}

export function cachedGloss(word: string): string | null {
  return load<Record<string, string>>(CACHE_KEY, {})[norm(word)] || null;
}

function saveGloss(word: string, ko: string) {
  const cache = load<Record<string, string>>(CACHE_KEY, {});
  cache[norm(word)] = ko;
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX) keys.slice(0, keys.length - CACHE_MAX).forEach((k) => delete cache[k]);
  store(CACHE_KEY, cache);
}

/** 문맥 속 단어 뜻 — 캐시 우선, 없으면 AI(한국어 검증 + 1회 재시도). 실패 시 null. */
export async function fetchGloss(word: string, sentence: string): Promise<string | null> {
  const w = norm(word);
  if (!w) return null;
  const hit = cachedGloss(w);
  if (hit) return hit;
  const g = await groqKoJson<Gloss>(
    [
      {
        role: 'system',
        content: '너는 한국인 학습자를 위한 영어 사전이다. 주어진 문장 속 단어의 뜻을 JSON으로만 답한다: {"ko":"그 문맥에서의 한국어 뜻 (5단어 이내, 품사 표시 없이 간결히)"}',
      },
      { role: 'user', content: `문장: "${sentence}"\n단어: "${word}"` },
    ],
    { temperature: 0.2, maxTokens: 80 },
    (data) => {
      const o = data as { ko?: unknown } | null;
      if (!o || !hasHangul(o.ko)) return null;
      return { ko: String(o.ko).trim() };
    }
  );
  if (!g) return null;
  saveGloss(w, g.ko);
  return g.ko;
}
