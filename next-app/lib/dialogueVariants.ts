'use client';

/**
 * 🎲 다른 대화 듣기 — 레슨마다 고정 대화 1개뿐이던 것을, 같은 맥락(레슨 주제·타깃
 * 문법·시나리오·레벨)에 맞는 새 원어민 대화를 AI로 생성해 폭넓게 들을 수 있게 한다.
 * 생성한 대화는 localStorage에 레슨별로 저장해 언제든 다시 듣고, 기존
 * 듣기·역할 연습·암기 체크 모드를 그대로 쓸 수 있다.
 */
import type { Dialogue, Lesson } from './lessons';
import { cefrOf } from './lessons';
import { lessonTargetGrammar } from './talkPrompts';
import { groqComplete } from './groq';
import { load, store } from './state';

const STORE_KEY = 'va_dlg_variants';
/** 레슨당 보관할 변형 대화 최대 개수 — 넘치면 오래된 것부터 버린다. */
export const MAX_VARIANTS = 4;

type VariantMap = Record<string, Dialogue[]>;

export function loadVariants(lessonId: number): Dialogue[] {
  const map = load<VariantMap>(STORE_KEY, {});
  return Array.isArray(map[String(lessonId)]) ? map[String(lessonId)] : [];
}

export function saveVariant(lessonId: number, d: Dialogue): Dialogue[] {
  const map = load<VariantMap>(STORE_KEY, {});
  const list = Array.isArray(map[String(lessonId)]) ? map[String(lessonId)] : [];
  list.push(d);
  map[String(lessonId)] = list.slice(-MAX_VARIANTS);
  store(STORE_KEY, map);
  return map[String(lessonId)];
}

export function removeVariant(lessonId: number, index: number): Dialogue[] {
  const map = load<VariantMap>(STORE_KEY, {});
  const list = (map[String(lessonId)] || []).filter((_, i) => i !== index);
  map[String(lessonId)] = list;
  store(STORE_KEY, map);
  return list;
}

function lessonContext(lesson: Lesson): string {
  const title = lesson.title || lesson.scenario?.title || (lesson.category ? `상황 회화 — ${lesson.category}` : lesson.dialogue?.title || '일상 회화');
  const parts = [`레슨 주제: ${title}`, `학습자 레벨: CEFR ${cefrOf(lesson)}`];
  const grammar = lessonTargetGrammar(lesson);
  if (grammar) parts.push(`타깃 문법/표현: ${grammar}`);
  if (lesson.scenario) parts.push(`상황: ${lesson.scenario.title} — ${lesson.scenario.desc}`);
  if (lesson.dialogue) {
    parts.push(`기존 대화 제목: ${lesson.dialogue.title}`);
    parts.push(`기존 대화 첫 두 줄(난이도·톤 참고용):\n${lesson.dialogue.lines.slice(0, 2).map((l) => `${l.sp}: ${l.en}`).join('\n')}`);
  }
  return parts.join('\n');
}

const SYSTEM = [
  '너는 영어 회화 교재의 원어민 대화 대본 작가다. 주어진 레슨 맥락에 맞는 자연스러운',
  '두 사람(A, B)의 영어 대화를 새로 써서, 아래 JSON 형식으로만 출력한다(코드블록·설명 없이):',
  '{',
  '  "title": "한국어 제목 (English Title)",',
  '  "lines": [ { "sp": "A", "en": "영어 대사", "kr": "한국어 뜻" } ]',
  '}',
  '',
  '규칙:',
  '- lines는 8~10줄, A와 B가 번갈아 말한다(A부터 시작).',
  '- 학습자 레벨(CEFR)에 맞는 어휘·문장 길이로 쓰되, 원어민이 실제로 쓰는 자연스러운 표현을 담는다.',
  '- 타깃 문법/표현이 주어지면 대화 속에 2~3번 자연스럽게 녹여낸다.',
  '- 기존 대화와 상황·전개가 겹치지 않게 새로운 장면을 만든다(제공된 "피해야 할 제목" 목록과도 다르게).',
  '- kr은 자연스러운 한국어 번역.',
].join('\n');

function isValidLine(l: unknown): l is { sp: string; en: string; kr: string } {
  const o = l as { sp?: unknown; en?: unknown; kr?: unknown };
  return !!o && typeof o.en === 'string' && o.en.trim().length > 0 && typeof o.kr === 'string';
}

/** 레슨 맥락에 맞는 새 대화를 생성한다. 실패 시 GroqError/Error를 던진다. */
export async function generateDialogueVariant(lesson: Lesson, existing: Dialogue[]): Promise<Dialogue> {
  const avoid = [lesson.dialogue?.title, ...existing.map((d) => d.title)].filter(Boolean);
  const user = [
    lessonContext(lesson),
    avoid.length ? `\n피해야 할 제목(이미 있는 대화): ${avoid.join(' / ')}` : '',
    '\n위 맥락에 맞는 새로운 대화 한 편을 만들어줘.',
  ].join('\n');
  const raw = await groqComplete(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
    { temperature: 0.9, maxTokens: 900, json: true }
  );
  const parsed = JSON.parse(raw || '{}') as Partial<Dialogue>;
  const lines = Array.isArray(parsed.lines) ? parsed.lines.filter(isValidLine) : [];
  if (lines.length < 6) throw new Error('대화 생성에 실패했어요. 다시 시도해주세요.');
  // 화자를 A/B로 정규화 — 모델이 이름을 쓰거나 대소문자를 섞어도 재생(화자별 목소리)이 항상 동작하게.
  const norm = lines.slice(0, 12).map((l, i) => ({
    sp: String(l.sp || '').trim().toUpperCase() === 'B' ? 'B' : String(l.sp || '').trim().toUpperCase() === 'A' ? 'A' : i % 2 === 0 ? 'A' : 'B',
    en: l.en.trim(),
    kr: (l.kr || '').trim(),
  }));
  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : '새 대화';
  return { title, lines: norm };
}
