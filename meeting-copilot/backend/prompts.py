"""
발언 제안 프롬프트 — 검색된 내 자료에 근거해 '내가 실제로 말할 법한' 문장을 만든다.

이 앱의 차별점이 여기 있다. 일반 번역기·범용 코파일럿과 달리
 · 내 수업 노트에서 배운 표현을 우선 쓰고
 · 내 과거 미팅에서 실제로 쓴 말투를 따르고
 · 용어집의 정확한 도메인 단어를 쓴다
지어내기는 금지다 — 자료에 없는 수치·고객사명은 만들지 않는다.
"""
from __future__ import annotations

import re

import rag

# 퀵 액션 의도 — 미팅 공통 + 인터뷰 전용(8/27 HR 스크리닝 대비)
INTENTS = {
    "agree":    "AGREE with what was just said and add one concrete supporting point.",
    "pushback": "Politely PUSH BACK with one respectful, concrete reason.",
    "ask":      "ASK one sharp clarifying question about what was just said.",
    "propose":  "PROPOSE one concrete next step.",
    "reply":    "Respond directly to what was just said.",
    "buytime":  "Buy a few seconds gracefully while staying in control.",
    "translate": "Say the candidate's Korean intent below in natural business English.",
    # 인터뷰 프리셋 — '반박'은 면접에 부적절하다. 대신:
    # 버튼 키는 'elaborate'지만 프롬프트 문구는 쉬운 동사로 — 지시어가 생성문에
    # 메아리치면 speakability 금지어(elaborate)에 걸린다
    "elaborate": "SAY MORE about the previous answer with one concrete example from their experience.",
    "clarify":  "Politely ask the interviewer to REPHRASE or clarify the question — without sounding lost.",
    "counterq": "Ask the interviewer ONE thoughtful question back (team structure, onboarding, or success criteria).",
}

# 관련성 컷 — 시드 밖 질문(out-of-corpus) 대응의 핵심.
# BM25는 흔한 단어 하나만 겹쳐도 top-3을 채우므로, "매칭된 어절 질의어 수(match_terms)
# ≥ 2" 또는 의미(벡터) 히트만 '자료'로 인정한다. 컷을 통과한 게 하나도 없으면
# 자료 없이 프로필 기반으로 생성한다 — 무관 시드를 억지로 인용하는 것보다 낫다.
RAG_MIN_MATCH_TERMS = 2


def _strong_hits(hits: list[dict]) -> list[dict]:
    return [h for h in hits
            if h.get("match_terms", 0) >= RAG_MIN_MATCH_TERMS or "의미" in h.get("via", "")]


# 시드가 전혀 없는 질문(취미·실패담·이직 사유 등)에도 "말할 수 있는 답"이 나오게
# 하는 고정 프로필. '자료' 탭에 "# 내 프로필" 제목으로 노트를 넣으면 그것이 우선한다.
DEFAULT_PROFILE = """- B2B enterprise sales hunter at a Korean cloud MSP (AWS partner), 8+ years in tech sales
- Focus: new business — cold outreach, discovery, building champions, first deals from zero
- Sells cloud migration / FinOps / managed services to enterprise accounts
- Strengths: pipeline creation, multi-stakeholder deals, Korean enterprise buying culture
- English: improving fast; takes weekly 1:1 lessons; prepares and confirms key points in writing"""


def _profile(store) -> str:
    try:
        with store.connect() as con:
            row = con.execute(
                "SELECT text FROM chunks WHERE source='note' AND title LIKE '%내 프로필%' "
                "ORDER BY id DESC LIMIT 1").fetchone()
        if row and len(row[0].strip()) > 30:
            return row[0].split("[검색어]")[0].strip()
    except Exception:  # noqa: BLE001
        pass
    return DEFAULT_PROFILE

_PLACEHOLDER = re.compile(r"\[[^\]\n]{1,30}\]")


def _evidence_block(hits: list[dict]) -> tuple[str, list[str]]:
    if not hits:
        return "(no personal material retrieved — keep the reply generic and safe)", []
    lines, labels = [], []
    for h in hits:
        lines.append(f"[{h['source_label']} · {h['title']}]\n{h['text'][:600]}")
        labels.append(f"{h['source_label']}: {h['title']}")
    return "\n\n".join(lines), labels


# 검색 전용 꼬리표 — 말할 문장이 아니므로 뱃지 판정에서 제외한다
_TAIL = re.compile(r"\[검색어\].*", re.S)
# 한국어 주석 사이에 낀 영어 덩어리 (수업 노트는 대부분 이 형태다)
_EN_SPAN = re.compile(r"[A-Za-z][A-Za-z0-9'’.,!?\-]*(?:\s+[A-Za-z0-9'’.,!?\-]+){2,}")


def _learned_phrases(hits: list[dict], limit: int = 10) -> list[str]:
    """검색된 자료에서 '바로 쓸 수 있는 영어 표현'을 뽑는다.
    UI가 '📚 수업에서 배운 표현' 뱃지를 붙일지 판단하는 근거가 된다.

    수업 노트는 완결된 문장이 아니라 `I am looking forward to {weekend / trip ...}`
    처럼 한국어 주석·기호가 섞인 줄이 대부분이다. 마침표로 끝나는 문장만 찾으면
    정작 '수업에서 배운 표현' 뱃지가 수업 노트에서는 한 번도 켜지지 않는다.
    그래서 인용문 → 용어집의 실제 문장 → 노트 속 영어 덩어리 순으로 훑는다."""
    out: list[str] = []
    for h in hits:
        body = _TAIL.sub("", h["text"])
        for m in re.findall(r'["\u201c]([^"\u201d]{8,120})["\u201d]', body):
            out.append(m.strip())
        for m in re.findall(r"실제 문장:\s*(.+)", body):
            out.append(m.strip())
        for m in _EN_SPAN.findall(body):
            out.append(m.strip(" .,-"))
    seen, uniq = set(), []
    for ph in out:
        k = re.sub(r"[^a-z ]+", "", ph.lower()).strip()
        if k and k not in seen and len(ph.split()) >= 3:
            seen.add(k); uniq.append(ph)
    return uniq[:limit]


def build_suggest(said: str, context: str = "", intent: str = "reply",
                  cefr: str = "B1", k: int = 3,
                  store: rag.Store | None = None,
                  preset: str = "meeting") -> dict:
    """4버튼/퀵번역 공통 파이프라인.

      1) [직전 상대 발화 + 맥락 5문장]으로 벡터 스토어 검색 (top 3)
      2) 검색된 [내가 배운 표현 / 도메인 어휘]를 프롬프트에 주입
      3) 구어체 단일 답변 생성 — 첫 문장 ≤8단어(즉답 오프너), 이후 ≤12단어,
         길이는 질문 유형별 5단계(ANSWER DEPTH: 1문장 ~ 발표형 90~120초)
      4) 검색이 빈약하면 RAG 없이 폴백 (프롬프트가 짧아져 지연이 준다)
    """
    ctx_lines = [l for l in (context or "").splitlines() if l.strip()][-5:]
    # 퀵 번역은 사용자가 직접 친 의도가 곧 질의다. 여기에 미팅 맥락을 섞으면
    # 맥락 쪽 토큰이 많아 검색이 통째로 트랜스크립트로 끌려간다(실측 확인).
    # 맥락은 프롬프트에는 그대로 남겨 어조를 잡는 데만 쓴다.
    query = said if intent == "translate" else (
        "\n".join(ctx_lines) + "\n" + said)
    st = store or rag.default_store()
    hits = _strong_hits(st.search(query.strip()[-800:], k=k))   # 관련성 컷

    phrases = _learned_phrases(hits)
    labels = [f"{h['source_label']}: {h['title']}" for h in hits]
    has_ph = any(_PLACEHOLDER.search(h["text"])
                 for h in hits if h["source"] in ("note", "glossary"))

    profile = _profile(st)
    if hits:
        # 인용은 350자면 핵심이 담긴다(노트는 앞부분이 요지) — 프롬프트 다이어트로
        # prefill 지연을 줄인다. 근거 품질은 rag-eval로 회귀 검증.
        material = "\n\n".join(
            f"[{h['source_label']} · {h['title']}]\n{h['text'][:350]}" for h in hits)
        material_block = f"""
THEIR OWN MATERIAL (retrieved from their notes and glossary):
\"\"\"{material}\"\"\"

Use it ONLY where it genuinely fits the question — quote matching lines
verbatim or nearly so; IGNORE loosely related lines, never force a quote.
"""
    else:
        material_block = ("\n(No personal material matched this question — "
                          "answer naturally from the CANDIDATE PROFILE above.)\n")

    goal = INTENTS.get(intent, INTENTS["reply"])
    ctx = (f"\nRecent meeting context:\n\"\"\"{chr(10).join(ctx_lines)}\"\"\"\n"
           if ctx_lines else "")

    if preset == "interview":
        # 톤이 다르다: 미팅은 회사 대 회사(we), 인터뷰는 후보자 1인칭(I) —
        # 자신 있고 따뜻하게, 그러나 과장 없이. 반박·협상 어휘는 쓰지 않는다.
        head = ("You are a real-time interview copilot for a Korean candidate in a LIVE "
                "English job interview (HR screening, B2B enterprise sales role). "
                "They are the CANDIDATE and about to speak — speed matters.")
        who = "The interviewer just said:"
        tone_rule = ("- Interview tone: confident, warm, first person (\"I\"). "
                     "Sell yourself with evidence, never arrogance. No negotiating language.")
    else:
        head = ("You are a real-time meeting copilot for a Korean cloud-sales professional "
                "in a LIVE English business meeting. They are about to speak — speed matters.")
        who = "The other side just said:"
        tone_rule = "- Business tone: professional, spoken, contractions fine. No slang, no filler."

    prompt = f"""{head}
{ctx}
{who}

"{said}"

Their goal right now: {goal}
Their spoken English level: CEFR {cefr}.

CANDIDATE PROFILE (ground truth about them — always available):
\"\"\"{profile}\"\"\"
{material_block}
TRUTHFULNESS: use only facts from the profile and material. Never invent a
specific figure, client name, or commitment that is not there.
NEVER dodge: no "I'm not sure", no "I don't know how to answer" — always give
a speakable, confident answer grounded in the profile.

Respond in EXACTLY this format (plain text, no markdown), nothing else:
EN: <ONE complete spoken answer — length per ANSWER DEPTH below>
KR: <한국어 뜻>
PR: <the EN answer written in HANGUL as it sounds when spoken aloud
(한국어 발음 표기, 예: "아임 드로온 투 하우 유 셀…"), on ONE line; right after
each hard-to-pronounce word ONLY (3+ syllables or domain terms) add its
/IPA/ — e.g. 오토메이션/ˌɔːtəˈmeɪʃən/. Easy words get no IPA.>
===
META: 요지=<상대 발언 핵심 한국어 한 줄> | 전략=<말하기 전략 한국어 한 줄>

RESOLVE REFERENTS FROM CONTEXT before answering — this decides WHAT the
question is about: pronouns like "your / our / that / it / there" mean what
the RECENT CONTEXT says they mean, weighing the immediately preceding turn
most. Example: right after they asked the candidate to research THEIR
company, "what are your strengths and weaknesses" most likely means THE
COMPANY's strengths and weaknesses — NOT the candidate's own. Answer the
contextually likely reading, and make the interpretation visible in the
opener ("From my research on your platform, ...") so a wrong guess is easy
for the speaker to correct on the spot. Only when no context hints exist,
take the plain reading.

ANSWER DEPTH — match length to the QUESTION TYPE (this matters most).
Sentence 1 is a direct opener (≤8 words) they can say while the rest streams.
- If their turn contains MORE THAN ONE question, answer the LAST question;
  acknowledge the earlier one in one short clause only if it fits naturally.
- SMALL TALK / greetings / quick reactions: ONE short sentence. No padding.
- FACTUAL / logistics (notice period, start date, "experience with X",
  yes/no): 2 sentences MAX — direct answer + ONE proof point. Never list
  multiple deals or numbers here.
- SUBSTANTIVE (why this company, motivation, opinions, "how would you
  approach..."): 4-7 short sentences around ONE proof point from THEIR
  OWN MATERIAL. ~20-30 seconds spoken.
- BEHAVIORAL ("tell me about a time...", "walk me through that deal"):
  a real story, 8-12 short sentences (45-75s) — 1-2 situation, middle is
  what they DID, END on the concrete result or number from their material.
- PRESENTATION-SCALE ("tell me about yourself", "pitch me", "why should
  we hire you", territory plan): 16-22 short sentences (180-250 words,
  90-120s), 3 themes, each anchored by ONE vivid specific from THEIR OWN
  MATERIAL — three themes, three anchors, no more. Natural spoken
  transitions ("So a bit about what I do...", "The other thing is...",
  "And looking ahead...") — NEVER "First / Second / Third" scaffolding.
  If they grant time ("take your time"), use the top of the range.
  End forward-looking, not with a summary.
- BREVITY overrides all: "briefly", "in a word", "in 30 seconds", or a
  rapid follow-up probe → 1-2 sentences whatever the type.
- Whole EN answer on a single line (sentences separated by spaces).

SPOKEN ENGLISH (CEFR B1-B2, said aloud instantly, not written English):
- PER-SENTENCE hard caps: sentence 1 ≤ 8 words, all others ≤ 12 words.
  Long answers = MORE short sentences, never longer ones.
- ALWAYS contract (I'm / that's / don't). Easy verbs (use, show, help,
  get, win, start — not utilize/demonstrate/facilitate/acquire/commence).
- Spoken connectors only: So / Actually / Basically / That's why —
  never Furthermore / Moreover / In addition.
- One idea per sentence; no stacked relative clauses; avoid hard 4+
  syllable words EXCEPT known domain terms (iPaaS, workflow, integration,
  pipeline, automation, enterprise, FinOps).
{tone_rule}
- Prefer wording from THEIR OWN MATERIAL over inventing new phrasing.

SOUND HUMAN — an interviewer trusts one vivid specific over five stats:
- HARD CAP: ≤2 numbers per answer (≤3 for presentation-scale); never
  chain numbers back to back ("38 accounts, 26.8 to 50.7M, 89%" = resume
  recitation). At most ONE client name unless they ask for more.
- Say numbers like people talk: "about fifty million dollars", "we almost
  doubled it" — exact figures only when asked for exact figures.
- No template skeletons: don't open every answer the same way; don't end
  with a moral ("This taught me..."). A light lead ("Honestly,") at most
  once per answer."""
    return {"prompt": prompt, "sources": labels, "hits": hits,
            "phrases": phrases, "rag_used": bool(hits), "has_placeholder": has_ph}


# 자막 번역 — 읽는 사람은 미팅 중이라 0.5초 안에 뜻만 잡으면 된다.
# 문어체 번역("~하는 것으로 사료됩니다")은 읽는 데 시간이 더 걸려서 실패다.
TRANSLATE_SYSTEM = """You are subtitling a live English business meeting for a Korean
cloud-sales professional who is reading at a glance while the meeting continues.

Translate English → Korean (or Korean → natural spoken English if the input is Korean).

Rules:
- 구어체로. 실제로 회의에서 말하듯 자연스러운 한국어. 문어체·번역투 금지
  (예: "~하는 것으로 사료됩니다" ✗ → "~인 것 같아요" ✓).
- 짧게. 원문보다 길어지지 않게. 군더더기 접속사를 넣지 말 것.
- 비즈니스 맥락을 유지: 업계 용어(TCO, Savings Plans, egress 등)는 억지로
  풀지 말고 그대로 두거나 괄호로 짧게만 보충한다.
- 상대의 어조(우려·반박·확정)를 살린다. 반론을 평서문으로 눌러 쓰지 말 것.
- 문장이 중간에 끊겼으면 끊긴 대로 옮긴다. 없는 말을 채우지 않는다.

Reply with ONLY the translation — no quotes, no labels, no explanation."""


def build_translate_batch(texts: list[str]) -> str:
    """번역 배칭 — 문장 2~3개를 1회 호출로 (무료 티어 RPM 절약).

    번호를 붙여 보내고 같은 번호로 받는다. 줄 단위 스트리밍이라 첫 문장의
    번역은 배치 전체가 끝나기 전에 화면에 붙는다."""
    lines = "\n".join(f"{i + 1}) {t}" for i, t in enumerate(texts))
    return (f"아래 번호가 매겨진 발화 {len(texts)}개를 각각 번역하세요.\n"
            f"출력은 정확히 {len(texts)}줄, 각 줄은 'N) 번역' 형식으로만. "
            f"줄을 합치거나 나누지 마세요.\n\n{lines}")


def build_summary(transcript: str, mode: str = "line") -> str:
    if mode == "line":
        # 상단 배너용 — '지금 무슨 얘기 중인가'를 놓친 사람이 한눈에 따라잡는 용도.
        # 요약이 아니라 '현재 논의 주제' 한 줄이다.
        return f"""Below are the most recent utterances of an ongoing English business meeting
(most recent last).

\"\"\"{transcript}\"\"\"

지금 **무슨 주제를 논의 중인지** 한국어 한 문장(35자 이내)으로 쓰세요.
· 대화를 요약하지 말고, 지금 걸려 있는 쟁점을 쓰세요.
  예: "견적가가 경쟁사보다 높다는 반론" / "데이터 소재지 규제 확인 중"
· 명사형으로 끝내세요. 문장 하나만 출력하고 다른 말은 붙이지 마세요."""
    return f"""Below is the transcript of an English business meeting (cloud sales).

Transcript:
\"\"\"{transcript}\"\"\"

한국어로 정리해 주세요 (마크다운 헤더 없이, 전체 150단어 이내):
📌 논의 요점: (불릿 2~4개)
🤝 내가 한 약속: (불릿 0~3개 — 없으면 '없음')
✅ 후속 액션: (불릿 1~3개, 담당이 나인 것 위주)
🗣 다음에 쓸 표현: (이번 대화에서 막혔던 부분을 영어 문장 1~2개로)"""
