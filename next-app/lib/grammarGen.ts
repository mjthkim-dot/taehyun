/**
 * 문법 변형 생성 — "매번 똑같은 수업을 받는 느낌"에 대한 답.
 *
 * 18유닛의 원본 문항은 고정이라 같은 유닛을 다시 하면 같은 문제가 그대로 나왔다.
 * 이제 **두 번째부터는 같은 문법을 새로운 상황·새 문항으로** AI가 만든다.
 * 상황은 풀(업무 20 + 일상 10)에서 날짜·회차로 돌려 매번 다른 장면이 되고,
 * 만든 변형은 형식을 엄격히 검증한다(보기 3개·정답 인덱스·오답 조각이 정답과 겹치지 않음·
 * 한국어 해설). 검증을 통과 못 하거나 키·네트워크가 없으면 원본 문항을 쓴다.
 * '사고' 단계(한국어식 vs 영어식 사고·규칙)는 문법 자체의 설명이라 그대로 둔다.
 */
import { groqKoJson, hasHangul } from './aiGuard';
import { load, store, groqKey } from './state';
import { todayKey, daySeed } from './dates';
import type { GrammarUnit, GCheck, GBuild, GTurn } from './grammar';

/** 변형에 쓸 상황 풀 — 업무 중심 + 일상 */
export const SCENE_POOL = [
  '클라우드 비용이 갑자기 오른 고객에게 원인을 설명하는 통화',
  '새 고객사 IT 팀과의 첫 화상 미팅',
  '계약 갱신을 앞둔 고객과의 가격 협상',
  '야간 장애 후 아침에 고객 CTO에게 보고',
  '파트너사(AWS) 담당자와 공동 제안 준비 회의',
  '신입 동료에게 우리 서비스 온보딩 설명',
  '해외 본사 매니저와의 주간 1:1',
  '콘퍼런스 부스에서 처음 만난 잠재 고객과의 대화',
  'PoC 결과를 고객 임원에게 발표',
  '청구서 오류로 화난 고객 회계 담당자 응대',
  '보안 감사(ISMS) 준비 회의에서 요구사항 확인',
  '데이터 마이그레이션 일정 지연을 고객에게 알리기',
  '채용 면접에서 내 경력과 성과 설명',
  '팀 회고 회의에서 지난 분기 돌아보기',
  '고객사 개발자에게 새 기능 데모',
  '경쟁사와 비교를 요구하는 구매 담당자 응대',
  '출장 중 호텔 체크인 문제 해결',
  '해외 출장 공항에서 항공편 변경',
  '거래처와 저녁 식사 자리 스몰토크',
  '동료에게 휴가 중 업무 인수인계',
  '고객과 다음 분기 로드맵 합의',
  '회의 중 이해 못 한 부분을 되묻기',
  '제안서 마감 연장을 부탁하기',
  '고객 추천(레퍼런스)을 부탁하기',
  '신규 파트너와 역할 분담 정하기',
  '월간 비용 리뷰(SBR) 결과 공유',
  '고객의 기술 질문에 모르는 부분 확인 후 답하기',
  '네트워킹 행사에서 자기소개와 명함 교환',
  '사내 발표에서 이번 달 성과 보고',
  '고객 불만 이메일에 대한 통화 후속 조치',
];

export interface GrammarVariant {
  scene: string;
  ex: [string, string][];
  checks: GCheck[];
  builds: GBuild[];
  sim: { who: string; turns: GTurn[] };
  /** 생성 출처 */
  ai: true;
}

const CACHE_KEY = 'va_grammar_variants';

interface Cache {
  [unitId: string]: { date: string; v: GrammarVariant }[];
}

function cache(): Cache {
  return load<Cache>(CACHE_KEY, {});
}

/** 이 유닛에서 최근 쓴 상황들(중복 회피용) */
function usedScenes(unitId: string): string[] {
  return (cache()[unitId] || []).map((x) => x.v.scene);
}

/** 다음 상황 — 날짜 + 회차 시드, 최근 쓴 것 제외 */
export function nextScene(unitId: string, attempt: number, seed = daySeed()): string {
  const used = new Set(usedScenes(unitId));
  const n = SCENE_POOL.length;
  const start = (seed + attempt * 7 + unitId.length * 3) % n;
  for (let i = 0; i < n; i++) {
    const s = SCENE_POOL[(start + i) % n];
    if (!used.has(s)) return s;
  }
  return SCENE_POOL[start];
}

const words = (s: string) => s.trim().split(/\s+/);

/** 생성 결과 검증 — 하나라도 어긋나면 null(원본으로 대체) */
export function validateVariant(d: unknown): GrammarVariant | null {
  const x = d as Record<string, unknown> | null;
  if (!x || typeof x.scene !== 'string' || !hasHangul(x.scene)) return null;
  const ex = Array.isArray(x.ex) ? (x.ex as unknown[]).filter((e): e is [string, string] => Array.isArray(e) && typeof e[0] === 'string' && hasHangul(e[1])).slice(0, 2) : [];
  const checks = (Array.isArray(x.checks) ? x.checks : []) as GCheck[];
  const okCheck = (c: GCheck) =>
    c && typeof c.q === 'string' && Array.isArray(c.opts) && c.opts.length === 3 && new Set(c.opts).size === 3 && Number.isInteger(c.a) && c.a >= 0 && c.a < 3 && hasHangul(c.why);
  if (checks.length < 3 || !checks.slice(0, 3).every(okCheck)) return null;
  const builds = (Array.isArray(x.builds) ? x.builds : []) as GBuild[];
  const okBuild = (b: GBuild) =>
    b && typeof b.a === 'string' && words(b.a).length >= 3 && words(b.a).length <= 14 && hasHangul(b.kr) && (b.extra || []).every((e) => typeof e === 'string' && !words(b.a).includes(e));
  if (builds.length < 2 || !builds.slice(0, 2).every(okBuild)) return null;
  const sim = x.sim as { who?: unknown; turns?: unknown } | undefined;
  if (!sim || typeof sim.who !== 'string' || !Array.isArray(sim.turns)) return null;
  const turns = sim.turns as GTurn[];
  if (turns.length !== 4) return null;
  const [t1, t2, t3, t4] = turns;
  const okTurnBase = (t: GTurn) => t && typeof t.them === 'string' && hasHangul(t.kr);
  const okChoose = (t: GTurn) => okTurnBase(t) && t.task === 'choose' && okCheck({ q: t.them, opts: t.opts, a: t.a, why: t.why } as GCheck);
  const okBuildTurn = (t: GTurn) => okTurnBase(t) && t.task === 'build' && okBuild({ a: t.a, kr: t.kr, extra: t.extra }) && hasHangul(t.why);
  const okFree = (t: GTurn) => okTurnBase(t) && t.task === 'free' && hasHangul(t.prompt) && typeof t.model === 'string' && typeof t.focus === 'string';
  if (!okChoose(t1) || !okBuildTurn(t2) || !okChoose(t3) || !okFree(t4)) return null;
  const strip = (s: string) => s.replace(/[.!?]+$/, '');
  return {
    scene: x.scene,
    ex: ex.length === 2 ? ex : [],
    checks: checks.slice(0, 3),
    builds: builds.slice(0, 2).map((b) => ({ ...b, a: strip(b.a) })),
    sim: { who: sim.who, turns: [t1, { ...t2, a: strip((t2 as { a: string }).a) } as GTurn, t3, t4] },
    ai: true,
  };
}

/** 같은 문법, 새 상황의 변형을 만든다(실패하면 null) */
export async function generateVariant(unit: GrammarUnit, attempt: number): Promise<GrammarVariant | null> {
  if (!groqKey()) return null;
  const scene = nextScene(unit.id, attempt);
  const sys = `너는 한국인 IT 클라우드 영업 담당자를 위한 영어 문법 교재 작가다.
목표 문법: ${unit.point} (${unit.level}). 핵심 규칙: ${unit.think.rule}
이번 상황: "${scene}" — 원래 교재 상황("${unit.scene}")과 다른 장면으로 새로 만든다.
규칙:
- 모든 문항이 목표 문법을 '고르고/조립하고/말하게' 해야 한다. 다른 문법으로 풀리면 안 된다.
- ${unit.level} 수준의 쉬운 어휘. 영어는 자연스러운 원어민 문장.
- checks: 빈칸(___) 문장 + 보기 3개(정답 1, 목표 문법을 잘못 쓴 오답 2) + why(한국어, 왜 그 형태인지).
- builds: kr(한국어 문장) + a(영어 정답, 마침표 없이, 3~12단어) + extra(헷갈리는 오답 단어 1~2개, a에 없는 단어).
- sim: who(상대 역할, 한국어) + turns 정확히 4개:
  1) task "choose": them(상대 영어 말) kr(번역) opts 3개(정답 1) a why
  2) task "build": them kr a extra why
  3) task "choose": them kr opts a why
  4) task "free": them kr prompt(한국어로 무엇을 말할지) model(모범 영어 답) focus(목표 문법 영어 이름)
JSON만 출력:
{"scene":"한국어 상황 한 문장","ex":[["영어 예문","번역"],["영어 예문","번역"]],"checks":[{"q":"","opts":["","",""],"a":0,"why":""}],"builds":[{"kr":"","a":"","extra":[""]}],"sim":{"who":"","turns":[...]}}`;
  const v = await groqKoJson<GrammarVariant>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `새 상황 "${scene}"으로 만들어 줘.` },
    ],
    { temperature: 0.8, maxTokens: 2000 },
    validateVariant
  );
  if (!v) return null;
  const c = cache();
  c[unit.id] = [...(c[unit.id] || []), { date: todayKey(), v }].slice(-6);
  store(CACHE_KEY, c);
  return v;
}

/** 변형을 유닛에 입힌다 — 사고 단계의 설명·규칙은 원본 유지 */
export function applyVariant(unit: GrammarUnit, v: GrammarVariant | null): GrammarUnit {
  if (!v) return unit;
  return {
    ...unit,
    scene: v.scene,
    think: { ...unit.think, ex: v.ex.length === 2 ? v.ex : unit.think.ex },
    checks: v.checks,
    builds: v.builds,
    sim: v.sim,
  };
}
