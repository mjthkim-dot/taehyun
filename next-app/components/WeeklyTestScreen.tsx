'use client';

/**
 * 주간 말하기 시험 화면 — 이번 주 패턴 3개를 제시하고, 1분간 멈추지 않고 말하게
 * 한 뒤 단어 수·WPM·패턴 사용을 돌려준다. 지난주 기록과 나란히 보여 "내가
 * 늘고 있는가"를 스스로 확인하는 리추얼이다.
 */
import { useEffect, useRef, useState } from 'react';
import type { Mode } from './NavBar';
import { patternsForTest, recordWeeklyTest, lastWeeklyTest, type WeeklyTestResult } from '../lib/weeklyTest';
import { detectPatternUse, PATTERN_STEMS } from '../lib/transfer';
import { recordAndTranscribe, whisperAvailable } from '../lib/stt';
import { markPracticedToday, bumpSpoken } from '../lib/state';
import { speakText } from './SpeakButton';
import { SpeakerIcon } from './icons';
import { Confetti } from './Fx';

const TEST_MS = 60000;

export default function WeeklyTestScreen({ onNavigate }: { onNavigate: (m: Mode) => void }) {
  const [stage, setStage] = useState<'intro' | 'speaking' | 'transcribing' | 'result'>('intro');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<(WeeklyTestResult & { prev: WeeklyTestResult | null }) | null>(null);
  const [error, setError] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  const [patterns] = useState(() => patternsForTest());
  const prevRef = useRef(lastWeeklyTest());

  useEffect(() => () => stopRef.current?.(), []);

  async function start() {
    setError('');
    setStage('speaking');
    try {
      const res = await recordAndTranscribe({
        maxMs: TEST_MS + 15000,
        silenceMs: 0, // 스스로 멈추거나 시간이 다 될 때까지
        onElapsed: (ms) => {
          setElapsed(ms);
          if (ms >= TEST_MS) stopRef.current?.();
        },
        onState: (st) => {
          if (st === 'transcribing') setStage('transcribing');
        },
        registerStop: (fn) => {
          stopRef.current = fn;
        },
      });
      stopRef.current = null;
      if (!res.text) {
        setError('말소리를 인식하지 못했어요 — 마이크를 확인하고 다시 시도해 주세요.');
        setStage('intro');
        return;
      }
      const words = (res.text.match(/[A-Za-z']+/g) || []).length;
      const seconds = Math.round((res.durationMs ?? TEST_MS) / 1000);
      const wpm = seconds > 0 ? Math.round((words / seconds) * 60) : 0;
      const used = detectPatternUse(res.text, patterns.map((p) => p.key));
      const record: WeeklyTestResult = { date: new Date().toISOString().slice(0, 10), seconds, words, wpm, used };
      recordWeeklyTest(record);
      markPracticedToday();
      bumpSpoken();
      setResult({ ...record, prev: prevRef.current });
      setStage('result');
    } catch (e) {
      stopRef.current = null;
      const msg = (e as Error)?.message || '';
      setError(/NotAllowed|Permission/i.test(msg) ? '마이크 권한이 거부됐어요 — 브라우저 설정에서 허용해 주세요.' : '녹음을 시작하지 못했어요.');
      setStage('intro');
    }
  }

  if (stage === 'result' && result) {
    const better = result.prev && result.words > result.prev.words;
    return (
      <div className="study-screen">
        <div className="study-card wt-result" style={{ textAlign: 'center', position: 'relative' }}>
          {result.used.length >= 2 && <Confetti burstId={3} />}
          <h3>📣 이번 주 기록</h3>
          <div className="wt-nums">
            <div><b>{result.words}</b><span>단어</span></div>
            <div><b>{result.wpm}</b><span>분당 단어</span></div>
            <div><b>{result.used.length}</b><span>패턴 사용</span></div>
          </div>
          {result.used.length > 0 && (
            <p className="wt-used">✨ {result.used.map((k) => PATTERN_STEMS[k]?.[0] || k).join(' · ')}</p>
          )}
          {result.prev ? (
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
              지난 시험({result.prev.date}): {result.prev.words}단어 · 패턴 {result.prev.used.length}개
              {better && <> — <b style={{ color: 'var(--green)' }}>더 많이 말했어요!</b></>}
            </p>
          ) : (
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>첫 기록이에요 — 다음 주의 나와 비교하게 됩니다.</p>
          )}
          <button className="start-drill-btn" style={{ marginTop: 14 }} onClick={() => onNavigate('master')}>홈으로</button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>📣 주간 말하기 시험 — 1분</h3>
        <p className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.65, marginBottom: 12 }}>
          아래 패턴들을 섞어, 이번 주 업무 이야기를 <b>1분간 멈추지 않고</b> 말해보세요.
          완벽한 문장이 아니어도 좋아요 — 측정하는 건 유창함이지 정답이 아닙니다.
        </p>
        {patterns.map((p) => (
          <div className="wt-pattern" key={p.key}>
            <b>{p.en}</b>
            <button type="button" className="speak-mini" aria-label={`${p.ex} 듣기`} onClick={() => speakText(p.ex, 'en-US')}><SpeakerIcon /></button>
          </div>
        ))}
        {!whisperAvailable() && <p className="warn" style={{ marginTop: 10 }}>이 기기에서는 녹음을 쓸 수 없어요.</p>}
        {stage === 'speaking' ? (
          <>
            <div className="wt-timer">{Math.max(0, Math.ceil((TEST_MS - elapsed) / 1000))}초</div>
            <button className="start-drill-btn" style={{ marginTop: 8 }} onClick={() => stopRef.current?.()}>
              ⏹ 끝내기
            </button>
          </>
        ) : stage === 'transcribing' ? (
          <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>기록을 옮기는 중…</p>
        ) : (
          <button className="start-drill-btn" style={{ marginTop: 12 }} disabled={!whisperAvailable()} onClick={start}>
            🎙 시작 — 1분 말하기
          </button>
        )}
        {error && <p className="warn" style={{ marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  );
}
