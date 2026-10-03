/**
 * 진단 카운터(M1) — n=1 환경에서 '소리가 안 났다'를 숫자로 세기 위한 일별 집계.
 *
 * 앱은 학습자 한 명이 쓴다. 집단 비교 지표는 쓸 수 없고, 대신 "오늘 TTS가 몇 번 한도에 걸렸나,
 * 녹음 저장이 몇 번 실패했나"처럼 건수를 남겨 두면 백업 화면의 '소리 점검' 표(M0)가 읽는다.
 *   · va_diag     { [date]: { canDetectFail, stt429, tts429, recSaveFail } } — 90일
 *   · va_tts_meta { [date]: { hit, miss, synth, tts429 } } — TTS 캐시 적중률·합성 횟수(일 ≤60 목표), 60일
 * va_diag는 EVICTABLE 밖(용량 부족에도 지우지 않는다), va_tts_meta는 캐시 성격이라 EVICTABLE 앞쪽.
 */
import { load, store } from './state';
import { todayKey } from './dates';

export type DiagKey = 'canDetectFail' | 'stt429' | 'tts429' | 'recSaveFail';
export type DiagDay = Record<DiagKey, number>;

const DIAG_KEY = 'va_diag';
const DIAG_DAYS = 90;

export type TtsMetaKey = 'hit' | 'miss' | 'synth' | 'tts429';
export type TtsMetaDay = Record<TtsMetaKey, number>;

const TTS_META_KEY = 'va_tts_meta';
const TTS_META_DAYS = 60;

const emptyDiag = (): DiagDay => ({ canDetectFail: 0, stt429: 0, tts429: 0, recSaveFail: 0 });
const emptyTts = (): TtsMetaDay => ({ hit: 0, miss: 0, synth: 0, tts429: 0 });

/** 오래된 날짜를 잘라 낸다(키 정렬 = 날짜 정렬) */
function trimDays<T>(dict: Record<string, T>, keep: number): Record<string, T> {
  const keys = Object.keys(dict).sort();
  if (keys.length <= keep) return dict;
  for (const k of keys.slice(0, keys.length - keep)) delete dict[k];
  return dict;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 오늘 진단 카운터 하나를 n만큼 올린다(열린 키 — 모듈이 새 사유를 더해도 된다) */
export function bumpDiag(key: DiagKey | (string & {}), n = 1): void {
  const all = load<Record<string, Record<string, number>>>(DIAG_KEY, {});
  const today = todayKey();
  const day = isObj(all[today]) ? all[today] : {};
  day[key] = (typeof day[key] === 'number' ? day[key] : 0) + n;
  all[today] = day;
  store(DIAG_KEY, trimDays(all, DIAG_DAYS));
}

/** 전체(날짜 → 카운터). 모양이 어긋난 날은 빈 값으로 */
export function diagLog(): Record<string, DiagDay> {
  const all = load<Record<string, unknown>>(DIAG_KEY, {});
  const out: Record<string, DiagDay> = {};
  for (const [d, v] of Object.entries(all)) {
    if (!isObj(v)) continue;
    const row = emptyDiag();
    for (const k of Object.keys(row) as DiagKey[]) row[k] = typeof v[k] === 'number' ? (v[k] as number) : 0;
    out[d] = row;
  }
  return out;
}

/** 최근 n일 합계 — '소리 점검' 표 한 줄 */
export function diagSum(days = 7): DiagDay {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const from = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
  const sum = emptyDiag();
  for (const [d, row] of Object.entries(diagLog())) {
    if (d < from) continue;
    for (const k of Object.keys(sum) as DiagKey[]) sum[k] += row[k];
  }
  return sum;
}

/** TTS 캐시 지표 하나를 올린다 */
export function bumpTtsMeta(key: TtsMetaKey, n = 1): void {
  const all = load<Record<string, Record<string, number>>>(TTS_META_KEY, {});
  const today = todayKey();
  const day = isObj(all[today]) ? all[today] : {};
  day[key] = (typeof day[key] === 'number' ? day[key] : 0) + n;
  all[today] = day;
  store(TTS_META_KEY, trimDays(all, TTS_META_DAYS));
}

export function ttsMeta(): Record<string, TtsMetaDay> {
  const all = load<Record<string, unknown>>(TTS_META_KEY, {});
  const out: Record<string, TtsMetaDay> = {};
  for (const [d, v] of Object.entries(all)) {
    if (!isObj(v)) continue;
    const row = emptyTts();
    for (const k of Object.keys(row) as TtsMetaKey[]) row[k] = typeof v[k] === 'number' ? (v[k] as number) : 0;
    out[d] = row;
  }
  return out;
}

/** 오늘 값 — 합성 횟수(일 ≤60 목표)와 적중률 확인용 */
export function ttsMetaToday(): TtsMetaDay {
  return ttsMeta()[todayKey()] || emptyTts();
}
