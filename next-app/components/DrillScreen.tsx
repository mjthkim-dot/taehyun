'use client';

/**
 * 드릴(말하기 연습) 화면 — v1.
 * 원본 앱의 전체 드릴 시스템(쉐도잉/미니멀 페어 등)은 아직 포팅 전이며,
 * 우선 레슨 예문을 순서대로 큐에 넣어 SpeakingPractice(STT+정확도 평가)로 연습하는
 * 기본 플로우만 제공한다.
 */
import { useMemo, useState } from 'react';
import { ALL_LESSONS, LESSONS } from '../lib/lessons';
import SpeakingPractice from './SpeakingPractice';

export default function DrillScreen({ lessonId }: { lessonId: number }) {
  const lesson = useMemo(
    () => ALL_LESSONS.find((l) => l.id === lessonId) ?? LESSONS[LESSONS.length - 1],
    [lessonId]
  );
  const items = lesson.examples ?? [];
  const [idx, setIdx] = useState(0);

  if (!items.length) {
    return (
      <div className="study-card">
        <p className="muted">이 레슨에는 드릴용 예문이 없어요. 다른 레슨을 선택해주세요.</p>
      </div>
    );
  }

  const cur = items[Math.min(idx, items.length - 1)];

  return (
    <div className="drill-screen">
      <div className="drill-progress muted">
        {idx + 1} / {items.length}
      </div>
      <SpeakingPractice key={idx} sentence={cur.en} />
      <div className="kr muted" style={{ marginTop: 8 }}>
        {cur.kr}
      </div>
      <div className="drill-nav">
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          ← 이전
        </button>
        <button
          type="button"
          disabled={idx >= items.length - 1}
          onClick={() => setIdx((i) => i + 1)}
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
