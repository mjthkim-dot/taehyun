-- ═══════════════════════════════════════════════════════════════
-- TBLT 글로벌 어학 LMS — PostgreSQL 스키마 (CEFR/GSE 이원화 엔진)
--
-- 설계 원칙:
--   · 단순 선형 Grade 탈피 → CEFR(A1~C2) + GSE(10~90) 이원 척도
--   · 4대 영역(독해/청해/구어 상호작용/문어 생산) 숙련도 네이티브
--   · 정형(RDBMS) / 비정형·벡터(Qdrant·Mongo) / 미디어(S3) 분할 저장
--     → 본 파일은 정형 데이터(RDBMS)만 담당. 벡터/미디어는 ref ID로 연결.
--
-- 비파괴적: 모두 IF NOT EXISTS. 기존 데이터 보존. Alembic으로 버전 관리.
-- ═══════════════════════════════════════════════════════════════

-- ── CEFR ↔ GSE 매핑 (참조 테이블) ──────────────────────────────
CREATE TABLE IF NOT EXISTS cefr_gse_map (
    cefr_level  VARCHAR(2) PRIMARY KEY,   -- A1 A2 B1 B2 C1 C2
    gse_min     INT NOT NULL,
    gse_max     INT NOT NULL,
    label_ko    TEXT
);

INSERT INTO cefr_gse_map (cefr_level, gse_min, gse_max, label_ko) VALUES
    ('A1', 10, 22, '입문'),
    ('A2', 22, 36, '초급'),
    ('B1', 36, 52, '중급'),
    ('B2', 52, 64, '중상급'),
    ('C1', 64, 76, '고급'),
    ('C2', 76, 90, '원어민 수준')
ON CONFLICT (cefr_level) DO NOTHING;

-- ── 사용자 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    display_name  TEXT,
    cefr_level    VARCHAR(2) NOT NULL DEFAULT 'A2' REFERENCES cefr_gse_map(cefr_level),
    gse_score     REAL       NOT NULL DEFAULT 28.0,   -- 세밀한 위치 (A2 중간)
    -- 감쇠식 스캐폴딩: 1.0=풀 힌트/번역 → 0.0=힌트 없음. 레벨↑ 시 자동 감소.
    scaffolding   REAL       NOT NULL DEFAULT 1.0,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 4대 스킬 숙련도 (Proficiency-Native 대시보드 소스) ──────────
-- skill_type: reading | listening | speaking | writing
CREATE TABLE IF NOT EXISTS user_skill_scores (
    id            SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_type    VARCHAR(10) NOT NULL,
    gse_score     REAL NOT NULL DEFAULT 10.0,    -- 스킬별 GSE (교차 시각화 축)
    session_count INT  NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, skill_type)
);

-- ── 학습 세션 + CAF 측정값 ─────────────────────────────────────
-- CAF: Complexity(복잡도) / Accuracy(정확도) / Fluency(유창성), 각 0~10
CREATE TABLE IF NOT EXISTS user_sessions (
    id               SERIAL PRIMARY KEY,
    user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id        INT NOT NULL,
    cefr_at_session  VARCHAR(2),
    caf_complexity   REAL,
    caf_accuracy     REAL,
    caf_fluency      REAL,
    words_per_min    REAL,
    filler_ratio     REAL,                 -- um/uh/like 비율
    error_density    REAL,                 -- 오류 / 100단어
    duration_sec     INT,
    -- 비정형/미디어 연결 (분할 저장)
    transcript_doc_id TEXT,                -- MongoDB ObjectId (원문 트랜스크립트)
    audio_s3_key      TEXT,                -- AWS S3 오브젝트 키 (원본 오디오)
    embedding_id      TEXT,                -- Qdrant point id (발화 벡터)
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id, created_at DESC);

-- ── 레슨 메타 (CEFR/GSE/스킬 포커스 태깅) ──────────────────────
CREATE TABLE IF NOT EXISTS lessons (
    id          INT PRIMARY KEY,
    title       TEXT,
    cefr_level  VARCHAR(2) REFERENCES cefr_gse_map(cefr_level),
    gse_min     INT,
    gse_max     INT,
    skill_focus VARCHAR(10) DEFAULT 'speaking'
);

-- ── 드릴 아이템 (GSE 점수 + 스킬 태깅) ─────────────────────────
CREATE TABLE IF NOT EXISTS drill_items (
    id          SERIAL PRIMARY KEY,
    lesson_id   INT REFERENCES lessons(id),
    kr          TEXT,
    en          TEXT,
    cat         TEXT,
    gse_score   INT,
    skill_type  VARCHAR(10) DEFAULT 'speaking'
);

-- ── 파라프레이즈 제안 로그 (CAF 엔진 출력 추적 → 약점 분석) ─────
CREATE TABLE IF NOT EXISTS paraphrase_suggestions (
    id           SERIAL PRIMARY KEY,
    session_id   INT REFERENCES user_sessions(id) ON DELETE CASCADE,
    original     TEXT,
    upgraded     TEXT,           -- CEFR +1 레벨 세련된 표현
    target_cefr  VARCHAR(2),
    note_ko      TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── 갱신 트리거 (updated_at 자동) ──────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_touch ON users;
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
