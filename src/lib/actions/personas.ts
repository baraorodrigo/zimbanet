"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/auth/admin";
import { slugify } from "@/lib/utils/slug";
import { generateText } from "@/lib/ai/text";
import { getPersonaById } from "@/lib/db/personas";
import { redistributeArticle } from "@/lib/radar";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function intField(formData: FormData, key: string, fallback: number): number {
  const v = field(formData, key);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function audit(args: {
  entity_id: string;
  action: string;
  actor: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    entity_type: "editorial_persona",
    entity_id: args.entity_id,
    action: args.action,
    actor: args.actor,
    agent: "admin_ui",
    metadata: args.metadata ?? {},
  });
}

type ParsedInput = {
  slug: string;
  name: string;
  headline: string | null;
  description: string | null;
  system_prompt: string;
  is_active: boolean;
  sort_order: number;
};

function parseInput(formData: FormData): ParsedInput | { error: string } {
  const name = field(formData, "name");
  if (name.length < 2 || name.length > 60) {
    return { error: "Nome precisa ter entre 2 e 60 caracteres." };
  }

  const rawSlug = field(formData, "slug");
  const slug = rawSlug ? slugify(rawSlug) : slugify(name);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Slug só pode ter letras minúsculas, números e hífen." };
  }

  const system_prompt = field(formData, "system_prompt");
  if (system_prompt.length < 40) {
    return {
      error:
        "Prompt-sistema muito curto. Mínimo 40 caracteres — descreva a voz da persona com profundidade.",
    };
  }
  if (system_prompt.length > 8000) {
    return { error: "Prompt-sistema acima de 8000 caracteres." };
  }

  return {
    slug,
    name,
    headline: field(formData, "headline") || null,
    description: field(formData, "description") || null,
    system_prompt,
    is_active: field(formData, "is_active") === "on",
    sort_order: intField(formData, "sort_order", 100),
  };
}

// === CREATE =================================================================

export async function createPersona(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const parsed = parseInput(formData);
  if ("error" in parsed) throw new Error(parsed.error);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("editorial_personas")
    .select("id")
    .eq("slug", parsed.slug)
    .maybeSingle();
  if (existing) {
    throw new Error(`Já existe persona com slug "${parsed.slug}". Use outro.`);
  }

  const { data, error } = await admin
    .from("editorial_personas")
    .insert({
      slug: parsed.slug,
      name: parsed.name,
      headline: parsed.headline,
      description: parsed.description,
      system_prompt: parsed.system_prompt,
      is_active: parsed.is_active,
      sort_order: parsed.sort_order,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createPersona]", error);
    throw new Error("Erro salvando: " + error.message);
  }

  await audit({
    entity_id: data.id as string,
    action: "create",
    actor: user!.email ?? user!.id,
    metadata: { slug: parsed.slug, name: parsed.name },
  });

  revalidatePath("/admin/personas");
  redirect("/admin/personas");
}

// === UPDATE =================================================================

export async function updatePersona(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) return { ok: false, error: "Sem permissão." };

  const parsed = parseInput(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const admin = createAdminClient();

  // Confere se o slug não colide com outra persona.
  const { data: clash } = await admin
    .from("editorial_personas")
    .select("id")
    .eq("slug", parsed.slug)
    .neq("id", id)
    .maybeSingle();
  if (clash) {
    return { ok: false, error: `Já existe outra persona com slug "${parsed.slug}".` };
  }

  const { error } = await admin
    .from("editorial_personas")
    .update({
      slug: parsed.slug,
      name: parsed.name,
      headline: parsed.headline,
      description: parsed.description,
      system_prompt: parsed.system_prompt,
      is_active: parsed.is_active,
      sort_order: parsed.sort_order,
    })
    .eq("id", id);

  if (error) {
    console.error("[updatePersona]", error);
    return { ok: false, error: "Erro salvando: " + error.message };
  }

  await audit({
    entity_id: id,
    action: "update",
    actor: user!.email ?? user!.id,
    metadata: { slug: parsed.slug, name: parsed.name, is_active: parsed.is_active },
  });

  revalidatePath("/admin/personas");
  revalidatePath(`/admin/personas/${id}`);
  return { ok: true };
}

// === TOGGLE =================================================================

export async function togglePersona(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("editorial_personas")
    .select("is_active")
    .eq("id", id)
    .maybeSingle<{ is_active: boolean }>();
  if (!current) throw new Error("Persona não encontrada.");

  const next = !current.is_active;
  const { error } = await admin
    .from("editorial_personas")
    .update({ is_active: next })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit({
    entity_id: id,
    action: next ? "activate" : "deactivate",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin/personas");
}

// === DELETE =================================================================

export async function deletePersona(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const id = field(formData, "id");
  if (!id) throw new Error("ID ausente.");

  const admin = createAdminClient();

  // Bloqueia delete se a persona já foi usada em alguma matéria — preserva histórico.
  const { count } = await admin
    .from("articles")
    .select("*", { count: "exact", head: true })
    .eq("persona_id", id);

  if ((count ?? 0) > 0) {
    throw new Error(
      `Essa persona já foi usada em ${count} matéria${count === 1 ? "" : "s"}. Desative em vez de apagar (pra preservar o histórico).`,
    );
  }

  const { error } = await admin
    .from("editorial_personas")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit({
    entity_id: id,
    action: "delete",
    actor: user!.email ?? user!.id,
  });

  revalidatePath("/admin/personas");
  redirect("/admin/personas");
}

// === REWRITE ARTICLE WITH PERSONA ===========================================

function extractJSON(raw: string): unknown {
  const direct = raw.trim();
  try {
    return JSON.parse(direct);
  } catch {}
  const fenced = direct.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }
  const firstBrace = direct.indexOf("{");
  const lastBrace = direct.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(direct.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  throw new Error("Saída da IA não veio em JSON válido.");
}

async function loadSourceContext(articleId: string): Promise<{
  url: string | null;
  title: string | null;
  body: string | null;
}> {
  const admin = createAdminClient();
  const { data: art } = await admin
    .from("articles")
    .select("scored_item_id")
    .eq("id", articleId)
    .maybeSingle<{ scored_item_id: string | null }>();
  if (!art?.scored_item_id) return { url: null, title: null, body: null };

  const { data: scored } = await admin
    .from("scored_items")
    .select("raw_item_id")
    .eq("id", art.scored_item_id)
    .maybeSingle<{ raw_item_id: string }>();
  if (!scored?.raw_item_id) return { url: null, title: null, body: null };

  const { data: raw } = await admin
    .from("raw_items")
    .select("url, title, body")
    .eq("id", scored.raw_item_id)
    .maybeSingle<{ url: string | null; title: string | null; body: string | null }>();
  return {
    url: raw?.url ?? null,
    title: raw?.title ?? null,
    body: raw?.body ?? null,
  };
}

export async function rewriteArticleWithPersona(
  articleId: string,
  personaId: string,
  angle?: string,
): Promise<ActionResult<{ title: string; socialRegenerated: boolean; socialError?: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) return { ok: false, error: "Sem permissão." };

  const admin = createAdminClient();

  const { data: article, error: artErr } = await admin
    .from("articles")
    .select("id, editoria, kicker, title, subtitle, lede, body, byline, tags, cities")
    .eq("id", articleId)
    .maybeSingle();
  if (artErr || !article) {
    return { ok: false, error: "Matéria não encontrada." };
  }

  const persona = await getPersonaById(personaId);
  if (!persona) return { ok: false, error: "Persona não encontrada." };
  if (!persona.is_active) {
    return { ok: false, error: "Persona está pausada — ative antes de usar." };
  }

  const source = await loadSourceContext(articleId);
  const angleTrimmed = (angle ?? "").trim().slice(0, 600);

  const userPrompt = [
    `EDITORIA: ${article.editoria}`,
    `CIDADES: ${(article.cities ?? []).join(", ") || "—"}`,
    `TAGS: ${(article.tags ?? []).join(", ") || "—"}`,
    source.url ? `FONTE ORIGINAL: ${source.url}` : null,
    "",
    "VERSÃO ATUAL DA MATÉRIA:",
    `KICKER: ${article.kicker ?? "—"}`,
    `TÍTULO: ${article.title}`,
    `SUBTÍTULO: ${article.subtitle ?? "—"}`,
    `LEDE: ${article.lede ?? "—"}`,
    "CORPO:",
    article.body,
    "",
    source.title || source.body
      ? "CONTEXTO DA FONTE ORIGINAL (referência factual, não copiar redação):"
      : null,
    source.title ? `TÍTULO FONTE: ${source.title}` : null,
    source.body ? `CORPO FONTE:\n${source.body}` : null,
    "",
    angleTrimmed
      ? `ÂNGULO EXTRA DO EDITOR (instrução adicional pra essa reescrita específica): ${angleTrimmed}`
      : null,
    "",
    "TAREFA: reescreva a matéria do zero sob sua voz editorial. Mantenha os fatos.",
    "Devolva APENAS JSON válido com as keys: kicker, title, subtitle, lede, body, byline.",
    "SUBTÍTULO: 1 frase complementar ao título (até 180 caracteres). Pode vir vazio (\"\") se o título já entrega tudo.",
  ]
    .filter(Boolean)
    .join("\n");

  let aiResult;
  try {
    aiResult = await generateText({
      slot: "text_main",
      system: persona.system_prompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 3000,
      temperature: 0.7,
    });
  } catch (err) {
    console.error("[rewriteArticleWithPersona] generateText", err);
    return {
      ok: false,
      error: "Falha chamando a IA: " + (err instanceof Error ? err.message : String(err)),
    };
  }

  let parsed: {
    kicker?: string;
    title?: string;
    subtitle?: string;
    lede?: string;
    body?: string;
    byline?: string;
  };
  try {
    parsed = extractJSON(aiResult.text) as typeof parsed;
  } catch (err) {
    console.error("[rewriteArticleWithPersona] parse", err, aiResult.text);
    return { ok: false, error: "IA não devolveu JSON válido. Tente de novo." };
  }

  const title = (parsed.title ?? "").trim();
  const body = (parsed.body ?? "").trim();
  if (title.length < 5) {
    return { ok: false, error: "IA devolveu título vazio/curto." };
  }
  if (body.length < 50) {
    return { ok: false, error: "IA devolveu corpo curto demais." };
  }

  // subtitle vem na cascata também — se a IA devolver string vazia,
  // zeramos no DB (o portal cai pra `lede` automaticamente). Só
  // ignoramos a key se ela vier indefinida (modelo antigo).
  const subtitleNext =
    parsed.subtitle === undefined
      ? article.subtitle
      : parsed.subtitle.trim() || null;

  const { error: updErr } = await admin
    .from("articles")
    .update({
      kicker: parsed.kicker?.trim() || article.kicker,
      title,
      subtitle: subtitleNext,
      lede: parsed.lede?.trim() || null,
      body,
      byline: parsed.byline?.trim() || article.byline,
      persona_id: persona.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);

  if (updErr) {
    console.error("[rewriteArticleWithPersona] update", updErr);
    return { ok: false, error: "Erro salvando reescrita: " + updErr.message };
  }

  await admin.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "rewrite_with_persona",
    actor: user!.email ?? user!.id,
    agent: "admin_ui",
    metadata: {
      persona_id: persona.id,
      persona_slug: persona.slug,
      angle: angleTrimmed || null,
      model: aiResult.modelId,
      provider: aiResult.provider,
      tokens_in: aiResult.usage.input_tokens,
      tokens_out: aiResult.usage.output_tokens,
    },
  });

  // Cascata: a matéria mudou de voz, então as legendas do pacote social
  // ficam fora de sintonia. Roda o Distribuidor (radar) pra regerar
  // captions/hashtags com o novo corpo. Best-effort — se o radar estiver
  // fora, a reescrita do artigo já está salva e a gente só sinaliza no
  // resultado.
  let socialRegenerated = false;
  let socialError: string | undefined;
  try {
    const dist = await redistributeArticle(articleId);
    socialRegenerated = true;
    await admin.from("audit_log").insert({
      entity_type: "article",
      entity_id: articleId,
      action: "regenerate_social_pack_cascade",
      actor: user!.email ?? user!.id,
      agent: "admin_ui",
      metadata: {
        triggered_by: "rewrite_with_persona",
        channels: dist.channels,
        persisted_ids: dist.persisted_ids,
      },
    });
  } catch (err) {
    socialError = err instanceof Error ? err.message : String(err);
    console.warn("[rewriteArticleWithPersona] social cascade falhou", socialError);
  }

  revalidatePath("/admin/materias");
  revalidatePath(`/admin/materias/${articleId}`);
  revalidatePath(`/admin/materias/${articleId}/studio`);
  revalidatePath(`/admin/estudio/${articleId}`);
  revalidatePath("/admin/social");
  return { ok: true, data: { title, socialRegenerated, socialError } };
}
