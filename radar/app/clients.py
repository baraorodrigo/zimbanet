from functools import lru_cache

from anthropic import Anthropic
from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def anthropic_client(api_key: str | None = None) -> Anthropic:
    # api_key explícito (resolvido por slot) tem prioridade; senão cai pro .env.
    key = api_key or get_settings().anthropic_api_key
    return Anthropic(api_key=key)


@lru_cache
def supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY ausente — preencha .env antes de usar Supabase."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
