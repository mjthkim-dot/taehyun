'use client';

/**
 * 데모 페이지 — 프롬프트 2 & 3 통합
 *  - useOfflineLessons: 온라인이면 API, 오프라인이면 IndexedDB 에서 문장 세트 로드
 *  - SpeakingPractice : 선택한 문장을 음성으로 따라 말하고 정확도 평가
 */
import { useState } from 'react';
import { useOfflineLessons } from '../hooks/useOfflineLessons';
import SpeakingPractice from '../components/SpeakingPractice';

export default function Page() {
  const { lessons, loading, source, isOnline, error } = useOfflineLessons();
  const [target, setTarget] = useState<string>('');

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>🗣️ 영어 회화 연습</h1>
      <p style={{ color: '#666' }}>
        네트워크: <b>{isOnline ? '온라인' : '오프라인'}</b>
        {source && <> · 데이터 출처: <b>{source === 'network' ? 'API' : '로컬 캐시'}</b></>}
      </p>

      {loading && <p>불러오는 중…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {lessons.map((lesson) => (
        <section key={lesson.id} style={{ marginBottom: 16 }}>
          <h3>{lesson.title}</h3>
          <ul>
            {lesson.sentences.map((s, i) => (
              <li key={i}>
                <button onClick={() => setTarget(s.en)} style={{ cursor: 'pointer' }}>
                  {s.en}
                </button>{' '}
                <span style={{ color: '#888' }}>— {s.kr}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <hr />
      <SpeakingPractice sentence={target} />
    </main>
  );
}
