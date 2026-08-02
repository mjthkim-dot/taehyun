'use client';

/**
 * 대화문 음성 재생 — 컴포넌트에서 떼어낸 순수 재생 로직.
 *
 * 원래 이 함수들은 DialoguePractice.tsx 안에 있었다. 그런데 홈 화면의 미션 카드가
 * playDialogueAudio 하나를 쓰려고 그 파일을 import하는 바람에, **역할연습 화면 전체와
 * 거기 딸린 발음 진단·최소대립쌍·녹음 비교까지** 첫 진입 번들로 끌려 들어왔다.
 * 사용자가 미션 대화를 열기 전에는 쓰지 않는 코드다.
 *
 * 재생 로직만 여기 두면 미션 카드는 이 작은 모듈만 가져가고, 역할연습 화면은
 * 필요할 때 따로 불러올 수 있다.
 */
import type { Dialogue } from './lessons';
import { groqKey } from './state';
import { speakText, stopSpeaking, primeAudio, fetchGroqTTS, playUrl, SPEAKER_GROQ_VOICE, GROQ_TTS_VOICE } from '../components/SpeakButton';

interface StopRef {
  stopped: boolean;
  cleanup?: () => void;
}

/** 화자별 목소리 — 역할연습 화면도 같은 배정을 쓴다 */
export function voiceFor(sp: string) {
  return SPEAKER_GROQ_VOICE[sp] || GROQ_TTS_VOICE;
}

interface StopRef {
  stopped: boolean;
  cleanup?: () => void;
}

/** 폴백: 브라우저 speechSynthesis 큐로 fromIdx부터 끝까지 한 번에 등록해 재생한다. */
function playViaBrowserQueue(
  dialogue: Dialogue,
  rate: number,
  onLineStart: ((i: number) => void) | undefined,
  onDone: (() => void) | undefined,
  fromIdx: number,
  ref: StopRef,
  shouldLoop?: () => boolean
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onDone?.();
    return;
  }
  const synth = window.speechSynthesis;
  const wasActive = synth.speaking || synth.pending;
  if (wasActive) synth.cancel();

  const last = dialogue.lines.length - 1;
  // Chrome/모바일에서 한 발화가 ~15초를 넘기면 합성기가 조용히 멈추는 버그 방지.
  const keepAlive = setInterval(() => {
    if (ref.stopped || !synth.speaking) return;
    synth.resume();
  }, 10000);
  ref.cleanup = () => clearInterval(keepAlive);

  // 한 줄이 끝난 뒤(onend) 다음 줄을 큐에 넣는다 — 여러 발화를 한꺼번에 speak()하면
  // Chrome/Safari가 첫 줄만 말하고 나머지를 조용히 버려 "1번째 줄에서 멈춘 것처럼"
  // 보이는 버그가 있다. 한 번에 하나씩만 큐에 넣어 이 버그를 피한다.
  const speakOne = (i: number) => {
    if (ref.stopped) return;
    if (i > last) {
      // 연속재생: 끝까지 읽었으면 잠시 쉬었다가 처음부터 다시(keepAlive는 유지).
      if (shouldLoop?.() && !ref.stopped) {
        const t = setTimeout(() => { if (!ref.stopped) speakOne(0); }, 800);
        ref.cleanup = () => { clearInterval(keepAlive); clearTimeout(t); };
        return;
      }
      clearInterval(keepAlive);
      onDone?.();
      return;
    }
    const enVoices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
    const voiceA = enVoices[0];
    const voiceB = enVoices[1] || enVoices[0];
    const line = dialogue.lines[i];
    const u = new SpeechSynthesisUtterance(line.en);
    u.lang = 'en-US';
    u.rate = rate;
    const v = line.sp === 'A' ? voiceA : voiceB;
    if (v) u.voice = v;
    u.onstart = () => { if (!ref.stopped) onLineStart?.(i); };
    u.onend = () => speakOne(i + 1);
    u.onerror = () => speakOne(i + 1);
    synth.speak(u);
  };
  // iOS/WebKit 버그: cancel() 직후 같은 틱에서 speak()를 큐에 넣으면 새로 넣은
  // 발화까지 같이 지워져 아무 소리도 안 날 수 있다. 취소 효과가 반영될 시간을 준다.
  if (wasActive) setTimeout(() => speakOne(fromIdx), 60);
  else speakOne(fromIdx);
}

/**
 * 대화문 전체를 순차 재생한다 — 듣기 탭과 숙제/레슨 화면의 "전체 재생" 버튼에서 재사용한다.
 * 반환값은 재생을 중단하는 함수.
 *
 * Groq 키가 있으면 화자별 신경망 음성(실제 사람에 가까운 목소리)으로 한 줄씩 재생하고
 * 다음 줄을 미리 받아 끊김을 줄인다. 클릭 순간 primeAudio()로 오디오를 언락하므로 iOS에서도
 * 비동기 재생이 막히지 않는다. 키가 없거나 합성에 실패하면 브라우저 음성 큐로 폴백한다.
 */
export function playDialogueAudio(
  dialogue: Dialogue,
  rate = 1,
  onLineStart?: (i: number) => void,
  onDone?: () => void,
  shouldLoop?: () => boolean
): () => void {
  if (typeof window === 'undefined' || !dialogue.lines.length) {
    onDone?.();
    return () => {};
  }
  primeAudio(); // 사용자 제스처 안에서 동기 언락
  const ref: StopRef = { stopped: false };
  const stop = () => {
    ref.stopped = true;
    ref.cleanup?.();
    stopSpeaking();
  };

  if (!groqKey()) {
    playViaBrowserQueue(dialogue, rate, onLineStart, onDone, 0, ref, shouldLoop);
    return stop;
  }

  const last = dialogue.lines.length - 1;
  const playFrom = async (i: number) => {
    if (ref.stopped) return;
    if (i > last) {
      // 연속재생: 끝까지 재생했으면 잠시 쉬었다가 처음부터 다시.
      if (shouldLoop?.() && !ref.stopped) {
        const t = setTimeout(() => { if (!ref.stopped) playFrom(0); }, 800);
        ref.cleanup = () => clearTimeout(t);
        return;
      }
      onDone?.();
      return;
    }
    const line = dialogue.lines[i];
    const url = await fetchGroqTTS(line.en, voiceFor(line.sp));
    if (ref.stopped) return;
    if (!url) { playViaBrowserQueue(dialogue, rate, onLineStart, onDone, i, ref, shouldLoop); return; }
    onLineStart?.(i);
    if (i + 1 <= last) {
      const n = dialogue.lines[i + 1];
      fetchGroqTTS(n.en, voiceFor(n.sp)); // 다음 줄 미리 받기
    }
    // 한 줄당 한 번만 다음으로 진행 — onended/onerror/워치독 중 무엇이 먼저 와도 안전.
    let advanced = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const advance = () => {
      if (advanced || ref.stopped) return;
      advanced = true;
      if (watchdog) clearTimeout(watchdog);
      playFrom(i + 1);
    };
    // 안전망: 어떤 이유로든(이벤트 미발생 등) 한 줄에서 멈추면 넉넉한 시간 뒤 다음으로
    // 넘어간다. 정상 재생은 onended가 먼저 와서 워치독은 발동하지 않는다(여유 있게 잡음).
    watchdog = setTimeout(advance, 12000 + line.en.length * 220);
    ref.cleanup = () => { if (watchdog) clearTimeout(watchdog); };
    try {
      // 속도는 재생 단계에서 음높이 유지(preservesPitch)하며 조절 — 느려도 자연스럽다.
      await playUrl(url, rate, advance);
    } catch {
      if (watchdog) clearTimeout(watchdog);
      if (!ref.stopped) playViaBrowserQueue(dialogue, rate, onLineStart, onDone, i, ref, shouldLoop);
    }
  };
  onLineStart?.(0); // 첫 음성을 받는 동안 즉시 UI 반영(중복 클릭 방지)
  playFrom(0);
  return stop;
}
