# work/ 작업 규칙 (Claude 전용)

이 폴더 안에서 작업할 때 아래를 예외 없이 지킨다.

## 하드 가드레일
1. **메일·메시지를 절대 자동 발송하지 않는다.** 초안(draft)까지만. 발송은 사람이 한다.
2. **고객사 실데이터를 커밋하지 않는다.** `accounts/<slug>/`, `pipeline/pipeline.csv`,
   `pipeline/weekly/`는 `.gitignore` 대상이다. `git add -f`로 우회하지 않는다.
3. **추측을 사실처럼 쓰지 않는다.** 확인 안 된 값은 `[CONFIRM]` 태그로 남긴다.
   금액·기간·고객 발언은 특히 그렇다.

## 파일을 만들 때
- 저장 위치는 `README.md`의 구조를 따른다. 새 최상위 폴더를 임의로 만들지 않는다.
- 파일명: `YYYY-MM-DD-<유형>-<키워드>.md`, 유형은 README §3의 고정 값만 쓴다.
- `templates/`의 해당 템플릿을 뼈대로 쓴다. 섹션 제목을 바꾸지 않는다 —
  스크립트와 SFDC 매핑(`automation/config/sfdc-fieldmap.yml`)이 제목으로 파싱한다.

## 기록할 때
- `timeline.md`는 **append-only**. 기존 줄을 수정·삭제하지 않는다.
- `account.md`는 최신 상태로 덮어쓴다(고정 사실 + MEDDPICC).
- 딜 스테이지·금액 변경은 `pipeline/pipeline.csv`에만 반영한다. 다른 파일에 중복 기록 금지.

## 참조
사전 영업 업무(계정 리서치·미팅 준비·회의록·제안서·SFDC 로깅)는
`sales-hunter-ops` 스킬의 규칙이 우선한다. 이 문서는 그 위의 파일 배치 규약이다.
