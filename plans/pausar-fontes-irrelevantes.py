"""Pausa fontes irrelevantes - mantem so Imbituba + AMUREL + Sul SC local.

Estrategia: pausa (active=false) ao inves de apagar.
Se precisar voltar, e so reativar."""
import os, json
import urllib.request
import urllib.parse

URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEAD = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def get(path, params=None):
    q = "?" + urllib.parse.urlencode(params) if params else ""
    req = urllib.request.Request(f"{URL}/rest/v1/{path}{q}", headers=HEAD)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def patch(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", data=data, headers=HEAD, method="PATCH")
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


# Fontes a MANTER (whitelist por nome)
MANTER = {
    # Imbituba direto
    "ND Mais - Imbituba",
    "Prefeitura de Imbituba",
    "Prefeitura Imbituba (site)",
    "Câmara Municipal de Imbituba",
    "Camara vereadores",
    "Notícias Imbituba",
    "Portal Ahora",
    "Portal Ahora — Imbituba",
    "Portal AHora RSS",
    "Portal Click Sul",
    "Portal Click Sul — Imbituba",
    "Porto de Imbituba",
    "Secretaria Esporte Imbituba",
    "Rádio 89.3 FM Imbituba",
    "Difusora 100.3 FM Imbituba",
    "Rota da Baleia Franca",
    "Prefeitura",  # prefeitura local
    # AMUREL/Garopaba
    "ND Mais - Garopaba",
    "Garopaba 94.7 FM",
    "Prefeitura de Garopaba",
    "Rádio Dazareia Paulo Lopes",
    "Litoral FM Imaruí",
    # Laguna
    "ND Mais - Laguna",
    "Prefeitura de Laguna",
    "Jornal de Laguna",
    "Agora Laguna",
    "Laguna Informa",
    "Jornal Popular",
    "Difusora 91.5 FM Laguna",
    "Hiper FM 93.9 Laguna",
    # Sul SC regional (cobre area + tem materia de Imbituba)
    "ND Mais",
    "Engeplus",
    "Notisul",
    "NSC Total",
    "G1 Santa Catarina",
    # EPAGRI (clima) - util pra noticia local
    "EPAGRI/CIRAM (clima/marítima)",
}

srcs = get("sources", {"select": "id,name,active", "order": "name.asc"})
print(f"Total cadastradas: {len(srcs)}")

manter = []
pausar = []
for s in srcs:
    if s["name"] in MANTER:
        manter.append(s)
    else:
        pausar.append(s)

print(f"\nMANTER ATIVAS ({len(manter)}):")
for s in manter:
    estado = "ja ativa" if s["active"] else "REATIVAR"
    print(f"  [{estado}] {s['name']}")

print(f"\nPAUSAR ({len(pausar)}):")
for s in pausar:
    print(f"  {s['name']}")

print("\n>>> Aplicando mudancas...")

# Pausar
for s in pausar:
    if s["active"]:
        sid = s["id"]
        status = patch(f"sources?id=eq.{sid}", {"active": False})
        print(f"  pausada: {s['name']}")

# Reativar as que sao pra manter mas estao paradas
for s in manter:
    if not s["active"]:
        sid = s["id"]
        status = patch(f"sources?id=eq.{sid}", {"active": True})
        print(f"  reativada: {s['name']}")

print("\nPronto.")
