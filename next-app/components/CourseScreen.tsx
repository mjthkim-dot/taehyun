'use client';

/**
 * 실전 코스 화면 — "내 메일 90일이 곧 커리큘럼"의 얼굴.
 *
 * 헤더: 분석 요약(스레드 245개·상위 고객·제작 방법) — 이 코스가 어디서 왔는지
 *       근거를 밝힌다. 트랙 카드(6) → 시나리오(3씩) → DialoguePractice.
 * 시나리오를 열면: 진행률 갱신 + 그 시나리오의 수확 표현이 복습 큐(SRS)로.
 * 각 시나리오엔 근거 스레드(grounding)가 붙는다 — "이건 지난달 실제로 있었던
 * 대화"라는 사실이 훈련 동기의 핵심이다.
 */
import { useState } from 'react';
import type { Mode } from './NavBar';
import {
  getCourseMeta,
  getMergedTracks,
  isStale,
  openScenario,
  refreshCourse,
  refreshedAt,
  seenScenarios,
  totalMergedScenarios,
  type CourseScenario,
} from '../lib/realCourse';
import { setDrillQueue } from '../lib/state';
import DialoguePractice from './DialoguePractice';

export default function CourseScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const meta = getCourseMeta();
  const [tracks, setTracks] = useState(() => getMergedTracks());
  const [openTrack, setOpenTrack] = useState<string | null>(null);
  const [openSc, setOpenSc] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>(() => seenScenarios());
  const [exprMsg, setExprMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  const total = totalMergedScenarios();
  const done = seen.filter((id) => tracks.some((t) => t.scenarios.some((s) => s.id === id))).length;

  async function doRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMsg('');
    try {
      const r = await refreshCourse();
      if (r.ok) {
        setTracks(getMergedTracks());
        setRefreshMsg(
          r.created
            ? `재분석 완료 — 최근 스레드 ${r.totalThreads}개에서 새 시나리오 ${r.created}편이 추가됐어요.`
            : `재분석 완료 — 지난 분석 이후 코스에 담을 새 패턴이 없어요. (스레드 ${r.totalThreads}개 확인)`
        );
      } else if (r.unconfigured) {
        setRefreshMsg('Gmail 연동이 아직 없어요 — 실전 영어 탭의 설정 안내를 먼저 진행해 주세요.');
      } else if (r.error === 'offline') {
        setRefreshMsg('오프라인이에요 — 저장된 코스로 계속 연습할 수 있어요.');
      } else {
        setRefreshMsg('재분석에 실패했어요 — 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setRefreshing(false);
    }
  }

  function handleOpen(s: CourseScenario) {
    if (openSc === s.id) {
      setOpenSc(null);
      return;
    }
    const added = openScenario(s);
    setSeen(seenScenarios());
    setOpenSc(s.id);
    setExprMsg(added > 0 ? `「${s.title}」 표현 ${added}개가 복습 큐에 들어갔어요.` : '');
  }

  return (
    <div className="study-screen">
      {/* ── 분석 헤더: 이 코스의 출처 ── */}
      <div className="study-card rc-head">
        <div className="rc-head-title">📬 내 메일 90일이 커리큘럼이 되다</div>
        <p className="muted rc-method">{meta.method}.</p>
        <div className="rc-stats">
          <div className="rc-stat">
            <b>{meta.sentThreads}</b>
            <span>발신 스레드</span>
          </div>
          <div className="rc-stat">
            <b>{tracks.length}</b>
            <span>트랙</span>
          </div>
          <div className="rc-stat">
            <b>{total}</b>
            <span>대화</span>
          </div>
          <div className="rc-stat">
            <b>
              {done}/{total}
            </b>
            <span>연습 시작</span>
          </div>
        </div>
        <div className="rc-customers">
          {meta.topCustomers.map((c) => (
            <span key={c.name} className="rc-cust-chip">
              {c.name} {c.threads}
            </span>
          ))}
        </div>
        <div className="rc-refresh-row">
          <span className="rc-refresh-info">
            {refreshedAt().slice(0, 10)} 분석
            {isStale() && <span className="rc-stale">갱신 추천</span>}
          </span>
          <button type="button" className="mini-btn" disabled={refreshing} onClick={() => void doRefresh()}>
            {refreshing ? '재분석 중…' : '🔄 지금 재분석'}
          </button>
        </div>
      </div>

      {refreshMsg && <p className="pp-imported">💬 {refreshMsg}</p>}
      {exprMsg && <p className="pp-imported">✅ {exprMsg}</p>}

      {tracks.map((t) => {
        const tOpen = openTrack === t.id;
        const tDone = t.scenarios.filter((s) => seen.includes(s.id)).length;
        return (
          <div key={t.id} className={`mn-item${tOpen ? ' open' : ''}`}>
            <button type="button" className="mn-item-head" onClick={() => setOpenTrack(tOpen ? null : t.id)}>
              <span className="mn-item-title">
                {t.icon} {t.title}
                <span className="rc-progress">
                  {tDone}/{t.scenarios.length}
                </span>
              </span>
              <span className="mn-item-note rc-why">{t.why}</span>
            </button>
            {tOpen && (
              <div className="mn-item-body">
                {t.scenarios.map((s, i) => {
                  const sOpen = openSc === s.id;
                  return (
                    <div key={s.id} className={`rc-sc${sOpen ? ' open' : ''}`}>
                      <button type="button" className="rc-sc-head" onClick={() => handleOpen(s)}>
                        <span className="rc-sc-num">{i + 1}</span>
                        <span className="rc-sc-title">
                          {s.title}
                          {s.extra && <span className="rc-new">🆕</span>}
                        </span>
                        {seen.includes(s.id) && <span className="rc-seen">연습함 ✓</span>}
                      </button>
                      {sOpen && (
                        <div className="rc-sc-body">
                          <p className="mn-situation">{s.situation}</p>
                          <p className="rc-grounding">🧾 근거: {s.grounding}</p>
                          <div className="pp-sec">💡 수확 표현 (복습 큐 자동 등록)</div>
                          {s.expressions.map((x, j) => (
                            <div className="pp-sent" key={j}>
                              <div className="pp-sent-en">{x.en}</div>
                              <div className="pp-sent-kr">{x.kr}</div>
                            </div>
                          ))}
                          <DialoguePractice dialogue={s.dialogue} lessonId={9500 + i} />
                          <button
                            type="button"
                            className="start-drill-btn"
                            onClick={() => {
                              setDrillQueue({
                                label: `실전 코스 — ${s.title}`,
                                items: s.dialogue.lines.map((l) => ({ en: l.en, kr: l.kr })),
                              });
                              onNavigate('drill');
                            }}
                          >
                            🎤 이 대화 문장으로 드릴 →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p className="muted rc-note">
        코스는 {meta.generatedAt} 기준 분석입니다. 새 회의록·메일로 만드는 최신 대화는 <b>실전 영어</b> 탭에서
        계속 생성돼요.
      </p>
    </div>
  );
}
