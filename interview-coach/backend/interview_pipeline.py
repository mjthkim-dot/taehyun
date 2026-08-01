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
import math
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
ANSWERS_PATH = DATA_DIR / "my_answers.json"          # 사전 생성 맞춤 답변셋 (개인 데이터 — 커밋 금지)
TARGET_PATH = DATA_DIR / "my_target.md"              # 🎯 타겟 회사 JD/정보
TARGET_Q_PATH = DATA_DIR / "my_target_questions.json"  # JD 기반 예상 질문 (생성물 — 커밋 금지)
INDEX_PATH = DATA_DIR / "kb_index.json"              # 🔎 검색 인덱스 (생성물 — 커밋 금지)


# ─────────────────────────────────────────────────────────────
#  질문 은행 (+ 🎯 타겟 회사 예상 질문 병합)
# ─────────────────────────────────────────────────────────────
def _load_target_questions() -> list[dict]:
    if not TARGET_Q_PATH.exists():
        return []
    try:
        return json.loads(TARGET_Q_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _load_bank() -> dict:
    if not BANK_PATH.exists():
        bank: dict = {"meta": {"category_labels": {}}, "questions": [], "phrases": []}
    else:
        bank = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    tq = _load_target_questions()
    if tq:
        bank = {**bank, "questions": list(bank.get("questions", [])) + tq}
        labels = dict(bank.get("meta", {}).get("category_labels", {}))
        labels["target"] = "🎯 타겟 회사"
        bank["meta"] = {**bank.get("meta", {}), "category_labels": labels}
    return bank


# ─────────────────────────────────────────────────────────────
#  🎯 타겟 회사 — JD를 저장하면 모든 답변이 회사 맥락으로 조정되고
#  회사 예상 질문이 질문 은행에 병합된다 (연습/사전생성/라이브 캐시 전부 반영)
# ─────────────────────────────────────────────────────────────
def _target_text(limit: int = 2500) -> str:
    if not TARGET_PATH.exists():
        return ""
    lines = [l for l in TARGET_PATH.read_text(encoding="utf-8").splitlines()
             if not l.strip().startswith(">")]
    return "\n".join(lines).strip()[:limit]


def _target_block(limit: int = 2500) -> str:
    """프롬프트에 끼워 넣는 타겟 회사 블록 (미설정 시 빈 문자열)."""
    t = _target_text(limit)
    if not t:
        return ""
    return f"""
Target company & role (job description the candidate is applying to — tailor
answers to this company's product, market and requirements, especially for
motivation/fit questions):
\"\"\"{t}\"\"\"
"""


def save_target(text: str) -> None:
    TARGET_PATH.parent.mkdir(parents=True, exist_ok=True)
    TARGET_PATH.write_text("# 🎯 타겟 회사 (채용공고/회사 정보)\n\n" + text.strip() + "\n",
                           encoding="utf-8")


def generate_target_questions(model: str | None = None) -> list[dict]:
    """JD + 내 프로필 기반으로 그 회사가 물어볼 법한 예상 질문 8개 생성 → 은행에 병합."""
    target = _target_text()
    if not target:
        raise ValueError("타겟 회사 정보가 비어 있습니다. 채용공고를 먼저 저장하세요.")
    profile_lines = "\n".join(f"- {c}" for c in _profile_chunks()) or "- (없음)"
    prompt = f"""You are an expert interview coach. Based on the job description below and the
candidate's profile, predict the questions THIS SPECIFIC company would likely ask
in an English interview for this role.

Job description / company info:
\"\"\"{target}\"\"\"

Candidate profile (Korean):
{profile_lines}

Generate exactly 8 questions: 2 about motivation/company fit, 3 probing the
role's key requirements against the candidate's experience, 2 situational
(realistic scenarios at this company), 1 tough/curveball.

Return ONLY valid JSON:
{{
  "questions": [
    {{"en": "the interview question in English",
      "kr": "한국어 번역",
      "tip_ko": "이 질문의 의도와 공략 팁 한 줄 (한국어)",
      "difficulty": 1-3}}
  ]
}}"""
    content = json.loads(llm.chat_once(
        [{"role": "user", "content": prompt}],
        json_mode=True, temperature=0.4, max_tokens=1400, model=model,
    ))
    questions = []
    for i, q in enumerate((content.get("questions") or [])[:10], 1):
        if not q.get("en"):
            continue
        questions.append({
            "id": f"t{i:02d}", "category": "target",
            "difficulty": int(q.get("difficulty", 2) or 2),
            "en": str(q["en"]).strip(), "kr": str(q.get("kr", "")).strip(),
            "tip_ko": str(q.get("tip_ko", "")).strip(),
        })
    TARGET_Q_PATH.write_text(json.dumps(questions, ensure_ascii=False, indent=1), encoding="utf-8")
    return questions


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


# ─────────────────────────────────────────────────────────────
#  🔎 검색 인덱스 (kb_index.json) — ⚡ 사전 생성 때 만들어진다:
#   · 스토리(한국어)마다 영어 태그/예상질문/요약 → 영어 질문과의 언어 불일치 해결
#   · 은행 질문마다 패러프레이즈 → 어휘가 달라도 캐시 매칭
#   · bge-m3 임베딩(설치 시) → 의미 검색. 없으면 키워드만으로 동작
# ─────────────────────────────────────────────────────────────
_index_cache: tuple[float, dict] = (-1.0, {})


def _load_index() -> dict:
    global _index_cache
    try:
        mtime = INDEX_PATH.stat().st_mtime
    except OSError:
        return {}
    if _index_cache[0] == mtime:
        return _index_cache[1]
    try:
        data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        data = {}
    _index_cache = (mtime, data)
    return data


def _story_title(chunk: str) -> str:
    first = chunk.splitlines()[0].strip()
    return first[3:].strip() if first.startswith("## ") else first[:40]


def _cos(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def _query_vec(text: str) -> list[float] | None:
    vecs = llm.embed([text])
    return vecs[0] if vecs else None


def _retrieve_stories(query: str, k: int = 2,
                      exclude: set[str] | None = None) -> list[tuple[str, str]]:
    """하이브리드 스토리 검색 → [(제목, 본문)]. 점수 = 키워드(원문+영어 인덱스) + 임베딩.
    exclude: 이번 세션에서 이미 쓴 스토리 제목 — 같은 사례 반복 방지 (부족하면 재사용 허용)."""
    chunks = _story_chunks()
    if not chunks:
        return []
    idx = {e.get("title", ""): e for e in _load_index().get("stories", [])}
    qw = _norm_words(query)
    qv = _query_vec(query)
    scored: list[tuple[float, str, str]] = []
    for chunk in chunks:
        title = _story_title(chunk)
        e = idx.get(title, {})
        hay = " ".join([chunk, e.get("summary_en", ""),
                        " ".join(e.get("tags_en", [])),
                        " ".join(e.get("paraphrases_en", []))]).lower()
        kw = sum(1 for w in qw if w in hay) / max(len(qw), 1)
        cos = _cos(qv, e.get("vec"))
        score = 0.5 * kw + 0.5 * cos if (kw and cos) else max(kw, cos)
        scored.append((score, title, chunk))
    scored.sort(key=lambda t: -t[0])
    fresh = [(t, c) for s, t, c in scored if s > 0 and t not in (exclude or set())]
    picked = fresh[:k]
    if len(picked) < k:  # 새 사례가 부족하면 이미 쓴 것 중 점수순으로 보충
        used = [(t, c) for s, t, c in scored if (t, c) not in picked and s > 0]
        picked += used[:k - len(picked)]
    if not picked:  # 매칭이 전혀 없으면 첫 사례라도 넣어 개인화 유지
        picked = [(_story_title(chunks[0]), chunks[0])]
    return picked


def _keyword_stories(query: str, k: int = 2) -> list[str]:
    return [c for _, c in _retrieve_stories(query, k)]


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


def kb_health() -> dict[str, Any]:
    """📊 날리지베이스 점검 — 답변 품질의 상한을 결정하는 요소를 진단한다.
    미입력 [대괄호]가 남아 있으면 답변에서 구체적 수치가 빠지므로(지어내지 않음),
    라이브 전에 무엇을 채워야 하는지 정확히 알려준다."""
    items: list[dict] = []
    for path, label in ((PROFILE_PATH, "프로필"), (STORY_PATH, "스토리")):
        if not path.exists():
            continue
        section = ""
        for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if line.startswith("#"):
                section = line.lstrip("#").strip()
            if line.startswith(">"):       # 안내 주석은 제외
                continue
            for m in _PLACEHOLDER_RE.findall(line):
                items.append({"file": label, "section": section, "line": n,
                              "token": m, "text": line[:110]})

    stories = _story_chunks()
    filled = [s for s in stories if not _PLACEHOLDER_RE.search(s)]
    idx = _load_index()
    answers = _load_answers()
    # 점수: 스토리 수(최대 40) + 미입력 없음(30) + 인덱스(15) + 사전답변(15)
    score = min(len(stories), 6) / 6 * 40
    score += 30 if not items else max(0, 30 - len(items) * 2)
    score += 15 if idx.get("stories") else 0
    score += 15 if answers else 0
    tips: list[str] = []
    if items:
        tips.append(f"미입력 [대괄호] {len(items)}개 — 채우면 답변에 실제 수치가 들어갑니다 "
                    "(지금은 지어내지 않고 정성적 표현으로 우회합니다)")
    if len(stories) < 5:
        tips.append(f"사례가 {len(stories)}개 — 실패/갈등/협업 사례를 추가하면 "
                    "질문마다 다른 사례를 꺼낼 수 있어요")
    if not idx.get("stories"):
        tips.append("검색 인덱스 없음 — ⚡ 맞춤 답변셋 생성을 누르면 함께 만들어집니다")
    if not answers:
        tips.append("사전 답변셋 없음 — 만들어두면 빈출 질문이 0초로 표시됩니다")
    return {
        "score": round(score),
        "stories": len(stories), "stories_filled": len(filled),
        "placeholders": len(items), "items": items[:40],
        "indexed": bool(idx.get("stories")), "embeddings": bool(idx.get("embed_model")),
        "prepared_answers": len(answers), "tips": tips,
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
        "index_stories": len(_load_index().get("stories", [])),
        "index_questions": len(_load_index().get("questions", {})),
        "index_embeddings": bool(_load_index().get("embed_model")),
        "embed_ready": llm.embed_available(),
        "target_set": bool(_target_text()),
        "target_questions": len(_load_target_questions()),
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
{_target_block(1800)}
Useful phrases (reuse where natural):
{phrase_lines}

Write 2 spoken answers the candidate can read aloud (option 1: concise, 30-50
words; option 2: stronger with STAR structure and concrete numbers, 60-90 words).
Natural native-sounding US business English, first person, contractions.

TRUTHFULNESS (critical — the candidate will say this out loud in a real interview):
- Use ONLY numbers, company names and metrics written in the profile/stories above.
- NEVER invent a figure. If a fact appears as a [placeholder] with no real value,
  describe it qualitatively instead ("a major manufacturing account") — do not
  substitute a made-up number.

Return ONLY valid JSON:
{{
  "gist_ko": "질문 요지 한국어 한 줄",
  "strategy_ko": "답변 전략 한국어 한 줄",
  "answers": [
    {{"en": "option 1", "kr": "자연스러운 한국어 번역"}},
    {{"en": "option 2", "kr": "자연스러운 한국어 번역"}}
  ]
}}"""


def _index_story_prompt(chunk: str) -> str:
    return f"""Below is one story/experience from a Korean job candidate's personal knowledge
base (IT sales, cloud/SaaS). Index it for retrieval during a live ENGLISH interview:
the incoming queries will be English interviewer questions.

Story (Korean):
\"\"\"{chunk}\"\"\"

Return ONLY valid JSON:
{{"summary_en": "1-2 sentence English summary of what this story demonstrates",
  "tags_en": ["6-10 short English keywords/phrases an interviewer's question about this story would contain"],
  "paraphrases_en": ["4-6 realistic English interview questions this story would be a great answer to"]}}"""


def _index_questions_prompt(batch: list[dict]) -> str:
    listed = "\n".join(f'- {q["id"]}: "{q["en"]}"' for q in batch)
    return f"""For each interview question below, generate English PARAPHRASES — different
wordings a real interviewer might use for the SAME question — plus short retrieval tags.

Questions:
{listed}

Return ONLY valid JSON mapping each id to its index entry:
{{"<id>": {{"paraphrases_en": ["3 realistic alternative wordings"],
            "tags_en": ["3-4 short English keywords"]}}}}"""


def _story_embed_text(e: dict) -> str:
    return " ".join([e.get("title", ""), e.get("summary_en", ""),
                     " ".join(e.get("tags_en", [])), " ".join(e.get("paraphrases_en", []))])


def build_kb_index(model: str | None = None) -> dict:
    """🔎 검색 인덱스 생성 — 스토리 영어 태그화 + 질문 패러프레이즈 + (가능하면) 임베딩.
    ⚡ 사전 생성(build_my_answers)의 첫 단계로 실행된다. 항목별 실패는 건너뛴다."""
    idx: dict = {"stories": [], "questions": {}}

    for chunk in _story_chunks():
        title = _story_title(chunk)
        _prep_state["current"] = f"🔎 인덱스: {title}"
        entry = {"title": title}
        try:
            content = json.loads(llm.chat_once(
                [{"role": "user", "content": _index_story_prompt(chunk)}],
                json_mode=True, temperature=0.2, max_tokens=500, model=model))
            entry.update(
                summary_en=str(content.get("summary_en", "")).strip(),
                tags_en=[str(t).strip() for t in (content.get("tags_en") or [])[:10]],
                paraphrases_en=[str(p).strip() for p in (content.get("paraphrases_en") or [])[:6]])
        except Exception:  # noqa: BLE001 — 실패한 스토리는 키워드 검색으로만 커버
            pass
        idx["stories"].append(entry)
        _prep_state["done"] += 1

    questions = _load_bank().get("questions", [])
    for i in range(0, len(questions), 8):
        batch = questions[i:i + 8]
        _prep_state["current"] = f"🔎 인덱스: 질문 패러프레이즈 {i + 1}~{i + len(batch)}"
        try:
            content = json.loads(llm.chat_once(
                [{"role": "user", "content": _index_questions_prompt(batch)}],
                json_mode=True, temperature=0.3, max_tokens=1200, model=model))
            for q in batch:
                e = content.get(q["id"]) or {}
                idx["questions"][q["id"]] = {
                    "paraphrases_en": [str(p).strip() for p in (e.get("paraphrases_en") or [])[:4]],
                    "tags_en": [str(t).strip() for t in (e.get("tags_en") or [])[:4]]}
        except Exception:  # noqa: BLE001
            pass
        _prep_state["done"] += 1

    # 임베딩 (bge-m3 설치 시) — 인덱스가 영어라 질문 벡터와 같은 언어 공간에서 비교된다
    if llm.embed_available():
        _prep_state["current"] = "🔎 인덱스: 임베딩 계산 중"
        svecs = llm.embed([_story_embed_text(e) for e in idx["stories"]]) or []
        for e, v in zip(idx["stories"], svecs):
            e["vec"] = v
        qids = list(idx["questions"])
        qtexts = []
        by_id = {q["id"]: q for q in questions}
        for qid in qids:
            base = by_id.get(qid, {}).get("en", "")
            qtexts.append(" ".join([base] + idx["questions"][qid].get("paraphrases_en", [])))
        qvecs = llm.embed(qtexts) or []
        for qid, v in zip(qids, qvecs):
            idx["questions"][qid]["vec"] = v
        idx["embed_model"] = llm.EMBED_MODEL

    INDEX_PATH.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
    return idx


def _index_steps() -> int:
    q = len(_load_bank().get("questions", []))
    return len(_story_chunks()) + (q + 7) // 8


def build_my_answers(model: str | None = None, cefr: str = "B1") -> dict[str, Any]:
    """⚡ 사전 생성 = ① 검색 인덱스 빌드 + ② 질문 은행 전체 맞춤 답변 생성."""
    questions = _load_bank().get("questions", [])
    _prep_state.update(running=True, done=0,
                       total=len(questions) + _index_steps(), current="", error=None)
    answers = _load_answers()
    try:
        try:
            build_kb_index(model)
        except Exception as e:  # noqa: BLE001 — 인덱스 실패해도 답변 생성은 계속
            print(f"  ⚠️ 인덱스 생성 실패 (키워드 검색으로 동작): {e}")
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


def _kw_score(qw: set[str], text: str) -> float:
    """키워드 겹침 비율. 짧은 질문(내용어 1개)은 완전 일치만 인정(오탐 방지)."""
    bw = _norm_words(text)
    if not bw:
        return 0.0
    inter = len(qw & bw)
    small = min(len(qw), len(bw))
    if small <= 1:
        return 1.0 if qw == bw else 0.0
    return inter / small if inter >= 2 else 0.0


def cached_answer(question_text: str) -> dict | None:
    """라이브에서 감지된 질문 ↔ 미리 만든 답변 매칭.
    원문뿐 아니라 인덱스의 패러프레이즈와도 키워드 매칭하고(어휘가 달라도 히트),
    임베딩이 있으면 의미 유사도(cos ≥ 0.78)로도 히트시킨다."""
    answers = _load_answers()
    if not answers:
        return None
    qw = _norm_words(question_text)
    if not qw:
        return None
    qidx = _load_index().get("questions", {})
    qv = _query_vec(question_text)
    best, best_score = None, 0.0
    for qid, entry in answers.items():
        e = qidx.get(qid, {})
        texts = [entry.get("question_en", "")] + e.get("paraphrases_en", [])
        kw = max((_kw_score(qw, t) for t in texts if t), default=0.0)
        cos = _cos(qv, e.get("vec"))
        hit = kw >= 0.6 or cos >= 0.78
        score = max(kw, cos)
        if hit and score > best_score:
            best, best_score = entry, score
    if best is not None:
        _live_session["last_question"] = question_text  # 캐시 히트도 꼬리 질문의 기준점이 된다
    return best


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
{_target_block(1800)}
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
# ── 세션 맥락 (③) — 사용한 스토리 기록 + 꼬리 질문 연결 ──
# 로컬 단일 사용자 앱이라 서버 메모리에 세션 하나만 유지한다.
_live_session: dict[str, Any] = {"used_stories": [], "last_question": ""}

_FOLLOWUP_RE = re.compile(
    r"^(why|how come|and |what about|really|so |in what way|can you (elaborate|expand"
    r"|give|walk)|could you (elaborate|expand|give|walk)|tell me more|anything else"
    r"|for (example|instance)|such as|like what|go on)", re.I)


def live_session_reset() -> None:
    _live_session["used_stories"] = []
    _live_session["last_question"] = ""


def _resolve_followup(question: str) -> tuple[str, str]:
    """짧거나 지시어로 시작하는 발화는 직전 질문의 꼬리 질문으로 보고
    검색 쿼리를 직전 질문과 합친다. → (검색용 쿼리, 꼬리질문이면 원 질문)."""
    last = _live_session["last_question"]
    is_followup = bool(last) and last != question and (
        len(_norm_words(question)) <= 3 or _FOLLOWUP_RE.match(question.strip()))
    if is_followup:
        return f"{last} {question}", last
    return question, ""


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


_PLACEHOLDER_RE = re.compile(r"\[[^\]\n]{1,30}\]")


def _kb_numbers(texts: list[str], limit: int = 12) -> list[str]:
    """KB에 실제로 적힌 수치만 뽑는다 — 답변이 이 밖의 숫자를 지어내지 못하게 하는 근거."""
    found: list[str] = []
    for t in texts:
        for m in re.findall(r"[0-9][0-9,.]*\s*(?:%|퍼센트|억|천만|만|명|배|개월|년|개사|건|원|억원)?", t):
            m = m.strip()
            if m and m not in found:
                found.append(m)
    return found[:limit]


def build_live_suggest_prompt(question: str, cefr: str = "B1", context: str = "",
                              intent: str = "answer") -> dict:
    """면접관 발화 → 즉시 읽을 수 있는 답변 2개(+한국어 번역). intent로 의도 선택.
    context: 직전 대화(자막 로그) — 꼬리 질문(follow-up)에 맥락 있는 답변을 위해."""
    refs = _safe_retrieve(question, k_phrases=4, k_profile=4)
    profile_lines = "\n".join(f"- {r['text']}" for r in refs["profile"]) or "- (none)"
    phrase_lines = "\n".join(f'- "{r["en"]}"' for r in refs["phrases"] if r.get("en")) or "- (none)"
    goal = INTENT_GOALS.get(intent, INTENT_GOALS["answer"])

    # ③ 세션 맥락: 꼬리 질문이면 직전 질문을 합쳐 검색하고, 이미 쓴 스토리는 제외
    search_q, followup_of = _resolve_followup(question)
    used = set(_live_session["used_stories"])
    picked = _retrieve_stories(search_q, k=2, exclude=used)
    story_lines = "\n\n".join(c[:450] for _, c in picked) or "(없음)"
    for title, _ in picked:
        if title not in _live_session["used_stories"]:
            _live_session["used_stories"].append(title)
    if not followup_of:
        _live_session["last_question"] = question

    followup_block = (
        f'\nThis is a FOLLOW-UP to the earlier question: "{followup_of}" — continue that'
        " thread (go one layer deeper: the result, a number, or what was learned)"
        " instead of restarting the topic.\n" if followup_of else "")
    used_block = (
        "\nStories the candidate ALREADY TOLD earlier in this interview — do not"
        " re-tell one as the main example; if relevant, build on it in one clause"
        " (\"like the migration case I mentioned\"): "
        + ", ".join([t for t in _live_session["used_stories"]
                     if t not in {p[0] for p in picked}][-6:]) + "\n"
        if len(_live_session["used_stories"]) > len(picked) else "")
    context_block = (
        "\nRecent conversation transcript (interviewer and candidate mixed; use it to"
        f" resolve what a follow-up refers to):\n\"\"\"{context}\"\"\"\n"
        if context.strip() else ""
    )
    # 🔒 지어내기 방지 — KB에 실제로 있는 수치만 쓰게 하고, 미입력([대괄호])이면
    #    숫자를 만들지 말고 정성적 표현으로 우회시킨다 (면접에서 거짓 수치는 치명적).
    grounded = [c for _, c in picked] + [r["text"] for r in refs["profile"]]
    nums = _kb_numbers(grounded)
    has_placeholder = any(_PLACEHOLDER_RE.search(t) for t in grounded)
    numbers_line = ("Real figures available (these are the ONLY numbers you may state): "
                    + ", ".join(nums)) if nums else "No verified figures are available."

    # ⚡ 지연 최소화: 사용자가 바로 읽어야 하는 답변(EN)을 가장 먼저 출력시키고
    #    메타(요지/전략)는 맨 뒤로 — 첫 유효 토큰까지의 체감 대기를 최소화한다.
    prompt = f"""You are a real-time interview copilot for a Korean candidate who is IN A LIVE
English video interview for an IT sales (cloud/SaaS) position RIGHT NOW.
Speed matters — the candidate is waiting to speak.
{context_block}{followup_block}{used_block}
The interviewer just said:

"{question}"

The candidate's goal right now: {goal}

Candidate profile facts (Korean — never contradict them):
{profile_lines}

Candidate's own stories (Korean — ground answers in these real experiences):
\"\"\"{story_lines}\"\"\"
{_target_block(1200)}
Useful phrases (reuse where natural):
{phrase_lines}

TRUTHFULNESS (critical — the candidate will say this out loud in a real interview):
{numbers_line}
- NEVER invent a number, company name, date or metric that is not written above.
- If a fact appears as a [placeholder] with no real value, do NOT make one up —
  describe it qualitatively instead ("a major manufacturing account", "a
  significant share of annual revenue").
- Everything the candidate says must be something they can defend if probed.

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
    return {
        "prompt": prompt,
        "sources": [t for t, _ in picked],       # 📎 이 답변이 근거로 쓴 내 사례
        "has_placeholder": has_placeholder,       # ⚠️ KB에 수치가 비어 있음
        "followup_of": followup_of,
    }


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
