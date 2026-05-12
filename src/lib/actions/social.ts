"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";
import { redistributeArticle } from "@/lib/radar";

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function audit(
  supabase: ReturnType<typeof createClient>,
  args: {
    entity_id: string;
    action: string;
    actor: string;
    entity_type?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_log").insert({
    entity_type: args.entity_type ?? "social_post",
    entity_id: args.entity_id,
    action: args.action,
    actor: args.actor,
    agent: "admin_ui",
    metadata: args.metadata ?? {},
  });
}

// Aprova um post pendente — flag visual de "ok pra publicar".
// Não publica de verdade (sem integração com IG/FB ainda); só sai de pending → ready.
export async function approveSocialPost(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { error } = await supabase
    .from("social_posts")
    .update({ status: "ready", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "approve_social",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin/social");
}

// Marca como publicado — admin colou o link manualmente do IG/FB/etc.
export async function markSocialPostPublished(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");
  const externalUrl = field(formData, "external_url") || null;

  const { error } = await supabase
    .from("social_posts")
    .update({
      status: "published",
      external_url: externalUrl,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "publish_social",
    actor: user!.email ?? user!.id,
    metadata: { external_url: externalUrl },
  });

  revalidatePath("/admin/social");
}

// Joga em failed pra admin parar de ver na fila.
export async function dismissSocialPost(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { error } = await supabase
    .from("social_posts")
    .update({
      status: "failed",
      error_message: "descartado pelo editor",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "dismiss_social",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin/social");
  revalidatePath("/admin/estudio", "layout");
}

// Hard delete — pra eliminar duplicatas que o Distribuidor gerou em duplicidade.
// dismissSocialPost só marca failed; quando o canal tem 2 cards do mesmo formato
// e o editor quer só 1, ele apaga o outro de vez por aqui.
export async function deleteSocialPost(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { data, error } = await supabase
    .from("social_posts")
    .delete()
    .eq("id", id)
    .select("article_id, channel, format")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "delete_social",
    actor: user!.email ?? user!.id,
    metadata: data ?? {},
  });

  revalidatePath("/admin/social");
  revalidatePath("/admin/estudio", "layout");
}

// Tira de failed e volta pra pending — desfaz um descarte.
export async function restoreSocialPost(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { error } = await supabase
    .from("social_posts")
    .update({
      status: "pending",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "restore_social",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin/social");
  revalidatePath("/admin/estudio", "layout");
}

// Aprova de uma vez todos os posts pendentes de uma matéria. Retorna quantos
// foram aprovados — admin chama de "Aprovar pendentes" no header do rail.
export async function approvePackPending(
  articleId: string,
): Promise<{ approved: number }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");
  if (!articleId) throw new Error("article_id ausente.");

  const { data: pending, error: fetchErr } = await supabase
    .from("social_posts")
    .select("id")
    .eq("article_id", articleId)
    .eq("status", "pending");
  if (fetchErr) throw new Error(fetchErr.message);

  const ids = (pending ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { approved: 0 };

  const { error: updErr } = await supabase
    .from("social_posts")
    .update({ status: "ready", updated_at: new Date().toISOString() })
    .in("id", ids);
  if (updErr) throw new Error(updErr.message);

  await audit(supabase, {
    entity_id: articleId,
    entity_type: "article",
    action: "approve_pack_pending",
    actor: user!.email ?? user!.id,
    metadata: { count: ids.length, ids },
  });

  revalidatePath("/admin/social");
  revalidatePath("/admin/estudio", "layout");
  return { approved: ids.length };
}

// Roda o Distribuidor de novo pra um article (gera novo pack de posts).
// Chamado quando o admin não gostou da geração anterior.
export async function regenerateSocialPack(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const articleId = field(formData, "article_id");
  if (!articleId) throw new Error("article_id ausente.");

  let result;
  try {
    result = await redistributeArticle(articleId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error("Distribuidor falhou: " + msg);
  }

  await audit(supabase, {
    entity_id: articleId,
    action: "regenerate_social_pack",
    actor: user!.email ?? user!.id,
    metadata: {
      channels: result.channels,
      persisted_ids: result.persisted_ids,
    },
  });

  revalidatePath("/admin/social");
}
