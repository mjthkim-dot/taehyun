/**
 * 채점 래퍼 — 목표 문장 대비 발화 일치도(0~100)와 단어별 일치 여부.
 *
 * 왜 따로 두는가: 단어 탭(WordsScreen)·드라마·역할극이 같은 채점을 쓰는데, 지금까지는
 * store/useLessonStore(zustand·복습 엔진)와 lib/drama.ts(원고 dramaSeed.json 포함)에
 * 흩어져 있어 "채점 한 줄" 때문에 무거운 원고가 다른 청크에 딸려 들어올 위험이 있었다.
 * 이 파일은 **순수 함수만** 담고 아무 것도 import하지 않는다 — tests/unit/align.test.ts가
 * 이 사실(원고·drama.ts·store 미참조)을 고정한다. useLessonStore.computeAccuracy는
 * 이 함수의 얇은 래퍼다(같은 결과, 같은 타입).
 *
 * 측정: 순서를 고려한 LCS(최장 공통 부분 수열) → recall/precision의 F1.
 * 빠뜨린/잘못 발음한 단어를 목표 문장 순서 그대로 색칠할 수 있도록 단어별 매칭도 돌려준다.
 */

export interface AlignedWord {
  w: string;
  ok: boolean;
}

export interface AlignedScore {
  score: number;
  diff: AlignedWord[];
  missed: string[];
}

/** 소문자·영숫자·어포스트로피만 남긴 단어 열 — 채점과 에코 비교가 같은 정규화를 쓴다 */
export function normWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function alignedScore(target: string, said: string): AlignedScore {
  const a = normWords(target);
  const b = normWords(said);
  if (!a.length || !b.length) {
    return { score: 0, diff: a.map((w) => ({ w, ok: false })), missed: a };
  }

  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // dp 테이블을 거슬러 올라가며 어느 목표 단어가 발화에서 실제로 매칭됐는지 표시
  const matched = new Array<boolean>(a.length).fill(false);
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matched[i - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const lcs = dp[a.length][b.length];
  const recall = lcs / a.length;
  const precision = lcs / b.length;
  const f1 = (2 * recall * precision) / (recall + precision || 1);
  const diff = a.map((w, idx) => ({ w, ok: matched[idx] }));
  const missed = a.filter((_, idx) => !matched[idx]);
  return { score: Math.round(f1 * 100), diff, missed };
}

/**
 * 화면용 diff — alignedScore.diff는 정규화된 소문자 단어("i'll")라 학습자에게 그대로 보이면 원문과 달라진다.
 * 원문을 공백 단위로 다시 나눠 각 토큰("I'll", "broken?")에 해당하는 정규화 단어들의 일치 여부를 묶는다
 * (토큰 안의 단어가 하나라도 틀리면 그 토큰은 틀림). 정규화 단어가 없는 토큰("—")은 앞 토큰에 붙인다.
 * 개수가 맞지 않으면(이론상 없음) 원래 diff를 그대로 돌려준다.
 */
export function displayDiff(target: string, diff: AlignedWord[]): AlignedWord[] {
  const out: AlignedWord[] = [];
  let k = 0;
  for (const tok of target.split(/\s+/).filter(Boolean)) {
    const n = normWords(tok).length;
    if (!n) {
      if (out.length) out[out.length - 1] = { ...out[out.length - 1], w: `${out[out.length - 1].w} ${tok}` };
      continue;
    }
    const part = diff.slice(k, k + n);
    if (part.length < n) return diff;
    k += n;
    out.push({ w: tok, ok: part.every((d) => d.ok) });
  }
  return k === diff.length ? out : diff;
}
