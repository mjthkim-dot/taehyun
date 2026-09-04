'use client';

/**
 * 쉐도잉(따라 말하기) — 원어민 음성을 듣고 따라 말하면 단어별로 맞고 틀림을 색으로
 * 보여주고(기존 SpeakingPractice + computeAccuracy 재사용), 틀린 단어에 대해서는
 * AI가 발음기호(IPA)와 한국인이 흘리기 쉬운 소리 팁을 한국어로 알려준다.
 *
 * 문장은 현재 레슨 예문 + 내 표현장 + 복습(약점) 문장을 섞어 개인화된 큐로 만든다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { lessonsNow } from '../lib/lessonData';
import type { Lesson } from '../lib/lessons';
import { getPhrases, load, markPracticedToday, type WeakItem } from '../lib/state';
import { GroqError } from '../lib/groq';
import { groqKoJson, hasHangul } from '../lib/aiGuard';
import { useLessonStore } from '../store/useLessonStore';
import SpeakingPractice from './SpeakingPractice';
import EmptyState from './EmptyState';

interface ShadowItem {
  en: string;
  kr: string;
  src: '레슨' | '표현장' | '복습';
}

interface PronTip {
  word: string;
  ipa: string;
  tip_ko: string;
}

function normKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 레슨 예문 + 표현장 + 약점 문장을 섞어 쉐도잉 큐를 만든다(중복 제거, 길이 필터). */
function buildQueue(lesson: Lesson | undefined): ShadowItem[] {
  const out: ShadowItem[] = [];
  const seen = new Set<string>();
  const push = (en: string, kr: string, src: ShadowItem['src']) => {
    const e = (en || '').trim();
    if (!e || !/[A-Za-z]/.test(e)) return;
    const words = e.split(/\s+/).length;
    if (words < 1 || words > 14) return;
    const key = normKey(e);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ en: e, kr: (kr || '').trim(), src });
  };
  (lesson?.examples || []).forEach((ex) => push(ex.en, ex.kr, '레슨'));
  getPhrases().forEach((p) => push(p.en, p.kr, '표현장'));
  load<WeakItem[]>('va_weak', []).forEach((w) => push(w.en, w.kr, '복습'));
  return out.slice(0, 24);
}

async function fetchPronTips(sentence: string, words: string[]): Promise<PronTip[]> {
  const sys =
    '너는 한국인 영어 학습자를 돕는 발음 코치다. 주어진 단어들의 발음을 아래 JSON으로만 답한다(코드블록·설명 없이):\n' +
    '{ "tips": [ { "word": "단어", "ipa": "/IPA 발음기호/", "tip_ko": "한국인이 흘리기 쉬운 소리·강세·연음을 한국어로 한 문장 팁" } ] }\n' +
    '규칙: tip_ko는 반드시 한국어. 실제 발음을 정확히. 모르면 지어내지 말 것.';
  const user = `문장: "${sentence}"\n발음 팁이 필요한 단어들: ${words.join(', ')}`;
  // 팁이 영어로 오면(드릴 코칭에서 실제로 났던 사고) 걸러내고 한 번 다시 묻는다
  const tips = await groqKoJson<PronTip[]>(
    [{ role: 'system', content: sys }, { role: 'user', content: user }],
    { temperature: 0.2, maxTokens: 500 },
    (data) => {
      const parsed = (data ?? {}) as { tips?: PronTip[] };
      if (!Array.isArray(parsed.tips)) return null;
      const clean = parsed.tips
        .filter((t) => t && t.word && hasHangul(t.tip_ko))
        .map((t) => ({ word: String(t.word), ipa: String(t.ipa || ''), tip_ko: String(t.tip_ko || '') }));
      // 빈 배열은 "팁 없음"으로 정상 — 단 원본에 팁이 있었는데 전부 영어라 걸러졌다면 실패로 본다
      if (parsed.tips.length > 0 && clean.length === 0) return null;
      return clean;
    }
  );
  if (tips === null) throw new Error('발음 팁을 만들지 못했어요 — 잠시 후 다시 시도해 주세요.');
  return tips;
}

export default function ShadowingScreen({ lessonId }: { lessonId: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // LessonsGate 아래에서만 렌더되므로 동기 접근이 안전하다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queue = useMemo(() => buildQueue(lessonsNow().ALL_LESSONS.find((l) => l.id === lessonId)), [lessonId]);
  const [idx, setIdx] = useState(0);

  // 채점 결과는 전역 스토어에서 읽는다(SpeakingPractice가 채운다).
  const accuracyScore = useLessonStore((s) => s.accuracyScore);
  const missedWords = useLessonStore((s) => s.missedWords);
  const attempts = useLessonStore((s) => s.attempts);

  const [tips, setTips] = useState<PronTip[] | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState('');
  const practicedRef = useRef<Set<number>>(new Set());

  // 문장이 바뀌면 발음 팁 패널 초기화
  useEffect(() => {
    setTips(null);
    setTipsError('');
    setTipsLoading(false);
  }, [idx]);

  // 점수가 나오면 한 번만 오늘 연습으로 기록
  useEffect(() => {
    if (accuracyScore > 0 && !practicedRef.current.has(idx)) {
      practicedRef.current.add(idx);
      markPracticedToday();
    }
  }, [accuracyScore, idx]);

  if (!ready) return null;

  if (!queue.length) {
    return (
      <div className="study-screen">
        <div className="study-card">
          <h3>🦜 쉐도잉</h3>
          <EmptyState art="phrasebook" title="따라 말할 문장이 없어요">
            레슨을 선택하거나 회화·레슨에서 표현을 저장하면 그 문장으로 쉐도잉 연습을 할 수 있어요.
          </EmptyState>
        </div>
      </div>
    );
  }

  const cur = queue[idx];

  async function loadTips() {
    setTipsLoading(true);
    setTipsError('');
    try {
      const result = await fetchPronTips(cur.en, missedWords);
      setTips(result);
    } catch (err) {
      const e = err as Error;
      setTipsError(e instanceof GroqError && e.message === 'NO_GROQ_KEY'
        ? '⚡ 발음 팁은 무료 Groq 키를 등록하면 쓸 수 있어요(회화 탭).'
        : `❌ ${e.message}`);
    } finally {
      setTipsLoading(false);
    }
  }

  function go(delta: number) {
    setIdx((i) => Math.min(Math.max(i + delta, 0), queue.length - 1));
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <div className="shadow-head">
          <h3 style={{ margin: 0 }}>🦜 쉐도잉</h3>
          <span className="shadow-progress">
            {idx + 1} / {queue.length}
          </span>
        </div>
        <div className="shadow-bar">
          <div className="shadow-bar-fill" style={{ width: `${((idx + 1) / queue.length) * 100}%` }} />
        </div>

        <div className="shadow-src-row">
          <span className={`shadow-src shadow-src-${cur.src}`}>{cur.src}</span>
          <span className="shadow-hint">🔊 듣고 → 🎤 따라 말하기</span>
        </div>

        {/* 마이크 + 단어별 채점은 기존 SpeakingPractice 재사용 */}
        <SpeakingPractice key={`${idx}:${cur.en}`} sentence={cur.en} prompt={cur.kr} />

        {/* 틀린 단어 AI 발음 팁 — 쉐도잉 화면의 새 기능 */}
        {attempts > 0 && missedWords.length > 0 && accuracyScore < 100 && (
          <div className="pron-tips">
            {!tips && !tipsLoading && !tipsError && (
              <button className="btn primary pron-tips-btn" onClick={loadTips}>
                🔎 틀린 단어 발음 팁 보기 ({missedWords.length})
              </button>
            )}
            {tipsLoading && <div className="pron-tips-loading">발음 팁 불러오는 중…</div>}
            {tipsError && <div className="ask-error">{tipsError}</div>}
            {tips && tips.length > 0 && (
              <div className="pron-tips-list">
                {tips.map((t, i) => (
                  <div className="pron-tip" key={i}>
                    <div className="pron-tip-word">
                      {t.word} {t.ipa && <span className="pron-tip-ipa">{t.ipa}</span>}
                    </div>
                    {t.tip_ko && <div className="pron-tip-ko">{t.tip_ko}</div>}
                  </div>
                ))}
              </div>
            )}
            {tips && tips.length === 0 && <div className="pron-tips-loading">표시할 발음 팁이 없어요.</div>}
          </div>
        )}

        <div className="shadow-nav">
          <button className="ask-hist-btn" onClick={() => go(-1)} disabled={idx === 0}>
            ← 이전
          </button>
          <button className="ask-hist-btn" onClick={() => go(1)} disabled={idx === queue.length - 1}>
            다음 →
          </button>
        </div>
      </div>
    </div>
  );
}
