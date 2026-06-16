"""Resolve qual provider/modelo/chave usar pra cada slot de IA.

Lê os mesmos slots que o painel do site grava em `app_settings`
(`slot:{slot}:model` e `slot:{slot}:key`). Assim a config é única: o que o
admin escolhe em /admin/configuracoes vale pro portal E pros motores do radar.

Fallback: se o slot não está configurado (ou o banco está indisponível), usa o
modelo Anthropic default do config + ANTHROPIC_API_KEY — o comportamento antigo
continua valendo, então nada quebra se ninguém configurar nada.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from app.clients import supabase_client
from app.config import get_settings
from app.logging import get_logger

log = get_logger("llm.resolve")

# Modelo Anthropic default por slot (fallback quando nada está configurado).
_FALLBACK_MODEL_ATTR: dict[str, str] = {
    "text_fast": "model_curador",  # Haiku — barato
    "text_main": "model_redator",  # Sonnet — qualidade
}


@dataclass(slots=True)
class ResolvedModel:
    provider: str  # "anthropic" | "openrouter"
    model_id: str
    api_key: str


def _read_slot_settings(slot: str) -> dict[str, str]:
    """Lê model+key do slot em app_settings. Erro de banco → dict vazio."""
    keys = [f"slot:{slot}:model", f"slot:{slot}:key"]
    out: dict[str, str] = {}
    try:
        sb = supabase_client()
        res = sb.table("app_settings").select("key, value").in_("key", keys).execute()
        for row in res.data or []:
            if not isinstance(row, dict):
                continue
            k = row.get("key")
            v = row.get("value")
            if isinstance(k, str) and isinstance(v, str) and v.strip():
                out[k] = v.strip()
    except Exception as exc:  # banco indisponível cai pro fallback
        log.warning("app_settings_read_failed", slot=slot, error=str(exc))
    return out


def _fallback(slot: str) -> ResolvedModel:
    settings = get_settings()
    attr = _FALLBACK_MODEL_ATTR.get(slot, "model_curador")
    return ResolvedModel(
        provider="anthropic",
        model_id=getattr(settings, attr),
        api_key=settings.anthropic_api_key,
    )


def resolve_slot(slot: str) -> ResolvedModel:
    """Resolve (provider, modelo, chave) pro slot. Nunca lança por config
    ausente — cai pro fallback Anthropic. Só lança se o provider escolhido não
    tem chave nenhuma (nem painel nem env)."""
    cfg = _read_slot_settings(slot)
    model_choice = cfg.get(f"slot:{slot}:model")
    if not model_choice:
        return _fallback(slot)

    if model_choice.startswith("openrouter:"):
        provider = "openrouter"
        model_id = model_choice[len("openrouter:") :].strip()
    elif model_choice.startswith("anthropic:"):
        provider = "anthropic"
        model_id = model_choice[len("anthropic:") :].strip()
    else:
        # Sem prefixo → assume formato "vendor/modelo" do OpenRouter.
        provider = "openrouter"
        model_id = model_choice

    if not model_id:
        return _fallback(slot)

    api_key = cfg.get(f"slot:{slot}:key")
    if not api_key:
        if provider == "openrouter":
            api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
        else:
            api_key = get_settings().anthropic_api_key

    if not api_key:
        raise RuntimeError(
            f"Slot '{slot}' usa {provider}:{model_id} mas não há chave "
            f"(nem no painel nem no .env). Configure em Admin → Configurações."
        )

    return ResolvedModel(provider=provider, model_id=model_id, api_key=api_key)
