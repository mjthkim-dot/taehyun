'use client';

/**
 * 2분 피치 훈련 — 이 앱에 없던 '긴 발화' 층.
 *
 * 지금까지 훈련은 전부 문장 단위(드릴·쉐도잉) 아니면 한 턴(회화·역할연습)이었다.
 * 그런데 영업에서 실제로 무너지는 지점은 "그럼 솔루션을 2분만 설명해 주시겠어요?"다.
 * 문장 100개를 정확히 말해도 2분을 혼자 끌고 가지 못하면 미팅에서는 진다. 짧은 발화와
 * 긴 발화는 다른 능력이다 — 구조를 머리에 쥐고, 멈추지 않고, 속도를 유지해야 한다.
 *
 * 그래서 재는 것도 다르다. 정확도(단어 일치)가 아니라 **끌고 가는 힘**을 본다:
 *   · 말한 시간과 분당 단어 수(너무 빠르면 안 들리고, 너무 느리면 준비가 안 된 것)
 *   · 채움말(um, you know…) — 한국어 화자가 영어로 길게 말할 때 급증한다
 *   · 3초 이상 멈춤 — 어디서 막혔는지의 직접 증거
 *   · 구조(문제 → 해법 → 근거 → 다음 단계) 충족 여부
 *
 * 앞의 세 가지는 기기에서 계산한다(키 없이도 지표는 나온다). 구조 판단과 코칭만
 * AI에 맡긴다.
 */
import { load, store } from './state';

export interface PitchTopic {
  key: string;
  label: string;
  /** 무엇을 말해야 하는지 한 줄 */
  brief: string;
  /** 준비 시간에 보여주는 뼈대 — 이걸 보고 30초 동안 머릿속에 구성한다 */
  outline: string[];
}

/** 클라우드·IT 영업에서 실제로 요구받는 2분짜리 설명들. */
export const PITCH_TOPICS: PitchTopic[] = [
  {
    key: 'solution',
    label: '우리 솔루션 2분 설명',
    brief: '처음 만난 고객에게 우리가 무엇을 하는 회사이고 왜 지금 필요한지 설명하세요.',
    outline: ['고객이 지금 겪는 문제', '우리가 그 문제를 푸는 방식', '비슷한 고객에서의 결과', '오늘 제안하는 다음 단계'],
  },
  {
    key: 'migration',
    label: '클라우드 전환 제안',
    brief: '온프레미스에서 클라우드로 옮겨야 하는 이유와 방법을 설명하세요.',
    outline: ['지금 구조의 한계(비용·확장성·운영 부담)', '전환 방식과 단계', '위험을 줄이는 장치', 'PoC 제안'],
  },
  {
    key: 'pricing',
    label: '가격이 비싸다는 반응에 답하기',
    brief: '경쟁사보다 비싸다는 말을 들었습니다. 2분 안에 가치를 다시 세우세요.',
    outline: ['가격이 아니라 총비용으로 프레임 바꾸기', '숨은 비용(운영·장애·인력)', '우리가 줄여주는 것', '검증 방법 제안'],
  },
  {
    key: 'poc-result',
    label: 'PoC 결과 보고',
    brief: '2주 PoC가 끝났습니다. 결과와 다음 단계를 보고하세요.',
    outline: ['무엇을 검증했는가', '숫자로 나온 결과', '남은 이슈와 대응', '본계약 제안'],
  },
  {
    key: 'incident',
    label: '장애 상황 설명',
    brief: '서비스 장애가 있었습니다. 고객에게 상황과 대응을 설명하세요.',
    outline: ['무슨 일이 있었는가(사실만)', '영향 범위', '지금까지의 조치', '재발 방지책과 약속'],
  },
  {
    key: 'self',
    label: '내 소개 · 우리 팀 소개',
    brief: '처음 만난 고객사 임원에게 나와 우리 팀을 소개하세요.',
    outline: ['내가 맡는 일', '비슷한 고객 경험', '우리 팀이 잘하는 것', '앞으로 어떻게 일할지'],
  },
  {
    key: 'security',
    label: '보안 · 컴플라이언스 우려 해소',
    brief: '데이터가 외부로 나가는 것을 걱정하는 고객에게 설명하세요.',
    outline: ['어떤 데이터가 어디에 머무는가', '통제 수단(암호화·접근권한·감사)', '인증·규제 대응', '고객이 직접 확인하는 방법'],
  },
  {
    key: 'renewal',
    label: '갱신 설득',
    brief: '계약 갱신을 앞두고 지난 1년의 가치를 정리해 설명하세요.',
    outline: ['1년간 달성한 것', '숫자로 본 효과', '내년에 더 할 수 있는 것', '갱신 조건 제안'],
  },
];

export interface PitchMetrics {
  /** 말한 시간(초) */
  seconds: number;
  words: number;
  /** 분당 단어 수 — 편안한 비즈니스 발표는 대략 120~160 */
  wpm: number;
  /** 채움말 횟수와 실제로 쓰인 것들 */
  fillers: number;
  fillerList: string[];
  /** 3초 이상 멈춘 횟수 */
  longPauses: number;
}

/** 한국어 화자가 영어로 길게 말할 때 급증하는 채움말들. */
const FILLER_RE = /\b(um+|uh+|er+|ah+|hmm+|like|you know|i mean|kind of|sort of|actually|basically|so yeah)\b/gi;

/** 기기에서 계산하는 지표 — AI 키가 없어도 여기까지는 나온다. */
export function analyzePitch(transcript: string, durationMs: number, pauses: number[] = []): PitchMetrics {
  const words = (transcript.match(/[A-Za-z']+/g) || []).length;
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  const found = transcript.match(FILLER_RE) || [];
  return {
    seconds,
    words,
    wpm: Math.round((words / seconds) * 60),
    fillers: found.length,
    fillerList: [...new Set(found.map((f) => f.toLowerCase()))].slice(0, 6),
    longPauses: pauses.filter((p) => p >= 3000).length,
  };
}

/** 지표를 사람 말로 옮긴다 — 숫자만 보여주면 무엇을 고쳐야 할지 알 수 없다. */
export function readMetrics(m: PitchMetrics): string[] {
  const out: string[] = [];
  if (m.seconds < 60) out.push('2분을 채우지 못했어요. 뼈대 네 칸을 각각 30초씩 채운다고 생각해 보세요.');
  else if (m.seconds > 150) out.push('2분을 꽤 넘겼어요. 실제 미팅에서는 상대가 끊습니다 — 근거를 하나만 남겨보세요.');
  if (m.wpm && m.wpm < 90) out.push(`분당 ${m.wpm}단어로 느린 편이에요. 문장을 짧게 끊으면 속도가 자연스럽게 붙습니다.`);
  else if (m.wpm > 180) out.push(`분당 ${m.wpm}단어로 빠른 편이에요. 중요한 숫자 앞에서 한 박자 쉬면 훨씬 잘 들립니다.`);
  if (m.fillers >= 8) out.push(`채움말이 ${m.fillers}번 나왔어요(${m.fillerList.join(', ')}). 채우지 말고 그냥 쉬는 편이 낫습니다.`);
  if (m.longPauses >= 3) out.push(`3초 이상 멈춘 곳이 ${m.longPauses}번이에요. 다음 칸으로 넘어가는 연결 문장을 미리 정해두세요.`);
  if (!out.length) out.push('시간·속도·유창성 지표가 모두 안정적이에요. 이제 내용의 설득력에 집중해도 좋습니다.');
  return out;
}

export interface PitchCoach {
  /** 구조 네 칸 충족 여부와 한 줄 평 */
  structure: { key: string; label: string; ok: boolean; note: string }[];
  /** 잘한 점 */
  strengths: string[];
  /** 다음에 고칠 것 */
  fixes: string[];
  /** 더 나은 오프닝 한 문장 */
  betterOpening: string;
}

const COACH_SYSTEM = [
  'You coach a Korean cloud/IT sales professional on a 2-minute spoken pitch delivered in English.',
  'The transcript comes from speech recognition, so ignore punctuation and capitalization issues.',
  'Judge the CONTENT and STRUCTURE, not spelling.',
  'Return JSON only:',
  '{"structure":[{"key":"...","label":"...","ok":true,"note":"..."}],"strengths":["..."],"fixes":["..."],"betterOpening":"..."}',
  'Rules:',
  '- structure: one entry per outline item given by the user, in the same order, same key and label.',
  '- ok: true only if the speaker actually covered it. Be strict — a passing mention is not coverage.',
  '- note: one short Korean sentence. If ok is false, say concretely what was missing.',
  '- strengths: 2 items, Korean, specific to what they actually said (quote a phrase they used).',
  '- fixes: 2-3 items, Korean, each an action they can take next time, not a vague comment.',
  '- betterOpening: one English sentence (under 25 words) they could have opened with instead.',
].join('\n');

export function buildCoachMessages(topic: PitchTopic, transcript: string, m: PitchMetrics) {
  return [
    { role: 'system' as const, content: COACH_SYSTEM },
    {
      role: 'user' as const,
      content: [
        `Topic: ${topic.label}`,
        `Brief: ${topic.brief}`,
        `Outline (use these as the structure items, in order):`,
        ...topic.outline.map((o, i) => `${i + 1}. ${o}`),
        '',
        `Measured: ${m.seconds}s, ${m.words} words, ${m.wpm} wpm, ${m.fillers} fillers, ${m.longPauses} long pauses.`,
        '',
        'Transcript:',
        transcript,
      ].join('\n'),
    },
  ];
}

/** AI 응답을 화면이 믿고 쓸 수 있는 형태로 다듬는다(빠진 칸은 미충족으로 본다). */
export function parseCoach(raw: string, topic: PitchTopic): PitchCoach {
  const p = JSON.parse(raw || '{}') as Partial<PitchCoach>;
  const given = Array.isArray(p.structure) ? p.structure : [];
  const structure = topic.outline.map((label, i) => {
    const hit = given[i] || given.find((g) => g && g.label === label);
    return {
      key: String(hit?.key || `s${i}`),
      label,
      ok: !!hit?.ok,
      note: String(hit?.note || '').trim(),
    };
  });
  return {
    structure,
    strengths: (Array.isArray(p.strengths) ? p.strengths : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3),
    fixes: (Array.isArray(p.fixes) ? p.fixes : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3),
    betterOpening: String(p.betterOpening || '').trim(),
  };
}

/* ── 기록 ── */
export interface PitchRun {
  id: string;
  date: string;
  topicKey: string;
  topicLabel: string;
  transcript: string;
  metrics: PitchMetrics;
  /** 구조 네 칸 중 몇 칸을 채웠는지 — 추세를 보는 가장 단순한 수치 */
  covered: number;
  total: number;
}

const KEY = 'va_pitches';
const MAX = 30;

export function getPitchRuns(): PitchRun[] {
  return load<PitchRun[]>(KEY, []);
}

export function savePitchRun(r: PitchRun) {
  store(KEY, [...getPitchRuns(), r].slice(-MAX));
}

/** 같은 주제의 지난 기록 — "지난번보다 나아졌는가"를 보여주는 데 쓴다. */
export function lastRunFor(topicKey: string): PitchRun | null {
  const runs = getPitchRuns().filter((r) => r.topicKey === topicKey);
  return runs.length ? runs[runs.length - 1] : null;
}
