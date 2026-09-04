import { NextResponse } from 'next/server';

/**
 * 회의록 목록/본문 라우트 — "회의록이 생기면 영어 대화문이 되는" 루프의 서버 절반.
 * - GET: 통합에 공유된 페이지 중 최근 수정 순 목록 (Notion search API)
 * - GET ?id=: 해당 페이지 본문 평문 수집 (대화문 생성의 재료)
 * 구조화(영어 대화 생성)는 클라이언트의 aiGuard 파이프라인이 맡는다.
 */

const NOTION_VERSION = '2022-06-28';
const FETCH_TIMEOUT_MS = 10000;
const MAX_RAW_CHARS = 4000;
const LIST_SIZE = 15;

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

async function notionCall(path: string, key: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`https://api.notion.com/v1/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Notion ${resp.status}`);
    return (await resp.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

function textOf(block: NotionBlock): string {
  const body = block[block.type] as { rich_text?: { plain_text?: string }[] } | undefined;
  if (!body?.rich_text) return '';
  return body.rich_text.map((r) => r.plain_text || '').join('');
}

async function collectText(blockId: string, key: string, depth = 0): Promise<string> {
  const data = await notionCall(`blocks/${blockId}/children?page_size=100`, key);
  const blocks = (data.results as NotionBlock[]) || [];
  const lines: string[] = [];
  for (const b of blocks) {
    const t = textOf(b);
    if (t.trim()) lines.push(t.trim());
    if (depth < 2 && b.has_children && b.type !== 'child_page') {
      try {
        lines.push(await collectText(b.id, key, depth + 1));
      } catch {
        /* 하위 실패는 전체를 죽이지 않는다 */
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

export async function GET(req: Request) {
  const key = process.env.NOTION_API_KEY;
  if (!key) return NextResponse.json({ configured: false }, { status: 501 });

  const id = new URL(req.url).searchParams.get('id');
  try {
    if (id) {
      // 본문 요청 — 페이지 제목 + 평문
      const page = (await notionCall(`pages/${id}`, key)) as {
        properties?: Record<string, { title?: { plain_text?: string }[] }>;
      };
      const titleProp = Object.values(page.properties || {}).find((p) => Array.isArray(p.title));
      const title = titleProp?.title?.map((t) => t.plain_text || '').join('') || '';
      const raw = (await collectText(id, key)).slice(0, MAX_RAW_CHARS);
      return NextResponse.json({ configured: true, note: { id, title, raw } });
    }
    // 목록 요청 — 통합에 공유된 페이지, 최근 수정 순
    const data = (await notionCall('search', key, {
      method: 'POST',
      body: JSON.stringify({
        filter: { value: 'page', property: 'object' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: LIST_SIZE,
      }),
    })) as { results?: { id: string; last_edited_time?: string; properties?: Record<string, { title?: { plain_text?: string }[] }> }[] };
    const pages = (data.results || []).map((p) => {
      const titleProp = Object.values(p.properties || {}).find((x) => Array.isArray(x.title));
      return {
        id: p.id,
        title: titleProp?.title?.map((t) => t.plain_text || '').join('') || '(제목 없음)',
        editedAt: p.last_edited_time || '',
      };
    });
    return NextResponse.json({ configured: true, pages });
  } catch (e) {
    return NextResponse.json({ configured: true, error: (e as Error).message }, { status: 502 });
  }
}
