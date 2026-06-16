# zimbanet-mcp

Servidor MCP que liga o **Hermes** ao gateway `/api/ai` do Zimbanet. Roda **local**, junto do Hermes — não vai pro VPS.

## Setup
    cd zimbanet-mcp && pip install -e .

## Variáveis de ambiente
- `ZIMBANET_API_URL` — default `https://teste.zimbanet.com`
- `AGENT_TOKEN` — token do agente (gerado por `scripts/seed-agent.ts` no portal; mostrado uma vez)

## Rodar
    AGENT_TOKEN=zmb_... python server.py

## Plugar no Hermes
Adicionar como MCP server (stdio): comando `python`, args `["server.py"]`, `cwd` nesta pasta,
e `env` com `ZIMBANET_API_URL` + `AGENT_TOKEN`. A tool `zimbanet_ping` deve responder `{ok: true}`.

## Estrutura
- `client.py` — HTTP fino (Bearer) pro gateway.
- `server.py` — registra as tools MCP.
- `tools/` — uma tool por capacidade (começa com `ping`).
