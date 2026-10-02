/**
 * 드라마 인물과 대화하기 — 집중 모드 '회화' 탭.
 *
 * 예전 회화 탭은 드라마와 무관한 업무 미션(장애 보고·컨퍼런스)을 레벨과 상관없이 보여 줬고,
 * 도움 문장은 식당 표현이었다(감사 v1.30 #21·#55). 이제는 **방금 본 에피소드의 인물**이
 * 그 화 직후 상황에서 태오(나)에게 말을 걸고, 그 화에서 배운 표현을 써 볼 기회를 만든다.
 * 입력은 목소리만(텍스트 입력칸 없음), 인물의 영어는 드라마 난이도(dramaLevel)에 맞춘다.
 */
import { allEpisodes, castOf, dramaLevel, normEn, watched, type Episode } from './drama';
export { voiceOf } from './drama';
import { addWeakItem } from './state';
import { hasHangul } from './aiGuard';
import { recordMistake, sanitizeMistakeType } from './transfer';
import type { Cefr } from './cefr';

/** 한 번의 대화에서 내가 말하는 횟수 — 5분 안쪽 */
export const TALK_TURNS = 5;

export interface TalkSetup {
  ep: Episode;
  /** 대화 상대(태오가 아닌 인물 중 그 화에서 가장 많이 말한 사람) */
  partner: string;
  level: Cefr;
}

/** 가장 최근에 본 화와 그 화의 대화 상대. 아직 본 화가 없으면 null */
export function talkSetup(): TalkSetup | null {
  const seen = watched();
  if (!seen.length) return null;
  const last = Math.max(...seen);
  const ep = allEpisodes().find((e) => e.no === last);
  if (!ep) return null;
  const count = new Map<string, number>();
  for (const s of ep.scenes) {
    if ((s.type === 'line' || s.type === 'meaning' || s.type === 'fill') && s.who !== 'taeo') count.set(s.who, (count.get(s.who) || 0) + 1);
  }
  const partner = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'maya';
  return { ep, partner, level: dramaLevel() };
}

const LEVEL_WORDS: Record<string, number> = { A1: 7, A2: 10, B1: 14, B2: 18, C1: 22, C2: 22 };

/** 인물 역할 시스템 프롬프트 */
export function talkSystemPrompt({ ep, partner, level }: TalkSetup): string {
  const c = castOf(partner);
  const learn = ep.learn.map((l) => `"${l.en}"(${l.kr})`).join(', ');
  const maxW = LEVEL_WORDS[level] || 10;
  return `너는 웹드라마 "Taco at Nimbus"의 등장인물 ${c.name}(${c.desc})이다. 학습자는 주인공 태오(Taeo — 한국인 신입 클라우드 영업 담당, 별명 Taco) 역할로 너와 영어로 대화한다.
상황: 방금 ${ep.no}화 「${ep.titleKr}」가 끝났다. ${ep.recap ? `지난 이야기: ${ep.recap} ` : ''}이 화의 끝: ${ep.cliff}
그 직후, 네가 태오에게 말을 건다(또는 이어서 대화한다).
학습자 영어 레벨: ${level}. 너의 영어도 이 레벨에 맞춰 1~2문장, 문장당 ${maxW}단어 이하, 쉬운 단어로.
오늘 배운 표현: ${learn}. 학습자가 이 표현을 써 볼 수 있게 자연스럽게 기회를 만들어라.
규칙:
- 항상 ${c.name}로서만 말한다(설명·강의·번역 금지). 대화를 이어갈 짧은 질문을 자주 넣는다.
- 학습자가 한국어로 말하면 캐릭터로서 짧게 반응하고, hint에 그 말을 영어로 바꿔 준다(hint.en = 학습자가 하려던 말을 영어 한 문장으로 — 학습자가 그 문장을 소리 내어 말한다).
- 교정 정책: (1) 뜻이 통하면 교정 없이 대화를 이어간다. (2) 뜻을 알 수 없거나 오늘 배운 표현을 잘못 쓰면 먼저 캐릭터로서 한 번 되묻는다. (3) 그래도 틀리거나 같은 오류가 두 번째면 reply에서 자연스럽게 바꿔 말해 주고(리캐스트), fix에 {"wrong": 학습자가 실제로 한 틀린 구절 그대로, "better": 학습자가 하려던 말을 자연스러운 영어 한 문장으로, "kr": 그 문장의 한국어 뜻, "why": 무엇을 고쳤는지 한국어 한 줄, "type": tense|article|preposition|word-order|word-choice|other 중 하나}. 한 턴에 fix는 최대 1개. 사소하면 fix는 null.
- 세 번째 너의 대사(학습자가 두 번 대답한 뒤)는 너의 근황을 두 문장으로 말한다(마침표로 구분, 각 문장 짧게). 그때 "reaction":true를 넣는다 — 학습자가 두 문장 사이에 짧게 맞장구(Really? / Oh no. / Okay.)를 친다.
- 학습자가 못 알아들었다고 하면(Sorry? / Say that again? / One more time?) 방금 한 말을 더 짧고 쉬운 말로 다시 한다.
- hint: 태오가 다음에 할 수 있는 말 {"en": 레벨에 맞는 영어 한 문장, "kr": 한국어 뜻}.
JSON만: {"reply":"영어 대사","kr":"한국어 번역","fix":null,"hint":{"en":"","kr":""},"reaction":false}`;
}

export interface TalkReply {
  reply: string;
  kr: string;
  /** wrong·type은 M6에서 더한 선택 필드 — 예전 응답(없음)도 그대로 통과한다 */
  fix: { better: string; kr: string; why: string; wrong?: string; type?: string } | null;
  hint: { en: string; kr: string } | null;
  /** 리액션 턴 표시(세 번째 인물 대사 — 근황 두 문장). 없으면 false로 본다 */
  reaction?: boolean;
}

const s = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** AI 응답 검증 — 모양이 틀리거나 한국어여야 할 곳이 영어면 null */
export function validateTalk(d: unknown): TalkReply | null {
  const x = d as Partial<TalkReply> | null;
  if (!x || !s(x.reply) || hasHangul(x.reply) || !hasHangul(x.kr)) return null;
  let fix: TalkReply['fix'] = null;
  const f = x.fix as TalkReply['fix'] | undefined;
  if (f && typeof f === 'object' && s(f.better) && !hasHangul(f.better) && hasHangul(f.why)) {
    fix = { better: f.better.trim(), kr: hasHangul(f.kr) ? f.kr.trim() : '', why: f.why.trim() };
    // 선택 필드 — 틀린 구절은 영어일 때만, 유형은 알려진 집합으로(모르면 other)
    if (s(f.wrong) && !hasHangul(f.wrong)) fix.wrong = f.wrong.trim();
    if (s(f.type)) fix.type = sanitizeMistakeType(f.type);
  }
  let hint: TalkReply['hint'] = null;
  const h = x.hint as TalkReply['hint'] | undefined;
  if (h && typeof h === 'object' && s(h.en) && !hasHangul(h.en) && hasHangul(h.kr)) hint = { en: h.en.trim(), kr: h.kr.trim() };
  const out: TalkReply = { reply: x.reply.trim(), kr: String(x.kr).trim(), fix, hint };
  if (x.reaction === true) out.reaction = true;
  return out;
}

/** 대화에서 그 화의 표현을 실제로 썼는가(대소문자·문장부호 무시, 표현이 내 말 안에 들어 있으면) */
export function usedExpressions(ep: Episode, said: string[]): string[] {
  const hay = said.map((x) => ` ${normEn(x)} `);
  return ep.learn.filter((l) => {
    const n = normEn(l.en);
    return n.length >= 3 && hay.some((h) => h.includes(` ${n} `));
  }).map((l) => l.en);
}

/**
 * 대화에서 고쳐 준 문장은 복습 카드로 — 다음 화 첫머리 '지난 화 기억나요?'(M3 말로 떠올리기 회상 큐)에 나온다.
 * M6: 교정 축적(transfer.recordMistake)도 함께 — wrong(내가 한 말)이 있을 때만(약점 카드 '자주 틀리는 문장').
 */
export function saveFixes(ep: Episode, fixes: { better: string; kr: string; why?: string; wrong?: string; type?: string }[], now = Date.now()): number {
  let n = 0;
  for (const f of fixes.slice(0, 3)) {
    if (s(f.better) && s(f.wrong)) recordMistake({ wrong: f.wrong.trim(), right: f.better.trim(), note: (f.why || '').trim(), t: now, type: sanitizeMistakeType(f.type) });
    // 뜻(kr)이 있어야 '영어로는?' 복습 문제가 된다
    if (s(f.better) && hasHangul(f.kr)) {
      addWeakItem({ en: f.better, kr: f.kr, cat: '드라마', lesson: `drama:${ep.no}` }, 1);
      n++;
    }
  }
  return n;
}
