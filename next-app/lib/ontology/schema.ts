/**
 * 학습 온톨로지 — 스키마와 분류 체계.
 *
 * 왜 필요한가(코드 리뷰 F2): 이 앱의 콘텐츠는 14개 모듈에 6가지 다른 모양으로
 * 흩어져 있었다(실전 코스·커리어 팩·일일 미션·세일즈 스크립트·패턴 스토리·몰입
 * 스토리·면접 프리셋·레슨 …). 각각이 자기만의 진행 키(va_course_seen, va_career_seen,
 * va_mission_done …)를 가졌고, 서로를 몰랐다. "비용 리뷰 미팅"을 코스에서 연습한
 * 사실을 미션도, 세션도, 면접도 알 수 없었다. 그래서 학습이 **이어지지 않았다** —
 * 매 화면이 처음부터 다시 시작했다.
 *
 * 온톨로지는 콘텐츠를 다시 쓰지 않는다. 기존 모듈 위에 **공통 어휘**를 얹는다:
 *
 *   Situation(상황)  ── 어디서 쓰는 영어인가. 2단 분류(예: 미팅 › 오프닝)
 *   Function(기능)   ── 무엇을 하는 말인가(요청·확인·거절·완충 …). 패턴의 축
 *   Pattern(패턴)    ── 원어민 패턴 40개(성숙도 5단계 × 8). 표현에서 자동 감지
 *   Expression(표현) ── 문장 한 줄(en/kr). 같은 문장은 출처가 달라도 한 노드
 *   Unit(회차)       ── 한 번에 배우는 단위(코스 시나리오 1편, 미션 1개, 패턴 1개 …)
 *   Track(트랙)      ── 회차의 순서 있는 묶음(코스 6트랙, 커리어 3트랙, 단계, 시리즈)
 *   Level(레벨)      ── CEFR
 *
 * 관계: Unit ∈ Track(순서) · Unit → Situation · Unit ⊃ Expression · Expression → Pattern
 *       · Pattern → Function · Unit/Pattern → Level · Unit ⇒ Unit(선수)
 *
 * 연속성은 이 관계 위에서 나온다 —
 *   회차별: 같은 Track의 다음 Unit                  (이어서 하기)
 *   상황별: 같은 Situation의 다른 출처 Unit         (미션에서 배운 걸 코스에서 다시)
 *   실전형: grounding(실제 메일·경력)이 있는 Unit   (2·3단계에서 우선)
 */
import type { Cefr } from '../cefr';
import type { Mode } from '../../components/NavBar';

/* ────────────── 상황 분류(2단) ────────────── */

export interface Situation {
  id: string;
  /** 상위 상황 id — 없으면 최상위 */
  parent?: string;
  name: string;
  icon?: string;
  desc?: string;
}

export const SITUATIONS: Situation[] = [
  /* 고객 미팅 */
  { id: 'meeting', name: '고객 미팅', icon: '🤝', desc: '대면·화상 미팅의 시작부터 마무리까지' },
  { id: 'meeting/opening', parent: 'meeting', name: '오프닝 · 아젠다' },
  { id: 'meeting/status', parent: 'meeting', name: '진행 상황 · 킥오프' },
  { id: 'meeting/discovery', parent: 'meeting', name: '디스커버리 · 질문' },
  { id: 'meeting/demo', parent: 'meeting', name: '데모 · 설명' },
  { id: 'meeting/discussion', parent: 'meeting', name: '의견 · 경청' },
  { id: 'meeting/closing', parent: 'meeting', name: '마무리 · 다음 단계' },
  /* 비용·FinOps */
  { id: 'finops', name: '비용 · FinOps', icon: '📊', desc: '월례 비용 리뷰, RI/SP, 빌링' },
  { id: 'finops/cost-review', parent: 'finops', name: '월간 비용 리뷰' },
  { id: 'finops/billing', parent: 'finops', name: '빌링 · 정산' },
  /* 계약·견적 */
  { id: 'deal', name: '계약 · 견적', icon: '📝', desc: '가격, 협상, 조건, 갱신' },
  { id: 'deal/pricing', parent: 'deal', name: '가격 · 견적' },
  { id: 'deal/negotiation', parent: 'deal', name: '협상 · 이견 조율' },
  { id: 'deal/renewal', parent: 'deal', name: '갱신 · QBR' },
  /* 기술 대응 */
  { id: 'support', name: '기술 대응 · 케어', icon: '🛠', desc: '장애, 에스컬레이션, 재발 방지' },
  { id: 'support/incident', parent: 'support', name: '장애 · 인시던트' },
  { id: 'support/escalation', parent: 'support', name: '에스컬레이션' },
  /* 제안·피치 */
  { id: 'proposal', name: '제안 · 피치', icon: '🚀', desc: '신사업 제안, 임원 브리핑, PoC' },
  { id: 'proposal/pitch', parent: 'proposal', name: '제안 · 프레젠테이션' },
  { id: 'proposal/exec-brief', parent: 'proposal', name: '임원 브리핑' },
  { id: 'proposal/poc', parent: 'proposal', name: 'PoC 설계 · 킥오프' },
  { id: 'proposal/cold-intro', parent: 'proposal', name: '콜드 인트로' },
  /* 관계·위기 */
  { id: 'relations', name: '관계 · 위기', icon: '🧯', desc: '사과, 이탈 방어, 정체 딜, 반대 의견' },
  { id: 'relations/apology', parent: 'relations', name: '사과 · 신뢰 회복' },
  { id: 'relations/winback', parent: 'relations', name: '이탈 방어 · 윈백' },
  { id: 'relations/stall', parent: 'relations', name: '정체된 딜 되살리기' },
  { id: 'relations/disagree', parent: 'relations', name: '반대 의견 말하기' },
  /* 연락·이메일 */
  { id: 'comms', name: '연락 · 이메일', icon: '📬', desc: '일정 조율, 후속 연락, 이메일 표현' },
  { id: 'comms/scheduling', parent: 'comms', name: '일정 조율' },
  { id: 'comms/followup', parent: 'comms', name: '후속 연락' },
  { id: 'comms/email-spoken', parent: 'comms', name: '이메일 표현을 말로' },
  { id: 'comms/handover', parent: 'comms', name: '인수인계' },
  /* 커리어 */
  { id: 'career', name: '커리어', icon: '🙋', desc: '자기소개, 면접, 네트워킹' },
  { id: 'career/self-intro', parent: 'career', name: '자기소개 · 커리어 스토리' },
  { id: 'career/interview', parent: 'career', name: '면접 (본 라운드)' },
  { id: 'career/hr-screen', parent: 'career', name: 'HR 스크리닝' },
  { id: 'career/networking', parent: 'career', name: '네트워킹' },
  /* 스몰토크·일상 */
  { id: 'daily', name: '스몰토크 · 일상', icon: '☕', desc: '가벼운 대화, 여행·생활 회화' },
  { id: 'daily/small-talk', parent: 'daily', name: '스몰토크' },
  { id: 'daily/life', parent: 'daily', name: '생활 · 여행 회화' },
  /* 기초 */
  { id: 'foundation', name: '기초 · 문법 · 발음', icon: '🧱', desc: 'CEFR 단계별 문법·발음 유닛' },
  { id: 'foundation/grammar', parent: 'foundation', name: '문법' },
  { id: 'foundation/pronunciation', parent: 'foundation', name: '발음' },
  /* 스토리 */
  { id: 'story', name: '몰입 스토리', icon: '📖', desc: '긴 영어를 끝까지 따라가는 지구력' },
];

export const SITUATION_BY_ID: Record<string, Situation> = Object.fromEntries(SITUATIONS.map((s) => [s.id, s]));

export function rootSituations(): Situation[] {
  return SITUATIONS.filter((s) => !s.parent);
}

export function childSituations(rootId: string): Situation[] {
  return SITUATIONS.filter((s) => s.parent === rootId);
}

export function rootOf(id: string): string {
  return SITUATION_BY_ID[id]?.parent || id;
}

/* ────────────── 언어 기능 ────────────── */

export interface LangFunction {
  id: string;
  name: string;
  desc: string;
}

export const FUNCTIONS: LangFunction[] = [
  { id: 'request', name: '요청', desc: '부탁하고 허락을 구한다' },
  { id: 'confirm', name: '확인', desc: '이해한 것을 되짚고 확인한다' },
  { id: 'clarify', name: '되묻기', desc: '못 들었거나 모를 때 다시 묻는다' },
  { id: 'agree', name: '동의 · 수용', desc: '제안을 받아들이고 공을 넘긴다' },
  { id: 'decline', name: '거절 · 완곡', desc: '부드럽게 거절하거나 단정을 눅인다' },
  { id: 'open', name: '열기', desc: '대화·미팅을 시작한다' },
  { id: 'close', name: '닫기', desc: '대화·미팅을 마무리한다' },
  { id: 'plan', name: '계획 · 방향', desc: '앞으로의 계획을 말한다' },
  { id: 'explain', name: '설명 · 전개', desc: '상황을 풀어 설명한다' },
  { id: 'followup', name: '후속 · 연결', desc: '다시 연락하고 흐름을 잇는다' },
  { id: 'organize', name: '정리 · 조율', desc: '정리하고 합의를 맞춘다' },
  { id: 'quantify', name: '수치 · 효과', desc: '규모와 효과를 말한다' },
  { id: 'transition', name: '전환', desc: '화제를 바꾸거나 단서를 단다' },
  { id: 'offer', name: '제안 · 의향', desc: '기꺼이 하겠다고 말한다' },
  { id: 'negotiate', name: '협상 · 입장', desc: '입장을 밝히고 접점을 찾는다' },
];

/** 패턴 → 기능. 성숙도 커리큘럼의 40개 패턴이 무슨 말을 하는 도구인지. */
export const PATTERN_FUNCTIONS: Record<string, string[]> = {
  'id-like': ['request'], 'could-you': ['request'], 'get-back': ['followup', 'confirm'], 'didnt-catch': ['clarify'],
  'just-to-confirm': ['confirm'], 'that-works': ['agree'], 'im-afraid': ['decline'], 'thanks-time': ['close'],
  'looking-to': ['plan'], 'turns-out': ['explain'], 'thing-is': ['explain', 'negotiate'], 'wondering-if': ['request'],
  'do-you-mind': ['request'], 'kind-of': ['decline'], 'touch-base': ['followup'], 'how-sound': ['agree', 'offer'],
  'run-through': ['explain'], 'go-over': ['explain'], 'follow-up-on': ['followup'], 'sort-out': ['organize'],
  'put-together': ['organize'], 'reach-out': ['followup'], 'that-said': ['transition'], 'moving-forward': ['plan'],
  'circle-back': ['followup'], 'touch-on': ['transition'], 'same-page': ['organize', 'confirm'], 'ballpark': ['quantify'],
  'move-needle': ['quantify'], 'low-hanging': ['quantify', 'plan'], 'ball-rolling': ['open', 'plan'], 'in-the-loop': ['followup'],
  'i-hear-you': ['negotiate', 'decline'], 'to-be-fair': ['transition', 'negotiate'], 'wouldnt-say': ['decline'],
  'worth-ing': ['offer', 'plan'], 'being-honest': ['negotiate'], 'fair-point': ['agree'], 'where-land': ['negotiate'], 'happy-to': ['offer'],
};

/* ────────────── 노드 ────────────── */

export type UnitSource = 'course' | 'career' | 'mission' | 'script' | 'pattern' | 'story' | 'interview' | 'lesson' | 'library' | 'grammar';

/** 화면이 이 유닛을 바로 열 수 있게 넘기는 참조 */
export interface UnitRef {
  source: UnitSource;
  /** 출처 모듈의 원래 식별자(코스 시나리오 id, 미션 key, 패턴 key, 에피소드 no, 레슨 id …) */
  key: string;
  /** 트랙 식별자(코스/커리어 트랙 id 등) — 화면이 접힌 트랙을 펼치는 데 쓴다 */
  track?: string;
}

export interface Unit {
  id: string;
  source: UnitSource;
  title: string;
  subtitle?: string;
  situations: string[];
  patterns: string[];
  /** Expression id */
  expressions: string[];
  level: Cefr;
  track: string;
  /** 트랙 안 순서(0부터) */
  order: number;
  /** 실제 데이터(메일·경력·JD)에서 온 실전형인가 */
  real: boolean;
  grounding?: string;
  mode: Mode;
  ref: UnitRef;
  /** 대략의 소요 시간 */
  minutes: number;
  /** 선수 유닛 id(있으면) */
  requires?: string[];
}

export type TrackKind = '회차' | '상황' | '실전';

export interface Track {
  id: string;
  name: string;
  icon: string;
  source: UnitSource;
  kind: TrackKind;
  desc?: string;
  unitIds: string[];
}

export interface Expression {
  id: string;
  en: string;
  kr: string;
  unitIds: string[];
  patterns: string[];
  situations: string[];
}

export interface PatternNode {
  key: string;
  en: string;
  ex: string;
  kr: string;
  stage: number;
  level: Cefr;
  functions: string[];
  unitIds: string[];
  expressionIds: string[];
}

export interface Graph {
  units: Unit[];
  tracks: Track[];
  expressions: Expression[];
  patterns: PatternNode[];
  unitById: Record<string, Unit>;
  trackById: Record<string, Track>;
  expressionById: Record<string, Expression>;
  patternByKey: Record<string, PatternNode>;
  /** situation id(하위) → unit ids */
  unitsBySituation: Record<string, string[]>;
  /** 빌드 시점에 레슨 데이터가 포함됐는가 */
  hasLessons: boolean;
}
