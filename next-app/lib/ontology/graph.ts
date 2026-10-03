/**
 * 그래프 빌더 — 기존 콘텐츠 모듈을 온톨로지 노드로 옮기는 어댑터 모음.
 *
 * 원칙: 콘텐츠는 손대지 않는다. 각 어댑터는 원본 모듈을 읽어 Unit/Track/Expression을
 * 만들고, 상황 태그는 이 파일의 매핑 표에서 붙인다. 원본에 항목이 늘면(AI가 만든
 * 코스 시나리오, 새 몰입 에피소드) 다음 빌드에서 자동으로 그래프에 들어온다.
 *
 * 레슨(lessons.json 380KB)은 비동기 청크라 항상 있는 게 아니다 — 있으면 넣고,
 * 없으면 빼고 빌드한다(hasLessons). 홈처럼 가벼워야 하는 곳은 레슨 없이 쓴다.
 */
import type { Cefr } from '../cefr';
import { STAGE_PATTERNS, STAGES } from '../maturity';
import { getMergedTracks } from '../realCourse';
import { getCareerTracks } from '../careerPack';
import { BUSINESS_MISSIONS } from '../dailyMission';
import { SALES_SCENARIOS } from '../salesScenarios';
import { getEpisodes, SERIES_TITLE } from '../immersion';
import { WORKATO_QUESTIONS, WORKATO_HR_QUESTIONS } from '../workatoPrep';
import { DEFAULT_QUESTIONS } from '../interview';
import { GRAMMAR_UNITS, GRAMMAR_LEVELS } from '../grammar';
import type { LessonData } from '../lessonData';
import type { Lesson } from '../lessons';
import { detectPatterns } from './patternDetect';
import { PATTERN_FUNCTIONS, type Expression, type Graph, type PatternNode, type Track, type Unit, type UnitSource } from './schema';

/* ────────────── 상황 매핑 표 ────────────── */

const COURSE_TRACK_SIT: Record<string, string> = {
  finops: 'finops/cost-review',
  deal: 'deal/negotiation',
  care: 'support/incident',
  pitch: 'proposal/pitch',
  billing: 'finops/billing',
  relations: 'relations/winback',
};

const CAREER_TRACK_SIT: Record<string, string> = {
  intro: 'career/self-intro',
  interview: 'career/interview',
  network: 'career/networking',
};

const MISSION_SIT: Record<string, string> = {
  kickoff: 'meeting/opening', 'status-update': 'meeting/status', demo: 'meeting/demo', objection: 'deal/negotiation',
  pricing: 'deal/pricing', scheduling: 'comms/scheduling', followup: 'comms/followup', presentation: 'proposal/pitch',
  opinion: 'meeting/discussion', 'small-talk': 'daily/small-talk', apology: 'relations/apology',
  'email-spoken': 'comms/email-spoken', negotiation: 'deal/negotiation', 'renewal-qbr': 'deal/renewal',
  escalation: 'support/escalation', networking: 'career/networking', 'cold-intro': 'proposal/cold-intro',
  'exec-brief': 'proposal/exec-brief', 'poc-kickoff': 'proposal/poc', closing: 'meeting/closing',
  stall: 'relations/stall', 'active-listening': 'meeting/discussion', handover: 'comms/handover', disagree: 'relations/disagree',
};

const SCRIPT_SIT: Record<string, string> = {
  opening: 'meeting/opening', thanks: 'meeting/opening', agenda: 'meeting/opening', time: 'meeting/opening',
  discovery: 'meeting/discovery', setup: 'meeting/discovery', pain: 'meeting/discovery', impact: 'meeting/discovery',
  decision: 'meeting/discovery', summary: 'meeting/discovery',
  architecture: 'meeting/demo', highlevel: 'meeting/demo', plain: 'meeting/demo', link: 'meeting/demo', tradeoff: 'meeting/demo', check: 'meeting/demo',
  objection: 'deal/negotiation', acknowledge: 'deal/negotiation', compare: 'deal/negotiation', reframe: 'deal/negotiation', trade: 'deal/negotiation', respect: 'deal/negotiation',
  poc: 'proposal/poc', frame: 'proposal/poc', scope: 'proposal/poc', duration: 'proposal/poc', criteria: 'proposal/poc', next: 'proposal/poc',
  exec: 'proposal/exec-brief', headline: 'proposal/exec-brief', numbers: 'proposal/exec-brief', hedge: 'proposal/exec-brief', ask: 'proposal/exec-brief',
  renewal: 'deal/renewal', incident: 'support/incident', 'kickoff-project': 'meeting/status',
};

/** 마스터 레슨 — 기본은 문법, 제목으로 특수 상황을 잡는다 */
function lessonSituation(l: Lesson): string {
  const t = l.title || '';
  if (/발음/.test(t)) return 'foundation/pronunciation';
  if (/자기소개|인사/.test(t)) return 'career/self-intro';
  if (/스몰토크|문화/.test(t)) return 'daily/small-talk';
  if (/여행|길 찾기|식당|카페/.test(t)) return 'daily/life';
  if (/발표|프레젠테이션/.test(t)) return 'proposal/pitch';
  if (/협상|헤징/.test(t)) return 'deal/negotiation';
  if (/토론|의견/.test(t)) return 'meeting/discussion';
  if (/인터뷰/.test(t)) return 'career/interview';
  return 'foundation/grammar';
}

/** 기능 → 기본 상황(패턴이 실전 콘텐츠에서 아직 감지되지 않았을 때) */
const FUNCTION_HOME: Record<string, string> = {
  request: 'meeting/discussion', confirm: 'meeting/discussion', clarify: 'meeting/discussion', agree: 'comms/scheduling',
  decline: 'deal/negotiation', negotiate: 'deal/negotiation', open: 'meeting/opening', close: 'meeting/closing',
  plan: 'proposal/exec-brief', quantify: 'proposal/exec-brief', explain: 'meeting/demo', followup: 'comms/followup',
  organize: 'meeting/status', transition: 'meeting/discussion', offer: 'comms/followup',
};

/* ────────────── 유틸 ────────────── */

function normEn(en: string): string {
  return en.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 짧은 결정적 id — 같은 문장은 출처가 달라도 같은 노드 */
function exprId(en: string): string {
  const s = normEn(en);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `x${(h >>> 0).toString(36)}`;
}

const STAGE_LEVEL: Record<number, Cefr> = Object.fromEntries(STAGES.map((s) => [s.n, s.cefr])) as Record<number, Cefr>;

class Builder {
  units: Unit[] = [];
  tracks: Track[] = [];
  expressions = new Map<string, Expression>();
  patterns = new Map<string, PatternNode>();

  constructor() {
    for (const [stage, list] of Object.entries(STAGE_PATTERNS)) {
      for (const p of list) {
        this.patterns.set(p.key, {
          key: p.key, en: p.en, ex: p.ex, kr: p.kr, stage: Number(stage), level: STAGE_LEVEL[Number(stage)] || 'B1',
          functions: PATTERN_FUNCTIONS[p.key] || [], unitIds: [], expressionIds: [],
        });
      }
    }
  }

  track(t: Omit<Track, 'unitIds'>): Track {
    const tr: Track = { ...t, unitIds: [] };
    this.tracks.push(tr);
    return tr;
  }

  unit(u: Omit<Unit, 'expressions' | 'patterns' | 'order'> & { lines: { en: string; kr: string }[] }, track: Track): Unit {
    const exprIds: string[] = [];
    const pats = new Set<string>();
    for (const line of u.lines) {
      if (!line.en || !line.en.trim()) continue;
      const id = exprId(line.en);
      let x = this.expressions.get(id);
      if (!x) {
        x = { id, en: line.en.trim(), kr: line.kr || '', unitIds: [], patterns: detectPatterns(line.en), situations: [] };
        this.expressions.set(id, x);
      }
      if (!x.unitIds.includes(u.id)) x.unitIds.push(u.id);
      for (const s of u.situations) if (!x.situations.includes(s)) x.situations.push(s);
      if (!exprIds.includes(id)) exprIds.push(id);
      for (const pk of x.patterns) {
        pats.add(pk);
        const pn = this.patterns.get(pk);
        if (pn && !pn.expressionIds.includes(id)) pn.expressionIds.push(id);
      }
    }
    const { lines: _lines, ...rest } = u;
    void _lines;
    const unit: Unit = { ...rest, expressions: exprIds, patterns: [...pats], order: track.unitIds.length };
    for (const pk of unit.patterns) {
      const pn = this.patterns.get(pk);
      if (pn && !pn.unitIds.includes(unit.id)) pn.unitIds.push(unit.id);
    }
    this.units.push(unit);
    track.unitIds.push(unit.id);
    return unit;
  }
}

/* ────────────── 어댑터 ────────────── */

function addCourse(b: Builder, source: 'course' | 'career') {
  const tracks = source === 'course' ? getMergedTracks() : getCareerTracks();
  const sitMap = source === 'course' ? COURSE_TRACK_SIT : CAREER_TRACK_SIT;
  const mode = source === 'course' ? 'course' : 'career';
  for (const t of tracks) {
    const tr = b.track({ id: `${source}:${t.id}`, name: t.title, icon: t.icon, source, kind: '실전', desc: t.why });
    t.scenarios.forEach((s, i) => {
      const sit = sitMap[t.id] || 'meeting/discussion';
      const prev = i > 0 ? `${source}:${t.scenarios[i - 1].id}` : undefined;
      b.unit(
        {
          id: `${source}:${s.id}`, source, title: s.title, subtitle: s.situation, situations: [sit],
          level: source === 'career' ? 'B2' : 'B1', track: tr.id, real: true, grounding: s.grounding, mode,
          ref: { source, key: s.id, track: t.id }, minutes: 8, requires: prev ? [prev] : undefined,
          lines: [...s.dialogue.lines.map((l) => ({ en: l.en, kr: l.kr })), ...s.expressions],
        },
        tr
      );
    });
  }
}

function addMissions(b: Builder) {
  const tr = b.track({ id: 'mission', name: '비즈니스 미션', icon: '🎯', source: 'mission', kind: '상황', desc: '상황 하나 = 표현 5개 + 대화 + AI 롤플레이' });
  for (const m of BUSINESS_MISSIONS) {
    b.unit(
      {
        id: `mission:${m.key}`, source: 'mission', title: m.title, subtitle: m.goal, situations: [MISSION_SIT[m.key] || 'meeting/discussion'],
        level: 'B1', track: tr.id, real: false, mode: 'master', ref: { source: 'mission', key: m.key }, minutes: 10,
        lines: [...m.phrases, ...m.dialogue.lines.map((l) => ({ en: l.en, kr: l.kr }))],
      },
      tr
    );
  }
}

function addScripts(b: Builder) {
  const tr = b.track({ id: 'script', name: '세일즈 스크립트', icon: '📜', source: 'script', kind: '상황', desc: '미팅 단계별 대본 — 흐름을 지키는 훈련' });
  for (const s of SALES_SCENARIOS) {
    b.unit(
      {
        id: `script:${s.key}`, source: 'script', title: s.label, subtitle: s.situation, situations: [SCRIPT_SIT[s.key] || 'meeting/discussion'],
        level: 'B2', track: tr.id, real: false, mode: 'scripts', ref: { source: 'script', key: s.key }, minutes: 6,
        lines: [...s.steps.flatMap((st) => st.lines.map((l) => ({ en: l.en, kr: l.kr }))), ...s.dialogue.map((l) => ({ en: l.en, kr: l.kr }))],
      },
      tr
    );
  }
}

/** 원어민 패턴 — 단계가 곧 트랙(회차). 이전 단계 패턴이 선수. */
function addPatterns(b: Builder) {
  let prevTrack: Track | null = null;
  for (const st of STAGES) {
    const tr = b.track({ id: `stage:${st.n}`, name: `${st.n}단계 · ${st.name}`, icon: '🪜', source: 'pattern', kind: '회차', desc: st.motto });
    const list = STAGE_PATTERNS[st.n] || [];
    for (const p of list) {
      const fns = PATTERN_FUNCTIONS[p.key] || [];
      // 패턴은 상황이 아니라 기능의 축 — 상황은 이 패턴이 실제로 쓰인 유닛에서 역으로 붙는다(finalize)
      b.unit(
        {
          id: `pattern:${p.key}`, source: 'pattern', title: p.en, subtitle: p.why, situations: [],
          level: st.cefr, track: tr.id, real: false, mode: 'session', ref: { source: 'pattern', key: p.key, track: String(st.n) }, minutes: 10,
          requires: prevTrack ? prevTrack.unitIds.slice(0, 1) : undefined,
          lines: [{ en: p.ex, kr: p.kr }],
        },
        tr
      );
      void fns;
    }
    prevTrack = tr;
  }
}

function addStories(b: Builder) {
  const eps = getEpisodes();
  if (!eps.length) return;
  const tr = b.track({ id: 'story', name: SERIES_TITLE, icon: '📖', source: 'story', kind: '회차', desc: '무한 연재 몰입 스토리' });
  eps.forEach((ep, i) => {
    b.unit(
      {
        id: `story:${ep.no}`, source: 'story', title: `${ep.no}화 · ${ep.titleKr}`, subtitle: ep.title, situations: ['story'],
        level: (ep.level as Cefr) || 'A2', track: tr.id, real: false, mode: 'immersion', ref: { source: 'story', key: String(ep.no) }, minutes: 8,
        requires: i > 0 ? [`story:${eps[i - 1].no}`] : undefined,
        lines: ep.sentences,
      },
      tr
    );
  });
}

function addInterviews(b: Builder) {
  const tr = b.track({ id: 'interview', name: '면접 시뮬레이션', icon: '🎤', source: 'interview', kind: '실전', desc: 'HR 스크리닝 → 본 라운드 → 일반' });
  b.unit(
    {
      id: 'interview:workato-hr', source: 'interview', title: 'Workato HR 스크리닝', subtitle: '30~45분 Zoom · TA 파트너', situations: ['career/hr-screen'],
      level: 'B2', track: tr.id, real: true, grounding: 'Workato TA 초대 메일 + EAE JD', mode: 'interview', ref: { source: 'interview', key: 'workato-hr' }, minutes: 20,
      lines: WORKATO_HR_QUESTIONS.flatMap((q) => [{ en: q.q, kr: q.qKr }, ...(q.guide.sample ? [q.guide.sample] : [])]),
    },
    tr
  );
  b.unit(
    {
      id: 'interview:workato', source: 'interview', title: 'Workato EAE 본 라운드', subtitle: 'JD 기반 심층 10문항', situations: ['career/interview'],
      level: 'C1', track: tr.id, real: true, grounding: 'Workato Enterprise AE JD + GitLab 최종 면접 스크립트', mode: 'interview', ref: { source: 'interview', key: 'workato' }, minutes: 25,
      requires: ['interview:workato-hr'],
      lines: WORKATO_QUESTIONS.flatMap((q) => [{ en: q.q, kr: q.qKr }, ...(q.guide.sample ? [q.guide.sample] : [])]),
    },
    tr
  );
  b.unit(
    {
      id: 'interview:general', source: 'interview', title: '일반 글로벌 포지션', subtitle: 'CS/AM 단골 5문항', situations: ['career/interview'],
      level: 'B2', track: tr.id, real: false, mode: 'interview', ref: { source: 'interview', key: 'general' }, minutes: 15,
      lines: DEFAULT_QUESTIONS.map((q) => ({ en: q.q, kr: q.qKr })),
    },
    tr
  );
}

/** 문법 시뮬레이션 — 레벨이 트랙(회차), 유닛은 그 문법이 필요한 실전 상황에 붙는다 */
function addGrammar(b: Builder) {
  for (const lv of GRAMMAR_LEVELS) {
    const units = GRAMMAR_UNITS.filter((u) => u.level === lv);
    if (!units.length) continue;
    const tr = b.track({ id: `grammar:${lv}`, name: `${lv} 문법`, icon: '🧠', source: 'grammar', kind: '회차', desc: '문법 사고 × 실전 시뮬레이션' });
    units.forEach((u, i) => {
      b.unit(
        {
          id: `grammar:${u.id}`, source: 'grammar', title: u.title, subtitle: u.point, situations: [u.sit],
          level: u.level, track: tr.id, real: false, mode: 'grammar', ref: { source: 'grammar', key: u.id }, minutes: 8,
          requires: i > 0 ? [`grammar:${units[i - 1].id}`] : undefined,
          lines: [
            ...u.think.ex.map(([en, kr]) => ({ en, kr })),
            ...u.sim.turns.map((t) => ({ en: t.them, kr: t.kr })),
          ],
        },
        tr
      );
    });
  }
}

function addLessons(b: Builder, data: LessonData) {
  // 회차 레슨(Preply 수업) — 날짜 순 회차
  const cls = b.track({ id: 'preply', name: '회차 레슨', icon: '🎓', source: 'lesson', kind: '회차', desc: '진옥 선생님 수업 회차' });
  for (const l of data.LESSONS) {
    b.unit(
      {
        id: `lesson:${l.id}`, source: 'lesson', title: l.title || `${l.id}회차`, subtitle: l.date, situations: [lessonSituation(l)],
        level: 'A2', track: cls.id, real: false, mode: 'study', ref: { source: 'lesson', key: String(l.id) }, minutes: 12,
        lines: (l.examples || []).map((e) => ({ en: e.en, kr: e.kr })),
      },
      cls
    );
  }
  // 마스터 유닛 — CEFR 레벨이 트랙
  const byLevel = new Map<string, Track>();
  for (const l of data.MASTER_LESSONS) {
    const lv = (l.master || 'B1') as Cefr;
    let tr = byLevel.get(lv);
    if (!tr) {
      tr = b.track({ id: `level:${lv}`, name: `CEFR ${lv} 유닛`, icon: '🧱', source: 'lesson', kind: '회차', desc: '문법·발음 기초 단계' });
      byLevel.set(lv, tr);
    }
    b.unit(
      {
        id: `lesson:${l.id}`, source: 'lesson', title: l.title || String(l.id), situations: [lessonSituation(l)],
        level: lv, track: tr.id, real: false, mode: 'study', ref: { source: 'lesson', key: String(l.id) }, minutes: 12,
        lines: (l.examples || []).map((e) => ({ en: e.en, kr: e.kr })),
      },
      tr
    );
  }
  // 시나리오 라이브러리 — 생활 회화
  const lib = b.track({ id: 'library', name: '생활 회화 라이브러리', icon: '🧳', source: 'library', kind: '상황', desc: '공항·호텔·식당 …' });
  for (const l of data.SCENARIO_LIBRARY) {
    const lines = l.dialogue?.lines || [];
    b.unit(
      {
        id: `library:${l.id}`, source: 'library', title: l.dialogue?.title || l.category || String(l.id), subtitle: l.category, situations: ['daily/life'],
        level: 'A2', track: lib.id, real: false, mode: 'study', ref: { source: 'library', key: String(l.id) }, minutes: 8,
        lines: lines.map((x) => ({ en: x.en, kr: x.kr })),
      },
      lib
    );
  }
}

/* ────────────── 빌드 ────────────── */

/** 패턴 유닛의 상황 = 그 패턴이 실제로 쓰인 유닛들의 상황(역방향 전파) */
function finalize(b: Builder): Graph {
  const unitById: Record<string, Unit> = Object.fromEntries(b.units.map((u) => [u.id, u]));
  for (const pn of b.patterns.values()) {
    const pu = unitById[`pattern:${pn.key}`];
    if (!pu) continue;
    const sits = new Set<string>();
    for (const uid of pn.unitIds) {
      if (uid === pu.id) continue;
      for (const s of unitById[uid]?.situations || []) sits.add(s);
    }
    // 실전 콘텐츠에 아직 안 나온 패턴은 기능으로 기본 상황을 준다(그래프에 고아를 두지 않는다)
    if (!sits.size) for (const f of pn.functions) if (FUNCTION_HOME[f]) sits.add(FUNCTION_HOME[f]);
    pu.situations = [...sits].slice(0, 6);
  }
  const unitsBySituation: Record<string, string[]> = {};
  for (const u of b.units) for (const s of u.situations) (unitsBySituation[s] ||= []).push(u.id);
  return {
    units: b.units,
    tracks: b.tracks,
    expressions: [...b.expressions.values()],
    patterns: [...b.patterns.values()],
    unitById,
    trackById: Object.fromEntries(b.tracks.map((t) => [t.id, t])),
    expressionById: Object.fromEntries([...b.expressions.values()].map((x) => [x.id, x])),
    patternByKey: Object.fromEntries([...b.patterns.values()].map((p) => [p.key, p])),
    unitsBySituation,
    hasLessons: false,
  };
}

export interface BuildOptions {
  /** 레슨 데이터(있을 때만) */
  lessons?: LessonData | null;
}

export function buildGraph(opts: BuildOptions = {}): Graph {
  const b = new Builder();
  addPatterns(b);
  addCourse(b, 'course');
  addCourse(b, 'career');
  addMissions(b);
  addScripts(b);
  addStories(b);
  addInterviews(b);
  addGrammar(b);
  if (opts.lessons) addLessons(b, opts.lessons);
  const g = finalize(b);
  g.hasLessons = !!opts.lessons;
  return g;
}

/* ── 모듈 캐시 — 그래프는 콘텐츠가 바뀔 때(에피소드 생성·코스 갱신)만 다시 만든다 ── */
let cached: { g: Graph; sig: string } | null = null;

function signature(opts: BuildOptions): string {
  // 저장소에 따라 달라지는 부분만 서명에 — 에피소드 수·코스 추가분·레슨 포함 여부
  let extra = 0;
  try {
    extra = getMergedTracks().reduce((n, t) => n + t.scenarios.length, 0);
  } catch {
    /* 서버/테스트 */
  }
  let eps = 0;
  try {
    eps = getEpisodes().length;
  } catch {
    /* 서버/테스트 */
  }
  return `${extra}:${eps}:${opts.lessons ? 1 : 0}`;
}

export function getGraph(opts: BuildOptions = {}): Graph {
  const sig = signature(opts);
  if (cached && cached.sig === sig) return cached.g;
  const g = buildGraph(opts);
  cached = { g, sig };
  return g;
}

export function invalidateGraph() {
  cached = null;
}

export function sourceLabel(s: UnitSource): string {
  return { course: '실전 코스', career: '커리어', mission: '미션', script: '스크립트', pattern: '패턴', story: '스토리', interview: '면접', lesson: '레슨', library: '생활 회화', grammar: '문법' }[s];
}
