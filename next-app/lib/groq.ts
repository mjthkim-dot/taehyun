/**
 * Groq Chat Completions 클라이언트 — voice-assistant/index.html 의 _groqFetch/groqStream/groqComplete 포팅.
 * 모델 선택 드롭다운(WebLLM/Ollama 등)은 이번 단계에서 제외하고 Groq 고정 모델만 사용한다.
 */
import { groqKey } from './state';

export const GROQ_MODEL = 'llama-3.3-70b-versatile';

export class GroqError extends Error {}

async function groqFetch(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean; stream?: boolean } = {}
) {
  const key = groqKey();
  if (!key) throw new GroqError('NO_GROQ_KEY');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      stream: opts.stream ?? false,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 400,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  }).catch((err) => {
    throw new GroqError(`NETWORK: ${err.message || err}`);
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const e = await resp.json();
      detail = e.error?.message || detail;
    } catch {
      /* ignore */
    }
    if (resp.status === 401) detail = 'API 키가 올바르지 않습니다. 키를 다시 확인하세요.';
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
  while (true) {
    const { value, done } = await reader.read();
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
