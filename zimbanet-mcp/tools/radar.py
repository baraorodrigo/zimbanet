from client import ZimbanetClient


def run_radar(client: ZimbanetClient, agent: str, limit: int = 5) -> dict:
    # agent ∈ curador | investigador | redator | pipeline
    return client.post(f"/api/ai/radar/{agent}?limit={limit}")
