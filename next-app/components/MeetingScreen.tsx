'use client';

/**
 * 미팅 준비 · 회고 — 공부와 실제 업무를 잇는 화면.
 *
 * 이 앱의 상황 학습은 전부 일반적인 상황이었다(미팅 열기, 가격 반론…). 잘 만들어져
 * 있지만 정작 **내일 잡힌 그 미팅** — 상대가 누구고 무엇을 팔아야 하는지 아는 자리 —
 * 를 준비하는 곳이 없어서, 학습이 끝나면 학습으로 끝났다.
 *
 * 흐름은 준비 → 리허설 → 회고 세 단계다. 마지막 회고가 핵심이다: 실전에서 막힌
 * 표현만큼 학습 동기가 분명한 재료가 없는데, 지금까지는 그게 기록되지 않고 사라졌다.
 * 여기서 적으면 영어 문장이 되어 표현장·드릴 큐로 넘어간다.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  generatePrep,
  getMeetings,
  removeMeeting,
  saveMeeting,
  translateGaps,
  type MeetingPrep,
} from '../lib/meetingPrep';
import { setTalkContext } from '../lib/dailyMission';
import { addPhrase, addWeakItem, groqKey, setDrillQueue } from '../lib/state';
import SpeakButton from './SpeakButton';
import type { Mode } from './NavBar';

type View = 'list' | 'new' | 'detail';

export default function MeetingScreen({ onNavigate }: { onNavigate?: (m: Mode) => void } = {}) {
  const [meetings, setMeetings] = useState<MeetingPrep[]>([]);
  const [view, setView] = useState<View>('list');
  const [openId, setOpenId] = useState<string | null>(null);

  const [who, setWho] = useState('');
  const [agenda, setAgenda] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [gapText, setGapText] = useState('');
  const [gapBusy, setGapBusy] = useState(false);

  useEffect(() => {
    setMeetings(getMeetings());
  }, []);

  const current = useMemo(() => meetings.find((m) => m.id === openId) ?? null, [meetings, openId]);
  const hasKey = groqKey();

  function refresh() {
    setMeetings(getMeetings());
  }

  async function create() {
    if (!agenda.trim()) {
      setErr('안건은 꼭 적어주세요 — 이 한 줄로 준비 자료가 달라집니다.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const m = await generatePrep({ who: who.trim() || '고객사 담당자', agenda: agenda.trim(), goal: goal.trim() || '다음 단계 합의' });
      saveMeeting(m);
      refresh();
      setOpenId(m.id);
      setView('detail');
      setWho('');
      setAgenda('');
      setGoal('');
    } catch (e) {
      setErr((e as Error)?.message || '준비 자료를 만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  function toggleUsed(m: MeetingPrep, en: string) {
    const used = m.used.includes(en) ? m.used.filter((x) => x !== en) : [...m.used, en];
    saveMeeting({ ...m, used });
    refresh();
  }

  async function submitGaps(m: MeetingPrep) {
    const lines = gapText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setGapBusy(true);
    setErr('');
    try {
      const items = await translateGaps(lines);
      // 결과가 없으면 완료 처리도, 입력 삭제도 하지 않는다 — 예전에는 빈 결과에도
      // done:true + 입력 삭제가 실행돼 사용자가 쓴 "못 한 말"이 조용히 사라졌다.
      if (!items || !items.length) {
        setErr('영어로 바꾸지 못했어요 — 입력은 그대로 두었으니 다시 시도해 주세요.');
        return;
      }
      // 실전에서 막힌 문장이라 곧바로 표현장과 복습 큐 양쪽에 넣는다
      for (const it of items) {
        addPhrase({ en: it.en, kr: it.kr, lesson: `meeting:${m.id}` });
        addWeakItem({ en: it.en, kr: it.kr, lesson: `meeting:${m.id}`, cat: '실전' });
      }
      saveMeeting({ ...m, gaps: [...m.gaps, ...items], done: true });
      refresh();
      setGapText('');
    } catch (e) {
      setErr((e as Error)?.message || '영어로 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setGapBusy(false);
    }
  }

  /* ── 목록 ──
   * 'new'를 먼저 처리해야 한다. 아직 연 미팅이 없을 때(current == null) 목록으로
   * 되돌리면, 첫 미팅을 만들려는 사람은 폼에 영영 들어갈 수 없다. */
  if (view === 'list' || (view === 'detail' && !current)) {
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>미팅 준비 · 회고</h3>
          <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.65, marginBottom: 12 }}>
            일반적인 상황이 아니라 <b>내일 그 미팅</b>을 준비합니다. 상대·안건·목표 세 줄이면
            그 자리에서 쓸 표현과 예상 질문이 만들어지고, 끝난 뒤에는 못 한 말을 영어로 남겨
            복습으로 이어집니다.
          </p>

          <button className="btn primary" style={{ width: '100%' }} onClick={() => setView('new')}>
            새 미팅 준비하기
          </button>

          {meetings.length === 0 ? (
            <div className="mt-empty">아직 준비한 미팅이 없어요.</div>
          ) : (
            <div className="mt-list">
              {[...meetings].reverse().map((m) => (
                <div className="mt-item" key={m.id}>
                  <button
                    className="mt-item-main"
                    onClick={() => {
                      setOpenId(m.id);
                      setView('detail');
                    }}
                  >
                    <div className="mt-item-title">{m.input.agenda}</div>
                    <div className="mt-item-sub">
                      {m.date} · {m.input.who}
                      {m.done ? ' · 회고 완료' : ` · 표현 ${m.used.length}/${m.phrases.length} 사용`}
                    </div>
                  </button>
                  <button
                    className="mt-del"
                    aria-label="이 미팅 삭제"
                    onClick={() => {
                      removeMeeting(m.id);
                      refresh();
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── 새로 만들기 ── */
  if (view === 'new') {
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>새 미팅 준비</h3>
          <p className="muted" style={{ fontSize: '0.78rem', lineHeight: 1.6, marginBottom: 12 }}>
            구체적으로 적을수록 쓸모 있는 표현이 나옵니다. 회사명 같은 민감한 정보는 빼고
            역할 위주로 적어도 충분합니다.
          </p>

          <label className="mt-field">
            <span>상대는 누구인가요?</span>
            <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="예: 제조사 인프라 팀장, 클라우드 도입 검토 중" />
          </label>
          <label className="mt-field">
            <span>무엇을 다루나요? (필수)</span>
            <input value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="예: 온프레미스 DB를 클라우드로 옮기는 1차 제안" />
          </label>
          <label className="mt-field">
            <span>이 미팅에서 얻고 싶은 것은?</span>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="예: PoC 일정 합의" />
          </label>

          {!hasKey && <p className="warn">AI 키가 없어 준비 자료를 만들 수 없어요. 기능 → AI 키 등록에서 먼저 연결해 주세요.</p>}
          {err && <p className="warn">{err}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => setView('list')}>
              뒤로
            </button>
            <button className="btn primary" style={{ flex: 1 }} onClick={create} disabled={busy || !hasKey}>
              {busy ? '준비 자료 만드는 중…' : '준비 자료 만들기'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 상세: 준비 → 리허설 → 회고 ── */
  const m = current;
  // 위 두 분기에서 걸러지지만 타입상 좁혀지지 않는다
  if (!m) return null;
  return (
    <div className="study-screen">
      <div className="study-card">
        <button className="btn ghost mt-back" onClick={() => setView('list')}>
          ← 목록
        </button>
        <h3>{m.input.agenda}</h3>
        <div className="mt-meta">
          {m.date} · {m.input.who} · 목표: {m.input.goal}
        </div>

        {m.headline && (
          <div className="mt-headline">
            {m.headline} <SpeakButton text={m.headline} />
          </div>
        )}

        <div className="mt-sec">이 미팅에서 쓸 표현</div>
        <div className="mt-hint">실제로 말한 표현은 체크해 두세요 — 주간 리포트에서 실전 사용으로 잡힙니다.</div>
        {m.phrases.map((p) => (
          <div className={`mt-phrase${m.used.includes(p.en) ? ' used' : ''}`} key={p.en}>
            <button className="mt-check" aria-label={m.used.includes(p.en) ? '사용 취소' : '실제로 사용함'} onClick={() => toggleUsed(m, p.en)}>
              {m.used.includes(p.en) ? '✓' : ''}
            </button>
            <div className="mt-phrase-body">
              <div className="mt-en">
                {p.en} <SpeakButton text={p.en} /> <SpeakButton text={p.en} slow />
              </div>
              <div className="mt-kr">{p.kr}</div>
            </div>
          </div>
        ))}

        <div className="mt-actions">
          <button
            className="btn ghost-accent"
            onClick={() => {
              setDrillQueue({ label: `미팅 준비 — ${m.input.agenda}`, items: m.phrases });
              onNavigate?.('drill');
            }}
          >
            표현 드릴하기 →
          </button>
          <button
            className="btn ghost-accent"
            onClick={() => {
              setTalkContext({
                title: `미팅 리허설 — ${m.input.agenda}`,
                desc: m.talkPrompt,
                examples: m.phrases.slice(0, 3),
              });
              onNavigate?.('talk');
            }}
          >
            AI와 리허설 →
          </button>
        </div>

        <div className="mt-sec">예상 질문 · 반론</div>
        {m.questions.map((q) => (
          <div className="mt-q" key={q.en}>
            <div className="mt-q-en">
              Q. {q.en} <SpeakButton text={q.en} />
            </div>
            <div className="mt-q-kr">{q.kr}</div>
            <div className="mt-a-en">
              A. {q.answer.en} <SpeakButton text={q.answer.en} />
            </div>
            <div className="mt-q-kr">{q.answer.kr}</div>
          </div>
        ))}

        <div className="mt-sec">미팅 후 회고</div>
        <div className="mt-hint">
          영어로 <b>하고 싶었는데 못 한 말</b>을 한국어로 적어주세요(한 줄에 하나). 영어 문장으로 바꿔
          표현장과 복습 큐에 넣어 둡니다 — 실전에서 막힌 문장이 가장 잘 남습니다.
        </div>
        <textarea
          className="mt-gap-input"
          rows={4}
          value={gapText}
          onChange={(e) => setGapText(e.target.value)}
          placeholder={'예: 그건 저희 쪽에서 확인하고 내일 회신드리겠다\n예: 지금 단계에서 가격을 확정하긴 이르다'}
        />
        {err && <p className="warn">{err}</p>}
        <button className="btn primary" style={{ width: '100%' }} onClick={() => submitGaps(m)} disabled={gapBusy || !gapText.trim() || !hasKey}>
          {gapBusy ? '영어로 바꾸는 중…' : '영어로 바꿔 복습에 넣기'}
        </button>

        {m.gaps.length > 0 && (
          <>
            <div className="mt-sec">회고에서 건진 표현</div>
            {m.gaps.map((g) => (
              <div className="mt-gap" key={g.en}>
                <div className="mt-en">
                  {g.en} <SpeakButton text={g.en} />
                </div>
                <div className="mt-kr">{g.kr}</div>
              </div>
            ))}
            <button
              className="btn ghost-accent"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => {
                setDrillQueue({ label: `미팅 회고 — ${m.input.agenda}`, items: m.gaps.map((g) => ({ en: g.en, kr: g.kr })) });
                onNavigate?.('drill');
              }}
            >
              못 한 말 드릴하기 →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
