from fastapi import APIRouter

from app import __version__
from app.config import get_settings

router = APIRouter()


@router.get("")
async def health() -> dict[str, str | bool]:
    settings = get_settings()
    return {
        "status": "ok",
        "version": __version__,
        "env": settings.env,
        "anthropic_configured": bool(settings.anthropic_api_key),
        "supabase_configured": bool(settings.supabase_service_role_key),
    }
