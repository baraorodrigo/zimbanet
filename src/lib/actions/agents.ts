"use server";

// Gestão de agentes de IA (tokens + permissões) pelo painel. Só admin.
// O token cru é gerado, mostrado UMA vez e guardado só como hash.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isAdmin } from "@/lib/auth/admin";
import { generateToken } from "@/lib/ai/tokens";
import { AGENT_PRESETS } from "@/lib/ai/agent-presets";

export type AgentSummary = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  rate_limit_per_hour: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^\x00-\x7f]/g, "") // remove acentos/combinantes (não-ASCII)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "agente"
  );
}

async function ensureAdmin() {
  const { user } = await requireAdmin();
  if (!isAdmin(user)) throw new Error("Só admin pode gerenciar agentes.");
}

export async function listAgents(): Promise<AgentSummary[]> {
  await ensureAdmin();
  const sb = createAdminClient();
  const { data } = await sb
    .from("agents")
    .select("id, name, type, active, rate_limit_per_hour, last_used_at, revoked_at, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as AgentSummary[];
}

export async function createAgent(input: {
  name: string;
  preset: string;
}): Promise<{ ok: true; id: string; token: string } | { ok: false; error: string }> {
  try {
    await ensureAdmin();
    const name = (input.name || "").trim();
    if (!name) return { ok: false, error: "Dê um nome ao agente." };
    const preset = AGENT_PRESETS[input.preset] ?? AGENT_PRESETS.director;
    const id = slugify(name);
    const { raw, hash } = generateToken(id);
    const sb = createAdminClient();
    const { error } = await sb.from("agents").insert({
      id,
      name,
      type: preset.type,
      token_hash: hash,
      permissions: preset.permissions,
      rate_limit_per_hour: 120,
      active: true,
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        return { ok: false, error: `Já existe um agente "${id}". Use outro nome.` };
      }
      return { ok: false, error: error.message };
    }
    revalidatePath("/admin/agentes");
    return { ok: true, id, token: raw };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setAgentRevoked(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const revoke = String(formData.get("revoke")) === "1";
  const sb = createAdminClient();
  await sb
    .from("agents")
    .update({ revoked_at: revoke ? new Date().toISOString() : null, active: !revoke })
    .eq("id", id);
  revalidatePath("/admin/agentes");
}

export async function deleteAgent(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const sb = createAdminClient();
  await sb.from("agent_runs").delete().eq("agent_id", id);
  await sb.from("agents").delete().eq("id", id);
  revalidatePath("/admin/agentes");
}
