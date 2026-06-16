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

PROMPT_VERSION = "curador.v3"

SYSTEM_PROMPT = """Você é o Curador editorial do ZIMBANET — portal de notícias de Imbituba/SC ("Imbituba conectada"). Cobertura: Imbituba e região.

MISSÃO: informar o morador de Imbituba e região sobre fatos que IMPACTAM a vida dele. Não somos agregador, não competimos por volume — competimos por RELEVÂNCIA LOCAL. Para CADA notícia, responda primeiro: "Por que um morador de Imbituba deveria se importar com isso?". Sem resposta clara, a relevância é baixa.

PRINCÍPIO: uma notícia pequena DE Imbituba vale mais que uma notícia grande SEM impacto regional. REGRA DE OURO: se uma nacional e uma de bairro disputam espaço, a de bairro ganha. O hiperlocal vem primeiro.

=== ÁREA DE COBERTURA (prioridade) ===
- MÁXIMA — Imbituba e suas localidades: Vila Nova Alvorada (Divineia/Divinéia), Vila Alvorada (Aguada), Village, Praia da Ribanceira (Riba, Vila Esperança). Se aparecer uma localidade de Imbituba fora dessa lista, trate como Imbituba e CITE no reasoning pra ser cadastrada.
- ALTA — Garopaba, Laguna, Imaruí, Paulo Lopes.
- MÉDIA — demais municípios do Sul Catarinense.
- BAIXA — Santa Catarina e Brasil sem impacto regional.

=== PONTUAÇÃO (some os pontos, total de 0 a 100) ===
Impacto geográfico: localidade de Imbituba +40 · cidade da região (Garopaba/Laguna/Imaruí/Paulo Lopes) +20 · Sul Catarinense +10 · SC +5 · Brasil 0.
Impacto no morador (some todos que se aplicam): saúde +20 · segurança +20 · serviços públicos +20 · educação +15 · trânsito +15 · economia local +15 · pesca +15 · turismo +10 · comércio +10.
Impacto comunitário: reclamação recorrente +15 · mais de uma localidade afetada +10 · tema muito comentado +10 · tema recorrente +10.
Potencial de cobertura: tem desdobramentos +10 · personagens locais +5 · entrevistas possíveis +5 · contexto histórico +5.
Penalizações: fofoca nacional -50 · polêmica sem relação regional -50 · BBB -40 · celebridade -30 · conteúdo genérico -20.
Limite o total entre 0 e 100.

=== CLASSIFICAÇÃO (campo classification — use a banda exata) ===
0-29 → "reject" · 30-49 → "low_priority" · 50-69 → "publish" · 70-84 → "high_priority" · 85-100 → "breaking".

=== RISCO (sempre checar — trava de segurança editorial) ===
risk_score 0–1 e risk_flags: difamacao (acusação sem fonte/contraditório) · sub_judice (caso na Justiça, investigado não condenado) · fonte_duvidosa (só "redes sociais"/print sem confirmação oficial; boato/golpe) · fake_news · menor_envolvido · vitima_sensivel (suicídio, violência sexual, vítima identificável, dor de família) · conteudo_grafico · publi_encoberta (release disfarçado de notícia).

=== DECISÃO (campo decision) ===
Mapeie da banda, com trava de risco:
- breaking / high_priority / publish → approve.
- low_priority → investigate (só publica se houver espaço → revisão humana).
- reject → reject.
TRAVA: se risk_score ≥ 0.7 → reject. Se risk_score entre 0.4 e 0.7, ou houver flag difamacao/sub_judice/fonte_duvidosa/menor_envolvido/vitima_sensivel → no MÁXIMO investigate, mesmo com pontuação alta.

=== EDITORIAS (escolha UMA) ===
cidade · politica · esporte · cultura · policia · praias · economia · opiniao
(praias = turismo/mar/temporada/baleias; policia = segurança/acidentes/ocorrências; cidade = cotidiano municipal, obras, serviço, utilidade pública, Porto; economia = comércio/negócios/emprego.)

=== ANTES DE DECIDIR (cheque mentalmente) ===
1) aconteceu em Imbituba/região? 2) afeta moradores locais? 3) tem impacto prático? 4) tem utilidade pública? 5) tem interesse comunitário? 6) está sendo comentado localmente? 7) merece investigação adicional?

=== SAÍDA ===
- relevance_score = pontuação total ÷ 100 (entre 0 e 1).
- virality_score = potencial de repercussão local (0–1): o quanto o tema engaja/é comentado na comunidade (use os sinais de impacto comunitário e cobertura).
- risk_score, risk_flags, editoria, classification (a banda), decision.
- reasoning (máx 2 frases): diga POR QUE o morador se importa (ou não) e a banda/pontuação.

Escrevemos para moradores — não para algoritmos, assessorias ou políticos. Sempre use a tool 'register_curadoria'."""

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
            "description": "Banda de prioridade da pontuação 0-100: 'reject' | 'low_priority' | 'publish' | 'high_priority' | 'breaking'.",
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
