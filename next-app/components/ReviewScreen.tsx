'use client';

/** 복습(review) 화면 — voice-assistant/index.html 의 renderReview() 포팅 (SM-2 간격 반복 목록). */
import { useEffect, useState } from 'react';
import {
  dueWeak,
  pendingWeakCount,
  isLeech,
  isMastered,
  SRS_MAX_BOX,
  load,
  type WeakItem,
} from '../lib/state';
import SpeakButton from './SpeakButton';
import EmptyState from './EmptyState';

export default function ReviewScreen() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const weak = load<WeakItem[]>('va_weak', []);

  if (!weak.length) {
    return (
      <div className="study-screen">
        <EmptyState art="review" title="🎉 복습할 문장이 없습니다!">
          드릴·청해·어휘에서 틀린 항목이 자동으로 여기에 쌓입니다.
          <br />
          맞힐수록 복습 간격이 1→3→7→16→35일로 늘어나며 장기기억에 정착합니다.
        </EmptyState>
      </div>
    );
  }

  const now = Date.now();
  const due = dueWeak();
  const pending = pendingWeakCount();
  const leeches = weak.filter(isLeech);
  const masteredCount = weak.filter(isMastered).length;

  const sorted = [...weak].sort((a, b) => {
    const ad = a.due == null || a.due <= now;
    const bd = b.due == null || b.due <= now;
    if (ad !== bd) return ad ? -1 : 1;
    return (a.box || 0) - (b.box || 0);
  });
  /* 화면에는 앞쪽 일부만 그린다. 오답이 수백 개 쌓이면 전부 DOM으로 만드는 비용이
   * 중급 폰에서 1초를 넘긴다(측정: 200개 ≈ 1.2s). 정렬상 '오늘 복습할 것'이 맨앞이라
   * 잘리는 것은 먼 미래의 대기 항목들뿐이고, 나머지는 개수로 알린다. */
  const RENDER_CAP = 40;
  const visible = sorted.slice(0, RENDER_CAP);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>📝 간격 반복 복습 (SM-2)</h3>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
          오늘 복습 <b style={{ color: 'var(--primary-light)' }}>{due.length}개</b>
          {pending ? ` · ⏳ 대기 ${pending}개` : ''}
          {masteredCount ? ` · ✅ 숙달 ${masteredCount}개` : ''}
          <br />
          <span style={{ fontSize: '0.72rem' }}>
            맞힐수록 복습 간격이 멀어집니다 (오늘 → +1 → +3 → +7 → +16 → +35일). 숙달해도 35일 뒤 유지복습으로 한 번 더 확인합니다.
          </span>
        </div>

        {leeches.length > 0 && (
          <div className="leech-banner">
            🔥 <b>골칫거리 표현 {leeches.length}개</b> — 4번 이상 다시 틀린 문장입니다. 통째로 외우지 말고 더 쉬운 표현으로 바꿔
            보세요.
          </div>
        )}

        {visible.map((w, i) => {
          const box = Math.min(w.box || 0, SRS_MAX_BOX);
          const boxes = '●'.repeat(box) + '○'.repeat(SRS_MAX_BOX - box);
          const isDue = w.due == null || w.due <= now;
          return (
            <div className="point" style={{ opacity: isDue ? 1 : 0.5 }} key={i}>
              <div className="en">
                {w.kr}
                {isDue ? (
                  <span className="due-tag" style={{ color: 'var(--yellow)' }}>
                    ● 오늘
                  </span>
                ) : isMastered(w) ? (
                  <span className="due-tag" style={{ color: 'var(--green)' }}>
                    ✅ 숙달 · {new Date(w.due).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                  </span>
                ) : (
                  <span className="due-tag" style={{ color: 'var(--text-muted)' }}>
                    ⏳ {new Date(w.due).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                  </span>
                )}
                {isLeech(w) && (
                  <span className="due-tag" style={{ color: '#fca5a5' }}>
                    🔥 {w.lapses}회 재실패
                  </span>
                )}
              </div>
              <div className="kr">
                {w.en} <SpeakButton text={w.en} />
                <span className="box-dots">{boxes}</span>
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', padding: '10px 0', textAlign: 'center' }}>
            ⏳ 아직 복습일이 오지 않은 {hiddenCount}개는 때가 되면 위로 올라옵니다.
          </div>
        )}
      </div>

      {!due.length && (
        <EmptyState art="review" title="✅ 오늘 복습을 모두 끝냈어요!">
          대기 중인 {pending}개는 복습일이 되면 다시 나타납니다.
        </EmptyState>
      )}
    </div>
  );
}
