# work/ — 세일즈 업무 자동화 워크스페이스

자동화의 전제는 스크립트가 아니라 **예측 가능한 경로와 파일명**이다.
사람이 어디에 둘지 고민하는 순간 자동화는 멈춘다. 이 폴더는 그 고민을 없앤다.

## 1. 설계 원칙 4가지

| 원칙 | 규칙 | 왜 |
|---|---|---|
| **① 고객사 단위** | 모든 자료는 `accounts/<slug>/` 안에 산다 | 딜의 맥락은 고객사에 붙는다. 날짜·도구가 아니라 |
| **② 원본과 산출물 분리** | `inbox/`(읽기 전용 원본) → `deliverables/`(내보낼 것) | 원본을 덮어쓰면 복구가 안 된다 |
| **③ 이름이 곧 인덱스** | `YYYY-MM-DD-<유형>.md` | `ls`만으로 시간순 정렬, `grep`만으로 검색 |
| **④ 상태는 한 곳에만** | 딜 상태 = `pipeline/pipeline.csv` 단일 원천 | 두 곳에 적히는 순간 둘 다 못 믿는다 |

## 2. 폴더 구조

```
work/
├── accounts/                  # 고객사 단위 — 자동화의 기본 단위
│   ├── _TEMPLATE/             # 새 고객사는 이걸 복사 (scripts/new-account.sh)
│   │   ├── account.md         # 고정 사실 + MEDDPICC (덮어쓰며 갱신)
│   │   ├── timeline.md        # 활동 로그 (append-only, 지우지 않는다)
│   │   ├── inbox/             # 원본: 메일, 녹취, RFP, 고객 제공 자료
│   │   ├── meetings/          # YYYY-MM-DD-<주제>.md — 미팅 1건 = 파일 1개
│   │   └── deliverables/      # 제안서·SoW·견적 — 고객에게 나갈 것만
│   └── <slug>/                # 예: dearu, karrot  (영문 소문자-하이픈, 공백 금지)
├── pipeline/
│   ├── pipeline.csv           # 단일 진실 원천 (gitignored — 실데이터)
│   ├── pipeline.sample.csv    # 컬럼 정의
│   └── weekly/YYYY-Www.md     # 주간 리뷰 스냅샷
├── templates/                 # 반복 산출물의 뼈대 — 자동화가 읽는 포맷 계약
├── automation/
│   ├── config/                # 스테이지 정의, SFDC 필드 매핑
│   ├── runbooks/              # 일간·주간 반복 요청문 (Claude에게 그대로 던진다)
│   └── scripts/               # 실행 스크립트 (파일명 = 동사)
└── archive/YYYY/              # Closed Won/Lost — 끝난 딜은 즉시 옮긴다
```

## 3. 파일명 규칙 (깨지면 자동화가 깨진다)

- 고객사 폴더: **영문 소문자 + 하이픈**. 한글·공백·대문자 금지. (`dearu`, `lg-cns`)
- 미팅/문서: `YYYY-MM-DD-<유형>-<키워드>.md` → `2026-09-16-meeting-gitlab-poc.md`
- 유형 값 고정: `meeting` · `call` · `email` · `proposal` · `sow` · `quote` · `research`
- 모든 `.md`는 **YAML front matter**로 시작한다. 스크립트와 Claude가 읽는 메타데이터다.

## 4. 데이터 경계 (중요)

이 저장소는 **public**이다. `.gitignore`가 `accounts/*`와 `pipeline/pipeline.csv`를
막고 있고, 추적되는 것은 구조·템플릿·설정뿐이다.

고객사 실데이터를 팀과 공유해야 하면 **별도 private 저장소**로 분리한다.
public repo에 한 번 올라간 고객 정보는 커밋을 지워도 회수되지 않는다.

## 5. 하루 사용법

```bash
./automation/scripts/new-account.sh dearu "디어유"   # 새 고객사 개설
# 미팅 끝나면 → automation/runbooks/daily.md 의 요청문을 Claude에 붙여넣기
# 금요일 → automation/runbooks/weekly.md
```
