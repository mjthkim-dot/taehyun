'use client';

/**
 * 주간 리포트 — 이미 쌓이고 있던 데이터를 처음으로 '읽을 수 있는 형태'로 묶는다.
 *
 * 지금까지 발화 수·CAF 세션·XP·오답·질문 기록이 모두 저장되고 있었지만 화면에는
 * 오늘 숫자만 보였다. 학습을 이어가게 만드는 건 "이번 주에 내가 뭘 했고 무엇이
 * 약한가"라서, 그 판단에 필요한 것만 골라 계산한다.
 *
 * 계산은 순수 함수로 두어(화면과 분리) 데이터만 넣으면 테스트할 수 있게 했다.
 */
import { load, spokenHistory, dueWeak, topPronLapses, type WeakItem } from './state';
import { LAPSE_TIPS, type LapseKey } from './pronunciation';
import { weeklyXp } from './habits';
import { MASTER_CURRICULUM } from './curriculum';
import { getLessonStats } from './state';

export interface WeeklyReport {
  /** 이번 주(최근 7일) 말한 문장 수 */
  spoken: number;
  /** 지난주(그 이전 7일) 대비 증감 */
  spokenDelta: number;
  /** 학습한 날 수 */
  activeDays: number;
  /** 획득 XP */
  xp: number;
  /** 최근 7일 일별 발화(막대용) */
  daily: { label: string; count: number; today: boolean }[];
  /** 말하기 지표 추세 — 최근 세션 평균과 그 이전 평균 */
  caf: { now: number | null; before: number | null; sessions: number };
  /** 가장 자주 틀린 항목(반복 실패 순) */
  weakTop: { en: string; kr: string; lapses: number }[];
  /** 이번 주 반복해서 어긋난 발음 축 — 문장 하나보다 경향이 실행 가능하다 */
  pronTop: { key: string; label: string; tip: string; count: number }[];
  /** 오늘 복습 대기 수 */
  dueCount: number;
  /** 다음에 이어갈 학습 경로 노드 */
  nextUnits: { lessonId: number; title: string; sub: string }[];
  /** 한 줄 총평 — 숫자를 해석해 준다 */
  headline: string;
}

interface CafSession {
  date: string | number;
  caf?: { complexity: number; accuracy: number; fluency: number };
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildWeeklyReport(): WeeklyReport {
  /* ── 발화: 최근 14일을 받아 앞뒤 7일로 나눠 비교한다 ── */
  const hist = spokenHistory(14);
  const prev7 = hist.slice(0, 7).reduce((n, d) => n + d.count, 0);
  const last7 = hist.slice(7).reduce((n, d) => n + d.count, 0);
  const daily = hist.slice(7).map((d, i) => ({
    label: DAY_LABELS[new Date(`${d.date}T00:00:00`).getDay()],
    count: d.count,
    today: i === 6,
  }));

  /* ── 학습일: 발화가 있었거나 연습 기록이 있는 날 ── */
  const dayCounts = load<Record<string, number>>('va_daycount', {});
  let activeDays = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    if ((dayCounts[k] || 0) > 0 || hist.find((h) => h.date === k && h.count > 0)) activeDays++;
  }

  const xp = weeklyXp().reduce((n, d) => n + d.xp, 0);

  /* ── CAF: 최근 세션 3개와 그 이전 3개의 평균을 비교한다 ── */
  const sessions = load<CafSession[]>('va_sessions', []).filter((s) => s.caf);
  const avg = (arr: CafSession[]) =>
    arr.length
      ? Math.round(
          (arr.reduce((n, s) => n + (s.caf!.complexity + s.caf!.accuracy + s.caf!.fluency) / 3, 0) / arr.length) * 10
        ) / 10
      : null;
  const recent = sessions.slice(-3);
  const older = sessions.slice(-6, -3);

  /* ── 약점: 반복해서 틀린 항목이 곧 다음 주 우선순위 ── */
  const weak = load<WeakItem[]>('va_weak', []);
  const weakTop = [...weak]
    .filter((w) => (w.lapses || 0) > 0)
    .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
    .slice(0, 5)
    .map((w) => ({ en: w.en, kr: w.kr, lapses: w.lapses || 0 }));

  /* ── 다음 학습: 아직 정확도 80%를 못 넘긴 첫 노드들 ── */
  const stats = getLessonStats();
  const nextUnits = MASTER_CURRICULUM.flatMap((lv) => lv.units)
    .filter((u) => {
      const st = stats[u.lessonId];
      return !st || st.attempts === 0 || st.correct / Math.max(1, st.attempts) < 0.8;
    })
    .slice(0, 3)
    .map((u) => ({ lessonId: u.lessonId, title: u.title, sub: u.sub }));

  const dueCount = dueWeak().length;

  /* ── 발음: 이번 주 반복해서 어긋난 축. 축 이름과 교정법을 함께 실어
   *    "R/L 6회"로 끝나지 않고 무엇을 어떻게 고칠지까지 이어지게 한다. ── */
  const pronTop = topPronLapses(7, 3).map((p) => {
    const tip = LAPSE_TIPS[p.key as LapseKey];
    return { key: p.key, label: tip?.label ?? p.key, tip: tip?.tip ?? '', count: p.count };
  });

  /* ── 총평: 숫자를 그대로 두지 않고 한 문장으로 해석한다 ── */
  let headline: string;
  if (last7 === 0) {
    headline = '이번 주에는 아직 말하기 기록이 없어요. 오늘 한 문장부터 시작해 보세요.';
  } else if (activeDays >= 5) {
    headline = `이번 주 ${activeDays}일 학습 — 습관이 잡히고 있어요. 이 페이스를 유지하세요.`;
  } else if (last7 > prev7) {
    headline = `지난주보다 ${last7 - prev7}문장 더 말했어요. 좋은 흐름입니다.`;
  } else if (prev7 > 0 && last7 < prev7) {
    headline = `지난주보다 ${prev7 - last7}문장 적어요. 하루 5문장만 채워도 회복됩니다.`;
  } else {
    headline = `이번 주 ${last7}문장을 말했어요. 학습일을 하루만 더 늘려보세요.`;
  }

  return {
    spoken: last7,
    spokenDelta: last7 - prev7,
    activeDays,
    xp,
    daily,
    caf: { now: avg(recent), before: avg(older), sessions: sessions.length },
    weakTop,
    pronTop,
    dueCount,
    nextUnits,
    headline,
  };
}
