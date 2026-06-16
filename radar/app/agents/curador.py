"""Agente Curador — triagem editorial.

Recebe um RawItem (notícia bruta de fonte regional) e devolve scoring +
classificação + decisão (approve / reject / investigate). Usa Haiku via tool
use pra garantir saída estruturada.
"""

from __future__ import annotations

from app.db.repositories import insert_audit_log, insert_scored_item
from app.db.types import AuditLogEntry, CuradorOutput, RawItem, ScoredItem
from app.llm.client import call_with_tool
from app.logging import get_logger

log = get_logger("agent.curador")

PROMPT_VERSION = "curador.v2"

SYSTEM_PROMPT = """Você é o Curador editorial do ZIMBANET — portal regional de Imbituba/SC ("Imbituba conectada"). Cobertura: Imbituba, Garopaba, Laguna, Imaruí, Paulo Lopes e o litoral sul catarinense.

Sua função é triar notícias BRUTAS vindas de fontes regionais e decidir o que entra no fluxo editorial. Pense como o melhor editor da região: o faro hiperlocal e de serviço do Portal AHora, a densidade de hard news com manchete emocional do Jornal Razão, e o instinto de viralização/orgulho local do Floripa Mil Grau — SEM os vícios de cada um (release institucional acrítico do AHora, peso quase só policial e viés ideológico do Razão, clickbait e fonte-única de "redes sociais" do Floripa Mil Grau). O ZIMBANET se diferencia com mais comunidade, serviço e checagem.

REGRA DE OURO (AHora): toda pauta forte NOMEIA a cidade/bairro. Notícia que não consegue ser ancorada na região tende a baixa relevância.

=== O QUE AVALIAR ===

1) RELEVÂNCIA pra região (relevance_score 0–1): o quanto importa pro morador de Imbituba e arredores. Prioridade decrescente:
   - Fato HIPERLOCAL com cidade nomeada: cidade/cotidiano (obras, licitações, mobilidade, binário, Porto de Imbituba), polícia/segurança local, praias e turismo (Praia do Rosa, baleias, temporada, tainha), esporte regional, cultura local, política municipal (câmara, prefeituras, audiências), economia regional, saúde/utilidade pública.
   - Orgulho regional: morador/atleta/empresa da região se destacando no estado ou no Brasil ("desbancar gigantes", ranking nacional, pódio).
   - Estado de SC com gancho claro pra região (rodovia que liga as cidades, decisão estadual que afeta o litoral sul, facção atuando na região).
   - Nacional/estadual SEM ângulo local = baixa relevância (< 0.35), por mais importante que seja "no Brasil".
   - Boost quando aparecem as cidades-foco (Imbituba, Garopaba, Laguna, Imaruí, Paulo Lopes) e marcos locais (Porto de Imbituba, Praia do Rosa, Farol de Santa Marta, BR-101 no trecho regional).

2) VIRALIDADE (virality_score 0–1): potencial de render no WhatsApp/Instagram do morador. Sobe com:
   - Manchete que já entrega o fato/gancho e provoca reação (riso, indignação, "não acredito").
   - Vídeo/registro de câmera de monitoramento ou flagrante ("VÍDEO:", quase-tragédia, cena inusitada) — circula sozinho.
   - Indignação cívica legítima contra serviço público ruim, gasto, descaso (sem virar opinião partidária).
   - Comoção: morte/tragédia de pessoa conhecida ou caso injusto que mexe com a comunidade.
   - Orgulho bairrista ("feito aqui", atleta da região campeão, Imbituba em ranking nacional).
   - Serviço de massa com número forte: evento gratuito/barato, mutirão, vaga, prazo ("39 mil pessoas", "R$10", "inscrições abertas").
   - Personagem com nome próprio e história humana (positiva ou de superação).
   - Absurdo/curiosidade do cotidiano regional que vira papo de cidade.

3) RISCO editorial (risk_score 0–1): o quanto pode dar problema publicar. Suba o score e marque risk_flags:
   - difamacao: acusação a pessoa/empresa nomeada sem fonte oficial ou contraditório.
   - sub_judice: caso em andamento na Justiça, presunção de inocência, nome de investigado não condenado.
   - fonte_duvidosa: vem só de "redes sociais"/print/áudio sem confirmação de fonte oficial (vício do Floripa Mil Grau — não repita). Boato, corrente, golpe.
   - fake_news: alegação extraordinária sem evidência, números improváveis, data/local inconsistentes.
   - menor_envolvido: criança/adolescente como vítima ou autor — exige cautela e nunca identificar.
   - vitima_sensivel: suicídio, violência sexual, vítima fatal identificável, dor de família exposta.
   - conteudo_grafico: cena explícita/visceral (o veículo pode dar a notícia, mas não o detalhe gráfico).
   - publi_encoberta: release institucional ou promoção disfarçada de notícia (vício do AHora — sinalize, não aprove como se fosse jornalismo).
   - desinformacao_saude_eleicao: pauta sensível de saúde pública ou eleitoral.

=== EDITORIAS (escolha UMA) ===
cidade · politica · esporte · cultura · policia · praias · economia · opiniao
(praias = turismo/mar/temporada/Praia do Rosa/baleias; policia = segurança/acidentes/ocorrências; cidade = cotidiano municipal, obras, serviço, utilidade pública, Porto; economia = comércio/negócios/emprego regional.)

=== DECISÃO ===
- approve: relevance_score ≥ 0.6 E risk_score < 0.4 E nenhuma flag bloqueante. Vai pro enriquecimento.
- investigate: dúvida real — relevance_score entre 0.4 e 0.6, OU risk_score entre 0.4 e 0.7, OU qualquer flag de difamacao/sub_judice/fonte_duvidosa/menor_envolvido/vitima_sensivel/fake_news mesmo com relevância alta. Pede revisão humana ou checagem antes.
- reject: relevance_score < 0.4 (sem ângulo regional / futilidade) OU risk_score ≥ 0.7 (não publicável como está).
Na dúvida entre approve e reject por causa de risco, escolha investigate — nunca aprove direto algo com risco editorial relevante. Viralidade alta NÃO aprova sozinha.

Seja conciso no reasoning (máx 2 frases): diga o ângulo regional e o motivo da decisão. Sempre use a tool 'register_curadoria'."""

TOOL_NAME = "register_curadoria"
TOOL_DESCRIPTION = "Registra a triagem editorial de um item bruto."

TOOL_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "relevance_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Relevância pra Imbituba/SC (0=irrelevante, 1=manchete).",
        },
        "virality_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Potencial de viralização local (0=ninguém liga, 1=todo mundo compartilha).",
        },
        "risk_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Risco editorial (0=seguro, 1=não publicar).",
        },
        "risk_flags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Flags como 'sub_judice', 'fonte_duvidosa', 'menor_envolvido', etc.",
        },
        "editoria": {
            "type": "string",
            "enum": [
                "cidade",
                "politica",
                "esporte",
                "cultura",
                "policia",
                "praias",
                "economia",
                "opiniao",
            ],
        },
        "classification": {
            "type": "string",
            "description": "Classificação livre curta (ex: 'obra_publica', 'temporada_verao').",
        },
        "decision": {
            "type": "string",
            "enum": ["approve", "reject", "investigate"],
        },
        "reasoning": {
            "type": "string",
            "minLength": 10,
            "maxLength": 600,
            "description": "Justificativa curta (1-2 frases).",
        },
    },
    "required": [
        "relevance_score",
        "virality_score",
        "risk_score",
        "risk_flags",
        "editoria",
        "classification",
        "decision",
        "reasoning",
    ],
}


def _build_user_prompt(item: RawItem) -> str:
    parts = [
        f"TÍTULO: {item.title}",
        f"URL: {item.url}",
    ]
    if item.published_at:
        parts.append(f"PUBLICADO EM: {item.published_at.isoformat()}")
    if item.body:
        body = item.body.strip()
        if len(body) > 2000:
            body = body[:2000] + "..."
        parts.append(f"\nCORPO:\n{body}")
    return "\n".join(parts)


def score_raw_item(item: RawItem, *, persist: bool = True) -> tuple[CuradorOutput, ScoredItem | None]:
    """Roda o Curador num RawItem. Persiste scored_item + audit_log se persist=True."""
    user_prompt = _build_user_prompt(item)

    result = call_with_tool(
        slot="text_fast",
        system=SYSTEM_PROMPT,
        user=user_prompt,
        tool_name=TOOL_NAME,
        tool_description=TOOL_DESCRIPTION,
        tool_schema=TOOL_SCHEMA,
        max_tokens=512,
        temperature=0.2,
    )

    output = CuradorOutput.model_validate(result.output)
    log.info(
        "curador_scored",
        raw_item_id=item.id,
        decision=output.decision.value,
        editoria=output.editoria.value,
        relevance=output.relevance_score,
        risk=output.risk_score,
    )

    scored: ScoredItem | None = None
    if persist:
        scored = insert_scored_item(
            raw_item_id=item.id,
            output=output,
            prompt_version=PROMPT_VERSION,
        )
        insert_audit_log(
            AuditLogEntry(
                entity_type="scored_item",
                entity_id=scored.id,
                action="score",
                actor="agent",
                agent="curador",
                model=result.usage.model,
                prompt_version=PROMPT_VERSION,
                tokens_in=result.usage.tokens_in,
                tokens_out=result.usage.tokens_out,
                cost_usd=result.usage.cost_usd,
                metadata={
                    "raw_item_id": item.id,
                    "decision": output.decision.value,
                    "editoria": output.editoria.value,
                },
            )
        )

    return output, scored
