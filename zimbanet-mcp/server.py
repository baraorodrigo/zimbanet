import os
import sys

# Garante que os imports locais (client, tools) funcionem independente do cwd
# de quem lançou o processo (Hermes, uv, etc.).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mcp.server.fastmcp import FastMCP

from client import ZimbanetClient
from tools import analytics as analytics_tools
from tools import articles as articles_tools
from tools import community as community_tools
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
def create_article(
    title: str,
    body: str,
    kicker: str = "",
    subtitle: str = "",
    lede: str = "",
    byline: str = "ZIMBANET",
    tags: list = None,
    cities: list = None,
    slug: str = "",
    editorial: str = "",
    reading_minutes: int = 5,
) -> dict:
    """Cria um novo rascunho de matéria no ZIMBANET. SEMPRE cria como draft — nunca publica.
    Use quando o usuário pedir 'criar matéria', 'postar artigo', 'publicar no site'."""
    payload = {
        "title": title,
        "body": body,
        "kicker": kicker,
        "subtitle": subtitle,
        "lede": lede,
        "byline": byline,
        "tags": tags or [],
        "cities": cities or [],
        "slug": slug,
        "editorial": editorial,
        "reading_minutes": reading_minutes,
        "status": "draft",
    }
    return _client.post("/api/ai/articles", payload)


@mcp.tool()
def submit_review(article_id: str) -> dict:
    """Manda o rascunho pra revisão humana (fila do editor)."""
    return articles_tools.submit_review(_client, article_id)


@mcp.tool()
def publicar(article_id: str) -> dict:
    """PUBLICA a matéria no portal (fase de teste — autonomia total). Só publica
    rascunho/revisão/agendada. Respeita o interruptor mestre (se o humano
    desligar o autopublish, retorna erro). Publique só matéria boa e revisada —
    sai no ar pra cidade ver. Para corrigir depois, use 'despublicar'."""
    return articles_tools.publish_article(_client, article_id)


@mcp.tool()
def despublicar(article_id: str) -> dict:
    """Tira a matéria do ar (volta a rascunho) pra você CORRIGIR e republicar."""
    return articles_tools.unpublish_article(_client, article_id)


@mcp.tool()
def definir_imagem(article_id: str, image_url: str, alt: str = "") -> dict:
    """Define a foto de capa (hero) de um rascunho a partir de uma URL de imagem.
    O ZIMBANET baixa a imagem e guarda no próprio Storage (não fica dependendo do
    link externo, que pode quebrar). Só funciona em rascunho/revisão. 'alt' =
    descrição acessível da foto (recomendado). Use imagens com direito de uso."""
    return articles_tools.set_hero(_client, article_id, image_url, alt or None)


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
def definir_capa(article_id: str, ligar: bool = True) -> dict:
    """Fixa (ligar=True) ou tira (ligar=False) a matéria como CAPA principal da home.
    Só 1 capa por vez — fixar uma desmarca a anterior. Só funciona em matéria
    publicada. A home já é automática (a mais recente vira capa sozinha) — use isso
    só pra FIXAR uma matéria importante no topo."""
    return articles_tools.home_flags(_client, article_id, cover=ligar)


@mcp.tool()
def definir_destaque(article_id: str, ligar: bool = True) -> dict:
    """Põe (ligar=True) ou tira (False) a matéria dos DESTAQUES da home. Pode ter
    vários, mas a home sempre reserva 2 vagas pras mais recentes. Só publicada."""
    return articles_tools.home_flags(_client, article_id, highlight=ligar)


@mcp.tool()
def marcar_urgente(article_id: str, ligar: bool = True) -> dict:
    """Liga (ligar=True) ou desliga (False) a barra vermelha de URGENTE/BREAKING no
    topo do site com essa matéria. Use SÓ pra fato realmente urgente e atual. Só
    matéria publicada."""
    return articles_tools.home_flags(_client, article_id, breaking=ligar)


@mcp.tool()
def arquivar(article_id: str) -> dict:
    """ARQUIVA a matéria — tira do ar e do acervo ativo (fica guardada, recuperável).
    Use pra aposentar notícia VELHA ou RUIM. Diferente de despublicar (que volta a
    rascunho pra você corrigir e republicar), arquivar é pra tirar de vez. Também
    remove de capa/destaque/urgente."""
    return articles_tools.archive_article(_client, article_id)


@mcp.tool()
def pendencias() -> dict:
    """O que precisa da sua atenção AGORA: nº de rascunhos, matérias em revisão,
    posts do mural e classificados do bazar pra moderar, e pautas frescas esperando
    virar matéria. Use no começo do turno pra saber o que fazer."""
    return articles_tools.pendencias(_client)


@mcp.tool()
def buscar_materias(q: str, status: str = "published", limit: int = 30) -> dict:
    """Busca matérias por palavra no título/lede. status ∈ 'published' | 'draft' |
    'review' | 'archived'. Use pra ACHAR uma matéria específica — ex.: pra arquivar
    uma velha, destacar uma boa, ou corrigir."""
    return articles_tools.search_articles(_client, q, status, limit)


@mcp.tool()
def list_pauta(decision: str = "investigate", limit: int = 20) -> dict:
    """Lista as PAUTAS pra você trabalhar e gerar mais conteúdo. decision ∈
    'investigate' (pra investigar — o default), 'approve' (já aprovadas) ou
    'reject'. Cada item traz scored_item_id, título, url e imagem da fonte,
    relevância, editoria, o motivo da curadoria e 'ja_tem_materia' (pula esses).
    Fluxo pra render conteúdo: list_pauta('investigate') → escolha as boas →
    trabalhar_pauta(scored_item_id) → get_article → publicar."""
    return radar_tools.list_pauta(_client, decision, limit)


@mcp.tool()
def trabalhar_pauta(scored_item_id: str) -> dict:
    """Transforma uma PAUTA em rascunho de matéria: roda Investigador + Redator
    no radar e cria a matéria (status draft, com fonte rastreável e — quando dá —
    já com a foto da fonte). Aceita pauta aprovada ou em investigação (rejeitada
    não). Retorna article_id + slug + foto_definida. Depois revise com get_article,
    ajuste se precisar (update_article), garanta a foto (definir_imagem) e
    publicar. É o caminho certo pra gerar conteúdo — NUNCA escreva de cabeça."""
    return radar_tools.trabalhar_pauta(_client, scored_item_id)


@mcp.tool()
def daily_report() -> dict:
    """Resumo diário: publicadas hoje, rascunhos na fila, distribuição da pauta, coletadas hoje."""
    return analytics_tools.daily_report(_client)


@mcp.tool()
def list_mural(moderation_status: str = "pending", limit: int = 50) -> dict:
    """Lista posts do mural #ZimbaMilGrau pra moderação. moderation_status ∈
    'pending' (a moderar) | 'approved' | 'rejected'."""
    return community_tools.list_mural(_client, moderation_status, limit)


@mcp.tool()
def moderate_mural(post_id: str, decision: str) -> dict:
    """Modera um post do mural. decision='approve' publica; 'reject' remove.
    Regra: NUNCA aprove denúncia grave, exposição de menor ou acusação sem revisão humana."""
    return community_tools.moderate_mural(_client, post_id, decision)


@mcp.tool()
def list_bazar(status: str = "pending", limit: int = 50) -> dict:
    """Lista classificados #BazarDaZimba pra moderação. status ∈ 'pending' | 'active' | 'removed'."""
    return community_tools.list_bazar(_client, status, limit)


@mcp.tool()
def moderate_bazar(item_id: str, decision: str) -> dict:
    """Modera um classificado. decision='approve' ativa; 'reject' remove (spam/golpe)."""
    return community_tools.moderate_bazar(_client, item_id, decision)


if __name__ == "__main__":
    mcp.run()  # stdio
