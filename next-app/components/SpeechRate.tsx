'use client';

/**
 * 느리게 듣기 속도 — 고르고, 앱 전체가 따른다.
 *
 * 0.6배속으로 고정돼 있었다. 적당한 속도는 사람마다 다르다: 초급에겐 0.6도 빠르고,
 * 귀가 트인 뒤에는 0.6이 오히려 부자연스러워 원어민 리듬(연음·강세)을 못 익힌다.
 * 그래서 값 하나를 기기에 저장하고 레슨·드릴·발음 훈련·듣기가 모두 그 값을 쓴다.
 *
 * useSlowRate가 커스텀 이벤트를 듣는 이유: 같은 탭 안에서는 storage 이벤트가 오지
 * 않아, 설정을 바꿔도 이미 떠 있는 다른 화면의 버튼 라벨이 옛 값에 머무른다.
 */
import { useEffect, useState } from 'react';
import { SLOW_RATES, SLOW_RATE_EVENT, SPEECH_RATES, setSlowRate, setSpeechRate, slowRate, speechRate } from '../lib/state';

/** 현재 느리게 듣기 배속. 다른 화면에서 바꾸면 즉시 따라온다. */
export function useSlowRate(): number {
  // 서버 렌더와 첫 페인트를 맞추기 위해 기본값으로 시작한 뒤 마운트 후 실제 값을 읽는다
  const [rate, setRate] = useState(0.6);
  useEffect(() => {
    setRate(slowRate());
    const on = (e: Event) => setRate((e as CustomEvent<number>).detail ?? slowRate());
    window.addEventListener(SLOW_RATE_EVENT, on);
    return () => window.removeEventListener(SLOW_RATE_EVENT, on);
  }, []);
  return rate;
}

/** 기본 말하기 배속. 지금까지 모든 음성이 0.84배속으로 고정돼 항상 느렸다. */
export function useSpeechRate(): number {
  const [rate, setRate] = useState(1);
  useEffect(() => {
    setRate(speechRate());
    const on = () => setRate(speechRate());
    window.addEventListener(SLOW_RATE_EVENT, on);
    return () => window.removeEventListener(SLOW_RATE_EVENT, on);
  }, []);
  return rate;
}

/** 배속 라벨 — 0.6 → "0.6×" (소수점 뒤 0은 떼어 0.50×처럼 보이지 않게) */
export function rateLabel(r: number): string {
  return `${String(r).replace(/0+$/, '').replace(/\.$/, '')}×`;
}

export default function SpeechRatePicker({ compact = false }: { compact?: boolean } = {}) {
  const slow = useSlowRate();
  const normal = useSpeechRate();
  return (
    <div className={`rate-picker${compact ? ' compact' : ''}`}>
      <span className="rate-label">말하기 속도</span>
      <div className="rate-opts" role="group" aria-label="말하기 속도">
        {SPEECH_RATES.map((r) => (
          <button
            key={r}
            type="button"
            className={`rate-opt${r === normal ? ' active' : ''}`}
            aria-pressed={r === normal}
            onClick={() => setSpeechRate(r)}
          >
            {rateLabel(r)}
          </button>
        ))}
      </div>

      <span className="rate-label" style={{ marginTop: 10 }}>
        느리게 듣기 속도
      </span>
      <div className="rate-opts" role="group" aria-label="느리게 듣기 속도">
        {SLOW_RATES.map((r) => (
          <button
            key={r}
            type="button"
            className={`rate-opt slow-opt${r === slow ? ' active' : ''}`}
            aria-pressed={r === slow}
            onClick={() => setSlowRate(r)}
          >
            {rateLabel(r)}
          </button>
        ))}
      </div>
    </div>
  );
}
