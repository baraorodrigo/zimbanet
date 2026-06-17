import os
import sys

# Garante que os imports locais (client, tools) funcionem independente do cwd
# de quem lançou o processo (Hermes, uv, etc.).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mcp.server.fastmcp import FastMCP

from client import ZimbanetClient
from tools import analytics as analytics_tools
from tools import articles as articles_tools
from tools import radar as radar_tools
from tools.ping import ping as ping_tool

BASE = os.environ.get("ZIMBANET_API_URL", "https://teste.zimbanet.com")
TOKEN = os.environ.get("AGENT_TOKEN", "")

mcp = FastMCP("zimbanet")
_client = ZimbanetClient(base_url=BASE, token=TOKEN)


@mcp.tool()
def zimbanet_ping() -> dict:
    """Testa a conexão com o Zimbanet (gateway /api/ai) e valida o token do agente."""
    return ping_tool(_client)


@mcp.tool()
def list_drafts(status: str = "draft", limit: int = 50) -> dict:
    """Lista matérias por status (default 'draft' = rascunhos). Use pra descobrir o que há pra editar."""
    return articles_tools.list_drafts(_client, status, limit)


@mcp.tool()
def get_article(article_id: str) -> dict:
    """Retorna a matéria completa (título, lede, corpo, tags, status...)."""
    return articles_tools.get_article(_client, article_id)


@mcp.tool()
def update_article(article_id: str, fields: dict) -> dict:
    """Edita o CONTEÚDO de um rascunho. fields pode ter: kicker, title, subtitle, lede, body,
    byline, tags, cities, reading_minutes. Só funciona em rascunho/revisão — nunca em publicada."""
    return articles_tools.update_article(_client, article_id, fields)


@mcp.tool()
def update_seo(article_id: str, slug: str | None = None, tags: list | None = None) -> dict:
    """Edita slug e/ou tags (SEO) de um rascunho."""
    return articles_tools.update_seo(_client, article_id, slug, tags)


@mcp.tool()
def submit_review(article_id: str) -> dict:
    """Manda o rascunho pra REVISÃO HUMANA. É o máximo que o agente faz — publicar é só o humano."""
    return articles_tools.submit_review(_client, article_id)


@mcp.tool()
def run_radar(agent: str, limit: int = 5) -> dict:
    """Dispara um agente do radar. agent ∈ 'curador' | 'investigador' | 'redator' | 'pipeline'."""
    return radar_tools.run_radar(_client, agent, limit)


@mcp.tool()
def submit_url_to_radar(url: str, note: str = "") -> dict:
    """Envia uma URL de reportagem (que você achou na web) pro radar do ZIMBANET.

    O motor raspa título/corpo/imagem, salva como pauta bruta (fonte
    'hermes_manual_web'), roda o Curador e o item aparece em /admin/pauta pro
    humano decidir (redigir/investigar/rejeitar). NUNCA publica nada sozinho.
    Use só com links de reportagens reais e relevantes pra Imbituba e região;
    o conteúdo entra como referência/lead — a matéria é reescrita do zero depois.
    'note' opcional: por que essa pauta importa pro morador local."""
    return radar_tools.submit_url_to_radar(_client, url, note or None)


@mcp.tool()
def daily_report() -> dict:
    """Resumo diário: publicadas hoje, rascunhos na fila, distribuição da pauta, coletadas hoje."""
    return analytics_tools.daily_report(_client)


if __name__ == "__main__":
    mcp.run()  # stdio
