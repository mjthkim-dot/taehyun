'use client';

/** 내 표현장 — voice-assistant/index.html 의 renderPhrasebookList() 포팅. */
import { useState } from 'react';
import { getPhrases, removePhrase } from '../lib/state';
import SpeakButton from './SpeakButton';

export default function PhrasebookScreen() {
  const [phrases, setPhrases] = useState(() => getPhrases().slice().reverse());

  function remove(en: string) {
    setPhrases(removePhrase(en).slice().reverse());
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>📌 내 표현장</h3>
        {!phrases.length ? (
          <div className="empty-note">
            아직 저장한 표현이 없어요.
            <br />
            회화·레슨에서 📌 버튼을 눌러 마음에 든 표현을 모아보세요.
          </div>
        ) : (
          phrases.map((p) => (
            <div className="point" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }} key={p.en}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="en">{p.en}</div>
                {p.kr && <div className="kr">{p.kr}</div>}
              </div>
              <div style={{ flex: '0 0 auto', display: 'flex', gap: 4 }}>
                <SpeakButton text={p.en} />
                <SpeakButton text={p.en} slow />
                <button type="button" className="speak-mini" title="삭제" onClick={() => remove(p.en)}>
                  🗑
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
