// Importa todas as fontes do BOMBEI legado (rodando local em :8000) pro Supabase.
// Idempotente: se já existir fonte com o mesmo ID, pula.
//
// Como rodar:  npm run import-bombei-sources
//
// Pré-requisitos:
//   - BOMBEI rodando em http://localhost:8000 (com endpoint /sources)
//   - .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---- minimalíssimo loader de .env.local (sem depender de pacote externo) ----
function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (process.env[k] === undefined) {
        process.env[k] = v.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // sem .env.local — confia que as vars já tão setadas
  }
}
loadDotEnv();

// ---- types ----
type BombeiSource = {
  id: string; // UUID — descartado, geramos slug do name
  name: string;
  type: string;
  city: string;
  active: boolean;
  config: { url?: string; filters?: { keywords?: string[] } };
  last_fetched_at: string | null;
  error_count: number;
};

// ---- helpers ----
function slugifyId(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function pickPriority(s: BombeiSource): "high" | "medium" | "low" {
  // Heurística simples: prefeitura/câmara/G1 = high, scraper desativada = low,
  // resto = medium.
  const n = s.name.toLowerCase();
  if (s.active === false) return "low";
  if (
    n.includes("prefeitura") ||
    n.includes("câmara") ||
    n.includes("camara") ||
    n.includes("g1") ||
    n.includes("imbituba")
  ) {
    return "high";
  }
  return "medium";
}

// ---- main ----
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bombeiUrl = process.env.BOMBEI_API_URL ?? "http://localhost:8000";
  console.log(`→ buscando fontes em ${bombeiUrl}/sources`);

  const res = await fetch(`${bombeiUrl}/sources`);
  if (!res.ok) {
    console.error(`BOMBEI respondeu ${res.status}`);
    process.exit(1);
  }
  const bombeiSources = (await res.json()) as BombeiSource[];
  console.log(`  encontradas ${bombeiSources.length} fontes no BOMBEI`);

  // Pega as que já existem no Supabase (por ID — slug do nome)
  const candidates = bombeiSources.map((s) => ({
    bombei: s,
    targetId: slugifyId(s.name),
  }));

  const targetIds = candidates.map((c) => c.targetId);
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .in("id", targetIds);
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));

  const toInsert = candidates.filter((c) => !existingIds.has(c.targetId));
  const skipped = candidates.length - toInsert.length;

  console.log(`  ${toInsert.length} pra inserir · ${skipped} já existiam (puladas)`);

  let inserted = 0;
  let failed = 0;

  for (const { bombei, targetId } of toInsert) {
    // Se houver colisão de ID dentro do próprio batch (nomes duplicados no BOMBEI,
    // tipo "Portal Ahora" rss + scraper), sufixa com o type.
    let id = targetId;
    const dupCount = candidates.filter((c) => c.targetId === targetId).length;
    if (dupCount > 1) id = `${targetId}_${bombei.type}`;

    const { error } = await supabase.from("sources").insert({
      id,
      name: bombei.name,
      type: bombei.type,
      city: bombei.city || "imbituba",
      priority: pickPriority(bombei),
      active: bombei.active,
      config: bombei.config ?? {},
    });

    if (error) {
      console.error(`  ✗ ${id} — ${error.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${id} — ${bombei.name} [${bombei.type}, ${bombei.city}]`);
      inserted++;
    }
  }

  console.log(`\n✓ ${inserted} inseridas, ${skipped} puladas, ${failed} falharam.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
