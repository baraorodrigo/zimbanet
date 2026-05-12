"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";
import { slugify, uniqueArticleSlug } from "@/lib/utils/slug";
import { EDITORIA_SLUGS, type EditoriaSlug } from "@/lib/db/types";
import { draftFromScored, finalizeArticle } from "@/lib/radar";
import { sendBreakingPush } from "@/lib/push/send";

// Dispara push em background pra matéria recém-publicada com is_breaking=true.
// Não bloqueia a Server Action — falhas só ficam no log.
function maybePushBreaking(article: {
  id: string;
  title: string;
  lede: string | null;
  subtitle: string | null;
  editoria: string;
  slug: string;
  hero_image_url?: string | null;
  is_breaking: boolean;
}) {
  if (!article.is_breaking) return;
  sendBreakingPush(article).catch((err: Error) => {
    console.warn("[maybePushBreaking]", err.message);
  });
}

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function listField(formData: FormData, key: string): string[] {
  const raw = field(formData, key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
}

async function audit(
  supabase: ReturnType<typeof createClient>,
  args: {
    entity_type: string;
    entity_id: string;
    action: string;
    actor: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_log").insert({
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    action: args.action,
    actor: args.actor,
    agent: "admin_ui",
    metadata: args.metadata ?? {},
  });
}

function revalidateArticle(slug: string, editoria: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/${editoria}`);
  revalidatePath(`/${editoria}/${slug}`);
}

// === CREATE / UPDATE =========================================================

export type ArticleInput = {
  editoria: EditoriaSlug;
  title: string;
  slug?: string | null;
  kicker?: string | null;
  subtitle?: string | null;
  lede?: string | null;
  body: string;
  byline?: string | null;
  hero_image_url?: string | null;
  hero_image_credit?: string | null;
  hero_image_alt?: string | null;
  tags: string[];
  cities: string[];
  is_breaking: boolean;
  is_exclusive: boolean;
  status: "draft" | "review" | "published";
};

function parseInput(formData: FormData): ArticleInput | { error: string } {
  const editoria = field(formData, "editoria") as EditoriaSlug;
  if (!EDITORIA_SLUGS.includes(editoria)) {
    return { error: "Selecione uma editoria válida." };
  }
  const title = field(formData, "title");
  if (title.length < 3 || title.length > 200) {
    return { error: "Título precisa ter entre 3 e 200 caracteres." };
  }
  const body = field(formData, "body");
  if (body.length < 20) {
    return { error: "Corpo da matéria muito curto (mínimo 20 caracteres)." };
  }
  const status = field(formData, "status");
  if (!["draft", "review", "published"].includes(status)) {
    return { error: "Status inválido." };
  }
  return {
    editoria,
    title,
    slug: field(formData, "slug") || null,
    kicker: field(formData, "kicker") || null,
    subtitle: field(formData, "subtitle") || null,
    lede: field(formData, "lede") || null,
    body,
    byline: field(formData, "byline") || null,
    hero_image_url: field(formData, "hero_image_url") || null,
    hero_image_credit: field(formData, "hero_image_credit") || null,
    hero_image_alt: field(formData, "hero_image_alt") || null,
    tags: listField(formData, "tags"),
    cities: listField(formData, "cities"),
    is_breaking: field(formData, "is_breaking") === "on",
    is_exclusive: field(formData, "is_exclusive") === "on",
    status: status as "draft" | "review" | "published",
  };
}

export async function createArticle(
  formData: FormData,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) {
    return { ok: false, error: "Sem permissão." };
  }

  const parsed = parseInput(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const slug = parsed.slug
    ? slugify(parsed.slug)
    : await uniqueArticleSlug(supabase, parsed.title);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug,
      editoria: parsed.editoria,
      kicker: parsed.kicker,
      title: parsed.title,
      subtitle: parsed.subtitle,
      lede: parsed.lede,
      body: parsed.body,
      byline: parsed.byline,
      hero_image_url: parsed.hero_image_url,
      hero_image_credit: parsed.hero_image_credit,
      hero_image_alt: parsed.hero_image_alt,
      tags: parsed.tags,
      cities: parsed.cities,
      is_breaking: parsed.is_breaking,
      is_exclusive: parsed.is_exclusive,
      status: parsed.status,
      published_at: parsed.status === "published" ? now : null,
    })
    .select("id, slug, editoria, status")
    .single();

  if (error) {
    console.error("[createArticle]", error);
    return { ok: false, error: "Não consegui salvar: " + error.message };
  }

  await audit(supabase, {
    entity_type: "article",
    entity_id: data.id as string,
    action: parsed.status === "published" ? "create_published" : "create_draft",
    actor: user!.email ?? user!.id,
    metadata: { title: parsed.title, editoria: parsed.editoria },
  });

  if (parsed.status === "published") {
    revalidateArticle(data.slug as string, data.editoria as string);
    maybePushBreaking({
      id: data.id as string,
      title: parsed.title,
      lede: parsed.lede ?? null,
      subtitle: parsed.subtitle ?? null,
      editoria: parsed.editoria,
      slug: data.slug as string,
      hero_image_url: parsed.hero_image_url ?? null,
      is_breaking: parsed.is_breaking,
    });
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/materias/${data.id}`);
}

export async function updateArticle(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) return { ok: false, error: "Sem permissão." };

  const parsed = parseInput(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // Pega slug atual: só re-slugifica se o usuário mudou explicitamente.
  const { data: current } = await supabase
    .from("articles")
    .select("slug, status, published_at")
    .eq("id", id)
    .single();
  if (!current) return { ok: false, error: "Matéria não encontrada." };

  const slug = parsed.slug ? slugify(parsed.slug) : (current.slug as string);

  const goingLive = parsed.status === "published" && current.status !== "published";
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("articles")
    .update({
      slug,
      editoria: parsed.editoria,
      kicker: parsed.kicker,
      title: parsed.title,
      subtitle: parsed.subtitle,
      lede: parsed.lede,
      body: parsed.body,
      byline: parsed.byline,
      hero_image_url: parsed.hero_image_url,
      hero_image_credit: parsed.hero_image_credit,
      hero_image_alt: parsed.hero_image_alt,
      tags: parsed.tags,
      cities: parsed.cities,
      is_breaking: parsed.is_breaking,
      is_exclusive: parsed.is_exclusive,
      status: parsed.status,
      published_at: goingLive ? now : current.published_at,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error("[updateArticle]", error);
    return { ok: false, error: "Erro salvando: " + error.message };
  }

  await audit(supabase, {
    entity_type: "article",
    entity_id: id,
    action: goingLive ? "update_publish" : "update",
    actor: user!.email ?? user!.id,
    metadata: { status: parsed.status },
  });

  revalidateArticle(slug, parsed.editoria);
  if (goingLive) {
    maybePushBreaking({
      id,
      title: parsed.title,
      lede: parsed.lede ?? null,
      subtitle: parsed.subtitle ?? null,
      editoria: parsed.editoria,
      slug,
      hero_image_url: parsed.hero_image_url ?? null,
      is_breaking: parsed.is_breaking,
    });
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// === FILA: APPROVE / REJECT / UNPUBLISH =====================================

export async function approveArticle(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { data, error } = await supabase
    .from("articles")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("slug, editoria, title, lede, subtitle, hero_image_url, is_breaking")
    .single();
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_type: "article",
    entity_id: id,
    action: "approve_publish",
    actor: user!.email ?? user!.id,
  });

  // Visual + Distribuidor em background — não bloqueia o admin esperando.
  // Se falhar, fica registrado em audit_log do radar; admin pode rodar manual.
  finalizeArticle(id).catch((err: Error) => {
    console.warn("[approveArticle] finalize falhou:", err.message);
  });

  maybePushBreaking({
    id,
    title: data!.title as string,
    lede: (data!.lede as string | null) ?? null,
    subtitle: (data!.subtitle as string | null) ?? null,
    editoria: data!.editoria as string,
    slug: data!.slug as string,
    hero_image_url: (data!.hero_image_url as string | null) ?? null,
    is_breaking: !!data!.is_breaking,
  });

  revalidateArticle(data!.slug as string, data!.editoria as string);
  revalidatePath("/admin", "layout");
  redirect("/admin/fila");
}

// === REDIGIR COM AI =========================================================
// Aciona o pipeline Investigador→Redator no scored_item informado.
// Quando termina, redireciona pra página de edição do article gerado.
export async function draftArticleWithAI(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const scoredId = field(formData, "scored_item_id");
  if (!scoredId) throw new Error("scored_item_id ausente.");

  let result;
  try {
    result = await draftFromScored(scoredId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[draftArticleWithAI] falhou:", msg);
    throw new Error("Não consegui acionar o motor IA: " + msg);
  }

  await audit(supabase, {
    entity_type: "article",
    entity_id: result.article_id,
    action: result.reused ? "draft_with_ai_reused" : "draft_with_ai",
    actor: user!.email ?? user!.id,
    metadata: {
      scored_item_id: scoredId,
      enriched_item_id: result.enriched_item_id,
      slug: result.slug,
    },
  });

  revalidatePath("/admin/pauta");
  revalidatePath("/admin/fila");
  revalidatePath("/admin", "layout");
  redirect(`/admin/materias/${result.article_id}`);
}

export async function rejectArticle(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { error } = await supabase
    .from("articles")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_type: "article",
    entity_id: id,
    action: "reject",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin", "layout");
  redirect("/admin/fila");
}

// Publica direto a partir da tela de edição. Diferente de approveArticle
// (que vem da fila e redireciona pra fila), este permanece na edição
// pra o admin continuar mexendo se quiser.
export async function publishArticle(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { data: current } = await supabase
    .from("articles")
    .select("status, title, body")
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new Error("Matéria não encontrada.");
  if (current.status === "published") {
    throw new Error("Matéria já está publicada.");
  }
  if (((current.title as string) ?? "").trim().length < 3) {
    throw new Error("Título muito curto pra publicar.");
  }
  if (((current.body as string) ?? "").trim().length < 50) {
    throw new Error("Corpo muito curto pra publicar (mínimo 50 caracteres).");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("articles")
    .update({
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("slug, editoria, title, lede, subtitle, hero_image_url, is_breaking")
    .single();
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_type: "article",
    entity_id: id,
    action: "publish_from_edit",
    actor: user!.email ?? user!.id,
  });

  finalizeArticle(id).catch((err: Error) => {
    console.warn("[publishArticle] finalize falhou:", err.message);
  });

  maybePushBreaking({
    id,
    title: data!.title as string,
    lede: (data!.lede as string | null) ?? null,
    subtitle: (data!.subtitle as string | null) ?? null,
    editoria: data!.editoria as string,
    slug: data!.slug as string,
    hero_image_url: (data!.hero_image_url as string | null) ?? null,
    is_breaking: !!data!.is_breaking,
  });

  revalidateArticle(data!.slug as string, data!.editoria as string);
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/materias/${id}`);
}

export async function unpublishArticle(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { data, error } = await supabase
    .from("articles")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("slug, editoria")
    .single();
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_type: "article",
    entity_id: id,
    action: "unpublish",
    actor: user!.email ?? user!.id,
  });

  revalidateArticle(data!.slug as string, data!.editoria as string);
  revalidatePath("/admin", "layout");
  redirect(`/admin/materias/${id}`);
}

export async function deleteArticle(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { data, error } = await supabase
    .from("articles")
    .delete()
    .eq("id", id)
    .select("slug, editoria")
    .single();
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_type: "article",
    entity_id: id,
    action: "delete",
    actor: user!.email ?? user!.id,
  });

  if (data) revalidateArticle(data.slug as string, data.editoria as string);
  revalidatePath("/admin", "layout");
  redirect("/admin/materias");
}

// === CURADORIA DA HOME =====================================================
// Capa única (toggle): se já é capa, tira. Se não é, desmarca todas as outras
// e marca essa. Uniqueness garantida na Server Action, não no banco.

export async function setArticleAsCover(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { data: current } = await supabase
    .from("articles")
    .select("slug, editoria, status, is_cover")
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new Error("Matéria não encontrada.");
  if (current.status !== "published") {
    throw new Error("Só dá pra marcar como capa uma matéria publicada.");
  }

  const willBeCover = !current.is_cover;
  const now = new Date().toISOString();

  if (willBeCover) {
    // Garante unicidade: limpa qualquer outra capa antes de marcar essa.
    const { error: unsetErr } = await supabase
      .from("articles")
      .update({ is_cover: false, updated_at: now })
      .eq("is_cover", true)
      .neq("id", id);
    if (unsetErr) throw new Error(unsetErr.message);
  }

  const { error } = await supabase
    .from("articles")
    .update({ is_cover: willBeCover, updated_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_type: "article",
    entity_id: id,
    action: willBeCover ? "set_as_cover" : "unset_cover",
    actor: user!.email ?? user!.id,
  });

  revalidateArticle(current.slug as string, current.editoria as string);
  revalidatePath("/admin", "layout");
}

// Destaque toggle (vários permitidos). Sem unset em massa — cada matéria
// liga/desliga independente. UI sugere até 3, mas não enforça no banco.
export async function toggleArticleHighlight(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const { data: current } = await supabase
    .from("articles")
    .select("slug, editoria, status, is_highlight")
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new Error("Matéria não encontrada.");
  if (current.status !== "published") {
    throw new Error("Só dá pra destacar uma matéria publicada.");
  }

  const next = !current.is_highlight;
  const { error } = await supabase
    .from("articles")
    .update({ is_highlight: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_type: "article",
    entity_id: id,
    action: next ? "set_highlight" : "unset_highlight",
    actor: user!.email ?? user!.id,
  });

  revalidateArticle(current.slug as string, current.editoria as string);
  revalidatePath("/admin", "layout");
}

// === IMPORTAÇÃO POR URL ====================================================
// Cria rascunho a partir do conteúdo extraído de uma URL externa. O editor
// pode ajustar campos no form; aqui só persiste no banco. O texto extraído
// entra como ponto de partida — espera-se que o Redator IA reescreva depois.
export async function createArticleFromImport(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const sourceUrl = field(formData, "source_url");
  if (!sourceUrl) throw new Error("source_url ausente.");

  const editoria = field(formData, "editoria") as EditoriaSlug;
  if (!EDITORIA_SLUGS.includes(editoria)) {
    throw new Error("Selecione uma editoria válida.");
  }

  const title = field(formData, "title");
  if (title.length < 3) throw new Error("Título muito curto.");

  const body = field(formData, "body");
  // Aceita body vazio na importação — editor pode ter colado só foto/título
  // e vai rodar AI ou redigir depois. Mínimo simbólico só pra não quebrar
  // o constraint NOT NULL.
  const safeBody = body.trim().length >= 1 ? body : "(rascunho importado — preencha o corpo)";

  const lede = field(formData, "lede") || null;
  const heroImageUrl = field(formData, "hero_image_url") || null;
  const heroImageCredit = field(formData, "hero_image_credit") || null;
  const heroImageAlt = field(formData, "hero_image_alt") || title.slice(0, 200);
  const byline = field(formData, "byline") || null;
  const cities = listField(formData, "cities");

  const slug = await uniqueArticleSlug(supabase, title);

  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug,
      editoria,
      title,
      lede,
      body: safeBody,
      byline,
      hero_image_url: heroImageUrl,
      hero_image_credit: heroImageCredit,
      hero_image_alt: heroImageAlt,
      cities,
      status: "draft",
      source_url: sourceUrl,
    })
    .select("id")
    .single();
  if (error) throw new Error("Não consegui salvar: " + error.message);

  await audit(supabase, {
    entity_type: "article",
    entity_id: data!.id as string,
    action: "import_from_url",
    actor: user!.email ?? user!.id,
    metadata: { source_url: sourceUrl, editoria, hero: !!heroImageUrl },
  });

  revalidatePath("/admin", "layout");
  redirect(`/admin/materias/${data!.id}`);
}
