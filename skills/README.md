# skills/

이 저장소에서 관리하는 Claude 스킬 팩. 구조는 `anthropic-skills` 플러그인 스킬과 동일하다.

```
<skill-name>/
├── SKILL.md        # 필수 — YAML frontmatter(name, description) + 본문
├── scripts/        # 실행 코드 (컨텍스트에 로드되지 않고 실행만 된다)
└── references/     # 필요할 때만 읽는 문서
```

## 설치

**Claude Code / Cowork (로컬)**

```bash
cp -r skills/video-analysis ~/.claude/skills/
```

`~/.claude/skills/synced/` 아래는 claude.ai가 덮어쓰므로 넣지 않는다.

**claude.ai 스킬로 올리기**

디렉터리를 zip으로 묶어 Settings → Capabilities → Skills에서 업로드한다.

```bash
cd skills && zip -r video-analysis.zip video-analysis
```

## 목록

| 스킬 | 하는 일 | 외부 의존성 |
|---|---|---|
| `video-analysis` | 영상을 키프레임 컨택트 시트 + 타임코드 전사문으로 분해해 판독 | ffmpeg (필수), STT API 키 또는 로컬 whisper (선택) |
