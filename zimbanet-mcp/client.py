import httpx


class ZimbanetClient:
    """Cliente HTTP fino pro gateway /api/ai do Zimbanet. Manda Bearer token."""

    def __init__(self, base_url: str, token: str, timeout: float = 180.0):
        self._base = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}
        self._timeout = timeout

    def _handle(self, resp: httpx.Response) -> dict:
        data = resp.json() if resp.content else {}
        if resp.status_code >= 400 or (isinstance(data, dict) and data.get("ok") is False):
            msg = (data.get("error") if isinstance(data, dict) else None) or resp.text[:200]
            raise RuntimeError(f"zimbanet {resp.status_code}: {msg}")
        return data

    def get(self, path: str, params: dict | None = None) -> dict:
        with httpx.Client(timeout=self._timeout) as c:
            return self._handle(c.get(self._base + path, headers=self._headers, params=params))

    def post(self, path: str, body: dict | None = None) -> dict:
        with httpx.Client(timeout=self._timeout) as c:
            return self._handle(c.post(self._base + path, headers=self._headers, json=body or {}))
