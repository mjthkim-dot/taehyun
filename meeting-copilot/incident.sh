#!/usr/bin/env bash
# 장애 진단 — logs/api-trace.jsonl에서 오류 구간을 요약해 "붙여넣기용 블록"으로 출력.
# 사용: bash incident.sh [최근 N분, 기본 60]
# 429(한도)와 500/503(공급자측 일시 오류)을 구분 집계한다 — 대응이 완전히 다르다:
#   429 다발 → 버스트/한도 문제 (게이트웨이 설정 GW_RPM 하향 또는 유료 티어 확인)
#   5xx 다발 → Gemini측 장애 (기다리면 지나감 — 키·한도를 만질 필요 없음)
cd "$(dirname "$0")"
MIN="${1:-60}" python3 - <<'EOF'
import json, os, time, itertools
from pathlib import Path

path = Path(os.environ.get("MC_DATA_DIR") or ".") / "logs" / "api-trace.jsonl"
if not path.exists():
    raise SystemExit(f"트레이스 없음: {path} — 서버가 게이트웨이 계측과 함께 실행된 적이 없습니다")
cutoff = time.time() - int(os.environ.get("MIN", "60")) * 60
rows = []
for ln in path.read_text(encoding="utf-8").splitlines():
    try:
        r = json.loads(ln)
    except json.JSONDecodeError:
        continue
    if r.get("ts", 0) >= cutoff:
        rows.append(r)
if not rows:
    raise SystemExit(f"최근 {os.environ['MIN']}분 트레이스가 없습니다 ({path})")

n429 = sum(1 for r in rows if r["status"] == 429)
n5xx = sum(1 for r in rows if 500 <= r["status"] < 600)
nconn = sum(1 for r in rows if r["status"] == 0)
ok = sum(1 for r in rows if r["status"] == 200)
retries = sum(1 for r in rows if r.get("attempt", 0) > 0)
kinds = {}
for r in rows:
    kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1

print("■ 장애 진단 블록 (이대로 복사해서 붙여넣으세요)")
print("```")
print(f"기간: {rows[0]['t']} ~ {rows[-1]['t']}  (최근 {os.environ['MIN']}분, 시도 {len(rows)}건)")
print(f"결과: 성공 {ok} · 429(한도) {n429} · 5xx(공급자 오류) {n5xx} · 연결실패 {nconn} · 재시도 {retries}")
print(f"유형: " + " · ".join(f"{k} {v}" for k, v in sorted(kinds.items())))
peak = max(rows, key=lambda r: r.get("rpm60", 0))
print(f"최대 발사율: 60초 {peak['rpm60']}건 ({peak['t']}) · 최대 동시 {max(r.get('inflight',0) for r in rows)}")

# 오류를 15초 창으로 묶어 구간 요약 — "언제, 몇 건 몰렸고, 뭐가 났나"
errs = [r for r in rows if r["status"] != 200]
if not errs:
    print("오류 구간: 없음 ✅")
else:
    for _, grp in itertools.groupby(errs, key=lambda r: int(r["ts"] // 15)):
        g = list(grp)
        c429 = sum(1 for r in g if r["status"] == 429)
        c5 = sum(1 for r in g if 500 <= r["status"] < 600)
        parts = [p for p in [f"429 {c429}건" if c429 else "", f"5xx {c5}건" if c5 else "",
                             f"연결실패 {len(g)-c429-c5}건" if len(g)-c429-c5 else ""] if p]
        ra = next((r["retry_after"] for r in g if r.get("retry_after")), None)
        print(f"[{g[0]['t']}~{g[-1]['t']}] 60초 발사 {g[0]['rpm60']}건 · 동시 {max(r['inflight'] for r in g)}"
              f" → {' + '.join(parts)}" + (f" (Retry-After: {ra}s)" if ra else ""))
        worst = max(g, key=lambda r: r["status"])
        if worst.get("err"):
            print(f"  └ 오류 원문: {worst['err'][:160]}")
if n429 and not n5xx:
    print("→ 판독: 한도 문제. GW_RPM(현 게이트웨이 발사 상한)을 낮추거나 유료 한도를 확인하세요.")
elif n5xx and not n429:
    print("→ 판독: 공급자측 일시 오류. 키·한도 문제가 아닙니다 — 기다리면 지나갑니다.")
elif n429 and n5xx:
    print("→ 판독: 혼합 — 5xx 구간과 429 구간의 시각을 위에서 분리해 보세요.")
print("```")
EOF
