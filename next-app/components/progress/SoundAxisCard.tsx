'use client';

/**
 * 진도 화면 '소리 축 TOP3'(M9) — 역할극·회상 전사에서 쌓인 혼동축(va_pron, 최근 14일) 상위 3개와
 * 그 축의 HVPT 식별 정답률(va_sound_track.hvpt), 이번 주 소리 커리큘럼 축을 한 카드에 보여 준다.
 * '무엇이 자주 어긋나고, 귀는 얼마나 따라왔나'를 한눈에 — 집중 모드·전체 모드 모두 같은 자리.
 *
 * 읽기 전용: currentWeek()는 시작일을 적으므로 쓰지 않고 weekOf(started)로만 계산한다.
 * 기록이 하나도 없으면(진단 0·HVPT 0) 그리지 않는다. ProgressScreen은 SoundAxisLazy(dynamic)로만 받는다.
 */
import { useMemo } from 'react';
import { topPronLapses } from '../../lib/state';
import { LAPSE_TIPS, type LapseKey } from '../../lib/pronunciation';
import { planFor, trackState, weekOf } from '../../lib/soundTrack';
import { todayKey } from '../../lib/dates';

export interface AxisRow {
  key: string;
  label: string;
  /** 최근 14일 어긋난 횟수 */
  count: number;
  /** HVPT 식별 정답률(%) — 시도가 없으면 null */
  hvptPct: number | null;
  hvptTries: number;
}

export function soundAxisRows(): { rows: AxisRow[]; week: number; weekLabel: string; weekAxes: string[] } {
  const st = trackState();
  const week = weekOf(st.started || todayKey(), todayKey());
  const plan = planFor(week);
  const labelOf = (k: string) => LAPSE_TIPS[k as LapseKey]?.label ?? k;
  const hv = (k: string) => {
    const s = st.hvpt[k];
    return s && s.tries > 0 ? { pct: Math.round((s.correct / s.tries) * 100), tries: s.tries } : { pct: null, tries: 0 };
  };
  const top = topPronLapses(14, 3);
  const rows: AxisRow[] = top.map((r) => {
    const h = hv(r.key);
    return { key: r.key, label: labelOf(r.key), count: r.count, hvptPct: h.pct, hvptTries: h.tries };
  });
  // 진단 기록이 3개 미만이면 HVPT로 훈련한 축으로 채운다(어긋남 0회 — 귀 훈련만 한 축)
  for (const k of Object.keys(st.hvpt)) {
    if (rows.length >= 3) break;
    if (rows.some((r) => r.key === k)) continue;
    const h = hv(k);
    if (h.tries) rows.push({ key: k, label: labelOf(k), count: 0, hvptPct: h.pct, hvptTries: h.tries });
  }
  return { rows, week, weekLabel: plan.label, weekAxes: plan.axes };
}

export default function SoundAxisCard() {
  const data = useMemo(() => {
    try {
      return soundAxisRows();
    } catch {
      return null;
    }
  }, []);
  if (!data || !data.rows.length) return null;
  return (
    <section className="hv-axis caf-wrap" aria-label="소리 축 TOP3">
      <h3>🎧 소리 축 TOP3</h3>
      <p className="hv-axis-week">
        이번 주({data.week}주차): <b>{data.weekLabel}</b>
      </p>
      <ol className="hv-axis-list">
        {data.rows.map((r) => (
          <li key={r.key} className={`hv-axis-row${data.weekAxes.includes(r.key) ? ' now' : ''}`}>
            <span className="hv-axis-name">{r.label}</span>
            <span className="hv-axis-stat">{r.count ? `어긋남 ${r.count}회` : '어긋남 없음'}</span>
            <span className="hv-axis-stat">{r.hvptPct === null ? '귀 훈련 전' : `구분 ${r.hvptPct}% (${r.hvptTries}문항)`}</span>
          </li>
        ))}
      </ol>
      <p className="hv-axis-note muted">최근 14일 말하기 받아쓰기 기준 · 구분 정답률은 드라마 엔딩 ‘소리 구분’ 카드 누적</p>
    </section>
  );
}
