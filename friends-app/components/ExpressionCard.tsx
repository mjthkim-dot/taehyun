'use client';

import { useState } from 'react';
import type { Expression } from '../lib/types';
import { useProgress, toggleSaved } from '../lib/progress';
import SpeakButton from './SpeakButton';
import { BookmarkIcon } from './Icon';

const LEVEL_LABEL: Record<number, string> = { 1: '기초', 2: '실전', 3: '원어민' };

export default function ExpressionCard({ expression }: { expression: Expression }) {
  const progress = useProgress();
  const saved = progress.saved.includes(expression.id);
  const [open, setOpen] = useState(false);

  return (
    <div className="expression-card">
      <div className="phrase-row">
        <div>
          <span className={`level-tag l${expression.level}`}>{LEVEL_LABEL[expression.level]}</span>
          <div className="phrase">{expression.phrase}</div>
          <div className="meaning">{expression.meaningKr}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SpeakButton text={expression.phrase} />
          <button
            className={`icon-btn${saved ? ' saved' : ''}`}
            onClick={() => toggleSaved(expression.id)}
            aria-label={saved ? '저장 해제' : '표현 저장'}
            aria-pressed={saved}
          >
            <BookmarkIcon filled={saved} />
          </button>
        </div>
      </div>
      <div className="nuance">{expression.nuanceKr}</div>
      <div className="example">
        <div className="en">{expression.exampleEn}</div>
        <div className="kr">{expression.exampleKr}</div>
      </div>

      <button
        className="depth-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? '접기 ▲' : '응용 · 실수 · 발음 파고들기 ▼'}
      </button>

      {open && (
        <div className="depth">
          <div className="depth-block">
            <div className="depth-label">🔁 실전 응용</div>
            {expression.variations.map((v, i) => (
              <div key={i} className="depth-variation">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>{v.en}</b>
                  <SpeakButton text={v.en} className="icon-btn-xs" />
                </div>
                <div className="kr">{v.kr}</div>
              </div>
            ))}
          </div>
          <div className="depth-block">
            <div className="depth-label">⚠️ 한국인이 자주 틀리는 포인트</div>
            <p>{expression.mistakeKr}</p>
          </div>
          <div className="depth-block">
            <div className="depth-label">🔊 소리 내는 법</div>
            <p>{expression.soundKr}</p>
          </div>
        </div>
      )}
    </div>
  );
}
