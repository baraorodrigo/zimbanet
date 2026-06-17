from client import ZimbanetClient


def run_radar(client: ZimbanetClient, agent: str, limit: int = 5) -> dict:
    # agent ∈ curador | investigador | redator | pipeline
    return client.post(f"/api/ai/radar/{agent}?limit={limit}")


def submit_url_to_radar(client: ZimbanetClient, url: str, note: str | None = None) -> dict:
    return client.post("/api/ai/radar/submit-url", {"url": url, "note": note})
