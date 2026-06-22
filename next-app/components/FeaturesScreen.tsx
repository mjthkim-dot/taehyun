'use client';

/**
 * 기능(features) 허브 — voice-assistant/index.html 의 renderFeatures() 포팅.
 * 이미 구현된 화면(회화/복습/진도/드릴/표현장)은 실제 탭으로 바로 연결하고,
 * 아직 React로 옮기지 않은 기능(숙제 도우미/암기 카드/4대 영역 등)은
 * "곧 추가됩니다" 안내만 보여준다 — 거짓으로 완성된 척하지 않는다.
 */
import { useEffect, useState } from 'react';
import { dueWeak, getPhrases, isPlaced } from '../lib/state';
import type { Mode } from './NavBar';

interface FeatCard {
  icon: string;
  label: string;
  sub: string;
  action: { kind: 'nav'; mode: Mode } | { kind: 'soon' };
}

interface FeatSection {
  title: string;
  cards: FeatCard[];
}

export default function FeaturesScreen({ onNavigate }: { onNavigate: (mode: Mode) => void }) {
  const [ready, setReady] = useState(false);
  const [soonLabel, setSoonLabel] = useState<string | null>(null);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const dueCount = dueWeak().length;
  const phraseCount = getPhrases().length;
  const placed = isPlaced();

  const sections: FeatSection[] = [
    {
      title: '🧭 내 레벨',
      cards: [
        {
          icon: '🧭',
          label: 'CEFR 배치고사',
          sub: placed ? '진단 완료 · 다시 보기' : '18문항 · 아직 안 봄',
          action: { kind: 'soon' },
        },
      ],
    },
    {
      title: '🎓 4대 영역 훈련',
      cards: [
        { icon: '🗣', label: '말하기', sub: 'AI 코치와 실전 대화 · CAF 분석', action: { kind: 'nav', mode: 'talk' } },
        { icon: '🔁', label: '드릴', sub: '오늘의 문장 훈련', action: { kind: 'nav', mode: 'drill' } },
        { icon: '🎧', label: '듣기', sub: '곧 추가됩니다', action: { kind: 'soon' } },
        { icon: '📖', label: '읽기', sub: '곧 추가됩니다', action: { kind: 'soon' } },
        { icon: '✍️', label: '쓰기', sub: '곧 추가됩니다', action: { kind: 'soon' } },
      ],
    },
    {
      title: '📚 숙제 & 암기',
      cards: [
        { icon: '📚', label: '숙제 도우미', sub: '곧 추가됩니다', action: { kind: 'soon' } },
        { icon: '🃏', label: '암기 카드', sub: dueCount ? `오늘 ${dueCount}개 대기` : '곧 추가됩니다', action: { kind: 'soon' } },
        { icon: '📌', label: '내 표현장', sub: `저장한 표현 ${phraseCount}개 · 곧 추가됩니다`, action: { kind: 'soon' } },
      ],
    },
    {
      title: '🎬 콘텐츠로 배우기',
      cards: [{ icon: '🎬', label: '영상 학습', sub: '유튜브로 듣기 연습 + 자막 번역', action: { kind: 'nav', mode: 'video' } }],
    },
    {
      title: '📈 학습 관리',
      cards: [
        { icon: '📝', label: '간격 반복 복습', sub: `${dueCount}개 대기`, action: { kind: 'nav', mode: 'review' } },
        { icon: '📊', label: '진도 & 리포트', sub: 'CEFR·GSE 현황', action: { kind: 'nav', mode: 'progress' } },
      ],
    },
  ];

  function handleClick(card: FeatCard) {
    if (card.action.kind === 'nav') {
      onNavigate(card.action.mode);
    } else {
      setSoonLabel(card.label);
    }
  }

  return (
    <div className="study-screen">
      {soonLabel && (
        <div
          style={{
            background: 'linear-gradient(135deg,rgba(194,117,12,0.16),rgba(194,117,12,0.04))',
            border: '1px solid var(--yellow)',
            borderRadius: 14,
            padding: '12px 16px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: '1.3rem' }}>🚧</div>
          <div style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--text)' }}>{soonLabel}</b>은 아직 준비 중이에요. 곧 추가될 예정입니다!
          </div>
          <button className="mini-btn" onClick={() => setSoonLabel(null)}>
            닫기
          </button>
        </div>
      )}

      {sections.map((sec) => (
        <div key={sec.title} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, marginBottom: 8 }}>{sec.title}</div>
          <div className="feat-grid">
            {sec.cards.map((c) => (
              <button className="feat-card" key={c.label} onClick={() => handleClick(c)}>
                <div className="ic">{c.icon}</div>
                <div className="lbl">{c.label}</div>
                <div className="sub">{c.sub}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
