'use client';

/**
 * 음성 인식(STT) — Groq Whisper 경로.
 *
 * 브라우저 내장 Web Speech는 기기마다 정확도가 들쭉날쭉하고 iOS 설치형 PWA에서
 * 아예 동작하지 않기도 한다. 그래서 **녹음 → 서버 프록시 → Whisper** 경로를
 * 기본으로 쓰고, 마이크나 키를 쓸 수 없을 때만 기존 Web Speech로 물러난다.
 *
 * Whisper는 실시간 스트리밍이 아니라 **한 덩어리를 받아 변환**한다. 그래서
 * "언제 말이 끝났는가"를 앱이 판단해야 하고, 여기서는 오디오 레벨(RMS)을 재
 * 일정 시간 조용하면 자동으로 멈춘다(사용자가 버튼을 두 번 누르지 않아도 되게).
 */
import { groqKey, SERVER_GROQ_SENTINEL } from './state';

/** 무음이 이만큼 이어지면 발화가 끝난 것으로 본다 */
const SILENCE_MS = 1200;
/** 말을 시작하기 전 기다려 주는 시간 — 이 안에 아무 소리도 없으면 종료 */
const LEAD_SILENCE_MS = 4000;
/** 안전장치: 아무리 길어도 여기서 끊는다(요금·용량 보호) */
const MAX_MS = 30_000;
/** 레벨 분석을 못 쓰는 기기에서 쓰는 고정 녹음 창 */
const NO_DETECT_MS = 8000;
/** 이 값보다 크면 '말하는 중'으로 본다. 마이크 감도 편차를 감안한 보수적 기준. */
const RMS_THRESHOLD = 0.012;

export type SttState = 'recording' | 'transcribing';

export interface SttResult {
  text: string;
  /** 어느 경로로 인식했는지 — 진단·폴백 안내에 쓴다 */
  via: 'whisper' | 'webspeech';
  /** 결과가 비었을 때 원인을 구분한다(무음인지, 레벨 감지가 아예 안 됐는지) */
  reason?: 'ok' | 'no-audio' | 'silent' | 'empty-result';
  /** 녹음 중 관측된 최대 입력 레벨 — 마이크가 죽었는지 판단하는 근거 */
  peak?: number;
  /**
   * 방금 녹음한 소리 그 자체.
   *
   * 지금까지는 텍스트만 뽑고 곧바로 버렸다. 그런데 발음 교정에서 가장 확실한 것은
   * **자기 소리를 듣는 것**이다 — "work가 walk로 들렸다"는 진단을 읽는 것보다,
   * 원어민 음성과 내 음성을 번갈아 듣는 편이 차이를 훨씬 빨리 잡는다.
   * 이미 녹음하고 있던 것이므로 그대로 돌려준다(추가 비용 없음).
   */
  audio?: Blob;
  /** 실제 녹음 길이(ms) — WPM 계산의 분모 */
  durationMs?: number;
  /** 1초 이상 이어진 무음 구간들(ms). 긴 발화에서 '어디서 막혔는가'의 근거. */
  pauses?: number[];
}

export class SttError extends Error {}

/** 이 기기에서 Whisper 경로를 쓸 수 있는가(마이크 API + 키). */
export function whisperAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const hasMic = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  return hasMic && !!groqKey();
}

/** 서버 키만 있는 배포에서도 키 문자열을 그대로 실어 보내지 않도록 구분한다. */
function localKeyOrUndefined(): string | undefined {
  const k = groqKey();
  return k && k !== SERVER_GROQ_SENTINEL ? k : undefined;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  // iOS Safari는 mp4(aac), 그 외는 대체로 webm(opus)을 지원한다.
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return undefined;
}

/**
 * 말하는 동안 보여줄 **미리보기 전용** 실시간 자막.
 *
 * Whisper는 녹음이 끝나야 텍스트를 돌려주므로, 말하는 내내 화면에 글자가 하나도
 * 뜨지 않는다 — 사용자에게는 "인식이 안 되고 있다"로 보인다. 그래서 브라우저 내장
 * 인식을 같은 마이크에 나란히 붙여 중간 결과만 흘려보낸다.
 *
 * 이 텍스트는 **채점에 쓰지 않는다**. 내장 인식은 문맥으로 단어를 고쳐 돌려주기
 * 때문에 발음 진단의 근거가 될 수 없고, 여기서는 오로지 "지금 잡히고 있다"를
 * 눈으로 보여주는 역할만 한다. 최종 판정은 언제나 Whisper 결과다.
 *
 * 내장 인식이 없는 브라우저(iOS Safari 등)에서는 조용히 아무 일도 하지 않는다 —
 * 그쪽은 마이크 레벨 막대와 상태 문구가 같은 역할을 한다.
 */
function startLivePreview(onPartial: (text: string) => void): () => void {
  const SR =
    typeof window === 'undefined'
      ? null
      : window.SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ||
        null;
  if (!SR) return () => {};

  let recog: SpeechRecognition;
  try {
    recog = new SR();
  } catch {
    return () => {};
  }
  recog.lang = 'en-US';
  recog.continuous = true;
  recog.interimResults = true;

  let settled = '';
  recog.onresult = (e: SpeechRecognitionEvent) => {
    let live = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) settled += r[0].transcript + ' ';
      else live += r[0].transcript;
    }
    onPartial((settled + live).trim());
  };
  // 미리보기가 실패해도 녹음은 계속돼야 한다 — 여기서 던지면 학습이 멈춘다
  recog.onerror = () => {};

  try {
    recog.start();
  } catch {
    return () => {};
  }

  return () => {
    try {
      recog.onresult = null;
      recog.onerror = null;
      recog.abort();
    } catch {
      /* 이미 정리됨 */
    }
  };
}

/**
 * 마이크를 열어 말이 끝날 때까지 녹음한 뒤 Whisper로 변환한다.
 * stopSignal로 사용자가 직접 멈출 수도 있다(버튼 다시 누르기).
 */
export async function recordAndTranscribe(opts: {
  /** 인식 힌트 — 연습 중인 문장을 주면 고유명사·전문어 정확도가 올라간다 */
  prompt?: string;
  onState?: (s: SttState) => void;
  /** 녹음 중 마이크 입력 레벨(0~1) — 소리가 잡히는지 사용자에게 보여주는 데 쓴다 */
  onLevel?: (rms: number) => void;
  /** 말하는 동안 흐르는 미리보기 자막. 채점에는 쓰지 않는다(위 startLivePreview 참고) */
  onPartial?: (text: string) => void;
  /**
   * 녹음 상한(ms). 기본 30초는 '한 문장~한 턴' 기준이다. 2분 스피치처럼 긴 발화를
   * 담으려면 늘려야 한다 — 안 늘리면 발화 중간이 잘려 나가는데, 잘린 줄도 모른 채
   * 채점만 이상하게 나온다.
   */
  maxMs?: number;
  /**
   * 이만큼 조용하면 끝난 것으로 본다(ms). 0을 주면 **자동 종료를 끄고** 사용자가
   * 멈출 때까지 녹음한다 — 긴 발화에서는 생각하느라 2~3초 쉬는 것이 정상이라
   * 짧은 무음 기준을 그대로 쓰면 문장 중간에 끊긴다.
   */
  silenceMs?: number;
  /** 경과 시간을 알려 준다(타이머 표시용) */
  onElapsed?: (ms: number) => void;
  /** 호출하면 즉시 녹음을 끝낸다 */
  registerStop?: (stop: () => void) => void;
} = {}): Promise<SttResult> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  opts.onState?.('recording');
  // 말하는 동안 글자가 보이도록 미리보기 자막을 나란히 띄운다(가능한 브라우저에서만)
  const stopPreview = opts.onPartial ? startLivePreview(opts.onPartial) : () => {};

  // ── 무음 감지: 오디오 레벨을 재서 말이 끝났는지 판단한다 ──
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const audioCtx = Ctx ? new Ctx() : null;
  let analyser: AnalyserNode | null = null;
  if (audioCtx) {
    // getUserMedia를 기다린 뒤라 이미 사용자 제스처 밖이다 — iOS/Chrome은 이때
    // AudioContext를 'suspended'로 만든다. 그러면 분석값이 전부 0이라 영원히
    // '무음'으로 판정돼 녹음이 통째로 버려진다(실제로 발생한 결함). 반드시 깨운다.
    try {
      await audioCtx.resume?.();
    } catch {
      /* 구형 구현엔 resume이 없을 수 있다 — 아래 state 확인으로 판단 */
    }
    if (audioCtx.state !== 'suspended') {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
    }
  }
  /** 레벨 분석을 못 쓰면 무음 감지도 못 한다 — 그때는 고정 시간 녹음으로 물러난다. */
  const canDetect = !!analyser;
  const buf = analyser ? new Float32Array(analyser.fftSize) : null;

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      rec.stop();
    } catch {
      /* 이미 멈춤 */
    }
  };
  opts.registerStop?.(stop);

  const started = Date.now();
  const maxMs = opts.maxMs ?? MAX_MS;
  // silenceMs === 0 이면 자동 종료를 끈다(긴 발화 — 사용자가 직접 멈춘다)
  const silenceMs = opts.silenceMs ?? SILENCE_MS;
  const autoStop = silenceMs > 0;
  let lastLoud = 0; // 마지막으로 소리가 감지된 시각(0 = 아직 한 번도 말하지 않음)
  let peak = 0; // 관측된 최대 레벨 — 마이크가 아예 안 잡히는지 판단하는 근거
  /** 1초 이상 이어진 무음 구간들 — 긴 발화에서 '어디서 막혔는가'의 근거가 된다 */
  const pauses: number[] = [];
  let quietSince = 0;
  const timer = setInterval(() => {
    if (stopped) return;
    const elapsed = Date.now() - started;
    opts.onElapsed?.(elapsed);
    if (elapsed > maxMs) return stop();
    // 레벨 분석이 안 되는 기기: 무한정 기다리지 않고 고정 창으로 끊는다.
    // 자동 종료를 끈 긴 발화에서는 상한(maxMs)까지 그대로 간다.
    if (!canDetect) {
      if (autoStop && elapsed > NO_DETECT_MS) stop();
      return;
    }
    if (analyser && buf) {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms > peak) peak = rms;
      opts.onLevel?.(rms);
      if (rms > RMS_THRESHOLD) {
        // 조용하다가 다시 말하기 시작했다면 그 구간을 '멈춤'으로 기록한다
        if (quietSince && lastLoud) {
          const gap = Date.now() - quietSince;
          if (gap >= 1000) pauses.push(gap);
        }
        quietSince = 0;
        lastLoud = Date.now();
        return;
      }
      if (lastLoud && !quietSince) quietSince = Date.now();
    }
    if (!autoStop) return; // 사용자가 멈출 때까지 계속 녹음
    // 말을 시작한 뒤 조용해졌으면 종료, 시작조차 안 했으면 리드 타임까지 대기
    if (lastLoud ? Date.now() - lastLoud > silenceMs : elapsed > LEAD_SILENCE_MS) stop();
  }, 150);

  const blob = await new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    rec.start(250);
  });

  clearInterval(timer);
  stopPreview();
  stream.getTracks().forEach((t) => t.stop());
  audioCtx?.close().catch(() => {});

  // 전송 여부는 **녹음이 실제로 담겼는가**로만 판단한다.
  // 레벨 감지는 '언제 멈출지'를 정할 뿐이며, 감지에 실패했다고 녹음을 버리면
  // 조용한 마이크·suspended 컨텍스트에서 아무 일도 일어나지 않는다(실제 결함).
  const durationMs = Date.now() - started;
  if (blob.size < 1200) return { text: '', via: 'whisper', reason: 'no-audio', peak, durationMs, pauses };

  opts.onState?.('transcribing');
  const text = await transcribe(blob, opts.prompt);
  return {
    text,
    via: 'whisper',
    audio: blob,
    durationMs,
    pauses,
    // 소리는 잡혔는데 텍스트가 비면 '들리지 않은 것', 레벨 자체가 낮았으면 '무음'
    reason: text ? 'ok' : peak > RMS_THRESHOLD ? 'empty-result' : 'silent',
    peak,
  };
}

/** MIME 타입에 맞는 파일명 — Whisper는 확장자로 포맷을 판별하므로 거짓말하면 안 된다. */
function fileNameFor(type: string): string {
  if (type.includes('mp4')) return 'speech.mp4';
  if (type.includes('ogg')) return 'speech.ogg';
  if (type.includes('mpeg')) return 'speech.mp3';
  if (type.includes('wav')) return 'speech.wav';
  return 'speech.webm';
}

/** 녹음된 오디오를 서버 프록시로 보내 텍스트를 받는다. */
export async function transcribe(blob: Blob, prompt?: string): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, fileNameFor(blob.type || ''));
  const key = localKeyOrUndefined();
  if (key) form.append('key', key);
  if (prompt) form.append('prompt', prompt);

  const resp = await fetch('/app/api/stt', { method: 'POST', body: form });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      msg = (await resp.json()).error?.message || msg;
    } catch {
      /* 본문 없음 */
    }
    throw new SttError(msg);
  }
  const data = await resp.json();
  return String(data.text || '').trim();
}
