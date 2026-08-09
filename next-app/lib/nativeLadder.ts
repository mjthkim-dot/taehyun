/**
 * 원어민 사다리 — 한 문장을 [기본 → 자연스럽게 → 원어민] 3단으로 다시 쓰고,
 * 각 단을 말하기로 통과해야 다음 단이 열린다. "정확한 문장"에서 멈추지 않고
 * 원어민이 실제로 쓰는 축약·구동사·관용 표현까지 단계적으로 성숙해 가는 훈련.
 *
 * 생성물은 문장별로 캐시한다(같은 문장을 다시 올릴 때 토큰을 아끼고, 오프라인
 * 재방문도 된다). aiGuard 검증을 통과한 것만 캐시에 넣는다 — 영어 노트나
 * 한글 섞인 영어 문장이 박제되면 지울 방법이 없다.
 */
import { groqKoJson, hasHangul } from './aiGuard';
import { load, store } from './state';
import type { Cefr } from './lessons';

export interface LadderRung {
  /** 단 이름 — 기본 / 자연스럽게 / 원어민 */
  level: string;
  en: string;
  kr: string;
  /** 이전 단과 무엇이 달라졌는지 — 한국어 한 줄 */
  note: string;
}

export interface Ladder {
  seed: string;
  rungs: LadderRung[]; // 항상 3개
}

const CACHE_KEY = 'va_ladder_cache';
const CACHE_MAX = 60;
const LEVELS = ['기본', '자연스럽게', '원어민'] as const;

function cacheId(seed: string): string {
  return seed.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCachedLadder(seed: string): Ladder | null {
  return load<Record<string, Ladder>>(CACHE_KEY, {})[cacheId(seed)] || null;
}

function saveLadder(l: Ladder) {
  const cache = load<Record<string, Ladder>>(CACHE_KEY, {});
  cache[cacheId(l.seed)] = l;
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX) keys.slice(0, keys.length - CACHE_MAX).forEach((k) => delete cache[k]);
  store(CACHE_KEY, cache);
}

const SYS = [
  '너는 한국인 학습자를 원어민처럼 말하게 이끄는 비즈니스 영어 코치다.',
  '주어진 문장(또는 한국어로 쓴 하고 싶은 말)을 같은 의미의 영어 3단계로 다시 쓴다. JSON으로만 답한다:',
  '{ "rungs": [',
  ' {"level":"기본","en":"교과서식이지만 정확한 문장","kr":"한국어 뜻","note":"이 단계의 특징 (한국어 한 줄)"},',
  ' {"level":"자연스럽게","en":"원어민이 일상 업무에서 실제로 말하는 구어체 — 축약형(I\'d, can\'t 등)을 살린다","kr":"한국어 뜻","note":"기본 단계에서 무엇이 더 자연스러워졌는지 (한국어)"},',
  ' {"level":"원어민","en":"원어민이 동료에게 말하듯 구동사·관용 표현을 살린 문장","kr":"한국어 뜻","note":"쓰인 관용 표현과 뉘앙스 (한국어)"}',
  '] }',
  '규칙:',
  '- en은 영어로만 쓴다(한글 금지). 각 20단어 이하, 소리 내어 말하기 좋게.',
  '- kr과 note는 반드시 한국어.',
  '- 세 단계 모두 의미는 같아야 한다. 단계가 오를수록 길어지는 게 아니라 자연스러워져야 한다.',
  '- 학습자의 CEFR 레벨이 주어지면 "기본" 단을 그 레벨에 맞춘다.',
].join('\n');

/** 사다리 생성 — 캐시 우선, 없으면 AI 생성(검증 통과분만 캐시). 실패 시 null. */
export async function generateLadder(seed: string, cefr: Cefr): Promise<Ladder | null> {
  const cached = getCachedLadder(seed);
  if (cached) return cached;
  const ladder = await groqKoJson<Ladder>(
    [
      { role: 'system', content: SYS },
      { role: 'user', content: `학습자 CEFR: ${cefr}\n문장: "${seed.trim()}"\n이 문장의 3단계 사다리를 만들어줘.` },
    ],
    { temperature: 0.5, maxTokens: 700 },
    (data) => {
      const o = (data ?? {}) as { rungs?: Partial<LadderRung>[] };
      if (!Array.isArray(o.rungs) || o.rungs.length < 3) return null;
      const rungs = o.rungs.slice(0, 3).map((r, i) => ({
        level: LEVELS[i],
        en: String(r?.en || '').trim(),
        kr: String(r?.kr || '').trim(),
        note: String(r?.note || '').trim(),
      }));
      // en에 한글이 섞였거나(설명을 문장에 쓴 경우) 비었으면, note/kr이 영어면 버린다
      if (rungs.some((r) => !r.en || hasHangul(r.en))) return null;
      if (rungs.some((r) => !hasHangul(r.kr) || !hasHangul(r.note))) return null;
      // 세 단이 전부 같은 문장이면 사다리가 아니다
      if (new Set(rungs.map((r) => r.en.toLowerCase())).size < 2) return null;
      return { seed: seed.trim(), rungs };
    }
  );
  if (ladder) saveLadder(ladder);
  return ladder;
}

/* ── 진행 기록 — 어떤 문장을 어디까지 올랐는지. 완주한 사다리 수가 성숙의 지표다. */
const PROG_KEY = 'va_ladder_done';

export function ladderDoneCount(): number {
  return load<string[]>(PROG_KEY, []).length;
}

export function markLadderDone(seed: string) {
  const done = load<string[]>(PROG_KEY, []);
  const id = cacheId(seed);
  if (!done.includes(id)) store(PROG_KEY, [...done, id].slice(-200));
}
