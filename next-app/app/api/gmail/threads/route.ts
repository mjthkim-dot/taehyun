import { NextResponse } from 'next/server';

/**
 * Gmail 고객 메일 라우트 — "실제 고객과 주고받는 메일이 학습 소스가 되는" 루프의 서버 절반.
 * - GET: 최근 메일 스레드 목록 (프로모션·소셜 등 잡음 카테고리 제외)
 * - GET ?id=: 스레드 본문 평문 수집 — "나:"/"상대:"가 구분된 대화 원문
 * 응답 형태를 /app/api/notion/minutes와 동일하게 맞춰({pages}/{note}) 클라이언트
 * 파이프라인(lib/minutes.ts)이 두 소스를 같은 코드로 다룬다.
 *
 * 인증: OAuth 리프레시 토큰 방식 — GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET /
 * GMAIL_REFRESH_TOKEN 환경변수. 하나라도 없으면 501(미설정 상태).
 */

const FETCH_TIMEOUT_MS = 10000;
const LIST_SIZE = 12;
const MAX_RAW_CHARS = 4000;
const MAX_MSG_CHARS = 1200;
const MAX_MSGS = 6;
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

// 기본 검색: 최근 3주, 잡음 카테고리 제외. GMAIL_QUERY로 바꿀 수 있다.
const DEFAULT_QUERY = 'newer_than:21d -category:promotions -category:social -category:updates -category:forums';

/** 액세스 토큰 캐시 — 리프레시 토큰 교환은 시간이 들어 만료 전까지 재사용한다. */
let tokenCache: { token: string; expiresAt: number } | null = null;

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const resp = await timedFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID || '',
      client_secret: process.env.GMAIL_CLIENT_SECRET || '',
      refresh_token: process.env.GMAIL_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) throw new Error(`OAuth ${resp.status}`);
  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + ((data.expires_in || 3600) - 60) * 1000 };
  return data.access_token;
}

async function gmailCall(path: string, token: string): Promise<Record<string, unknown>> {
  const resp = await timedFetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Gmail ${resp.status}`);
  return (await resp.json()) as Record<string, unknown>;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart & { headers?: GmailHeader[] };
}

function header(m: GmailMessage, name: string): string {
  return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

/** payload 트리에서 text/plain을 찾는다 — 없으면 text/html을 태그 제거해 쓴다. */
function bodyText(part: GmailPart | undefined, wantHtml = false): string {
  if (!part) return '';
  const mime = part.mimeType || '';
  if ((wantHtml ? mime === 'text/html' : mime === 'text/plain') && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf8');
  }
  for (const p of part.parts || []) {
    const t = bodyText(p, wantHtml);
    if (t) return t;
  }
  return '';
}

/**
 * 회신 인용·서명을 걷어낸다 — 대화 생성의 재료는 "이번에 쓴 본문"이다.
 * 완벽할 필요는 없고(AI가 다시 정리한다), 토큰 낭비만 막으면 된다.
 */
function cleanBody(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('>')) continue; // 인용
    if (/^On .{4,80} wrote:\s*$/.test(t)) break; // 영문 인용 헤더
    if (/^\d{4}년.{0,40}작성:\s*$/.test(t)) break; // 한국어 인용 헤더
    if (/^-{2,}\s*$/.test(t) || /^={5,}/.test(t) || /^_{5,}/.test(t)) break; // 서명 구분선
    if (/^(Best Regards|감사합니다\.?\s*$)/i.test(t) && out.length > 3) {
      out.push(t);
      break; // 맺음말 이후는 서명
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeSubject(s: string): string {
  return s.replace(/^(\s*(Re|Fwd|회신|전달):\s*|\[EXT\]\s*)+/i, '').trim();
}

/** From 헤더 → 표시 이름(없으면 주소 앞부분) */
function fromName(v: string): string {
  const m = v.match(/^"?([^"<]+)"?\s*</);
  if (m) return m[1].trim();
  return v.split('@')[0].replace(/[<>]/g, '').trim();
}

/* ── 코스 갱신용 분석 모드 ──
 * 발신 90일 스레드를 표본 수집해 상대(외부 도메인) 클러스터를 집계한다.
 * 2026-08 수동 실사(245 스레드 분석)와 같은 방법의 축소판 — 클라이언트는
 * 이 집계로 클러스터별 대표 스레드를 골라 새 시나리오를 생성한다. */
const ANALYZE_PAGES = 3; // 50 × 3 = 최근 150 스레드 id
const ANALYZE_META = 45; // 메타데이터(제목·수신)를 실제로 읽는 표본 수
const OWN_DOMAIN_RE = /megazone|mz\.co\.kr/;

async function analyze(token: string, me: string) {
  const q = process.env.GMAIL_QUERY_SENT || 'in:sent newer_than:90d';
  const ids: string[] = [];
  let pageToken = '';
  for (let i = 0; i < ANALYZE_PAGES; i++) {
    const page = (await gmailCall(
      `threads?q=${encodeURIComponent(q)}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`,
      token
    )) as { threads?: { id: string }[]; nextPageToken?: string };
    ids.push(...(page.threads || []).map((t) => t.id));
    pageToken = page.nextPageToken || '';
    if (!pageToken) break;
  }

  const metas = await Promise.all(
    ids.slice(0, ANALYZE_META).map(async (tid) => {
      try {
        const th = (await gmailCall(
          `threads/${tid}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Cc`,
          token
        )) as { messages?: GmailMessage[] };
        const msgs = th.messages || [];
        if (!msgs.length) return null;
        const subject = decodeSubject(header(msgs[0], 'Subject'));
        const rcpts = msgs
          .flatMap((m) => `${header(m, 'To')},${header(m, 'Cc')}`.split(','))
          .map((r) => (r.match(/[\w.+-]+@[\w.-]+/) || [])[0] || '')
          .filter((r) => r && !OWN_DOMAIN_RE.test(r) && (me === '' || !r.includes(me)));
        return { id: tid, subject, domains: [...new Set(rcpts.map((r) => r.split('@')[1]))] };
      } catch {
        return null;
      }
    })
  );

  const byDomain = new Map<string, { threads: number; repId: string; repTitle: string; samples: string[] }>();
  for (const m of metas) {
    if (!m) continue;
    for (const d of m.domains) {
      const cur = byDomain.get(d) || { threads: 0, repId: m.id, repTitle: m.subject, samples: [] };
      cur.threads += 1;
      if (m.subject && cur.samples.length < 3) cur.samples.push(m.subject);
      byDomain.set(d, cur);
    }
  }
  const counterparts = [...byDomain.entries()]
    .sort((a, b) => b[1].threads - a[1].threads)
    .slice(0, 6)
    .map(([domain, v]) => ({ domain, ...v }));
  return { totalThreads: ids.length, sampled: metas.filter(Boolean).length, counterparts };
}

export async function GET(req: Request) {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return NextResponse.json({ configured: false }, { status: 501 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const mode = url.searchParams.get('mode');
  try {
    const token = await accessToken();
    const me = ((await gmailCall('profile', token)) as { emailAddress?: string }).emailAddress || '';

    if (mode === 'analyze') {
      return NextResponse.json({ configured: true, analysis: await analyze(token, me) });
    }

    if (id) {
      // 본문 요청 — 스레드 전체를 "나:/상대:" 대화 원문으로
      const thread = (await gmailCall(`threads/${encodeURIComponent(id)}?format=full`, token)) as {
        messages?: GmailMessage[];
      };
      const msgs = (thread.messages || []).slice(-MAX_MSGS);
      if (!msgs.length) throw new Error('빈 스레드');
      const title = decodeSubject(header(msgs[0], 'Subject')) || '(제목 없음)';
      const parts: string[] = [];
      for (const m of msgs) {
        const from = header(m, 'From');
        const isMe = me !== '' && from.includes(me);
        let text = bodyText(m.payload);
        if (!text) text = bodyText(m.payload, true).replace(/<[^>]+>/g, ' ');
        const cleaned = cleanBody(text).slice(0, MAX_MSG_CHARS);
        if (cleaned) parts.push(`[${isMe ? '나' : `상대(${fromName(from)})`}]\n${cleaned}`);
      }
      const raw = parts.join('\n\n').slice(0, MAX_RAW_CHARS);
      if (!raw) throw new Error('본문 없음');
      return NextResponse.json({ configured: true, note: { id, title, raw } });
    }

    // 목록 요청 — 스레드 나열 후 메타데이터(제목·시각·상대)를 병렬 수집
    const q = process.env.GMAIL_QUERY || DEFAULT_QUERY;
    const list = (await gmailCall(`threads?q=${encodeURIComponent(q)}&maxResults=${LIST_SIZE}`, token)) as {
      threads?: { id: string }[];
    };
    const metas = await Promise.all(
      (list.threads || []).map(async (t) => {
        try {
          const th = (await gmailCall(
            `threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
            token
          )) as { messages?: GmailMessage[] };
          const msgs = th.messages || [];
          if (!msgs.length) return null;
          const last = msgs[msgs.length - 1];
          const other = msgs.map((m) => header(m, 'From')).find((f) => me === '' || !f.includes(me));
          const subject = decodeSubject(header(msgs[0], 'Subject')) || '(제목 없음)';
          return {
            id: t.id,
            title: other ? `${subject} · ${fromName(other)}` : subject,
            editedAt: last.internalDate ? new Date(Number(last.internalDate)).toISOString() : '',
          };
        } catch {
          return null; // 스레드 하나의 실패가 목록을 죽이지 않는다
        }
      })
    );
    return NextResponse.json({ configured: true, pages: metas.filter(Boolean) });
  } catch (e) {
    return NextResponse.json({ configured: true, error: (e as Error).message }, { status: 502 });
  }
}
