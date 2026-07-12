# 영어 면접 코파일럿 — 클라우드 배포용 (Render/Fly/Railway 등 컨테이너 플랫폼)
# 의존성 0 (stdlib) 이라 pip install이 없다. 배포 플랫폼에서 환경변수만 설정:
#   GROQ_API_KEY  (필수) — LLM + Whisper STT
#   ACCESS_CODE   (필수) — 접속 코드 게이트 (없으면 아무나 내 Groq 키를 쓰게 됨)
FROM python:3.12-slim

WORKDIR /app
COPY . .

# 컨테이너 안에서는 0.0.0.0 바인딩이 정상 (외부 노출은 플랫폼 프록시 + ACCESS_CODE가 담당)
ENV HOST=0.0.0.0 \
    NO_BROWSER=1 \
    PYTHONUNBUFFERED=1

EXPOSE 3778
CMD ["python3", "server.py"]
