"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";
import { slugify } from "@/lib/utils/slug";
import {
  SOURCE_TYPES,
  SOURCE_PRIORITIES,
  type SourceType,
  type SourcePriority,
} from "@/lib/db/sources";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function csvField(formData: FormData, key: string): string[] {
  const raw = field(formData, key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}

async function audit(
  supabase: ReturnType<typeof createClient>,
  args: {
    entity_id: string;
    action: string;
    actor: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_log").insert({
    entity_type: "source",
    entity_id: args.entity_id,
    action: args.action,
    actor: args.actor,
    agent: "admin_ui",
    metadata: args.metadata ?? {},
  });
}

type ParsedSource = {
  id: string;
  name: string;
  type: SourceType;
  priority: SourcePriority;
  city: string;
  active: boolean;
  config: { url?: string; filters?: { keywords?: string[] } };
};

function parseInput(formData: FormData, opts: { idRequired?: boolean } = {}):
  | ParsedSource
  | { error: string } {
  const name = field(formData, "name");
  if (name.length < 2 || name.length > 80) {
    return { error: "Nome precisa ter entre 2 e 80 caracteres." };
  }

  const rawId = field(formData, "id");
  const id = rawId ? slugify(rawId).replace(/-/g, "_") : slugify(name).replace(/-/g, "_");
  if (opts.idRequired && !id) {
    return { error: "ID obrigatório." };
  }
  if (id && !/^[a-z0-9_]+$/.test(id)) {
    return { error: "ID só pode ter letras minúsculas, números e underscore." };
  }

  const type = field(formData, "type") as SourceType;
  if (!SOURCE_TYPES.includes(type)) {
    return { error: "Tipo inválido." };
  }

  const priority = (field(formData, "priority") || "medium") as SourcePriority;
  if (!SOURCE_PRIORITIES.includes(priority)) {
    return { error: "Prioridade inválida." };
  }

  const city = field(formData, "city");
  if (!city) return { error: "Informe a cidade principal coberta." };

  const url = field(formData, "url");
  if ((type === "rss" || type === "api") && !url) {
    return { error: "URL é obrigatória pra fontes RSS / API." };
  }
  if (url && !/^https?:\/\//i.test(url)) {
    return { error: "URL precisa começar com http:// ou https://" };
  }

  const keywords = csvField(formData, "keywords");

  return {
    id,
    name,
    type,
    priority,
    city,
    active: field(formData, "active") === "on",
    config: {
      ...(url ? { url } : {}),
      ...(keywords.length > 0 ? { filters: { keywords } } : {}),
    },
  };
}

// === CREATE =================================================================

export async function createSource(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) return { ok: false, error: "Sem permissão." };

  const parsed = parseInput(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("id", parsed.id)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `Já existe fonte com ID "${parsed.id}". Use outro ID.` };
  }

  const { error } = await supabase.from("sources").insert({
    id: parsed.id,
    name: parsed.name,
    type: parsed.type,
    priority: parsed.priority,
    city: parsed.city,
    active: parsed.active,
    config: parsed.config,
  });

  if (error) {
    console.error("[createSource]", error);
    return { ok: false, error: "Erro salvando: " + error.message };
  }

  await audit(supabase, {
    entity_id: parsed.id,
    action: "create",
    actor: user!.email ?? user!.id,
    metadata: { name: parsed.name, type: parsed.type, city: parsed.city },
  });

  revalidatePath("/admin/fontes");
  redirect("/admin/fontes");
}

// === UPDATE =================================================================

export async function updateSource(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) return { ok: false, error: "Sem permissão." };

  const parsed = parseInput(formData, { idRequired: false });
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // ID é primary key — não muda em update.
  const { error } = await supabase
    .from("sources")
    .update({
      name: parsed.name,
      type: parsed.type,
      priority: parsed.priority,
      city: parsed.city,
      active: parsed.active,
      config: parsed.config,
    })
    .eq("id", id);

  if (error) {
    console.error("[updateSource]", error);
    return { ok: false, error: "Erro salvando: " + error.message };
  }

  await audit(supabase, {
    entity_id: id,
    action: "update",
    actor: user!.email ?? user!.id,
    metadata: { name: parsed.name, type: parsed.type, active: parsed.active },
  });

  revalidatePath("/admin/fontes");
  revalidatePath(`/admin/fontes/${id}`);
  return { ok: true };
}

// === TOGGLE ATIVA / PAUSADA =================================================

export async function toggleSource(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { data: current } = await supabase
    .from("sources")
    .select("active")
    .eq("id", id)
    .maybeSingle<{ active: boolean }>();
  if (!current) throw new Error("Fonte não encontrada.");

  const next = !current.active;
  const { error } = await supabase
    .from("sources")
    .update({ active: next })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: next ? "activate" : "pause",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin/fontes");
}

// === ZERAR CONTADOR DE ERROS ================================================

export async function resetSourceErrors(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { error } = await supabase
    .from("sources")
    .update({ error_count: 0 })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "reset_errors",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin/fontes");
}

// === DELETE =================================================================

export async function deleteSource(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  // Bloqueia delete se houver raw_items (FK). Usuário pausa em vez de deletar.
  const { count } = await supabase
    .from("raw_items")
    .select("*", { count: "exact", head: true })
    .eq("source_id", id);

  if ((count ?? 0) > 0) {
    throw new Error(
      `Essa fonte já tem ${count} itens coletados. Pause em vez de deletar (pra preservar o histórico).`,
    );
  }

  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "delete",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin/fontes");
  redirect("/admin/fontes");
}
