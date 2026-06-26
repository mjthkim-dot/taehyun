/**
 * Groq Chat Completions 클라이언트 — voice-assistant/index.html 의 _groqFetch/groqStream/groqComplete 포팅.
 * 모델 선택 드롭다운(WebLLM/Ollama 등)은 이번 단계에서 제외하고 Groq 고정 모델만 사용한다.
 *
 * Phase 3(No-key UX): 브라우저에서 api.groq.com을 직접 호출하지 않고 항상 우리 서버
 * 프록시(/app/api/groq)를 거친다. 서버에 GROQ_API_KEY가 설정돼 있으면 그 키를 쓰고,
 * 없으면 로컬에 저장된 사용자 키를 fallback으로 함께 보낸다.
 */
import { groqKey, SERVER_GROQ_SENTINEL } from './state';

export const GROQ_MODEL = 'llama-3.3-70b-versatile';

export class GroqError extends Error {}

// 연결 자체가 멈추면(예: 응답 헤더가 영원히 안 옴) fetch가 끝없이 대기한다 —
// 그러면 await 중인 handleSend가 finally까지 못 가서 isProcessingRef가 true로
// 고착돼, 그 뒤로는 마이크·타이핑·칩 어떤 입력도 조용히 무시된다("첫 문장만
// 알아듣고 그 뒤로 반응이 없다"의 원인). TTS 쪽과 동일하게 타임아웃을 둔다.
const GROQ_CONNECT_TIMEOUT_MS = 20000;
// 스트리밍 중 한 청크도 안 오는 시간이 이보다 길면(서버가 응답을 멈춘 경우)
// 같은 이유로 포기하고 에러를 던져 finally가 돌게 한다.
const GROQ_STREAM_IDLE_MS = 15000;

async function groqFetch(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean; stream?: boolean } = {}
) {
  const key = groqKey();
  if (!key) throw new GroqError('NO_GROQ_KEY');
  const localKey = key === SERVER_GROQ_SENTINEL ? undefined : key;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_CONNECT_TIMEOUT_MS);
  const resp = await fetch('/app/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      stream: opts.stream ?? false,
      temperature: opts.temperature ?? 0.7,
      maxTokens: opts.maxTokens ?? 400,
      json: opts.json ?? false,
      key: localKey,
    }),
    signal: controller.signal,
  })
    .catch((err) => {
      throw new GroqError(`NETWORK: ${err.message || err}`);
    })
    .finally(() => clearTimeout(timer));
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const e = await resp.json();
      detail = e.error?.message || detail;
    } catch {
      /* ignore */
    }
    throw new GroqError(detail);
  }
  return resp;
}

/** 스트리밍 응답 (회화) */
export async function* groqStream(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number } = {}
): AsyncGenerator<string> {
  const resp = await groqFetch(messages, { ...opts, stream: true });
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        reader.cancel().catch(() => {});
      }, GROQ_STREAM_IDLE_MS);
      let value: Uint8Array | undefined;
      let done: boolean;
      try {
        ({ value, done } = await reader.read());
      } catch (err) {
        if (timedOut) throw new GroqError('응답이 멈췄어요. 다시 시도해주세요.');
        throw err;
      } finally {
        clearTimeout(timer);
      }
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const o = JSON.parse(data);
          const d = o.choices?.[0]?.delta?.content;
          if (d) yield d;
        } catch {
          /* ignore partial chunk */
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** 비스트리밍 완성 (배경 교정·CAF·번역) */
export async function groqComplete(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}
): Promise<string> {
  const resp = await groqFetch(messages, opts);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}
