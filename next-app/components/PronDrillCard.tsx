'use client';

/**
 * 발음 훈련 카드 — 진단이 짚어준 축을 그 자리에서 고치는 통로.
 *
 * 진단만 보여주고 끝내면 "R/L이 문제다"라는 사실만 남는다. 사실은 이미 알고 있는
 * 경우가 많고, 필요한 것은 **그 소리만 다른 단어를 번갈아 말해 보는 시간**이다.
 * 그래서 여기서 최소대립쌍을 펼치고, 원하면 그 문장들을 그대로 드릴 큐로 넘긴다
 * (훈련이 끝나면 업무에서 쓸 문장이 손에 남는다).
 *
 * 접었다 펴는 형태인 이유: 진단은 연습 결과 아래에 붙는 보조 정보라, 기본 상태에서
 * 화면을 밀어내면 정작 다음 문장으로 넘어가는 흐름을 방해한다.
 */
import { useState } from 'react';
import { drillItemsFor, hasDrill, pairsFor } from '../lib/minimalPairs';
import { setDrillQueue } from '../lib/state';
import { speakText } from './SpeakButton';
import type { Mode } from './NavBar';

export default function PronDrillCard({
  lapseKey,
  label,
  onNavigate,
}: {
  lapseKey: string;
  label: string;
  onNavigate?: (m: Mode) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!hasDrill(lapseKey)) return null;
  const pairs = pairsFor(lapseKey);

  return (
    <div className="pd">
      <button className="pd-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? '훈련 접기' : `${label} 소리 훈련 ${pairs.length}쌍 →`}
      </button>

      {open && (
        <div className="pd-body">
          <div className="pd-hint">
            소리 하나만 다른 두 단어를 번갈아 들어보세요. 귀가 차이를 잡으면 입이 따라옵니다.
          </div>
          {pairs.map((p) => (
            <div className="pd-pair" key={p.a}>
              <div className="pd-words">
                <button className="pd-word target" onClick={() => speakText(p.a, 'en-US', 0.75)}>
                  {p.a}
                  <span>{p.aKr}</span>
                </button>
                <span className="pd-vs">vs</span>
                <button className="pd-word" onClick={() => speakText(p.b, 'en-US', 0.75)}>
                  {p.b}
                  <span>{p.bKr}</span>
                </button>
              </div>
              <div className="pd-sentence">
                {p.sentence.en}
                <button
                  type="button"
                  className="speak-mini"
                  aria-label={`${p.a} 예문 듣기`}
                  onClick={() => speakText(p.sentence.en, 'en-US', 0.9)}
                >
                  🔊
                </button>
              </div>
              <div className="pd-sentence-kr">{p.sentence.kr}</div>
            </div>
          ))}

          {onNavigate && (
            <button
              className="btn ghost-accent pd-cta"
              onClick={() => {
                setDrillQueue({ label: `${label} 발음 훈련`, items: drillItemsFor(lapseKey) });
                onNavigate('drill');
              }}
            >
              이 문장들로 말하기 훈련 →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
