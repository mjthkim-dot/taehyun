/**
 * 원어민스러움 성숙도 커리큘럼 — 이 앱의 글로벌 커리큘럼 축.
 *
 * CEFR(국제 표준)을 앵커로 삼되, 레벨이 아니라 "표현의 성숙도"로 성장을 본다:
 *   1 뼈대     — 정확한 문장을 만든다 (교과서 영어라도 좋다)
 *   2 구어의 감 — 축약형과 구어 프레임으로 말맛이 생긴다
 *   3 자연스러운 흐름 — 구동사·연결어로 문장이 이어진다
 *   4 관용의 층 — 원어민 관용구·콜로케이션이 배어난다
 *   5 원어민의 결 — 뉘앙스·완곡·톤 조절까지 자유롭다
 *
 * 승급은 자동이다: 매일의 연습이 남긴 증거(GSE 스킬, 사다리 완주 수, 단계
 * 커리큘럼 패턴 정착 수)가 기준에 닿으면 다음 성숙도로 올라간다. 한 번 오른
 * 단계는 내려가지 않는다(va_maturity에 고정) — 컨디션 나쁜 주간이 성장 기록을
 * 깎아 먹으면 동기가 죽는다.
 */
import { load, store } from './state';
import { getProfile } from './state';
import type { WeakItem } from './state';
import { ladderDoneCount } from './nativeLadder';
import type { Cefr } from './lessons';

/* ── 단계 정의 ── */

export interface MaturityStage {
  /** 1~5 */
  n: number;
  key: string;
  name: string;
  /** 한 줄 정체성 — 이 단계에서 무엇이 되는가 */
  motto: string;
  desc: string;
  /** CEFR 앵커 — 국제 표준과의 접점 */
  cefr: Cefr;
  /** 다음 단계로 가는 자동 승급 기준 (마지막 단계는 null) */
  next: { gse: number; ladders: number; patterns: number } | null;
}

export const STAGES: MaturityStage[] = [
  {
    n: 1, key: 'foundation', name: '뼈대', motto: '정확하게 말한다',
    desc: '교과서식이라도 좋다 — 의도가 정확히 전달되는 문장을 만드는 단계.',
    cefr: 'A2', next: { gse: 32, ladders: 2, patterns: 4 },
  },
  {
    n: 2, key: 'spoken', name: '구어의 감', motto: '말답게 말한다',
    desc: "I'd, gonna 같은 축약과 구어 프레임이 배어 문장이 말맛을 얻는 단계.",
    cefr: 'B1', next: { gse: 40, ladders: 6, patterns: 5 },
  },
  {
    n: 3, key: 'flow', name: '자연스러운 흐름', motto: '이어서 말한다',
    desc: '구동사와 연결어로 문장과 문장이 물 흐르듯 이어지는 단계.',
    cefr: 'B1', next: { gse: 48, ladders: 12, patterns: 6 },
  },
  {
    n: 4, key: 'idiom', name: '관용의 층', motto: '원어민의 표현을 쓴다',
    desc: 'circle back, ballpark 같은 관용구·콜로케이션이 자연스럽게 나오는 단계.',
    cefr: 'B2', next: { gse: 58, ladders: 20, patterns: 6 },
  },
  {
    n: 5, key: 'native', name: '원어민의 결', motto: '뉘앙스까지 다룬다',
    desc: '완곡·강조·톤 조절 — 무엇을 말할지가 아니라 어떻게 들릴지를 고르는 단계.',
    cefr: 'C1', next: null,
  },
];

/* ── 단계별 커리큘럼 — 원어민이 실제로 쓰는 패턴 8개 × 5단계 ──
 * 각 패턴은 사다리(말하기 통과)로 연습하고, 완주하면 "정착"으로 기록된다.
 * 예문은 세일즈/비즈니스 실무 맥락. */

export interface NativePattern {
  key: string;
  /** 패턴 자체 (영어) */
  en: string;
  /** 사다리에 올릴 예문 */
  ex: string;
  kr: string;
  /** 원어민이 이걸 쓰는 이유·뉘앙스 (한국어) */
  why: string;
}

export const STAGE_PATTERNS: Record<number, NativePattern[]> = {
  1: [
    { key: 'id-like', en: "I'd like to ...", ex: "I'd like to schedule a quick call.", kr: '짧은 통화를 잡고 싶습니다.', why: 'want보다 부드럽고 정중한 기본형 — 비즈니스의 디폴트.' },
    { key: 'could-you', en: 'Could you ...?', ex: 'Could you send me the latest deck?', kr: '최신 자료를 보내주시겠어요?', why: 'please+명령문 대신 원어민이 쓰는 요청의 표준형.' },
    { key: 'get-back', en: 'get back to you', ex: 'Let me check and get back to you.', kr: '확인하고 다시 연락드릴게요.', why: '모르면 이 한 문장 — 즉답 대신 신뢰를 지키는 표현.' },
    { key: 'didnt-catch', en: "I didn't catch that", ex: "Sorry, I didn't catch that.", kr: '죄송해요, 잘 못 들었어요.', why: '"다시 말해달라"를 상대 탓 없이 말하는 원어민식 표현.' },
    { key: 'just-to-confirm', en: 'Just to confirm, ...', ex: 'Just to confirm, the demo is at 3pm?', kr: '확인차 여쭤요, 데모는 3시죠?', why: '확인 질문 앞에 붙이면 따지는 느낌이 사라진다.' },
    { key: 'that-works', en: 'That works for me', ex: 'Thursday at 2? That works for me.', kr: '목요일 2시요? 저는 좋습니다.', why: 'OK보다 자연스러운 동의 — 일정 조율의 필수 표현.' },
    { key: 'im-afraid', en: "I'm afraid ...", ex: "I'm afraid I can't make it tomorrow.", kr: '죄송하지만 내일은 어렵습니다.', why: '거절 앞에 붙이는 완충재 — 원어민 거절의 기본 예의.' },
    { key: 'thanks-time', en: 'Thanks for your time', ex: 'Thanks for your time today.', kr: '오늘 시간 내주셔서 감사합니다.', why: '미팅을 닫는 원어민의 정형구 — 안 쓰면 끝맺음이 어색하다.' },
  ],
  2: [
    { key: 'looking-to', en: "We're looking to ...", ex: "We're looking to expand into Japan next year.", kr: '내년에 일본 진출을 계획하고 있어요.', why: 'plan to보다 구어적인 "~하려고 보고 있다" — 계획을 말하는 원어민 프레임.' },
    { key: 'turns-out', en: 'It turns out ...', ex: 'It turns out the issue was on our side.', kr: '알고 보니 문제는 저희 쪽이었어요.', why: '"알고 보니"를 한 단어처럼 — 반전을 전하는 구어 표준.' },
    { key: 'thing-is', en: 'The thing is, ...', ex: "The thing is, our budget is already set.", kr: '문제는, 예산이 이미 정해져 있다는 거예요.', why: '본론(난점)을 꺼낼 때 원어민이 숨 고르는 프레임.' },
    { key: 'wondering-if', en: 'I was wondering if ...', ex: 'I was wondering if we could push the deadline.', kr: '마감을 미룰 수 있을지 여쭤봅니다.', why: '부탁을 한 톤 낮춰 꺼내는 구어 완곡형 — 과거형이 공손함을 만든다.' },
    { key: 'do-you-mind', en: 'Do you mind if ...?', ex: 'Do you mind if I record this call?', kr: '통화를 녹음해도 괜찮을까요?', why: '허락 구하기의 구어 표준 — May I보다 훨씬 자주 쓴다.' },
    { key: 'kind-of', en: 'kind of / a bit', ex: "The timeline feels a bit tight.", kr: '일정이 좀 빠듯한 것 같아요.', why: '단정을 눅이는 쿠션 — 원어민은 직설 앞에 거의 항상 깐다.' },
    { key: 'touch-base', en: 'touch base', ex: "Let's touch base early next week.", kr: '다음 주 초에 가볍게 얘기해요.', why: '"가볍게 연락하자"의 비즈니스 구어 — meet보다 부담이 없다.' },
    { key: 'how-sound', en: 'How does that sound?', ex: 'We start with a pilot. How does that sound?', kr: '파일럿부터 시작하죠. 어떠세요?', why: '제안을 닫고 공을 넘기는 원어민의 마무리 질문.' },
  ],
  3: [
    { key: 'run-through', en: 'run through', ex: 'Let me run through the numbers quickly.', kr: '수치를 빠르게 짚어 드릴게요.', why: 'review/explain보다 가볍고 빠른 "훑기" — 발표 도입의 단골.' },
    { key: 'go-over', en: 'go over', ex: "Can we go over the contract terms?", kr: '계약 조건을 같이 살펴볼까요?', why: '함께 차근차근 살피는 뉘앙스 — check보다 협력적으로 들린다.' },
    { key: 'follow-up-on', en: 'follow up on', ex: "I'm following up on last week's proposal.", kr: '지난주 제안 건으로 다시 연락드려요.', why: '후속 연락의 표준 동사 — 세일즈 이메일 첫 문장의 왕.' },
    { key: 'sort-out', en: 'sort out', ex: "We'll sort out the access issue today.", kr: '접속 문제는 오늘 해결하겠습니다.', why: 'solve보다 구어적인 "정리해서 해결" — 믿음직하게 들린다.' },
    { key: 'put-together', en: 'put together', ex: "I'll put together a proposal by Friday.", kr: '금요일까지 제안서를 만들어 드릴게요.', why: 'make/create 대신 — 자료·계획을 "꾸려 만드는" 원어민 동사.' },
    { key: 'reach-out', en: 'reach out', ex: 'Feel free to reach out anytime.', kr: '언제든 편하게 연락 주세요.', why: 'contact의 부드러운 구어형 — 문턱을 낮추는 마무리.' },
    { key: 'that-said', en: 'That said, ...', ex: "That said, we're open to a smaller scope.", kr: '그렇긴 하지만, 범위를 줄이는 것도 열려 있어요.', why: '앞말을 뒤집지 않고 방향만 트는 연결어 — but보다 세련된 전환.' },
    { key: 'moving-forward', en: 'moving forward', ex: "Moving forward, let's sync every Monday.", kr: '앞으로는 매주 월요일에 맞춰 가요.', why: '"앞으로는"의 비즈니스 표준 — 과거를 탓하지 않고 다음을 정한다.' },
  ],
  4: [
    { key: 'circle-back', en: 'circle back', ex: "Let's circle back to pricing after the demo.", kr: '가격 얘기는 데모 후에 다시 돌아오죠.', why: '지금은 넘어가되 반드시 돌아온다는 약속 — 회의 진행의 관용구.' },
    { key: 'touch-on', en: 'touch on', ex: 'I want to briefly touch on security.', kr: '보안을 짧게 짚고 가겠습니다.', why: '깊이 들어가지 않고 "짚기만" 한다는 신호 — 시간 관리 표현.' },
    { key: 'same-page', en: 'on the same page', ex: 'I want to make sure we\'re on the same page.', kr: '서로 같은 그림을 보고 있는지 확인하고 싶어요.', why: '이해가 일치하는지 확인하는 관용구 — 오해를 예의 있게 점검.' },
    { key: 'ballpark', en: 'ballpark figure', ex: 'Can you give me a ballpark figure?', kr: '대략적인 금액이라도 알 수 있을까요?', why: '"정확 안 해도 된다"는 신호가 들어 있는 견적 질문 — 상대 부담을 던다.' },
    { key: 'move-needle', en: 'move the needle', ex: 'This feature could really move the needle.', kr: '이 기능이 지표를 실제로 움직일 수 있어요.', why: '"의미 있는 변화를 만든다"의 관용구 — 임팩트를 말할 때.' },
    { key: 'low-hanging', en: 'low-hanging fruit', ex: "Let's start with the low-hanging fruit.", kr: '쉽게 딸 수 있는 것부터 시작하죠.', why: '적은 노력·빠른 성과 항목 — 우선순위 논의의 단골 관용구.' },
    { key: 'ball-rolling', en: 'get the ball rolling', ex: "Let's get the ball rolling with a kickoff call.", kr: '킥오프 콜로 일단 시작해 보죠.', why: '"일단 굴리기 시작하자" — 시작의 부담을 낮추는 관용구.' },
    { key: 'in-the-loop', en: 'keep ... in the loop', ex: "I'll keep you in the loop on the rollout.", kr: '배포 진행 상황을 계속 공유드릴게요.', why: '"소식에서 빼놓지 않겠다" — 신뢰를 만드는 커뮤니케이션 약속.' },
  ],
  5: [
    { key: 'i-hear-you', en: 'I hear you, but ...', ex: "I hear you, but the timeline worries me.", kr: '말씀 이해해요, 다만 일정이 걱정돼요.', why: '반론 앞에 "들었다"를 먼저 — 상대를 무장해제시키는 원어민의 결.' },
    { key: 'to-be-fair', en: 'To be fair, ...', ex: 'To be fair, their offer has some merit.', kr: '공정하게 보면, 그쪽 제안도 일리는 있어요.', why: '반대편의 몫을 인정하며 균형을 잡는 뉘앙스 — 논의의 품격.' },
    { key: 'wouldnt-say', en: "I wouldn't say ...", ex: "I wouldn't say it's a dealbreaker.", kr: '결정적인 문제라고까지는 안 하겠어요.', why: '부정을 한 겹 감싸는 완곡 — no라고 말하지 않고 no의 강도를 조절.' },
    { key: 'worth-ing', en: 'It might be worth -ing', ex: 'It might be worth revisiting the scope.', kr: '범위를 다시 들여다볼 가치가 있을 것 같아요.', why: '제안을 명령이 아니라 "가치 판단"으로 — 밀지 않고 끄는 화법.' },
    { key: 'being-honest', en: "If I'm being honest, ...", ex: "If I'm being honest, we expected a better rate.", kr: '솔직히 말씀드리면, 더 나은 조건을 기대했어요.', why: '직설의 예고편 — 솔직함을 예의로 감싸는 원어민 프레임.' },
    { key: 'fair-point', en: "That's a fair point", ex: "That's a fair point — let me think about it.", kr: '좋은 지적이에요 — 생각해 볼게요.', why: '반론을 받아들이는 가장 우아한 한 문장 — 논쟁을 협력으로 바꾼다.' },
    { key: 'where-land', en: 'Where do we land on ...?', ex: 'Where do we land on the renewal terms?', kr: '갱신 조건은 어디로 정리됐죠?', why: '"결론이 어디에 착지했나" — 결정을 묻는 세련된 관용 화법.' },
    { key: 'happy-to', en: 'Happy to ...', ex: "Happy to walk your team through the setup.", kr: '팀에 설정 과정을 기꺼이 안내해 드릴게요.', why: 'I can보다 따뜻한 "기꺼이" — 호의를 표현의 결로 만드는 마무리.' },
  ],
};

/* ── 패턴 정착 기록 ── */

const PATTERN_KEY = 'va_maturity_patterns';

export function donePatterns(): string[] {
  return load<string[]>(PATTERN_KEY, []);
}

export function markPatternDone(key: string) {
  const done = donePatterns();
  if (!done.includes(key)) store(PATTERN_KEY, [...done, key]);
}

/* ── 성숙도 판정 (자동 승급) ── */

export interface MaturityState {
  stage: MaturityStage;
  /** 다음 단계 대비 진행도 0~1 (마지막 단계면 1) */
  progress: number;
  /** 승급 조건별 현황 — 화면 체크리스트용 */
  criteria: { label: string; now: number; need: number; ok: boolean }[];
  /** 이번 호출에서 승급이 일어났는가 (축하 연출용, 1회만 true) */
  promoted: boolean;
}

interface StoredMaturity {
  stage: number;
  reachedAt: string;
}

const STAGE_KEY = 'va_maturity';

function stageSignals(stageN: number) {
  const gse = getProfile().gse || 0;
  const ladders = ladderDoneCount();
  const stagePatternKeys = (STAGE_PATTERNS[stageN] || []).map((p) => p.key);
  const done = donePatterns();
  const patterns = stagePatternKeys.filter((k) => done.includes(k)).length;
  return { gse, ladders, patterns };
}

/** 정착된(box≥3) 원어민 표현 수 — 보조 지표(화면 표시용) */
export function settledNativeCount(): number {
  return load<WeakItem[]>('va_weak', []).filter((w) => (w.cat === '원어민' || w.lesson === 'ladder') && w.box >= 3).length;
}

/**
 * 현재 성숙도를 계산하고, 기준에 닿았으면 자동 승급해 고정한다.
 * 승급이 일어난 호출에서만 promoted=true — 호출부가 축하를 한 번만 틔우게.
 */
export function computeMaturity(): MaturityState {
  const stored = load<StoredMaturity | null>(STAGE_KEY, null);
  let stageN = Math.min(Math.max(stored?.stage || 1, 1), STAGES.length);
  let promoted = false;

  // 기준에 닿아 있으면 연쇄 승급 — 오래 쉬었다 돌아와도 한 번에 따라잡는다
  for (;;) {
    const st = STAGES[stageN - 1];
    if (!st.next) break;
    const s = stageSignals(stageN);
    const ok = s.gse >= st.next.gse && s.ladders >= st.next.ladders && s.patterns >= st.next.patterns;
    if (!ok) break;
    stageN += 1;
    promoted = true;
  }
  if (promoted || !stored) {
    store(STAGE_KEY, { stage: stageN, reachedAt: new Date().toISOString().slice(0, 10) } satisfies StoredMaturity);
  }

  const stage = STAGES[stageN - 1];
  if (!stage.next) {
    return { stage, progress: 1, criteria: [], promoted };
  }
  const s = stageSignals(stageN);
  const criteria = [
    { label: `실력 지수(GSE) ${stage.next.gse} 이상`, now: s.gse, need: stage.next.gse, ok: s.gse >= stage.next.gse },
    { label: `사다리 완주 ${stage.next.ladders}개`, now: s.ladders, need: stage.next.ladders, ok: s.ladders >= stage.next.ladders },
    { label: `${stage.name} 패턴 정착 ${stage.next.patterns}개`, now: s.patterns, need: stage.next.patterns, ok: s.patterns >= stage.next.patterns },
  ];
  const progress =
    criteria.reduce((acc, c) => acc + Math.min(1, c.now / c.need), 0) / criteria.length;
  return { stage, progress, criteria, promoted };
}

/** 사다리 생성에 넘길 단계 힌트 — 단계가 높을수록 위 단의 관용 강도를 올린다 */
export function ladderStyleHint(): string {
  const stored = load<StoredMaturity | null>(STAGE_KEY, null);
  const n = Math.min(Math.max(stored?.stage || 1, 1), STAGES.length);
  if (n <= 2) return '학습자는 아직 구어 전환 단계다. "원어민" 단도 과한 슬랭 없이 자연스러운 구어까지만.';
  if (n <= 4) return '학습자는 구동사·관용구를 익히는 단계다. "원어민" 단에 구동사와 비즈니스 관용구를 적극 살려라.';
  return '학습자는 뉘앙스를 다루는 단계다. "원어민" 단에 완곡·강조·톤 조절이 드러나는 표현을 써라.';
}
