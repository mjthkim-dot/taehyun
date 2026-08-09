'use client';

/**
 * 드릴(말하기 연습) 화면 — 레슨 예문을 순서대로 큐에 넣어 SpeakingPractice(STT+단어별
 * 정확도 평가)로 연습한다. 끝까지 돌면 평균 정확도를 말하기 스킬에 반영하고,
 * 정확도가 낮았던 문장은 간격 반복 복습(SRS) 큐에 추가한다.
 * auto=true(홈의 "⚡ 오늘의 훈련")면 오늘 복습할 SRS 문장을 큐 앞쪽에 섞어 넣고,
 * 그 문장을 채점할 때는 점수로 SRS 박스를 직접 갱신한다(말하기로 복습을 닫는 루프).
 * AI 발음 코칭은 사용자가 직접 눌렀을 때만 1회 호출되는 옵트인 기능 — 평소 흐름에서는
 * Groq API를 전혀 쓰지 않는다(무료 한도 보호).
 */
import { useEffect, useMemo, useState } from 'react';
import { ALL_LESSONS, LESSONS, CEFR_GSE, cefrOf } from '../lib/lessons';
import { addWeakItem, bumpSkill, buildTodayQueue, gradeWeakItem, groqKey, markPracticedToday, takeDrillQueue, type DrillItem, type FlashGrade } from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import { useLessonStore } from '../store/useLessonStore';
import SpeakingPractice from './SpeakingPractice';
import { speakText } from './SpeakButton';
import { SpeakerIcon } from './icons';
import { rateLabel, useSlowRate } from './SpeechRate';

const LOW_SCORE_THRESHOLD = 70;

/** AI 발음 코칭 한 건 — 문제가 된 소리(영어) + 한국어 설명 + 연습 문장 */
interface CoachTip {
  focus: string;
  tip: string;
  example?: string;
}

const HANGUL_RE = /[가-힣]/;

/** 모델 응답을 CoachTip 배열로 정돈한다 — 문자열 배열(구형식)도 받아준다. */
function parseCoachTips(raw: string): CoachTip[] {
  const data = JSON.parse(raw);
  const arr = Array.isArray(data.tips) ? data.tips : [];
  return arr
    .map((t: unknown): CoachTip | null => {
      if (typeof t === 'string') return t.trim() ? { focus: '', tip: t.trim() } : null;
      if (t && typeof t === 'object') {
        const o = t as Record<string, unknown>;
        const tip = typeof o.tip === 'string' ? o.tip.trim() : '';
        if (!tip) return null;
        return {
          focus: typeof o.focus === 'string' ? o.focus.trim() : '',
          tip,
          example: typeof o.example === 'string' && o.example.trim() ? o.example.trim() : undefined,
        };
      }
      return null;
    })
    .filter((t: CoachTip | null): t is CoachTip => t !== null)
    .slice(0, 3);
}

function scoreToGrade(score: number): FlashGrade {
  if (score >= 90) return 'easy';
  if (score >= LOW_SCORE_THRESHOLD) return 'good';
  if (score >= 50) return 'hard';
  return 'again';
}

export default function DrillScreen({ lessonId, auto = false }: { lessonId: number; auto?: boolean }) {
  const lesson = useMemo(
    () => ALL_LESSONS.find((l) => l.id === lessonId) ?? LESSONS[LESSONS.length - 1],
    [lessonId]
  );
  const baseItems = useMemo<DrillItem[]>(
    () => (lesson.examples ?? []).map((it) => ({ en: it.en, kr: it.kr, fromWeak: false })),
    [lesson]
  );
  const [items, setItems] = useState<DrillItem[]>(baseItems);
  /** 어휘·스크립트에서 넘어온 큐의 출처 — 무엇을 연습 중인지 화면에 밝힌다 */
  const [handoffLabel, setHandoffLabel] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  /** 문장별로 인식되지 않은 단어들 — AI 코칭에 "무엇이 안 들렸는지"를 알려준다 */
  const [missedLog, setMissedLog] = useState<Record<number, string[]>>({});
  const [finished, setFinished] = useState(false);
  const [coachTips, setCoachTips] = useState<CoachTip[] | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  // 한국어 뜻을 보고 영어로 말하기(영작) 모드 — 기본값. 끄면 영어를 보고 따라 읽기.
  const [krMode, setKrMode] = useState(true);
  const slow = useSlowRate();

  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const missedWords = useLessonStore((s) => s.missedWords);

  useEffect(() => {
    // 어휘·미팅 스크립트에서 넘어온 큐가 있으면 그걸 먼저 쓴다(1회 소비).
    const handoff = takeDrillQueue();
    if (handoff) {
      setHandoffLabel(handoff.label);
      setItems(handoff.items.map((it) => ({ en: it.en, kr: it.kr, fromWeak: false })));
    } else {
      setHandoffLabel(null);
      setItems(auto ? buildTodayQueue(lesson.examples ?? []) : baseItems);
    }
    setIdx(0);
    setScores([]);
    setMissedLog({});
    setFinished(false);
    setCoachTips(null);
    setCoachError(null);
  }, [lessonId, lesson, auto, baseItems]);

  if (!items.length) {
    return (
      <div className="study-card">
        <p className="muted">이 레슨에는 드릴용 예문이 없어요. 다른 레슨을 선택해주세요.</p>
      </div>
    );
  }

  function commitScore(): number[] {
    const next = scores.slice();
    if (accuracyScore > 0) {
      next[idx] = accuracyScore;
      if (missedWords.length) setMissedLog((m) => ({ ...m, [idx]: missedWords }));
      const item = items[idx];
      if (item.fromWeak) {
        gradeWeakItem(item.en, scoreToGrade(accuracyScore));
      } else if (accuracyScore < LOW_SCORE_THRESHOLD) {
        addWeakItem({ en: item.en, kr: item.kr, lesson: lessonId, cat: 'speaking' });
      }
    }
    setScores(next);
    return next;
  }

  function goNext() {
    const next = commitScore();
    if (idx >= items.length - 1) {
      const recorded = next.filter((s) => typeof s === 'number');
      const avg = recorded.length ? Math.round(recorded.reduce((a, b) => a + b, 0) / recorded.length) : 0;
      const cefr = cefrOf(lesson);
      const band = CEFR_GSE[cefr];
      const gse = Math.round(band.min + (band.max - band.min) * (avg / 100));
      bumpSkill('speaking', gse);
      markPracticedToday();
      setFinished(true);
    } else {
      setIdx((i) => i + 1);
    }
  }

  function restart() {
    setIdx(0);
    setScores([]);
    setMissedLog({});
    setFinished(false);
    setCoachTips(null);
    setCoachError(null);
  }

  async function getAiTip() {
    if (!groqKey()) {
      setCoachError('NO_KEY');
      return;
    }
    setCoachLoading(true);
    setCoachError(null);
    try {
      // 낮았던 문장 + 그때 인식되지 않은 단어를 함께 보낸다 — "무엇이 안 들렸는지"가
      // 있어야 코칭이 구체적이 된다(없으면 모델이 일반론을 늘어놓는다).
      const weakSentences = items
        .map((it, i) => ({ en: it.en, score: scores[i], missed: missedLog[i] ?? [] }))
        .filter((s) => typeof s.score === 'number' && s.score < LOW_SCORE_THRESHOLD)
        .slice(0, 5);
      const sys =
        'You are an English pronunciation coach for Korean learners. 모든 설명(tip)은 반드시 한국어 존댓말로 작성한다. 영어 문장으로 설명하면 안 된다. Output ONLY JSON.';
      const user = `한국인 학습자가 아래 영어 문장들을 소리 내어 말했는데 음성 인식 점수가 낮았습니다(0~100). "missed"는 인식되지 않은 단어들 — 발음이 뭉개졌을 가능성이 큽니다.
${JSON.stringify(weakSentences)}
다음 JSON 형식으로 답하세요:
{"tips":[{"focus":"문제가 된 영어 단어나 소리 (예: two, water의 t)","tip":"한국어 설명 2문장 이내 — 왜 안 들렸는지, 입모양·혀 위치·한글 발음 비유로 어떻게 고치는지 (예: '포 투'처럼 끊지 말고 '포투'처럼 붙여서)","example":"그 소리를 연습할 8단어 이하의 쉬운 영어 문장"}]}
규칙: tips는 2~3개. tip 필드는 반드시 한국어로 쓰고, linking·stress 같은 전문용어 대신 쉬운 우리말로 설명한다. focus와 example만 영어를 쓴다.`;
      const ask = (extraSys: string) =>
        groqComplete(
          [{ role: 'system', content: sys + extraSys }, { role: 'user', content: user }],
          { json: true, maxTokens: 600, temperature: 0.4 }
        );
      let tips = parseCoachTips(await ask('')).filter((t) => HANGUL_RE.test(t.tip));
      if (!tips.length) {
        // 모델이 영어로 답하는 경우가 있다 — 한국어가 하나도 없으면 한 번만 다시 묻는다.
        tips = parseCoachTips(
          await ask(' 직전 답변이 영어였다. 이번에는 tip 필드를 반드시 한국어로만 작성하라.')
        ).filter((t) => HANGUL_RE.test(t.tip));
      }
      if (!tips.length) {
        setCoachError('코칭을 만들지 못했어요 — 잠시 후 다시 시도해 주세요.');
      } else {
        setCoachTips(tips);
      }
    } catch (e) {
      setCoachError(e instanceof GroqError ? e.message : String(e));
    } finally {
      setCoachLoading(false);
    }
  }

  if (finished) {
    const recorded = scores.filter((s) => typeof s === 'number');
    const avg = recorded.length ? Math.round(recorded.reduce((a, b) => a + b, 0) / recorded.length) : 0;
    const lowCount = recorded.filter((s) => s < LOW_SCORE_THRESHOLD).length;
    const reviewCount = items.filter((it) => it.fromWeak).length;
    return (
      <div className="drill-screen">
        <div className="study-card" style={{ textAlign: 'center', border: '1px solid var(--primary)', padding: 20 }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>드릴 평균 정확도</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary-light)', margin: '4px 0' }}>{avg}%</div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>말하기 스킬에 반영됐어요</div>
          {reviewCount > 0 && (
            <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
              📝 간격 반복 복습 문장 {reviewCount}개를 다시 말해보며 복습했어요.
            </div>
          )}
          {lowCount > 0 && (
            <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
              정확도 {LOW_SCORE_THRESHOLD}% 미만 {lowCount}문장은 간격 반복 복습(암기 카드)에 추가됐어요.
            </div>
          )}
          <button className="start-drill-btn" style={{ marginTop: 14 }} onClick={restart}>↻ 다시 (처음부터)</button>

          {!coachTips && (
            <button className="btn" style={{ marginTop: 10 }} disabled={coachLoading || lowCount === 0} onClick={getAiTip}>
              {coachLoading ? '🤖 분석 중...' : lowCount === 0 ? '🎉 모든 문장 정확해요' : '🤖 AI 발음 코칭 받기'}
            </button>
          )}
          {coachError === 'NO_KEY' && (
            <p style={{ fontSize: '0.78rem', color: 'var(--yellow)', marginTop: 10 }}>🤖 AI 발음 코칭은 Groq 키 연결 후 사용할 수 있어요.</p>
          )}
          {coachError && coachError !== 'NO_KEY' && (
            <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginTop: 10 }}>{coachError}</p>
          )}
          {coachTips && (
            <div className="coach-tips">
              <div className="coach-tips-head">AI 발음 코칭 — 이번 드릴에서 잡힌 것</div>
              {coachTips.map((t, i) => (
                <div className="coach-tip" key={i}>
                  {t.focus && (
                    <div className="coach-tip-top">
                      <b className="coach-focus">{t.focus}</b>
                      <button
                        type="button"
                        className="speak-mini"
                        aria-label={`${t.focus} ${rateLabel(slow)} 느리게 듣기`}
                        title={`${rateLabel(slow)} 느리게 듣기`}
                        onClick={() => speakText(t.focus, 'en-US', slow)}
                      >
                        <SpeakerIcon />
                      </button>
                    </div>
                  )}
                  <div className="coach-tip-body">{t.tip}</div>
                  {t.example && (
                    <button type="button" className="coach-example" onClick={() => speakText(t.example!, 'en-US')}>
                      <SpeakerIcon /> {t.example}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const cur = items[Math.min(idx, items.length - 1)];

  return (
    <div className="drill-screen">
      {handoffLabel && <div className="drill-source">{handoffLabel} 연습 중</div>}
      <div className="drill-progress muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>
          {idx + 1} / {items.length}
          {typeof scores[idx] === 'number' && ` · 이번 정확도 ${scores[idx]}%`}
        </span>
        <button
          type="button"
          className="mini-btn"
          onClick={() => setKrMode((v) => !v)}
          title="한국어 뜻을 보고 영어로 말하기 / 영어를 보고 따라 읽기 전환"
        >
          {krMode ? '🇰🇷 뜻 보고 말하기' : '🇺🇸 영어 보고 따라하기'}
        </button>
      </div>
      <SpeakingPractice key={idx} sentence={cur.en} prompt={cur.kr} hideTarget={krMode} />
      {!krMode && (
        <div className="kr muted" style={{ marginTop: 8 }}>
          {cur.kr}
        </div>
      )}
      <div className="drill-nav">
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          ← 이전
        </button>
        <button type="button" onClick={goNext}>
          {idx >= items.length - 1 ? '완료' : '다음 →'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
        {missedWords.length > 0 && accuracyScore > 0 ? `놓친 단어: ${missedWords.join(', ')}` : ''}
      </div>
    </div>
  );
}
