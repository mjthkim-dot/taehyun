/**
 * L1 간섭·콩글리시 감지 — 한국어 화자가 영어로 말할 때 반복해서 나오는 오류를
 * AI 없이, 결정적 규칙으로 잡는다. 회화 턴마다 노란 칩 1개("hand phone → cell phone")와
 * 대체 표현 따라 말하기를 띄우는 재료이며, transfer.ts recordMistake('word-choice')로 흘린다.
 *
 * 원칙: **오탐 0에 가깝게 보수적으로.** 틀렸을 수도 있는 문장은 넘긴다.
 *  - "since 2020"은 통과, "since 3 years"만 잡는다.
 *  - "arrived to find…"(목적 부정사)는 통과, "arrived to the office"만 잡는다.
 *  - "notebook"은 Jupyter/Databricks/종이 노트 맥락이면 통과.
 *  - "handle"은 자동차 맥락 + 명사일 때만, "door" 있으면 통과.
 *  - "I'm so hot"은 날씨 단어(today/outside/weather…)가 함께 있을 때만 — 혼자서는 뜻이 갈린다.
 *  - 부정의문 Yes/No 반전은 상대 질문을 몰라도 자기모순("Yes, I don't" / "No, I do.")으로만 본다.
 * 규칙은 M8 콩글리시 팩과 같은 10개 집합이다(id로 맞춘다).
 */

export type L1Kind = 'grammar' | 'konglish';

export interface L1Rule {
  id: string;
  kind: L1Kind;
  /** 걸리는 조건 — 정규식이면 매치 구간이 wrong 표시에 쓰인다 */
  test: RegExp | ((said: string) => boolean);
  /** 고친 문장 — 문자열이면 test 정규식의 매치 구간을 이걸로 바꾼다($1 사용 가능) */
  better: string | ((said: string) => string);
  /** 왜 틀렸는지 한 줄(한국어) */
  kr: string;
  example: { wrong: string; right: string };
  /** test가 함수일 때 wrong 구간을 보여 주기 위한 정규식(선택) */
  span?: RegExp;
}

export interface L1Hit {
  id: string;
  kind: L1Kind;
  /** 걸린 구간(원문 그대로) */
  wrong: string;
  /** 고친 문장 전체 */
  better: string;
  kr: string;
  example: { wrong: string; right: string };
}

/* ── 작은 도우미 ── */

/** 3인칭 단수형 — go→goes, study→studies, have→has */
function thirdPerson(v: string): string {
  const w = v.toLowerCase();
  if (w === 'have') return 'has';
  if (w === 'do') return 'does';
  if (w === 'go') return 'goes';
  if (/(s|sh|ch|x|z|o)$/.test(w)) return w + 'es';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
  return w + 's';
}

/** 정규식 test의 매치 구간을 바꿔 문장을 만든다 */
function swap(said: string, re: RegExp, to: string): string {
  return said.replace(re, to);
}

const VERBS_3SG =
  'go|want|like|have|need|work|live|say|know|think|come|make|get|take|use|do|love|play|look|call|send|give|run|meet|talk|try|start|finish|pay|buy|sell|help|study|eat|drink|sleep|drive|stay|keep|feel|seem|cost|mean|teach|watch|wash|miss|fix|ask|tell|read|write|speak|leave|arrive|wait|bring|hate|prefer|enjoy|understand';
/* open/close는 형용사로도 쓰여(Is it close?) 뺐다 */
/** 조동사·to·지각동사 뒤의 "he go"는 정상(does he go / let him go / saw him go) */
const RE_3SG = new RegExp(
  `(?<!\\b(?:does|did|do|can|could|will|would|should|may|might|must|to|let|saw|see|sees|seen|heard|hear|watched|watch|made|make|makes|making|keep|keeps|kept|leave|leaves|left|get|got|have|has|had|want|wants|wanted|found|help|helps|helped|is|are|was|were|be|been|being|if|when|that|until|before|after|and|or|but)\\s)\\b(he|she|it|my (?:boss|wife|husband|manager|mom|dad|friend|client|customer|son|daughter|brother|sister))\\s+(${VERBS_3SG})\\b(?!\\s*n't)`,
  'i',
);

const RE_SINCE = /\bsince\s+((?:a long|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|a few|few|several|many|long)\s+(?:day|week|month|year|hour|minute|time)s?)(\s+ago)?\b/i;

const RE_PREP = /\b(arriv(?:e|es|ed|ing))\s+to\s+(?=(?:the|a|an|my|our|your|his|her|their|this|that)\b)|\b(interested)\s+at\b|\b(good)\s+in\s+(?=(?:english|korean|japanese|chinese|math|science|speaking|listening|writing|sports?|cooking|driving|singing|dancing|computers?|numbers|sales|presentations?|golf|soccer|tennis|swimming|drawing)\b)/i;

const RE_AGREE = /\b(i am|i'm|he is|he's|she is|she's|we are|we're|they are|they're|you are|you're)\s+(not\s+)?agree\b/i;

/** 문두 동사(주어 없음) — 과거형·am·didn't만. 명령문이 될 수 있는 동사(go/come/take/have/think/don't)는 뺐다. 물음표 문장은 통과 */
const RE_NO_SUBJ = /(^|[.!?]\s+)(went|came|saw|ate|bought|made|took|forgot|lost|finished|worked|studied|watched|played|arrived|visited|met|talked|slept|missed|liked|wanted|needed|felt|heard|tried|called|moved|started|stayed|didn't|am)\b(?![^.!?]*\?)/i;

const RE_REST = /\b(take|takes|took|taking|taken)\s+a\s+rest\b/i;

const RE_HOT = /\b(i'm|i am)\s+(so|very|really|too)\s+(hot|cold)\b/i;
const RE_WEATHER = /\b(today|outside|weather|summer|winter|these days|this morning|tonight|humid|degrees|sunny|out there)\b/i;

const RE_YES_NEG = /\b(yes),?\s+(i|we|he|she|it|they|you)\s+(don't|didn't|doesn't|haven't|hasn't|am not|'m not|isn't|aren't|wasn't|weren't|do not|did not)\b(?!\s+(?:mind|think|know|care|worry|believe|remember|understand|see|mean))/i;
const RE_NO_POS = /\b(no),?\s+(i|we|he|she|it|they|you)\s+(do|did|does|can|have|has|will|am|is|are|was|were)\s*(?=[.!,]|$)/i;

/* ── 문법 규칙 8 ── */

export const GRAMMAR_RULES: L1Rule[] = [
  {
    id: 'third-person-s',
    kind: 'grammar',
    test: RE_3SG,
    better: (said) => said.replace(RE_3SG, (_m, subj: string, verb: string) => `${subj} ${thirdPerson(verb)}`),
    kr: '한국어엔 없지만 he/she/it 뒤 현재형 동사엔 -s가 붙어요.',
    example: { wrong: 'He work at Samsung.', right: 'He works at Samsung.' },
  },
  {
    id: 'since-duration',
    kind: 'grammar',
    test: RE_SINCE,
    better: (said) => said.replace(RE_SINCE, (_m, dur: string) => `for ${/^(few|long)\b/i.test(dur) ? 'a ' : ''}${dur}`),
    kr: 'since 뒤엔 시점(2020, Monday), 기간(3 years)은 for예요.',
    example: { wrong: "I've worked here since 3 years.", right: "I've worked here for 3 years." },
  },
  {
    id: 'prep-choice',
    kind: 'grammar',
    test: RE_PREP,
    better: (said) =>
      said.replace(RE_PREP, (_m, arrive?: string, interested?: string, good?: string) => (arrive ? `${arrive} at ` : interested ? `${interested} in` : `${good} at `)),
    kr: '짝이 정해진 전치사예요: arrive at · interested in · good at.',
    example: { wrong: 'I arrived to the office late.', right: 'I arrived at the office late.' },
  },
  {
    id: 'am-agree',
    kind: 'grammar',
    test: RE_AGREE,
    better: (said) =>
      said.replace(RE_AGREE, (_m, subj: string, not?: string) => {
        const first = subj.split(' ')[0].replace(/'(m|s|re)$/i, '');
        const S = first.toLowerCase() === 'i' ? 'I' : first;
        const third = /^(he|she)$/i.test(first);
        if (not) return `${S} ${third ? "doesn't" : "don't"} agree`;
        return `${S} agree${third ? 's' : ''}`;
      }),
    kr: 'agree는 동사라 be동사 없이 바로 써요: I agree.',
    example: { wrong: 'I am agree with you.', right: 'I agree with you.' },
  },
  {
    id: 'no-subject',
    kind: 'grammar',
    test: RE_NO_SUBJ,
    better: (said) => said.replace(RE_NO_SUBJ, (_m, lead: string, verb: string) => `${lead}I ${verb.toLowerCase()}`),
    kr: '한국어는 주어를 빼지만 영어 문장은 주어로 시작해요.',
    example: { wrong: 'Went to Busan last weekend.', right: 'I went to Busan last weekend.' },
  },
  {
    id: 'take-a-rest',
    kind: 'grammar',
    test: RE_REST,
    better: (said) =>
      said.replace(RE_REST, (_m, v: string) => {
        const w = v.toLowerCase();
        const got = w === 'took' ? 'got' : w === 'taking' ? 'getting' : w === 'takes' ? 'gets' : w === 'taken' ? 'gotten' : 'get';
        return `${got} some rest`;
      }),
    kr: '"take a rest"는 거의 안 써요 — get some rest / take a break.',
    example: { wrong: 'I will take a rest this weekend.', right: 'I will get some rest this weekend.' },
  },
  {
    id: 'im-so-hot',
    kind: 'grammar',
    test: (said) => RE_HOT.test(said) && RE_WEATHER.test(said),
    span: RE_HOT,
    better: (said) => said.replace(RE_HOT, (_m, _be: string, adv: string, adj: string) => `It's ${adv} ${adj}`),
    kr: '날씨가 덥다는 뜻이면 주어는 It — "I\'m hot"은 내 몸(또는 섹시하다)이에요.',
    example: { wrong: "I'm so hot today.", right: "It's so hot today." },
  },
  {
    id: 'neg-question-yes',
    kind: 'grammar',
    test: (said) => RE_YES_NEG.test(said) || RE_NO_POS.test(said),
    span: new RegExp(`${RE_YES_NEG.source}|${RE_NO_POS.source}`, 'i'),
    better: (said) =>
      RE_YES_NEG.test(said)
        ? said.replace(RE_YES_NEG, (m: string) => m.replace(/^yes/i, 'No'))
        : said.replace(RE_NO_POS, (m: string) => m.replace(/^no/i, 'Yes')),
    kr: '부정 의문문도 답은 사실 기준이에요: 안 했으면 No, 했으면 Yes.',
    example: { wrong: "Yes, I didn't go.", right: "No, I didn't go." },
  },
];

/* ── 콩글리시 10 (M8 팩과 같은 집합) ── */

const RE_NOTEBOOK = /\bnotebooks?\b/i;
const RE_NOTEBOOK_OK = /\b(jupyter|databricks|colab|sagemaker|zeppelin|instance|instances|paper|pen|pencil|write|wrote|writing|notes?|cell|cells)\b/i;
const RE_HANDLE = /\b(the|a|my|his|her|our|your|their)\s+handle\b/i;
const RE_CAR = /\b(car|cars|driving|drive|drove|taxi|truck|bus|steering)\b/i;
const RE_EVENT = /\b(an?|the|this|that|our|their|sale|discount|promotion|1\s*\+\s*1|special)\s+event\b/i;
const RE_DEAL = /\b(\d+\s*%|percent|discount|coupon|coupons|1\s*\+\s*1|one plus one|buy one|free gift|half price|cheaper|sale)\b/i;

export const KONGLISH_RULES: L1Rule[] = [
  {
    id: 'hand-phone',
    kind: 'konglish',
    test: /\bhand\s?phones?\b/i,
    better: (said) => said.replace(/\bhand\s?(phones?)\b/i, (_m, p: string) => `cell ${p.toLowerCase()}`),
    kr: '"hand phone"은 콩글리시 — cell phone 또는 그냥 phone.',
    example: { wrong: 'I left my hand phone at home.', right: 'I left my phone at home.' },
  },
  {
    id: 'notebook',
    kind: 'konglish',
    test: (said) => RE_NOTEBOOK.test(said) && !RE_NOTEBOOK_OK.test(said),
    span: RE_NOTEBOOK,
    better: (said) => said.replace(RE_NOTEBOOK, (m) => (m.toLowerCase().endsWith('s') ? 'laptops' : 'laptop')),
    kr: '영어의 notebook은 종이 공책 — 컴퓨터는 laptop.',
    example: { wrong: 'I bought a new notebook for work.', right: 'I bought a new laptop for work.' },
  },
  {
    id: 'aircon',
    kind: 'konglish',
    test: /\bair-?cons?\b/i,
    better: (said) => said.replace(/\bair-?con(s?)\b/i, (_m, pl: string) => `air conditioner${pl}`),
    kr: '"aircon"은 안 통해요 — air conditioner, 짧게는 AC.',
    example: { wrong: 'Can you turn on the aircon?', right: 'Can you turn on the AC?' },
  },
  {
    id: 'remocon',
    kind: 'konglish',
    test: /\bremo-?cons?\b/i,
    better: 'remote',
    kr: '"remocon"은 일본식 줄임말 — remote (control).',
    example: { wrong: 'Where is the remocon?', right: 'Where is the remote?' },
  },
  {
    id: 'handle',
    kind: 'konglish',
    test: (said) => RE_HANDLE.test(said) && RE_CAR.test(said) && !/\bdoor\b/i.test(said),
    span: RE_HANDLE,
    better: (said) => said.replace(RE_HANDLE, (_m, det: string) => `${det} steering wheel`),
    kr: '자동차의 핸들은 steering wheel — handle은 문손잡이예요.',
    example: { wrong: 'I held the handle tight while driving.', right: 'I held the steering wheel tight while driving.' },
  },
  {
    id: 'after-service',
    kind: 'konglish',
    test: /\bA\/S\b|\bafter\s+service\b|\bAS\s+center\b/,
    better: 'repair service',
    kr: '"A/S"는 콩글리시 — repair / warranty service / customer service.',
    example: { wrong: 'I need to call A/S for my laptop.', right: 'I need to call customer service for my laptop.' },
  },
  {
    id: 'sns',
    kind: 'konglish',
    test: /\bSNS\b/i,
    better: 'social media',
    kr: 'SNS는 한국·일본식 — 영어는 social media.',
    example: { wrong: 'I saw it on SNS.', right: 'I saw it on social media.' },
  },
  {
    id: 'one-room',
    kind: 'konglish',
    test: /\b(a|an|my|his|her|our|your|their)\s+one[- ]?room\b(?!\s+(?:apartment|apartments|flat|house|office|school|cabin|studio))/i,
    better: '$1 studio',
    kr: '"원룸"은 studio (apartment) — one room은 "방 하나"라는 뜻이에요.',
    example: { wrong: 'I live in a one room near the office.', right: 'I live in a studio near the office.' },
  },
  {
    id: 'manner-mode',
    kind: 'konglish',
    test: /\bmanner\s+mode\b/i,
    better: 'silent mode',
    kr: '"매너 모드"는 silent mode 또는 vibrate.',
    example: { wrong: 'Please put your phone on manner mode.', right: 'Please put your phone on silent mode.' },
  },
  {
    id: 'event',
    kind: 'konglish',
    test: (said) => RE_EVENT.test(said) && RE_DEAL.test(said),
    span: RE_EVENT,
    better: (said) => said.replace(RE_EVENT, (_m, det: string) => (/^(sale|discount|promotion|special|1\s*\+\s*1)$/i.test(det) ? 'promotion' : `${det} promotion`)),
    kr: '할인 행사는 promotion / sale / deal — event는 모임·행사예요.',
    example: { wrong: 'The store is doing a 1+1 event.', right: 'The store is doing a buy-one-get-one deal.' },
  },
];

export const L1_RULES: L1Rule[] = [...GRAMMAR_RULES, ...KONGLISH_RULES];

/** 규칙 하나를 발화에 적용 — 안 걸리면 null */
export function applyRule(rule: L1Rule, said: string): L1Hit | null {
  const hit = rule.test instanceof RegExp ? rule.test.test(said) : rule.test(said);
  if (!hit) return null;
  const spanRe = rule.test instanceof RegExp ? rule.test : rule.span;
  const wrong = (spanRe ? said.match(spanRe)?.[0] : undefined) ?? said;
  let better: string;
  if (typeof rule.better === 'function') better = rule.better(said);
  else if (rule.test instanceof RegExp) better = swap(said, rule.test, rule.better);
  else better = rule.better;
  return { id: rule.id, kind: rule.kind, wrong: wrong.trim(), better, kr: rule.kr, example: rule.example };
}

/**
 * 발화에서 걸린 L1 규칙 최대 2개(문법 → 콩글리시 순). 보수적이라 애매하면 빈 배열.
 * 빈 발화·한글만 있는 발화는 빈 배열.
 */
export function detectL1(said: string, max = 2): L1Hit[] {
  const s = (said ?? '').trim();
  if (!s || !/[a-z]/i.test(s)) return [];
  const out: L1Hit[] = [];
  for (const rule of L1_RULES) {
    const h = applyRule(rule, s);
    if (h) out.push(h);
    if (out.length >= max) break;
  }
  return out;
}
