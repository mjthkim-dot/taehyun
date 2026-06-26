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
import { addWeakItem, bumpSkill, buildTodayQueue, gradeWeakItem, groqKey, markPracticedToday, type DrillItem, type FlashGrade } from '../lib/state';
import { groqComplete, GroqError } from '../lib/groq';
import { useLessonStore } from '../store/useLessonStore';
import SpeakingPractice from './SpeakingPractice';

const LOW_SCORE_THRESHOLD = 70;

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
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [coachTip, setCoachTip] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  // 한국어 뜻을 보고 영어로 말하기(영작) 모드 — 기본값. 끄면 영어를 보고 따라 읽기.
  const [krMode, setKrMode] = useState(true);

  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const missedWords = useLessonStore((s) => s.missedWords);

  useEffect(() => {
    setItems(auto ? buildTodayQueue(lesson.examples ?? []) : baseItems);
    setIdx(0);
    setScores([]);
    setFinished(false);
    setCoachTip(null);
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
    setFinished(false);
    setCoachTip(null);
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
      const weakSentences = items
        .map((it, i) => ({ en: it.en, score: scores[i] }))
        .filter((s) => typeof s.score === 'number' && s.score < LOW_SCORE_THRESHOLD);
      const sys = 'You are an English pronunciation coach for a Korean learner. Output ONLY JSON.';
      const user = `The learner practiced shadowing these sentences and a speech-recognizer scored each one (0-100, lower = likely mispronounced or missed words):
${JSON.stringify(weakSentences)}
Return JSON: {"tips":["2-3 specific Korean-language tips about likely pronunciation issues (e.g. consonant clusters, word stress, linking sounds) based on these sentences",...]}`;
      const raw = await groqComplete([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, maxTokens: 400, temperature: 0.4 });
      const data = JSON.parse(raw);
      setCoachTip((data.tips || []).join('\n'));
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

          {!coachTip && (
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
          {coachTip && (
            <div style={{ textAlign: 'left', background: 'var(--surface2)', borderRadius: 10, padding: 12, marginTop: 12, fontSize: '0.82rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {coachTip}
            </div>
          )}
        </div>
      </div>
    );
  }

  const cur = items[Math.min(idx, items.length - 1)];

  return (
    <div className="drill-screen">
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
