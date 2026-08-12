/**
 * 오디오 모드 재생목록 — "출퇴근하며 듣기만으로 오늘 복습".
 * 앱은 출력(말하기) 편중이었다 — 입력(듣기) 총량을 공짜 시간에 채우는 통로.
 *
 * 재료(전부 로컬, AI 호출 없음):
 *   ① 오늘 패턴 스토리의 대화 전체
 *   ② 오늘 복습(due) SRS 문장
 *   ③ 최근 정착한 패턴들의 원어민 문장
 * 영어 → 한국어 뜻 순서로 읽는다(뜻이 바로 따라와야 귀가 산다).
 */
import { dueWeak } from './state';
import { donePatterns } from './maturity';
import { PATTERN_STORIES } from './patternStories';
import { computeMaturity } from './maturity';
import { pickTodayPattern } from './session';

export interface AudioItem {
  en: string;
  kr: string;
  /** 어디서 온 문장인가 — 화면 표시용 */
  tag: string;
}

const MAX_ITEMS = 20;

export function buildPlaylist(): AudioItem[] {
  const out: AudioItem[] = [];
  const seen = new Set<string>();
  const push = (en: string, kr: string, tag: string) => {
    const k = en.trim().toLowerCase();
    if (!en.trim() || seen.has(k) || out.length >= MAX_ITEMS) return;
    seen.add(k);
    out.push({ en: en.trim(), kr: (kr || '').trim(), tag });
  };

  // ① 오늘의 패턴 스토리 — 대화 + 원어민 문장
  const picked = pickTodayPattern(computeMaturity().stage.n);
  if (picked) {
    for (const l of picked.story.dialogue) push(l.en, l.kr, '오늘의 패턴');
    push(picked.story.speak.native.en, picked.story.speak.native.kr, '오늘의 패턴');
  }

  // ② 오늘 복습할 SRS 문장
  for (const w of dueWeak()) push(w.en, w.kr || '', '복습');

  // ③ 최근 정착 패턴들의 원어민 문장 (최신 5개)
  for (const key of donePatterns().slice(-5).reverse()) {
    const story = PATTERN_STORIES[key];
    if (story) push(story.speak.native.en, story.speak.native.kr, '정착 패턴');
  }

  return out;
}
