'use client';

/**
 * 보이스 모드 오버레이 — ChatGPT/Gemini 음성 대화 스타일.
 * 탭 한 번으로 대화 세션이 시작되고, 말하면 자동 전송 → AI가 답하고 →
 * 자동으로 다시 듣는다. 오브(orb)가 상태를 몸으로 보여준다:
 *   듣는 중(숨쉬듯 맥동) · 생각 중(회전) · 말하는 중(파동 — 탭하면 끼어들기).
 */
export type VoiceState = 'listening' | 'thinking' | 'speaking' | 'idle';

const STATUS: Record<VoiceState, string> = {
  listening: '듣고 있어요 — 편하게 말씀하세요',
  thinking: '생각하는 중…',
  speaking: '말하는 중 — 탭하면 끼어들 수 있어요',
  idle: '오브를 탭하면 다시 듣기 시작해요',
};

export default function VoiceOverlay({
  state,
  interim,
  lastUser,
  lastAi,
  onOrbTap,
  onClose,
}: {
  state: VoiceState;
  interim: string;
  lastUser: string;
  lastAi: string;
  onOrbTap: () => void;
  onClose: () => void;
}) {
  return (
    <div className="voice-overlay" data-state={state}>
      <button type="button" className="vo-close" onClick={onClose} title="음성 대화 종료">
        ✕
      </button>

      <div className="vo-center">
        <button type="button" className={`vo-orb ${state}`} onClick={onOrbTap} aria-label="음성 상태">
          <span className="vo-orb-core" />
        </button>
        <div className="vo-status">{STATUS[state]}</div>
      </div>

      <div className="vo-transcript">
        {state === 'listening' && interim && <p className="vo-interim">{interim}</p>}
        {state !== 'listening' && lastAi && <p className="vo-ai">{lastAi}</p>}
        {lastUser && <p className="vo-user">“{lastUser}”</p>}
      </div>

      <div className="vo-foot">
        <button type="button" className="vo-keyboard" onClick={onClose}>
          키보드로 대화하기
        </button>
      </div>
    </div>
  );
}
