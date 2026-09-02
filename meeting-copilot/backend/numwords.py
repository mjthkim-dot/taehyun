"""풀어 쓴 수치 → 숫자. 검증기의 눈을 넓힌다.

왜 필요한가(실측 2026-09-02): 프롬프트는 "숫자를 말로 풀어 쓰라"고 시키고
(그게 말하기엔 맞다), 검증기는 아라비아 숫자만 봤다. 그래서 후속 질문에서
모델이 지어낸 "about four months", "three to five meetings a month",
"thirty to forty percent"가 전부 검증을 통과했다. 서로 모순인 두 규칙이
날조를 통과시키고 있었다.

여기서는 영어 수사(數詞)를 수치로 바꾼다. "seventy-five million" → 75_000_000,
"three to five" → [3, 5], "one in three" → [1, 3], "four months" → 4.
양쪽(자료·답변)을 같은 방식으로 수치화하면 표기가 달라도 비교가 된다.
"""
from __future__ import annotations

import re

_ONES = {"zero":0,"one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,
         "eight":8,"nine":9,"ten":10,"eleven":11,"twelve":12,"thirteen":13,
         "fourteen":14,"fifteen":15,"sixteen":16,"seventeen":17,"eighteen":18,
         "nineteen":19}
_TENS = {"twenty":20,"thirty":30,"forty":40,"fifty":50,"sixty":60,"seventy":70,
         "eighty":80,"ninety":90}
_SCALE = {"hundred":100,"thousand":1_000,"k":1_000,"million":1_000_000,"m":1_000_000,
          "billion":1_000_000_000,"b":1_000_000_000}
_WORD = set(_ONES) | set(_TENS) | {"hundred", "thousand", "million", "billion"} | {"and", "a", "half", "point"}
# 'a hundred', 'a million' — 관사가 1의 역할
_ARTICLE_ONE = {"a", "an"}

_TOKEN = re.compile(r"[a-z]+(?:-[a-z]+)?|\d[\d,]*(?:\.\d+)?|%", re.I)


def _words_to_int(words: list[str]) -> float | None:
    """['seventy','five','million'] → 75000000. 인식 못 하면 None."""
    total = 0.0
    cur = 0.0
    seen = False
    # 관사 'a'는 바로 뒤가 단위(hundred·million·half)일 때만 1이다.
    # 'a three-year'의 a는 숫자가 아니다 — 안 거르면 3이 4가 된다.
    cleaned: list[str] = []
    for i, w in enumerate(words):
        w = w.lower()
        if w in _ARTICLE_ONE:
            nxt = words[i + 1].lower() if i + 1 < len(words) else ""
            prev = cleaned[-1] if cleaned else ""
            # 'half a million'의 a는 이미 half가 수량이라 0이다
            if nxt in ("hundred", "thousand", "million", "billion", "half") and prev != "half":
                cleaned.append("one")
            continue
        cleaned.append(w)
    for w in cleaned:
        if w == "and":
            continue
        if w in _ONES:
            cur += _ONES[w]; seen = True
        elif w in _TENS:
            cur += _TENS[w]; seen = True
        elif w == "hundred":
            cur = (cur or 1) * 100; seen = True
        elif w in ("thousand", "k", "million", "m", "billion", "b"):
            total += (cur or 1) * _SCALE[w]; cur = 0; seen = True
        elif w == "half":
            cur += 0.5; seen = True
        else:
            return None
    return (total + cur) if seen else None


def extract(text: str) -> list[tuple[str, float]]:
    """본문에서 수치 표현을 뽑는다 → [(원문 조각, 값)].

    잡는 것: 아라비아 숫자(50.7M, 89%, 1,700), 풀어 쓴 수(seventy-five million,
    three to five, one in three, four months). 라벨(L4·n8n·D2C)과 연도는
    수치 주장이 아니라 제외한다.
    """
    out: list[tuple[str, float]] = []
    # 1) 아라비아 숫자 — 앞뒤가 글자면 라벨(L4, n8n)이라 건너뛴다
    for m in re.finditer(r"(?<![A-Za-z0-9])(\d[\d,]*(?:\.\d+)?)\s*(%|억|만|천|million|m|billion|b|k)?(?![A-Za-z])",
                         text, re.I):
        raw = m.group(0).strip()
        digits = m.group(1).replace(",", "")
        if re.fullmatch(r"(19|20)\d\d", digits):
            continue                                   # 연도
        val = float(digits)
        suf = (m.group(2) or "").lower()
        if suf in _SCALE:
            val *= _SCALE[suf]
        out.append((raw, val))
    # 2) 풀어 쓴 수 — 수사 토큰이 연속된 구간을 한 덩어리로
    toks = [(t.group(0), t.start(), t.end()) for t in re.finditer(r"[a-z]+(?:-[a-z]+)?", text, re.I)]
    i = 0
    while i < len(toks):
        j = i
        words: list[str] = []
        while j < len(toks):
            w = toks[j][0].lower()
            parts = w.split("-") if "-" in w else [w]
            if all(p in _WORD for p in parts):
                words.extend(parts); j += 1
            elif "-" in w and parts[0] in (set(_ONES) | set(_TENS) | {"hundred"}):
                words.append(parts[0]); j += 1; break     # three-year → three, 뒤는 단위
            else:
                break
        # 'a'·'and'만으로 된 덩어리는 수가 아니다
        if words and any(p in _ONES or p in _TENS or p in _SCALE for p in words):
            val = _words_to_int(words)
            if val is not None:
                out.append((text[toks[i][1]:toks[j-1][2]], val))
            i = j
        else:
            i += 1
    return out


def values(text: str) -> set[float]:
    """비교용 값 집합. 백분율·배수·기간 단위는 구분하지 않고 값만 본다 —
    검증 목적은 '이 숫자가 자료 어디에 있느냐'라서, 단위가 달라도 같은 값이면
    출처가 있을 가능성이 높다(위양성 억제)."""
    return {v for _, v in extract(text)}


def unverified(answer: str, known: set[float]) -> list[str]:
    """답변 속 수치 중 자료(known)에 없는 것의 원문 조각."""
    bad = []
    for raw, v in extract(answer):
        if any(abs(v - k) <= max(0.05 * max(abs(k), 1), 0.01) for k in known):
            continue                                   # 근사 일치(반올림·'about')
        bad.append(raw)
    return bad


def fmt(v: float) -> str:
    """허용 목록 표기용. 75600000 → '75.6M', 89 → '89', 0.5 → '0.5'."""
    if v >= 1_000_000_000:
        return f"{v/1_000_000_000:g}B"
    if v >= 1_000_000:
        return f"{v/1_000_000:g}M"
    if v >= 10_000:
        return f"{v/1_000:g}K"
    return f"{v:g}"
