/**
 * 소리 커리큘럼(8주) + HVPT 식별 상태 — 발음 진단이 쌓는 혼동축을 '계획된 순서'로 소비한다.
 *
 * 진단(lib/pronunciation.ts)은 어떤 축이 어긋났는지 말해 주지만, 그걸 매일 어떤 순서로
 * 훈련할지는 정하지 않는다. 여기서는 기능 부하(functional load)가 큰 축부터 — 즉 뜻을
 * 가장 자주 가르는 소리부터 — 한 주에 한 축씩 배치한다. 근거:
 *   · Catford/Brown FL 순위: r/l·f/p·v/b·어말 자음은 높고 th는 뜻을 가르는 짝이 적다.
 *   · Munro & Derwing: 고FL 오류 1개가 저FL 오류 2~3개보다 이해도를 더 깎는다.
 *   · HVPT(고변이 음성 훈련, Bradlow 등): 여러 목소리로 2택 식별을 반복하면 지각이
 *     먼저 바뀌고 산출이 따라온다(효과 크기 g 0.67~0.92). 자극은 단어 단독이 아니라
 *     **캐리어 문장**(그 단어만 다른 두 문장)으로 합성해 TTS가 r/l·f/p를 뭉개는
 *     위험을 줄인다.
 *   · 한국어 화자 특유의 어말 자음 뒤 ㅡ 삽입(bus → 버스, school → 스쿨)은 음절 수를
 *     늘려 다른 단어로 들리게 하므로 1주차에 둔다(Hadar Shemesh·Barrass).
 *
 * 저장은 localStorage `va_sound_track` 하나. M7(디코더)의 decoderSeen·decoder 필드와
 * 같은 객체를 쓰므로 **필드 단위로만 갱신**한다(통째로 덮어쓰면 서로 지운다).
 * 화면 배선은 하지 않는다 — 카드(HvptCard)·진도(SoundAxisCard)가 이 함수들을 부른다.
 */
import type { LapseKey } from './pronunciation';
import { allPairs, pairsFor } from './minimalPairs';
import { load, store } from './state';
import { dateKey, daysBetween, todayKey } from './dates';

export const SOUND_TRACK_KEY = 'va_sound_track';

export interface WeekPlan {
  /** 1~8 */
  week: number;
  /** 이 주에 훈련하는 혼동축(복수면 번갈아) */
  axes: LapseKey[];
  /** 카드 제목에 쓰는 짧은 이름 */
  label: string;
  /** 한국어 화자에게 바로 통하는 한 줄 힌트 */
  krHint: string;
}

/**
 * 8주 계획 — 기능 부하 높은 순. 9주차부터는 1주차로 돌아가 반복한다(weekOf 참고).
 * 8주차 '복습'은 앞 7주의 축을 모두 담는다(HVPT 문항이 축을 돌아가며 뽑는다).
 */
export const WEEK_PLAN: WeekPlan[] = [
  {
    week: 1,
    axes: ['final-consonant'],
    label: '어말 자음 · ㅡ 삽입',
    krHint: 'bus는 버스(2박자)가 아니라 bus(1박자). 끝 자음 뒤에 으를 붙이지 않습니다.',
  },
  {
    week: 2,
    axes: ['r-l'],
    label: 'R / L',
    krHint: 'R은 혀끝이 어디에도 닿지 않고, L은 윗니 뒤 잇몸에 붙입니다. collect와 correct는 다른 말입니다.',
  },
  {
    week: 3,
    axes: ['f-p', 'v-b'],
    label: 'F / P · V / B',
    krHint: '윗니를 아랫입술에 대고 바람을 흘리면 F·V, 입술을 붙였다 터뜨리면 P·B. coffee가 copy가 되지 않게.',
  },
  {
    week: 4,
    axes: ['vowel-long', 'vowel-ae-e'],
    label: '모음 /ɪ/-/i/ · /æ/-/ɛ/',
    krHint: 'seat는 입을 옆으로 길게, sit은 짧게 힘을 빼고. bad는 턱을 더 내리고 bed는 짧은 에.',
  },
  {
    week: 5,
    axes: ['voicing', 'z-s'],
    label: '유성 · 무성 (Z / S)',
    krHint: '목에 손을 대고 떨림을 확인하세요. rise와 rice, bag과 back은 성대 울림으로 갈립니다.',
  },
  {
    week: 6,
    axes: ['th'],
    label: 'TH',
    krHint: '혀끝을 윗니 사이로 살짝 내밀고 바람을 냅니다. three가 tree로 들리지 않게.',
  },
  {
    week: 7,
    axes: ['sh-s', 'ch-j'],
    label: 'SH / S · CH / J',
    krHint: 'SH·CH는 입술을 앞으로 동그랗게 내밀고 혀를 뒤로. she와 see, cheap과 jeep.',
  },
  {
    week: 8,
    axes: ['final-consonant', 'r-l', 'f-p', 'v-b', 'vowel-long', 'vowel-ae-e', 'voicing', 'z-s', 'th', 'sh-s', 'ch-j'],
    label: '복습',
    krHint: '7주 동안 다룬 소리를 섞어서 듣습니다. 자주 틀린 축이 먼저 나옵니다.',
  },
];

export interface CarrierSide {
  word: string;
  en: string;
  kr: string;
}

/** 캐리어 문장 쌍 — 두 문장은 그 단어 하나만 다르다. HVPT 2택 식별의 자극. */
export interface Carrier {
  axis: LapseKey;
  a: CarrierSide;
  b: CarrierSide;
}

/**
 * 12쌍 × 2 = 24문장. 상위 두 축(어말 자음·R/L) 위주에 F/P·V/B를 더했다.
 * 10단어 이하, IT 영업·일상 어휘(A1/A2). 두 문장이 단어 하나만 다른 것은
 * 테스트가 보장한다(tests/unit/soundTrack.test.ts).
 */
export const CARRIERS: Carrier[] = [
  // 어말 자음(유성/무성·ㅡ 삽입)
  {
    axis: 'final-consonant',
    a: { word: 'back', en: 'Please put it in the back.', kr: '뒤쪽에 넣어 주세요.' },
    b: { word: 'bag', en: 'Please put it in the bag.', kr: '가방에 넣어 주세요.' },
  },
  {
    axis: 'final-consonant',
    a: { word: 'card', en: 'Put it on the card, please.', kr: '카드로 결제해 주세요.' },
    b: { word: 'cart', en: 'Put it on the cart, please.', kr: '카트에 올려 주세요.' },
  },
  {
    axis: 'final-consonant',
    a: { word: 'lock', en: 'Did you check the lock?', kr: '잠금장치 확인하셨어요?' },
    b: { word: 'log', en: 'Did you check the log?', kr: '로그 확인하셨어요?' },
  },
  {
    axis: 'final-consonant',
    a: { word: 'site', en: "Let's check the site first.", kr: '먼저 사이트를 확인하시죠.' },
    b: { word: 'side', en: "Let's check the side first.", kr: '먼저 옆면을 확인하시죠.' },
  },
  // R / L
  {
    axis: 'r-l',
    a: { word: 'collect', en: 'We need to collect the data today.', kr: '오늘 데이터를 수집해야 합니다.' },
    b: { word: 'correct', en: 'We need to correct the data today.', kr: '오늘 데이터를 바로잡아야 합니다.' },
  },
  {
    axis: 'r-l',
    a: { word: 'right', en: 'Please check the right one.', kr: '오른쪽 것을 확인해 주세요.' },
    b: { word: 'light', en: 'Please check the light one.', kr: '가벼운 것을 확인해 주세요.' },
  },
  {
    axis: 'r-l',
    a: { word: 'wrong', en: 'That was a wrong call.', kr: '그건 잘못된 판단이었습니다.' },
    b: { word: 'long', en: 'That was a long call.', kr: '긴 통화였습니다.' },
  },
  {
    axis: 'r-l',
    a: { word: 'cloud', en: 'We saw a big cloud today.', kr: '오늘 큰 구름을 봤습니다.' },
    b: { word: 'crowd', en: 'We saw a big crowd today.', kr: '오늘 큰 인파를 봤습니다.' },
  },
  // F / P
  {
    axis: 'f-p',
    a: { word: 'coffee', en: 'Can I get a coffee, please?', kr: '커피 한 잔 주시겠어요?' },
    b: { word: 'copy', en: 'Can I get a copy, please?', kr: '사본 하나 주시겠어요?' },
  },
  {
    axis: 'f-p',
    a: { word: 'file', en: 'Just put it in the file.', kr: '파일에 넣어 두세요.' },
    b: { word: 'pile', en: 'Just put it in the pile.', kr: '더미에 올려 두세요.' },
  },
  // V / B
  {
    axis: 'v-b',
    a: { word: 'vote', en: 'They talked about the vote.', kr: '그들은 표결 이야기를 했습니다.' },
    b: { word: 'boat', en: 'They talked about the boat.', kr: '그들은 배 이야기를 했습니다.' },
  },
  {
    axis: 'v-b',
    a: { word: 'curve', en: 'Look at the curve on the left.', kr: '왼쪽 곡선을 보세요.' },
    b: { word: 'curb', en: 'Look at the curb on the left.', kr: '왼쪽 연석을 보세요.' },
  },
];

export interface KrDrop {
  word: string;
  /** 한국인이 흔히 내는 근사 발음(음절이 늘어난 모습) */
  kr: string;
  /** 어떻게 고치는가 — 박자 수 중심 */
  tip: string;
}

/**
 * 한국인이 흘리거나 ㅡ를 붙이는 어말 자음·자음군 단어 20개(A1/A2).
 * '박자'로 말하는 이유: 한국어 화자에게 음절 수는 들리지만 자음군은 들리지 않는다.
 */
export const KR_DROP: KrDrop[] = [
  { word: 'bus', kr: '버스', tip: '1박자. 끝 s 뒤에 으를 붙이지 않습니다.' },
  { word: 'school', kr: '스쿨', tip: '1박자. s와 k를 붙여서 한 번에, 끝 l은 혀를 잇몸에.' },
  { word: 'street', kr: '스트리트', tip: '1박자. str을 한 덩어리로, 끝 t는 짧게 끊습니다.' },
  { word: 'second', kr: '세컨드', tip: '2박자. 끝 nd에 으가 붙으면 3박자가 됩니다.' },
  { word: 'first', kr: '퍼스트', tip: '1박자. rst 세 자음을 모음 없이 이어서.' },
  { word: 'next', kr: '넥스트', tip: '1박자. kst 뒤에 으 없이 끝냅니다.' },
  { word: 'text', kr: '텍스트', tip: '1박자. next와 같은 kst 자음군.' },
  { word: 'list', kr: '리스트', tip: '1박자. 끝 st는 바람만 내고 끊습니다.' },
  { word: 'cost', kr: '코스트', tip: '1박자. st 뒤에 으를 붙이면 2박자가 됩니다.' },
  { word: 'risk', kr: '리스크', tip: '1박자. sk를 한 번에, 끝 k는 터뜨리지 않아도 됩니다.' },
  { word: 'test', kr: '테스트', tip: '1박자. 앞 t와 끝 st 사이에 모음은 e 하나뿐.' },
  { word: 'best', kr: '베스트', tip: '1박자. test와 같은 리듬.' },
  { word: 'desk', kr: '데스크', tip: '1박자. sk를 붙여서 끝냅니다.' },
  { word: 'world', kr: '월드', tip: '1박자. rld를 혀 한 번 굴리고 잇몸에 붙이며 끝.' },
  { word: 'help', kr: '헬프', tip: '1박자. lp 뒤에 으가 붙으면 2박자.' },
  { word: 'ask', kr: '애스크', tip: '1박자. 모음 하나에 sk를 붙입니다.' },
  { word: 'fast', kr: '패스트', tip: '1박자. f는 윗니를 아랫입술에, 끝 st는 짧게.' },
  { word: 'last', kr: '라스트', tip: '1박자. l은 잇몸에 붙이고 st로 끊습니다.' },
  { word: 'cold', kr: '콜드', tip: '1박자. ld를 이어서, 끝 d 뒤에 으 없이.' },
  { word: 'build', kr: '빌드', tip: '1박자. b는 입술을 붙였다 떼고 ld로 끝냅니다.' },
];

/**
 * 시작일 기준 몇 주차인가(1~8, 9주차부터 1로 반복).
 * startDate가 없거나 잘못됐으면 1주차. today가 시작일보다 앞서도 1주차.
 */
export function weekOf(startDate: string | Date | null | undefined, today: string | Date = new Date()): number {
  const from = typeof startDate === 'string' ? startDate : startDate ? dateKey(startDate) : '';
  const to = typeof today === 'string' ? today : dateKey(today);
  if (!from) return 1;
  const days = daysBetween(from, to);
  if (!Number.isFinite(days) || days < 0) return 1;
  return (Math.floor(days / 7) % WEEK_PLAN.length) + 1;
}

export function planFor(week: number): WeekPlan {
  return WEEK_PLAN[Math.min(WEEK_PLAN.length, Math.max(1, Math.round(week) || 1)) - 1];
}

export interface HvptStat {
  tries: number;
  correct: number;
  /** 최근 시도 결과(1=정답, 0=오답) — 최대 10개. axisMastered가 본다. */
  recent?: number[];
}

/**
 * va_sound_track 전체 모양. M7(디코더)이 같은 키에 decoderSeen·decoder를 두므로
 * 여기 모르는 필드도 그대로 보존한다(index signature).
 */
export interface SoundTrackState {
  week?: number;
  /** 커리큘럼 시작일(YYYY-MM-DD) */
  started?: string;
  hvpt: Partial<Record<string, HvptStat>>;
  decoderSeen?: unknown;
  [extra: string]: unknown;
}

export function trackState(): SoundTrackState {
  const raw = load<Partial<SoundTrackState> | null>(SOUND_TRACK_KEY, null);
  const base: SoundTrackState = { ...(raw && typeof raw === 'object' ? raw : {}), hvpt: {} };
  if (raw && typeof raw === 'object' && raw.hvpt && typeof raw.hvpt === 'object') base.hvpt = { ...raw.hvpt };
  return base;
}

/**
 * 필드 단위 갱신 — 넘긴 필드만 바꾸고 나머지(M7 몫 포함)는 그대로. hvpt는 축 단위로 합친다.
 */
export function saveTrackState(patch: Partial<SoundTrackState>): SoundTrackState {
  const cur = trackState();
  const next: SoundTrackState = { ...cur, ...patch, hvpt: { ...cur.hvpt } };
  if (patch.hvpt) {
    for (const [axis, stat] of Object.entries(patch.hvpt)) {
      if (!stat) continue;
      next.hvpt[axis] = { ...(cur.hvpt[axis] ?? { tries: 0, correct: 0 }), ...stat };
    }
  }
  store(SOUND_TRACK_KEY, next);
  return next;
}

/** 시작일이 없으면 오늘을 시작일로 적고, 현재 주차를 돌려준다. */
export function currentWeek(today: string = todayKey()): number {
  const st = trackState();
  const started = st.started || today;
  const week = weekOf(started, today);
  if (st.started !== started || st.week !== week) saveTrackState({ started, week });
  return week;
}

export interface HvptItem {
  axis: LapseKey;
  /** 캐리어 문장이면 'carrier', 최소대립쌍에서 만든 것이면 'pair' */
  kind: 'carrier' | 'pair';
  a: CarrierSide;
  b: CarrierSide;
  /** 이번 문항에서 재생할 쪽(정답) */
  answer: 'a' | 'b';
}

/** 단어 경계를 지키며 한 단어를 바꾼다 — 'fast'가 'faster' 안에서 바뀌지 않게. */
function swapWord(en: string, from: string, to: string): string | null {
  const re = new RegExp(`\\b${from}\\b`, 'i');
  if (!re.test(en)) return null;
  return en.replace(re, (m) => (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to));
}

/**
 * 결정적 문항 선택 — 같은 (axis, seed)면 같은 문항. 캐리어 문장을 먼저 쓰고,
 * 그 축에 캐리어가 없으면 최소대립쌍의 예문에서 단어를 바꿔 두 문장을 만든다.
 * 재생할 쪽(a/b)도 seed로 정한다. 아무 자료도 없는 축이면 null.
 */
export function nextHvptItem(axis: LapseKey | string, seed: number): HvptItem | null {
  const s = Math.abs(Math.floor(Number(seed) || 0));
  const carriers = CARRIERS.filter((c) => c.axis === axis);
  const answer: 'a' | 'b' = (s >> 1) % 2 === 0 ? 'a' : 'b';
  if (carriers.length) {
    const c = carriers[s % carriers.length];
    return { axis: c.axis, kind: 'carrier', a: c.a, b: c.b, answer };
  }
  const pairs = pairsFor(axis);
  if (!pairs.length) return null;
  const p = pairs[s % pairs.length];
  const swapped = swapWord(p.sentence.en, p.a, p.b);
  return {
    axis: axis as LapseKey,
    kind: 'pair',
    a: { word: p.a, en: swapped ? p.sentence.en : p.a, kr: swapped ? p.sentence.kr : p.aKr },
    b: { word: p.b, en: swapped ?? p.b, kr: p.bKr },
    answer,
  };
}

const RECENT_MAX = 10;

/** HVPT 한 문항의 결과를 축에 쌓는다(tries/correct 누적 + 최근 10회 창). */
export function recordHvpt(axis: LapseKey | string, correct: boolean): HvptStat {
  const cur = trackState().hvpt[axis] ?? { tries: 0, correct: 0 };
  const recent = [...(cur.recent ?? []), correct ? 1 : 0].slice(-RECENT_MAX);
  const stat: HvptStat = { tries: cur.tries + 1, correct: cur.correct + (correct ? 1 : 0), recent };
  saveTrackState({ hvpt: { [axis]: stat } });
  return stat;
}

/** 최근 10회 중 8회 이상 정답이면 그 축의 식별은 익힌 것으로 본다(10회 미만이면 아직). */
export function axisMastered(axis: LapseKey | string): boolean {
  const recent = (trackState().hvpt[axis]?.recent ?? []).slice(-RECENT_MAX);
  if (recent.length < RECENT_MAX) return false;
  const ok = recent.reduce((n, v) => n + (v ? 1 : 0), 0);
  return ok / recent.length >= 0.8;
}

/** 이 축에 HVPT 자료(캐리어 또는 최소대립쌍)가 있는가 — 카드가 축을 고를 때 쓴다. */
export function hasHvpt(axis: LapseKey | string): boolean {
  return CARRIERS.some((c) => c.axis === axis) || allPairs().some((p) => p.axis === axis);
}
