# 전사(STT) 백엔드

## 1. 백엔드 선택

`--backend auto`는 이 순서로 고른다: `GROQ_API_KEY` → `OPENAI_API_KEY` → 로컬 `whisper` CLI.
셋 다 없으면 오류로 끝내고 설치 안내를 낸다. 사용자에게 물어보기 전에 이 순서를
먼저 확인한다.

| 백엔드 | 기본 모델 | 특징 | 언제 |
|---|---|---|---|
| `groq` | `whisper-large-v3-turbo` | 가장 빠름, 한국어 양호 | 기본값. 키가 있으면 이걸 쓴다 |
| `openai` | `whisper-1` | 안정적, 널리 쓰임 | Groq 키가 없을 때 |
| `local` | `small` | 네트워크 불필요 | 민감한 녹음, 오프라인, 키 없음 |

**민감한 고객 녹음은 로컬을 우선 검토한다.** 외부 API로 올리는 순간 그 오디오는
사용자 통제를 벗어난다. 고객사 실명·금액·계약 내용이 담긴 녹음이라면 업로드 전에
사용자에게 확인을 받는다 — 이건 판단 사항이지 자동 진행할 일이 아니다.

## 2. API 키

```bash
export GROQ_API_KEY=gsk_...      # console.groq.com — 무료 티어 넉넉함
export OPENAI_API_KEY=sk-...     # platform.openai.com
```

키를 리포트·커밋·로그에 절대 쓰지 않는다. `preflight.sh`는 설정 여부만 보고 값은 찍지 않는다.

## 3. 모델 고르기

```bash
# 속도 우선 (기본)
transcribe.py <dir> --backend groq --model whisper-large-v3-turbo

# 정확도 우선 — 고유명사·숫자가 중요한 녹음
transcribe.py <dir> --backend groq --model whisper-large-v3

# 로컬: tiny < base < small < medium < large-v3 (뒤로 갈수록 느리고 정확)
transcribe.py <dir> --backend local --model medium
```

turbo와 large-v3의 차이는 주로 **고유명사와 숫자**에서 난다. 금액·날짜·제품명이
결론을 좌우하는 녹음이면 large-v3로 다시 돌릴 값어치가 있다.

## 4. 한국어 처리

- `--language ko`를 명시한다. 자동 감지는 짧은 조각이나 영어가 섞인 구간에서
  일본어·중국어로 흔들린다.
- **영어가 섞인 한국어**(엔터프라이즈 회의의 기본값)에서 Whisper는 영어 기술 용어를
  한글 음차로 적는 경향이 있다. `--prompt`로 정정 힌트를 준다:

```bash
transcribe.py <dir> --language ko \
  --prompt "AWS, GCP, Databricks, Snowflake, GitLab, DevSecOps, Savings Plans, PoC, ISMS-P"
```

  프롬프트는 어휘 힌트일 뿐 강제가 아니다. 결과는 여전히 검증 대상이다.

- 숫자 표기가 흔들린다("삼십억" / "30억" / "3,000,000,000"). 금액·비율은 리포트에
  옮길 때 `[전사 확인 필요]`를 붙이고, 화면에 숫자가 떴다면 해당 시각 프레임으로
  교차 검증한다.

## 5. 화자 분리(diarization)는 없다

Whisper 계열은 "누가 말했는지"를 주지 않는다. 사실이 아닌 것을 지어내지 않으려면:

1. **화면 근거를 쓴다** — 화상회의 녹화라면 발화 시점 프레임의 활성 화자 테두리·
   이름표를 읽어 매핑한다. 근거 타임코드를 함께 적는다.
2. **말투·역할로 추정했다면 `[추정]`을 붙인다.**
3. 정확한 화자 분리가 요건이면 사용자에게 알린다 — pyannote.audio 같은 별도 도구가
   필요하고, 이 스킬 범위 밖이다.

## 6. 이미 자막이 있는 파일

STT보다 정확하고 공짜다. 먼저 확인한다:

```bash
ffmpeg -i "<video>" -map 0:s:0 <work>/subs.srt   # 자막 트랙이 없으면 실패한다
```

성공하면 `subs.srt`를 `transcript.md` 대신 읽는다(포맷만 다를 뿐 타임코드 축은 같다).
유튜브 등에서 받은 `.srt`/`.vtt` 동반 파일이 있으면 그쪽이 먼저다.

## 7. 실패 신호 읽기

| 응답 | 뜻 | 대처 |
|---|---|---|
| segments 0개 | 발화 없음 또는 순수 음악 | 무음 취급, 프레임만으로 판독 |
| 같은 문장 반복 | Whisper 환각(무음 구간에서 흔함) | 해당 구간 폐기, 리포트에서 뺀다 |
| HTTP 429 | 레이트 리밋 | 스크립트가 4회까지 지수 백오프로 재시도한다. 계속되면 잠시 뒤 재실행 |
| HTTP 413 | 파일 초과 | `audio.py --max-mb 18`로 다시 자른다 |

**환각은 실제로 자주 나온다.** 긴 무음 뒤 갑자기 같은 문장이 반복되면 그건 발화가
아니다. 프레임과 대조해 확인하고 버린다.
