from client import ZimbanetClient


def run_radar(client: ZimbanetClient, agent: str, limit: int = 5) -> dict:
    # agent ∈ curador | investigador | redator | pipeline
    return client.post(f"/api/ai/radar/{agent}?limit={limit}")


def submit_url_to_radar(client: ZimbanetClient, url: str, note: str | None = None) -> dict:
    return client.post("/api/ai/radar/submit-url", {"url": url, "note": note})


def list_pauta(client: ZimbanetClient, decision: str = "investigate", limit: int = 20) -> dict:
    # decision ∈ investigate | approve | reject
    return client.get(f"/api/ai/pauta?decision={decision}&limit={limit}")


def trabalhar_pauta(client: ZimbanetClient, scored_item_id: str) -> dict:
    return client.post(f"/api/ai/pauta/{scored_item_id}/draft")
