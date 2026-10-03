/**
 * 원고 7화(data/dramaSeed.json) '상대 대사 채굴' — 역할극(M2)·리텔(M5)용 정적 콘텐츠.
 *
 * 왜 필요한가: 원고의 태오 대사는 화당 1~4줄(EP3는 1줄)뿐이라 태오 줄만으로는 화당 발화 기회 15~25개가
 * 산술적으로 안 나온다. 그래서 화마다 **상대(비태오) 대사 ≥5줄**을 장면 인덱스로 지정해 역할극·섀도잉의 기본
 * 재료로 쓴다. 선정 기준: 5~11단어(축약은 한 단어로 셈), 한국인 혼동축(R/L·F/P·V/B·TH·어말자음) 1개 이상,
 * 태오가 되받아 말해도 어색하지 않은 줄.
 *
 * 원고 실측과 어긋난 부분(원고 JSON은 수정 금지라 여기서 흡수):
 * - EP6은 비태오 'line' 장면이 4개뿐(EP2·EP4는 5~11단어 범위 안 줄이 3개뿐). 그래서 상대가 실제로 입 밖에 낸
 *   'meaning'(뜻 고르기)·'fill'(빈칸, who≠taeo) 장면도 후보에 넣고, 4단어·12단어 줄 몇 개를 `LOOSE`로 명시 허용한다.
 * - 이 모듈은 lib/drama.ts(저장·AI·진행 로직까지 딸려 옴)가 아니라 원고 JSON을 직접 읽는다. 원고가 번들에
 *   실리는 것은 이 모듈을 쓰는 DramaScreen 청크 안에서만 허용 — 홈 첫 청크(homeLite·DramaCard)에서 import 금지.
 */
import seed from '../data/dramaSeed.json';
import type { Episode, Scene } from './drama';

/** 화 번호 → 역할극으로 쓸 상대 대사 장면 인덱스(`scenes` 0-based). */
export const MINE: Record<number, { sceneIdx: number[] }> = {
  1: { sceneIdx: [3, 6, 7, 9, 11, 13] },
  2: { sceneIdx: [1, 4, 6, 8, 15] },
  3: { sceneIdx: [1, 4, 8, 9, 12] },
  4: { sceneIdx: [1, 3, 7, 9, 17] },
  5: { sceneIdx: [2, 3, 9, 10, 15, 16] },
  6: { sceneIdx: [1, 3, 8, 11, 13] },
  7: { sceneIdx: [4, 6, 9, 11, 13] },
};

/** 단어 수 기본 범위(축약은 한 단어). RoleStep은 10단어 이상이면 빌드업으로 쪼갠다. */
export const WORD_RANGE: readonly [number, number] = [5, 11];

/**
 * 기본 범위 밖인데도 지정한 줄(`no:idx`) — 그 화에 5~11단어 상대 줄이 모자라서. 4~12단어까지만 허용.
 * 2:1 'Welcome aboard, Taeo. Relax.'(4) · 2:6 'Maya wants an iced americano. …'(12, 빌드업)
 * 4:9 'Coffee for the detective!'(4) · 4:17 'Me? Sure. Totally fine.'(4)
 * 6:1 "You're alone. Where's Maya?"(4) · 6:13 'Who made this mistake?'(4)
 */
export const LOOSE: ReadonlySet<string> = new Set(['2:1', '2:6', '4:9', '4:17', '6:1', '6:13']);
export const LOOSE_RANGE: readonly [number, number] = [4, 12];

/** 화당 리텔 키워드 4개(한국어) — 인물·사건·감정·결말. M5 keywordsOf(ep)가 시드 화에 쓴다. */
export const KEYWORDS: Record<number, string[]> = {
  1: ['첫 출근', '멈춘 엘리베이터', '긴장돼요', 'CEO가 Diane'],
  2: ['커피 심부름', '컵에 적힌 TACO', 'Jun의 놀림', 'Grant의 전화 요청'],
  3: ['Grant와 화상 통화', '청구서가 왜 높죠', '확인하고 연락드릴게요', '계약 해지 검토'],
  4: ['빨간 폴더', '밤새 도는 서버 열 대', '탐정님 커피', '로그의 jun.park'],
  5: ['옥상 벤치 고백', '내 잘못이야', '같이 고치자', 'Maya가 열이 나서'],
  6: ['혼자 만난 Grant', '서버를 어제 껐어요', '매달 30퍼센트 절약', '누가 실수했죠'],
  7: ['우리는 한 팀', 'Grant의 신뢰', 'Diane의 박수', '점심 제안'],
};

/** 리텔 담화 표지 6개 로테이션 — M5가 화 번호로 2개씩 돌려 쓴다(영어 노출, 가림 없음). */
export const RETELL_MARKERS: string[] = ['first', 'then', 'but', 'so', 'actually', 'in the end'];

/** 역할극 결과 카드 문구 8개(한국어) — 점수대·상황별. RoleStep이 그대로 쓴다. */
export const RESULT_CARD_MSGS: string[] = [
  '거의 원어민이에요. 이 줄은 됐어요.',
  '잘 들렸어요. 한 번만 더 하면 완벽.',
  '뜻은 통했어요. 빨간 단어만 다시.',
  '절반쯤 들렸어요. 영어를 보고 한 번 더.',
  '아직 멀어요. 끝부터 쌓아 볼까요.',
  '좋아요, 같이 말하기 완료.',
  '넘어갔어요. 내일 복습에 넣어 둘게요.',
  '이 채점은 접수했어요. 다음엔 칩을 숨길게요.',
];

export interface MinedLine {
  idx: number;
  who: string;
  en: string;
  kr: string;
}

interface SeedData {
  episodes: Episode[];
}
const EPS = (seed as unknown as SeedData).episodes;

/** 공백 기준 단어 수(축약은 한 단어) — lib/drama.ts validateProfile과 같은 셈법. */
export const wordCount = (en: string) => en.trim().split(/\s+/).filter(Boolean).length;

/** 장면이 '상대가 실제로 말한 줄'이면 {who,en,kr}로, 아니면 null. meaning은 정답 뜻을 kr로, fill은 빈칸을 채워 en을 만든다. */
export function spokenOf(s: Scene | undefined): { who: string; en: string; kr: string } | null {
  if (!s) return null;
  if (s.type === 'line') return { who: s.who, en: s.en, kr: s.kr };
  if (s.type === 'meaning') return { who: s.who, en: s.en, kr: s.opts[s.a] ?? '' };
  if (s.type === 'fill') return { who: s.who, en: `${s.before} ${s.opts[s.a]} ${s.after}`.replace(/\s+([.,?!])/g, '$1').replace(/\s+/g, ' ').trim(), kr: s.kr };
  return null;
}

/** 한국인 혼동축 중 그 줄에 들어 있는 것 — 테스트·칩 힌트용(진짜 진단은 lib/pronunciation.ts diagnose). */
export function axesOf(en: string): string[] {
  const t = en.toLowerCase();
  const out: string[] = [];
  if (/[rl]/.test(t)) out.push('R/L');
  if (/[fp]/.test(t)) out.push('F/P');
  if (/[vb]/.test(t)) out.push('V/B');
  if (/th/.test(t)) out.push('TH');
  if (/[a-z]*[bdgkpt]\b/.test(t)) out.push('어말자음');
  return out;
}

/** 화 번호 → 지정된 상대 대사 목록(원고 실제 장면에서 읽음). 없는 화·잘못된 인덱스는 건너뛴다. */
export function mineLines(no: number): MinedLine[] {
  const ep = EPS.find((e) => e.no === no);
  const pick = MINE[no];
  if (!ep || !pick) return [];
  const out: MinedLine[] = [];
  for (const idx of pick.sceneIdx) {
    const sp = spokenOf(ep.scenes[idx]);
    if (!sp || sp.who === 'taeo') continue;
    out.push({ idx, ...sp });
  }
  return out;
}

/** 시드 화 번호 목록(1~7) — 호출 측이 '시드 화인가'를 판단할 때. */
export const MINED_EPISODES = Object.keys(MINE).map(Number);
