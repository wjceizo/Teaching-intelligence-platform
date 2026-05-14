from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()


class Settings(BaseModel):
    database_url: str
    redis_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    milvus_host: str = "localhost"
    milvus_port: int = 19530
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "math-platform"
    sandbox_python_image: str = "python:3.12-slim"
    sandbox_javascript_image: str = "node:22-slim"
    sandbox_cpp_image: str = "gcc:14"
    debug: bool = True
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    app_version: str = "0.1.0"

    @classmethod
    def from_env(cls) -> "Settings":
        raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
        allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

        return cls(
            database_url=os.getenv(
                "DATABASE_URL", "postgresql+asyncpg://app:secret@localhost:5432/mathplatform"
            ),
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            jwt_secret=os.getenv("JWT_SECRET", "replace-with-a-random-32-char-secret"),
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")),
            refresh_token_expire_days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            milvus_host=os.getenv("MILVUS_HOST", "localhost"),
            milvus_port=int(os.getenv("MILVUS_PORT", "19530")),
            minio_endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
            minio_access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
            minio_secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
            minio_bucket=os.getenv("MINIO_BUCKET", "math-platform"),
            sandbox_python_image=os.getenv("SANDBOX_PYTHON_IMAGE", "python:3.12-slim"),
            sandbox_javascript_image=os.getenv("SANDBOX_JAVASCRIPT_IMAGE", "node:22-slim"),
            sandbox_cpp_image=os.getenv("SANDBOX_CPP_IMAGE", "gcc:14"),
            debug=os.getenv("DEBUG", "true").lower() in {"1", "true", "yes", "on"},
            allowed_origins=allowed_origins or ["http://localhost:3000"],
            app_version=os.getenv("APP_VERSION", "0.1.0"),
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()
