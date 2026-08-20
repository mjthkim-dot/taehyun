'use client';

/**
 * 홈 "이어서 하기" — 기능 그리드(더보기→기능→카드, 3탭)에 묻혀 있던 핵심
 * 기능들을 **진행 상태와 함께** 홈에 녹인다. 정적 링크 모음이 아니라
 * "내가 하다 만 것들"의 목록이라, 볼 때마다 다음 행동이 정해진다.
 *
 * 홈 번들 보호: 이 컴포넌트는 MasterScreen에서 dynamic()으로 불린다 —
 * 실전 코스 데이터(realCourse.json 등)를 여기서 import해도 홈 첫 페인트
 * 청크에는 실리지 않는다(DailyQuests와 같은 패턴).
 */
import type { Mode } from './NavBar';
import { getEpisodes, readEpisodes } from '../lib/immersion';
import { seenScenarios, totalMergedScenarios } from '../lib/realCourse';
import { seenCareer, totalCareerScenarios } from '../lib/careerPack';
import { daysUntilInterview, interviewHistory, upcomingInterview } from '../lib/interview';
import { dueWeak } from '../lib/state';

interface Shortcut {
  mode: Mode;
  icon: string;
  label: string;
  /** 진행 상태 한 줄 — "이어서"의 근거 */
  state: string;
  /** 아직 시작 전(시작하기 배지) */
  fresh?: boolean;
  /** 지금 하면 좋은 것(강조 테두리) */
  hot?: boolean;
  /** 시간대 추천 칩(예: "출근길") */
  time?: string;
}

/**
 * 시간대 추천 — 같은 카드 줄이라도 아침엔 귀 훈련이, 업무 시간엔 실전 문서가,
 * 저녁엔 스토리·면접 준비가 손에 먼저 닿게 한다. 복습(due)은 시간과 무관하게
 * 항상 맨 앞(가장 급한 일) — 추천은 그 다음 자리부터다.
 */
export function timeSlot(hour: number): { modes: Mode[]; label: string } {
  if (hour >= 6 && hour < 10) return { modes: ['audio', 'immersion'], label: '출근길' };
  if (hour >= 10 && hour < 18) return { modes: ['minutes', 'course'], label: '업무 틈새' };
  if (hour >= 18 && hour < 23) return { modes: ['immersion', 'interview', 'career'], label: '저녁 몰입' };
  return { modes: ['audio', 'immersion'], label: '하루 마무리' };
}

function buildShortcuts(): Shortcut[] {
  const due = dueWeak().filter((w) => w.en && w.en.trim()).length;
  const eps = getEpisodes();
  const read = readEpisodes();
  const nextEp = eps.find((e) => !read.includes(e.no));
  const course = seenScenarios().length;
  const courseTotal = totalMergedScenarios();
  const career = seenCareer().length;
  const careerTotal = totalCareerScenarios();
  const iv = interviewHistory();
  const last = iv[iv.length - 1];

  const pool: Shortcut[] = [
    nextEp
      ? { mode: 'immersion', icon: '📖', label: '몰입 스토리', state: `다음 ${nextEp.no}화 대기`, fresh: read.length === 0 }
      : { mode: 'immersion', icon: '📖', label: '몰입 스토리', state: '다음 화 만들기' },
    { mode: 'course', icon: '📬', label: '실전 코스', state: `${course}/${courseTotal} 연습`, fresh: course === 0 },
    // 실제 면접이 잡혀 있으면 D-day가 상태가 된다 — D-3 이내면 강조(오늘 할 일)
    (() => {
      const up = upcomingInterview();
      const dday = up ? daysUntilInterview(up) : -1;
      if (up && dday >= 0) {
        return { mode: 'interview' as Mode, icon: '🎤', label: '면접', state: `D-${dday} · ${up.label}`, hot: dday <= 3 };
      }
      return { mode: 'interview' as Mode, icon: '🎤', label: '면접', state: last ? `최근 ${last.score}점` : '첫 시뮬레이션', fresh: !last };
    })(),
    { mode: 'career', icon: '🙋', label: '커리어 영어', state: `${career}/${careerTotal} 연습`, fresh: career === 0 },
    { mode: 'minutes', icon: '🗂', label: '실전 영어', state: '회의록·메일 → 대화' },
    { mode: 'audio', icon: '🎧', label: '오디오 모드', state: '귀로만 오늘 복습' },
  ];

  // 시간대 추천을 앞으로 — 추천 순서 유지, 나머지는 원래 순서 유지
  const slot = timeSlot(new Date().getHours());
  const boosted = slot.modes
    .map((m) => pool.find((s) => s.mode === m))
    .filter((s): s is Shortcut => !!s)
    .map((s) => ({ ...s, time: slot.label }));
  const rest = pool.filter((s) => !slot.modes.includes(s.mode));

  const list: Shortcut[] = [];
  // 복습이 밀려 있으면 맨 앞 — 오늘 가장 급한 것(시간대보다 우선)
  if (due > 0) list.push({ mode: 'review', icon: '📝', label: '복습', state: `오늘 ${due}개 대기`, hot: true });
  list.push(...boosted, ...rest);
  return list;
}

export default function HomeShortcuts({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const items = buildShortcuts();
  return (
    <div className="hs-wrap">
      <div className="hs-title">이어서 하기</div>
      <div className="hs-row" role="list">
        {items.map((s) => (
          <button
            type="button"
            role="listitem"
            key={s.mode}
            className={`hs-card${s.hot ? ' hot' : ''}`}
            onClick={() => onNavigate(s.mode)}
            aria-label={`${s.label} — ${s.state}`}
          >
            <span className="hs-ic">{s.icon}</span>
            <span className="hs-label">
              {s.label}
              {s.fresh && <span className="hs-new">NEW</span>}
            </span>
            <span className="hs-state">{s.state}</span>
            {s.time && <span className="hs-time">{s.time}</span>}
          </button>
        ))}
        <button type="button" role="listitem" className="hs-card hs-more" onClick={() => onNavigate('features')} aria-label="전체 도구 보기">
          <span className="hs-ic">🧰</span>
          <span className="hs-label">전체 도구</span>
          <span className="hs-state">모두 보기 →</span>
        </button>
      </div>
    </div>
  );
}
