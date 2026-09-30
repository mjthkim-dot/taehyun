/**
 * 저장값 점검·복구 — 값 하나가 어긋나면(손으로 고친 백업, 다른 버전의 백업, 같은 주소의
 * 옛 앱이 쓴 값) 홈이 열 때마다 같은 오류로 깨지고, '홈으로 돌아가기'도 새로고침도 소용이
 * 없었다(감사 v1.31 견고성 #3). 오류 방어막이 오류를 잡으면 이걸 한 번 돌리고 다시 그린다.
 *
 * 원칙: 학습 기록은 최대한 살린다. 읽을 수 없는 JSON만 지우고, 배열의 빈 칸(null)과
 * 모양이 틀린 항목만 걸러 낸다. 모양이 통째로 틀린 값(객체 자리에 문자열 등)만 지운다.
 */

/** 객체여야 하는 키 — 문자열·숫자·배열이면 지운다 */
const OBJECT_KEYS = new Set([
  'va_profile',
  'va_skill_stats',
  'va_cefr_state',
  'va_drama',
  'va_words',
  'va_words_extra',
  'va_words_cfg',
  'va_grammar',
  'va_grammar_variants',
  'va_stats',
  'va_daycount',
  'va_spoken_log',
  'va_xp',
]);

/** 값이 전부 객체여야 하는 사전(단어 진도·문법 진도·레슨 통계) — 빈 칸만 걸러 낸다 */
const DICT_OF_OBJECTS = new Set(['va_words', 'va_grammar', 'va_stats']);

/** 배열 항목이 객체여야 하는 키 — null·문자열 항목을 걸러 낸다 */
const ARRAY_OF_OBJECTS = new Set(['va_weak', 'va_cefr_evidence', 'va_drama_eps', 'va_phrases', 'va_sessions', 'va_chat_logs', 'va_ask_history', 'va_pron']);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 점검해 고친 키 개수를 돌려준다(0이면 이상 없음) */
export function sanitizeStorage(): number {
  if (typeof localStorage === 'undefined') return 0;
  let fixed = 0;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('va_')) keys.push(k);
  }
  const set = (k: string, v: unknown) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* 용량 부족 — 그대로 둔다 */
    }
    fixed++;
  };
  const drop = (k: string) => {
    localStorage.removeItem(k);
    fixed++;
  };
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw == null) continue;
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      drop(k);
      continue;
    }
    if (OBJECT_KEYS.has(k) && !isObj(v)) {
      if (v !== null) drop(k);
      continue;
    }
    if (Array.isArray(v)) {
      let keep = ARRAY_OF_OBJECTS.has(k) ? v.filter(isObj) : v.filter((x) => x !== null && x !== undefined);
      // 항목 모양까지 — 생성 원고는 화 번호·장면·표현이, 레벨 증거는 기능·레벨·점수가 있어야 한다
      if (k === 'va_drama_eps') keep = keep.filter((e) => isObj(e) && Number.isInteger(e.no) && Array.isArray(e.scenes) && Array.isArray(e.learn));
      if (k === 'va_cefr_evidence')
        keep = keep.filter((e) => isObj(e) && ['speaking', 'listening', 'reading', 'writing'].includes(String(e.skill)) && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(String(e.level)) && typeof e.score === 'number');
      if (k === 'va_weak') keep = keep.filter((w) => isObj(w) && typeof w.en === 'string');
      if (keep.length !== v.length) set(k, keep);
      continue;
    }
    if (!isObj(v)) continue;
    if (DICT_OF_OBJECTS.has(k)) {
      const out: Record<string, unknown> = {};
      let bad = false;
      for (const [kk, vv] of Object.entries(v)) {
        if (isObj(vv)) out[kk] = vv;
        else bad = true;
      }
      if (bad) set(k, out);
    } else if (k === 'va_words_extra') {
      const out: Record<string, unknown> = {};
      let bad = false;
      for (const [kk, vv] of Object.entries(v)) {
        if (Array.isArray(vv)) out[kk] = vv.filter((r) => Array.isArray(r) && r.length === 6 && r.every((c) => typeof c === 'string'));
        else bad = true;
        if (Array.isArray(vv) && (out[kk] as unknown[]).length !== vv.length) bad = true;
      }
      if (bad) set(k, out);
    } else if (k === 'va_skill_stats') {
      const okAll = Object.values(v).every((s) => isObj(s) && typeof s.gse === 'number');
      if (!okAll) drop(k);
    } else if (k === 'va_cefr_state') {
      // 승급 기록만 빠졌으면 레벨은 살리고 빈 기록으로
      if (!Array.isArray(v.history)) set(k, { ...v, history: [] });
    } else if (k === 'va_drama_resume') {
      // 이어 보기 — 모양이 어긋나면 통째로 버린다(처음부터 다시 보면 된다)
      if (typeof v.no !== 'number' || typeof v.i !== 'number' || !Array.isArray(v.log) || !Array.isArray(v.rc)) drop(k);
    } else if (k === 'va_drama') {
      if (!isObj(v.done) || (v.score !== undefined && !isObj(v.score))) drop(k);
    }
  }
  return fixed;
}
