# 배포 가이드 — 로컬에서 웹 서비스까지

> 대상: `meeting-copilot/` · 관련 자산: `meeting-copilot/deploy/`
> 웹 전환 분석과 실측 근거: [REPORT.md](./REPORT.md) 8장

이 앱은 세 가지 모드로 동작하며, **모드는 설정으로 갈린다 — 코드는 하나다.**

| 모드 | 인증 | 데이터 | 언제 |
|---|---|---|---|
| ① 로컬 개인 | 꺼짐 | `backend/data/store.db` | 지금처럼 내 노트북에서 |
| ② 개인용 웹 | 켜짐(사용자 1명) | `MC_DATA_DIR/u/1/` | 폰·회사 PC 어디서든 나 혼자 |
| ③ 다중 사용자 | 켜짐(N명) | 사용자별 파일 | 지인·팀에게 계정을 나눠줄 때 |

인증은 **사용자가 1명이라도 등록되는 순간** 켜진다. 웹 가입은 없다(초대제) —
사용자 추가는 서버에서 `manage.py`로만 한다.

## 안전 기본값 (실수 방지 장치)

- **무인증 공개 불가**: `HOST`가 127.0.0.1이 아닌데 사용자가 없으면 서버가
  기동을 거부한다. "일단 0.0.0.0으로 열어보자"가 사고로 이어지지 않는다.
- 세션 쿠키: HttpOnly · SameSite=Lax · (HTTPS 감지 시) Secure
- 로그인: scrypt 해시 · 5회 무료 후 지수 락아웃 · 타이밍 균일화
- 사용자별 LLM 쿼터: 기본 15회/분 · 600회/일 (실측 미팅 소비 3.8회/분의 4배 여유)

## ① → ② 개인용 웹 (약 30분)

서버(VPS 등)에서:

```bash
# 1. 코드 배치
sudo git clone <repo> /opt/meeting-copilot/..   # meeting-copilot 폴더 기준

# 2. LLM 키 (0600)
sudo cp meeting-copilot/deploy/meeting-copilot.env.example /etc/meeting-copilot.env
sudo chmod 600 /etc/meeting-copilot.env && sudo vi /etc/meeting-copilot.env

# 3. 첫 사용자(=관리자) — 이 순간부터 인증이 켜진다
cd /opt/meeting-copilot
sudo MC_DATA_DIR=/var/lib/meeting-copilot python3 manage.py adduser 태현 --admin

# 4. systemd 등록
sudo cp deploy/meeting-copilot.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now meeting-copilot

# 5. TLS 프록시 (Caddy — 도메인만 바꾸면 인증서 자동)
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # 도메인 수정 후
sudo systemctl reload caddy
```

폰에서 `https://도메인/app.html` → 로그인 → 홈 화면에 추가(PWA).

**기존 로컬 데이터 가져가기**: 노트북의 `backend/data/store.db`를 서버로 복사한 뒤
`python3 manage.py adopt 태현` — 파일 복사가 아니라 sqlite backup API로 이관된다.

## ③ 다중 사용자

```bash
python3 manage.py adduser 동료이름          # 접속 코드는 프롬프트로
python3 manage.py list                      # 사용자·자료 현황
python3 manage.py disable 동료이름          # 정지 (기존 세션 즉시 거부)
python3 manage.py deluser 동료이름 --purge  # 탈퇴 + 데이터 폴더 삭제
```

- 사용자마다 **물리적으로 분리된 SQLite 파일** (`u/<id>/store.db`) — 검색 락도
  사용자별이라 서로의 실시간 지연에 영향을 주지 않는다
- 신규 사용자는 도메인 용어집 70개가 자동 시드되어 첫 화면부터 검색이 동작한다

## 운영

| 작업 | 방법 |
|---|---|
| 상태 확인 | `GET /health` (미로그인: 상태만 · 로그인: 색인 통계 포함) |
| 지연·오류·사용량 | 관리자로 로그인 후 `GET /api/admin/stats` — 엔드포인트별 p50/p95, 오늘 사용자별 LLM 호출 수 |
| 백업 | `python3 manage.py backup` (cron 예: `0 4 * * * cd /opt/meeting-copilot && MC_DATA_DIR=/var/lib/meeting-copilot python3 manage.py backup`) |
| 로그 | journald (`journalctl -u meeting-copilot -f`) — 오류 응답만 한 줄씩 |
| 정상 종료 | `systemctl stop` → SIGTERM → 진행 중 응답을 마치고 종료 |

## 왜 프레임워크로 이관하지 않았나

FastAPI/uvicorn 이관도 검토했지만 **이번에는 표준 라이브러리 강화를 택했다.** 근거:

1. **병목이 서버가 아니다** — 실측 용량 모델에서 한계는 LLM 쿼터(Tier 1: 동시
   13미팅)와 STT CPU다. 서버 스레드 모델은 실측상 동시 수백 연결을 견딘다.
2. **의존성 0은 이 프로젝트의 설계 원칙**이고, 배포 대상(개인 VPS·맥북)에서
   `pip install` 없는 운영이 실제 가치다.
3. 웹 노출면의 방어(TLS·타임아웃·H2)는 **Caddy가 앱보다 잘한다** — 앱을
   비동기로 다시 쓰는 것보다 검증된 프록시를 앞에 두는 쪽이 리스크가 작다.

동시 미팅이 수십을 넘는 시점(= Anthropic Tier 2 이상 + STT GPU가 필요한 시점)이
오면 그때 asyncio 이관을 다시 평가한다 — 그 전까지는 복잡도만 산다.

## 한계 (알고 배포할 것)

- Web Speech 실시간 인식은 Chrome/Edge 전용, 오디오가 구글 서버를 경유한다.
  기밀 미팅은 탭 캡처 + 로컬 Whisper(`pip3 install faster-whisper`) 경로를 쓸 것
- iOS Safari는 실시간 인식·탭 캡처 모두 불가 — 폰은 Android Chrome 권장
- 미팅 상대방 목소리의 녹음·전사는 회사 정책·상대 동의 확인이 사용자의 몫이다
