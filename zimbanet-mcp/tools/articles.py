from client import ZimbanetClient


def list_drafts(client: ZimbanetClient, status: str = "draft", limit: int = 50) -> dict:
    return client.get("/api/ai/articles", params={"status": status, "limit": limit})


def get_article(client: ZimbanetClient, article_id: str) -> dict:
    return client.get(f"/api/ai/articles/{article_id}")


def update_article(client: ZimbanetClient, article_id: str, fields: dict) -> dict:
    return client.post(f"/api/ai/articles/{article_id}/update", fields)


def update_seo(client: ZimbanetClient, article_id: str, slug: str | None = None, tags: list | None = None) -> dict:
    body: dict = {}
    if slug is not None:
        body["slug"] = slug
    if tags is not None:
        body["tags"] = tags
    return client.post(f"/api/ai/articles/{article_id}/seo", body)


def submit_review(client: ZimbanetClient, article_id: str) -> dict:
    return client.post(f"/api/ai/articles/{article_id}/review")


def set_hero(
    client: ZimbanetClient, article_id: str, image_url: str, alt: str | None = None
) -> dict:
    return client.post(
        f"/api/ai/articles/{article_id}/hero", {"image_url": image_url, "alt": alt}
    )


def publish_article(client: ZimbanetClient, article_id: str) -> dict:
    return client.post(f"/api/ai/articles/{article_id}/publish")


def unpublish_article(client: ZimbanetClient, article_id: str) -> dict:
    return client.post(f"/api/ai/articles/{article_id}/unpublish")
