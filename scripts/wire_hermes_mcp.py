"""Religa o zimbanet-mcp (stdio, via uv) nos configs do Hermes.

- Root config: mantem supabase + adiciona zimbanet-mcp.
- Profiles zimbanet-*: SO zimbanet-mcp (agente nao toca banco direto).

Substitui apenas o bloco top-level `mcp_servers:`; o resto do config fica intacto.
Faz backup .mcpbak-<timestamp> de cada arquivo alterado.

Rodar: python scripts/wire_hermes_mcp.py
"""
from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

HERMES = Path(r"C:\Users\barao\AppData\Local\hermes")
UV = "C:/Users/barao/AppData/Local/hermes/bin/uv.exe"
MCP_DIR = "C:/Users/barao/projetos/zimbanet/zimbanet-mcp"
API_URL = "https://teste.zimbanet.com"

STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")

ZIMBANET_ENTRY = f"""  zimbanet-mcp:
    command: {UV}
    args:
    - run
    - --directory
    - {MCP_DIR}
    - server.py
    enabled: true
    env:
      AGENT_TOKEN: ${{ZIMBANET_AGENT_TOKEN}}
      ZIMBANET_API_URL: {API_URL}
    timeout: 60
"""

SUPABASE_ENTRY = """  supabase:
    args:
    - -y
    - '@supabase/mcp-server-supabase@latest'
    - --project-ref=gavgzpbqrryepgqxzvdk
    command: npx
    enabled: true
    env:
      SUPABASE_ACCESS_TOKEN: ${SUPABASE_ACCESS_TOKEN}
    timeout: 60
"""


def block(include_supabase: bool) -> str:
    body = "mcp_servers:\n"
    if include_supabase:
        body += SUPABASE_ENTRY
    body += ZIMBANET_ENTRY
    return body


def replace_top_level_block(text: str, key: str, new_block: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    replaced = False
    while i < len(lines):
        line = lines[i]
        if line.startswith(f"{key}:"):
            if not replaced:
                out.extend(new_block.rstrip().splitlines())
                replaced = True
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if nxt and not nxt.startswith((" ", "\t")) and not nxt.startswith("#"):
                    break
                i += 1
            continue
        out.append(line)
        i += 1
    if not replaced:
        if out and out[-1].strip():
            out.append("")
        out.extend(new_block.rstrip().splitlines())
    return "\n".join(out).rstrip() + "\n"


def patch(path: Path, include_supabase: bool) -> str:
    if not path.exists():
        return f"SKIP (nao existe): {path}"
    text = path.read_text(encoding="utf-8", errors="ignore")
    shutil.copy2(path, path.with_name(f"{path.name}.mcpbak-{STAMP}"))
    new = replace_top_level_block(text, "mcp_servers", block(include_supabase))
    path.write_text(new, encoding="utf-8")
    has_z = "zimbanet-mcp:" in new and "enabled: true" in new
    return f"OK {path.name} (supabase={'sim' if include_supabase else 'nao'}, zimbanet={'sim' if has_z else 'FALHOU'})"


def main() -> int:
    targets: list[tuple[Path, bool]] = [(HERMES / "config.yaml", True)]
    profiles_root = HERMES / "profiles"
    for d in sorted(profiles_root.glob("zimbanet-*")):
        cfg = d / "config.yaml"
        if cfg.exists():
            targets.append((cfg, False))

    print(f"Hermes: {HERMES}")
    print(f"Alvos: {len(targets)} configs\n")
    for path, with_sb in targets:
        print(" -", patch(path, with_sb))
    print(f"\nBackups: *.mcpbak-{STAMP}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
