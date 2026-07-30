'use client';

/**
 * 회화(talk) 화면 — voice-assistant/index.html 의 sendMessage()/buildSystemPrompt()/
 * maybeBackgroundCorrect()/analyzeCaf() 등을 포팅. 모델은 Groq 고정(WebLLM/Ollama 제외),
 * 음성 입출력은 브라우저 내장 Web Speech API만 사용한다(Whisper 로컬 모델 다운로드 제외).
 * 🎲 새 주제 생성·🔧 음성진단·미션 체크리스트는 관련 데이터가 아직 없어 이번 단계에서는 제외했다.
 */
import { useEffect, useRef, useState } from 'react';
import { ALL_LESSONS, LESSONS, CEFR_NEXT, cefrOf, type Lesson } from '../lib/lessons';
import { groqKey, saveGroqKey, markPracticedToday, addPhrase, bumpSkill, load, store, saveChatLog, bumpSpoken } from '../lib/state';
import { groqStream, groqComplete, validateGroqKey, GroqError } from '../lib/groq';
import { buildSystemPrompt, BG_CORRECT_SYS, lessonTargetGrammar, buildCafPrompt, parseAiText } from '../lib/talkPrompts';
import { takeMissionTalkContext, type MissionTalkCtx } from '../lib/dailyMission';
import { speakText, stopSpeaking, primeAudio, fetchGroqTTS } from './SpeakButton';
import { MicIcon, SendIcon } from './icons';
import VoiceOverlay, { type VoiceState } from './VoiceOverlay';

interface Correction {
  is_correct: boolean;
  corrected_sentence: string;
  native_expression: string;
  korean_feedback: string;
}

interface CafResult {
  complexity: number;
  accuracy: number;
  fluency: number;
  errors: { wrong: string; right: string; type: string; why_ko: string }[];
  paraphrases: { original: string; upgraded: string; note_ko: string }[];
  summary_ko: string;
  metrics: { word_count: number; wpm: number | null };
}

type ChatMsg =
  | { id: number; kind: 'intro'; scenario: { title: string; desc: string }; examples: { en: string; kr: string }[] }
  | { id: number; kind: 'user'; text: string; time: string; correction?: 'pending' | Correction | null }
  | { id: number; kind: 'ai'; text: string; time: string; streaming?: boolean; translation?: string | null; translating?: boolean }
  | { id: number; kind: 'system'; text: string }
  | { id: number; kind: 'caf'; cefr: string; result: CafResult };

const TALK_STARTERS = [
  'Could you repeat that?',
  'What do you mean?',
  'Let me think for a second.',
  "That's a good question.",
  'How about you?',
  "I'm not sure how to say it.",
];

function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  return (
    window.SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ||
    null
  );
}

/** 문장 단위로 끊어 순차 재생한다. 다음 문장 오디오를 현재 문장 재생 중에 미리
 * 받아둬(prefetch) 한 번에 긴 글을 통째로 합성할 때보다 첫 소리가 훨씬 빨리
 * 나오고, 문장 사이도 끊김 없이 자연스럽게 이어진다. */
function speak(text: string, onend?: () => void) {
  const clean = text.replace(/\[HEARD:[^\]]*\]/g, '').replace(/\[EXPLAIN:[^\]]*\]/g, '').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) {
    onend?.();
    return;
  }
  let i = 0;
  const step = () => {
    if (i >= sentences.length) {
      onend?.();
      return;
    }
    const idx = i++;
    if (idx + 1 < sentences.length) fetchGroqTTS(sentences[idx + 1]).catch(() => {});
    speakText(sentences[idx], 'en-US', 1, step);
  };
  step();
}

export default function TalkScreen({ lessonId }: { lessonId: number }) {
  const [ready, setReady] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyChecking, setKeyChecking] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  // 홈 미션에서 넘어온 상황 — 있으면 레슨 시나리오 대신 이 상황으로 대화한다.
  const [missionCtx, setMissionCtx] = useState<MissionTalkCtx | null>(null);
  const [input, setInput] = useState('');
  const [interim, setInterim] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [micOn, setMicOn] = useState(false);
  // 보이스 모드(ChatGPT식 음성 대화 오버레이) — 말하면 자동 전송, AI가 답하면 자동 재청취
  const [voiceMode, setVoiceMode] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [bgCorrectOn, setBgCorrectOn] = useState(true);
  const [cafBusy, setCafBusy] = useState(false);

  const lesson = ALL_LESSONS.find((l) => l.id === lessonId) ?? LESSONS[LESSONS.length - 1];
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const talkStampsRef = useRef<number[]>([]);
  const sessionIdRef = useRef('');
  const idRef = useRef(0);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const micOnRef = useRef(false);
  // isProcessing state는 비동기로 갱신돼, 같은 틱에서 handleSend가 두 번 불리면
  // 둘 다 갱신 전의 stale 값을 보고 재진입 가드를 통과해버린다(중복 발화의 원인).
  // ref는 동기적으로 즉시 갱신되므로 진짜 재진입 가드로 쓴다.
  const isProcessingRef = useRef(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReady(true);
    setHasKey(!!groqKey());
    setBgCorrectOn(load('va_bgcorrect', true));
  }, []);

  // 레슨이 바뀌면 대화를 리셋하고 시나리오 인트로 카드를 다시 보여준다.
  // 홈의 "이 상황으로 AI와 대화하기"로 들어온 경우엔 그 미션 상황을 시나리오로 쓴다.
  useEffect(() => {
    if (!ready) return;
    historyRef.current = [];
    talkStampsRef.current = [];
    sessionIdRef.current = `${lesson.id}-${Date.now()}`;
    const mission = takeMissionTalkContext();
    setMissionCtx(mission);
    if (mission) {
      setMessages([
        {
          id: ++idRef.current,
          kind: 'intro',
          scenario: { title: `🎯 ${mission.title}`, desc: mission.desc },
          examples: mission.examples,
        },
      ]);
    } else if (lesson.scenario) {
      setMessages([
        {
          id: ++idRef.current,
          kind: 'intro',
          scenario: lesson.scenario,
          examples: (lesson.examples || []).slice(0, 3),
        },
      ]);
    } else {
      setMessages([]);
    }
  }, [lessonId, ready]);

  useEffect(() => {
    chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight });
  }, [messages]);

  if (!ready) return null;

  function nextId() {
    return ++idRef.current;
  }

  function timeStr() {
    return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }

  function updateMsg(id: number, patch: Partial<ChatMsg>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...patch } as ChatMsg) : m)));
  }

  function prevLessons(): Lesson[] {
    const regular = LESSONS.filter((l) => !l.preview);
    const idx = regular.findIndex((l) => l.id === lesson.id);
    return idx > 0 ? regular.slice(Math.max(0, idx - 2), idx) : [];
  }

  async function maybeBackgroundCorrect(text: string, userId: number) {
    if (!bgCorrectOn || !groqKey()) return;
    const latinWords = text.match(/[A-Za-z]+/g) || [];
    if (latinWords.length < 2) return;
    updateMsg(userId, { correction: 'pending' });
    try {
      const input = JSON.stringify({
        task_type: 'correction',
        target_grammar: lessonTargetGrammar(lesson),
        scenario: lesson.scenario ? `${lesson.scenario.title} — ${lesson.scenario.desc}` : '',
        user_input: text,
      });
      const raw = await groqComplete(
        [{ role: 'system', content: BG_CORRECT_SYS }, { role: 'user', content: input }],
        { json: true, maxTokens: 420, temperature: 0.2 }
      );
      const parsed = JSON.parse(raw) as Correction;
      updateMsg(userId, { correction: parsed });
    } catch {
      updateMsg(userId, { correction: null });
    }
  }

  function maybeResumeHandsFree() {
    if (!micOnRef.current) return;
    // 스피커 출력이 끝난 직후 곧바로 마이크를 켜면 일부 기기에서 출력↔입력 장치
    // 전환이 안 끝난 상태로 start()가 걸려 인식이 실패한다 — 살짝 늦춰서 재시작.
    setTimeout(() => {
      if (micOnRef.current) startListening();
    }, 250);
  }

  async function handleSend(text: string, hidden = false) {
    if (!text || isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopSpeaking();
    // 클릭/탭 같은 사용자 제스처 안에서 동기적으로 호출해야 iOS 등에서 오디오
    // 언락이 되고, 스트리밍 응답이 끝난 뒤(비동기) 호출되는 speak()의 재생이
    // 막히지 않는다 — 마이크 자동 발화 경로는 toggleMic에서 미리 언락해둔다.
    primeAudio();
    let userId = -1;
    if (!hidden) {
      userId = nextId();
      setMessages((prev) => [...prev, { id: userId, kind: 'user', text, time: timeStr() }]);
      markPracticedToday();
      talkStampsRef.current.push(Date.now());
      maybeBackgroundCorrect(text, userId);
    }
    historyRef.current.push({ role: 'user', content: text });

    const sysMsg = {
      role: 'system',
      content: buildSystemPrompt(lesson, missionCtx ? { title: missionCtx.title, desc: missionCtx.desc } : null, prevLessons()),
    };
    const msgs = [sysMsg, ...historyRef.current.slice(-8)];

    setIsProcessing(true);
    const aiId = nextId();
    setMessages((prev) => [...prev, { id: aiId, kind: 'ai', text: '', time: timeStr(), streaming: true }]);

    try {
      let fullText = '';
      for await (const delta of groqStream(msgs, { temperature: 0.7, maxTokens: 220 })) {
        fullText += delta;
        updateMsg(aiId, { text: fullText });
      }
      historyRef.current.push({ role: 'assistant', content: fullText });
      updateMsg(aiId, { streaming: false });
      setAiSpeaking(true);
      speak(fullText, () => {
        setAiSpeaking(false);
        maybeResumeHandsFree();
      });
      saveChatLog({
        id: sessionIdRef.current,
        date: new Date().toISOString(),
        lessonId: lesson.id,
        lessonTitle: lesson.title || lesson.scenario?.title || '회화',
        transcript: historyRef.current.slice(-40),
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== aiId));
      const e = err as Error;
      if (e instanceof GroqError && e.message === 'NO_GROQ_KEY') {
        setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: '⚡ AI 강사 연결이 필요해요. 위에서 무료 Groq 키를 등록하면 바로 대화가 됩니다.' }]);
        setHasKey(false);
      } else {
        setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: `❌ 오류: ${e.message}` }]);
      }
      // 오류가 나면 speak()가 호출되지 않아 그 onend로 걸어둔 마이크 자동 재시작도
      // 같이 사라진다 — 마이크가 켜진 상태였다면 여기서라도 다시 듣게 한다.
      maybeResumeHandsFree();
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }

  function startListening() {
    // 직전 인스턴스가 아직 살아있으면(예: stop() 호출 후 onend가 비동기로 아직
    // 안 와서) 그대로 두고 또 시작하면 두 인스턴스가 동시에 같은 발화를 인식해
    // handleSend가 중복 호출된다 — 항상 먼저 정리하고 시작한다.
    if (recogRef.current) {
      const prev = recogRef.current;
      prev.onresult = null;
      prev.onend = null;
      prev.onerror = null;
      try {
        prev.abort();
      } catch {
        /* noop */
      }
      recogRef.current = null;
    }

    const SR = getSpeechRecognition();
    if (!SR) return;
    const recog = new SR();
    recog.lang = 'en-US';
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    // continuous=false라 말을 시작하기 전 잠깐 머뭇거리거나(무음 타임아웃, 보통
    // 5~10초) 끝말이 애매하면 결과 없이 onend가 와버린다 — 그래도 마이크 UI는
    // 계속 "듣고 있어요"로 남아있어 사용자는 자기 말이 전혀 인식되지 않는 것처럼
    // 느낀다. 최종 결과를 보냈는지 여기 플래그로 추적해 분기한다.
    let gotFinal = false;
    recog.onresult = (e: SpeechRecognitionEvent) => {
      // 이 인스턴스가 더 이상 현재 활성 인스턴스가 아니면(이미 정리됐으면) 무시 —
      // 그래야 같은 발화가 두 번 전송되는 일이 없다.
      if (recogRef.current !== recog) return;
      let interimTxt = '';
      let finalTxt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTxt += r[0].transcript;
        else interimTxt += r[0].transcript;
      }
      setInterim(interimTxt);
      if (finalTxt.trim()) {
        gotFinal = true;
        bumpSpoken(); // 회화 마이크 발화 집계
        setInterim('');
        handleSend(finalTxt.trim());
      }
    };
    recog.onend = () => {
      setInterim('');
      // onend는 비동기로 도착하므로, 그 사이 startListening()이 다시 불려 이미
      // 새 인스턴스로 교체됐다면(recogRef.current !== recog) 그 새 인스턴스를
      // 실수로 지우지 않는다.
      if (recogRef.current === recog) recogRef.current = null;
      // 결과 없이 끝났고 사용자가 마이크를 직접 끈 게 아니라면(micOnRef true) —
      // 곧바로 다시 듣기 시작해 "듣고 있어요" UI와 실제 인식 상태가 어긋나지
      // 않게 한다. isProcessing 중(AI 응답 대기/말하는 중)이면 maybeResumeHandsFree가
      // 알아서 재시작하므로 여기서는 건너뛴다.
      if (!gotFinal && micOnRef.current && !isProcessingRef.current) {
        setTimeout(() => {
          if (micOnRef.current && !isProcessingRef.current) startListening();
        }, 300);
      }
    };
    // onerror가 없으면 두 번째 턴부터(자동 재시작 시) 권한/디바이스 오류가 나도
    // 아무 처리 없이 조용히 멈춰버린다 — 화면은 계속 "듣고 있어요"로 보이지만
    // 실제로는 인식이 죽어있는 상태가 된다. 여기서 정리하고, 권한 거부처럼
    // 재시도해도 의미 없는 오류면 마이크를 꺼서 사용자가 다시 탭하게 한다.
    // no-speech 등 일시적 오류는 막지 않는다 — onend가 뒤따라 호출돼 위의
    // 재시작 로직이 자동으로 다시 듣기를 시작한다.
    recog.onerror = (e: SpeechRecognitionErrorEvent) => {
      setInterim('');
      if (recogRef.current === recog) recogRef.current = null;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        micOnRef.current = false;
        setMicOn(false);
      }
    };
    recogRef.current = recog;
    try {
      recog.start();
    } catch {
      // 일부 기기는 이전 인식이 디바이스를 막 반환한 직후 곧바로 start()하면
      // 실패한다 — 조용히 죽지 않도록 정리해 다음 시도가 가능하게 한다.
      recogRef.current = null;
    }
  }

  function toggleMic() {
    // 음성 인식 미지원 브라우저(예: 데스크탑 Firefox)에서는 getSpeechRecognition()이
    // null이라 startListening()이 아무것도 안 하고 조용히 끝난다 — 그런데도 마이크를
    // "듣는 중" 상태로 켜버리면 사용자는 영원히 응답 없는 화면만 보게 된다.
    if (!micOn && !getSpeechRecognition()) {
      setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: '🎙️ 이 브라우저는 음성 인식을 지원하지 않아요. Chrome/Edge를 사용하거나 입력창에 직접 타이핑해주세요.' }]);
      return;
    }
    const next = !micOn;
    setMicOn(next);
    micOnRef.current = next;
    if (next) {
      primeAudio(); // 마이크를 켜는 클릭(제스처) 안에서 미리 오디오를 언락해둔다
      startListening();
    } else {
      recogRef.current?.stop();
      stopSpeaking();
    }
  }

  /** 보이스 모드 시작 — 탭 한 번으로 연속 음성 대화 세션을 연다. */
  function enterVoiceMode() {
    if (!getSpeechRecognition()) {
      setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: '이 브라우저는 음성 인식을 지원하지 않아요. Chrome/Edge를 사용하거나 입력창에 직접 타이핑해주세요.' }]);
      return;
    }
    primeAudio(); // 진입 제스처 안에서 오디오 언락
    setVoiceMode(true);
    setMicOn(true);
    micOnRef.current = true;
    startListening();
  }

  function exitVoiceMode() {
    setVoiceMode(false);
    micOnRef.current = false;
    setMicOn(false);
    recogRef.current?.stop();
    stopSpeaking();
    setAiSpeaking(false);
  }

  /** 오브 탭 — AI가 말하는 중이면 끼어들기(정지 후 바로 듣기), 멈춰 있으면 다시 듣기. */
  function orbTap() {
    if (aiSpeaking) {
      stopSpeaking();
      setAiSpeaking(false);
      if (micOnRef.current) startListening();
      return;
    }
    if (!isProcessingRef.current) {
      micOnRef.current = true;
      setMicOn(true);
      startListening();
    }
  }

  function sendText() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    handleSend(text);
  }

  function sendChip(text: string) {
    if (isProcessing) return;
    handleSend(text);
  }

  function askForSuggestions() {
    if (isProcessing) return;
    const cefr = cefrOf(lesson);
    setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: '💡 코치가 답변 예시를 준비 중...' }]);
    handleSend(
      `(도움 요청) 방금 네 질문/말에 내가 어떻게 답하면 좋을지 ${cefr} 수준의 짧고 자연스러운 영어 문장 3개를 제안해줘. 각 줄을 "- "로 시작하고, 각 문장 끝에 [EXPLAIN: 한국어 뜻]을 붙여줘.`,
      true
    );
  }

  function requestSummary() {
    if (historyRef.current.length < 2) {
      setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: '아직 대화가 충분하지 않습니다. 먼저 영어로 대화해 보세요!' }]);
      return;
    }
    setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: '📋 AI 코치가 오늘 연습을 평가 중...' }]);
    handleSend('지금까지의 대화를 평가해주세요. 한국어로: 1) 잘한 점 2) 자주 틀린 패턴 3) 복습할 표현 3개를 [EXPLAIN: ] 형식으로 정리해주세요.', true);
  }

  function toggleBgCorrect() {
    const on = !bgCorrectOn;
    setBgCorrectOn(on);
    store('va_bgcorrect', on);
  }

  async function translate(id: number, text: string) {
    const msg = messages.find((m) => m.id === id);
    if (msg && msg.kind === 'ai' && msg.translation) {
      updateMsg(id, { translation: null });
      return;
    }
    updateMsg(id, { translating: true });
    try {
      const ko = await groqComplete(
        [{ role: 'user', content: `다음 영어를 자연스러운 한국어로 번역만 해줘. 설명·따옴표·영어 원문 없이 한국어 번역문만 출력:\n\n${text}` }],
        { temperature: 0.2, maxTokens: 260 }
      );
      updateMsg(id, { translation: ko.trim(), translating: false });
    } catch {
      updateMsg(id, { translating: false });
    }
  }

  async function analyzeCaf() {
    const utterances = historyRef.current.filter((h) => h.role === 'user').map((h) => h.content);
    const transcript = utterances.join(' ');
    if (transcript.split(/\s+/).filter(Boolean).length < 3) {
      setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: 'CAF 분석은 먼저 영어로 몇 문장 말한 뒤에 가능합니다.' }]);
      return;
    }
    setCafBusy(true);
    const cefr = cefrOf(lesson);
    const next = CEFR_NEXT[cefr];
    const stamps = talkStampsRef.current;
    const duration = stamps.length >= 2 ? (stamps[stamps.length - 1] - stamps[0]) / 1000 : null;
    const words = transcript.match(/[A-Za-z']+/g) || [];
    const wpm = duration && duration > 0 ? words.length / (duration / 60) : null;
    try {
      const raw = JSON.parse((await groqComplete([{ role: 'user', content: buildCafPrompt(transcript, cefr, next, wpm) }], { temperature: 0.3, maxTokens: 800, json: true })) || '{}');
      const clamp = (v: unknown, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, parseFloat(String(v)) || 0));
      const fillers = (transcript.match(/\b(um+|uh+|er+|like|you know|i mean|kind of|sort of|well)\b/gi) || []).length;
      const fillerRatio = words.length ? fillers / words.length : 0;
      const result: CafResult = {
        complexity: Math.round(clamp(raw.complexity) * 10) / 10,
        accuracy: Math.round(clamp(raw.accuracy) * 10) / 10,
        fluency: Math.round(Math.max(0, clamp(raw.fluency) - (fillerRatio > 0.1 ? fillerRatio * 10 : 0)) * 10) / 10,
        errors: (raw.errors || []).slice(0, 3),
        paraphrases: (raw.paraphrases || []).slice(0, 3),
        summary_ko: String(raw.summary_ko || '').trim(),
        metrics: { word_count: words.length, wpm: wpm ? Math.round(wpm * 10) / 10 : null },
      };
      setMessages((prev) => [...prev, { id: nextId(), kind: 'caf', cefr, result }]);
      const band = { A1: [10, 22], A2: [22, 36], B1: [36, 52], B2: [52, 64], C1: [64, 76], C2: [76, 90] }[cefr];
      const avg = (result.complexity + result.accuracy + result.fluency) / 3;
      const sessionGse = Math.round(band[0] + (avg / 10) * (band[1] - band[0]));
      bumpSkill('speaking', sessionGse);
      const sessions = load<{ date: string; lessonId: number; cefr: string; caf: unknown; wpm: number | null; gse: number }[]>('va_sessions', []);
      sessions.push({ date: new Date().toISOString(), lessonId: lesson.id, cefr, caf: { complexity: result.complexity, accuracy: result.accuracy, fluency: result.fluency }, wpm: result.metrics.wpm, gse: sessionGse });
      store('va_sessions', sessions.slice(-50));
    } catch (err) {
      const e = err as Error;
      if (e instanceof GroqError && e.message === 'NO_GROQ_KEY') {
        setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: '⚡ CAF 분석을 위해 무료 Groq 키를 등록하세요.' }]);
        setHasKey(false);
      } else {
        setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: `❌ CAF 분석 실패: ${e.message}` }]);
      }
    } finally {
      setCafBusy(false);
    }
  }

  function savePhrase(text: string) {
    addPhrase({ en: text, kr: '', lesson: lesson.id });
  }

  async function saveKey() {
    const k = keyInput.trim();
    if (!k || keyChecking) return;
    setKeyChecking(true);
    setKeyError('');
    // 무효한 키를 조용히 받아들이면 모든 AI 기능이 소리 없이 401로 죽는다
    // (실제 발생한 사고) — 등록 전에 Groq에 실검증한다.
    const valid = await validateGroqKey(k);
    setKeyChecking(false);
    if (valid === false) {
      setKeyError('이 키는 Groq에서 거부됐어요(만료·폐기됐을 수 있음). console.groq.com에서 새 키를 발급해 주세요.');
      return;
    }
    saveGroqKey(k);
    setHasKey(true);
    setKeyInput('');
    setMessages((prev) => [...prev, { id: nextId(), kind: 'system', text: valid === true ? 'Groq 키 확인 완료 — AI 회화·음성이 활성화됐어요.' : 'Groq 키를 저장했어요(네트워크 문제로 검증은 건너뜀).' }]);
  }

  const helperChips = [...new Set([...(lesson.examples || []).slice(0, 2).map((e) => e.en), ...TALK_STARTERS])].slice(0, 6);
  const micSupported = !!getSpeechRecognition();

  return (
    <div className="talk-screen">
      {!hasKey && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, margin: '0 0 10px' }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 800, marginBottom: 6 }}>🔑 무료 Groq API 키가 필요해요</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
            console.groq.com 에서 무료로 발급받은 키를 붙여넣으면 AI 회화·교정·CAF 분석이 모두 활성화됩니다.
          </div>
          {keyError && <div style={{ fontSize: '0.76rem', color: 'var(--red)', lineHeight: 1.5, marginBottom: 8 }}>{keyError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="text-input"
              type="password"
              placeholder="gsk_..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveKey()}
            />
            <button className="btn primary" style={{ flex: '0 0 auto' }} onClick={saveKey} disabled={keyChecking}>
              {keyChecking ? '확인 중…' : '등록'}
            </button>
          </div>
        </div>
      )}

      <div className="chat-box" ref={chatBoxRef}>
        {messages.map((m) => {
          if (m.kind === 'intro') {
            return (
              <div className="msg" key={m.id}>
                <div className="talk-intro">
                  <div className="ti-head">{m.scenario.title}</div>
                  <div className="ti-desc">{m.scenario.desc}</div>
                  {m.examples.length > 0 && (
                    <>
                      <div className="ti-sec">이렇게 말해보세요</div>
                      <div className="ti-ex">
                        {m.examples.map((e, i) => (
                          <div key={i}>
                            · {e.en} <span className="k">— {e.kr}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="ti-go">마이크 또는 입력창으로 영어 대화를 시작해 보세요!</div>
                </div>
              </div>
            );
          }
          if (m.kind === 'system') {
            return (
              <div className="msg system" key={m.id}>
                <div className="bubble">{m.text}</div>
              </div>
            );
          }
          if (m.kind === 'caf') {
            return <CafCard key={m.id} cefr={m.cefr} result={m.result} onSave={savePhrase} />;
          }
          if (m.kind === 'user') {
            return (
              <div className="msg user" key={m.id}>
                <div className="bubble">{m.text}</div>
                <div className="msg-meta">{m.time}</div>
                {m.correction === 'pending' && <div className="bg-correct" style={{ alignSelf: 'flex-end' }}><div className="bgc-head">✏️ 분석 중...</div></div>}
                {m.correction && m.correction !== 'pending' && <CorrectionNote c={m.correction} onSave={savePhrase} />}
              </div>
            );
          }
          // ai
          const parsed = parseAiText(m.text);
          return (
            <div className="msg ai" key={m.id}>
              <div className="ai-avatar" aria-hidden="true">AI</div>
              <div className="msg-col">
                <div className={`bubble${m.streaming ? ' typing' : ''}`}>
                  {parsed.plain || (m.streaming ? <TypingDots /> : '')}
                  {parsed.heard.map((h, i) => (
                    <div className="correction-box" key={i}>
                      <div className="label">발음 피드백</div>
                      내가 들은 말: <span className="wrong">{h.heard}</span> → 네 의도: <span className="right">{h.intent}</span>
                      <br />
                      <span style={{ opacity: 0.85, fontSize: '0.78rem' }}>{h.note}</span>
                    </div>
                  ))}
                  {parsed.explain.map((ex, i) => (
                    <div className="explain-box" key={i}>
                      <div className="label">코치 설명</div>
                      {ex}
                    </div>
                  ))}
                </div>
                {!m.streaming && parsed.plain && (
                  <div className="msg-meta">
                    {m.time}
                    <button className="tr-btn" disabled={m.translating} onClick={() => translate(m.id, parsed.plain)}>
                      {m.translating ? '번역중' : m.translation ? '숨기기' : '번역'}
                    </button>
                    <button className="tr-btn" onClick={() => savePhrase(parsed.plain)}>
                      저장
                    </button>
                  </div>
                )}
                {m.translation && <div className="tr-box">{m.translation}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {voiceMode && (
        <VoiceOverlay
          state={(aiSpeaking ? 'speaking' : isProcessing ? 'thinking' : micOn ? 'listening' : 'idle') as VoiceState}
          interim={interim}
          lastUser={[...messages].reverse().find((m) => m.kind === 'user')?.kind === 'user' ? ([...messages].reverse().find((m) => m.kind === 'user') as { text: string }).text : ''}
          lastAi={(() => {
            const m = [...messages].reverse().find((x) => x.kind === 'ai') as { text?: string } | undefined;
            return m?.text ? parseAiText(m.text).plain : '';
          })()}
          onOrbTap={orbTap}
          onClose={exitVoiceMode}
        />
      )}

      <div className="input-area">
        <div className="helper-chips">
          <button className="helper-chip hint" onClick={askForSuggestions} title="AI가 지금 상황에 맞는 영어 답변 예시를 제안해줍니다">
            뭐라고 답하지?
          </button>
          {helperChips.map((c) => (
            <button className="helper-chip" key={c} onClick={() => sendChip(c)} title="탭하면 이 문장으로 답합니다">
              {c}
            </button>
          ))}
        </div>
        {micOn ? (
          <div className="voice-wave-row">
            <VoiceWave />
            <span className="voice-wave-txt">{interim || '듣고 있어요…'}</span>
          </div>
        ) : (
          interim && <div className="interim">{interim}</div>
        )}
        <div className="mini-actions">
          <button className="mini-btn" onClick={toggleBgCorrect}>
            교정 {bgCorrectOn ? 'ON' : 'OFF'}
          </button>
          <button className="mini-btn" onClick={requestSummary}>
            요약
          </button>
          <button className="mini-btn" onClick={analyzeCaf} disabled={cafBusy}>
            {cafBusy ? '분석중' : 'CAF'}
          </button>
        </div>
        <div className="controls">
          {/* placeholder는 좁은 화면에서 잘리지 않는 길이로 — 마이크 사용법은 옆 버튼이 안내한다 */}
          <input
            className="text-input"
            placeholder="영어로 입력하기"
            maxLength={500}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
          />
          <button
            className={`round-btn${micOn ? ' listening' : ''}`}
            onClick={enterVoiceMode}
            disabled={!micSupported && !micOn}
            title={micSupported ? '음성 대화 시작 — 말하면 자동으로 이어져요' : '이 브라우저는 음성 인식을 지원하지 않아요'}
          >
            <MicIcon />
          </button>
          <button className={`round-btn send${isProcessing ? ' processing' : ''}`} onClick={sendText} disabled={isProcessing} title="전송">
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <>
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </>
  );
}

/** 녹음 중 음성 파형 — 막대 5개가 들쑥날쑥 뛰며 "듣는 중"을 시각적으로 보여준다. */
function VoiceWave() {
  return (
    <div className="voice-wave" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

function CorrectionNote({ c, onSave }: { c: Correction; onSave: (text: string) => void }) {
  const [open, setOpen] = useState(!c.is_correct);
  return (
    <div className={`bg-correct${open ? ' open' : ''}`} style={{ alignSelf: 'flex-end' }}>
      <div className={`bgc-head ${c.is_correct ? 'ok' : 'warn'}`} onClick={() => setOpen((v) => !v)}>
        {c.is_correct ? '✏️ 문법 좋아요 ✓' : '✏️ 이렇게 고치면 더 좋아요'}
        <span className="bgc-toggle">{open ? '접기' : '자세히'}</span>
      </div>
      <div className="bgc-body">
        {!c.is_correct && c.corrected_sentence && (
          <div className="bgc-row">
            ✅ <b style={{ color: 'var(--green-dk)' }}>{c.corrected_sentence}</b>{' '}
            <button className="speak-mini" onClick={() => speak(c.corrected_sentence)}>🔊</button>{' '}
            <button className="speak-mini" onClick={() => onSave(c.corrected_sentence)}>📌</button>
          </div>
        )}
        {c.native_expression && (
          <div className="bgc-row">
            💬 자연스럽게: <b>{c.native_expression}</b>{' '}
            <button className="speak-mini" onClick={() => speak(c.native_expression)}>🔊</button>{' '}
            <button className="speak-mini" onClick={() => onSave(c.native_expression)}>📌</button>
          </div>
        )}
        {c.korean_feedback && <div className="bgc-fb">{c.korean_feedback}</div>}
      </div>
    </div>
  );
}

function CafCard({ cefr, result, onSave }: { cefr: string; result: CafResult; onSave: (text: string) => void }) {
  const next = CEFR_NEXT[cefr as keyof typeof CEFR_NEXT];
  return (
    <div className="msg system" style={{ maxWidth: '100%', width: '100%' }}>
      <div className="caf-wrap" style={{ textAlign: 'left', maxWidth: '100%' }}>
        <h3>🎯 CAF 분석 · 현재 {cefr}</h3>
        <div className="caf-sub">{result.summary_ko}</div>
        <div className="caf-bars">
          <CafBar name="복잡도" val={result.complexity} color="var(--primary)" />
          <CafBar name="정확도" val={result.accuracy} color="var(--green)" />
          <CafBar name="유창성" val={result.fluency} color="var(--yellow)" />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          {result.metrics.wpm ? `🗣 ${result.metrics.wpm} WPM · ` : ''}🔤 {result.metrics.word_count}단어
        </div>
        {result.errors.length > 0 && (
          <>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, margin: '10px 0 4px' }}>📝 핵심 교정</div>
            {result.errors.map((e, i) => (
              <div className="para-card" key={i} style={{ background: 'rgba(194,117,12,0.08)', borderColor: 'rgba(194,117,12,0.3)' }}>
                <span className="or">{e.wrong}</span> → <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>{e.right}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}> ({e.type})</span>
                <br />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{e.why_ko}</span>
              </div>
            ))}
          </>
        )}
        {result.paraphrases.length > 0 && (
          <>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, margin: '10px 0 4px' }}>✨ {next} 레벨 세련된 표현</div>
            {result.paraphrases.map((p, i) => (
              <div className="para-card" key={i}>
                <span className="or">{p.original}</span>
                <br />
                <span className="up">{p.upgraded}</span>{' '}
                <button className="speak-mini" onClick={() => speak(p.upgraded)}>🔊</button>{' '}
                <button className="speak-mini" onClick={() => onSave(p.upgraded)}>📌</button>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{p.note_ko}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function CafBar({ name, val, color }: { name: string; val: number; color: string }) {
  return (
    <div className="caf-bar-row">
      <span className="name">{name}</span>
      <span className="track">
        <span className="fl" style={{ width: `${val * 10}%`, background: color }} />
      </span>
      <span className="val">{val.toFixed(1)}</span>
    </div>
  );
}
