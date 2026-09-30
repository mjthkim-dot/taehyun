#!/usr/bin/env python3
"""다음 회사 면접 준비 — 회사 파일 초안을 **검색 근거와 함께** 만든다 (v6.5).

  GEMINI_API_KEY=... python3 tools/new_company.py "Snowflake"
  GEMINI_API_KEY=... python3 tools/new_company.py "Snowflake" --role "Enterprise AE, Korea" --jd jd.txt
  GEMINI_API_KEY=... python3 tools/new_company.py "Snowflake" --activate   # 만들고 바로 전환·재적재

하는 일:
  1) Google 검색 근거(grounding)로 4갈래 조사 — 회사·재무 / 제품 / 경쟁·반론 / 한국 시장
  2) 조사 결과**만** 써서 company/<slug>.json 초안 구성
     (docs/company-template.json의 8개 노트 구조 + 골든 질문 + 음성 어휘 + 질의 확장)
  3) 숫자·고유명사 확인 목록과 출처 URL을 함께 남긴다

지키는 선:
  · 회사 사실은 검색 근거가 있는 것만. 근거 없는 수치는 쓰지 않는다.
  · **내 경험·동기는 지어내지 않는다** — "왜 이 회사인가"의 개인 연결은
    [CONFIRM: …] 자리로 비워 둔다(앱이 이 표시가 든 근거를 경고로 띄운다).
  · 초안이다(_draft: true). 대본(units)은 만들지 않는다 — 그대로 읽히는 문장은
    사람이 검수한 것만(Tier A 원칙).
  · 이미 있는 회사 파일은 덮어쓰지 않는다(--force로만).
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import company  # noqa: E402
import numwords  # noqa: E402

KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = os.environ.get("NEW_COMPANY_MODEL", os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"))
URL = "https://generativelanguage.googleapis.com/v1beta"

# 도메인 시드 묶음 — backend/data/packs/<이름>.json. 회사 성격에 맞는 것만 고른다.
PACKS = {
    "ipaas": "workflow automation, integration platforms (iPaaS), connectors, low-code, "
             "AI agents that automate business processes",
}

TOPICS = {
    "company": "{name}: founding year, HQ, CEO and key leaders, business model, latest "
               "reported annual revenue or ARR (with fiscal year), growth rate, customer count, "
               "funding/valuation or market cap, and the 3 most important news items of the "
               "last 12 months. Give exact figures with the period they refer to.",
    "product": "{name}: the product line — every major product with a one-line description, "
               "how it is priced (consumption, seat, platform), who buys it (buyer persona), "
               "and the top 3 differentiators the company itself claims. Use official product names.",
    "compete": "{name}: main competitors (name each), how {name} positions against each one, "
               "the most common customer objections in sales cycles and how {name} answers them, "
               "and 2-3 public customer case studies with measurable outcomes.",
    "korea":   "{name} in South Korea and APAC: Korean office or team, local partners and "
               "resellers, notable Korean customers (only if publicly announced), cloud "
               "marketplace availability, and any hiring for enterprise sales in Korea. "
               "Say plainly if little is public.",
}


def _post(model: str, body: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(f"{URL}/models/{model}:generateContent?key={KEY}",
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def research(name: str, topic: str, extra: str = "") -> dict:
    """검색 근거가 붙은 조사 한 갈래 → {text, sources:[{title, uri}], queries}."""
    q = TOPICS[topic].format(name=name) + (f"\nContext: {extra}" if extra else "")
    body = {"contents": [{"parts": [{"text": q + "\nAnswer in English, concise bullet points, "
                                              "facts only, include dates for every figure."}]}],
            "tools": [{"google_search": {}}]}
    o = _post(MODEL, body)
    c = (o.get("candidates") or [{}])[0]
    text = "".join(p.get("text", "") for p in (c.get("content") or {}).get("parts", []))
    gm = c.get("groundingMetadata") or {}
    src = [{"title": (ch.get("web") or {}).get("title", ""), "uri": (ch.get("web") or {}).get("uri", "")}
           for ch in gm.get("groundingChunks", []) if ch.get("web")]
    return {"topic": topic, "text": text.strip(), "sources": src,
            "queries": gm.get("webSearchQueries", [])}


STRUCTURE = """You prepare interview material for a Korean enterprise sales candidate
(cloud sales background, reads answers aloud in simple English) who is interviewing
at {name} for the role: {role}.

Below is web research WITH sources. Build a JSON object for their interview notes.
HARD RULES:
- Use ONLY facts that appear in the research. If a fact is missing, leave it out.
  Never guess a number. Every figure must keep its period ("FY2025 revenue 3.6B").
- Notes are written in Korean shorthand (명사형, 짧게) with English product/company
  names kept in English. 2-6 short lines each.
- NEVER write anything about the candidate's own past, results or motivation.
  Where the candidate must add a personal link, write exactly "[CONFIRM: 내 경험 한 줄]".
- Do not use square brackets anywhere else in note text.
- "keywords": 10-18 English words an INTERVIEWER would literally say when asking
  about this topic (not just the facts inside) — e.g. for the Korea note:
  "korea market presence go-to-market footprint team office partners customers".

Return JSON with exactly these keys:
{{
 "aliases": [short names people say for {name}, e.g. ticker-free short form; may be empty],
 "domain_pack": one of {packs} or "" — pick only if {name}'s core business clearly matches,
 "vocab": [up to 40 proper nouns for speech recognition: product names, competitor names,
           key technology terms, CEO name],
 "product_terms": [official product names, max 12],
 "competitors": [competitor names, max 6],
 "notes": [
   {{"key": "facts",   "title": "{name} 회사·재무 팩트",
     "text": "...", "keywords": "english search words interviewers would use"}},
   {{"key": "product", "title": "{name} 제품 라인 — <2-3 product names>", "text": "...", "keywords": "..."}},
   {{"key": "compete", "title": "경쟁 — <competitor A>·<competitor B> 카운터", "text": "...", "keywords": "..."}},
   {{"key": "objection", "title": "반론 대응 — <most common objection, Korean>", "text": "① 인정 ② 리프레임 ③ 킬라인 형식", "keywords": "..."}},
   {{"key": "why",     "title": "이직 사유 — Why {name} [초안]", "text": "회사 쪽 이유 2-3줄(사실 기반) + [CONFIRM: 내 경험 한 줄]", "keywords": "why this company why now motivation why leaving career move"}},
   {{"key": "korea",   "title": "{name} 한국 시장 현황", "text": "...", "keywords": "..."}},
   {{"key": "reference", "title": "레퍼런스 카드 — <customer>", "text": "Pain / Solution / Numbers (시점 포함)", "keywords": "..."}},
   {{"key": "plan",    "title": "{name} 6개월 실행 계획 (30/60/90+) [초안]", "text": "Day 1~30 / 31~60 / 61~90 / Month 4~6 — 제품·ICP 기준, 숫자 목표 없이", "keywords": "first ninety days six months plan what would you do first"}}
 ],
 "golden": [7 likely interview questions a hiring manager at {name} would ask about
            {name} specifically (product, competition, market, why us). Write "q" in
            natural spoken ENGLISH exactly as the interviewer would say it (short,
            conversational). Each {{"q": "...", "note_key": one of the note keys above}}],
 "check": [facts a human must verify before saying them aloud: every number and every
           customer name, with the note key]
}}

RESEARCH:
{research}
"""


def structure(name: str, role: str, res: list[dict], jd: str) -> dict:
    blob = "\n\n".join(f"### {r['topic']}\n{r['text']}" for r in res)
    if jd:
        blob += f"\n\n### job description (from the candidate)\n{jd[:6000]}"
    prompt = STRUCTURE.format(name=name, role=role, packs=list(PACKS), research=blob)
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}}
    o = _post(MODEL, body, timeout=180)
    c = (o.get("candidates") or [{}])[0]
    txt = "".join(p.get("text", "") for p in (c.get("content") or {}).get("parts", []))
    return json.loads(txt)


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "company"


# 노트 종류별 기본 검색어 — 면접관이 실제로 쓰는 영어. 모델이 준 검색어에 **항상** 더한다.
# 이유(실측): 관련성 컷은 영어 어절 2개 이상 겹침을 요구하고, 한국어 2음절 낱말
# (한국·시장·현황)은 세지 않는다. 모델이 사실 위주 검색어("Country Manager POSCO")만
# 주면 "go-to-market structure in South Korea"가 한국 노트를 못 찾았다.
DEFAULT_KW = {
    "facts": "company financials financial financially doing revenue growth growing funding "
             "valuation customers leadership ceo news performance results",
    "product": "product line products platform portfolio what do we sell features architecture "
               "know about offering offerings",
    "compete": "competitors competition compare position against differentiate alternative",
    "objection": "objection pushback concern customer says why not expensive pricing risk",
    "why": "why this company why now why us motivation interested in joining leaving career move",
    "korea": "korea korean market presence go-to-market footprint team office partners customers",
    "reference": "customer customers case study reference success story stories example outcome impact",
    "plan": "first ninety days 30 60 90 plan six months what would you do first territory execution",
}


def build_file(name: str, slug: str, role: str, s: dict, res: list[dict]) -> dict:
    notes, key_to_title = [], {}
    for n in s.get("notes") or []:
        title = str(n.get("title") or "").strip()
        text = str(n.get("text") or "").strip()
        if not (title and text):
            continue
        key = str(n.get("key") or "")
        kw = " ".join(dict.fromkeys((str(n.get("keywords") or "") + " "
                                     + DEFAULT_KW.get(key, "")).split()))
        body = text + (f"\n[검색어] {kw}" if kw else "")
        notes.append({"title": title, "text": body})
        key_to_title[str(n.get("key") or "")] = title
    names = [name] + [a for a in (s.get("aliases") or []) if a and a.lower() != name.lower()]
    prods = [p for p in (s.get("product_terms") or []) if p][:12]
    comps = [p for p in (s.get("competitors") or []) if p][:6]
    triggers = []
    if prods:
        triggers.append([r"\b(product lines?|product portfolio|your products?|our products?|platform)\b",
                         " ".join(prods) + f" {name} 제품 라인"])
    if comps:
        alt = "|".join(re.escape(c.lower()) for c in comps)
        triggers.append([rf"\b({alt}|competitors?|compare|against)\b",
                         "경쟁 카운터 " + " ".join(comps)])
    golden = []
    for g in s.get("golden") or []:
        t = key_to_title.get(str(g.get("note_key") or ""))
        if g.get("q") and t:
            frag = t.split(" — ")[0].split(" [")[0]
            golden.append({"q": g["q"], "expect": [frag], "tier": "B"})
    srcs = []
    for r in res:
        for x in r["sources"]:
            if x["uri"] not in {y["uri"] for y in srcs}:
                srcs.append({**x, "topic": r["topic"]})
    pack = s.get("domain_pack") or ""
    return {
        "_draft": True,
        "_생성": {"date": dt.date.today().isoformat(), "model": MODEL, "role": role,
                 "주의": "검색 근거로 만든 초안입니다. 숫자·고객사·제품명을 출처와 대조하고, "
                        "[CONFIRM: …] 자리를 내 경험으로 채운 뒤 _draft를 지우세요."},
        "company": {"name": name, "aliases": names[1:]},
        "domain_packs": [pack] if pack in PACKS else [],
        "vocab": list(dict.fromkeys([*names, *prods, *comps, *(s.get("vocab") or [])]))[:80],
        "name_fixes": [],
        "triggers": triggers,
        "links": {},
        "notes": notes,
        "golden": golden,
        "unit_ok": {},
        "units": [],
        "_확인_목록": s.get("check") or [],
        "_출처": srcs,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="회사 파일 초안 만들기 (검색 근거)")
    ap.add_argument("name", help='회사 이름 (예: "Snowflake")')
    ap.add_argument("--slug", help="파일 이름 (기본: 이름에서 자동)")
    ap.add_argument("--role", default="Enterprise Account Executive, Korea")
    ap.add_argument("--jd", help="채용 공고 텍스트 파일 경로(선택) — 붙이면 JD 핵심이 노트에 반영")
    ap.add_argument("--force", action="store_true", help="이미 있는 회사 파일 덮어쓰기")
    ap.add_argument("--activate", action="store_true", help="만든 뒤 이 회사로 전환하고 재적재")
    ap.add_argument("--out", help="저장 경로 직접 지정(테스트용)")
    a = ap.parse_args()
    if not KEY:
        print("❌ GEMINI_API_KEY가 필요합니다")
        return 1
    slug = a.slug or slugify(a.name)
    out = Path(a.out) if a.out else company.IMP / "company" / f"{slug}.json"
    if out.exists() and not a.force:
        print(f"❌ 이미 있습니다: {out}\n   덮어쓰려면 --force (기존 파일은 .bak으로 남깁니다)")
        return 1
    jd = Path(a.jd).read_text(encoding="utf-8") if a.jd else ""

    print(f"🔎 {a.name} 조사 중 (Google 검색 근거 · 4갈래 동시)…")
    extra = f"Role: {a.role}"
    res: list[dict] = []
    with cf.ThreadPoolExecutor(4) as ex:
        futs = {ex.submit(research, a.name, t, extra): t for t in TOPICS}
        for f in cf.as_completed(futs):
            t = futs[f]
            try:
                r = f.result()
                res.append(r)
                print(f"   ✅ {t:8s} 출처 {len(r['sources'])}개 · 검색어 {len(r['queries'])}개")
            except (urllib.error.URLError, KeyError, ValueError) as e:
                print(f"   ⚠️ {t:8s} 실패: {str(e)[:80]}")
    if not res:
        print("❌ 조사 결과가 없습니다 — 키·네트워크를 확인하세요")
        return 1
    res.sort(key=lambda r: list(TOPICS).index(r["topic"]))

    print("🧱 회사 파일 구성 중…")
    try:
        s = structure(a.name, a.role, res, jd)
    except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
        print(f"❌ 구성 실패: {str(e)[:120]}")
        return 1
    doc = build_file(a.name, slug, a.role, s, res)

    # 검증 — 깨진 정규식·빈 노트·대괄호 오용을 저장 전에 잡는다
    for p, _ in doc["triggers"]:
        re.compile(p)
    stray = [n["title"] for n in doc["notes"]
             if re.search(r"\[(?!CONFIRM:|검색어\])[^\]\n]{1,30}\]", n["text"].split("[검색어]")[0])]
    if out.exists():
        out.with_suffix(".json.bak").write_text(out.read_text(encoding="utf-8"), encoding="utf-8")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")

    nums = sorted({raw for n in doc["notes"] for raw, _ in numwords.extract(n["text"])})
    confirm = sum(n["text"].count("[CONFIRM") for n in doc["notes"])
    print(f"\n✅ 초안 저장: {out}")
    print(f"   노트 {len(doc['notes'])}개 · 골든 질문 {len(doc['golden'])}개 · 음성 어휘 {len(doc['vocab'])}개"
          f" · 도메인 묶음 {doc['domain_packs'] or '없음'} · 출처 {len(doc['_출처'])}개")
    print("\n📋 말하기 전에 확인할 것")
    print(f"   · 숫자 {len(nums)}개: {', '.join(nums[:20])}{' …' if len(nums) > 20 else ''}")
    for c in (doc["_확인_목록"] or [])[:12]:
        print(f"   · {c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)}")
    print(f"   · [CONFIRM: …] 자리 {confirm}곳 — 내 경험으로 채우기 (이직 사유 노트)")
    if stray:
        print(f"   · ⚠️ 대괄호 표기가 남은 노트: {', '.join(stray)}")
    print("   · 다 확인했으면 파일 맨 위 \"_draft\": true 줄을 지우세요")

    if a.activate and not a.out:
        (company.IMP / "ACTIVE_COMPANY").write_text(slug + "\n", encoding="utf-8")
        print(f"\n🏢 {a.name}로 전환 → 재적재")
        subprocess.run([sys.executable, str(ROOT / "tools" / "import_private.py"), "--replace"])
    elif not a.out:
        print(f"\n다음: 앱의 '자료' 탭 → 🏢 지원 회사에서 {slug} 선택 → [이 회사로 전환]"
              f"\n  (또는 python3 tools/new_company.py \"{a.name}\" --activate --force)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
