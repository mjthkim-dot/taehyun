"""
발언 제안 프롬프트 — 검색된 내 자료에 근거해 '내가 실제로 말할 법한' 문장을 만든다.

이 앱의 차별점이 여기 있다. 일반 번역기·범용 코파일럿과 달리
 · 내 수업 노트에서 배운 표현을 우선 쓰고
 · 내 과거 미팅에서 실제로 쓴 말투를 따르고
 · 용어집의 정확한 도메인 단어를 쓴다
지어내기는 금지다 — 자료에 없는 수치·고객사명은 만들지 않는다.
"""
from __future__ import annotations

import os
import re

import llm
import rag
import triggers
import units

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

# Tier A(검수 대본 그대로 읽기) 전용 게이트 — Tier B보다 엄격하다.
# 생성 없이 그대로 발화되므로, 애매하면 열지 않고 Tier B로 떨어뜨린다.
# 4였다가 2로 내렸다. 4는 **의도 게이트가 없던 시절**의 값이다 — 그때는 어휘가
# 유일한 방어선이라 좁게 잡아야 했다(임계 2에서 오발화 3건). 의도 게이트가
# 생긴 뒤 다시 재니 임계 2에서도 틀린 노트가 0건이고, 발동은 10 → 21건으로
# 두 배가 된다. 답변 지연이 1.17초 → 0.27초로 떨어지는 문항이 그만큼 늘어난다.
UNIT_MIN_TERMS = int(os.environ.get("UNIT_MIN_TERMS", "2"))
UNIT_MIN_SIM = float(os.environ.get("UNIT_MIN_SIM", "0.62"))

# 답변 카드에 담을 줄. 실사용 확인(2026-08): 상대 발화는 EN+KR을 모두 보지만
# **답변셋은 영어만 읽는다**. KR·PR은 출력 토큰의 52%(KR 25%·PR 28%)를 차지하며
# EN 완결 이후 1.51초를 더 쓰게 했다(실측). 안 보는 줄을 만드느라 기다린 셈이라
# 기본을 EN 단독으로 바꾼다. 되돌리려면 ANSWER_LINES=en,kr,pr 로 기동한다.
ANSWER_LINES = [x.strip().lower() for x in
                os.environ.get("ANSWER_LINES", "en").split(",") if x.strip()]
SHOW_KR = "kr" in ANSWER_LINES
SHOW_PR = "pr" in ANSWER_LINES

# 수치 게이트용 — 자료·프로필에 실재하는 숫자만 '확정'으로 본다.
_NUM = re.compile(r"\d[\d,.]*\s*(?:%|억|만|천|million|m|billion|b|k)?", re.I)


def _known_numbers(texts: list[str]) -> list[str]:
    """자료에 문자열로 실재하는 수치 토큰 집합. 출력 검증의 기준선."""
    out: set[str] = set()
    for t in texts:
        for m in _NUM.finditer(t or ""):
            tok = m.group(0).strip().rstrip(".,")
            if any(ch.isdigit() for ch in tok):
                out.add(tok.lower().replace(" ", ""))
    return sorted(out)


# 의미(벡터) 히트의 코사인 하한. 벡터 검색은 아무리 멀어도 최근접 k개를
# 돌려주므로 '의미로 걸렸다'만으로는 관련성이 아니다 — 하한이 없으면 코퍼스에
# 전혀 없는 질문도 근거가 있는 것처럼 통과해 Tier C 게이트가 무력해진다.
# 실측 분포(gemini-embedding-001, 768차원): 코퍼스 안·패러프레이즈 0.583~0.707,
# 코퍼스 밖 0.463~0.522. 두 무리 사이인 0.55를 하한으로 둔다.
RAG_MIN_SIM = float(os.environ.get("RAG_MIN_SIM", "0.55"))


# 키워드 증거가 이 정도는 돼야 '제대로 걸렸다'고 본다. 미만이면 의미검색을 한 번
# 더 돌린다 — 비었을 때만 돌리면 "엉뚱하지만 뭔가 걸린" 경우를 구제하지 못한다
# (골든셋 실측: "AI maturity"가 자기소개 노트에 걸려 프레임워크 노트를 놓쳤다).
# 임계값 스윕 실측(골든셋 40문항): 3이면 top3가 74%→76%로 오르지만 의미검색
# 발동률이 22%→65%가 되어 중앙 지연이 4ms→689ms로 뛴다. +2%p의 대가로
# 너무 비싸다 → 2(사실상 "비었거나 거의 빈 경우")로 둔다.
RAG_WEAK_TERMS = int(os.environ.get("RAG_WEAK_TERMS", "2"))


def _weak(hits: list[dict]) -> bool:
    return not hits or max((h.get("match_terms", 0) for h in hits), default=0) < RAG_WEAK_TERMS


def _strong_hits(hits: list[dict]) -> list[dict]:
    out = []
    for h in hits:
        if h.get("match_terms", 0) >= RAG_MIN_MATCH_TERMS:
            out.append(h)                       # 키워드로 충분히 겹친다
        elif "의미" in h.get("via", "") and h.get("sim", 0.0) >= RAG_MIN_SIM:
            out.append(h)                       # 의미로 걸렸고 충분히 가깝다
    return out


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
    # 면접관 표현 ↔ 내 자료 어휘를 잇는다(사실은 더하지 않는다). 질의에만 붙고
    # 프롬프트에는 들어가지 않으므로 답변 문장에는 영향이 없다.
    q_exp = triggers.expand(query.strip()[-800:])
    hits = _strong_hits(st.search(q_exp, k=k))                  # 관련성 컷
    # 2단 검색 — BM25(1ms)가 비면 그때만 의미검색을 돌린다. 면접관이 내 트리거와
    # 다른 어휘로 물으면("largest contract you've signed" vs "biggest deal")
    # 키워드로는 못 잡는데, 질의 임베딩은 실측 0.43~0.68초라 매번 쓸 수 없다.
    # 놓치면 어차피 Tier C로 답을 안 만드는 구간이라, 그 비용을 여기서만 낸다.
    if _weak(hits) and llm.embed_available():
        sem = _strong_hits(st.search(q_exp, k=k, semantic=True))
        if sem:
            hits = sem

    phrases = _learned_phrases(hits)
    labels = [f"{h['source_label']}: {h['title']}" for h in hits]
    has_ph = any(_PLACEHOLDER.search(h["text"])
                 for h in hits if h["source"] in ("note", "glossary"))

    profile = _profile(st)
    if hits:
        # 인용은 350자면 핵심이 담긴다(노트는 앞부분이 요지) — 프롬프트 다이어트로
        # prefill 지연을 줄인다. 근거 품질은 rag-eval로 회귀 검증.
        # 검수된 영어 판본이 있으면 그걸 근거로 준다. 원본 노트는 한국어 S/A/R
        # 속기라("갱신이 커머디티화될 위기") 모델이 매번 새로 영작하게 되는데,
        # 그러면 문장이 매번 달라지고 말투가 흔들린다. Tier A로 열 만큼
        # 확신이 없어도, 검수된 문장을 '이 사람의 말투'로 주는 값은 크다.
        # (units.find는 미검수 유닛을 걸러내므로 검수 전에는 동작이 바뀌지 않는다.)
        parts, n_units = [], 0
        for h in hits:
            u = units.find(h["title"]) if h["source"] in ("note", "glossary") else None
            if u and (u.get("answer_en_30s") or "").strip():
                n_units += 1
                parts.append(f"[{h['source_label']} · {h['title']} — REVIEWED SPOKEN "
                             f"VERSION, this is how they actually say it]\n"
                             f"{u['answer_en_30s'].strip()}")
            else:
                parts.append(f"[{h['source_label']} · {h['title']}]\n{h['text'][:350]}")
        material = "\n\n".join(parts)
        reviewed_rule = ("""
A block marked REVIEWED SPOKEN VERSION is this candidate's own approved wording.
If it fits the question, reuse its sentences and its voice — adapt only what the
question actually requires. Do not re-translate or "improve" it.
""" if n_units else "")
        material_block = f"""
THEIR OWN MATERIAL (retrieved from their notes and glossary):
\"\"\"{material}\"\"\"

Use it ONLY where it genuinely fits the question — quote matching lines
verbatim or nearly so; IGNORE loosely related lines, never force a quote.
{reviewed_rule}"""
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

    kr_line = "KR: <한국어 뜻>\n" if SHOW_KR else ""
    pr_line = ("""PR: <the EN answer written in HANGUL ONLY, as it sounds when spoken aloud
(한국어 발음 표기, 예: "아임 드로온 투 하우 유 셀…"), on ONE line.
No IPA and no slashes in this line.
PR accuracy rules: derive the Hangul from the standard spoken pronunciation
(IPA), never from spelling. Never drop consonants or syllables (honestly → 어니스틀리
NOT 아너슬리; strengths → 스트렝쓰스; asked → 애스크트; maturity → 머추리티
NOT 머튜리티; usually → 유주얼리; executive → 이그제큐티브). Acronyms as
Korean letter names (AWS → 에이더블유에스, SoW → 에스오더블유, EDP → 이디피).
Numbers as the spoken English words (75.6 million → 세븐티 파이브 포인트
식스 밀리언).>
""" if SHOW_PR else "")
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
specific figure, client name, or commitment that is not there. Never inflate
ownership: if the material says they USE or APPLY a framework/method, do NOT
say they built, authored, created, or invented it.
NEVER dodge: no "I'm not sure", no "I don't know how to answer" — always give
a speakable, confident answer grounded in the profile.

Respond in EXACTLY this format (plain text, no markdown), nothing else:
EN: <ONE complete spoken answer — length per ANSWER DEPTH below. Insert
" / " (a slash with spaces) at natural PAUSE points so a nervous speaker
can chunk it while reading aloud — at clause boundaries, every 3-6 words:
"For eight years, / I sold cloud infrastructure. / But today, / clients
need AI / to transform how they work." Slashes do not count as words.>
{kr_line}{pr_line}===
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
  we hire you", territory plan): 12-16 short sentences (140-190 words,
  60-90s), 3 themes, each anchored by ONE vivid specific from THEIR OWN
  MATERIAL — three themes, three anchors, no more. Natural spoken
  transitions ("So a bit about what I do...", "The other thing is...",
  "And looking ahead...") — NEVER "First / Second / Third" scaffolding.
  If they grant time ("take your time"), use the top of the range —
  and NEVER stop before 12 sentences on a presentation-scale ask.
  End forward-looking, not with a summary.
- BREVITY overrides all: "briefly", "in a word", "in 30 seconds", or a
  rapid follow-up probe → 1-2 sentences whatever the type.
- Whole EN answer on a single line (sentences separated by spaces).

SPOKEN ENGLISH (CEFR B1-B2, said aloud instantly, not written English):
- PER-SENTENCE hard caps: sentence 1 ≤ 8 words, all others ≤ 12 words.
  Long answers = MORE short sentences, never longer ones. If a sentence
  would run past its cap, SPLIT it at the comma into two sentences —
  e.g. NOT "I want to sell a product that changes how customers work,
  not just where their servers run" (17 words) but "I want to sell a
  product that changes how customers work. Not just where their servers
  run." Count before you write.
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
    # Tier C(미스) — 자료에서 근거를 못 찾았다. 여기서 답을 '만들면' 그대로
    # 발화되므로, 티어를 알려 서버가 생성을 건너뛰게 한다(#16 escalation).
    # 프로필은 일반 사실이지 '이 질문의 대본'이 아니다 — 그대로 읽을 문장의
    # 근거로 삼지 않는다.
    # 티어는 **이번 질문**에 대본이 있는지로 가른다. 검색 질의에 맥락을 섞으면
    # 앞선 주제의 적중이 이번 질문의 근거인 양 새어 들어와 미스가 감춰진다
    # (실측: 대화가 쌓인 뒤엔 코퍼스에 전혀 없는 질문도 tier B로 나왔다).
    # 예외 — 짧은 후속 질문("Why?" / "How big?")은 정의상 앞 맥락에 기댄다.
    # 또 하나 — '대본'은 **준비한 자료**(노트·용어집)다. 지난 미팅 트랜스크립트는
    # 원본 기록이지 이번 질문의 답변 근거가 아니다. 키워드 검색만 도는 지금은
    # 트랜스크립트가 일반 영어로 폭넓게 걸려 미스를 가린다(실측: 코퍼스에 없는
    # 질문의 상위 적중이 지난 미팅 기록이었다).
    unit = None
    if intent == "reply" and len(said.split()) >= 4:
        s_exp = triggers.expand(said.strip()[-400:])
        own = _strong_hits(st.search(s_exp, k=k, sources=["note", "glossary"]))
        if _weak(own) and llm.embed_available():
            own = _strong_hits(st.search(s_exp, k=k, sources=["note", "glossary"],
                                         semantic=True)) or own
        tier = "C" if not own else "B"
        # Tier A — 1순위 근거에 검수된 영어 판본이 있으면 생성하지 않는다.
        # 1순위만 본다: 2순위 이하까지 훑으면 '비슷한 다른 대본'을 읽게 되는데,
        # 그대로 발화되므로 틀린 답을 자신 있게 읽는 셈이라 더 나쁘다.
        #
        # 게이트가 Tier B보다 엄격한 이유(실측): "What would you ask us about how
        # the team works day to day?"가 '첫 90일 계획 패턴'을 1순위로 집었다
        # (match_terms=2, 'day'가 겹쳤을 뿐). Tier B는 LLM이 질문과 근거 3개를
        # 함께 보므로 이런 미스를 어느 정도 흡수하지만, Tier A는 흡수 장치가
        # 없다 — 그대로 읽힌다. 그래서 '확실할 때만' 연다.
        # 실측 분포: 맞는 1순위 match_terms 5~9 / 틀린 1순위 2.
        if own:
            h0 = own[0]
            confident = (int(h0.get("match_terms") or 0) >= UNIT_MIN_TERMS
                         or float(h0.get("sim") or 0.0) >= UNIT_MIN_SIM)
            if confident:
                cand = units.find(h0.get("title", ""))
                # 어휘가 겹치는 것과 '이 질문에 답하는 대본'인 것은 다르다.
                # 둘 다 통과해야 연다 — 그대로 읽히기 때문이다.
                if cand and units.matches_intent(said, cand):
                    unit = cand
                    tier = "A"
    else:
        tier = "C" if not hits else "B"
    known = _known_numbers([h["text"] for h in hits] + [profile])
    return {"prompt": prompt, "sources": labels, "hits": hits, "tier": tier,
            "known_numbers": known, "unit": unit,
            "phrases": phrases, "rag_used": bool(hits), "has_placeholder": has_ph}


# Tier A — 검수된 대본을 그대로. LLM을 부르지 않으므로 문장이 매번 같다.
# "그대로 읽을 생각"이라는 사용자 전제에서, 매번 달라지는 문장은 그 자체로 결함이다.
def build_tier_a(unit: dict, depth: str = "30s") -> dict:
    """검수된 유닛을 카드 형태로 돌려준다. 생성 없음 · 지연 ~0 · 환각 0."""
    en = unit.get("answer_en_90s") if depth == "90s" else unit.get("answer_en_30s")
    en = (en or unit.get("answer_en_30s") or "").strip()
    return {
        "en": en,
        "gist": unit.get("gist") or "검수된 대본",
        "strategy": unit.get("strategy") or "그대로 읽으세요",
        "known_numbers": list(unit.get("key_numbers") or []),
        "note_title": unit.get("note_title", ""),
        "has_90s": bool((unit.get("answer_en_90s") or "").strip()),
    }


# Tier C에서 화면에 띄울 것 — 생성이 아니라 고정 문구다(환각 위험 0, 지연 0).
# 빈 화면은 면접 중 더 당황스럽다. 안전한 상투구로 시간을 벌게 하고,
# 자료에 있는 확정 수치·키워드만 곁들인다.
TIER_C_OPENERS = [
    "That's a good question. / Let me think about that for a second.",
    "Let me take a moment / on that one.",
]


def build_tier_c(said: str, store=None) -> dict:
    """근거 없음 — 생성하지 않고 시간 벌기 문장 + 확정 사실만 돌려준다.

    단, '자료에 없다'와 '확인하지 못했다'는 구분한다. 임베딩이 429 등으로
    실패하면 의미검색이 통째로 꺼지는데, 그때 "대본 없음"이라고 말하면
    **대본이 있는데도 없다고 말하는 셈**이다(실측 2026-09-01: 골든셋 2문항이
    이 경로로 미스가 됐다). 사용자에겐 다시 눌러 보라고 알려야 한다.
    """
    st = store or rag.default_store()
    profile = _profile(st)
    err = llm.embed_last_error()
    if err:
        return {
            "en": TIER_C_OPENERS[0],
            "gist": "확인 실패 — 의미검색이 일시적으로 꺼졌습니다 (다시 눌러 보세요)",
            "strategy": f"자료가 없는 게 아니라 검색을 못 했습니다 ({err})",
            "facts": [l.strip("- ").strip() for l in profile.splitlines() if l.strip()][:4],
            "known_numbers": _known_numbers([profile]),
        }
    return {
        "en": TIER_C_OPENERS[0],
        "gist": "대본 없음 — 내 자료에서 근거를 찾지 못했습니다",
        "strategy": "시간을 벌고, 아는 사실만 말하세요 (지어내지 마세요)",
        "facts": [l.strip("- ").strip() for l in profile.splitlines() if l.strip()][:4],
        "known_numbers": _known_numbers([profile]),
    }


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


def build_opener(said: str, intent: str = "reply", preset: str = "interview") -> str:
    """⚡ 1초 오프너 — 본답변(TTFT 1.5~4s)이 오기 전에 경량 레인으로 '지금 바로
    말할 첫 문장'만 먼저 만든다. RAG 검색 없이 초소형 프롬프트 = 최소 지연.
    본답변 첫 토큰이 도착하면 클라이언트가 이 문장을 본답변으로 교체한다."""
    role = ("candidate in a LIVE English job interview" if preset == "interview"
            else "professional in a LIVE English business meeting")
    goal = INTENTS.get(intent, INTENTS["reply"])
    return (f"A Korean {role} must start speaking RIGHT NOW.\n"
            f'The other side just said: "{said}"\n'
            f"Their goal: {goal}\n"
            "Give ONE natural spoken opener sentence (max 8 words) they can say\n"
            "immediately while their full answer is being prepared — a direct,\n"
            "substantive first sentence, NOT filler like 'that's a great question'.\n"
            "Contractions fine. Plain text, the sentence only.")


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
