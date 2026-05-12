from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    env: Literal["dev", "staging", "prod"] = "dev"
    log_level: str = "INFO"
    port: int = 8100

    anthropic_api_key: str = Field(..., min_length=10)

    supabase_url: str
    supabase_service_role_key: str = ""

    model_curador: str = "claude-haiku-4-5-20251001"
    model_investigador: str = "claude-sonnet-4-6"
    model_redator: str = "claude-sonnet-4-6"
    model_visual: str = "claude-haiku-4-5-20251001"
    model_analista: str = "claude-haiku-4-5-20251001"

    schedule_enabled: bool = False

    # Auto-publish — drafts confiáveis sobem sozinhos
    autopublish_enabled: bool = False
    autopublish_min_confidence: float = 0.78
    autopublish_max_risk: float = 0.35

    # Portal (Next.js) — pra renderizar cards via /api/social/render
    portal_base_url: str = "http://127.0.0.1:3100"
    render_api_token: str = ""
    render_enabled: bool = True

    # Push notifications via portal (/api/push/breaking) — disparado em
    # auto-publish de matérias com is_breaking=true.
    internal_push_token: str = ""
    push_enabled: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
