"""
═══════════════════════════════════════════════════════════════
 영어 면접 파이프라인 — IT 영업 직군 (Groq 단일 백엔드)

 구성 요소:
   · 질문 은행     data/interview_bank.json — 빈출 질문 + 답변용 표현(KR↔EN)
   · 내 프로필     data/my_profile.md — 이력·성과 (수정하면 다음 요청에 자동 반영)
   · 근거 선택     프로필은 전체 주입(작음), 표현 은행은 키워드 매칭 top-k
                  → 임베딩/벡터DB 불필요 (외부 의존은 Groq 하나로 통일)
   · 답변 생성     질문 → 프로필 + 표현 근거 → 영어 답변(한국어 번역 포함)
   · 답변 피드백   내가 말한 답변(STT 텍스트) → STAR 구조 체크 + 표현 업그레이드

 완전히 독립된 프로젝트 — 다른 앱의 코드/데이터에 의존하지 않는다.
 의존성 0 (stdlib만 사용).
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Any

import llm
from speech_metrics import deterministic_metrics

DATA_DIR = Path(__file__).parent / "data"
BANK_PATH = DATA_DIR / "interview_bank.json"
PROFILE_PATH = DATA_DIR / "my_profile.md"
STORY_PATH = DATA_DIR / "my_story.md"
ANSWERS_PATH = DATA_DIR / "my_answers.json"   # 사전 생성된 맞춤 답변셋 (개인 데이터 — 커밋 금지)


# ─────────────────────────────────────────────────────────────
#  질문 은행
# ─────────────────────────────────────────────────────────────
def _load_bank() -> dict:
    if not BANK_PATH.exists():
        return {"meta": {"category_labels": {}}, "questions": [], "phrases": []}
    return json.loads(BANK_PATH.read_text(encoding="utf-8"))


def list_categories() -> list[dict]:
    bank = _load_bank()
    labels = bank.get("meta", {}).get("category_labels", {})
    counts: dict[str, int] = {}
    for q in bank.get("questions", []):
        counts[q["category"]] = counts.get(q["category"], 0) + 1
    return [
        {"id": cat, "label_ko": labels.get(cat, cat), "count": n}
        for cat, n in counts.items()
    ]


def pick_question(category: str | None = None, difficulty: int | None = None,
                  exclude: list[str] | None = None) -> dict | None:
    """조건에 맞는 질문을 무작위로 하나 뽑는다. exclude로 이미 나온 질문 제외."""
    bank = _load_bank()
    exclude_set = {e for e in (exclude or []) if e}
    pool = [
        q for q in bank.get("questions", [])
        if (not category or q["category"] == category)
        and (not difficulty or q.get("difficulty") == difficulty)
        and q["id"] not in exclude_set
    ]
    if not pool:
        # 전부 소진됐으면 exclude를 풀고 다시 (무한 연습 가능하도록)
        pool = [
            q for q in bank.get("questions", [])
            if (not category or q["category"] == category)
            and (not difficulty or q.get("difficulty") == difficulty)
        ]
    if not pool:
        return None
    q = dict(random.choice(pool))
    labels = bank.get("meta", {}).get("category_labels", {})
    q["category_label_ko"] = labels.get(q["category"], q["category"])
    return q


# ─────────────────────────────────────────────────────────────
#  프로필 청크 — my_profile.md를 '섹션 + 불릿 한 줄' 단위로 쪼갠다
# ─────────────────────────────────────────────────────────────
def _profile_chunks() -> list[str]:
    if not PROFILE_PATH.exists():
        return []
    chunks: list[str] = []
    section = ""
    for raw in PROFILE_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("## "):
            section = line[3:].strip()
        elif line.startswith("- ") and len(line) > 6:
            text = line[2:].strip()
            chunks.append(f"[{section}] {text}" if section else text)
    return chunks


# ─────────────────────────────────────────────────────────────
#  내 스토리 — my_story.md를 '## 사례' 단위로 쪼개 답변의 원천으로 사용
# ─────────────────────────────────────────────────────────────
def _story_chunks() -> list[str]:
    """'## 제목' 섹션 단위로 분할 (헤딩이 없으면 빈 줄 기준 문단 분할)."""
    if not STORY_PATH.exists():
        return []
    text = STORY_PATH.read_text(encoding="utf-8")
    # 안내 주석(blockquote) 제거
    lines = [l for l in text.splitlines() if not l.strip().startswith(">")]
    text = "\n".join(lines)
    if "## " in text:
        chunks = []
        for part in re.split(r"(?=^## )", text, flags=re.M):
            part = part.strip()
            if part.startswith("## ") and len(part) > 20:
                chunks.append(part[:900])
        return chunks
    return [p.strip()[:900] for p in text.split("\n\n") if len(p.strip()) > 40]


# ─────────────────────────────────────────────────────────────
#  근거 선택 — 프로필은 전체 주입, 표현/스토리는 키워드 매칭 top-k
#  (코퍼스가 수십 개 규모라 임베딩 없이도 충분하고, 지연이 0ms)
# ─────────────────────────────────────────────────────────────
_WORD_RE = re.compile(r"[a-zA-Z가-힣']+")
_STOPWORDS = {"the", "a", "an", "and", "or", "but", "you", "your", "can", "could",
              "would", "do", "did", "does", "have", "has", "how", "what", "why",
              "tell", "about", "for", "with", "that", "this", "are", "is", "was", "were"}


def _norm_words(text: str) -> set[str]:
    return {w for w in _WORD_RE.findall(text.lower()) if len(w) > 2 and w not in _STOPWORDS}


def _keyword_stories(query: str, k: int = 2) -> list[str]:
    words = _norm_words(query)
    scored: list[tuple[int, str]] = []
    for chunk in _story_chunks():
        score = sum(1 for w in words if w in chunk.lower())
        if score:
            scored.append((score, chunk))
    scored.sort(key=lambda t: -t[0])
    picked = [c for _, c in scored[:k]]
    # 매칭이 없으면 첫 사례라도 넣어 개인화 유지
    if not picked:
        picked = _story_chunks()[:1]
    return picked


def _keyword_phrases(query: str, k: int = 6) -> list[dict]:
    words = _norm_words(query)
    scored: list[tuple[int, dict]] = []
    for ph in _load_bank().get("phrases", []):
        text = f"{ph.get('en', '')} {ph.get('kr', '')} {ph.get('category', '')} {ph.get('note_ko', '')}".lower()
        score = sum(1 for w in words if w in text)
        if score:
            scored.append((score, ph))
    scored.sort(key=lambda t: -t[0])
    return [dict(p) for _, p in scored[:k]]


def _safe_retrieve(query: str, k_phrases: int = 6, k_profile: int = 99) -> dict[str, list[dict]]:
    """프로필 전체(작음) + 키워드 매칭 표현 top-k. 외부 호출 없음 → 항상 즉시 성공."""
    return {
        "phrases": _keyword_phrases(query, k_phrases),
        "profile": [{"text": c} for c in _profile_chunks()],
    }


def status() -> dict[str, Any]:
    bank = _load_bank()
    return {
        "questions": len(bank.get("questions", [])),
        "phrases": len(bank.get("phrases", [])),
        "profile_chunks": len(_profile_chunks()),
        "profile_exists": PROFILE_PATH.exists(),
        "story_chunks": len(_story_chunks()),
        "prepared_answers": len(_load_answers()),
        "provider": llm.provider(),
        "answer_model": llm.model_name(),
        "stt_model": llm.GROQ_STT_MODEL if llm.GROQ_API_KEY else None,
    }


# ─────────────────────────────────────────────────────────────
#  ⚡ 맞춤 답변셋 — 내 프로필+스토리로 질문 은행 전체의 답변을 미리 생성.
#  라이브에서 감지된 질문이 은행 질문과 매칭되면 생성 없이 0초 표시.
# ─────────────────────────────────────────────────────────────
_prep_state: dict[str, Any] = {"running": False, "done": 0, "total": 0, "current": "", "error": None}


def _load_answers() -> dict:
    if not ANSWERS_PATH.exists():
        return {}
    try:
        return json.loads(ANSWERS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def prep_status() -> dict[str, Any]:
    return {**_prep_state, "count": len(_load_answers())}


def _prep_prompt(q: dict, cefr: str = "B1") -> str:
    profile_lines = "\n".join(f"- {c}" for c in _profile_chunks()) or "- (없음)"
    story_lines = "\n\n".join(_keyword_stories(q["en"] + " " + q.get("kr", ""), k=3)) or "(없음)"
    phrases = _keyword_phrases(q["en"], 4)
    phrase_lines = "\n".join(f'- "{p["en"]}"' for p in phrases if p.get("en")) or "- (none)"
    return f"""You are an expert English interview coach preparing a Korean candidate
for an IT sales (cloud/SaaS) job interview in English.

Interview question: "{q['en']}" ({q.get('kr', '')})
Coaching tip for this question: {q.get('tip_ko', '-')}
Candidate CEFR level: {cefr} (answers must be realistically speakable at this level)

Candidate profile facts (Korean):
{profile_lines}

Candidate's own stories — THE most important source. Ground the answers in these
real experiences with their specific numbers and details:
\"\"\"{story_lines}\"\"\"

Useful phrases (reuse where natural):
{phrase_lines}

Write 2 spoken answers the candidate can read aloud (option 1: concise, 30-50
words; option 2: stronger with STAR structure and concrete numbers, 60-90 words).
Natural native-sounding US business English, first person, contractions.
Where the profile/story has [placeholders], substitute plausible round numbers
and keep them consistent.

Return ONLY valid JSON:
{{
  "gist_ko": "질문 요지 한국어 한 줄",
  "strategy_ko": "답변 전략 한국어 한 줄",
  "answers": [
    {{"en": "option 1", "kr": "자연스러운 한국어 번역"}},
    {{"en": "option 2", "kr": "자연스러운 한국어 번역"}}
  ]
}}"""


def build_my_answers(model: str | None = None, cefr: str = "B1") -> dict[str, Any]:
    """질문 은행 전체에 대해 맞춤 답변을 생성해 my_answers.json에 저장 (문항당 1~2초, Groq 기준)."""
    questions = _load_bank().get("questions", [])
    _prep_state.update(running=True, done=0, total=len(questions), current="", error=None)
    answers = _load_answers()
    try:
        for q in questions:
            _prep_state["current"] = q["en"]
            content = json.loads(llm.chat_once(
                [{"role": "user", "content": _prep_prompt(q, cefr)}],
                json_mode=True, temperature=0.4, max_tokens=900, model=model,
            ))
            answers[q["id"]] = {
                "question_en": q["en"], "question_kr": q.get("kr", ""),
                "category": q.get("category", ""), "cefr": cefr,
                "gist_ko": str(content.get("gist_ko", "")).strip(),
                "strategy_ko": str(content.get("strategy_ko", "")).strip(),
                "answers": (content.get("answers") or [])[:2],
            }
            # 문항마다 저장 — 중간에 끊겨도 진행분은 유지
            ANSWERS_PATH.write_text(json.dumps(answers, ensure_ascii=False, indent=1), encoding="utf-8")
            _prep_state["done"] += 1
    except Exception as e:  # noqa: BLE001
        _prep_state["error"] = str(e)
    finally:
        _prep_state["running"] = False
        _prep_state["current"] = ""
    return prep_status()


def cached_answer(question_text: str) -> dict | None:
    """라이브에서 감지된 질문 ↔ 미리 만든 답변 매칭 (키워드 겹침 비율).
    짧은 질문("Tell me about yourself" 등)은 불용어 제거 후 단어가 1개만 남으므로
    그 경우엔 단어 집합이 완전히 같을 때만 매칭한다(오탐 방지)."""
    answers = _load_answers()
    if not answers:
        return None
    qw = _norm_words(question_text)
    if not qw:
        return None
    best, best_score = None, 0.0
    for entry in answers.values():
        bw = _norm_words(entry.get("question_en", ""))
        if not bw:
            continue
        inter = len(qw & bw)
        small = min(len(qw), len(bw))
        if small <= 1:
            score = 1.0 if qw == bw else 0.0
        else:
            score = inter / small if inter >= 2 else 0.0
        if score > best_score:
            best, best_score = entry, score
    return best if best_score >= 0.6 else None


# ─────────────────────────────────────────────────────────────
#  모범 답변 생성 — 30초/60초/90초 3단계
# ─────────────────────────────────────────────────────────────
def _answers_prompt(question: str, cefr: str, refs: dict[str, list[dict]]) -> str:
    profile_lines = "\n".join(f"- {r['text']}" for r in refs["profile"]) or "- (프로필 정보 없음)"
    story_lines = "\n\n".join(_keyword_stories(question, k=2)) or "(없음)"
    phrase_lines = "\n".join(
        f'- "{r["en"]}" ({r["kr"]})' for r in refs["phrases"] if r.get("en")
    ) or "- (none)"

    return f"""You are an expert English interview coach preparing a Korean candidate
for an IT sales (cloud/SaaS solution sales) job interview conducted in English.

Interview question: "{question}"
Candidate CEFR level: {cefr} (write answers the candidate can realistically speak;
the 90s version may stretch one level above)

Candidate background facts (Korean, from their profile — personalize the answers
with these; where a fact contains a placeholder like [X], substitute a plausible
round number and stay consistent across all three answers; do NOT invent
achievements that contradict these facts):
{profile_lines}

Candidate's own stories (Korean — ground the examples in these real experiences):
\"\"\"{story_lines}\"\"\"

Reference expressions from an interview phrase bank (reuse them where natural):
{phrase_lines}

Write 3 versions of a strong SPOKEN answer to the interview question:
1. version "30s" — concise core answer, ~60-80 words
2. version "60s" — standard answer with one concrete example, ~120-150 words
3. version "90s" — advanced answer with clear STAR structure and numbers, ~180-220 words

Return ONLY valid JSON (no markdown) with this exact shape:
{{
  "answers": [
    {{
      "version": "30s|60s|90s",
      "en": "the full spoken answer",
      "kr_gist": "한국어로 답변 요지 1~2문장",
      "key_expressions": [{{"en": "phrase worth memorizing", "kr": "뜻"}}],
      "tip_ko": "이 버전을 말할 때의 전달 팁 한 줄 (한국어)"
    }}
  ]
}}

Rules:
- First person, natural spoken English with contractions (I'm, I've, that's).
- Sound like a native speaker in a US business setting: natural rhythm, light
  discourse markers (Well / Actually / To be honest), no textbook or
  translated-sounding phrasing.
- No bullet points inside "en" — it must flow as speech.
- key_expressions: 2-3 phrases per answer, taken FROM that answer.
- All three answers must tell a consistent story (same numbers, same facts)."""


def generate_answers(question: str, cefr: str = "B1", model: str | None = None) -> dict[str, Any]:
    question = (question or "").strip()
    refs = _safe_retrieve(question)
    content = json.loads(llm.chat_once(
        [{"role": "user", "content": _answers_prompt(question, cefr, refs)}],
        json_mode=True, temperature=0.5, max_tokens=1600, model=model,
    ))
    return {
        "question": question,
        "cefr": cefr,
        "answers": (content.get("answers") or [])[:3],
        "profile_refs": refs["profile"],
        "phrase_refs": refs["phrases"],
        "provider": llm.provider(),
    }


# ─────────────────────────────────────────────────────────────
#  내 답변 피드백 — STAR 구조 체크 + 표현 업그레이드
# ─────────────────────────────────────────────────────────────
def _feedback_prompt(question: str, transcript: str, cefr: str, metrics: dict) -> str:
    wpm = metrics.get("wpm")
    wpm_line = f"- Speaking rate: {wpm:.0f} WPM" if wpm else "- Speaking rate: not measured"
    return f"""You are an expert interview coach evaluating a Korean candidate's spoken
English answer in an IT sales job interview. Be encouraging but concrete.

Interview question: "{question}"
Candidate CEFR level: {cefr}
Measured delivery metrics:
{wpm_line}
- Filler word ratio: {metrics.get('filler_ratio', 0)}

Candidate's answer transcript:
\"\"\"{transcript}\"\"\"

Return ONLY valid JSON (no markdown) with this exact shape:
{{
  "score": <0-10 float: overall interview-answer quality>,
  "star": {{
    "situation": <true|false>, "task": <true|false>,
    "action": <true|false>, "result": <true|false>,
    "note_ko": "STAR 구조 관점 코멘트 한 줄 (한국어)"
  }},
  "good_points_ko": ["잘한 점 (한국어, 최대 2개)"],
  "improvements": [
    {{"original": "candidate's phrase", "upgraded": "more professional interview English", "note_ko": "왜 더 나은지 한국어 한 줄"}}
  ],
  "summary_ko": "한국어 2문장 총평 — 격려 톤, 다음에 시도할 것 1가지 포함"
}}

Rules:
- Max 3 improvements, most impactful first.
- "upgraded" must sound like confident interview English, not just grammar fixes.
- If the question is not behavioral (e.g. "Why our company?"), judge STAR loosely
  and say so in note_ko.
- If the transcript is very short, score low and say more detail is needed."""


def feedback(question: str, transcript: str, cefr: str = "B1",
             duration_sec: float | None = None, model: str | None = None) -> dict[str, Any]:
    transcript = (transcript or "").strip()
    metrics = deterministic_metrics(transcript, duration_sec)
    if metrics["word_count"] < 5:
        return {
            "score": 0, "star": {"situation": False, "task": False, "action": False,
                                 "result": False, "note_ko": "답변이 너무 짧아 구조를 평가할 수 없어요."},
            "good_points_ko": [], "improvements": [], "metrics": metrics,
            "summary_ko": "답변이 너무 짧아요. 최소 3~4문장으로 다시 말해 보세요!",
        }
    content = json.loads(llm.chat_once(
        [{"role": "user", "content": _feedback_prompt(question, transcript, cefr, metrics)}],
        json_mode=True, temperature=0.3, max_tokens=800, model=model,
    ))
    try:
        score = max(0.0, min(10.0, float(content.get("score", 0))))
    except (TypeError, ValueError):
        score = 0.0
    star = content.get("star") or {}
    return {
        "score": round(score, 1),
        "star": {
            "situation": bool(star.get("situation")), "task": bool(star.get("task")),
            "action": bool(star.get("action")), "result": bool(star.get("result")),
            "note_ko": str(star.get("note_ko", "")).strip(),
        },
        "good_points_ko": (content.get("good_points_ko") or [])[:2],
        "improvements": (content.get("improvements") or [])[:3],
        "summary_ko": str(content.get("summary_ko", "")).strip(),
        "metrics": metrics,
    }


# ─────────────────────────────────────────────────────────────
#  🔴 라이브 모드 — 실전 화상 면접 중 실시간 답변 제안 / 세션 요약
#  (스트리밍 출력용 프롬프트만 만들고, 실제 스트리밍은 서버가 프록시)
# ─────────────────────────────────────────────────────────────
# 퀵 액션 의도 — Smooth AI의 동의하기/반박하기/질문하기/제안하기 벤치마킹
INTENT_GOALS = {
    "answer": "Directly answer what the interviewer just said/asked.",
    "agree": "AGREE with what was just said and reinforce it with one supporting "
             "point drawn from the candidate's background.",
    "disagree": "Politely PUSH BACK on what was just said with one concrete, "
                "respectful reason — disagree without being confrontational.",
    "ask": "ASK one sharp, professional clarifying or probing question about "
           "what was just said (the candidate wants to ask, not answer).",
    "propose": "Make one concrete, forward-moving SUGGESTION related to what "
               "was just said.",
}


def build_live_suggest_prompt(question: str, cefr: str = "B1", context: str = "",
                              intent: str = "answer") -> str:
    """면접관 발화 → 즉시 읽을 수 있는 답변 2개(+한국어 번역). intent로 의도 선택.
    context: 직전 대화(자막 로그) — 꼬리 질문(follow-up)에 맥락 있는 답변을 위해."""
    refs = _safe_retrieve(question, k_phrases=4, k_profile=4)
    profile_lines = "\n".join(f"- {r['text']}" for r in refs["profile"]) or "- (none)"
    phrase_lines = "\n".join(f'- "{r["en"]}"' for r in refs["phrases"] if r.get("en")) or "- (none)"
    goal = INTENT_GOALS.get(intent, INTENT_GOALS["answer"])
    story_lines = "\n\n".join(s[:450] for s in _keyword_stories(question, k=2)) or "(없음)"
    context_block = (
        "\nRecent conversation transcript (interviewer and candidate mixed; use it to"
        f" resolve what a follow-up refers to):\n\"\"\"{context}\"\"\"\n"
        if context.strip() else ""
    )
    # ⚡ 지연 최소화: 사용자가 바로 읽어야 하는 답변(EN)을 가장 먼저 출력시키고
    #    메타(요지/전략)는 맨 뒤로 — 첫 유효 토큰까지의 체감 대기를 최소화한다.
    return f"""You are a real-time interview copilot for a Korean candidate who is IN A LIVE
English video interview for an IT sales (cloud/SaaS) position RIGHT NOW.
Speed matters — the candidate is waiting to speak.
{context_block}
The interviewer just said:

"{question}"

The candidate's goal right now: {goal}

Candidate profile facts (Korean; substitute plausible round numbers for
[placeholders], never contradict them):
{profile_lines}

Candidate's own stories (Korean — ground answers in these real experiences):
\"\"\"{story_lines}\"\"\"

Useful phrases (reuse where natural):
{phrase_lines}

Respond in EXACTLY this format (plain text, no markdown), nothing else —
the first EN line MUST come first so the candidate can start speaking:
EN: <Option 1 — safe and concise, 25-45 words>
KR: <위 문장의 자연스러운 한국어 번역>
===
EN: <Option 2 — stronger, with one concrete number from the stories, 50-70 words>
KR: <위 문장의 자연스러운 한국어 번역>
===
META: 요지=<방금 발화의 핵심 한국어 한 줄> | 전략=<말하기 전략 한국어 한 줄>

Rules for the EN options:
- First person, confident tone, around CEFR {cefr} but natural.
- Native US business English: contractions, natural rhythm, a light discourse
  marker to open ("Well," / "Sure," / "That's a great question —"),
  no textbook or translated-sounding phrasing.
- The two options must take meaningfully different angles, not paraphrases.
- If it was a follow-up, connect to what was said before instead of repeating it."""


def build_live_report_prompt(transcript: str, metrics: dict) -> str:
    """면접 종료 후 사후 리포트 — 내 발화 분석 + 표현 업그레이드 + 예상 꼬리 질문."""
    wpm = metrics.get("wpm")
    return f"""Below is the full transcript of an English job interview for an IT sales
(cloud/SaaS) position. Lines are labeled 상대(interviewer) / 나(candidate, Korean
native speaker).

Transcript:
\"\"\"{transcript}\"\"\"

Candidate delivery metrics (from 나 lines only):
- Total words spoken: {metrics.get('word_count', 0):.0f}
- Filler word ratio: {metrics.get('filler_ratio', 0)}{f" / Speaking rate: {wpm:.0f} WPM" if wpm else ""}

당신은 면접 코치입니다. 지원자를 위한 사후 리포트를 한국어로 작성하세요
(마크다운 헤더 없이 아래 형식 그대로, 전체 280단어 이내):

✅ 잘한 점
- (불릿 2개 — 실제 발화를 근거로)

🔧 표현 업그레이드
- "내가 실제로 한 말(영어)" → "더 자연스러운 표현(영어)" — 한국어 한 줄 이유
- (총 3개, 가장 임팩트 큰 것부터)

❓ 예상 꼬리 질문 (다음 면접 대비)
- English question — 한국어 번역
- (총 2개, 이번 대화 흐름 기반)

🎯 다음 면접까지 연습 포인트
- (불릿 1~2개, 구체적인 행동으로)"""


def build_live_summary_prompt(transcript: str, mode: str = "full") -> str:
    """지금까지의 면접 트랜스크립트 → 한국어 요약.
    mode="line": 상단 바에 상시 표시되는 실시간 한 줄 요약 (Smooth AI 벤치마킹)
    mode="full": 요약 탭에서 보는 전체 정리"""
    if mode == "line":
        return f"""Below is the live transcript of an ongoing English job interview.

Transcript (most recent last):
\"\"\"{transcript}\"\"\"

지금 대화의 핵심 주제/상황을 한국어 한 문장(40자 이내)으로 요약하세요.
예: "영업 목표 달성 경험에 대한 심층 질문 진행 중"
문장 하나만 출력하고 다른 말은 붙이지 마세요."""

    return f"""Below is the live transcript of an ongoing English job interview
(IT sales position). It mixes the interviewer's and the candidate's speech.

Transcript:
\"\"\"{transcript}\"\"\"

한국어로 짧게 정리해 주세요 (전체 120단어 이내, 마크다운 헤더 없이):
📌 지금까지 나온 질문: (불릿 2~4개)
🗣 내 답변 요지: (불릿 1~2개)
⚠️ 주의/보완할 점: (불릿 1~2개 — 아직 안 나왔지만 준비할 질문 예상 포함)"""


if __name__ == "__main__":
    # 수동 테스트: python3 interview_pipeline.py "Tell me about yourself."
    import sys

    q = sys.argv[1] if len(sys.argv) > 1 else "Tell me about yourself."
    print(json.dumps(generate_answers(q, "B1"), ensure_ascii=False, indent=2))
