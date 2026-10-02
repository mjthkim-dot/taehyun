'use client';

/**
 * 이달의 1분(M10) — 월 1회(첫째 일요일부터, 또는 지난 녹음에서 30일) 고정 질문에 1분 무정지로 답한다.
 *
 *   · 키 있음: 받아써서 WPM·멈춤·채움말 → 프롬프트 없이·temperature 0으로 한 번 더 받아써 '이해가능성'
 *     (두 전사가 얼마나 같은 단어로 들렸나) → 시도 로그 src 'monthly'
 *   · 키 없음: 녹음·길이만(지난달 vs 이번 달 소리 비교는 그대로 된다)
 * 녹음은 putRecording(kind 'monthly', 영구 보존). 그 뒤 '지난달 나 ▶ / 이번 달 나 ▶' A/B와 숫자 비교,
 * 그리고 외부 튜터 점수(1~9 버튼, 선택) — 앱 지표와 방향이 맞는지 보는 앵커(lib/anchor).
 * 노출 위치는 진도 '말하기' 섹션 맨 위뿐(홈 첫 청크 예산 때문에 홈 배너는 두지 않는다).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { todayKey } from '../lib/dates';
import { BASELINE_GUIDES } from '../lib/baseline';
import {
  addMonthly,
  compareTarget,
  intelligibilityOf,
  monthlyEntries,
  monthlyQuestionFor,
  recPath,
  retranscribePlain,
  wpmScore,
  type MonthlyEntry,
} from '../lib/growthArchive';
import { ANCHOR_AXES, ANCHOR_SCORES, anchors, setAnchor, type AnchorMap } from '../lib/anchor';
import { recordAndTranscribe, createUnlockedAudioContext, STT_PROPER_NOUNS } from '../lib/stt';
import { pausesFromWords, FILLER_RE } from '../lib/fluency';
import { logAttempt } from '../lib/reviewEngine';
import { listRecordings, putRecording } from '../lib/storage';
import { addMinutes } from '../lib/timeBudget';
import { bumpSpoken } from '../lib/state';
import { speakText, stopSpeaking } from './SpeakButton';
import { ClipRow, RecMeter, TAEO_VOICE } from './progress/GaBits';

type Phase = 'idle' | 'rec' | 'wait' | 'done' | 'gate';

const countFillers = (text: string) => (String(text || '').match(FILLER_RE) || []).length;

export default function MonthlyVoiceCard({ due, onSaved }: { due: boolean; onSaved?: () => void }) {
  const today = todayKey();
  const q = useMemo(() => monthlyQuestionFor(today), [today]);
  const path = useMemo(recPath, []);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [lv, setLv] = useState(0);
  const [msg, setMsg] = useState('');
  const [cur, setCur] = useState<MonthlyEntry | null>(() => monthlyEntries().find((e) => e.date.slice(0, 7) === today.slice(0, 7)) || null);
  const [clips, setClips] = useState<{ prev?: Blob; cur?: Blob }>({});
  const [anc, setAnc] = useState<AnchorMap>(() => anchors());
  const stop = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current?.();
    };
  }, []);

  const cmp = cur ? compareTarget(cur) : null;

  // 비교 녹음 Blob 꺼내기(이번 달 것은 방금 녹음했으면 이미 있다)
  useEffect(() => {
    if (!cur) return;
    let on = true;
    void listRecordings('monthly').then((all) => {
      if (!on) return;
      const byId = (id?: string) => (id ? all.find((r) => r.id === id)?.blob : undefined);
      setClips((c) => ({ prev: byId(cmp?.prev.id) ?? c.prev, cur: c.cur ?? byId(cur.id) }));
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id, cmp?.prev.id]);

  if (!due && !cur) return null;

  async function start() {
    setMsg('');
    const audioCtx = createUnlockedAudioContext();
    stopSpeaking();
    setElapsed(0);
    setPhase('rec');
    try {
      const res = await recordAndTranscribe({
        prompt: STT_PROPER_NOUNS,
        language: 'en',
        silenceMs: 0,
        maxMs: q.sec * 1000,
        detail: 'words',
        temperature: 0,
        recordOnly: path !== 'whisper',
        audioCtx,
        registerStop: (f) => (stop.current = f),
        onElapsed: (ms) => alive.current && setElapsed(ms),
        onLevel: (v) => alive.current && setLv(Math.min(1, v * 8)),
        onState: (s) => s === 'transcribing' && alive.current && setPhase('wait'),
      });
      stop.current = null;
      if (!alive.current) return;
      if (res.reason === 'no-audio' || !res.audio) {
        setMsg('소리가 잡히지 않았어요 — 마이크를 확인하고 다시 눌러 주세요.');
        setPhase('gate');
        return;
      }
      setPhase('wait');
      const durationMs = res.durationMs || 0;
      const text = (res.text || '').trim();
      const scored = path === 'whisper' && res.reason === 'ok' && !!text;
      let intelligibility: number | undefined;
      if (scored) {
        const plain = await retranscribePlain(res.audio);
        const v = plain == null ? null : intelligibilityOf(text, plain);
        if (v != null) intelligibility = v;
      }
      const wpm = scored ? Math.round(res.fluency?.wpm ?? 0) : undefined;
      const id = await putRecording({ kind: 'monthly', blob: res.audio, mime: res.audio.type || 'audio/webm', durationMs, question: q.en, en: scored ? text : undefined, wpm });
      const e: MonthlyEntry = {
        date: today,
        qid: q.id,
        durationMs,
        ...(id ? { id } : {}),
        ...(scored
          ? {
              wpm,
              words: res.words?.length || text.split(/\s+/).filter(Boolean).length,
              longPauses: res.words?.length ? pausesFromWords(res.words).length : res.pauses?.length || 0,
              fillers: countFillers(text),
              ...(intelligibility != null ? { intelligibility } : {}),
            }
          : { keyless: true }),
      };
      addMonthly(e);
      if (scored) logAttempt({ t: Date.now(), en: q.en, score: wpmScore(wpm || 0), src: 'monthly', durationMs, wpm, latencyMs: res.voiceOnsetMs, quality: 'ok' });
      bumpSpoken(1, scored ? 'scored' : 'self');
      addMinutes('output', Math.max(0.1, Math.round((durationMs / 60000) * 10) / 10));
      if (!alive.current) return;
      setClips((c) => ({ ...c, cur: res.audio }));
      setCur(e);
      setPhase('done');
      onSaved?.();
    } catch {
      stop.current = null;
      if (!alive.current) return;
      setMsg('마이크를 열지 못했어요 — 권한을 확인하고 다시 눌러 주세요.');
      setPhase('gate');
    }
  }

  const month = today.slice(0, 7);
  const prev = cmp?.prev;
  const prevLabel = prev ? (cmp?.sameQuestion ? `${prev.date.slice(5, 7).replace(/^0/, '')}월 나 ▶` : '지난번 나 ▶') : '';
  const num = (a?: number, b?: number, unit = '') => (typeof b === 'number' ? (typeof a === 'number' ? `${a}${unit} → ${b}${unit}` : `${b}${unit}`) : '–');

  return (
    <div className="study-card ga-monthly" data-phase={cur && phase !== 'rec' && phase !== 'wait' ? 'done' : phase}>
      <div className="ga-title">{BASELINE_GUIDES.monthly}</div>
      {!cur && (phase === 'idle' || phase === 'gate') && (
        <>
          <p className="ga-q" lang="en">
            {q.en}
            <button type="button" className="mini-btn ga-q-play" aria-label="질문 듣기" onClick={() => speakText(q.en, 'en-US', 0.95, undefined, TAEO_VOICE)}>
              🔊
            </button>
          </p>
          <p className="ga-q-kr">{q.kr}</p>
          {msg && (
            <p className="ga-msg" role="status">
              {msg}
            </p>
          )}
          {path === 'none' ? (
            <p className="ga-note">이 기기는 녹음을 쓸 수 없어요.</p>
          ) : (
            <button type="button" className="btn primary ga-start" onClick={() => void start()}>
              🎙 {phase === 'gate' ? '다시 녹음' : '1분 녹음 시작'}
            </button>
          )}
          {path === 'record' && <p className="ga-note">{BASELINE_GUIDES.noKey}</p>}
        </>
      )}
      {phase === 'rec' && <RecMeter elapsed={elapsed} sec={q.sec} level={lv} onStop={() => stop.current?.()} />}
      {phase === 'wait' && (
        <p className="ga-status" role="status">
          … 받아쓰는 중
        </p>
      )}
      {cur && phase !== 'rec' && phase !== 'wait' && (
        <div className="ga-result" role="status">
          <p className="ga-saved">✓ 이번 달 1분 저장{prev ? ` — ${cmp?.sameQuestion ? '같은 질문' : '지난번'}과 비교해요` : ' — 다음 달부터 비교해요'}</p>
          <div className="ga-cmp">
            <span className="ga-chip">WPM {num(prev?.wpm, cur.wpm)}</span>
            <span className="ga-chip">긴 멈춤 {num(prev?.longPauses, cur.longPauses)}</span>
            <span className="ga-chip">이해가능성 {num(prev?.intelligibility, cur.intelligibility, '%')}</span>
          </div>
          <ClipRow
            title="지난달 vs 이번 달"
            items={[
              { label: prevLabel || '지난번 나 ▶', clip: clips.prev },
              { label: '이번 달 나 ▶', clip: clips.cur },
            ]}
          />
          <div className="ga-anchor">
            <div className="ga-anchor-h">튜터 점수(선택) — 이번 달 수업에서 받은 점수를 눌러 두면 앱 지표와 방향을 비교해요</div>
            {ANCHOR_AXES.map((ax) => (
              <div key={ax.key} className="ga-anchor-row" role="group" aria-label={`튜터 점수 — ${ax.kr}`}>
                <span className="ga-anchor-lbl">{ax.kr}</span>
                <div className="ga-anchor-btns">
                  {ANCHOR_SCORES.map((n) => {
                    const on = anc[month]?.[ax.key] === n;
                    return (
                      <button key={n} type="button" className={`ga-score${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setAnc(setAnchor(month, ax.key, n))}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
