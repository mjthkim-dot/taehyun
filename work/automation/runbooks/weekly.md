# 주간 런북 — 금요일 20분

```
work/pipeline/pipeline.csv 와 이번 주 work/accounts/*/timeline.md 변경분을 읽고
work/pipeline/weekly/_TEMPLATE.md 포맷으로 주간 리뷰를 작성해줘.
저장: work/pipeline/weekly/<YYYY-Www>.md

특히:
- 14일 이상 stage 변화 없는 딜을 "막힌 딜"로 분류하고 병목 유형을 붙여줘
  (유형은 stages.yml 의 blockers 값)
- next_action_due 가 지난 건은 전부 상단에 경고로 모아줘
- 다음 주 최우선 3건은 금액이 아니라 "병목이 풀릴 가능성" 기준으로 골라줘
```

## 분기 정리
```
stage 가 won / lost 인 고객사 폴더를 work/archive/<YYYY>/ 로 옮기고
pipeline.csv 에서 해당 행을 제거해줘. timeline.md 는 그대로 보존.
```
