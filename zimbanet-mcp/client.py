import time

import httpx

_TRANSIENT_STATUS = {502, 503, 504}
_MAX_RETRIES = 2  # 3 tentativas no total (só pra ConnectError)
_BACKOFF = (0.4, 1.2)


class ZimbanetClient:
    """Cliente HTTP fino pro gateway /api/ai do Zimbanet. Manda Bearer token.

    Em falha TRANSITÓRIA devolve mensagem clara de "momentâneo" — pra o agente
    não ler como "token/MCP/portal caiu" e alarmar o dono à toa. Retenta APENAS
    ConnectError (a conexão nem abriu → a request não foi enviada → seguro). Não
    retenta timeout/leitura-perdida/5xx, porque a operação pode JÁ ter sido
    executada (publicar/distribuir) e repetir duplicaria.
    """

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

    def _request(self, method: str, path: str, **kwargs) -> dict:
        for attempt in range(_MAX_RETRIES + 1):
            try:
                with httpx.Client(timeout=self._timeout) as c:
                    resp = c.request(method, self._base + path, headers=self._headers, **kwargs)
            except httpx.ConnectError as exc:
                # Conexão nem abriu = request NÃO enviada → seguro retentar.
                if attempt < _MAX_RETRIES:
                    time.sleep(_BACKOFF[attempt])
                    continue
                raise RuntimeError(
                    "zimbanet inacessível (conexão recusada) — é momentâneo, "
                    "tente de novo (não é o token nem o site)."
                ) from exc
            except httpx.TimeoutException as exc:
                raise RuntimeError(
                    "zimbanet demorou demais (timeout) — o motor pode estar ocupado; "
                    "é momentâneo, tente de novo (não é o token nem o site)."
                ) from exc
            except (httpx.ReadError, httpx.RemoteProtocolError) as exc:
                # Resposta perdida DEPOIS de enviar: a operação pode ter rodado
                # (publicar/distribuir) — NÃO retenta pra não duplicar.
                raise RuntimeError(
                    f"zimbanet: resposta perdida ({type(exc).__name__}) — pode ter "
                    "dado certo; confira antes de repetir."
                ) from exc
            # 5xx: o servidor já recebeu (efeito pode ter ocorrido) → NÃO retenta.
            if resp.status_code in _TRANSIENT_STATUS:
                raise RuntimeError(
                    f"zimbanet temporariamente indisponível ({resp.status_code}) — é "
                    "momentâneo, tente de novo em instantes (não é o token nem o site)."
                )
            return self._handle(resp)
        raise RuntimeError("zimbanet: falha inesperada no request")  # inalcançável

    def get(self, path: str, params: dict | None = None) -> dict:
        return self._request("GET", path, params=params)

    def post(self, path: str, body: dict | None = None) -> dict:
        return self._request("POST", path, json=body or {})
