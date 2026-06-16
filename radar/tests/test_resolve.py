"""Testa o resolvedor de slot — lê app_settings, faz fallback pra Anthropic."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.llm.resolve import resolve_slot


def _fake_sb(rows: list[dict]) -> MagicMock:
    sb = MagicMock()
    exec_res = MagicMock()
    exec_res.data = rows
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value = exec_res
    return sb


def test_resolve_openrouter_from_db() -> None:
    rows = [
        {"key": "slot:text_fast:model", "value": "openrouter:deepseek/deepseek-v4-flash"},
        {"key": "slot:text_fast:key", "value": "sk-or-abc123"},
    ]
    with patch("app.llm.resolve.supabase_client", return_value=_fake_sb(rows)):
        r = resolve_slot("text_fast")
    assert r.provider == "openrouter"
    assert r.model_id == "deepseek/deepseek-v4-flash"
    assert r.api_key == "sk-or-abc123"


def test_resolve_anthropic_prefix_from_db() -> None:
    rows = [
        {"key": "slot:text_main:model", "value": "anthropic:claude-sonnet-4-6"},
        {"key": "slot:text_main:key", "value": "sk-ant-xyz0000000"},
    ]
    with patch("app.llm.resolve.supabase_client", return_value=_fake_sb(rows)):
        r = resolve_slot("text_main")
    assert r.provider == "anthropic"
    assert r.model_id == "claude-sonnet-4-6"
    assert r.api_key == "sk-ant-xyz0000000"


def test_resolve_no_prefix_assumes_openrouter() -> None:
    rows = [
        {"key": "slot:text_fast:model", "value": "qwen/qwen3.7-max"},
        {"key": "slot:text_fast:key", "value": "sk-or-qqq"},
    ]
    with patch("app.llm.resolve.supabase_client", return_value=_fake_sb(rows)):
        r = resolve_slot("text_fast")
    assert r.provider == "openrouter"
    assert r.model_id == "qwen/qwen3.7-max"


def test_resolve_fallback_when_db_unavailable() -> None:
    # supabase_client levanta → cai pro fallback Anthropic + env.
    with patch("app.llm.resolve.supabase_client", side_effect=RuntimeError("no db")):
        r = resolve_slot("text_fast")
    assert r.provider == "anthropic"
    assert r.model_id  # modelo default do config
    assert r.api_key  # chave do .env (dummy nos testes)


def test_resolve_key_from_env_when_db_omits_key(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-from-env")
    rows = [
        {"key": "slot:text_main:model", "value": "openrouter:deepseek/deepseek-v4-pro"},
        # sem a chave no banco
    ]
    with patch("app.llm.resolve.supabase_client", return_value=_fake_sb(rows)):
        r = resolve_slot("text_main")
    assert r.provider == "openrouter"
    assert r.api_key == "sk-or-from-env"
