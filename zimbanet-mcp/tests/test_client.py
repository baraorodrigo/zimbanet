import httpx
import pytest
import respx

from client import ZimbanetClient


@respx.mock
def test_get_passes_bearer_and_returns_json():
    route = respx.get("https://x.test/api/ai/ping").mock(
        return_value=httpx.Response(200, json={"ok": True, "data": {"pong": True}})
    )
    c = ZimbanetClient(base_url="https://x.test", token="zmb_abc")
    out = c.get("/api/ai/ping")
    assert out["data"]["pong"] is True
    assert route.calls.last.request.headers["authorization"] == "Bearer zmb_abc"


@respx.mock
def test_raises_on_4xx_with_body():
    respx.get("https://x.test/api/ai/ping").mock(
        return_value=httpx.Response(401, json={"ok": False, "error": "token invalido"})
    )
    c = ZimbanetClient(base_url="https://x.test", token="ruim")
    with pytest.raises(RuntimeError, match="token invalido"):
        c.get("/api/ai/ping")
