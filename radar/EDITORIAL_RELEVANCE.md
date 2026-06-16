# Sistema de Relevância Editorial Zimbanet

> Fonte da verdade das regras de relevância do Curador. O prompt em
> `app/agents/curador.py` (PROMPT_VERSION curador.v3) implementa este documento.
> Ao mudar as regras aqui, atualizar o prompt.

## Missão

O Zimbanet existe para informar moradores de Imbituba e região sobre fatos que impactam suas vidas. Não somos um agregador de notícias. Não competimos por volume. Competimos por relevância local.

Toda decisão editorial deve responder: **Por que um morador de Imbituba deveria se importar com isso?** Se não houver uma resposta clara, a relevância é baixa.

## Princípio Fundamental

Uma notícia pequena em Imbituba vale mais do que uma notícia grande sem impacto regional.

Alta prioridade (exemplos): falta de água num bairro · acidente na BR-101 perto da cidade · obra que altera o trânsito · problema em escola municipal · mudança em atendimento de saúde · ressaca no mar · condições da pesca · turismo regional.

Baixa prioridade (exemplos): fofoca de celebridade · BBB · influenciador nacional · polêmica sem relação local · entretenimento genérico.

## Área de Cobertura

- **Prioridade Máxima — Imbituba.** Localidades reconhecidas: Vila Nova Alvorada (Divineia / Divinéia) · Vila Alvorada (Aguada) · Village · Praia da Ribanceira (Riba, Vila Esperança). *Toda nova localidade descoberta deve ser adicionada aqui e no prompt.*
- **Prioridade Alta** — Garopaba, Laguna, Imaruí, Paulo Lopes.
- **Prioridade Média** — demais municípios do Sul Catarinense.
- **Prioridade Baixa** — Santa Catarina e Brasil sem impacto regional.

## Critérios de Relevância (pontuação 0–100)

**Impacto geográfico:** localidade de Imbituba +40 · cidade da região +20 · Sul Catarinense +10 · Santa Catarina +5 · Brasil 0.

**Impacto no morador:** saúde +20 · segurança +20 · serviços públicos +20 · educação +15 · trânsito +15 · economia local +15 · pesca +15 · turismo +10 · comércio +10.

**Impacto comunitário:** reclamação recorrente +15 · mais de uma localidade afetada +10 · tema amplamente comentado +10 · tema recorrente +10.

**Potencial de cobertura:** possui desdobramentos +10 · personagens locais +5 · entrevistas possíveis +5 · contexto histórico +5.

**Penalizações:** celebridades -30 · BBB -40 · fofocas nacionais -50 · polêmicas sem relação regional -50 · conteúdo genérico -20.

## Classificação

- 0–29 → **REJECT** — não publicar.
- 30–49 → **LOW_PRIORITY** — publicar apenas se houver espaço editorial.
- 50–69 → **PUBLISH** — publicação normal.
- 70–84 → **HIGH_PRIORITY** — destaque de editoria.
- 85–100 → **BREAKING** — prioridade máxima; avaliar push e topo da homepage.

## Perguntas Obrigatórias (antes de aprovar)

1. O fato aconteceu em Imbituba ou região?
2. O fato afeta moradores locais?
3. Existe impacto prático?
4. Existe utilidade pública?
5. Existe interesse comunitário?
6. O tema está sendo comentado localmente?
7. O tema merece investigação adicional?

## Filosofia Editorial

Escrevemos para moradores. Não para algoritmos, assessorias ou políticos. Escrevemos para quem mora, trabalha ou visita Imbituba.

## Regra de Ouro

Se uma notícia nacional e uma de bairro disputarem espaço, **a de bairro tem prioridade**. O hiperlocal vem primeiro.
