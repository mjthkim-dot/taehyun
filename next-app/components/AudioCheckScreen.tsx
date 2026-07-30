'use client';

/**
 * 음성 진단 — "소리가 안 나요"를 추측이 아니라 데이터로 잡는 도구.
 * 오디오 체인(키 → TTS 서버 호출 → 신경망 음성 재생 → 브라우저 폴백)을
 * 사용자 기기에서 단계별로 실행해 어느 고리가 끊기는지 그 자리에서 보여준다.
 * '결과 복사'로 진단 내용을 그대로 공유할 수 있다.
 */
import { useState } from 'react';
import { APP_VERSION } from '../lib/version';
import { groqKey, SERVER_GROQ_SENTINEL } from '../lib/state';
import { validateGroqKey } from '../lib/groq';
import { primeAudio, playUrl } from './SpeakButton';

interface StepResult {
  name: string;
  /** true 통과 / false 실패 / null 건너뜀 */
  ok: boolean | null;
  detail: string;
}

export default function AudioCheckScreen() {
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setCopied(false);
    const acc: StepResult[] = [];
    const push = (s: StepResult) => {
      acc.push(s);
      setSteps([...acc]);
    };

    primeAudio(); // 진단 시작 탭(제스처) 안에서 오디오 언락 — 실제 사용 조건과 동일

    // 0) 장치 출력 비프 — 네트워크·TTS와 무관한 순수 출력 테스트.
    //    이 소리조차 안 들리면 앱 문제가 아니라 기기 음소거/무음 스위치/볼륨 문제다.
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.12;
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        await new Promise((r) => setTimeout(r, 350));
        osc.stop();
        await ctx.close();
        push({ name: '장치 출력(비프)', ok: true, detail: '0.35초 비프 재생 시도 — 방금 삐 소리가 안 들렸다면 기기 음소거/무음 스위치(iPhone 측면)/미디어 볼륨 문제입니다' });
      } else {
        push({ name: '장치 출력(비프)', ok: null, detail: 'WebAudio 미지원 — 건너뜀' });
      }
    } catch (e) {
      push({ name: '장치 출력(비프)', ok: false, detail: `비프 실패: ${(e as Error).message}` });
    }

    // 1) 환경
    try {
      const nav = navigator as Navigator & { standalone?: boolean };
      const standalone = (window.matchMedia?.('(display-mode: standalone)').matches ?? false) || nav.standalone === true;
      const synth = window.speechSynthesis;
      const voices = synth ? synth.getVoices() : [];
      const enVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith('en')).length;
      push({
        name: '환경',
        ok: true,
        detail: `v${APP_VERSION} · ${standalone ? '설치형 PWA' : '브라우저 탭'} · 합성 보이스 en ${enVoices}/${voices.length}개 · ${navigator.userAgent.slice(0, 90)}`,
      });
    } catch (e) {
      push({ name: '환경', ok: false, detail: String((e as Error).message) });
    }

    // 2) Groq 키
    const local = groqKey();
    let serverKey = false;
    try {
      const r = await fetch('/app/api/groq');
      serverKey = (await r.json()).hasServerKey === true;
    } catch {
      /* 네트워크 실패는 3단계에서 드러난다 */
    }
    let keyValid: boolean | null = null;
    if (local && local !== SERVER_GROQ_SENTINEL) keyValid = await validateGroqKey(local);
    push({
      name: 'Groq 키',
      ok: keyValid === false ? false : !!local || serverKey,
      detail: local
        ? local === SERVER_GROQ_SENTINEL
          ? '서버 키 사용'
          : `로컬 키 등록됨(${local.slice(0, 6)}…)${keyValid === true ? ' · 유효 확인' : keyValid === false ? ' · ⚠️ Groq에서 거부(만료/폐기) — console.groq.com에서 재발급 필요' : ''}`
        : serverKey
          ? '서버 키 있음'
          : '키 없음 — 신경망 음성을 쓸 수 없어요(회화 탭에서 무료 키 등록)',
    });

    // 2.5) 서버→Groq 실연결 — 서버 키로 Groq에 초소형 합성을 직접 시도해
    //      키 등급/모델 접근 문제를 서버 관점에서 분리 판정한다.
    try {
      const r = await fetch('/app/api/tts');
      const j = await r.json();
      if (j.ok) {
        push({ name: '서버→Groq 실연결', ok: true, detail: `정상 · ${(j.bytes / 1024).toFixed(1)}KB 수신 (${j.model})` });
      } else {
        push({
          name: '서버→Groq 실연결',
          ok: j.where === 'server-key' ? null : false,
          detail: `${j.detail}${j.status ? ` (HTTP ${j.status})` : ''}${j.where === 'groq' && (j.status === 403 || j.status === 404) ? ' → 이 키 등급에서 Orpheus 모델이 막혀 있을 가능성이 큽니다' : ''}`,
        });
      }
    } catch (e) {
      push({ name: '서버→Groq 실연결', ok: false, detail: `호출 실패: ${(e as Error).message}` });
    }

    // 3) TTS 서버 호출 — 상태 코드·본문 크기를 그대로 보여준다
    let audioUrl: string | null = null;
    try {
      const resp = await fetch('/app/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello! This is a sound check for your English coach.',
          key: local && local !== SERVER_GROQ_SENTINEL ? local : undefined,
        }),
      });
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 256) {
          audioUrl = URL.createObjectURL(blob);
          push({ name: 'TTS 서버 호출', ok: true, detail: `200 OK · ${(blob.size / 1024).toFixed(1)}KB (${blob.type || 'audio'})` });
        } else {
          push({ name: 'TTS 서버 호출', ok: false, detail: `200이지만 오디오가 비정상적으로 작음(${blob.size}B) — 잘린 응답` });
        }
      } else {
        let msg = `HTTP ${resp.status}`;
        try {
          msg += ` · ${(await resp.json()).error?.message || ''}`;
        } catch {
          /* 본문 없음 */
        }
        const hint =
          resp.status === 401
            ? ' → 키가 없거나 잘못됨'
            : resp.status === 429
              ? ' → 요청 과다(잠시 후 재시도)'
              : resp.status === 400 || resp.status === 403
                ? ' → 모델/입력 거부 — 이 키 등급에서 Orpheus TTS가 막혀 있을 가능성'
                : '';
        push({ name: 'TTS 서버 호출', ok: false, detail: msg + hint });
      }
    } catch (e) {
      push({ name: 'TTS 서버 호출', ok: false, detail: `네트워크 실패: ${(e as Error).message}` });
    }

    // 4) 신경망 음성 실제 재생 — 이 단계에서 소리가 났는지가 곧 정답
    if (audioUrl) {
      const r = await new Promise<string>((resolve) => {
        const t = setTimeout(() => resolve('timeout(10s) — ended 이벤트 없음'), 10000);
        playUrl(audioUrl!, 1, () => {
          clearTimeout(t);
          resolve('ended');
        }).catch((e) => {
          clearTimeout(t);
          resolve(`play() 거부: ${(e as { name?: string })?.name || e}`);
        });
      });
      push({
        name: '신경망 음성 재생',
        ok: r === 'ended',
        detail: r === 'ended' ? '재생 완료 — 방금 이 소리가 들렸다면 정상입니다' : r,
      });
    } else {
      push({ name: '신경망 음성 재생', ok: null, detail: '건너뜀(TTS 호출 실패)' });
    }

    // 5) 브라우저 폴백 음성 — 신경망이 죽었을 때 대신 소리를 내는 경로
    const synth = window.speechSynthesis;
    if (synth) {
      const r = await new Promise<string>((resolve) => {
        const u = new SpeechSynthesisUtterance('This is the browser voice test.');
        u.lang = 'en-US';
        const t = setTimeout(() => resolve('이벤트 없음(7s) — 이 기기에선 폴백이 무음일 수 있음'), 7000);
        u.onend = () => {
          clearTimeout(t);
          resolve('ended');
        };
        u.onerror = (ev) => {
          clearTimeout(t);
          resolve(`error: ${ev.error}`);
        };
        try {
          synth.cancel();
          synth.resume(); // Chrome이 paused 상태에 갇히는 버그 대응
          synth.speak(u);
        } catch (e) {
          clearTimeout(t);
          resolve(`speak 예외: ${(e as Error).message}`);
        }
      });
      push({ name: '브라우저 음성(폴백)', ok: r === 'ended', detail: r === 'ended' ? '재생 완료 — 폴백 경로 정상' : r });
    } else {
      push({ name: '브라우저 음성(폴백)', ok: false, detail: 'speechSynthesis 미지원 기기' });
    }

    setRunning(false);
  }

  async function copyResult() {
    const text = steps.map((s) => `${s.ok === true ? 'OK' : s.ok === false ? 'FAIL' : 'SKIP'} | ${s.name}: ${s.detail}`).join('\n');
    try {
      await navigator.clipboard.writeText(`[음성 진단 v${APP_VERSION}]\n${text}`);
      setCopied(true);
    } catch {
      /* 클립보드 미지원 — 화면의 내용을 직접 캡처하도록 안내 */
    }
  }

  return (
    <div className="study-screen">
      <div className="study-card">
        <h3>음성 진단</h3>
        <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 12 }}>
          소리가 나지 않을 때, 오디오 체인의 어느 단계에서 끊기는지 이 기기에서 직접 확인합니다.
          진단 중 비프음 1번과 영어 음성 2번이 재생됩니다 — 미디어 볼륨을 켜고,
          iPhone이라면 측면 무음 스위치가 꺼져 있는지 먼저 확인하세요.
        </p>
        <button className="btn primary" style={{ width: '100%', marginBottom: 14 }} onClick={run} disabled={running}>
          {running ? '진단 중…' : '진단 시작 (소리 두 번 재생)'}
        </button>

        {steps.map((s) => (
          <div className={`ac-row${s.ok === true ? ' ok' : s.ok === false ? ' fail' : ''}`} key={s.name}>
            <span className="ac-mark">{s.ok === true ? '✓' : s.ok === false ? '✗' : '–'}</span>
            <div className="ac-body">
              <div className="ac-name">{s.name}</div>
              <div className="ac-detail">{s.detail}</div>
            </div>
          </div>
        ))}

        {steps.length > 0 && !running && (
          <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={copyResult}>
            {copied ? '복사됨 — 이 결과를 공유해주세요' : '결과 복사'}
          </button>
        )}
      </div>
    </div>
  );
}
