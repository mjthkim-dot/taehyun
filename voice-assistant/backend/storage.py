"""
═══════════════════════════════════════════════════════════════
 폴리글랏 스토리지 레이어 (분할 저장)
   · 정형(RDBMS)      → PostgreSQL (SQLAlchemy)
   · 비정형 트랜스크립트 → MongoDB
   · 발화 벡터         → Qdrant
   · 대용량 오디오      → AWS S3

 설계: 모든 백엔드는 환경변수로 활성화되며, 미설정 시 graceful no-op.
       로컬 단일 사용자 모드에서는 전부 비활성 → 프론트 localStorage가 진실 원천.
       클라우드 이전 시 DSN/버킷만 설정하면 동일 인터페이스로 동작.
═══════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import os
from typing import Any

# ── 환경 설정 ──────────────────────────────────────────────────
POSTGRES_DSN = os.environ.get("POSTGRES_DSN")            # postgresql://user:pw@host/db
MONGO_URI = os.environ.get("MONGO_URI")                  # mongodb://...
QDRANT_URL = os.environ.get("QDRANT_URL")                # http://localhost:6333
S3_BUCKET = os.environ.get("S3_BUCKET")                  # my-lms-audio


class PolyglotStore:
    """4개 백엔드를 하나의 파사드로. 미설정 백엔드는 조용히 건너뜀."""

    def __init__(self) -> None:
        self._pg = self._init_pg()
        self._mongo = self._init_mongo()
        self._qdrant = self._init_qdrant()
        self._s3 = self._init_s3()

    # ── 초기화 (실패해도 앱은 살아있음) ──────────────────────
    def _init_pg(self):
        if not POSTGRES_DSN:
            return None
        try:
            from sqlalchemy import create_engine
            return create_engine(POSTGRES_DSN, pool_pre_ping=True)
        except Exception as e:  # noqa: BLE001
            print(f"[storage] PostgreSQL 비활성: {e}")
            return None

    def _init_mongo(self):
        if not MONGO_URI:
            return None
        try:
            from pymongo import MongoClient
            return MongoClient(MONGO_URI).get_default_database()
        except Exception as e:  # noqa: BLE001
            print(f"[storage] MongoDB 비활성: {e}")
            return None

    def _init_qdrant(self):
        if not QDRANT_URL:
            return None
        try:
            from qdrant_client import QdrantClient
            return QdrantClient(url=QDRANT_URL)
        except Exception as e:  # noqa: BLE001
            print(f"[storage] Qdrant 비활성: {e}")
            return None

    def _init_s3(self):
        if not S3_BUCKET:
            return None
        try:
            import boto3
            return boto3.client("s3")
        except Exception as e:  # noqa: BLE001
            print(f"[storage] S3 비활성: {e}")
            return None

    @property
    def enabled(self) -> dict[str, bool]:
        return {
            "postgres": self._pg is not None,
            "mongo": self._mongo is not None,
            "qdrant": self._qdrant is not None,
            "s3": self._s3 is not None,
        }

    # ── 세션 저장 (정형 + 비정형 분리 기록) ──────────────────
    def save_session(self, user_id: int, lesson_id: int, caf: dict[str, Any],
                     transcript: str) -> dict[str, str | None]:
        refs: dict[str, str | None] = {"transcript_doc_id": None, "embedding_id": None}

        # 1) 비정형 원문 → Mongo
        if self._mongo is not None:
            doc = self._mongo["transcripts"].insert_one(
                {"user_id": user_id, "lesson_id": lesson_id, "text": transcript, "caf": caf}
            )
            refs["transcript_doc_id"] = str(doc.inserted_id)

        # 2) 정형 점수 → PostgreSQL
        if self._pg is not None:
            from sqlalchemy import text
            with self._pg.begin() as conn:
                conn.execute(
                    text("""INSERT INTO user_sessions
                        (user_id, lesson_id, caf_complexity, caf_accuracy, caf_fluency,
                         words_per_min, filler_ratio, error_density, transcript_doc_id)
                        VALUES (:u,:l,:c,:a,:f,:w,:fr,:ed,:doc)"""),
                    {"u": user_id, "l": lesson_id,
                     "c": caf.get("complexity"), "a": caf.get("accuracy"),
                     "f": caf.get("fluency"), "w": caf.get("metrics", {}).get("wpm"),
                     "fr": caf.get("metrics", {}).get("filler_ratio"),
                     "ed": caf.get("error_density"), "doc": refs["transcript_doc_id"]},
                )
        return refs

    # ── 오디오 업로드 → S3 ────────────────────────────────────
    def put_audio(self, key: str, data: bytes, content_type: str = "audio/webm") -> str | None:
        if self._s3 is None:
            return None
        self._s3.put_object(Bucket=S3_BUCKET, Key=key, Body=data, ContentType=content_type)
        return f"s3://{S3_BUCKET}/{key}"


# 싱글톤
store = PolyglotStore()
