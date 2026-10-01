/**
 * 소리 디코더 — 원어민이 실제로 내는 소리(축약·약형·플랩 T·연음) 30항목.
 *
 * 원어민 대화의 약형 사용률은 90%에 가까운데 교재 영어에는 0건이다. "going to"라고
 * 배우고 "gonna"를 들으면 못 알아듣는 이유가 여기 있다. 이 모듈은 그 간극을
 * 30개 고정 항목으로 좁힌다 — 확장 조항 없음(외우는 게 아니라 입에 붙이는 것이
 * 목적이라, 많을수록 나쁘다).
 *
 * 표기 원칙: IPA 금지. 학습자(A1~A2)는 발음기호를 못 읽는다. 대신 영어 구어 표기
 * (gonna)와 한글 근사(거너)를 병기한다. 한글 근사는 '정확한 발음'이 아니라
 * '그렇게 들린다'는 힌트다.
 *
 * 순수 lib — 화면 배선 없음. M7(말풍선 '원어민 소리' 줄)·M9(소리 훈련)가 가져다 쓴다.
 * 저장은 localStorage `va_sound_track`의 `decoderSeen` 필드 하나만 쓴다. 같은 키를
 * M9가 다른 필드로 쓰므로 키 전체를 덮어쓰지 않고 필드만 갱신한다.
 */
import raw from '../data/connectedSpeech.json';
import { load, store } from './state';
import { daySeed } from './dates';

export type DecoderKind = 'contraction' | 'weak' | 'flap' | 'linking';

export interface DecoderItem {
  id: string;
  kind: DecoderKind;
  /** 원형(교재 표기) — "going to" */
  written: string;
  /** 원어민 소리의 영어 구어 표기 — "gonna" */
  spoken: string;
  /** 한글 근사 — "거너" (IPA 아님) */
  kr: string;
  /** 그 소리가 실제로 들어간 예문(IT영업·일상, A2, ≤10단어) */
  example: { en: string; kr: string };
  /** 언제·왜 그렇게 들리는지 한국어 한 줄 */
  tip: string;
}

/** 문장 안에서 디코더 항목이 적용되는 구간 — start/end는 원문 문자 오프셋(end 미포함) */
export interface SpokenSpan {
  start: number;
  end: number;
  id: string;
  kind: DecoderKind;
  /** 원문에서 잘라낸 그대로(대소문자 보존) */
  written: string;
  spoken: string;
  kr: string;
}

export const DECODER: DecoderItem[] = (raw as { items: DecoderItem[] }).items;

const KIND_LABEL: Record<DecoderKind, string> = {
  contraction: '축약',
  weak: '약형',
  flap: '플랩 T',
  linking: '연음',
};

/** 종류 한국어 라벨 — 카드 제목·배너 문구용 */
export function kindLabel(kind: DecoderKind): string {
  return KIND_LABEL[kind];
}

export function decoderById(id: string): DecoderItem | undefined {
  return DECODER.find((d) => d.id === id);
}

/* ───────── 저장(va_sound_track.decoderSeen) ───────── */

const TRACK_KEY = 'va_sound_track';

/** 본 항목 id 목록 — 손상된 값은 빈 배열로 */
export function decoderSeen(): string[] {
  const track = load<Record<string, unknown>>(TRACK_KEY, {});
  const seen = track.decoderSeen;
  return Array.isArray(seen) ? seen.filter((s): s is string => typeof s === 'string') : [];
}

/** 항목을 '봤다'로 표시 — 키의 다른 필드(M9 몫)는 그대로 둔다 */
export function markDecoderSeen(id: string) {
  if (!decoderById(id)) return;
  const track = load<Record<string, unknown>>(TRACK_KEY, {});
  const seen = decoderSeen();
  if (seen.includes(id)) return;
  store(TRACK_KEY, { ...track, decoderSeen: [...seen, id] });
}

/* ───────── 오늘의 소리 ───────── */

/**
 * 오늘의 디코더 항목 — 안 본 것 우선, 같은 날·같은 seen이면 항상 같은 항목.
 * 30개를 다 봤으면 전체에서 다시 돈다(복습). 순서는 날짜 시드로 돌리되
 * 목록 자체의 순서(종류별 묶음)를 섞지 않아, 하루하루 종류가 고르게 나오도록
 * 날짜 시드에 7을 곱해 건너뛴다(30과 서로소 → 30일 안에 전부 한 번씩).
 */
export function decoderOfDay(dateKey: string, seen: string[] = []): DecoderItem {
  const seenSet = new Set(seen);
  const unseen = DECODER.filter((d) => !seenSet.has(d.id));
  const pool = unseen.length ? unseen : DECODER;
  const idx = ((daySeed(dateKey) * 7) % pool.length + pool.length) % pool.length;
  return pool[idx];
}

/* ───────── 문장 안에서 구간 찾기 ───────── */

interface Token {
  text: string;
  start: number;
  end: number;
}

/** 아포스트로피는 단어의 일부(don't, I'm) — can't에서 can을 잡지 않기 위해 */
function tokenize(s: string): Token[] {
  const out: Token[] = [];
  const re = /[A-Za-z0-9']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    // 양끝의 따옴표성 아포스트로피('hello')는 단어가 아니다
    const text = m[0].replace(/^'+|'+$/g, '').toLowerCase();
    if (!text) continue;
    const lead = m[0].length - m[0].replace(/^'+/, '').length;
    out.push({ text, start: m.index + lead, end: m.index + lead + text.length });
  }
  return out;
}

const PATTERNS: { item: DecoderItem; words: string[] }[] = DECODER.map((item) => ({
  item,
  words: item.written.toLowerCase().split(/\s+/),
}));

/**
 * 문장에서 디코더 항목이 적용되는 구간 목록(앞에서부터, 겹치지 않음).
 * - 대소문자·구두점 무시, 단어 경계 매칭(water는 waters·watering과 다름).
 * - 겹치면 긴 쪽 우선: "going to"가 잡히면 그 안의 약형 "to"는 버린다.
 * - 약형(weak)은 뒤에 단어가 이어질 때만: 문장 끝 "Thank you."의 you는 강형이다.
 */
export function spokenForms(en: string): SpokenSpan[] {
  const tokens = tokenize(en);
  if (!tokens.length) return [];
  const cands: SpokenSpan[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const { item, words } of PATTERNS) {
      const n = words.length;
      if (i + n > tokens.length) continue;
      let ok = true;
      for (let k = 0; k < n; k++) {
        if (tokens[i + k].text !== words[k]) { ok = false; break; }
      }
      if (!ok) continue;
      if (item.kind === 'weak' && i + n >= tokens.length) continue;
      const start = tokens[i].start;
      const end = tokens[i + n - 1].end;
      cands.push({ start, end, id: item.id, kind: item.kind, written: en.slice(start, end), spoken: item.spoken, kr: item.kr });
    }
  }
  // 시작 위치 오름차순, 같은 위치면 긴 것 먼저 → 앞에서부터 겹치지 않게 고른다
  cands.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: SpokenSpan[] = [];
  let cursor = -1;
  for (const c of cands) {
    if (c.start < cursor) continue;
    out.push(c);
    cursor = c.end;
  }
  return out;
}

/**
 * 문장을 '원어민 소리' 한 줄로 — 디코더 구간은 구어 표기로 바꾸고 나머지는 그대로.
 * 예: "I'm going to check it out" → "I'm gonna checkitout". 구간이 없으면 null(줄을 숨긴다).
 */
export function spokenLine(en: string): string | null {
  const spans = spokenForms(en);
  if (!spans.length) return null;
  let out = '';
  let cursor = 0;
  for (const s of spans) {
    out += en.slice(cursor, s.start) + s.spoken;
    cursor = s.end;
  }
  return out + en.slice(cursor);
}
