'use client';

/**
 * 커리어 영어 화면 — 자기소개·이직 인터뷰·네트워킹.
 * 실전 코스와 같은 상호작용(트랙 → 시나리오 → DialoguePractice → 드릴)이되,
 * 여기서는 B(면접관·리크루터) 역할을 AI가 읽고 내(A) 대사를 말하는 연습이
 * 핵심이다 — 역할 연습 탭에서 A를 고르면 그대로 모의 인터뷰가 된다.
 */
import { useState } from 'react';
import type { Mode } from './NavBar';
import { getCareerTracks, openCareerScenario, seenCareer, totalCareerScenarios } from '../lib/careerPack';
import type { CourseScenario } from '../lib/realCourse';
import { setDrillQueue } from '../lib/state';
import DialoguePractice from './DialoguePractice';

export default function CareerScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const tracks = getCareerTracks();
  const [openTrack, setOpenTrack] = useState<string | null>(null);
  const [openSc, setOpenSc] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>(() => seenCareer());
  const [exprMsg, setExprMsg] = useState('');

  const total = totalCareerScenarios();
  const done = seen.filter((id) => tracks.some((t) => t.scenarios.some((s) => s.id === id))).length;

  function handleOpen(s: CourseScenario) {
    if (openSc === s.id) {
      setOpenSc(null);
      return;
    }
    const added = openCareerScenario(s);
    setSeen(seenCareer());
    setOpenSc(s.id);
    setExprMsg(added > 0 ? `「${s.title}」 표현 ${added}개가 복습 큐에 들어갔어요.` : '');
  }

  return (
    <div className="study-screen">
      <div className="study-card rc-head">
        <div className="rc-head-title">🙋 내 커리어를 영어로 말하다</div>
        <p className="muted rc-method">
          자기소개·인터뷰 답변의 사례는 <b>실제 내 커리어</b>에서 왔어요 — 25만 달러 약정 전환, 월 40만 달러 계정
          운영, 떠난 고객을 되모신 이야기. 역할 연습에서 <b>내 역할(A)</b>을 고르면 면접관은 AI가 맡는 모의
          인터뷰가 됩니다.
        </p>
        <div className="rc-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
      </div>

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
                        <span className="rc-sc-title">{s.title}</span>
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
                          <DialoguePractice dialogue={s.dialogue} lessonId={9800 + i} />
                          <button
                            type="button"
                            className="start-drill-btn"
                            onClick={() => {
                              setDrillQueue({
                                label: `커리어 영어 — ${s.title}`,
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
    </div>
  );
}
