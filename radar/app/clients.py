from functools import lru_cache

from anthropic import Anthropic
from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def anthropic_client() -> Anthropic:
    settings = get_settings()
    return Anthropic(api_key=settings.anthropic_api_key)


@lru_cache
def supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY ausente — preencha .env antes de usar Supabase."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
