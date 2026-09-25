'use client';

/**
 * 내 질문 기록 — "꾹 눌러 물어보기"로 AI 튜터에게 물어봤던 표현과 답을 다시 보고,
 * 표현장 저장 / 간격 반복(SRS) 복습 카드로 전환할 수 있는 화면.
 *
 * "모르는 것"을 학습 데이터로 이어주는 선순환의 마지막 고리 — 물어본 표현을
 * 그냥 흘려보내지 않고 복습 루프에 태운다.
 */
import { useState } from 'react';
import { getAskHistory, removeAskHistory, clearAskHistory, askModeDef } from '../lib/askPrompts';
import { addPhrase, addWeakItem } from '../lib/state';
import { speakText } from './SpeakButton';
import EmptyState from './EmptyState';

export default function AskHistoryScreen() {
  const [items, setItems] = useState(() => getAskHistory().slice().reverse());
  // 표현별 "저장됨"/"복습 추가됨" 표시를 위한 상태
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});

  function remove(phrase: string) {
    setItems(removeAskHistory(phrase).slice().reverse());
  }

  function clearAll() {
    if (!window.confirm('질문 기록을 모두 지울까요?')) return;
    clearAskHistory();
    setItems([]);
  }

  function savePhrase(phrase: string, gloss?: string) {
    addPhrase({ en: phrase, kr: gloss || '' });
    setSaved((s) => ({ ...s, [phrase]: true }));
  }

  function addReview(phrase: string, gloss?: string) {
    addWeakItem({ en: phrase, kr: gloss || '', cat: 'ask' });
    setReviewed((r) => ({ ...r, [phrase]: true }));
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0 }}>🤔 내 질문 기록</h3>
          {items.length > 0 && (
            <button type="button" className="mini-btn" onClick={clearAll}>
              전체 삭제
            </button>
          )}
        </div>

        {!items.length ? (
          <EmptyState art="phrasebook" title="아직 물어본 표현이 없어요">
            레슨·회화에서 모르는 영어를 길게 눌러(또는 드래그해) 선택하면 “🤔 물어보기”로 바로 질문할 수 있어요.
          </EmptyState>
        ) : (
          items.map((it) => (
            <div className="ask-hist-item" key={it.phrase}>
              <div className="ask-hist-head">
                <span className="ask-hist-badge">
                  {askModeDef(it.mode).emoji} {askModeDef(it.mode).label}
                </span>
                <span className="ask-hist-phrase">{it.phrase}</span>
                <button type="button" className="speak-mini" title="듣기" onClick={() => speakText(it.phrase)}>
                  🔊
                </button>
              </div>
              {it.answer_ko && <div className="ask-hist-answer">{it.answer_ko}</div>}
              <div className="ask-hist-actions">
                <button
                  type="button"
                  className="ask-hist-btn"
                  disabled={!!saved[it.phrase]}
                  onClick={() => savePhrase(it.phrase, it.gloss)}
                >
                  {saved[it.phrase] ? '✅ 저장됨' : '📌 표현장'}
                </button>
                <button
                  type="button"
                  className="ask-hist-btn"
                  disabled={!!reviewed[it.phrase]}
                  onClick={() => addReview(it.phrase, it.gloss)}
                >
                  {reviewed[it.phrase] ? '✅ 복습 추가됨' : '🃏 복습 추가'}
                </button>
                <button type="button" className="ask-hist-btn" onClick={() => remove(it.phrase)}>
                  🗑 삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
