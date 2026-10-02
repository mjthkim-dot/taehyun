/**
 * 드라마 레슨 — "한 번에 할 게 너무 많고, 문제 형식이 반복되고, 재미·몰입이 없다"에 대한 답.
 *
 * 하루 한 편, 5분. 같은 등장인물(태오·Maya·Jun·Diane·Mr. Grant)이 나오는 연속극을 따라가며
 * 표현을 배운다. 문제는 이야기 **속에** 2~4번만 끼어들고 형식이 섞인다
 * (답하기·뜻 알아듣기·빈칸·따라 말하기). 매 화는 다음이 궁금한 장면에서 끝난다.
 * 1~3화는 사람이 쓴 원고(data/dramaSeed.json), 4화부터 AI가 앞 이야기를 기억하며 이어 쓴다.
 */
import seed from '../data/dramaSeed.json';
import { load, store, groqKey, addWeakItem, gradeWeakItem, SRS_LEECH_THRESHOLD, type FlashGrade } from './state';
import { overall, recordSkillResult } from './cefrGrowth';
import { CEFR_ORDER as CEFR_LEVELS } from './cefr';
import { shiftKey, todayKey } from './dates';
import { markDramaPracticeToday, migrateDramaOnce } from './homeLite';
import { groqKoJson, hasHangul } from './aiGuard';
import { GROQ_MODEL } from './groq';
import { acceptByProfile, validateProfile, wordRangeFor } from './validateProfile';
import { mineLines } from './dramaSeedMine';
import { buildupStages } from './roleStep';
import type { Cefr } from './cefr';

// 채점 래퍼는 lib/align.ts(원고 import 0)에 있다 — 여기서는 re-export만(단어 탭 청크에 원고가 딸려 오지 않게)
export { alignedScore, type AlignedScore, type AlignedWord } from './align';

export interface CastMember {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export type Scene =
  | { type: 'narr'; kr: string }
  | { type: 'line'; who: string; en: string; kr: string }
  | { type: 'choice'; prompt: string; opts: { en: string; ok: boolean; kr?: string; why?: string; reply?: { who: string; en: string; kr: string } }[]; level?: string }
  | { type: 'meaning'; who: string; en: string; opts: string[]; a: number; why: string; level?: string }
  | { type: 'fill'; who: string; before: string; after: string; opts: string[]; a: number; kr: string; why: string; level?: string }
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
  /** 리텔 키워드 4개(한국어, M5) — AI 화의 소프트 필드. 시드 화는 lib/dramaSeedMine.KEYWORDS */
  keywords?: string[];
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

/**
 * 화면 문구용 한국어 인물 이름 — 원고(dramaSeed.json)의 cast.name은 영어 표기(Taeo)라
 * '태오 ▶'·'태오의 목소리' 같은 한국어 UI 문구에 그대로 쓰면 'Taeo ▶'가 된다. 원고에 없는 인물은 영어 이름 그대로.
 */
const CAST_KO: Record<string, string> = { taeo: '태오', maya: '마야', jun: '준', diane: '다이앤', grant: '그랜트 씨' };
export function castNameKo(who: string): string {
  return CAST_KO[who] || castOf(who).name;
}

/** 이름 뒤 '와/과' — 받침이 있으면 '과'(준과), 없으면 '와'(태오와). 한글이 아니면 '와' */
export function withWa(name: string): string {
  const c = name.charCodeAt(name.length - 1);
  const hangul = c >= 0xac00 && c <= 0xd7a3;
  return `${name}${hangul && (c - 0xac00) % 28 ? '과' : '와'}`;
}

export const INTERACTIVE = new Set(['choice', 'meaning', 'fill', 'speak']);

/**
 * 인물별 목소리(Groq Orpheus: austin·daniel·troy 남성, hannah·diana 여성). 어떤 목소리를 Groq가 거부하면
 * TTS 라우트가 같은 성별의 다른 목소리(→ 기본 목소리)로 바꿔 부르고, 그것도 안 되면 그 줄만 브라우저 음성.
 * 키가 없으면 브라우저 음성 안에서 성별·음높이로 인물을 구분한다.
 */
const VOICE: Record<string, string> = { taeo: 'austin', jun: 'daniel', grant: 'troy', maya: 'hannah', diane: 'diana' };
export const voiceOf = (who?: string) => VOICE[who || 'taeo'] || 'austin';

/* ── 저장 ── */

const EPS_KEY = 'va_drama_eps';
const PROG_KEY = 'va_drama';

interface DramaProgress {
  /** 화 번호 → 본 날짜 */
  done: Record<string, string>;
  /** 화 번호 → 점수(0~100) */
  score: Record<string, number>;
  /** 처음 본 순서대로의 점수(최근 10개) — 난이도 조절 근거 */
  hist: number[];
  /** 난이도 보정 -1(한 단계 쉽게) · 0 · +1(한 단계 어렵게) */
  adj: number;
  /** 화 번호 → 역할극 집계(M2, 마지막 시청분) */
  speak: Record<string, SpeakStats>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// v1.29 → v1.30 이전(AI 4~7화 → 원고)은 홈 경량 모듈에 있다 — 홈 카드도 이전된 기록을 보게
function prog(): DramaProgress {
  migrateDramaOnce();
  const p = load<Partial<DramaProgress>>(PROG_KEY, {});
  // 손상된 값(다른 버전·수동 편집)이어도 화면이 죽지 않게 모양을 맞춘다
  const done = isObj(p.done) ? (p.done as Record<string, string>) : {};
  const score = isObj(p.score) ? (p.score as Record<string, number>) : {};
  const hist = Array.isArray(p.hist) ? p.hist.filter((n) => typeof n === 'number') : [];
  const adj = p.adj === -1 || p.adj === 1 ? p.adj : 0;
  const speak = isObj(p.speak) ? (p.speak as Record<string, SpeakStats>) : {};
  return { done, score, hist, adj, speak };
}

function isEpisodeLike(e: unknown): e is Episode {
  const x = e as Partial<Episode> | null;
  return !!x && typeof x.no === 'number' && Array.isArray(x.scenes) && Array.isArray(x.learn) && typeof x.titleKr === 'string';
}

/* 생성 원고는 최대 40화(~90KB) — 호출마다 파싱·정렬하지 않게 저장 원문이 같으면 결과를 재사용한다(성능 #8) */
let epsRaw: string | null = null;
let epsCache: Episode[] = [];
let allCache: { src: Episode[]; out: Episode[] } | null = null;

export function generatedEpisodes(): Episode[] {
  migrateDramaOnce();
  let raw = '';
  try {
    raw = localStorage.getItem(EPS_KEY) || '';
  } catch {
    raw = '';
  }
  if (raw !== epsRaw) {
    epsRaw = raw;
    epsCache = load<Episode[]>(EPS_KEY, []).filter(isEpisodeLike);
  }
  return epsCache;
}

export function allEpisodes(): Episode[] {
  const gen = generatedEpisodes();
  if (allCache && allCache.src === gen) return allCache.out;
  const out = [...S.episodes, ...gen.filter((e) => e.no > S.episodes.length)].sort((a, b) => a.no - b.no);
  allCache = { src: gen, out };
  return out;
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

// 오늘의 추천(dramaPlan)은 홈 카드가 원고 없이 계산할 수 있게 홈 경량 모듈에 있다
export { dramaPlan, DRAMA_NOTICE_KEY, type DramaPlan } from './homeLite';

/** 다음에 볼 화 번호(아직 안 본 가장 앞 화) */
export function nextEpisodeNo(): number {
  const w = new Set(watched());
  let n = 1;
  while (w.has(n)) n++;
  return n;
}

/** 틀린 장면 — 정답 영어 문장과 그 뜻(또는 상황) */
export interface MissedItem {
  en: string;
  kr: string;
}

/**
 * 난이도 보정 기준 — 최근 두 화 평균이 이 이상이면 한 단계 어렵게(i+1 — 다음 레벨 증거가 쌓이게),
 * 이하면 한 단계 쉽게. 85였을 땐 거의 오르지 않아 드라마만 하는 사용자의 레벨이 멈춰 있었다.
 */
export const LEVEL_UP_AVG = 70;
export const LEVEL_DOWN_AVG = 50;

/**
 * 에피소드 완료 — 기록, 학습일, 오늘의 표현과 **틀린 문장**을 복습 카드로.
 * 처음 본 화의 점수로 다음 화 난이도를 조절한다(-1: 쉽게, +1: 어렵게, 0: 그대로).
 */
/** 문항 레벨별 성적 — 원고의 윗단계(예: B1) 문항으로 다음 레벨 듣기 증거를 따로 쌓는다 */
export type LevelStats = Record<string, { asked: number; ok: number }>;

/** 역할극 집계(M2) — 화를 마칠 때 lib/roleStep.speakStatsFrom으로 만들어 넘긴다 */
export interface SpeakStats {
  spoken: number;
  passed: number;
  lapsesTop: { key: string; count: number }[];
  disputed: number;
  skipped: number;
}

/** 화 번호 → 마지막으로 본 때의 역할극 집계(없으면 null) — 진도·엔딩 카드가 읽는다 */
export function episodeSpeakStats(no: number): SpeakStats | null {
  const v = prog().speak[String(no)];
  return v && typeof v.spoken === 'number' ? v : null;
}

export function completeEpisode(ep: Episode, score: number, asked = 0, missed: MissedItem[] = [], byLevel: LevelStats = {}, speakStats?: SpeakStats): { levelChange: -1 | 0 | 1 } {
  const p = prog();
  const first = !p.done[String(ep.no)];
  // 역할극 집계는 마지막 시청분만(용량 — 화당 한 줄)
  if (speakStats) p.speak[String(ep.no)] = { spoken: speakStats.spoken, passed: speakStats.passed, lapsesTop: speakStats.lapsesTop.slice(0, 3), disputed: speakStats.disputed, skipped: speakStats.skipped };
  // 다시 본 화는 처음 본 날짜를 유지한다(예전엔 덮어써서 '오늘 완료'로 잘못 표시됐다)
  if (first) p.done[String(ep.no)] = todayKey();
  p.score[String(ep.no)] = Math.max(p.score[String(ep.no)] ?? 0, Math.round(score));
  let levelChange: -1 | 0 | 1 = 0;
  if (first && asked >= 2) {
    p.hist = [...p.hist, Math.round(score)].slice(-10);
    const last2 = p.hist.slice(-2);
    if (last2.length === 2) {
      const avg = (last2[0] + last2[1]) / 2;
      const before = p.adj;
      if (avg >= LEVEL_UP_AVG) p.adj = Math.min(p.adj + 1, 1);
      else if (avg <= LEVEL_DOWN_AVG) p.adj = Math.max(p.adj - 1, -1);
      levelChange = (p.adj - before) as -1 | 0 | 1;
      // 한 번 조절했으면 다음 판단은 새 두 화로(같은 점수로 연달아 두 단계 움직이지 않게)
      if (levelChange) p.hist = [];
    }
  }
  store(PROG_KEY, p);
  markDramaPracticeToday(); // 학습일 기록 + 다시 본 화도 오늘의 연습(불꽃·퀘스트)
  // 첫 복습은 내일 — 오늘 배운 걸 오늘 또 묻지 않는다(간격 반복)
  for (const l of ep.learn) addWeakItem({ en: l.en, kr: l.kr, cat: '드라마', lesson: `drama:${ep.no}` }, 1);
  // 틀린 장면의 정답 문장도 복습 카드로 — 다음 화 첫머리 '지난 화 기억나요?'에 나온다
  for (const m of missed) if (str(m.en) && str(m.kr)) addWeakItem({ en: m.en, kr: m.kr, cat: '드라마', lesson: `drama:${ep.no}` }, 1);
  // 윗단계 문항(원고 4~7화의 B1 문항) — 그 문항 성적을 그 레벨의 듣기 증거로 따로 기록(처음 볼 때만).
  // 드라마만 하는 A2 사용자도 B1 증거가 쌓여 '다음 레벨까지 0%'에 머물지 않게(감사 v1.31 비평 #5)
  if (first) {
    for (const [lv, st] of Object.entries(byLevel)) {
      if (lv === ep.level || st.asked < 1 || !CEFR_LEVELS.includes(lv as Cefr)) continue;
      try {
        recordSkillResult('listening', lv as Cefr, Math.round((st.ok / st.asked) * 100), 'listening');
      } catch {
        /* 무시 */
      }
    }
  }
  // 대사를 알아듣고 고른 결과 = 그 레벨의 듣기 증거(처음 볼 때만, 문항 2개 이상일 때)
  if (first && asked >= 2) {
    try {
      recordSkillResult('listening', (CEFR_LEVELS.includes(ep.level as Cefr) ? ep.level : 'A2') as Cefr, score, 'listening');
    } catch {
      /* 증거 기록 실패는 시청 완료를 막지 않는다 */
    }
  }
  return { levelChange };
}

const LEVELS = CEFR_LEVELS as readonly Cefr[];

/** 드라마 난이도 — 지금 레벨에서 최근 이해도로 한 단계 오르내린다(A1~C2 안에서) */
export function dramaLevel(base?: Cefr): Cefr {
  let b: Cefr = 'A2';
  try {
    b = base || overall().level;
  } catch {
    /* 증거 기록 손상 — 기본 A2 */
  }
  const k = Math.max(0, LEVELS.indexOf(b));
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, k + prog().adj))];
}

/** 지금 난이도 보정 상태(엔딩 안내용) */
export function dramaAdjust(): number {
  return prog().adj;
}

/* ── 이야기 속 복습 — "지난 화 기억나요?" ──
 * 드라마 표현은 복습 카드(va_weak, cat '드라마')에 들어간다. 집중 모드엔 따로 복습 화면이
 * 없으므로, 다음 화 첫머리에 기한이 된 표현을 1~2개 떠올리게 한다(간격 반복 그대로:
 * 맞히면 간격이 늘고 틀리면 내일 다시). 기한이 된 게 없으면 직전 화 표현 하나.
 */
export interface RecallItem {
  en: string;
  kr: string;
  /** 보기(고르기 모드) — speak 모드에서도 채워 둔다(두 번째 실패 뒤 힌트·키 없는 기기의 고르기). 옛 저장본은 비어 있을 수 있다 */
  opts: string[];
  a: number;
  /** 회상 방식 — 없으면 'choice'(기존 저장본과 호환). M3: speak = 한국어만 보고 말로 떠올리기 */
  mode?: 'speak' | 'choice';
  /** 정답을 들려줄 인물(그 표현을 말한 인물 — 못 찾으면 태오) */
  who?: string;
  /** 지금 상자(0이면 처음 보는 카드 — 항상 고르기) */
  box?: number;
  /** 거머리 카드(4번 이상 잊음) — 끝부터 쌓기 + 최소대립쌍 1쌍(M3) */
  leech?: boolean;
}

const lessonNo = (lesson: unknown): number => {
  const m = typeof lesson === 'string' ? /^drama:(\d+)$/.exec(lesson) : null;
  return m ? Number(m[1]) : 0;
};

/** 문장 비교용 — 대소문자·문장부호 무시 */
export const normEn = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** 복습 보기 채우개 — 시리즈에 안 나오는 흔한 문장(아직 안 본 화의 표현을 보기로 쓰지 않기 위해) */
const FILLER = ['See you later.', "I'm on my way.", 'No problem at all.', 'That sounds great.', 'Nice to meet you.', 'Thanks for waiting.'];

/** 한쪽이 다른 쪽을 품거나 단어가 60% 이상 겹치면 사실상 같은 문장 */
function nearSame(a: string, b: string): boolean {
  const na = normEn(a);
  const nb = normEn(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const wa = na.split(' ');
  const wb = new Set(nb.split(' '));
  const hit = wa.filter((w) => wb.has(w)).length;
  return hit / Math.max(wa.length, wb.size) >= 0.6;
}

type DramaWeak = { en: string; kr: string; cat?: string; due?: number; box?: number; lapses?: number; lesson?: unknown };

function dramaWeak(): DramaWeak[] {
  return load<DramaWeak[]>('va_weak', []).filter((w) => w && w.cat === '드라마' && str(w.en) && str(w.kr));
}

/**
 * 회상 문항. M3: mode 'speak'이면 한국어만 보고 말로 떠올린다 — 단, box 0(처음 묻는 카드)은 늘 'choice'(재인부터).
 * 보기(opts/a)는 모드와 상관없이 채운다: speak의 두 번째 실패 뒤 힌트, 키도 Web Speech도 없는 기기(iOS)의 고르기에 쓴다.
 * mode를 안 주면 예전 그대로(전부 choice, who·box는 붙인다).
 */
export function recallItems(no: number, max = 3, opts: { dueOnly?: boolean; mode?: 'speak' | 'choice' } = {}): RecallItem[] {
  if (no <= 1 && !opts.dueOnly) return [];
  const seen = new Set(watched());
  // 보기 풀은 **본 화**의 표현과 이미 가진 카드만 — 아직 안 본 화의 문장이 섞이면 익숙한 걸 고르기만 해도 맞힌다
  const learnPool = allEpisodes()
    .filter((e) => seen.has(e.no))
    .flatMap((e) => e.learn.map((l) => l.en));
  const now = Date.now();
  const weak = dramaWeak();
  // 기한이 가장 오래 지난 카드부터(같으면 약한 것부터) — 새 카드가 늘 먼저 뽑혀 옛 카드가 밀리던 문제
  let picks: { en: string; kr: string; box: number; lapses: number }[] = weak
    .filter((w) => (w.due == null || w.due <= now) && lessonNo(w.lesson) < no)
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0) || (a.box || 0) - (b.box || 0))
    .map((w) => ({ en: w.en, kr: w.kr, box: w.box || 0, lapses: w.lapses || 0 }));
  if (!picks.length && !opts.dueOnly) {
    const prev = episodeByNo(no - 1);
    if (prev?.learn[0]) {
      const w = weak.find((x) => x.en === prev.learn[0].en);
      picks = [{ en: prev.learn[0].en, kr: prev.learn[0].kr, box: w?.box || 0, lapses: w?.lapses || 0 }];
    }
  }
  const pool = [...new Set([...learnPool, ...weak.map((w) => w.en)])];
  return picks.slice(0, max).map((p, k) => {
    // 정답과 거의 같은 문장(“Yes, it's my first day.” ↔ “It's my first day.”)은 보기로 쓰지 않는다 — 정답이 둘로 보인다
    let others = pool.filter((x) => !nearSame(x, p.en));
    // 초반엔 배운 표현이 두세 개뿐이라 보기가 모자란다 — 흔한 짧은 문장으로 채운다(뜻으로 골라야 한다)
    if (others.length < 2) others = [...others, ...FILLER.filter((f) => !nearSame(f, p.en) && !others.includes(f))];
    const ds: string[] = [];
    for (let j = 0; ds.length < 2 && j < others.length * 2; j++) {
      const c = others[(no * 7 + k * 3 + j * 5) % others.length];
      if (!ds.includes(c)) ds.push(c);
    }
    const opts2 = [p.en, ...ds];
    // 결정적 섞기
    const order = opts2.map((_, x) => x).sort((x, y) => ((x * 13 + no + k) % opts2.length) - ((y * 13 + no + k) % opts2.length));
    const item: RecallItem = { en: p.en, kr: p.kr, opts: order.map((o) => opts2[o]), a: order.indexOf(0), who: whoOf(p.en), box: p.box };
    if (p.lapses >= SRS_LEECH_THRESHOLD) item.leech = true;
    if (opts.mode) item.mode = opts.mode === 'speak' && p.box > 0 ? 'speak' : 'choice';
    return item;
  });
}

/** 표현 복습 세션 — 새 화가 없는 날(키 없음·오늘 이미 봄)에도 매일 복습할 수 있게. M3: mode 'speak'이면 말로 떠올리기 */
export function reviewItems(max = 8, o: { mode?: 'speak' | 'choice' } = {}): RecallItem[] {
  return recallItems(100000, max, { dueOnly: true, mode: o.mode });
}

/** 이 표현을 말한 인물 — 원고 대사·문항 정답에서 찾는다(못 찾으면 태오). 정답 재생 목소리(voiceOf)용 */
export function whoOf(en: string): string {
  const n = normEn(en);
  if (!n) return 'taeo';
  for (const e of allEpisodes()) {
    for (const s of e.scenes) {
      if ((s.type === 'line' || s.type === 'speak' || s.type === 'meaning' || s.type === 'fill') && ` ${normEn(s.type === 'fill' ? fillFull(s) : s.en)} `.includes(` ${n} `)) return s.who;
      if (s.type === 'choice') {
        const r = s.opts.find((o) => o.ok);
        if (r && ` ${normEn(r.en)} `.includes(` ${n} `)) return 'taeo';
        if (r?.reply && ` ${normEn(r.reply.en)} `.includes(` ${n} `)) return r.reply.who;
      }
    }
  }
  return 'taeo';
}

/** 회상 통과 기준 — 역할극과 같은 60점 */
export const RECALL_PASS = 60;

/**
 * 이 기기에서 회상을 어떻게 묻나 — speak 문항이라도 키도 Web Speech도 없으면(path 'self', iOS PWA) 채점할 수 없어
 * 고르기 + 녹음 A/B. box 0·플래그 off(mode 없음/choice)는 늘 고르기.
 */
export function recallUiMode(mode: RecallItem['mode'], path: 'whisper' | 'webspeech' | 'self'): 'speak' | 'choice' {
  return mode === 'speak' && path !== 'self' ? 'speak' : 'choice';
}

/**
 * 말로 떠올리기 n번째 시도(1부터)의 점수 → 다음 단계.
 *  good: 통과(≥60) · retry: 첫 실패 — 정답을 보여 주지 않고 한 번 더 · hint: 두 번째 실패 — 그때만 보기 3개(맞혀도 hard)
 */
export function recallNext(tries: number, score: number): 'good' | 'retry' | 'hint' {
  if (score >= RECALL_PASS) return 'good';
  return tries <= 1 ? 'retry' : 'hint';
}

/**
 * 거머리 카드의 따라 말하기 구간 — 끝부터 쌓기(lib/roleStep.buildupStages 재사용).
 * 회상 문장은 짧아(4~8단어) 역할극 기준(10단어)으로는 안 나뉜다 — 6단어 이상이면 [끝 4단어, 전체].
 */
export function recallStages(en: string, leech = false): string[] {
  if (!leech) return [en.trim()];
  const st = buildupStages(en, 6);
  return st.filter((x, k) => st.indexOf(x) === k);
}

/**
 * 이야기 속에서 다시 나온 표현 채점 — 참여 문항의 정답 문장에 기한이 된 지난 표현이
 * 들어 있으면, 그 문항을 맞힌 것 = 간격 반복 복습 한 번(틀리면 내일 다시).
 */
export function gradeRecycled(correctEn: string, good: boolean, epNo: number): string[] {
  const hay = ` ${normEn(correctEn)} `;
  const now = Date.now();
  const hits = dramaWeak().filter((w) => {
    const n = normEn(w.en);
    return n.length >= 3 && lessonNo(w.lesson) < epNo && (w.due == null || w.due <= now || !good) && hay.includes(` ${n} `);
  });
  for (const w of hits) gradeWeakItem(w.en, good ? 'good' : 'again');
  return hits.map((w) => w.en);
}

/** AI 작가에게 다시 쓰게 할 지난 표현(기한 된 것·아직 약한 것 우선, 최대 3개) */
export function recycleCandidates(no: number, max = 3): { en: string; kr: string }[] {
  const now = Date.now();
  return dramaWeak()
    .filter((w) => lessonNo(w.lesson) < no && ((w.due ?? 0) <= now || (w.box || 0) <= 2))
    .sort((a, b) => (a.box || 0) - (b.box || 0))
    .slice(0, max)
    .map((w) => ({ en: w.en, kr: w.kr }));
}

/**
 * 회상 채점 → 간격 반복. 옛 호출(gradeRecall(en, true/false))은 그대로 good/again.
 * M3: 점수(0~100)를 주면 ≥60 good, <60 again. hinted(두 번째 실패 뒤 보기 3개를 본 경우)는 맞혀도 hard.
 * 매긴 등급을 돌려준다.
 */
export function gradeRecall(en: string, score: boolean | number, o: { hinted?: boolean } = {}): FlashGrade {
  const ok = typeof score === 'boolean' ? score : score >= RECALL_PASS;
  const grade: FlashGrade = !ok ? 'again' : o.hinted ? 'hard' : 'good';
  gradeWeakItem(en, grade);
  return grade;
}

/* ── 말로 떠올리기 일별 기록(va_recall_speak, 60일) — 회상 1차 통과율·개시 지연 중앙값 지표 ── */
const RECALL_SPEAK_KEY = 'va_recall_speak';
export interface RecallSpeakDay {
  asked: number;
  passed: number;
  /** 개시 지연 중앙값(ms) — 잰 시도가 없으면 null */
  latencyMed: number | null;
  /** 중앙값 계산용 표본(최근 30개) */
  lat?: number[];
}

/** 한 문항 결과(1차 시도 기준) — passed: 첫 시도에 60점 이상 */
export function recordRecallSpeak(passed: boolean, latencyMs?: number, day: string = todayKey()): RecallSpeakDay {
  const all = load<Record<string, RecallSpeakDay>>(RECALL_SPEAK_KEY, {});
  const cur = all[day] && typeof all[day] === 'object' ? all[day] : { asked: 0, passed: 0, latencyMed: null };
  const lat = Array.isArray(cur.lat) ? cur.lat.filter((n) => typeof n === 'number') : [];
  if (typeof latencyMs === 'number' && Number.isFinite(latencyMs) && latencyMs >= 0) lat.push(Math.round(latencyMs));
  const sorted = [...lat.slice(-30)].sort((a, b) => a - b);
  const med = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)) : null;
  const next: RecallSpeakDay = { asked: (Number(cur.asked) || 0) + 1, passed: (Number(cur.passed) || 0) + (passed ? 1 : 0), latencyMed: med, lat: lat.slice(-30) };
  all[day] = next;
  // 60일만 보관
  const from = shiftKey(todayKey(), -59);
  for (const k of Object.keys(all)) if (k < from) delete all[k];
  store(RECALL_SPEAK_KEY, all);
  return next;
}

export function recallSpeakLog(): Record<string, RecallSpeakDay> {
  return load<Record<string, RecallSpeakDay>>(RECALL_SPEAK_KEY, {});
}

export { DRAMA_AUTOPLAY_KEY, requestDramaAutoplay } from './homeLite';

/* ── 이어 보기 — 통화·알림으로 잠깐 나가도 처음부터 다시 보지 않게(감사 v1.31 모바일 #1) ── */
const RESUME_KEY = 'va_drama_resume';
const RESUME_TTL = 24 * 3600 * 1000;
/** 저장본 판 — 모양이 바뀔 때 올린다. 판이 다르면 이어 보기를 버린다(옛 모양을 억지로 읽다 깨지지 않게) */
export const RESUME_VERSION = 2;

export interface ResumeState {
  v: typeof RESUME_VERSION;
  no: number;
  /** 다음에 보여 줄 장면 번호(플레이어 장면 기준 — 첫머리 복습 포함) */
  i: number;
  ok: number;
  asked: number;
  log: unknown[];
  missed: MissedItem[];
  /** 틀린 장면 — 원고 장면 번호 */
  retryIdx: number[];
  /** 첫머리 복습 문항(이어 볼 때 장면 번호가 어긋나지 않게 그대로 보관) */
  rc: RecallItem[];
  at: number;
}

/** 기록 한 줄의 모양 — 하나라도 어긋나면 이어 보기를 버린다(같은 크래시 반복 방지, 감사 v1.31 비평 #7) */
function okLogItem(x: unknown): boolean {
  const it = x as { kind?: string; kr?: unknown; who?: unknown; en?: unknown; text?: unknown; ok?: unknown } | null;
  if (!it || typeof it !== 'object') return false;
  if (it.kind === 'narr') return typeof it.kr === 'string';
  if (it.kind === 'line') return str(it.who) && typeof it.en === 'string' && typeof it.kr === 'string';
  if (it.kind === 'note') return typeof it.text === 'string' && typeof it.ok === 'boolean';
  return false;
}

/** 회상 문항 모양 — mode 'speak'은 보기(opts/a)가 없어도 된다(M1: 산출형 회상이 저장돼도 이어 보기가 살아남게) */
function okRecall(x: unknown): x is RecallItem {
  const r = x as Partial<RecallItem> | null;
  if (!r || !str(r.en) || typeof r.kr !== 'string') return false;
  if (r.mode !== undefined && r.mode !== 'speak' && r.mode !== 'choice') return false;
  const optsOk = Array.isArray(r.opts) && r.opts.every((o) => typeof o === 'string');
  if (r.mode === 'speak') return r.opts === undefined || optsOk;
  return optsOk && Number.isInteger(r.a) && (r.a as number) >= 0 && (r.a as number) < (r.opts as string[]).length;
}

/** speak 모드 문항은 보기가 비어 있을 수 있다 — 타입(opts/a 필수)에 맞춰 채운다 */
function normRecall(r: RecallItem): RecallItem {
  return r.mode === 'speak' ? { ...r, opts: Array.isArray(r.opts) ? r.opts : [], a: Number.isInteger(r.a) ? r.a : 0 } : r;
}

export function loadResume(no: number): ResumeState | null {
  const r = load<Partial<ResumeState> | null>(RESUME_KEY, null);
  if (!r || r.v !== RESUME_VERSION) return null;
  if (r.no !== no || typeof r.i !== 'number' || r.i <= 0 || !Array.isArray(r.log) || !Array.isArray(r.rc)) return null;
  if (typeof r.at !== 'number' || Date.now() - r.at > RESUME_TTL) return null;
  if (!r.log.every(okLogItem) || !r.rc.every(okRecall)) {
    clearResume();
    return null;
  }
  return {
    v: RESUME_VERSION,
    no,
    i: r.i,
    ok: Number(r.ok) || 0,
    asked: Number(r.asked) || 0,
    log: r.log,
    missed: Array.isArray(r.missed) ? r.missed.filter((m) => m && str(m.en) && str(m.kr)) : [],
    retryIdx: Array.isArray(r.retryIdx) ? r.retryIdx.filter((n) => Number.isInteger(n)) : [],
    rc: r.rc.map(normRecall),
    at: r.at,
  };
}

/** 판(v)과 시각(at)은 여기서 붙인다 — 호출부는 진행 상태만 넘긴다 */
export function saveResume(r: Omit<ResumeState, 'at' | 'v'> & { v?: typeof RESUME_VERSION }) {
  store(RESUME_KEY, { ...r, v: RESUME_VERSION, at: Date.now() });
}

export function clearResume() {
  store(RESUME_KEY, null);
}

/* ── AI 다음 화 ── */

const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** 형식 검증 — 어긋나면 null */
/** 빈칸 장면의 완성 문장 — 문장부호 앞 공백 없이 */
export function fillFull(s: { before: string; after: string; opts: string[]; a: number }): string {
  return `${s.before} ${s.opts[s.a]} ${s.after}`.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}

/** 장면에 실제로 나오는 영어 문장들(정답 기준) — 표현 재등장·learn 검사용 */
function sceneTexts(s: Scene): string[] {
  if (s.type === 'line' || s.type === 'speak' || s.type === 'meaning') return [s.en];
  if (s.type === 'fill') return [fillFull(s)];
  if (s.type === 'choice') {
    const r = s.opts.find((o) => o.ok);
    return r ? [r.en, ...(r.reply ? [r.reply.en] : [])] : [];
  }
  return [];
}

/**
 * 참여 문항의 정답 문장(뜻·빈칸·고르기) + **태오 대사(line·speak)** — M2부터 태오 대사는 전부 역할극이라
 * '내가 말해야 하는 문장'이고, 60점 통과가 곧 문항 정답(gradeRecycled·asked/ok 합산)이다.
 * shadow=true면 지정 상대 대사(섀도잉 줄)도 포함한다 — 호출부가 mineLines로 가려서 넘긴다.
 */
export function answerTexts(s: Scene, shadow = false): string[] {
  if (s.type === 'meaning') return [s.en];
  if (s.type === 'fill') return [fillFull(s)];
  if (s.type === 'choice') return s.opts.filter((o) => o.ok).map((o) => o.en);
  if (s.type === 'speak') return [s.en];
  if (s.type === 'line') return s.who === 'taeo' || shadow ? [s.en] : [];
  return [];
}

/** 역할극 대상 한 줄 — role: 태오 대사(내가 태오), mine: 지정 상대 대사(키 없음 섀도잉 기본·키 있음 길게 누르기) */
export interface RoleTarget {
  /** 원고 장면 번호(ep.scenes 기준) */
  idx: number;
  who: string;
  en: string;
  kr: string;
  kind: 'role' | 'mine';
  /** 상대 대사가 뜻·빈칸 문항이면 그 퀴즈가 끝난 직후 역할극을 붙인다(퀴즈는 유지) */
  afterQuiz: boolean;
}

/**
 * 이 화의 역할극 대상 전부 — 태오 line/speak 장면 + lib/dramaSeedMine 지정 상대 대사.
 * 플레이어(DramaScreen)가 장면 번호로 찾아 RoleStep을 렌더한다. 원고 JSON은 손대지 않는다.
 */
export function roleTargets(ep: Episode): RoleTarget[] {
  const out: RoleTarget[] = [];
  ep.scenes.forEach((s, idx) => {
    if ((s.type === 'line' || s.type === 'speak') && s.who === 'taeo') out.push({ idx, who: 'taeo', en: s.en, kr: s.kr, kind: 'role', afterQuiz: false });
  });
  for (const m of mineLines(ep.no)) {
    if (out.some((t) => t.idx === m.idx)) continue;
    const sc = ep.scenes[m.idx];
    out.push({ idx: m.idx, who: m.who, en: m.en, kr: m.kr, kind: 'mine', afterQuiz: !!sc && sc.type !== 'line' });
  }
  return out.sort((a, b) => a.idx - b.idx);
}

/** 역할극으로 '물어본' 문장 수 — 이해도 분모 계산용(태오 line/speak + 지정 상대 대사) */
export function roleAnswerCount(ep: Episode): number {
  return roleTargets(ep).length;
}

const contains = (hay: string, needle: string) => ` ${normEn(hay)} `.includes(` ${normEn(needle)} `);

/**
 * 형식 검증 — 어긋나면 null.
 * want: 요청한 레벨(대사 길이 검사), recycle: 이번 화에 다시 나와야 할 지난 표현(참여 문항 정답 중 하나에)
 */
export function validateEpisode(d: unknown, no: number, want?: string, recycle: string[] = []): Episode | null {
  const x = d as Partial<Episode> | null;
  if (!x || typeof x.title !== 'string' || !hasHangul(x.titleKr) || !hasHangul(x.cliff) || !Array.isArray(x.scenes) || !Array.isArray(x.learn)) return null;
  const scenes: Scene[] = [];
  for (const s of x.scenes as Scene[]) {
    if (!s || typeof s !== 'object') return null;
    if (s.type === 'narr') {
      if (!hasHangul(s.kr)) return null;
    } else if (s.type === 'line' || s.type === 'speak') {
      if (!str(s.who) || !str(s.en) || !hasHangul(s.kr)) return null;
    } else if (s.type === 'choice') {
      if (!hasHangul(s.prompt) || !Array.isArray(s.opts) || s.opts.length !== 3) return null;
      if (!s.opts.every((o) => o && typeof o === 'object' && str(o.en) && typeof o.ok === 'boolean')) return null;
      if (new Set(s.opts.map((o) => o.en)).size !== 3) return null;
      if (s.opts.filter((o) => o.ok === true).length !== 1) return null;
      if (!s.opts.every((o) => o.ok || hasHangul(o.why))) return null;
      // 고른 대사에도 자막이 붙도록 정답 보기엔 한국어 뜻이 있어야 한다
      if (!hasHangul(s.opts.find((o) => o.ok)?.kr)) return null;
      const r = s.opts.find((o) => o.ok)?.reply;
      if (r !== undefined && (!r || !str(r.who) || !str(r.en) || !hasHangul(r.kr))) return null;
    } else if (s.type === 'meaning') {
      if (!str(s.who) || !str(s.en) || !Array.isArray(s.opts) || s.opts.length !== 3 || !s.opts.every((o) => typeof o === 'string' && hasHangul(o)) || new Set(s.opts).size !== 3 || !Number.isInteger(s.a) || s.a < 0 || s.a > 2 || !hasHangul(s.why)) return null;
    } else if (s.type === 'fill') {
      if (!str(s.who) || typeof s.before !== 'string' || typeof s.after !== 'string' || !Array.isArray(s.opts) || s.opts.length !== 3 || !s.opts.every(str) || new Set(s.opts).size !== 3 || !Number.isInteger(s.a) || s.a < 0 || s.a > 2 || !hasHangul(s.kr) || !hasHangul(s.why)) return null;
    } else return null;
    scenes.push(s);
  }
  for (let k = 1; k < scenes.length; k++) {
    const cur = scenes[k];
    const prev = scenes[k - 1];
    if (cur.type === 'meaning' && prev.type === 'line' && prev.en.includes(cur.en)) return null;
  }
  const inter = scenes.filter((s) => INTERACTIVE.has(s.type));
  const kinds = new Set(inter.map((s) => s.type));
  // 몰입 우선: 장면 10~22개, 상호작용 2~4개, 형식 최소 2종
  if (scenes.length < 10 || scenes.length > 22 || inter.length < 2 || inter.length > 4 || kinds.size < 2) return null;
  const learn = (x.learn as Episode['learn']).filter((l) => l && str(l.en) && hasHangul(l.kr)).map((l) => ({ en: l.en, kr: l.kr, note: typeof l.note === 'string' ? l.note : '' })).slice(0, 2);
  if (learn.length < 1) return null;
  // 오늘의 표현은 이야기 속에 실제로 나와야 한다(엔딩에만 있는 표현은 배운 게 아니다)
  const texts = scenes.flatMap(sceneTexts);
  if (!learn.every((l) => texts.some((t) => contains(t, l.en)))) return null;
  // 지난 표현 재등장 — 참여 문항 정답 중 하나에(이야기 속 간격 반복)
  if (recycle.length) {
    const answers = scenes.flatMap((s) => answerTexts(s));
    if (!recycle.some((r) => answers.some((a) => contains(a, r)))) return null;
  }
  // 요청한 레벨보다 눈에 띄게 어려운 원고는 거부(초급자가 긴 문장에 지치지 않게)
  const lv = String(want || x.level || 'A2');
  const lineWords = scenes.filter((s): s is Extract<Scene, { type: 'line' }> => s.type === 'line').map((s) => s.en.split(/\s+/).length);
  const cap = LEVEL_MAX_WORDS[lv];
  if (cap && lineWords.length && lineWords.reduce((a, b) => a + b, 0) / lineWords.length > cap) return null;
  // 리텔 키워드(M5) — 소프트: 한국어 문자열 4개면 싣고, 아니면 뺀다(없어도 원고는 받는다)
  const kw = Array.isArray(x.keywords) ? x.keywords.filter((k): k is string => typeof k === 'string' && hasHangul(k)).slice(0, 4) : [];
  const ep: Episode = { no, level: lv, title: x.title, titleKr: String(x.titleKr), recap: String(x.recap || ''), scenes, learn, cliff: String(x.cliff), ai: true };
  if (kw.length === 4) ep.keywords = kw;
  return ep;
}

/** 레벨별 대사 평균 단어 수 상한(가이드보다 여유 있게 — 이걸 넘으면 레벨이 안 맞는 원고) */
const LEVEL_MAX_WORDS: Record<string, number> = { A1: 8, A2: 11, B1: 15 };

const LEVEL_GUIDE: Record<string, string> = {
  A1: '아주 짧은 문장(3~6단어), 현재 시제 위주, 기초 어휘만',
  A2: '짧은 문장(4~9단어), 현재·과거·미래 기본, 일상·직장 기초 어휘',
  B1: '보통 문장(6~12단어), 현재완료·조건문 가능, 업무 어휘 조금',
  B2: '자연스러운 원어민 대화, 관용 표현·완곡어법 포함',
  C1: '빠르고 자연스러운 원어민 대화, 뉘앙스·유머·관용 표현',
  C2: '빠르고 자연스러운 원어민 대화, 뉘앙스·유머·관용 표현',
};

/** 재생 중 오류가 난 생성 원고를 버린다(다음 시도에서 새로 쓴다) */
export function discardGenerated(no: number) {
  store(EPS_KEY, generatedEpisodes().filter((e) => e.no !== no));
}

/** 쓰는 중인 화 — 엔딩에서 미리 쓰기 시작한 화를 열면 같은 요청을 기다린다(중복 호출 없음) */
const inflight = new Map<number, Promise<Episode | null>>();

export function isGenerating(no: number): boolean {
  return inflight.has(no);
}

/** 다음 화를 만든다 — 앞 이야기(최근 4화 요약 + 직전 클리프행어)를 기억하며 */
export function generateEpisode(no: number, level: Cefr = dramaLevel()): Promise<Episode | null> {
  const cur = inflight.get(no);
  if (cur) return cur;
  const p = writeEpisode(no, level).finally(() => inflight.delete(no));
  inflight.set(no, p);
  return p;
}

/**
 * 다음 화 미리 쓰기 — 한 화를 다 본 뒤(엔딩) 백그라운드로 시작한다. 다음 날 열 때
 * 기다림 없이 바로 재생된다. 원고 화(1~7화)나 이미 있는 화, 키가 없으면 아무것도 안 한다.
 */
export function prefetchEpisode(no: number): Promise<boolean> | null {
  if (no <= S.episodes.length || episodeByNo(no) || !groqKey()) return null;
  return generateEpisode(no)
    .then((e) => !!e)
    .catch(() => false);
}

async function writeEpisode(no: number, level: Cefr): Promise<Episode | null> {
  if (!groqKey()) return null;
  const prev = allEpisodes().filter((e) => e.no < no).slice(-4);
  const last = prev[prev.length - 1];
  const story = prev.map((e) => `${e.no}화 「${e.titleKr}」: ${e.recap || ''} → 끝: ${e.cliff}`).join('\n');
  const cast = CAST.map((c) => `${c.id}(${c.name}): ${c.desc}`).join('\n');
  // 지난 화에서 배운(또는 틀린) 표현 — 새 상황에서 다시 쓰게 해 이야기 속 간격 반복이 되게 한다
  const recycle = recycleCandidates(no);
  const [profileLo, profileHi] = wordRangeFor(level);
  const recycleRule = recycle.length
    ? `- 복습 표현(학습자가 지난 화에서 배웠거나 틀린 것): ${recycle.map((r) => `"${r.en}"(${r.kr})`).join(', ')}\n  → 이 중 최소 1개를 이번 화 참여 문항의 정답(태오의 대사)으로, 다른 상황에서 자연스럽게 다시 쓰게 하라. learn에는 넣지 말 것.\n`
    : '';
  const sys = `너는 한국인 영어 학습자를 위한 웹드라마 작가다. 시리즈: "${SERIES}"(${SERIES_KR}). 시트콤처럼 웃기고, 매 화 작은 사건과 반전이 있다.
등장인물(id: 설명):
${cast}
(필요하면 새 조연 1명 추가 가능 — who에 영어 소문자 id)
지금까지 이야기:
${story}
이번 ${no}화는 직전 화의 끝("${last?.cliff || ''}")에서 바로 이어진다. 회사 일만이 아니라 동료 관계·일상·유머를 섞어라.
영어 난이도: ${level} — ${LEVEL_GUIDE[level] || LEVEL_GUIDE.A2}. 모든 영어 대사가 이 난이도를 지켜야 한다.
구성 규칙:
- scenes 12~18개. type: "narr"(한국어 해설 kr), "line"(who,en,kr), 그리고 학습자 참여 3개(서로 다른 형식 2종 이상):
  "choice"(prompt 한국어, opts 3개 {en, ok, kr(한국어 뜻), why(오답만, 한국어), reply(정답만: {who,en,kr} 상대의 반응)}, 정답 정확히 1개)
  "meaning"(who, en, opts 한국어 뜻 3개, a 정답 인덱스, why 한국어) — 바로 앞 line에 같은 영어를 쓰지 말 것
  "fill"(who, before, after, opts 영어 3개, a, kr 전체 번역, why 한국어)
  "speak"(who:"taeo", en, kr — 태오가 소리 내어 말할 한 문장)
- 참여 문항은 이야기 흐름 속 태오의 대사여야 한다(시험 문제처럼 떼어 내지 말 것).
- 태오(학습자 역할)의 line/speak 대사를 **5줄 이상** 넣고, 상대 대사와 교대로 배치하라(학습자가 태오 대사를 전부 직접 말한다).
  태오 대사 한 줄의 단어 수: ${profileLo}~${profileHi}단어(축약은 한 단어).
${recycleRule}- learn: 이번 화 새 핵심 표현 2개 {en, kr, note(언제 쓰는지 한국어 짧게)} — 두 표현 모두 이번 화 대사나 문항에 그대로 나와야 한다.
- keywords: 이번 화를 다시 말할 때 쓸 핵심 키워드 4개(한국어, 인물·사건·감정·결말 순).
- recap: 직전 화까지 한 줄 요약(한국어). cliff: 다음 화가 궁금해지는 한 줄(한국어).
JSON만: {"level":"${level}","title":"영어 제목","titleKr":"한국어 제목","recap":"","scenes":[...],"learn":[...],"keywords":["","","",""],"cliff":""}`;
  // 네트워크·429·키 오류는 예외로 올라온다 — 삼키고 null(예전엔 '쓰는 중' 스피너가 영원히 돌았다).
  // 느린 응답도 60초에서 끊는다(검증 실패 시 한 번 더 쓰므로 두 번 분량).
  let ep: Episode | null = null;
  let t: ReturnType<typeof setTimeout> | undefined;
  // 첫 원고는 '지난 표현 재등장'까지 엄격히 보고, 다시 쓴 원고는 그 조건만 풀어 준다
  // (모델이 한 번 놓쳤다고 이야기 자체를 못 보게 하지 않는다)
  let attempt = 0;
  const recycleEns = recycle.map((r) => r.en);
  try {
    ep = await Promise.race([
      groqKoJson<Episode>(
        [
          { role: 'system', content: sys },
          { role: 'user', content: `${no}화를 써 줘.` },
        ],
        { temperature: 0.9, maxTokens: 4000 },
        (d) => {
          // 레벨은 요청한 값으로 고정·검사(AI가 적어 낸 레벨을 믿지 않는다), 지난 표현 재등장도 검사
          const k = attempt++;
          const v = validateEpisode(d, no, level, k === 0 ? recycleEns : []);
          if (!v) return null;
          // 역할극 분량(태오 대사 ≥5줄·단어 수) — gpt-oss 첫 시도만 하드, 재시도·폴백 모델은 경고만.
          // 실제 모델은 서버 폴백 체인이 정하므로 기본 모델(GROQ_MODEL) 기준으로 판단한다.
          return acceptByProfile(validateProfile(GROQ_MODEL, v, k)) ? v : null;
        }
      ),
      new Promise<null>((res) => {
        t = setTimeout(() => res(null), 60000);
      }),
    ]);
  } catch {
    ep = null;
  } finally {
    if (t) clearTimeout(t);
  }
  if (!ep) return null;
  const gen = generatedEpisodes().filter((e) => e.no !== no);
  store(EPS_KEY, [...gen, ep].sort((a, b) => a.no - b.no).slice(-40));
  return ep;
}

/* ── 따라 말하기 일치도 ── */
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** 따라 말한 문장이 목표와 얼마나 겹치나(0~1) — 목표 단어 중 들린 비율 */
export function speakMatch(target: string, said: string): number {
  const t = words(target);
  if (!t.length) return 0;
  const bag = new Map<string, number>();
  for (const w of words(said)) bag.set(w, (bag.get(w) || 0) + 1);
  let hit = 0;
  for (const w of t) {
    const n = bag.get(w) || 0;
    if (n > 0) {
      hit++;
      bag.set(w, n - 1);
    }
  }
  return hit / t.length;
}
