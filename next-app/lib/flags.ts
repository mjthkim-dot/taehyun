/**
 * 실험 기능 플래그(M1) — 행동을 바꾸는 모듈(역할극·회상 말하기·리텔·교정 게이트·하루 조절기·
 * 디코더·HVPT·단어 말하기, M11은 earFirst·prosodyLab을 더한다)은 전부 여기서 되돌릴 수 있다.
 *
 * 기본값은 전부 켜짐. 저장(va_flags)에는 사용자가 바꾼 키만 둔다 — 그래야 나중에 기본값을
 * 바꿔도 손대지 않은 사람에게 바로 적용된다. FlagKey는 열린 union: 다른 모듈이 키를 더할 때
 * 이 파일을 고치지 않아도 타입이 통과하고(registerFlag로 라벨·기본값을 등록), 모르는 키는 켜짐으로
 * 본다(기능이 조용히 꺼져 있는 것보다 낫다).
 *
 * UI는 백업 화면 하단 '고급 ▾' 안 '실험 기능 되돌리기' 목록 하나뿐(집중 모드에 새 화면 없음).
 */
import { load, store } from './state';

export type FlagKey = 'rolePlay' | 'speakRecall' | 'retell' | 'fixGate' | 'dayGovernor' | 'decoder' | 'hvpt' | 'wordSpeak' | (string & {});

/** 기본값 표 — M11이 earFirst·prosodyLab을 append */
export const FLAG_DEFAULTS: Record<string, boolean> = {
  rolePlay: true,
  speakRecall: true,
  retell: true,
  fixGate: true,
  dayGovernor: true,
  decoder: true,
  hvpt: true,
  wordSpeak: true,
  // M7 — 말풍선 아래 '원어민 소리' 회색 줄. 보는 사람이 고르는 표시 설정이라 기본 꺼짐
  soundLine: false,
};

/** 한국어 라벨 — 토글 목록에 보이는 이름(한 줄, 학습자 말로) */
export const FLAG_LABELS: Record<string, string> = {
  rolePlay: '드라마 역할극(태오 대사를 내가 말하기)',
  speakRecall: '지난 표현을 말로 떠올리기',
  retell: '엔딩에서 줄거리 다시 말하기',
  fixGate: '회화에서 고친 문장 한 번 더 말하기',
  dayGovernor: '하루 분량 자동 조절',
  decoder: '소리 디코더(연음·축약 카드)',
  hvpt: '소리 구분 훈련(HVPT)',
  wordSpeak: '단어도 말로 익히기',
  soundLine: "말풍선 아래 '원어민 소리' 줄 보기(gonna·wanna)",
};

const FLAGS_KEY = 'va_flags';
/** 값이 바뀌면 화면들이 즉시 따라오도록 알린다(같은 탭 안에서는 storage 이벤트가 안 온다) */
export const FLAGS_EVENT = 'va:flags';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 저장된 덮어쓰기만(불리언 아닌 값은 무시) */
function overrides(): Record<string, boolean> {
  const raw = load<Record<string, unknown>>(FLAGS_KEY, {});
  const out: Record<string, boolean> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'boolean') out[k] = v;
  return out;
}

/** 다른 모듈이 키를 등록한다(라벨·기본값). 이미 있으면 덮어쓰지 않는다. */
export function registerFlag(key: FlagKey, label: string, def = true): void {
  if (!(key in FLAG_DEFAULTS)) FLAG_DEFAULTS[key] = def;
  if (!(key in FLAG_LABELS)) FLAG_LABELS[key] = label;
}

/** 켜져 있나 — 저장값 > 기본값 > 켜짐 */
export function isOn(key: FlagKey): boolean {
  const o = overrides();
  if (key in o) return o[key];
  return FLAG_DEFAULTS[key] ?? true;
}

export function setFlag(key: FlagKey, on: boolean): void {
  const o = overrides();
  // 기본값과 같으면 저장에서 뺀다(덮어쓰기만 남긴다)
  if (on === (FLAG_DEFAULTS[key] ?? true)) delete o[key];
  else o[key] = on;
  store(FLAGS_KEY, o);
  try {
    window.dispatchEvent(new CustomEvent(FLAGS_EVENT, { detail: { key, on } }));
  } catch {
    /* SSR */
  }
}

/** 전부 기본값으로 */
export function resetFlags(): void {
  store(FLAGS_KEY, {});
  try {
    window.dispatchEvent(new CustomEvent(FLAGS_EVENT, { detail: { key: null, on: null } }));
  } catch {
    /* SSR */
  }
}

/** 토글 목록 — 등록된 키 순서대로 */
export function flagList(): { key: string; label: string; on: boolean; def: boolean }[] {
  return Object.keys(FLAG_DEFAULTS).map((key) => ({ key, label: FLAG_LABELS[key] || key, on: isOn(key), def: FLAG_DEFAULTS[key] }));
}

/** 꺼 둔(기본값과 다른) 플래그 수 — '고급 ▾' 요약 줄 */
export function changedFlagCount(): number {
  return flagList().filter((f) => f.on !== f.def).length;
}
