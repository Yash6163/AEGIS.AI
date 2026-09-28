"""Application settings (environment variables, optionally a .env file)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    log_json: bool = True

    database_url: str = f"sqlite:///{REPO_ROOT / 'aegis.db'}"
    model_dir: Path = REPO_ROOT / "models" / "aegis-wm-1.1.0"
    scenario_path: Path = REPO_ROOT / "data" / "scenarios" / "cicids2017_replay.npz"
    upload_tmp_dir: Path | None = None  # None -> system temp dir

    # Security. SECRET_KEY keys the HMAC used to pseudonymise uploaded host IPs.
    secret_key: str = Field(default="dev-insecure-secret-change-me", min_length=16)
    # If set, mutating endpoints require header X-API-Key. Required in production.
    api_key: str | None = None
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    rate_limit_per_minute: int = 240
    trusted_proxy_count: int = 0

    max_upload_mb: int = 50
    max_uncompressed_mb: int = 512
    max_upload_rows: int = 2_000_000
    max_concurrent_jobs: int = 2

    mc_samples: int = 512
    default_horizon: int = 5
    anonymize_uploads: bool = True

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str) and not v.strip().startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @model_validator(mode="after")
    def _production_guards(self) -> Settings:
        if self.app_env == "production":
            if self.secret_key.startswith("dev-insecure"):
                raise ValueError("SECRET_KEY must be set in production")
            if not self.api_key:
                raise ValueError("API_KEY must be set in production")
            if "*" in self.cors_origins:
                raise ValueError("wildcard CORS origin is not allowed in production")
        return self

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
