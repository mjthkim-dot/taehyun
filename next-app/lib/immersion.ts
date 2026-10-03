'use client';

/**
 * 몰입 스토리 — "이 앱만으로 고수"의 최대 격차인 **입력의 절대량**을 메우는
 * 무한 연재 리딩·리스닝. 교재 지문이 아니라 다음 화가 궁금한 연재물이라
 * 매일 돌아오게 만들고, 한 번 만든 화는 캐시되어 오프라인에서도 읽힌다.
 *
 * 난이도는 성숙도 커리큘럼과 연동된다(1~2단계 A2 → 3 B1 → 4 B2 → 5 C1) —
 * 실력이 승급하면 다음 화부터 어휘·문장이 함께 올라간다(i+1 유지).
 *
 * 화 구성: 문장(en, 탭하면 kr) 12~18개 + 단어장 4개 + 이해도 퀴즈 2문항.
 * 퀴즈를 제출하면 읽음 처리 + 단어장이 SRS(cat '몰입')로 들어간다(멱등).
 * 시드 2화 내장 — Groq 키 없이도 시리즈가 비어 보이지 않는다.
 */
import { load, store, addWeakItem, addPhrase } from './state';
import { groqKoJson, hasHangul } from './aiGuard';
import { computeMaturity } from './maturity';

export interface EpisodeQuiz {
  q: string;
  options: string[];
  answer: number;
}

export interface Episode {
  no: number;
  level: string;
  title: string;
  titleKr: string;
  sentences: { en: string; kr: string }[];
  vocab: { en: string; kr: string }[];
  quiz: EpisodeQuiz[];
  /** 다음 화 생성용 줄거리 요약(한국어) */
  recap: string;
}

const STORE_KEY = 'va_immersion';
const READ_KEY = 'va_immersion_read';
const MAX_EPISODES = 60;

export const SERIES_TITLE = 'The Message from Gate 43';

export const SEED_EPISODES: Episode[] = [
  {
    no: 1,
    level: 'A2',
    title: 'The Wrong Phone',
    titleKr: '바뀐 휴대폰',
    recap: '태오는 공항에서 자기 것과 똑같은 휴대폰을 실수로 바꿔 갖게 된다. 그 폰으로 "43번 게이트로 오지 마"라는 이상한 메시지가 도착한다.',
    sentences: [
      { en: 'Taeo was at the airport, waiting for his flight to Singapore.', kr: '태오는 공항에서 싱가포르행 비행기를 기다리고 있었다.' },
      { en: 'He was tired, so he bought a coffee and sat down near Gate 43.', kr: '피곤해서 커피를 사서 43번 게이트 근처에 앉았다.' },
      { en: 'A man in a gray coat sat next to him and put his phone on the table.', kr: '회색 코트를 입은 남자가 옆에 앉아 테이블에 휴대폰을 올려놓았다.' },
      { en: 'It was the same model as Taeo’s phone, with the same black case.', kr: '태오의 폰과 같은 기종에, 같은 검은색 케이스였다.' },
      { en: 'The man got a call, stood up quickly, and walked away.', kr: '남자는 전화를 받더니 급히 일어나 걸어가 버렸다.' },
      { en: 'Ten minutes later, Taeo picked up a phone and went to his gate.', kr: '10분 뒤, 태오는 휴대폰을 집어 들고 게이트로 갔다.' },
      { en: 'But when he tried to unlock it, his password did not work.', kr: '그런데 잠금을 풀려고 하자 비밀번호가 맞지 않았다.' },
      { en: 'This was not his phone.', kr: '그의 폰이 아니었다.' },
      { en: 'At that moment, the screen lit up with a new message.', kr: '그 순간, 화면에 새 메시지가 떴다.' },
      { en: 'It said: “Do not come to Gate 43. They are watching you.”', kr: '메시지에는 이렇게 적혀 있었다: "43번 게이트로 오지 마. 그들이 널 지켜보고 있어."' },
      { en: 'Taeo looked around slowly.', kr: '태오는 천천히 주위를 둘러보았다.' },
      { en: 'Two men near the coffee shop were looking straight at him.', kr: '커피숍 근처의 두 남자가 그를 똑바로 쳐다보고 있었다.' },
      { en: 'His flight was leaving from Gate 43 in twenty minutes.', kr: '그의 비행기는 20분 뒤 43번 게이트에서 출발할 예정이었다.' },
      { en: 'What should he do?', kr: '그는 어떻게 해야 할까?' },
    ],
    vocab: [
      { en: 'unlock the phone', kr: '휴대폰 잠금을 풀다' },
      { en: 'The screen lit up.', kr: '화면이 켜졌다·불이 들어왔다.' },
      { en: 'look straight at ~', kr: '~을 똑바로 쳐다보다' },
      { en: 'walk away', kr: '(말없이) 자리를 떠나다' },
    ],
    quiz: [
      { q: '태오의 폰이 아니라는 걸 어떻게 알았나?', options: ['색이 달라서', '비밀번호가 안 맞아서', '케이스가 달라서'], answer: 1 },
      { q: '메시지가 경고한 내용은?', options: ['비행기가 지연된다', '43번 게이트로 오지 마라', '커피숍을 피해라'], answer: 1 },
    ],
  },
  {
    no: 2,
    level: 'A2',
    title: 'Twenty Minutes',
    titleKr: '남은 20분',
    recap: '태오는 화장실에서 폰 주인 "J"와 통화한다. J는 "그 폰 안의 사진이 위험하다"며 30번 게이트의 안내 데스크 직원에게 폰을 맡기라 하고, 태오의 폰은 이미 회색 코트 남자가 가져갔다고 말한다.',
    sentences: [
      { en: 'Taeo did not go to Gate 43.', kr: '태오는 43번 게이트로 가지 않았다.' },
      { en: 'He walked into the bathroom and locked the door.', kr: '화장실로 들어가 문을 잠갔다.' },
      { en: 'The strange phone rang in his hand.', kr: '손에 든 낯선 폰이 울렸다.' },
      { en: 'The caller’s name was just one letter: “J”.', kr: '발신자 이름은 딱 한 글자, "J"였다.' },
      { en: 'He took a deep breath and answered.', kr: '그는 심호흡을 하고 전화를 받았다.' },
      { en: '“Listen carefully. We have three minutes,” a woman’s voice said.', kr: '"잘 들어요. 우리에겐 3분밖에 없어요." 여자 목소리가 말했다.' },
      { en: '“The man in the gray coat took your phone. It was not an accident.”', kr: '"회색 코트 남자가 당신 폰을 가져갔어요. 실수가 아니었어요."' },
      { en: '“Why me?” Taeo asked quietly.', kr: '"왜 저죠?" 태오가 조용히 물었다.' },
      { en: '“Wrong place, wrong time. But now you have something they want.”', kr: '"운이 나빴을 뿐이에요. 하지만 이제 당신은 그들이 원하는 걸 갖고 있어요."' },
      { en: '“There are photos on that phone. Do not open them. Just keep the phone safe.”', kr: '"그 폰엔 사진들이 있어요. 열어보지 말고, 폰만 안전하게 지켜요."' },
      { en: '“Go to the information desk at Gate 30. Ask for Mina.”', kr: '"30번 게이트 안내 데스크로 가서 미나를 찾아요."' },
      { en: '“How can I trust you?” he asked.', kr: '"당신을 어떻게 믿죠?" 그가 물었다.' },
      { en: 'The voice was silent for a second.', kr: '목소리가 잠시 멈췄다.' },
      { en: '“Because in ten seconds, the airport lights will go out.”', kr: '"10초 뒤에 공항 불이 꺼질 테니까요."' },
      { en: 'And then, everything went dark.', kr: '그리고 정말로, 모든 것이 어두워졌다.' },
    ],
    vocab: [
      { en: 'take a deep breath', kr: '심호흡을 하다' },
      { en: 'It was not an accident.', kr: '우연이 아니었다.' },
      { en: 'wrong place, wrong time', kr: '운 나쁘게 그 자리에 있었을 뿐' },
      { en: 'The lights went out.', kr: '불이 꺼졌다.' },
    ],
    quiz: [
      { q: 'J가 태오에게 시킨 일은?', options: ['사진을 지워라', '30번 게이트 데스크에서 미나를 찾아라', '경찰에 신고해라'], answer: 1 },
      { q: '전화의 마지막에 일어난 일은?', options: ['공항 불이 꺼졌다', '비행기가 떠났다', '남자가 돌아왔다'], answer: 0 },
    ],
  },
];

/* ── 저장/조회 ── */

function storedEpisodes(): Episode[] {
  return load<Episode[]>(STORE_KEY, []);
}

/** 시리즈 전체(시드 + 생성분), 화수 순. */
export function getEpisodes(): Episode[] {
  const gen = storedEpisodes();
  const genNos = new Set(gen.map((e) => e.no));
  return [...SEED_EPISODES.filter((e) => !genNos.has(e.no)), ...gen].sort((a, b) => a.no - b.no);
}

export function readEpisodes(): number[] {
  return load<number[]>(READ_KEY, []);
}

/** 현재 성숙도 단계 → 이야기 난이도. 승급하면 다음 화부터 올라간다(i+1). */
export function currentLevel(): string {
  const n = computeMaturity().stage.n;
  return n <= 2 ? 'A2' : n === 3 ? 'B1' : n === 4 ? 'B2' : 'C1';
}

/** 퀴즈 제출 — 읽음 처리 + 단어장을 SRS(cat '몰입')로(멱등). 반환: 새 등록 수. */
export function completeEpisode(ep: Episode): number {
  const read = readEpisodes();
  if (!read.includes(ep.no)) store(READ_KEY, [...read, ep.no]);
  else return 0;
  let added = 0;
  for (const v of ep.vocab) {
    if (!v.en?.trim()) continue;
    addPhrase({ en: v.en.trim(), kr: (v.kr || '').trim(), lesson: `몰입:${ep.no}화` });
    addWeakItem({ en: v.en.trim(), kr: (v.kr || '').trim(), lesson: `몰입:${ep.no}화`, cat: '몰입' });
    added += 1;
  }
  return added;
}

/* ── 다음 화 생성 ── */

const LEVEL_RULE: Record<string, string> = {
  A2: '아주 쉬운 어휘와 짧은 문장(CEFR A2). 현재·과거 시제 위주, 한 문장 12단어 이내.',
  B1: '일상 어휘(CEFR B1). 복문을 조금 섞되 관용구는 쉬운 것만.',
  B2: '자연스러운 구어체(CEFR B2). 구동사·관용 표현을 적극적으로, 문장 길이 다양하게.',
  C1: '원어민 수준(CEFR C1). 뉘앙스 있는 어휘, 은유, 긴 호흡의 문장을 섞어라.',
};

export interface NextResult {
  ok: boolean;
  episode?: Episode;
  error?: string;
}

/** 다음 화 생성 — 최근 3화 줄거리를 물려주고 클리프행어로 끝내게 한다. */
export async function generateNextEpisode(): Promise<NextResult> {
  const eps = getEpisodes();
  const last = eps[eps.length - 1];
  const nextNo = (last?.no || 0) + 1;
  const level = currentLevel();
  const recaps = eps.slice(-3).map((e) => `${e.no}화: ${e.recap}`).join('\n');

  const sys = [
    `너는 영어 학습용 연재 소설 "${SERIES_TITLE}"의 작가다. 한국인 학습자를 위해 아래 JSON만 출력한다:`,
    '{"title":"이번 화 영어 제목","titleKr":"제목 한국어 번역",',
    ' "sentences":[{"en":"영어 문장","kr":"한국어 번역"} — 12~16개, 이야기가 이어지는 산문],',
    ' "vocab":[{"en":"이번 화의 유용한 표현","kr":"뜻"} — 4개],',
    ' "quiz":[{"q":"내용 이해 질문(한국어)","options":["보기1","보기2","보기3"],"answer":0} — 2개],',
    ' "recap":"이번 화 줄거리 요약 한두 문장(한국어)"}',
    `난이도 규칙: ${LEVEL_RULE[level] || LEVEL_RULE.B1}`,
    '규칙: en은 영어로만, kr·q·options·recap은 반드시 한국어. 지난 줄거리와 모순되지 않게 잇고, 마지막 문장은 다음 화가 궁금한 클리프행어로 끝내라.',
  ].join('\n');

  try {
    const picked = await groqKoJson<Omit<Episode, 'no' | 'level'>>(
      [
        { role: 'system', content: sys },
        { role: 'user', content: `지금까지의 줄거리:\n${recaps}\n\n${nextNo}화를 써라.` },
      ],
      { temperature: 0.7, maxTokens: 1400 },
      (data) => {
        const o = (data ?? {}) as Record<string, unknown>;
        const sentences = (Array.isArray(o.sentences) ? (o.sentences as { en?: string; kr?: string }[]) : [])
          .filter((s) => typeof s.en === 'string' && s.en.trim() && !hasHangul(s.en) && hasHangul(s.kr))
          .map((s) => ({ en: String(s.en).trim(), kr: String(s.kr).trim() }))
          .slice(0, 18);
        if (sentences.length < 8 || !hasHangul(o.titleKr) || !hasHangul(o.recap)) return null;
        const vocab = (Array.isArray(o.vocab) ? (o.vocab as { en?: string; kr?: string }[]) : [])
          .filter((v) => typeof v.en === 'string' && v.en.trim() && !hasHangul(v.en) && hasHangul(v.kr))
          .map((v) => ({ en: String(v.en).trim(), kr: String(v.kr).trim() }))
          .slice(0, 4);
        const quiz = (Array.isArray(o.quiz) ? (o.quiz as Partial<EpisodeQuiz>[]) : [])
          .filter(
            (q) =>
              hasHangul(q.q) &&
              Array.isArray(q.options) &&
              q.options.length === 3 &&
              q.options.every((x) => hasHangul(x)) &&
              typeof q.answer === 'number' &&
              q.answer >= 0 &&
              q.answer <= 2
          )
          .map((q) => ({ q: String(q.q).trim(), options: (q.options as string[]).map(String), answer: q.answer as number }))
          .slice(0, 2);
        return {
          title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : `Episode ${nextNo}`,
          titleKr: String(o.titleKr).trim(),
          sentences,
          vocab,
          quiz,
          recap: String(o.recap).trim(),
        };
      }
    );
    if (!picked) return { ok: false, error: 'ai' };
    const episode: Episode = { no: nextNo, level, ...picked };
    const gen = [...storedEpisodes(), episode].slice(-MAX_EPISODES);
    store(STORE_KEY, gen);
    return { ok: true, episode };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || String(e) };
  }
}
