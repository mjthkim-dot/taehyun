/**
 * 오늘의 세션 — "어디서부터 뭘 해야 할지 막막하다"에 대한 답.
 *
 * 홈의 버튼 하나로 시작하는 10분 가이드 코스. 무엇을 할지 고르지 않는다 —
 * 복습(워밍업) → 오늘의 패턴 스토리(장면으로 배우기) → 말하기 2단(기본→원어민)
 * → 실전 리콜(상황만 듣고 떠올려 말하기) 순서로 알아서 이어진다.
 *
 * 오늘의 패턴은 성숙도 커리큘럼에서 자동으로 고른다(현재 단계의 미정착 패턴
 * 우선). 세션을 완주하면 패턴 정착 + 사다리 완주로 기록돼 자동 승급의 재료가
 * 된다. 콘텐츠는 전부 정적(patternStories) — AI 없이도 매일 완주 가능하다.
 */
import { load, store, dueWeak } from './state';
import { donePatterns, STAGE_PATTERNS, type NativePattern } from './maturity';
import { storiesNow } from './storyData';
import type { PatternStory } from './patternStories';

const DONE_KEY = 'va_session_last';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sessionDoneToday(): boolean {
  return load<string>(DONE_KEY, '') === todayStr();
}

export function markSessionDone() {
  store(DONE_KEY, todayStr());
}

/** 현재 성숙도 단계에서 오늘 배울 패턴을 고른다 — 미정착 우선이되 **날짜로
 *  로테이션**한다(같은 날엔 같은 패턴, 다음 날엔 다른 패턴). 예전엔 미정착 중
 *  항상 첫 번째(fresh[0])를 골라서, 세션을 완주하지 않으면 매일 같은
 *  "I'd like..."가 떠 "맨날 똑같다"는 정확한 불만을 만들었다. 정착 못 해도
 *  내일은 다른 패턴을 만나고, 못 끝낸 패턴은 로테이션이 다시 데려온다.
 *  전부 정착했으면 같은 방식으로 복습을 돌린다. */
export function pickTodayPattern(stageN: number): { pattern: NativePattern; story: PatternStory; isReview: boolean } | null {
  const stories = storiesNow();
  const patterns = STAGE_PATTERNS[stageN] || [];
  if (!patterns.length) return null;
  const done = donePatterns();
  const daySeed = Number(todayStr().replace(/-/g, ''));
  const fresh = patterns.filter((p) => !done.includes(p.key) && stories[p.key]);
  if (fresh.length) {
    const pick = fresh[daySeed % fresh.length];
    return { pattern: pick, story: stories[pick.key], isReview: false };
  }
  // 전부 정착 — 날짜 시드로 하나 골라 복습
  const withStory = patterns.filter((p) => stories[p.key]);
  if (!withStory.length) return null;
  const pick = withStory[daySeed % withStory.length];
  return { pattern: pick, story: stories[pick.key], isReview: true };
}

/** 워밍업 문장 — 오늘 복습할 SRS 항목 최대 2개(영어 있는 것만).
 *  @deprecated 세션은 reviewEngine.dueReviews()를 쓴다(패턴 리콜까지 통합). */
export function warmupItems(): { en: string; kr: string }[] {
  return dueWeak()
    .filter((w) => w.en && w.en.trim())
    .slice(0, 2)
    .map((w) => ({ en: w.en, kr: w.kr || '' }));
}
