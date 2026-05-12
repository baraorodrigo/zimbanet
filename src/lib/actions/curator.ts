"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/auth/admin";
import { getActiveRubric } from "@/lib/db/curator";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// Aceita lista separada por vírgula OU por linha. Mantém ordem, descarta
// vazios, dedupe case-insensitive preservando a primeira ocorrência.
function parseList(raw: string): string[] {
  if (!raw) return [];
  const items = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function updateCuratorRubric(
  formData: FormData,
): Promise<ActionResult<{ prompt_version: number }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) return { ok: false, error: "Sem permissão." };

  const editorial_voice = field(formData, "editorial_voice") || null;
  const relevance_rules = field(formData, "relevance_rules");
  const virality_rules = field(formData, "virality_rules");
  const risk_rules = field(formData, "risk_rules");
  const notes = field(formData, "notes") || null;

  if (relevance_rules.length < 40) {
    return {
      ok: false,
      error: "Regras de relevância muito curtas (mín. 40 caracteres).",
    };
  }
  if (virality_rules.length < 40) {
    return {
      ok: false,
      error: "Regras de viralidade muito curtas (mín. 40 caracteres).",
    };
  }
  if (risk_rules.length < 40) {
    return {
      ok: false,
      error: "Regras de risco muito curtas (mín. 40 caracteres).",
    };
  }

  const focus_cities = parseList(field(formData, "focus_cities"));
  const trigger_keywords = parseList(field(formData, "trigger_keywords"));
  const block_keywords = parseList(field(formData, "block_keywords"));

  const admin = createAdminClient();
  const current = await getActiveRubric();

  const newPayload = {
    editorial_voice,
    relevance_rules,
    virality_rules,
    risk_rules,
    focus_cities,
    trigger_keywords,
    block_keywords,
    notes,
    is_active: true,
    updated_by: user!.email ?? user!.id,
  };

  if (!current) {
    const { data, error } = await admin
      .from("curator_rubric")
      .insert({ ...newPayload, prompt_version: 1 })
      .select("id, prompt_version")
      .single();
    if (error) {
      console.error("[updateCuratorRubric] insert", error);
      return { ok: false, error: "Erro salvando: " + error.message };
    }
    await admin.from("audit_log").insert({
      entity_type: "curator_rubric",
      entity_id: data.id,
      action: "create",
      actor: user!.email ?? user!.id,
      agent: "admin_ui",
      metadata: { prompt_version: data.prompt_version },
    });
    revalidatePath("/admin/curador");
    return { ok: true, data: { prompt_version: data.prompt_version as number } };
  }

  // Detecta mudança nas regras pra decidir bump de prompt_version. Notas
  // e edição de keywords também contam — o motor pode reagir diferente.
  const changed =
    current.editorial_voice !== editorial_voice ||
    current.relevance_rules !== relevance_rules ||
    current.virality_rules !== virality_rules ||
    current.risk_rules !== risk_rules ||
    !sameList(current.focus_cities, focus_cities) ||
    !sameList(current.trigger_keywords, trigger_keywords) ||
    !sameList(current.block_keywords, block_keywords);

  const nextVersion = changed
    ? (current.prompt_version ?? 1) + 1
    : current.prompt_version ?? 1;

  const { error: updErr } = await admin
    .from("curator_rubric")
    .update({ ...newPayload, prompt_version: nextVersion })
    .eq("id", current.id);
  if (updErr) {
    console.error("[updateCuratorRubric] update", updErr);
    return { ok: false, error: "Erro salvando: " + updErr.message };
  }

  await admin.from("audit_log").insert({
    entity_type: "curator_rubric",
    entity_id: current.id,
    action: changed ? "update_bumped" : "update_nochange",
    actor: user!.email ?? user!.id,
    agent: "admin_ui",
    metadata: { prompt_version: nextVersion, changed },
  });

  revalidatePath("/admin/curador");
  return { ok: true, data: { prompt_version: nextVersion } };
}

function sameList(a: string[] | null | undefined, b: string[]): boolean {
  const aArr = a ?? [];
  if (aArr.length !== b.length) return false;
  for (let i = 0; i < aArr.length; i++) {
    if (aArr[i] !== b[i]) return false;
  }
  return true;
}
