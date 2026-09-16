# 일간 런북 — 미팅/콜 직후 5분

Claude에 아래를 그대로 던진다.

---

## A. 미팅 회의록 작성
```
work/templates/meeting-minutes.md 포맷으로 회의록을 작성해줘.
고객사: <고객사명>  날짜: <YYYY-MM-DD>
원본: work/accounts/<slug>/inbox/<파일> (없으면 아래 메모 사용)

메모:
<받아적은 것 붙여넣기>

저장: work/accounts/<slug>/meetings/<YYYY-MM-DD>-meeting-<키워드>.md
그리고 work/accounts/<slug>/timeline.md 맨 위에 한 줄 추가.
확인 안 된 금액/기간/고객 발언은 [CONFIRM]으로 남겨.
```

## B. SFDC 콜로그 변환
```
방금 만든 회의록을 work/templates/sfdc-call-log.md 포맷으로 변환해줘.
매핑은 work/automation/config/sfdc-fieldmap.yml 을 따른다. 5줄 이내로.
```

## C. 후속 메일 초안
```
work/templates/email-ko.md 포맷으로 후속 메일 초안만 작성해줘. 발송하지 마.
회의록의 Next Action 중 고객이 할 일 하나만 구체적으로 요청하는 걸로 닫아줘.
```

## D. 파이프라인 반영
```
work/pipeline/pipeline.csv 에서 <slug> 행의 stage / next_action / next_action_due /
key_blocker 를 갱신해줘. 스테이지 값은 work/automation/config/stages.yml 것만 써.
exit_criteria 를 못 채웠으면 승급하지 말고 이유를 알려줘.
```
