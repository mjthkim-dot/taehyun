/**
 * 드라마 레슨 — "한 번에 할 게 너무 많고, 문제 형식이 반복되고, 재미·몰입이 없다"에 대한 답.
 *
 * 하루 한 편, 5분. 같은 등장인물(태오·Maya·Jun·Diane·Mr. Grant)이 나오는 연속극을 따라가며
 * 표현을 배운다. 문제는 이야기 **속에** 2~4번만 끼어들고 형식이 섞인다
 * (답하기·뜻 알아듣기·빈칸·따라 말하기). 매 화는 다음이 궁금한 장면에서 끝난다.
 * 1~3화는 사람이 쓴 원고(data/dramaSeed.json), 4화부터 AI가 앞 이야기를 기억하며 이어 쓴다.
 */
import seed from '../data/dramaSeed.json';
import { load, store, groqKey, addWeakItem, markPracticedToday } from './state';
import { todayKey } from './dates';
import { groqKoJson, hasHangul } from './aiGuard';
import type { Cefr } from './cefr';

export interface CastMember {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export type Scene =
  | { type: 'narr'; kr: string }
  | { type: 'line'; who: string; en: string; kr: string }
  | { type: 'choice'; prompt: string; opts: { en: string; ok: boolean; why?: string; reply?: { who: string; en: string; kr: string } }[] }
  | { type: 'meaning'; who: string; en: string; opts: string[]; a: number; why: string }
  | { type: 'fill'; who: string; before: string; after: string; opts: string[]; a: number; kr: string; why: string }
  | { type: 'speak'; who: string; en: string; kr: string };

export interface Episode {
  no: number;
  level: string;
  title: string;
  titleKr: string;
  recap: string;
  scenes: Scene[];
  learn: { en: string; kr: string; note: string }[];
  cliff: string;
  ai?: boolean;
}

interface SeedData {
  series: string;
  seriesKr: string;
  cast: CastMember[];
  episodes: Episode[];
}

const S = seed as unknown as SeedData;
export const SERIES = S.series;
export const SERIES_KR = S.seriesKr;
export const CAST = S.cast;

export function castOf(who: string): CastMember {
  return CAST.find((c) => c.id === who) || { id: who, name: who.charAt(0).toUpperCase() + who.slice(1), icon: '🙂', desc: '' };
}

export const INTERACTIVE = new Set(['choice', 'meaning', 'fill', 'speak']);

/* ── 저장 ── */

const EPS_KEY = 'va_drama_eps';
const PROG_KEY = 'va_drama';

interface DramaProgress {
  /** 화 번호 → 본 날짜 */
  done: Record<string, string>;
  /** 화 번호 → 점수(0~100) */
  score: Record<string, number>;
}

function prog(): DramaProgress {
  const p = load<DramaProgress>(PROG_KEY, { done: {}, score: {} });
  return { done: p.done || {}, score: p.score || {} };
}

export function generatedEpisodes(): Episode[] {
  return load<Episode[]>(EPS_KEY, []);
}

export function allEpisodes(): Episode[] {
  const gen = generatedEpisodes().filter((e) => e.no > S.episodes.length);
  return [...S.episodes, ...gen].sort((a, b) => a.no - b.no);
}

export function episodeByNo(no: number): Episode | undefined {
  return allEpisodes().find((e) => e.no === no);
}

export function watched(): number[] {
  return Object.keys(prog().done).map(Number).sort((a, b) => a - b);
}

export function watchedToday(): boolean {
  return Object.values(prog().done).includes(todayKey());
}

export function episodeScore(no: number): number | null {
  return prog().score[String(no)] ?? null;
}

/** 다음에 볼 화 번호(아직 안 본 가장 앞 화) */
export function nextEpisodeNo(): number {
  const w = new Set(watched());
  let n = 1;
  while (w.has(n)) n++;
  return n;
}

/** 에피소드 완료 — 기록, 학습일, 오늘의 표현을 복습 카드로 */
export function completeEpisode(ep: Episode, score: number) {
  const p = prog();
  p.done[String(ep.no)] = todayKey();
  p.score[String(ep.no)] = Math.max(p.score[String(ep.no)] ?? 0, Math.round(score));
  store(PROG_KEY, p);
  markPracticedToday();
  for (const l of ep.learn) addWeakItem({ en: l.en, kr: l.kr, cat: '드라마', lesson: `drama:${ep.no}` });
}

/** 홈 → 드라마 화면으로 갈 때 허브를 건너뛰고 바로 재생하라는 표시(1분 유효) */
export const DRAMA_AUTOPLAY_KEY = 'va_drama_autoplay';
export function requestDramaAutoplay() {
  store(DRAMA_AUTOPLAY_KEY, Date.now());
}

/* ── AI 다음 화 ── */

/** 형식 검증 — 어긋나면 null */
export function validateEpisode(d: unknown, no: number): Episode | null {
  const x = d as Partial<Episode> | null;
  if (!x || typeof x.title !== 'string' || !hasHangul(x.titleKr) || !hasHangul(x.cliff) || !Array.isArray(x.scenes) || !Array.isArray(x.learn)) return null;
  const scenes: Scene[] = [];
  for (const s of x.scenes as Scene[]) {
    if (!s || typeof s !== 'object') return null;
    if (s.type === 'narr') {
      if (!hasHangul(s.kr)) return null;
    } else if (s.type === 'line' || s.type === 'speak') {
      if (typeof s.who !== 'string' || typeof s.en !== 'string' || !s.en.trim() || !hasHangul(s.kr)) return null;
    } else if (s.type === 'choice') {
      if (!hasHangul(s.prompt) || !Array.isArray(s.opts) || s.opts.length !== 3) return null;
      if (s.opts.filter((o) => o && o.ok === true).length !== 1) return null;
      if (!s.opts.every((o) => typeof o.en === 'string' && (o.ok || hasHangul(o.why)))) return null;
    } else if (s.type === 'meaning') {
      if (typeof s.en !== 'string' || !Array.isArray(s.opts) || s.opts.length !== 3 || !s.opts.every(hasHangul) || !(s.a >= 0 && s.a < 3) || !hasHangul(s.why)) return null;
    } else if (s.type === 'fill') {
      if (typeof s.before !== 'string' || typeof s.after !== 'string' || !Array.isArray(s.opts) || s.opts.length !== 3 || new Set(s.opts).size !== 3 || !(s.a >= 0 && s.a < 3) || !hasHangul(s.kr) || !hasHangul(s.why)) return null;
    } else return null;
    scenes.push(s);
  }
  const inter = scenes.filter((s) => INTERACTIVE.has(s.type));
  const kinds = new Set(inter.map((s) => s.type));
  // 몰입 우선: 장면 10~22개, 상호작용 2~4개, 형식 최소 2종
  if (scenes.length < 10 || scenes.length > 22 || inter.length < 2 || inter.length > 4 || kinds.size < 2) return null;
  const learn = (x.learn as Episode['learn']).filter((l) => l && typeof l.en === 'string' && hasHangul(l.kr)).slice(0, 2);
  if (learn.length < 1) return null;
  return { no, level: String(x.level || 'A2'), title: x.title, titleKr: String(x.titleKr), recap: String(x.recap || ''), scenes, learn, cliff: String(x.cliff), ai: true };
}

const LEVEL_GUIDE: Record<string, string> = {
  A1: '아주 짧은 문장(3~6단어), 현재 시제 위주, 기초 어휘만',
  A2: '짧은 문장(4~9단어), 현재·과거·미래 기본, 일상·직장 기초 어휘',
  B1: '보통 문장(6~12단어), 현재완료·조건문 가능, 업무 어휘 조금',
  B2: '자연스러운 원어민 대화, 관용 표현·완곡어법 포함',
  C1: '빠르고 자연스러운 원어민 대화, 뉘앙스·유머·관용 표현',
  C2: '빠르고 자연스러운 원어민 대화, 뉘앙스·유머·관용 표현',
};

/** 다음 화를 만든다 — 앞 이야기(최근 4화 요약 + 직전 클리프행어)를 기억하며 */
export async function generateEpisode(no: number, level: Cefr): Promise<Episode | null> {
  if (!groqKey()) return null;
  const prev = allEpisodes().filter((e) => e.no < no).slice(-4);
  const last = prev[prev.length - 1];
  const story = prev.map((e) => `${e.no}화 「${e.titleKr}」: ${e.recap || ''} → 끝: ${e.cliff}`).join('\n');
  const cast = CAST.map((c) => `${c.id}(${c.name}): ${c.desc}`).join('\n');
  const sys = `너는 한국인 영어 학습자를 위한 웹드라마 작가다. 시리즈: "${SERIES}"(${SERIES_KR}). 시트콤처럼 웃기고, 매 화 작은 사건과 반전이 있다.
등장인물(id: 설명):
${cast}
(필요하면 새 조연 1명 추가 가능 — who에 영어 소문자 id)
지금까지 이야기:
${story}
이번 ${no}화는 직전 화의 끝("${last?.cliff || ''}")에서 바로 이어진다. 회사 일만이 아니라 동료 관계·일상·유머를 섞어라.
영어 난이도: ${level} — ${LEVEL_GUIDE[level] || LEVEL_GUIDE.A2}.
구성 규칙:
- scenes 12~18개. type: "narr"(한국어 해설 kr), "line"(who,en,kr), 그리고 학습자 참여 3개(서로 다른 형식 2종 이상):
  "choice"(prompt 한국어, opts 3개 {en, ok, why(오답만, 한국어), reply(정답만: {who,en,kr} 상대의 반응)}, 정답 정확히 1개)
  "meaning"(who, en, opts 한국어 뜻 3개, a 정답 인덱스, why 한국어)
  "fill"(who, before, after, opts 영어 3개, a, kr 전체 번역, why 한국어)
  "speak"(who:"taeo", en, kr — 태오가 소리 내어 말할 한 문장)
- 참여 문항은 이야기 흐름 속 태오의 대사여야 한다(시험 문제처럼 떼어 내지 말 것).
- learn: 이번 화 핵심 표현 2개 {en, kr, note(언제 쓰는지 한국어 짧게)}.
- recap: 직전 화까지 한 줄 요약(한국어). cliff: 다음 화가 궁금해지는 한 줄(한국어).
JSON만: {"level":"${level}","title":"영어 제목","titleKr":"한국어 제목","recap":"","scenes":[...],"learn":[...],"cliff":""}`;
  const ep = await groqKoJson<Episode>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `${no}화를 써 줘.` },
    ],
    { temperature: 0.9, maxTokens: 2000 },
    (d) => validateEpisode(d, no)
  );
  if (!ep) return null;
  const gen = generatedEpisodes().filter((e) => e.no !== no);
  store(EPS_KEY, [...gen, ep].sort((a, b) => a.no - b.no).slice(-40));
  return ep;
}
