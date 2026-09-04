'use client';

/**
 * 습관 공학(듀오링고 벤치마크 접목) — 스트릭 프리즈 · 데일리 퀘스트 · XP.
 *
 * 프리즈: 미션을 완료한 날이 3일 쌓일 때마다 1개 적립(최대 2개). 하루를
 * 놓치면 앱을 연 시점에 자동으로 소모돼 그 날짜를 학습일로 메워 스트릭을
 * 지킨다("실수 한 번 = 이탈"을 막는 검증된 리텐션 장치).
 *
 * 퀘스트: 오늘 할 일 3개(미션 완주 · 문장 20개 연습 · 복습 5개)를 기존
 * 데이터로 계산만 한다 — 새 인프라 없음. 달성 시 XP 적립, 주간 XP 그래프.
 */
import { load, store, dueWeak, spokenToday, DAILY_GOAL } from './state';
import { isMissionDoneToday } from './dailyMission';

export const FREEZE_MAX = 2;
/** 미션 완료일 N일마다 프리즈 1개 적립 */
export const FREEZE_EARN_EVERY = 3;

const FREEZE_KEY = 'va_freeze'; // { count, earnedFor }
const FROZEN_DAYS_KEY = 'va_frozen_days'; // 프리즈로 메운 날짜들(표시용)
const MISSION_DAYS_KEY = 'va_mission_days'; // 미션을 완료한 날짜들
const XP_KEY = 'va_xp'; // Record<YYYY-MM-DD, number>
const AWARD_KEY = 'va_quests_awarded'; // { date, ids: string[] }

function dstr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface FreezeState {
  count: number;
  /** 지금까지 적립 판정에 사용한 (미션일수 / 3)의 몫 — 중복 적립 방지 */
  earnedFor: number;
}

function loadFreeze(): FreezeState {
  const f = load<Partial<FreezeState>>(FREEZE_KEY, {});
  return { count: Math.min(Math.max(Number(f.count) || 0, 0), FREEZE_MAX), earnedFor: Number(f.earnedFor) || 0 };
}

export function getFreezeCount(): number {
  return loadFreeze().count;
}

/** 미션 완료일 기록 + 3일마다 프리즈 적립. 이번에 적립됐으면 true. */
export function recordMissionDay(): boolean {
  const today = dstr(new Date());
  const days = load<string[]>(MISSION_DAYS_KEY, []);
  if (!days.includes(today)) {
    days.push(today);
    store(MISSION_DAYS_KEY, days.slice(-400));
  }
  const f = loadFreeze();
  const eligible = Math.floor(days.length / FREEZE_EARN_EVERY);
  let earned = false;
  if (eligible > f.earnedFor) {
    if (f.count < FREEZE_MAX) {
      f.count += 1;
      earned = true;
    }
    f.earnedFor = eligible;
    store(FREEZE_KEY, f);
  }
  return earned;
}

/**
 * 앱을 열 때 호출 — 어제까지의 공백일을 프리즈로 메워 스트릭을 보호한다.
 * 메운 날짜 배열을 반환(비어 있으면 소모 없음). 학습 이력이 없으면 아무것도 안 한다.
 */
export function consumeFreezesForGaps(): string[] {
  const daysArr = load<string[]>('va_days', []);
  if (!daysArr.length) return [];
  const f = loadFreeze();
  if (f.count <= 0) return [];
  const days = new Set(daysArr);
  const earliest = [...daysArr].sort()[0];
  const filled: string[] = [];
  const cur = new Date();
  cur.setDate(cur.getDate() - 1); // 오늘은 아직 기회가 있으니 어제부터 검사
  while (f.count > 0) {
    const ds = dstr(cur);
    if (ds < earliest) break; // 학습 시작 이전까지 갔으면 중단
    if (days.has(ds)) break; // 연속 구간에 닿았으면 끝 — 스트릭 연결 완료
    f.count -= 1;
    filled.push(ds);
    days.add(ds);
    cur.setDate(cur.getDate() - 1);
  }
  if (filled.length) {
    store('va_days', [...days].sort());
    const frozen = load<string[]>(FROZEN_DAYS_KEY, []);
    store(FROZEN_DAYS_KEY, [...frozen, ...filled].slice(-60));
    store(FREEZE_KEY, f);
  }
  return filled;
}

/* ── 데일리 퀘스트 + XP ── */
export interface Quest {
  id: string;
  label: string;
  progress: number;
  goal: number;
  done: boolean;
  xp: number;
  /** 목표가 오늘 성립하지 않을 때의 보조 설명(예: 복습 카드 없음) */
  note?: string;
}

const REVIEW_GOAL = 5;

export function getQuests(): Quest[] {
  const today = dstr(new Date());
  const rv = load<{ date: string; count: number }>('va_review_today', { date: '', count: 0 });
  const reviewCount = rv.date === today ? rv.count : 0;
  const due = dueWeak().length;
  const spoken = spokenToday();
  const missionDone = isMissionDoneToday();
  // 복습 카드가 아예 없는 날은 목표가 성립하지 않으므로 자동 달성으로 처리(정직하게 표기)
  const reviewAutoDone = due === 0 && reviewCount === 0;
  return [
    { id: 'mission', label: '오늘의 미션 완주', progress: missionDone ? 1 : 0, goal: 1, done: missionDone, xp: 50 },
    { id: 'practice', label: `문장 ${DAILY_GOAL}개 소리 내어 말하기`, progress: Math.min(spoken, DAILY_GOAL), goal: DAILY_GOAL, done: spoken >= DAILY_GOAL, xp: 30 },
    {
      id: 'review',
      label: `복습 카드 ${REVIEW_GOAL}개 채점`,
      progress: Math.min(reviewCount, REVIEW_GOAL),
      goal: REVIEW_GOAL,
      done: reviewCount >= REVIEW_GOAL || reviewAutoDone,
      xp: 20,
      note: reviewAutoDone ? '오늘은 복습할 카드가 없어요 — 자동 달성' : undefined,
    },
  ];
}

/** 새로 달성된 퀘스트의 XP를 적립한다(하루 1회씩만). 오늘 총 XP를 반환. */
export function awardQuestXp(): number {
  const today = dstr(new Date());
  const awarded = load<{ date: string; ids: string[] }>(AWARD_KEY, { date: today, ids: [] });
  const ids = awarded.date === today ? [...awarded.ids] : [];
  const xpMap = load<Record<string, number>>(XP_KEY, {});
  let changed = false;
  for (const q of getQuests()) {
    if (q.done && !ids.includes(q.id)) {
      ids.push(q.id);
      xpMap[today] = (xpMap[today] || 0) + q.xp;
      changed = true;
    }
  }
  if (changed) {
    // XP 맵은 최근 30일만 유지
    const keys = Object.keys(xpMap).sort();
    keys.slice(0, Math.max(0, keys.length - 30)).forEach((k) => delete xpMap[k]);
    store(XP_KEY, xpMap);
    store(AWARD_KEY, { date: today, ids });
  }
  return xpMap[today] || 0;
}

export function todayXp(): number {
  return load<Record<string, number>>(XP_KEY, {})[dstr(new Date())] || 0;
}

/** 최근 7일 XP — 주간 그래프용. */
export function weeklyXp(): { label: string; xp: number; today: boolean }[] {
  const xpMap = load<Record<string, number>>(XP_KEY, {});
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  const out: { label: string; xp: number; today: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ label: names[d.getDay()], xp: xpMap[dstr(d)] || 0, today: i === 0 });
  }
  return out;
}
