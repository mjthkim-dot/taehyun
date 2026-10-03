/**
 * 발음 진단 — "왜 틀렸는지"를 말해 주는 계층.
 *
 * 지금까지 채점은 목표 문장과 인식 결과를 단어 단위로 맞춰 보고 **틀린 단어를
 * 빨갛게 칠하는 것**이 전부였다. 학습자 입장에서는 "work를 못 맞혔다"까지만 알고,
 * 정작 중요한 정보 — walk로 들렸다는 사실, 그게 R 발음 때문이라는 것 — 는
 * 화면에 나오지 않는다. 혼자 연습하는 사람은 그 지점에서 더 나아갈 수가 없다.
 *
 * Whisper로 옮기면서 상황이 달라졌다. 브라우저 내장 인식은 문맥으로 단어를
 * '고쳐서' 돌려주지만(그래서 발음이 나빠도 정답으로 나오곤 했다), Whisper는
 * 들린 대로 옮긴다. 즉 **잘못 들린 단어 자체가 진단 자료**다. 여기서 그걸 읽는다.
 *
 * 방법은 두 단계다.
 *   ① 목표와 발화를 단어 단위로 정렬한다(치환·누락·삽입 구분).
 *   ② 치환된 짝은 철자를 거친 음소 기호로 바꿔 다시 정렬하고, 어긋난 자리를
 *      한국어 화자의 전형적 혼동 표에 대응시킨다.
 *
 * 철자에서 음소를 추정하는 것은 근사다(영어 철자는 발음을 정확히 담지 않는다).
 * 다만 여기서 잡으려는 것은 R/L, F/P, V/B, TH, 어말 자음, 관사·전치사 누락처럼
 * **한국어 화자에게 반복되는 몇 가지 축**이고, 그 축은 철자 차이로도 충분히
 * 드러난다(work/walk, three/tree, very/berry, coffee/copy). 확신할 수 없는
 * 경우에는 억지로 이름 붙이지 않고 '다른 단어로 들림'으로 남긴다 — 틀린 진단은
 * 진단이 없는 것보다 나쁘다.
 */

export type LapseKey =
  | 'r-l'
  | 'f-p'
  | 'v-b'
  | 'th'
  | 'z-s'
  | 'sh-s'
  | 'ch-j'
  | 'voicing'
  | 'vowel-long'
  | 'vowel-ae-e'
  | 'vowel'
  | 'final-consonant'
  | 'inflection'
  | 'article'
  | 'preposition'
  | 'omission'
  | 'other';

export interface PronIssue {
  /** 목표 단어 */
  target: string;
  /** 들린 단어 — 빈 문자열이면 아예 들리지 않았다는 뜻 */
  heard: string;
  key: LapseKey;
  /** 짧은 이름(칩에 표시) */
  label: string;
  /** 교정 방법 한두 문장 */
  tip: string;
}

interface TipDef {
  label: string;
  tip: string;
}

/** 한국어 화자에게 반복되는 발음 축과 교정법. 화면·주간 리포트가 함께 쓴다. */
export const LAPSE_TIPS: Record<LapseKey, TipDef> = {
  'r-l': {
    label: 'R / L',
    tip: 'R은 혀끝을 입천장 어디에도 대지 않고 안쪽으로 말아 올리고, L은 혀끝을 윗니 뒤 잇몸에 확실히 붙입니다. 한국어 ㄹ은 그 중간이라 둘 다 아닌 소리로 들립니다.',
  },
  'f-p': {
    label: 'F / P',
    tip: 'F는 윗니를 아랫입술에 대고 바람을 흘려보냅니다. 입술을 붙였다 터뜨리면 P가 되어 coffee가 copy처럼 들립니다.',
  },
  'v-b': {
    label: 'V / B',
    tip: 'V도 윗니를 아랫입술에 댄 채 성대를 울리며 이어서 냅니다. 입술을 붙이면 B가 되어 very가 berry가 됩니다.',
  },
  th: {
    label: 'TH',
    tip: '혀끝을 윗니 사이로 살짝 내밀고 그 틈으로 바람을 냅니다. S나 T로 대신하면 three가 tree·see로 들립니다.',
  },
  'z-s': {
    label: 'Z 유성음',
    tip: 'Z는 S와 입 모양이 같고 성대만 울립니다. 목에 손을 대고 떨림이 느껴지는지 확인하세요.',
  },
  'sh-s': {
    label: 'SH / S',
    tip: 'SH는 입술을 앞으로 동그랗게 내밀고 혀를 뒤로 당깁니다. 입술을 펴면 S가 되어 she가 see로 들립니다.',
  },
  'ch-j': {
    label: 'CH / J',
    tip: 'J는 성대를 울리며 시작하고 CH는 울리지 않고 바람만 터뜨립니다. 한국어 ㅈ·ㅊ보다 입술을 더 내밀어 보세요.',
  },
  voicing: {
    label: '유성 · 무성',
    tip: '끝소리의 성대 울림이 뜻을 가릅니다(back / bag). 유성음은 앞 모음을 조금 더 길게 끌면 자연스럽게 구분됩니다.',
  },
  'vowel-long': {
    label: '장 · 단모음',
    tip: 'ship과 sheep처럼 길이와 입 모양이 다릅니다. 긴 쪽은 입을 옆으로 벌려 길게, 짧은 쪽은 힘을 빼고 짧게 냅니다.',
  },
  'vowel-ae-e': {
    label: '애 / 에',
    tip: 'bad의 모음은 턱을 더 내려 애와 아 사이로, bed의 모음은 짧은 에로 냅니다. 한국어로는 둘 다 애라서 겹쳐 들립니다.',
  },
  vowel: {
    label: '모음 구분',
    tip: '영어 모음은 한국어보다 촘촘해서 하나로 뭉치면 다른 단어가 됩니다(bug / bag, cup / cop). 목표 단어를 느리게 들으며 입을 벌리는 정도를 그대로 흉내 내 보세요.',
  },
  'final-consonant': {
    label: '어말 자음',
    tip: '끝 자음 뒤에 으를 붙이지 않습니다. good을 구드로 내면 음절이 하나 늘어 다른 단어로 들립니다.',
  },
  inflection: {
    label: '어미 -s / -ed / -ing',
    tip: '복수·시제 어미를 끝까지 발음해야 문법이 상대에게 들립니다. 한국어에 없는 습관이라 가장 자주 사라지는 부분입니다.',
  },
  article: {
    label: '관사',
    tip: 'a·an·the는 약하게라도 반드시 들어갑니다. 통째로 빠지면 원어민에게는 문장이 끊긴 것처럼 들립니다.',
  },
  preposition: {
    label: '전치사 · 기능어',
    tip: '약하게 발음되지만 빠지면 뜻이 달라집니다. 앞뒤 단어에 붙여 한 덩어리로 묶어 연습하세요.',
  },
  omission: {
    label: '단어 누락',
    tip: '이 단어가 아예 들리지 않았습니다. 속도를 조금 늦추고 문장을 끝까지 소리 내어 보세요.',
  },
  other: {
    label: '다른 단어로 들림',
    tip: '목표와 다른 단어로 인식됐습니다. 원어민 음성을 한 번 듣고 곧바로 따라 말해 보세요.',
  },
};

const ARTICLES = new Set(['a', 'an', 'the']);
const PREPOSITIONS = new Set([
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'into',
  'over', 'under', 'up', 'out', 'off', 'as',
]);

/** 채점과 동일한 기준으로 단어를 자른다(문장부호 제거·소문자화). */
export function words(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * 철자를 거친 음소 근사. 이중자(th·sh·ch·ph…)와 모음 덩어리를 한 기호로 묶어야
 * 정렬이 의미를 갖는다 — three와 tree를 글자로 비교하면 h 하나가 빠진 것으로만
 * 보이지만, 음소로 묶으면 θ가 t로 바뀐 것이 드러난다.
 */
export function phonemes(word: string): string[] {
  let w = (word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return [];
  // 묵음 e — 앞이 자음일 때만 떨어뜨린다(make → mak, see는 그대로)
  if (w.length > 3 && w.endsWith('e') && !'aeiou'.includes(w[w.length - 2])) w = w.slice(0, -1);

  const DIGRAPHS: [string, string][] = [
    ['igh', 'Y'], ['tch', 'C'], ['dge', 'J'],
    ['th', 'T'], ['sh', 'S'], ['ch', 'C'], ['ph', 'f'], ['wh', 'w'],
    ['ck', 'k'], ['qu', 'K'], ['ng', 'N'],
    ['ee', 'I'], ['ea', 'I'], ['ie', 'I'],
    ['oo', 'U'], ['ou', 'W'], ['ow', 'W'], ['oa', 'O'], ['oe', 'O'],
    ['ai', 'E'], ['ay', 'E'], ['ei', 'E'], ['ey', 'E'],
    ['oi', 'Q'], ['oy', 'Q'], ['au', 'A'], ['aw', 'A'],
  ];

  const out: string[] = [];
  for (let i = 0; i < w.length; ) {
    let hit = '';
    for (const [pat, sym] of DIGRAPHS) {
      if (w.startsWith(pat, i)) {
        hit = sym;
        i += pat.length;
        break;
      }
    }
    if (hit) {
      out.push(hit);
      continue;
    }
    let c = w[i];
    // c는 뒤따르는 모음에 따라 s/k로 갈린다, x는 두 소리
    if (c === 'c') c = 'eiy'.includes(w[i + 1] || '') ? 's' : 'k';
    else if (c === 'x') {
      out.push('k', 's');
      i++;
      continue;
    } else if (c === 'y') c = i === 0 ? 'y' : 'I';
    out.push(c);
    i++;
  }
  // 겹자음은 한 소리다(coffee의 ff)
  return out.filter((p, i) => p !== out[i - 1]);
}

/** 음소 치환 비용 — 아는 혼동 짝(R/L, TH/T, SH/S…)은 '반쯤 맞은 것'으로 센다.
 *  모두 1로 세면 she와 see가 완전히 다른 단어로 판정돼(닮음 0) 진단 대상에서
 *  빠져 버린다. 정작 그런 짝이야말로 진단해야 할 대상이다. */
function subCost(a: string, b: string): number {
  if (a === b) return 0;
  return pairKey(a, b) ? 0.5 : 1;
}

function editDistance(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + subCost(a[i - 1], b[j - 1])
      );
    }
  }
  return dp[a.length][b.length];
}

/** 두 단어가 얼마나 닮았는지(0~1) — 음소 기준. 0.5 아래면 '다른 단어'로 본다. */
export function similarity(a: string, b: string): number {
  const pa = phonemes(a);
  const pb = phonemes(b);
  if (!pa.length || !pb.length) return 0;
  return 1 - editDistance(pa, pb) / Math.max(pa.length, pb.length);
}

export type WordOp =
  | { op: 'match'; target: string; heard: string }
  | { op: 'sub'; target: string; heard: string }
  | { op: 'del'; target: string }
  | { op: 'ins'; heard: string };

/**
 * 단어 정렬 — 채점의 LCS와 달리 **치환을 인정한다**. LCS는 work와 walk를
 * '목표 누락 + 엉뚱한 삽입' 두 사건으로 보지만, 실제로는 한 단어를 잘못 발음한
 * 하나의 사건이고 그래야 진단이 가능하다.
 */
export function alignWords(target: string[], spoken: string[]): WordOp[] {
  const n = target.length;
  const m = spoken.length;
  const INDEL = 1;
  const cost = (i: number, j: number) => {
    if (target[i] === spoken[j]) return 0;
    const sim = similarity(target[i], spoken[j]);
    // 닮았을수록 싸게 — 안 닮았으면 지우고 넣는 편(2)보다 비싸게 만들어 치환을 막는다
    return sim >= 0.5 ? 1.2 - sim : 2.5;
  };

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i][0] = i * INDEL;
  for (let j = 1; j <= m; j++) dp[0][j] = j * INDEL;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + cost(i - 1, j - 1),
        dp[i - 1][j] + INDEL,
        dp[i][j - 1] + INDEL
      );
    }
  }

  const ops: WordOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + cost(i - 1, j - 1)) {
      const t = target[i - 1];
      const h = spoken[j - 1];
      ops.push(t === h ? { op: 'match', target: t, heard: h } : { op: 'sub', target: t, heard: h });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + INDEL) {
      ops.push({ op: 'del', target: target[i - 1] });
      i--;
    } else {
      ops.push({ op: 'ins', heard: spoken[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

/** 같은 어간에 어미만 다른가 — work / works / worked / working */
function inflectionOnly(a: string, b: string): boolean {
  const strip = (w: string) => w.replace(/(ies|es|s|ed|ing|'s)$/, '');
  const sa = strip(a);
  const sb = strip(b);
  return sa.length >= 3 && sa === sb && a !== b;
}

/** 음소 치환 짝 → 혼동 축. 순서 무관. */
const PAIRS: [string, string, LapseKey][] = [
  ['r', 'l', 'r-l'],
  ['f', 'p', 'f-p'],
  ['v', 'b', 'v-b'],
  ['T', 's', 'th'], ['T', 't', 'th'], ['T', 'd', 'th'], ['T', 'f', 'th'], ['T', 'z', 'th'],
  ['z', 's', 'z-s'], ['z', 'j', 'z-s'],
  ['S', 's', 'sh-s'],
  ['C', 'j', 'ch-j'], ['C', 'S', 'ch-j'], ['C', 'J', 'ch-j'],
  ['p', 'b', 'voicing'], ['t', 'd', 'voicing'], ['k', 'g', 'voicing'],
  ['I', 'i', 'vowel-long'], ['U', 'u', 'vowel-long'], ['I', 'e', 'vowel-long'],
  ['a', 'e', 'vowel-ae-e'],
  // 그 밖의 모음 혼동 — 축을 특정할 수는 없지만 '모음이 어긋났다'는 것만으로도
  // 조언이 달라진다(자음 교정을 엉뚱하게 권하지 않는다)
  ['u', 'a', 'vowel'], ['a', 'o', 'vowel'], ['e', 'i', 'vowel'], ['o', 'u', 'vowel'],
  ['u', 'o', 'vowel'], ['i', 'e', 'vowel'],
];

function pairKey(a: string, b: string): LapseKey | null {
  for (const [x, y, key] of PAIRS) {
    if ((a === x && b === y) || (a === y && b === x)) return key;
  }
  return null;
}

/** 잘못 들린 한 단어를 음소로 다시 정렬해 어느 축에서 어긋났는지 찾는다. */
function diagnosePair(target: string, heard: string): LapseKey {
  if (inflectionOnly(target, heard)) return 'inflection';
  const pa = phonemes(target);
  const pb = phonemes(heard);
  const ops = alignPhonemes(pa, pb);

  // 자음과 모음이 함께 어긋난 경우(work → walk는 o↔a와 r↔l이 동시에 일어난다)
  // 자음 축을 먼저 알린다 — 한국어 화자에게 더 자주·더 크게 어긋나는 쪽이고
  // 교정 동작도 분명하다.
  const found: LapseKey[] = [];
  for (const op of ops) {
    if (op.op === 'sub') {
      const key = pairKey(op.target, op.heard);
      if (key) found.push(key);
    }
  }
  const vowelAxis = (k: LapseKey) => k === 'vowel' || k === 'vowel-long' || k === 'vowel-ae-e';
  const consonant = found.find((k) => !vowelAxis(k));
  if (consonant) return consonant;
  if (found.length) return found[0];
  // 목표에만 있고 사라진 소리 — 끝자리 자음이면 어말 자음을 흘린 것으로 본다
  for (const op of ops) {
    if (op.op === 'del' && op.at === pa.length - 1 && !'aeiouIUEWOAQY'.includes(op.target)) {
      return 'final-consonant';
    }
  }
  return 'other';
}

type PhonOp =
  | { op: 'match'; target: string; heard: string; at: number }
  | { op: 'sub'; target: string; heard: string; at: number }
  | { op: 'del'; target: string; at: number }
  | { op: 'ins'; heard: string; at: number };

function alignPhonemes(a: string[], b: string[]): PhonOp[] {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) dp[i][0] = i;
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1
      );
    }
  }
  const ops: PhonOp[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      ops.push(
        a[i - 1] === b[j - 1]
          ? { op: 'match', target: a[i - 1], heard: b[j - 1], at: i - 1 }
          : { op: 'sub', target: a[i - 1], heard: b[j - 1], at: i - 1 }
      );
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ op: 'del', target: a[i - 1], at: i - 1 });
      i--;
    } else {
      ops.push({ op: 'ins', heard: b[j - 1], at: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}

/**
 * 목표 문장과 인식 결과를 비교해 발음 진단 목록을 만든다.
 * 같은 축은 한 번만 남기고(같은 조언을 세 줄 반복하지 않는다), 최대 3개까지.
 */
export function diagnose(target: string, spoken: string, max = 3): PronIssue[] {
  const t = words(target);
  const s = words(spoken);
  if (!t.length || !s.length) return [];

  const issues: PronIssue[] = [];
  const seen = new Set<LapseKey>();
  const push = (target: string, heard: string, key: LapseKey) => {
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ target, heard, key, label: LAPSE_TIPS[key].label, tip: LAPSE_TIPS[key].tip });
  };

  for (const op of alignWords(t, s)) {
    if (op.op === 'sub') push(op.target, op.heard, diagnosePair(op.target, op.heard));
    else if (op.op === 'del') {
      if (ARTICLES.has(op.target)) push(op.target, '', 'article');
      else if (PREPOSITIONS.has(op.target)) push(op.target, '', 'preposition');
      else push(op.target, '', 'omission');
    }
  }

  // 축이 여럿이면 자음·모음처럼 고칠 수 있는 것을 먼저 보여준다 —
  // '누락'은 원인이 아니라 결과라서 맨 뒤로 미룬다.
  const rank = (k: LapseKey) => (k === 'omission' || k === 'other' ? 1 : 0);
  return issues.sort((a, b) => rank(a.key) - rank(b.key)).slice(0, max);
}
