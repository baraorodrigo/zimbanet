from client import ZimbanetClient


def ping(client: ZimbanetClient) -> dict:
    """Confere que o gateway responde e o token é válido."""
    return client.get("/api/ai/ping")
