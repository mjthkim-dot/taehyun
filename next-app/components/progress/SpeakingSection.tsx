'use client';

/**
 * 진도 화면 '말하기' 섹션(M10, ProgressScreen에서 dynamic) — "말이 늘고 있다"를 귀와 숫자로.
 *
 *   ① 이달의 1분(MonthlyVoiceCard) — 때가 됐거나 이번 달 기록이 있으면 맨 위
 *   ② D+30·D+90 재녹음 안내(기준선에서 30·90일)
 *   ③ '2주 전 나 vs 오늘' — 같은 문장 드라마 녹음 중 가장 오래된 것 vs 최신 + 태오 ▶
 *   ④ 지표 3축(회수율 · 유창성 · 청크 사용률) + 따로 이해가능성(월간 재전사만) — 7일 vs 그 앞 21일 방향만
 *   ⑤ 튜터 앵커 '앱 지표와 방향 일치 n/6'
 *   ⑥ 시간 예산 한 줄(누적 말하기 · 다음 레벨까지 · 주간 목표면 몇 주) + 주간 목표 버튼 3개
 *   ⑦ 녹음 아카이브(기준선·월간·D+7) 목록 — 눌러서 듣기
 * 키 없어도 전부 열린다(전사 숫자만 비고, 소리 비교는 그대로).
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { todayKey } from '../../lib/dates';
import { BASELINE_GUIDES, baseline, baselineRecheckDue } from '../../lib/baseline';
import {
  compareSameSentence,
  monthlyCardDue,
  monthlyEntries,
  retranscribePendingBaseline,
  setWeeklyGoalH,
  weeklyGoalH,
  WEEKLY_GOAL_HOURS,
  type WeeklyGoalH,
} from '../../lib/growthArchive';
import { metrics3, arrow, type Dir } from '../../lib/metrics3';
import { anchors, appByMonth, directionAgreement } from '../../lib/anchor';
import { etaLine, etaWeeks, hoursToNext, totalHours } from '../../lib/timeBudget';
import { skillLevel, placementPrior } from '../../lib/cefrGrowth';
import { CEFR_NEXT } from '../../lib/cefr';
import { listRecordings, type Recording } from '../../lib/storage';
import { isOn } from '../../lib/flags';
import { ClipRow, TAEO_VOICE } from './GaBits';

const MonthlyVoiceCard = dynamic(() => import('../MonthlyVoiceCard'), { ssr: false });

const KIND_LABEL: Record<string, string> = { baseline: '기준선', monthly: '이달의 1분', d7: 'D+7 문장' };

const dirWord = (d: Dir) => (d === 'up' ? '오르는 중' : d === 'down' ? '내리는 중' : d === 'flat' ? '그대로' : '기록 쌓는 중');

export default function SpeakingSection() {
  const today = todayKey();
  const [recs, setRecs] = useState<Recording[] | null>(null);
  const [tick, setTick] = useState(0);
  const [goal, setGoal] = useState<WeeklyGoalH>(() => weeklyGoalH());
  const growthOn = useMemo(() => isOn('growth'), []);
  const due = useMemo(() => monthlyCardDue(today), [today]);

  useEffect(() => {
    let on = true;
    void listRecordings().then((r) => on && setRecs(r));
    return () => {
      on = false;
    };
  }, [tick]);

  // 키는 있는데 기준선 전사가 남아 있으면(배치 때 서버가 바빴던 경우 등) 여기서 한 번 더 시도한다
  useEffect(() => {
    void retranscribePendingBaseline().then((r) => r && setTick((t) => t + 1));
  }, []);

  // tick: 월간 녹음·기준선 재전사 뒤 숫자를 다시 읽는다
  const m = useMemo(() => metrics3(today), [today, tick]);
  const agree = useMemo(() => directionAgreement(anchors(), appByMonth(monthlyEntries())), [tick]);
  const b = useMemo(() => baseline(), [tick]);
  const recheck = baselineRecheckDue(b, today);

  const pair = useMemo(() => (recs ? compareSameSentence(recs) : null), [recs]);
  const archive = useMemo(() => (recs || []).filter((r) => r.kind === 'baseline' || r.kind === 'monthly' || r.kind === 'd7').sort((a, b2) => b2.at - a.at), [recs]);

  const time = useMemo(() => {
    const sp = skillLevel('speaking');
    const since = placementPrior('speaking') || sp.level;
    const total = totalHours();
    const left = hoursToNext(sp.level, total, since);
    return { line: etaLine(sp.level, total, since), left, next: CEFR_NEXT[sp.level] };
  }, [tick]);

  const pct = (v: number | null) => (v == null ? '–' : `${v}%`);
  const sec = (ms: number | null) => (ms == null ? '–' : `${(ms / 1000).toFixed(1)}초`);

  return (
    <section className="ga-sec" aria-label="말하기">
      <div className="pg-sec-h ga-sec-h">🗣 말하기</div>

      {growthOn && <MonthlyVoiceCard due={due} onSaved={() => setTick((t) => t + 1)} />}

      {recheck && (
        <p className="ga-recheck" role="note">
          {recheck === 90 ? BASELINE_GUIDES.d90 : BASELINE_GUIDES.d30}
        </p>
      )}

      {pair && (
        <div className="study-card ga-pair">
          <div className="ga-title">{pair.days >= 14 ? '2주 전 나 vs 오늘' : `${pair.days}일 전 나 vs 오늘`}</div>
          <p className="ga-pair-en" lang="en">
            {pair.en}
          </p>
          <ClipRow
            items={[
              { label: `${pair.days >= 14 ? '2주 전' : `${pair.days}일 전`} 나 ▶`, clip: pair.old.blob },
              { label: '오늘 나 ▶', clip: pair.cur.blob },
              { label: '태오 ▶', say: pair.en, voice: TAEO_VOICE },
            ]}
          />
        </div>
      )}

      <div className="study-card ga-metrics">
        <div className="ga-title">지표 3축 — 지난 3주보다</div>
        <ul className="ga-axes">
          <li className="ga-axis" data-axis="recall">
            <span className="ga-axis-name">회수율</span>
            <span className="ga-axis-val">
              {pct(m.recall.v7)} <small>28일 {pct(m.recall.v28)}</small>
            </span>
            <span className={`ga-dir ${m.recall.dir || 'none'}`} aria-label={dirWord(m.recall.dir)}>
              {arrow(m.recall.dir)}
            </span>
          </li>
          <li className="ga-axis" data-axis="fluency">
            <span className="ga-axis-name">유창성</span>
            <span className="ga-axis-val">
              WPM {m.fluency.wpm ?? '–'} <small>반응 {sec(m.fluency.latency)}</small>
            </span>
            <span className={`ga-dir ${m.fluency.dir || 'none'}`} aria-label={dirWord(m.fluency.dir)}>
              {arrow(m.fluency.dir)}
            </span>
          </li>
          <li className="ga-axis" data-axis="chunk">
            <span className="ga-axis-name">청크 사용률</span>
            <span className="ga-axis-val">
              {pct(m.chunkUse.rate7)} <small>{m.chunkUse.used7}/{m.chunkUse.exposed7}</small>
            </span>
            <span className={`ga-dir ${m.chunkUse.dir || 'none'}`} aria-label={dirWord(m.chunkUse.dir)}>
              {arrow(m.chunkUse.dir)}
            </span>
          </li>
        </ul>
        <p className="ga-intel">
          이해가능성(월 1회, 힌트 없이 다시 받아쓴 값):{' '}
          {m.intelligibility ? (
            <b>
              {m.intelligibility.prev != null ? `${m.intelligibility.prev}% → ` : ''}
              {m.intelligibility.last}% {arrow(m.intelligibility.dir)}
            </b>
          ) : (
            '이달의 1분을 녹음하면 생겨요'
          )}
        </p>
        <p className="ga-foot muted">회수율은 받아쓰기가 문장 힌트를 받아 실제보다 높게 나와요 — 방향만 보세요.</p>
        {agree.total > 0 && (
          <p className="ga-agree">
            튜터 점수와 방향 일치 <b>{agree.agree}/{agree.total}</b>
            {agree.total >= 6 ? (agree.agree >= 4 ? ' — 앱 지표를 믿어도 좋아요' : ' — 앱 지표를 가볍게 보세요') : ''}
          </p>
        )}
      </div>

      <div className="study-card ga-time">
        <p className="ga-eta">⏱ {time.line}</p>
        {time.left > 0 && (
          <p className="ga-eta-sub muted">
            주 {goal}시간이면 약 {etaWeeks(time.left, goal)}주
          </p>
        )}
        <div className="ga-goal" role="group" aria-label="주간 목표">
          {WEEKLY_GOAL_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              className={`ga-goal-btn${goal === h ? ' on' : ''}`}
              aria-pressed={goal === h}
              onClick={() => {
                setWeeklyGoalH(h);
                setGoal(h);
              }}
            >
              주 {h}h
            </button>
          ))}
        </div>
      </div>

      <div className="study-card ga-archive">
        <div className="ga-title">녹음 아카이브 {recs ? `· ${archive.length}개` : ''}</div>
        {recs && !archive.length && <p className="ga-note">아직 없어요 — 배치고사 마지막 기준선이나 이달의 1분을 녹음하면 여기에 모여요.</p>}
        <ul className="ga-list">
          {archive.map((r) => (
            <li key={r.id} className="ga-item" data-kind={r.kind}>
              <span className="ga-item-meta">
                <b>{KIND_LABEL[r.kind] || r.kind}</b> · {r.date} · {(r.durationMs / 1000).toFixed(0)}초{typeof r.wpm === 'number' && r.wpm > 0 ? ` · WPM ${r.wpm}` : ''}
              </span>
              <ClipRow items={[{ label: '▶', clip: r.blob, aria: `${KIND_LABEL[r.kind] || r.kind} ${r.date} 듣기` }]} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
