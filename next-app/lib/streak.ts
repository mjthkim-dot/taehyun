'use client';

/**
 * 불꽃(스트릭) — 스픽 벤치마크의 핵심 리텐션 장치.
 *
 * 지금까지 스트릭은 헤더 구석의 "🔥 12" 칩이었다. 스픽이 증명한 구조는 반대다:
 * 불꽃이 홈의 주인공이고, **발화가 불을 붙인다**. 문장을 소리 내어 말한 수가
 * 오늘 목표에 닿는 순간 불이 켜지고, 그 순간을 화면이 축하한다. 사용자는
 * "오늘 불을 붙였는가"라는 단 하나의 질문으로 앱에 돌아온다.
 *
 * 의미 규칙(기존 데이터와 호환):
 *   · 스트릭 일수 자체는 기존 그대로 — 아무 연습이든 한 날(va_days)이 이어지면 유지
 *   · 불꽃의 '점화'는 더 엄격하다 — 오늘 발화 수가 목표(dailyGoal)에 닿아야 활활
 *   · 연습은 했지만 발화 목표 전이면 '깜빡이는 불씨' — 스트릭은 지켜지지만
 *     화면이 "조금 더"를 유도한다
 *
 * 마일스톤(3·7·14·30·50·100·200·365일)은 하루 한 번만 축하한다 — 매번 뜨면
 * 축하가 아니라 소음이다.
 */
import { load, store, calcStreak, spokenToday, dailyGoal } from './state';

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365] as const;

const CELEBRATED_KEY = 'va_streak_celebrated'; // 마지막으로 축하한 마일스톤 값

function dstr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type FlameLevel = 'off' | 'ember' | 'lit';

export interface FlameState {
  streak: number;
  /** 오늘 소리 내어 말한 문장 수 */
  spoken: number;
  goal: number;
  /** off: 오늘 아무것도 안 함 · ember: 연습은 했지만 발화 목표 전 · lit: 발화 목표 달성 */
  level: FlameLevel;
  /** 다음 마일스톤(이미 최고면 null) */
  nextMilestone: number | null;
}

export function flameState(): FlameState {
  const streak = calcStreak();
  const spoken = spokenToday();
  const goal = dailyGoal();
  const today = dstr(new Date());
  const practiced = load<string[]>('va_days', []).includes(today);
  const level: FlameLevel = spoken >= goal ? 'lit' : practiced || spoken > 0 ? 'ember' : 'off';
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) ?? null;
  return { streak, spoken, goal, level, nextMilestone };
}

export type DayFlame = 'lit' | 'frozen' | 'missed' | 'today' | 'before';

export interface WeekDay {
  label: string;
  state: DayFlame;
}

/**
 * 이번 주 7칸 불꽃 달력(월~일). 스픽·듀오링고가 같은 형태를 쓰는 이유는
 * "이번 주 구멍"이 눈에 보이는 것만으로 오늘 학습 확률이 올라가기 때문이다.
 */
export function weekFlames(): WeekDay[] {
  const days = new Set(load<string[]>('va_days', []));
  const frozen = new Set(load<string[]>('va_frozen_days', []));
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();
  // 월요일 시작 주
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const out: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = dstr(d);
    const todayStr = dstr(now);
    let state: DayFlame;
    if (ds === todayStr) state = 'today';
    else if (ds > todayStr) state = 'before';
    else if (frozen.has(ds)) state = 'frozen';
    else if (days.has(ds)) state = 'lit';
    else state = 'missed';
    out.push({ label: names[d.getDay()], state });
  }
  return out;
}

/**
 * 오늘 축하할 마일스톤이 있으면 그 값을 반환하고 '축하함'으로 기록한다.
 * 같은 마일스톤을 두 번 축하하지 않는다. 조건: 오늘 불이 붙어 있어야 한다 —
 * 어제까지의 기록으로 오늘 아무것도 안 했는데 축하가 뜨면 어색하다.
 */
export function takeMilestoneCelebration(): number | null {
  const { streak, level } = flameState();
  if (level !== 'lit') return null;
  const celebrated = load<number>(CELEBRATED_KEY, 0);
  const hit = [...STREAK_MILESTONES].reverse().find((m) => streak >= m && m > celebrated);
  if (!hit) return null;
  store(CELEBRATED_KEY, hit);
  return hit;
}

/** 마일스톤별 한 줄 — 숫자만 던지지 않고 의미를 붙인다. */
export function milestoneMessage(m: number): string {
  switch (m) {
    case 3: return '3일 연속 — 습관의 씨앗이 심어졌어요.';
    case 7: return '일주일 연속! 이제 영어가 일상에 들어왔어요.';
    case 14: return '2주 연속 — 대부분이 멈추는 지점을 지났어요.';
    case 30: return '한 달 연속. 이건 이제 습관이 아니라 정체성이에요.';
    case 50: return '50일 연속 — 미팅에서 달라진 게 느껴질 때예요.';
    case 100: return '100일. 여기까지 오는 사람은 정말 드뭅니다.';
    case 200: return '200일 연속 — 영어가 두렵지 않은 사람이 됐어요.';
    case 365: return '1년 연속. 더 할 말이 없습니다. 존경합니다.';
    default: return `${m}일 연속 달성!`;
  }
}
