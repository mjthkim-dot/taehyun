'use client';

/**
 * 몰입 스토리 화면 — 연재 리딩·리스닝으로 입력의 절대량을 채우는 곳.
 * 화 목록 → 본문(문장 탭 = 해석 토글, 문장·전체 듣기, 속도 3단) → 퀴즈 →
 * 읽음 처리 + 단어장 SRS 등록 → "다음 화 만들기"로 이야기가 계속된다.
 * 난이도 배지는 성숙도 단계와 연동 — 승급하면 다음 화부터 올라간다.
 */
import { useEffect, useRef, useState } from 'react';
import {
  completeEpisode,
  currentLevel,
  generateNextEpisode,
  getEpisodes,
  readEpisodes,
  SERIES_TITLE,
  type Episode,
} from '../lib/immersion';
import { playDialogueAudio } from '../lib/dialogueAudio';
import { speakText, stopSpeaking } from './SpeakButton';
import { SpeakerIcon } from './icons';

const RATES = [0.7, 1, 1.2] as const;

export default function ImmersionScreen() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [read, setRead] = useState<number[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [doneMsg, setDoneMsg] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const [rate, setRate] = useState<number>(1);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  function refresh() {
    setEpisodes(getEpisodes());
    setRead(readEpisodes());
  }

  useEffect(() => {
    refresh();
    return () => {
      stopRef.current?.();
      stopSpeaking();
    };
  }, []);

  function stopAll() {
    stopRef.current?.();
    stopRef.current = null;
    setPlayingIdx(null);
  }

  function openEpisode(no: number) {
    stopAll();
    setRevealed(new Set());
    setAnswers({});
    setDoneMsg('');
    setOpen(open === no ? null : no);
  }

  function playAll(ep: Episode) {
    stopAll();
    stopRef.current = playDialogueAudio(
      { title: ep.title, lines: ep.sentences.map((s) => ({ sp: 'A', en: s.en, kr: s.kr })) },
      rate,
      setPlayingIdx,
      () => setPlayingIdx(null)
    );
  }

  function pickAnswer(ep: Episode, qi: number, oi: number) {
    if (answers[qi] !== undefined) return;
    const next = { ...answers, [qi]: oi };
    setAnswers(next);
    if (Object.keys(next).length === ep.quiz.length) {
      const correct = ep.quiz.filter((q, i) => next[i] === q.answer).length;
      const added = completeEpisode(ep);
      setRead(readEpisodes());
      setDoneMsg(
        `퀴즈 ${correct}/${ep.quiz.length} 정답 — ${ep.no}화 완료!` +
          (added > 0 ? ` 표현 ${added}개가 복습 큐에 들어갔어요.` : '')
      );
    }
  }

  async function doGenerate() {
    if (genBusy) return;
    setGenBusy(true);
    setGenMsg('');
    try {
      const r = await generateNextEpisode();
      if (r.ok && r.episode) {
        refresh();
        setGenMsg(`${r.episode.no}화 「${r.episode.titleKr}」 도착!`);
        openEpisode(r.episode.no);
      } else if (r.error === 'NO_GROQ_KEY') {
        setGenMsg('다음 화를 쓰려면 AI 키가 필요해요 — 기능 → AI 키 등록에서 무료로 만들 수 있어요.');
      } else {
        setGenMsg('다음 화 생성에 실패했어요 — 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setGenBusy(false);
    }
  }

  const level = currentLevel();

  return (
    <div className="study-screen">
      <div className="study-card rc-head">
        <div className="rc-head-title">📖 {SERIES_TITLE}</div>
        <p className="muted rc-method">
          다음 화가 궁금해서 매일 읽게 되는 연재 미스터리. 문장을 탭하면 해석이 열리고, 전체 듣기로 리스닝까지 —
          고수의 조건인 <b>입력의 절대량</b>을 여기서 채워요. 난이도는 내 성숙도 단계를 따라 자동으로 올라갑니다.
        </p>
        <div className="rc-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="rc-stat">
            <b>{episodes.length}</b>
            <span>화</span>
          </div>
          <div className="rc-stat">
            <b>{read.length}</b>
            <span>읽음</span>
          </div>
          <div className="rc-stat">
            <b>{level}</b>
            <span>현재 난이도</span>
          </div>
        </div>
      </div>

      {genMsg && <p className="pp-imported">💬 {genMsg}</p>}

      {episodes.map((ep) => {
        const isOpen = open === ep.no;
        const isRead = read.includes(ep.no);
        return (
          <div key={ep.no} className={`mn-item${isOpen ? ' open' : ''}`}>
            <button type="button" className="mn-item-head" onClick={() => openEpisode(ep.no)}>
              <span className="mn-item-title">
                {ep.no}화 · {ep.titleKr}
                <span className="rc-progress">{ep.level}</span>
                {isRead && <span className="rc-seen" style={{ marginLeft: 6 }}>읽음 ✓</span>}
              </span>
              <span className="mn-item-note">{ep.title}</span>
            </button>
            {isOpen && (
              <div className="mn-item-body">
                <div className="im-controls">
                  <button type="button" className="mini-btn" onClick={() => (playingIdx !== null ? stopAll() : playAll(ep))}>
                    {playingIdx !== null ? '⏸ 정지' : '▶ 전체 듣기'}
                  </button>
                  {RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`mini-btn${rate === r ? ' im-rate-on' : ''}`}
                      onClick={() => setRate(r)}
                    >
                      {r === 0.7 ? '느리게' : r === 1 ? '보통' : '빠르게'}
                    </button>
                  ))}
                </div>
                <p className="muted im-hint">문장을 탭하면 해석이 보여요 — 먼저 영어로만 읽어보세요.</p>

                {ep.sentences.map((s, i) => (
                  <div
                    key={i}
                    className={`im-sent${playingIdx === i ? ' playing' : ''}`}
                    onClick={() =>
                      setRevealed((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  >
                    <div className="im-sent-en">
                      {s.en}
                      <button
                        type="button"
                        className="speak-mini"
                        aria-label="듣기"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopAll();
                          speakText(s.en, 'en-US', rate);
                        }}
                      >
                        <SpeakerIcon />
                      </button>
                    </div>
                    {revealed.has(i) && <div className="im-sent-kr">{s.kr}</div>}
                  </div>
                ))}

                {ep.vocab.length > 0 && (
                  <>
                    <div className="pp-sec">💡 이번 화의 표현 (퀴즈를 풀면 복습 큐로)</div>
                    {ep.vocab.map((v, i) => (
                      <div className="pp-sent" key={i}>
                        <div className="pp-sent-en">{v.en}</div>
                        <div className="pp-sent-kr">{v.kr}</div>
                      </div>
                    ))}
                  </>
                )}

                {ep.quiz.length > 0 && (
                  <>
                    <div className="pp-sec">🧩 이해도 체크</div>
                    {ep.quiz.map((q, qi) => (
                      <div className="im-quiz" key={qi}>
                        <div className="im-quiz-q">{q.q}</div>
                        {q.options.map((o, oi) => {
                          const picked = answers[qi];
                          const cls =
                            picked === undefined
                              ? ''
                              : oi === q.answer
                                ? ' correct'
                                : picked === oi
                                  ? ' wrong'
                                  : '';
                          return (
                            <button key={oi} type="button" className={`im-quiz-opt${cls}`} onClick={() => pickAnswer(ep, qi, oi)}>
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
                {doneMsg && <p className="pp-imported">✅ {doneMsg}</p>}

                {ep.no === episodes[episodes.length - 1]?.no && (
                  <button type="button" className="start-drill-btn" style={{ marginTop: 12 }} disabled={genBusy} onClick={() => void doGenerate()}>
                    {genBusy ? '다음 화 쓰는 중…' : '✨ 다음 화 만들기 →'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
