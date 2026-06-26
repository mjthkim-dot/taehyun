'use client';

/**
 * 진도(progress) 화면 — voice-assistant/index.html 의 renderProgress() /
 * cafDashboardHtml() / weeklyReportHtml() 포팅. 미션 관련 통계는
 * MISSIONS 데이터가 아직 이전되지 않아 이번 단계에서는 제외했다.
 */
import { useEffect, useState } from 'react';
import { LESSONS, lessonLabel, gseToCefr } from '../lib/lessons';
import { MASTER_CURRICULUM } from '../lib/curriculum';
import {
  getProfile,
  getSkillStats,
  getLessonStats,
  calcStreak,
  dueWeak,
  weeklyCounts,
  scaffoldFor,
  CEFR_GSE,
  DAILY_GOAL,
  load,
  SKILLS,
} from '../lib/state';
import { CountUp, RadarChart, GaugeRing } from './Charts';

interface CafSession {
  date: number;
  cefr: string;
  caf: { complexity: number; accuracy: number; fluency: number };
}

export default function ProgressScreen() {
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const stats = getLessonStats();
  const totalAttempts = Object.values(stats).reduce((s, v) => s + v.attempts, 0);
  const totalCorrect = Object.values(stats).reduce((s, v) => s + v.correct, 0);

  const profile = getProfile();
  const skills = getSkillStats();
  const sessions = load<CafSession[]>('va_sessions', []);
  const lastSession = sessions[sessions.length - 1];
  const band = CEFR_GSE[profile.cefr] || CEFR_GSE.A2;
  const week = weeklyCounts();
  const weekTotal = week.reduce((s, d) => s + d.count, 0);
  const weekMax = Math.max(DAILY_GOAL, ...week.map((d) => d.count));
  const activeDays = week.filter((d) => d.count > 0).length;

  return (
    <div className="study-screen">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="num"><CountUp value={calcStreak()} /></div>
          <div className="lbl">연속 학습일 🔥</div>
        </div>
        <div className="stat-card">
          <div className="num"><CountUp value={totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0} suffix="%" /></div>
          <div className="lbl">드릴 정확도</div>
        </div>
        <div className="stat-card">
          <div className="num"><CountUp value={dueWeak().length} /></div>
          <div className="lbl">오늘 복습할 문장</div>
        </div>
      </div>

      <div className="caf-wrap">
        <h3>🌐 CEFR / GSE 이원 진도</h3>
        <div className="caf-sub">
          현재 <b style={{ color: 'var(--text)' }}>CEFR {profile.cefr}</b> · GSE{' '}
          <b style={{ color: 'var(--text)' }}>{profile.gse}</b> ({band.min}–{band.max}) · 스캐폴딩{' '}
          {Math.round(scaffoldFor(profile.cefr) * 100)}%
        </div>
        <div className="gauge-row">
          <GaugeRing pct={Math.round(((profile.gse - 10) / 80) * 100)} label={`CEFR ${profile.cefr}`}>
            <CountUp value={profile.gse} />
          </GaugeRing>
          <div className="gauge-aside">
            <div className="bar" style={{ margin: '0 0 6px' }}>
              <div className="fill" style={{ width: `${Math.round(((profile.gse - 10) / 80) * 100)}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
              <span>GSE 10 · A1</span>
              <span>GSE 90 · C2</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
              전체 GSE 구간(10–90)에서 현재 위치예요. 드릴·회화를 이어가면 게이지가 채워집니다.
            </div>
          </div>
        </div>
      </div>

      <div className="caf-wrap">
        <h3>📚 4대 영역 숙련도</h3>
        <div className="caf-sub">
          독해·청해·구어·문어를 교차로 본 성취도. 회화에서 🎯 CAF를 누를수록 구어 인출 강도가 올라갑니다.
        </div>
        <div className="skill-grid">
          {SKILLS.map((sk) => {
            const s = skills[sk.key] || { gse: 10, sessions: 0 };
            const cefr = gseToCefr(s.gse);
            const intensity = Math.round(((s.gse - 10) / 80) * 100);
            return (
              <div className="skill-card2" key={sk.key}>
                <div className="sk-name">{sk.label}</div>
                <div className="sk-gse">
                  <CountUp value={s.gse} />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}> GSE</span>
                </div>
                <div className="sk-cefr">
                  CEFR {cefr} · {s.sessions}세션
                </div>
                <div className="sk-intensity" style={{ width: `${intensity}%` }} />
              </div>
            );
          })}
        </div>
      </div>

      {lastSession ? (
        <div className="caf-wrap">
          <h3>🎯 최근 CAF</h3>
          <div className="caf-sub">
            {new Date(lastSession.date).toLocaleDateString('ko-KR')} · {lastSession.cefr} 세션
          </div>
          <div className="caf-radar-row">
            <RadarChart
              values={[
                { label: '복잡도', value: lastSession.caf.complexity, color: 'var(--primary)' },
                { label: '정확도', value: lastSession.caf.accuracy, color: 'var(--green)' },
                { label: '유창성', value: lastSession.caf.fluency, color: 'var(--yellow)' },
              ]}
            />
            <div className="caf-bars" style={{ flex: 1 }}>
              <CafBar name="복잡도" val={lastSession.caf.complexity} color="var(--primary)" />
              <CafBar name="정확도" val={lastSession.caf.accuracy} color="var(--green)" />
              <CafBar name="유창성" val={lastSession.caf.fluency} color="var(--yellow)" />
            </div>
          </div>
        </div>
      ) : (
        <div className="caf-wrap">
          <div className="caf-sub" style={{ margin: 0 }}>
            🎯 아직 CAF 기록이 없습니다. 회화 탭에서 영어로 대화한 뒤 <b>🎯 CAF</b> 버튼을 눌러 첫 분석을 받아보세요.
          </div>
        </div>
      )}

      <div className="caf-wrap">
        <h3>📅 주간 리포트</h3>
        <div className="caf-sub">
          최근 7일 동안 <b style={{ color: 'var(--text)' }}>{weekTotal}문장</b> 연습 · {activeDays}일 활동 · 목표선 {DAILY_GOAL}/일
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 8, borderBottom: '1px solid var(--border)', paddingBottom: 2 }}>
          {week.map((d, i) => {
            const h = Math.round((d.count / weekMax) * 70) + 2;
            const reached = d.count >= DAILY_GOAL;
            const color = reached ? 'var(--green)' : d.today ? 'var(--primary-light)' : 'var(--primary)';
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', height: 12 }}>{d.count || ''}</div>
                <div style={{ width: '60%', height: h, background: color, borderRadius: '4px 4px 0 0', opacity: d.count ? 1 : 0.25 }} />
                <div style={{ fontSize: '0.66rem', color: d.today ? 'var(--primary-light)' : 'var(--text-muted)', fontWeight: d.today ? 700 : 400 }}>
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {LESSONS.map((l) => {
        const s = stats[l.id] || { attempts: 0, correct: 0 };
        const pct = s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0;
        return (
          <div className="lesson-progress-row" key={l.id}>
            <div className="top">
              <span>
                {lessonLabel(l)} · {l.title}
              </span>
              <span className="pct">{s.attempts ? `${pct}%` : '미시작'}</span>
            </div>
            <div className="bar">
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="mission-history">
              드릴 {s.correct}/{s.attempts}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-light)', margin: '18px 0 8px' }}>
        🗺 마스터 코스 (A1→C2)
      </div>
      {MASTER_CURRICULUM.map((lvl) => {
        let a = 0;
        let c = 0;
        let started = 0;
        lvl.units.forEach((u) => {
          const s = stats[u.lessonId];
          if (s?.attempts) {
            a += s.attempts;
            c += s.correct;
            started++;
          }
        });
        const pct = a ? Math.round((c / a) * 100) : 0;
        return (
          <div className="lesson-progress-row" key={lvl.level}>
            <div className="top">
              <span>
                {lvl.cefr} · {lvl.name}
              </span>
              <span className="pct">{a ? `${pct}%` : '미시작'}</span>
            </div>
            <div className="bar">
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="mission-history">
              유닛 {started}/{lvl.units.length} 시작 · 드릴 {c}/{a}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CafBar({ name, val, color }: { name: string; val: number; color: string }) {
  return (
    <div className="caf-bar-row">
      <span className="name">{name}</span>
      <span className="track">
        <span className="fl" style={{ width: `${val * 10}%`, background: color }} />
      </span>
      <span className="val">{val.toFixed(1)}</span>
    </div>
  );
}
