from client import ZimbanetClient


def list_mural(client: ZimbanetClient, moderation_status: str = "pending", limit: int = 50) -> dict:
    return client.get(
        "/api/ai/community", params={"moderation_status": moderation_status, "limit": limit}
    )


def moderate_mural(client: ZimbanetClient, post_id: str, decision: str) -> dict:
    return client.post(f"/api/ai/community/{post_id}/moderate", {"decision": decision})


def list_bazar(client: ZimbanetClient, status: str = "pending", limit: int = 50) -> dict:
    return client.get("/api/ai/bazar", params={"status": status, "limit": limit})


def moderate_bazar(client: ZimbanetClient, item_id: str, decision: str) -> dict:
    return client.post(f"/api/ai/bazar/{item_id}/moderate", {"decision": decision})
