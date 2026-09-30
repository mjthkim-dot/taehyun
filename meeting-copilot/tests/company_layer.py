#!/usr/bin/env python3
"""회사 레이어 계약 테스트 — 가상 인물·가상 회사 픽스처로 개인 자료 없이 돈다.

  python3 tests/company_layer.py

무엇을 지키나 (v6.5):
  · 회사를 바꾸면 그 회사 노트·대본·어휘·도메인 시드로 바뀐다
  · 다른 지원 회사 이름이 든 대본은 그대로 읽히지 않는다(Tier A 차단)
  · 프롬프트가 지금 회사를 알고, 다른 회사 이름을 금지어로 받는다
  · 생성 답변에 다른 회사 이름이 새면 잡힌다(mentions_other)
  · 회사를 바꿔도 색인에 고아(postings·vecs)가 남지 않는다
  · 공개 코드에는 실명 고객사가 없다(개인 교정 사전은 vocab.json에서만)

픽스처: tests/fixtures/imported — Acme Automation(자동화) · Globex Data(데이터).
임시 폴더에 복사해 쓰므로 저장소의 픽스처와 사용자 자료는 건드리지 않는다.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "tests" / "fixtures" / "imported"

TMP = Path(tempfile.mkdtemp(prefix="mc-company-"))
IMP = TMP / "imported"
shutil.copytree(FIX, IMP)
os.environ.update({"MC_IMPORTED_DIR": str(IMP), "MC_DATA_DIR": str(TMP / "data")})
os.environ.pop("INTERVIEW_COMPANY", None)
os.environ.pop("GEMINI_API_KEY", None)          # 키워드 검색만 — 결정적으로
(TMP / "data").mkdir()
sys.path.insert(0, str(ROOT / "backend"))

import company  # noqa: E402
import llm  # noqa: E402
import prompts  # noqa: E402
import rag  # noqa: E402
import triggers  # noqa: E402
import units  # noqa: E402

fails: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'✅' if ok else '❌'} {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        fails.append(name)


def switch(slug: str) -> str:
    (IMP / "ACTIVE_COMPANY").write_text(slug + "\n", encoding="utf-8")
    env = {k: v for k, v in os.environ.items() if k != "GEMINI_API_KEY"}
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "import_private.py"), "--replace"],
                       capture_output=True, text=True, env=env, timeout=300)
    rag._invalidate()
    if r.returncode != 0:
        print(r.stdout[-800:], r.stderr[-800:])
    return r.stdout + r.stderr


def glossary_count() -> int:
    with rag.default_store().connect() as con:
        return con.execute("SELECT COUNT(*) FROM chunks WHERE source='glossary'").fetchone()[0]


def orphans() -> int:
    with rag.default_store().connect() as con:
        return con.execute("SELECT COUNT(*) FROM postings p LEFT JOIN chunks c "
                           "ON c.id=p.chunk_id WHERE c.id IS NULL").fetchone()[0]


def top(q: str) -> tuple[str, str]:
    b = prompts.build_suggest(q, "", "reply", "B1", store=rag.default_store(), preset="interview")
    hits = b.get("hits") or []
    return (hits[0]["title"] if hits else ""), b["tier"]


print("\n■ 1. Acme 활성")
switch("acme")
check("지금 회사 = Acme Automation", company.name() == "Acme Automation", company.name())
check("다른 회사 = Globex Data·Globex", company.others() == ["Globex Data", "Globex"],
      str(company.others()))
n_acme = glossary_count()
check("Acme는 ipaas 묶음 적재(공통 115 + 25)", n_acme == 140, str(n_acme))
u = units.find("Why Acme Automation — 이직 사유")
check("{{COMPANY}} 대본이 회사 이름으로 렌더", bool(u) and "Acme Automation is that next step"
      in (u or {}).get("answer_en_30s", ""), (u or {}).get("answer_en_30s", "")[:60])
check("회사 전용 대본(회사 파일 units) 사용 가능",
      bool(units.find("Acme 제품 라인업 — Acme Flow · Recipe Hub")))
check("Acme에서는 'Acme'가 든 옛 대본 허용", bool(units.find("첫 90일 계획")))
exp = triggers.expand("Why Acme, and why now?")
check("동기 질의 확장이 회사 이름으로", "why acme automation" in exp, exp[-70:])
exp = triggers.expand("What do you know about our product line?")
check("회사 파일 triggers 적용", "Acme Flow Recipe Hub" in exp, exp[-60:])
voc = llm._stt_vocab()
check("음성 어휘 = 기본 + 개인 + 회사", all(w in voc for w in
      ["MegazoneCloud", "Hanbit Retail", "Acme Cloud", "Acme Flow", "Acme Automation"])
      and "Globex Lake" not in voc, ", ".join(voc[-8:]))
fx = [p for p, _ in company.name_fixes()]
check("교정 사전 = 개인 + 회사", any("han bit" in p for p in fx) and any("ak me" in p for p in fx)
      and not any("glow bex" in p for p in fx), str(fx))
t, tier = top("What do you know about our product line?")
check("제품 질문 → Acme 제품 노트", t.startswith("Acme 제품"), f"{t} [{tier}]")

print("\n■ 2. Globex로 전환")
log = switch("globex")
check("전환 재적재 성공", "완료" in log, log.strip().splitlines()[-1] if log.strip() else "")
check("지금 회사 = Globex Data", company.name() == "Globex Data")
n_glx = glossary_count()
check("ipaas 묶음 25개가 색인에서 빠짐(140 → 115)", n_glx == 115, str(n_glx))
check("전환 뒤 고아 postings 0", orphans() == 0, str(orphans()))
check("Acme 전용 대본은 비활성", units.find("Acme 제품 라인업 — Acme Flow · Recipe Hub") is None)
check("'Acme'가 든 옛 대본은 Globex에서 차단(그대로 읽히지 않음)",
      units.find("첫 90일 계획") is None)
s = units.stats()
check("통계에 차단 수 표시", s.get("blocked_other_company") == 1, str(s))
u = units.find("Why Globex Data — 이직 사유")
check("공통 대본은 Globex 이름으로 렌더", bool(u) and "Globex Data is that next step"
      in (u or {}).get("answer_en_30s", ""))
t, tier = top("What do you know about our product line?")
check("제품 질문 → Globex 제품 노트", t.startswith("Globex 제품"), f"{t} [{tier}]")
t, tier = top("What would your first 90 days look like here?")
check("차단된 대본 질문은 Tier A가 아니다(생성으로 넘김)", tier != "A", f"{t} [{tier}]")
b = prompts.build_suggest("Why Globex, and why now?", "", "reply", "B1",
                          store=rag.default_store(), preset="interview")
check("프롬프트가 지금 회사를 안다", "this interview is with Globex Data" in b["prompt"])
check("프롬프트에 다른 회사 금지어", "NEVER say these names" in b["prompt"]
      and "Acme Automation" in b["prompt"])
bm = prompts.build_suggest("Why Globex, and why now?", "", "reply", "B1",
                           store=rag.default_store(), preset="meeting")
check("미팅 프리셋에는 면접 회사 규칙을 넣지 않음", "this interview is with" not in bm["prompt"])
check("생성 답변의 다른 회사 이름 검출",
      company.mentions_other("I loved my time preparing for Acme, truly.") == ["Acme"])
check("현재 회사 이름은 검출하지 않음", company.mentions_other("Globex Data is great") == [])
check("단어 일부는 검출하지 않음(Acmeist)", company.mentions_other("an Acmeist view") == [])
voc = llm._stt_vocab()
check("음성 어휘가 Globex로 바뀜", "Globex Lake" in voc and "Acme Flow" not in voc
      and "Acme Cloud" not in voc)

print("\n■ 3. 다시 Acme — 묶음 복귀")
switch("acme")
check("ipaas 묶음 재적재(115 → 140)", glossary_count() == 140, str(glossary_count()))
check("고아 postings 0", orphans() == 0)

print("\n■ 4. 공개 코드에 실명 고객사 없음")
import re  # noqa: E402
# 패턴 자체가 이 파일에 평문으로 있으면 스스로 걸린다 — rot13·유니코드 이스케이프로 둔다
import codecs  # noqa: E402
bad = re.compile(codecs.decode("qnnata|fx ?tebhc|tp ?pbzcnal|arkhf pbzzhavgl|vat ?fgbel", "rot13") + "|" + "\ub2f9\uadfc|sk\uadf8\ub8f9|gc\ucef4\ud37c\ub2c8", re.I)
files = subprocess.run(["git", "ls-files", "meeting-copilot", "docs"], cwd=ROOT.parent,
                       capture_output=True, text=True).stdout.split()
hits = []
for f in files:
    p = ROOT.parent / f
    if p.suffix in (".py", ".html", ".js", ".mjs", ".json", ".md", ".sh") and p.exists():
        for i, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if bad.search(line):
                hits.append(f"{f}:{i}")
check("추적 파일에 고객사 실명 0", not hits, ", ".join(hits[:5]))

shutil.rmtree(TMP, ignore_errors=True)
print(f"\n{'✅ 전부 통과' if not fails else '❌ 실패 ' + str(len(fails)) + '건: ' + ', '.join(fails)}")
sys.exit(1 if fails else 0)
