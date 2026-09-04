import { NextResponse } from 'next/server';

/**
 * Preply 수업 노트 동기화 라우트 — Notion "영어 진옥" 페이지 트리에서
 * 회차 노트들의 **원문 텍스트**를 수집해 돌려준다. 구조화(문장/약점/숙제
 * 추출)는 클라이언트의 AI 계층(aiGuard, 노트별 해시 캐시)이 맡는다 —
 * 서버리스는 무상태라 여기서 AI를 돌리면 매 동기화마다 재추출하게 된다.
 *
 * 필요 환경변수: NOTION_API_KEY(내부 통합 토큰), NOTION_PREPLY_PAGE_ID.
 * 미설정이면 501 — 클라이언트는 이를 "실패"가 아니라 "미설정" 상태로 안내하고
 * 시드 스냅숏으로 동작한다.
 */

const NOTION_VERSION = '2022-06-28';
const FETCH_TIMEOUT_MS = 10000;
/** 회차 페이지 수집 상한 — 폭주 방지 */
const MAX_CHILD_PAGES = 20;
/** 노트당 원문 상한 — AI 추출 프롬프트가 감당할 크기로 */
const MAX_RAW_CHARS = 4000;

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  child_page?: { title: string };
  [key: string]: unknown;
}

async function notionGet(path: string, key: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`https://api.notion.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${key}`, 'Notion-Version': NOTION_VERSION },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Notion ${resp.status}`);
    return (await resp.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

/** rich_text 배열에서 평문을 뽑는다 — 블록 타입마다 위치가 같은 규칙을 따른다 */
function textOf(block: NotionBlock): string {
  const body = block[block.type] as { rich_text?: { plain_text?: string }[] } | undefined;
  if (!body?.rich_text) return '';
  return body.rich_text.map((r) => r.plain_text || '').join('');
}

/** 블록 트리를 1단계 깊이까지 평문으로 — 자유 서식 노트에는 이 정도가 충분하다 */
async function collectText(blockId: string, key: string, depth = 0): Promise<string> {
  const data = await notionGet(`blocks/${blockId}/children?page_size=100`, key);
  const blocks = (data.results as NotionBlock[]) || [];
  const lines: string[] = [];
  for (const b of blocks) {
    const t = textOf(b);
    if (t.trim()) lines.push(t.trim());
    if (depth < 2 && b.has_children && b.type !== 'child_page') {
      try {
        lines.push(await collectText(b.id, key, depth + 1));
      } catch {
        /* 하위 블록 실패는 노트 전체를 죽이지 않는다 */
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

export async function GET() {
  const key = process.env.NOTION_API_KEY;
  const pageId = process.env.NOTION_PREPLY_PAGE_ID;
  if (!key || !pageId) {
    return NextResponse.json({ configured: false }, { status: 501 });
  }
  try {
    const root = await notionGet(`blocks/${pageId}/children?page_size=100`, key);
    const blocks = (root.results as NotionBlock[]) || [];
    const childPages = blocks.filter((b) => b.type === 'child_page').slice(0, MAX_CHILD_PAGES);
    const notes = [];
    for (const p of childPages) {
      const title = p.child_page?.title || '';
      try {
        const raw = (await collectText(p.id, key)).slice(0, MAX_RAW_CHARS);
        if (raw.trim()) notes.push({ id: p.id, title, raw });
      } catch {
        /* 개별 노트 실패는 건너뛴다 — 부분 성공이 전체 실패보다 낫다 */
      }
    }
    // 부모 페이지 본문(1회차가 인라인 미팅노트로 있음)도 하나의 노트로
    const rootText = blocks
      .filter((b) => b.type !== 'child_page')
      .map(textOf)
      .filter(Boolean)
      .join('\n')
      .slice(0, MAX_RAW_CHARS);
    if (rootText.trim()) notes.unshift({ id: pageId, title: '1회차(본문)', raw: rootText });
    return NextResponse.json({ configured: true, notes });
  } catch (e) {
    return NextResponse.json({ configured: true, error: (e as Error).message }, { status: 502 });
  }
}
