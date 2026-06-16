import os

from mcp.server.fastmcp import FastMCP

from client import ZimbanetClient
from tools.ping import ping as ping_tool

BASE = os.environ.get("ZIMBANET_API_URL", "https://teste.zimbanet.com")
TOKEN = os.environ.get("AGENT_TOKEN", "")

mcp = FastMCP("zimbanet")
_client = ZimbanetClient(base_url=BASE, token=TOKEN)


@mcp.tool()
def zimbanet_ping() -> dict:
    """Testa a conexão com o Zimbanet (gateway /api/ai)."""
    return ping_tool(_client)


if __name__ == "__main__":
    mcp.run()  # stdio
