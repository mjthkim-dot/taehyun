/**
 * 브라우저 내장 음성 인식(Web Speech API) — AI 키가 없을 때의 말하기 폴백.
 *
 * Whisper(서버 받아쓰기)는 Groq 키가 있어야 한다. 키 없이 쓰는 초급자는 드라마 '따라 말하기'와
 * 회화 탭에서 영어를 소리 내어 말해 볼 방법이 전혀 없었다(감사 v1.31 비평 #4). 크롬·안드로이드·
 * iOS 사파리(14.5+)는 브라우저가 직접 받아쓰기를 해 주므로 그걸 쓴다. 이것도 없으면 호출부가
 * '소리 내어 말했어요 ✓' 자기 확인 버튼으로 대신한다.
 */

type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SR;

function ctor(): SRCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function browserSttAvailable(): boolean {
  return !!ctor();
}

/** 한 번 듣고 받아쓴 문장을 돌려준다(말이 없으면 ''). 권한 거부 등은 예외. */
export function listenOnce(opts: { lang?: string; maxMs?: number; registerStop?: (stop: () => void) => void } = {}): Promise<string> {
  const C = ctor();
  if (!C) return Promise.reject(new Error('NO_BROWSER_STT'));
  return new Promise((resolve, reject) => {
    const r = new C();
    r.lang = opts.lang || 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    let text = '';
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      fn();
    };
    r.onresult = (e) => {
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0]?.transcript || '');
      text = parts.join(' ').trim();
    };
    r.onerror = (e) => {
      // 말이 없거나 중간에 멈춘 건 오류가 아니다 — 빈 결과로 끝낸다
      if (e.error === 'no-speech' || e.error === 'aborted') done(() => resolve(text));
      else done(() => reject(new Error(e.error || 'STT_ERROR')));
    };
    r.onend = () => done(() => resolve(text));
    const t = setTimeout(() => {
      try {
        r.stop();
      } catch {
        /* 이미 끝남 */
      }
    }, opts.maxMs ?? 12000);
    opts.registerStop?.(() => {
      try {
        r.stop();
      } catch {
        /* 이미 끝남 */
      }
    });
    try {
      r.start();
    } catch (err) {
      done(() => reject(err));
    }
  });
}
