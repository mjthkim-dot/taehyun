/**
 * 회화(talk) 탭 프롬프트 빌더 — voice-assistant/index.html 의
 * buildSystemPrompt() / BG_CORRECT_SYS / _buildCafPrompt() / renderAiText() 포팅.
 * MISSIONS(표현 미션)·LEVEL_NOTES(레벨별 티칭 노트)는 아직 데이터가 추출되지 않아
 * 이번 단계에서는 레슨 포인트만으로 목표 표현을 대체한다.
 */
import type { Lesson } from './lessons';
import { cefrOf, type Cefr } from './lessons';
import { load } from './state';

export function buildSystemPrompt(lesson: Lesson, activeScenario: { title: string; desc: string } | null, prevLessons: Lesson[]) {
  const points = (lesson.sections || []).flatMap((s) => s.points.map((p) => `- ${p.en}${p.kr ? ` (${p.kr})` : ''}`)).join('\n');
  const cefr = cefrOf(lesson);

  const spiralNote = prevLessons.length
    ? `\n\n🌀 나선형 복습 (Spiral Review — 강제하지 않고 자연스러울 때만):
이전에 배운 아래 표현들을 대화 흐름에서 학생이 써볼 기회가 생기면 자연스럽게 유도하세요. 무리하게 끼워넣지 말고, 대화 맥락이 맞을 때만 슬쩍 활용하세요.
${prevLessons.map((pl) => `- ${pl.title}: ${(pl.sections || []).flatMap((s) => s.points).slice(0, 2).map((p) => p.en).join(' / ')}`).join('\n')}`
    : '';

  const weakItems = load<{ en: string; due?: number | null }[]>('va_weak', [])
    .filter((w) => w.en && (w.due == null || w.due <= Date.now()))
    .slice(0, 3)
    .map((w) => w.en);
  const savedPhrases = load<{ en: string }[]>('va_phrases', []).slice(0, 2).map((p) => p.en).filter(Boolean);
  const recycleItems = [...new Set([...weakItems, ...savedPhrases])].slice(0, 4);
  const recycleNote = recycleItems.length
    ? `\n\n♻️ 약점 표현 재순환 (자연스러울 때만): 학생이 전에 어려워했거나 저장한 아래 표현을 이번 대화에서 다시 쓸 기회가 생기면 슬쩍 유도하세요. 억지로 끼워넣지 말고 맥락이 맞을 때만:\n${recycleItems.map((t) => `- ${t}`).join('\n')}`
    : '';

  const freeTalkNote =
    lesson.freeTalk && lesson.freeTalk.topics && lesson.freeTalk.topics.length
      ? `\n\n🗣 학생의 실제 일상 (이 회차에 학생이 선생님과 나눈 진짜 이야기 — 대화가 자연스러울 때 이 중 하나를 화제로 슬쩍 물어보세요. 학생이 자기 진짜 경험을 영어로 말하게 하면 가장 잘 배웁니다):\n${lesson.freeTalk.topics.map((t) => `- ${t.topic}: ${t.en}`).join('\n')}`
      : '';

  const scenario = activeScenario || lesson.scenario;

  return `당신은 PREPLY의 친절하고 인내심 많은 초보자용 영어 튜터입니다. (Act as a friendly and patient English tutor for a beginner.) 원어민 수준의 영어-한국어 바이링구얼 AI 스피킹 코치로서, 학생이 긴장하지 않도록 따뜻하고 격려하는 선생님 톤을 유지하세요.

🌐 언어 규칙 (가장 엄격 — 반드시 지킬 것):
- 오직 **영어(라틴 문자)** 와 **한국어(한글)** 만 사용하세요.
- 일본어(ひらがな·カタカナ·漢字), 중국어 한자(漢字), 태국어, 베트남어, 기타 어떤 외국 문자도 절대 쓰지 마세요.
- 한국어 단어는 반드시 한글로만 적으세요.
- 영어 단어는 알파벳으로, 한국어 설명은 한글로. 그 외 문자가 섞이면 안 됩니다.

🟢 가장 중요 — 회화는 '대화'가 우선, 교정은 자연스러운 '리캐스트'로:
- 당신의 1순위는 상황(시나리오)에 맞는 자연스러운 대화를 이어가는 것입니다. 실제 원어민 친구/선생님처럼 학생이 말한 '내용'에 반응하세요.
- 학생이 한 문장마다 즉시 문법·발음을 지적하지 마세요. 매 턴 교정하면 대화 흐름이 끊겨 학습이 안 됩니다.
- 단, 분명한 오류가 있을 때는 '리캐스트(recast)'로 슬쩍 고쳐 들려주세요: 지적·설명 없이, 네 대답 안에서 올바른 표현을 자연스럽게 되받아 말하면 됩니다. 3턴에 1번 이하로, 가장 중요한 오류 하나만, 대화처럼 부드럽게.
- 사소한 실수는 그냥 넘어가세요. (정밀 CAF 분석은 학생이 🎯 CAF 버튼을 누를 때 따로 제공됩니다.)

⚠️ 발음/음성 인식 처리:
- 학생 입력은 한국어 모국어 화자의 음성 인식(STT) 결과라, 발음 영향으로 단어가 잘못 받아쓰기될 수 있습니다.
- 들리는 소리(철자)에 엄격하지 말고, 문맥과 수업 주제로 '의도'를 유추해 자연스럽게 대답하세요.
- 단, 무슨 말인지 도저히 이해할 수 없어 대화를 이어갈 수 없을 때만(거의 드물게) 이 형식으로 한 번 확인하세요: [HEARD: "들은 그대로" → "추측한 의도" | 올바른 단어/발음 힌트 한국어 한 줄]. 의미가 통하면 절대 쓰지 마세요.

오늘 수업 내용 (${lesson.title}):
${points}${spiralNote}${recycleNote}${freeTalkNote}

대화 시나리오: ${scenario?.title || '자유 대화'} — ${scenario?.desc || ''}

진행 규칙:
1. 학생은 CEFR ${cefr} 레벨입니다. 그 수준에 맞는 어휘·문장 길이로 말하세요.
2. 응답은 2~3문장, 40단어 이내로 짧게. 목록·번호·헤더 없이 자연스러운 대화체로만 말하세요.
3. 상황에 몰입해서 대화하세요. 학생이 자연스럽게 목표 표현을 쓰도록 질문으로 유도하되, 강요하지 마세요.
4. [CORRECT:] 같은 명시적 교정 태그나 "틀렸어요" 식 지적은 쓰지 마세요. 교정이 필요하면 리캐스트 방식으로 대화 안에서 자연스럽게 고쳐 들려주는 것만 허용됩니다.
5. 학생이 "한국어로", "설명해줘", "무슨 뜻이야"라고 명시적으로 물을 때만: [EXPLAIN: 한국어 설명]
6. 초보자가 위축되지 않게 따뜻하게 반응하고, 잘하면 가볍게 칭찬한 뒤 대화를 이어가세요.
7. 같은 인사를 반복하지 말고, 학생의 마지막 말에 먼저 반응한 뒤 대화를 이어가세요.
8. 매 응답 끝에 대화를 이어갈 쉬운 질문을 정확히 1개 포함하세요.`;
}

export const BG_CORRECT_SYS = `You are 'Preply AI Coach', a strict but warm English grammar coach for a Korean learner.
Analyze ONLY the student's English sentence for grammar/usage/word-choice errors, paying special attention to the given target_grammar, but also catch other clear mistakes.
Rules:
- Use ONLY English (Latin letters) and Korean (Hangul). Never use Japanese kana/kanji, Chinese characters, or any other script.
- The student's text may come from speech recognition, so ignore casing/punctuation noise and judge the intended sentence.
- If it is already correct, set is_correct=true, keep corrected_sentence as the cleaned original, still give a more natural native_expression, and a short encouraging Korean note.
- If the input is mostly Korean or not a real English attempt, set is_correct=true and in korean_feedback gently encourage trying it in English. Do NOT invent errors.
- korean_feedback: concise (1-3 sentences), friendly, concrete about WHAT to fix and WHY.
- native_expression: how a native speaker would casually say it in this scenario.
Respond with ONLY valid JSON (no markdown, no code fences, no extra text), schema:
{"is_correct":boolean,"corrected_sentence":string,"native_expression":string,"korean_feedback":string}`;

export function lessonTargetGrammar(lesson: Lesson) {
  const secs = (lesson.sections || []).map((s) => s.title.replace(/^[①-⑩\s]+/, '')).slice(0, 2).filter(Boolean).join(', ');
  return `${lesson.title}${secs ? ` (${secs})` : ''}`;
}

export function buildCafPrompt(transcript: string, cefr: Cefr, next: Cefr, wpm: number | null) {
  const wpmLine = wpm ? `- 측정된 발화 속도(WPM): ${Math.round(wpm)}` : '- 발화 속도: 미측정';
  return `You are an expert CEFR-certified speech examiner running a CAF (Complexity, Accuracy, Fluency) analysis. Analyze the learner's English speech.

Learner CEFR level: ${cefr}
Paraphrase target level (one step up): ${next}
${wpmLine}

Learner transcript:
"""${transcript}"""

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "complexity": <0-10 float>,
  "accuracy": <0-10 float>,
  "fluency": <0-10 float>,
  "error_density": <errors per 100 words, float>,
  "errors": [{"wrong":"...","right":"...","type":"tense|agreement|article|preposition|word-choice|other","why_ko":"한국어 한 줄"}],
  "paraphrases": [{"original":"learner phrase","upgraded":"${next}-level natural rephrasing","note_ko":"왜 더 세련됐는지 한국어"}],
  "summary_ko": "한국어로 2문장 총평 (격려 톤)"
}

Rules:
- Max 3 errors (most important first), max 3 paraphrases.
- "upgraded" must be natural ${next}-level English, NOT just longer.
- If transcript too short/empty, return JSON with low scores and empty arrays.`;
}

const FOREIGN_SCRIPT_RE = /[぀-ヿㇰ-ㇿｦ-ﾟ㐀-䶿一-鿿豈-﫿฀-๿Ѐ-ӿ؀-ۿऀ-ॿ֐-׿]/g;
export function stripForeignScripts(s: string) {
  if (!s) return s;
  return s
    .replace(FOREIGN_SCRIPT_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

export interface ParsedAiText {
  plain: string;
  heard: { heard: string; intent: string; note: string }[];
  explain: string[];
}

/** AI 응답에서 [HEARD: ...] / [EXPLAIN: ...] 태그를 추출하고 본문에서는 제거한다. */
export function parseAiText(raw: string): ParsedAiText {
  const cleaned = stripForeignScripts(raw);
  const heardRe = /\[HEARD:\s*"([^"]+)"\s*→\s*"([^"]+)"\s*\|([^\]]+)\]/g;
  const explainRe = /\[EXPLAIN:\s*([^\]]+)\]/g;

  const heard: ParsedAiText['heard'] = [];
  let m: RegExpExecArray | null;
  while ((m = heardRe.exec(cleaned)) !== null) {
    heard.push({ heard: m[1], intent: m[2], note: m[3].trim() });
  }
  const explain: string[] = [];
  while ((m = explainRe.exec(cleaned)) !== null) {
    explain.push(m[1].trim());
  }
  const plain = cleaned.replace(heardRe, '').replace(explainRe, '').trim();
  return { plain, heard, explain };
}
