# 파이프라인 상세

목차: 1) 공통 규칙 · 2) probe.py · 3) keyframes.py · 4) audio.py · 5) transcribe.py ·
6) 실패 대처 · 7) 성능

## 1. 공통 규칙

- 모든 스크립트는 **표준 라이브러리만** 쓴다. 설치가 필요한 것은 ffmpeg뿐이다.
- ffmpeg 탐색 순서: `$VIDEO_ANALYSIS_FFMPEG` → `PATH` → `imageio-ffmpeg` 번들 바이너리.
  ffprobe는 `$VIDEO_ANALYSIS_FFPROBE` → `PATH`. **ffprobe는 없어도 된다** — 없으면
  `ffmpeg -i`의 stderr를 파싱해 길이·해상도·fps를 뽑는다(정확도 동일, 소수점만 덜 정밀).
- 산출물은 전부 `--outdir` 아래에만 쓴다. 원본 영상은 읽기만 한다.
- 실패는 조용히 넘어가지 않는다. exit 1 = 오류, exit 2 = "이 단계는 해당 없음"(예: 무음).

## 2. probe.py

```
probe.py VIDEO [--json]
```

길이·해상도·fps·코덱·오디오 유무를 찍고 **샘플링 계획**을 추천한다. 계획은 길이만
보고 정한다 — 길수록 프레임을 더 뽑는 게 아니라 **더 성기게** 뽑는다. 예산은 영상
길이가 아니라 컨텍스트이기 때문이다.

`--json`은 스크립트에서 쓰기 좋은 형태다. `.plan.max_frames`, `.plan.grid`,
`.plan.audio_chunk_seconds`를 그대로 다음 단계에 넘기면 된다.

**먼저 확인할 두 필드**: `has_audio`가 false면 3~4단계를 건너뛴다. `duration_sec`가
3600을 넘으면 구간을 나눠 들어간다.

## 3. keyframes.py

```
keyframes.py VIDEO --outdir DIR
    [--mode auto|scene|interval]   기본 auto
    [--max-frames N]               기본 32
    [--interval SEC]               interval 모드 간격 (0=자동 계산)
    [--scene-threshold F]          기본 0.30 (낮출수록 민감)
    [--grid CxR]                   기본 4x4
    [--width PX]                   기본 480 (프레임 가로폭)
    [--start SEC] [--end SEC]      구간 한정
    [--keep-frames]                개별 프레임 파일 보존
```

**모드 선택.**
- `scene` — 320px/4fps로 다운스케일한 사본에서 장면 전환을 찾는다. 컷이 있는
  영상(강의, 편집물, 미팅 화면 전환)에 맞는다.
- `interval` — 균등 간격. 화면 녹화·연속 촬영처럼 컷이 없는 영상에 맞는다.
- `auto` — scene을 먼저 시도하고, 컷이 4개 미만이면 interval로 자동 전환한다.
  결과의 `mode` 필드에 실제로 무엇이 쓰였는지 남는다.

**타일링.** 프레임은 `cols*rows`씩 묶여 시트가 된다. 마지막 묶음이 모자라면
검은 칸으로 채운다(ffmpeg `tile` 필터가 꽉 찬 묶음에서만 출력하기 때문). 시트의
검은 칸은 패딩이지 내용이 아니다.

**라벨.** drawtext 필터가 있으면 각 프레임 좌상단에 `mm:ss`를 굽는다. 정적 빌드는
libfreetype이 빠져 있는 경우가 많아 `labels_burned_in: false`가 되는데, 이때는
`index.json`의 셀 매핑이 유일한 시간 근거다.

**추출 정확도.** `-ss (t-1)`로 빠르게 탐색한 뒤 1초를 정밀 탐색한다. 키프레임 간격이
큰 코덱에서도 ±0.1초 안쪽으로 들어온다. 완전 정밀이 필요하면 `--start`로 창을 좁혀라.

### index.json 구조

```json
{
  "video": "/abs/path.mp4", "duration_hms": "12:30",
  "mode": "scene", "frame_count": 32, "grid": "4x4",
  "labels_burned_in": false,
  "sheets": [{"file": "sheet_01.jpg", "from": "00:00", "to": "05:41",
              "cells": [{"cell": "R1C1", "timecode": "00:00"}]}],
  "frames": [{"index": 0, "t_sec": 0.0, "timecode": "00:00",
              "sheet": "sheet_01.jpg", "cell": "R1C1"}]
}
```

## 4. audio.py

```
audio.py VIDEO --outdir DIR
    [--chunk-seconds N]   기본 900 (15분)
    [--max-mb F]          기본 24 — 이보다 크면 분할
    [--bitrate B]         기본 32k
    [--start SEC] [--end SEC]
```

16kHz 모노 MP3 32kbps로 뽑는다. 시간당 약 14MB이므로 1.5시간까지는 한 파일로 간다.
넘으면 `chunks/part_NNN.mp3`로 자르고 `audio_index.json`에 각 조각의 **절대 오프셋**을
기록한다. 이 오프셋이 있어야 전사 타임코드가 원본 시각과 맞는다.

음성 스트림이 없으면 exit 2로 끝난다. 오류가 아니라 "해당 없음" 신호다.

품질을 올리고 싶으면 `--bitrate 64k`. 음악·다중 화자·잡음이 심한 녹음에서 체감 차이가
있다. 대신 파일이 두 배가 되니 `--max-mb`도 함께 본다.

## 5. transcribe.py

```
transcribe.py AUDIO_DIR_OR_FILE
    [--backend auto|groq|openai|local]
    [--model M] [--language ko] [--prompt "고유명사 목록"] [--outdir DIR]
```

`audio_index.json`이 있으면 조각별 오프셋을 더해 하나의 타임라인으로 병합한다.
백엔드·모델·언어 처리는 `transcription.md` 참조.

산출물 셋 중 **판독에는 `transcript.md`를 읽는다** — `[mm:ss] 발화` 한 줄 포맷이라
타임라인 병합이 바로 된다. `.json`은 후처리용, `.srt`는 사용자에게 자막으로 줄 때.

## 6. 실패 대처

| 증상 | 원인 | 대처 |
|---|---|---|
| `ffmpeg not found` | PATH에 없음 | `pip install imageio-ffmpeg` (권한 불필요) |
| 프레임이 0개 | 손상 파일 / 비디오 스트림 없음 | `probe.py`의 `has_video` 확인 |
| scene 모드인데 프레임이 몰림 | 임계값이 낮음 | `--scene-threshold 0.45`로 올린다 |
| 시트가 온통 비슷한 화면 | 화면 녹화인데 scene 모드 | `--mode interval --interval 10` |
| 화면 글씨가 안 읽힘 | 해상도 부족 | `--width 960 --grid 2x2` (셀당 면적 확보) |
| 전사 HTTP 401 | 키 없음/오타 | `echo $GROQ_API_KEY`로 확인 |
| 전사 HTTP 413 | 조각이 너무 큼 | `audio.py --max-mb 18 --chunk-seconds 600` |
| 타임코드가 밀림 | 오프셋 유실 | `transcribe.py`에 **파일이 아닌 디렉터리**를 넘겼는지 확인 |

## 7. 성능

- scene 감지는 전체 디코딩이 필요하다. 1시간 1080p 영상에서 수 분 걸릴 수 있다.
  급하면 `--mode interval`이 훨씬 빠르다(탐색만 하고 끝).
- 프레임 추출은 프레임당 0.1~0.3초. 32프레임이면 10초 안쪽.
- 전사는 Groq turbo 기준 실시간 대비 20~40배 빠르다. 로컬 CPU whisper는 반대로
  실시간보다 느릴 수 있다.
- 병렬화는 하지 않았다. 순차 실행이 충분히 빠르고, 실패 지점을 읽기 쉽다.
