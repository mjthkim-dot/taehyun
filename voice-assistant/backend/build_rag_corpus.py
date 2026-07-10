#!/usr/bin/env python3
"""
RAG 코퍼스 빌더 — next-app/data/lessons.json(레슨/시나리오 원천 데이터)에서
한국어↔영어 문장쌍을 뽑아 backend/data/rag_corpus.jsonl 로 저장한다.

이 JSONL이 실시간 번역/영어 답변셋(RAG) 기능의 검색 대상 코퍼스가 된다.
임베딩은 여기서 만들지 않는다 — 임베딩은 Ollama가 있는 실행 환경(맥북)에서
rag_pipeline.RagIndex가 최초 요청 시 빌드해 backend/data/rag_index.json에 캐시한다.

실행:
    cd voice-assistant/backend
    python3 build_rag_corpus.py
"""
from __future__ import annotations

import json
from pathlib import Path

LESSONS_JSON = Path(__file__).parent.parent.parent / "next-app" / "data" / "lessons.json"
OUT_PATH = Path(__file__).parent / "data" / "rag_corpus.jsonl"


def _add(entries: list[dict], en: str | None, kr: str | None, category: str, cefr: str | None, source: str) -> None:
    en = (en or "").strip()
    kr = (kr or "").strip()
    if not en or not kr:
        return
    entries.append({"en": en, "kr": kr, "category": category, "cefr": cefr, "source": source})


def extract(data: dict) -> list[dict]:
    entries: list[dict] = []

    # LESSONS — 문법/발음 포인트(en/kr) 위주
    for lesson in data.get("LESSONS", []):
        title = lesson.get("title", "")
        for section in lesson.get("sections", []):
            for point in section.get("points", []):
                _add(entries, point.get("en"), point.get("kr"), title, None, "lessons.points")

    # MASTER_LESSONS — CEFR 레벨별 포인트/예문/대화
    for lesson in data.get("MASTER_LESSONS", []):
        title = lesson.get("title", "")
        cefr = lesson.get("master")
        for section in lesson.get("sections", []):
            for point in section.get("points", []):
                _add(entries, point.get("en"), point.get("kr"), title, cefr, "master.points")
        for ex in lesson.get("examples", []):
            _add(entries, ex.get("en"), ex.get("kr"), title, cefr, "master.examples")
        dialogue = lesson.get("dialogue") or {}
        dlg_title = dialogue.get("title", title)
        for line in dialogue.get("lines", []):
            _add(entries, line.get("en"), line.get("kr"), dlg_title, cefr, "master.dialogue")

    # SCENARIO_LIBRARY — 상황별 대화(공항/식당/병원 등) — 답변셋 RAG의 핵심 소스
    for scenario in data.get("SCENARIO_LIBRARY", []):
        category = scenario.get("category", "scenario")
        dialogue = scenario.get("dialogue") or {}
        for line in dialogue.get("lines", []):
            _add(entries, line.get("en"), line.get("kr"), category, None, "scenario.dialogue")

    return entries


def dedupe(entries: list[dict]) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    unique: list[dict] = []
    for e in entries:
        key = (e["en"], e["kr"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)
    return unique


def main() -> None:
    data = json.loads(LESSONS_JSON.read_text(encoding="utf-8"))
    entries = dedupe(extract(data))
    for i, e in enumerate(entries):
        e["id"] = i

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    print(f"✅ {len(entries)}개 KR↔EN 문장쌍 → {OUT_PATH}")


if __name__ == "__main__":
    main()
