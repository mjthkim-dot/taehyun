'use client';

/**
 * 실전 코스 — 지난 90일 Gmail 발신 245개 스레드를 분석해 만든 상황별 커리큘럼.
 *
 * 만든 방법(2026-08-15 실사):
 *  ① 발신 스레드 245개를 상대·주제별로 클러스터링(여기어때 33·부스터스 32·
 *     포시에스 20·센트비 19·파스토 19·씨피랩스 17 / 계약 34·미팅 20·SP 16·빌링 15)
 *  ② 클러스터별 대표 스레드를 정독해 실제 쟁점·숫자·어조를 확보
 *  ③ 6개 트랙 × 3개 시나리오 = 18편의 롤플레이 대화 + 수확 표현 72개로 재구성
 *
 * 각 시나리오의 grounding 필드가 근거 스레드를 밝힌다 — 교재가 아니라
 * "지난 분기의 내 업무"가 커리큘럼이다.
 *
 * 데이터는 코스 화면 청크에만 실린다(홈 번들 영향 없음). 수확 표현은
 * 시나리오를 열 때 SRS(cat '실전')로 들어간다 — 한꺼번에 쏟아부어 복습 큐를
 * 오염시키지 않고, 연습한 것부터 쌓인다(문서 단위 멱등, lib/minutes.ts와 같은 통로).
 */
import course from '../data/realCourse.json';
import type { Dialogue } from './lessons';
import { load, store } from './state';
import { importExpressions, weaknessBrief } from './minutes';
import { groqKoJson, hasHangul } from './aiGuard';

export interface CourseScenario {
  id: string;
  title: string;
  situation: string;
  /** 이 대화의 근거가 된 실제 스레드 */
  grounding: string;
  dialogue: Dialogue;
  expressions: { en: string; kr: string }[];
}

export interface CourseTrack {
  id: string;
  icon: string;
  title: string;
  /** 왜 이 트랙인가 — 메일 데이터 근거 */
  why: string;
  scenarios: CourseScenario[];
}

export interface CourseMeta {
  generatedAt: string;
  periodDays: number;
  sentThreads: number;
  method: string;
  topCustomers: { name: string; threads: number }[];
}

const SEEN_KEY = 'va_course_seen';

export function getCourseMeta(): CourseMeta {
  return (course as { meta: CourseMeta }).meta;
}

export function getCourseTracks(): CourseTrack[] {
  return (course as unknown as { tracks: CourseTrack[] }).tracks;
}

export function totalScenarios(): number {
  return getCourseTracks().reduce((n, t) => n + t.scenarios.length, 0);
}

/** 연습을 시작한(열어본) 시나리오 id들 — 진행률의 근거 */
export function seenScenarios(): string[] {
  return load<string[]>(SEEN_KEY, []);
}

/**
 * 시나리오 열람 처리 — 진행 표시 + 그 시나리오의 수확 표현을 SRS로.
 * 둘 다 멱등이라 재방문에 안전하다. 반환값은 이번에 새로 등록된 표현 수.
 */
export function openScenario(s: CourseScenario): number {
  const seen = seenScenarios();
  if (!seen.includes(s.id)) store(SEEN_KEY, [...seen, s.id]);
  return importExpressions({ noteId: `course-${s.id}`, title: s.title, expressions: s.expressions });
}

/* ── 코스 갱신 루프 ──
 * 2026-08 수동 실사와 같은 방법을 앱 안의 파이프라인으로:
 *   서버 분석(발신 90일 집계) → 상위 클러스터의 대표 스레드 본문 →
 *   Groq 구조화(약점 주입 포함) → 트랙에 🆕 시나리오로 편입.
 * 대표 스레드 원문 해시로 캐시 — 같은 분기엔 다시 눌러도 AI 비용이 없다. */

const EXTRA_KEY = 'va_course_extra';
const REFRESHED_KEY = 'va_course_refreshed_at';
/** 이 일수가 지나면 화면에 "갱신 추천" 배지가 붙는다 */
export const STALE_DAYS = 60;

interface ExtraScenario extends CourseScenario {
  trackId: string;
  addedAt: string;
}

type ExtraStore = Record<string, { hash: number; scenario: ExtraScenario }>;

export function refreshedAt(): string {
  return load<string>(REFRESHED_KEY, '') || getCourseMeta().generatedAt;
}

export function isStale(): boolean {
  const base = new Date(refreshedAt()).getTime();
  return Number.isFinite(base) && Date.now() - base > STALE_DAYS * 86400000;
}

export type MergedScenario = CourseScenario & { extra?: boolean };
export interface MergedTrack extends Omit<CourseTrack, 'scenarios'> {
  scenarios: MergedScenario[];
}

/** 자동 갱신으로 추가된 시나리오까지 합친 트랙 뷰 — 화면이 보는 형태. */
export function getMergedTracks(): MergedTrack[] {
  const extras = Object.values(load<ExtraStore>(EXTRA_KEY, {}));
  const tracks = getCourseTracks().map((t) => ({
    ...t,
    scenarios: [
      ...t.scenarios,
      ...extras.filter((e) => e.scenario.trackId === t.id).map((e) => ({ ...e.scenario, extra: true })),
    ],
  }));
  return tracks;
}

export function totalMergedScenarios(): number {
  return getMergedTracks().reduce((n, t) => n + t.scenarios.length, 0);
}

function hashText(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

export interface RefreshResult {
  ok: boolean;
  unconfigured?: boolean;
  /** 이번에 새로 만든 시나리오 수 (캐시 재사용은 제외) */
  created?: number;
  /** 분석된 스레드 수 (헤더 갱신용) */
  totalThreads?: number;
  error?: string;
}

interface AnalysisCounterpart {
  domain: string;
  threads: number;
  repId: string;
  repTitle: string;
  samples: string[];
}

const TRACK_IDS = ['finops', 'deal', 'care', 'pitch', 'billing', 'relations'];

async function generateScenario(cp: AnalysisCounterpart): Promise<boolean> {
  const resp = await fetch(`/app/api/gmail/threads?id=${encodeURIComponent(cp.repId)}`);
  if (!resp.ok) return false;
  const data = (await resp.json()) as { note?: { title: string; raw: string } };
  if (!data.note?.raw) return false;

  const h = hashText(data.note.raw);
  const cache = load<ExtraStore>(EXTRA_KEY, {});
  if (cache[cp.repId] && cache[cp.repId].hash === h) return false; // 같은 분기 재실행 — 비용 0

  const weakness = weaknessBrief();
  const sys = [
    '너는 고객과 주고받은 이메일 스레드([나]는 사용자, [상대(...)]는 고객)를 영어 회화 훈련 시나리오로 바꾸는 도우미다.',
    '사용자 Taehyun은 한국 클라우드 MSP의 영업 담당(account manager)이다. 아래 JSON만 출력한다:',
    `{"trackId":"${TRACK_IDS.join('|')} 중 이 상황에 가장 맞는 하나",`,
    ' "title":"시나리오 제목 한 줄(한국어)","situation":"상황 설명 한 줄(한국어)",',
    ' "lines":[{"sp":"A 또는 B","en":"영어 대사","kr":"한국어 뜻"} — 8~10줄],',
    ' "expressions":[{"en":"이 상황에서 바로 쓸 원어민 비즈니스 표현","kr":"한국어 뜻"} — 3~4개]}',
    '트랙 의미: finops=비용 리뷰, deal=계약·견적, care=기술 권고·이슈 대응, pitch=제안·신사업, billing=정산·미납, relations=관계·위기.',
    '규칙: A는 Taehyun, B는 상대. en은 영어로만, 나머지는 반드시 한국어. 원문의 실제 쟁점을 반영하고 지어내지 않는다.',
    ...(weakness
      ? ['', '사용자 약점 정보:', weakness, 'A의 대사에 위 약점을 올바르게 사용한 문장을 최소 2개 포함하라.']
      : []),
  ].join('\n');

  const picked = await groqKoJson<Omit<ExtraScenario, 'id' | 'grounding' | 'addedAt' | 'dialogue'> & { lines: { sp: string; en: string; kr: string }[] }>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `스레드 제목: ${data.note.title}\n\n원문:\n${data.note.raw.slice(0, 3500)}` },
    ],
    { temperature: 0.4, maxTokens: 1100 },
    (raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      const lines = (Array.isArray(o.lines) ? (o.lines as { sp?: string; en?: string; kr?: string }[]) : [])
        .filter((l) => (l.sp === 'A' || l.sp === 'B') && typeof l.en === 'string' && !!l.en.trim() && !hasHangul(l.en) && hasHangul(l.kr))
        .map((l) => ({ sp: String(l.sp), en: String(l.en).trim(), kr: String(l.kr).trim() }))
        .slice(0, 12);
      if (lines.length < 6 || !lines.some((l) => l.sp === 'A') || !lines.some((l) => l.sp === 'B')) return null;
      if (!hasHangul(o.title)) return null;
      const expressions = (Array.isArray(o.expressions) ? (o.expressions as { en?: string; kr?: string }[]) : [])
        .filter((x) => typeof x.en === 'string' && x.en.trim() && !hasHangul(x.en) && hasHangul(x.kr))
        .map((x) => ({ en: String(x.en).trim(), kr: String(x.kr).trim() }))
        .slice(0, 4);
      return {
        trackId: TRACK_IDS.includes(String(o.trackId)) ? String(o.trackId) : 'deal',
        title: String(o.title).trim(),
        situation: hasHangul(o.situation) ? String(o.situation).trim() : '',
        lines,
        expressions,
      };
    }
  );
  if (!picked) return false;

  const { lines, ...rest } = picked;
  const scenario: ExtraScenario = {
    id: `x-${cp.repId}`,
    ...rest,
    grounding: `자동 갱신 — ${cp.domain} 대표 스레드 「${data.note.title}」`,
    addedAt: new Date().toISOString(),
    dialogue: { title: picked.title, lines },
  };
  cache[cp.repId] = { hash: h, scenario };
  store(EXTRA_KEY, cache);
  return true;
}

/**
 * 코스 재분석 — 서버 집계 → 상위 4개 상대의 대표 스레드로 새 시나리오 생성.
 * 부분 성공 우선: 클러스터 하나가 실패해도 나머지는 살린다.
 */
export async function refreshCourse(): Promise<RefreshResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, error: 'offline' };
  let analysis: { totalThreads: number; counterparts: AnalysisCounterpart[] };
  try {
    const resp = await fetch('/app/api/gmail/threads?mode=analyze');
    if (resp.status === 501) return { ok: false, unconfigured: true };
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    analysis = ((await resp.json()) as { analysis: typeof analysis }).analysis;
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || String(e) };
  }
  if (!analysis?.counterparts?.length) return { ok: false, error: '분석 결과 없음' };

  let created = 0;
  for (const cp of analysis.counterparts.slice(0, 4)) {
    try {
      if (await generateScenario(cp)) created += 1;
    } catch {
      /* 부분 실패 허용 */
    }
  }
  store(REFRESHED_KEY, new Date().toISOString());
  return { ok: true, created, totalThreads: analysis.totalThreads };
}
