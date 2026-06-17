from client import ZimbanetClient


def daily_report(client: ZimbanetClient) -> dict:
    return client.get("/api/ai/analytics/daily")
