'use client';

/**
 * 기능(features) 허브 — voice-assistant/index.html 의 renderFeatures() 포팅.
 * 이미 구현된 화면(회화/복습/진도/드릴/표현장)은 실제 탭으로 바로 연결하고,
 * 아직 React로 옮기지 않은 기능(숙제 도우미/암기 카드/4대 영역 등)은
 * "곧 추가됩니다" 안내만 보여준다 — 거짓으로 완성된 척하지 않는다.
 */
import { useEffect, useState } from 'react';
import { dueWeak, getPhrases, isPlaced, groqKey, SERVER_GROQ_SENTINEL } from '../lib/state';
import { getAskHistory } from '../lib/askPrompts';
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
  const askCount = getAskHistory().length;
  const placed = isPlaced();
  const key = groqKey();
  const keySub = key ? (key === SERVER_GROQ_SENTINEL ? '서버 키로 동작 중' : '기기 키 등록됨 · 교체/삭제') : '아직 없음 · AI 기능 꺼짐';

  const sections: FeatSection[] = [
    {
      title: 'AI 연결',
      cards: [{ icon: '🔑', label: 'AI 키 등록', sub: keySub, action: { kind: 'nav', mode: 'apikey' } }],
    },
    {
      title: '내 레벨',
      cards: [
        {
          icon: '🧭',
          label: 'CEFR 배치고사',
          sub: placed ? '진단 완료 · 다시 보기' : '18문항 · 아직 안 봄',
          action: { kind: 'nav', mode: 'placement' },
        },
      ],
    },
    {
      title: '4대 영역 훈련',
      cards: [
        { icon: '🗣', label: '말하기', sub: 'AI 코치와 실전 대화 · CAF 분석', action: { kind: 'nav', mode: 'talk' } },
        { icon: '🦜', label: '쉐도잉', sub: '따라 말하기 · 단어별 발음 채점', action: { kind: 'nav', mode: 'shadowing' } },
        { icon: '🔁', label: '드릴', sub: '오늘의 문장 훈련', action: { kind: 'nav', mode: 'drill' } },
        { icon: '🎧', label: '듣기', sub: '딕테이션 6문항', action: { kind: 'nav', mode: 'listening' } },
        { icon: '📖', label: '읽기', sub: '레벨별 지문 + 이해 문제', action: { kind: 'nav', mode: 'reading' } },
        { icon: '✍️', label: '쓰기', sub: 'AI 첨삭', action: { kind: 'nav', mode: 'writing' } },
        { icon: '🪜', label: '원어민 사다리', sub: '한 문장을 원어민 표현까지', action: { kind: 'nav', mode: 'ladder' } },
        { icon: '🌿', label: '성장', sub: '원어민스러움 성숙도 커리큘럼', action: { kind: 'nav', mode: 'growth' } },
        { icon: '🎧', label: '오디오 모드', sub: '듣기만으로 오늘 복습', action: { kind: 'nav', mode: 'audio' } },
        { icon: '📒', label: '수업 노트', sub: '진옥 선생님 수업 → SRS', action: { kind: 'nav', mode: 'preply' } },
        { icon: '💼', label: '직무 어휘', sub: 'IT 영업·AI·협상 등 10개 도메인 100개', action: { kind: 'nav', mode: 'vocab' } },
        { icon: '⏱', label: '2분 피치 훈련', sub: '긴 발화 · 시간·속도·채움말·구조 분석', action: { kind: 'nav', mode: 'pitch' } },
        { icon: '🗓', label: '미팅 준비 · 회고', sub: '내일 그 미팅용 표현 · 끝난 뒤 못 한 말 복습', action: { kind: 'nav', mode: 'meeting' } },
        { icon: '🤝', label: '미팅 스크립트', sub: '오프닝·가격 반론·갱신·장애 브리핑 9종 · AI 롤플레이', action: { kind: 'nav', mode: 'scripts' } },
      ],
    },
    {
      title: '숙제 & 암기',
      cards: [
        { icon: '📚', label: '숙제 도우미', sub: 'AI와 함께 풀이', action: { kind: 'nav', mode: 'homework' } },
        { icon: '🃏', label: '암기 카드', sub: dueCount ? `오늘 ${dueCount}개 대기` : '카드 외우기', action: { kind: 'nav', mode: 'flashcards' } },
        { icon: '📌', label: '내 표현장', sub: `저장한 표현 ${phraseCount}개`, action: { kind: 'nav', mode: 'phrasebook' } },
        { icon: '🤔', label: '내 질문 기록', sub: askCount ? `물어본 표현 ${askCount}개` : '꾹 눌러 물어보기 기록', action: { kind: 'nav', mode: 'askhistory' } },
      ],
    },
    {
      title: '콘텐츠로 배우기',
      cards: [{ icon: '🎬', label: '영상 학습', sub: '유튜브로 듣기 연습 + 자막 번역', action: { kind: 'nav', mode: 'video' } }],
    },
    {
      title: '학습 관리',
      cards: [
        { icon: '📝', label: '간격 반복 복습', sub: `${dueCount}개 대기`, action: { kind: 'nav', mode: 'review' } },
        { icon: '📊', label: '진도 & 리포트', sub: 'CEFR·GSE 현황', action: { kind: 'nav', mode: 'progress' } },
        { icon: '🔔', label: '복습 알림', sub: '매일 복습 리마인더 설정', action: { kind: 'nav', mode: 'reminders' } },
        { icon: '💾', label: '백업 · 복원', sub: '학습 데이터 내보내기/가져오기', action: { kind: 'nav', mode: 'backup' } },
        { icon: '📜', label: '약관 · 개인정보', sub: '이용약관 · 처리방침(초안)', action: { kind: 'nav', mode: 'legal' } },
        { icon: '🩺', label: '음성 진단', sub: '소리가 안 날 때 원인 확인', action: { kind: 'nav', mode: 'audiocheck' } },
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
          <div style={{ fontSize: '1.3rem' }}></div>
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
