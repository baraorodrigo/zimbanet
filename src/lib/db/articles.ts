import { createClient } from "@/lib/supabase/server";
import { EDITORIA_LABEL, type ArticleRow, type EditoriaSlug } from "./types";
import type { Article, Editoria } from "@/lib/mock-data";

export type ArticleView = Article;

// View Model usado pela UI — combina campos do banco + fallback do mock.
function toViewArticle(row: ArticleRow): Article {
  const label = EDITORIA_LABEL[row.editoria] as Editoria;
  return {
    id: row.id,
    editoria: label,
    title: row.title,
    lede: row.lede ?? undefined,
    image: row.hero_image_url ?? undefined,
    imageAlt: row.hero_image_alt ?? undefined,
    author: row.byline ?? undefined,
    publishedAt: relativeTime(row.published_at ?? row.created_at),
    slug: row.slug,
    isBreaking: row.is_breaking ?? false,
  };
}

// Em PT-BR — "há X min/h/d" / "ontem". Suficiente pra UI inicial.
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

type FetchOpts = {
  limit?: number;
  offset?: number;
  editoria?: EditoriaSlug;
  exclude?: string[];
  cidade?: string;
  since?: Date;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// Helper: query articles publicados; vazio se a tabela ainda não existe.
async function fetchPublished(opts: FetchOpts = {}): Promise<Article[]> {
  try {
    const supabase = createClient();
    const limit = opts.limit ?? 12;
    const offset = Math.max(0, opts.offset ?? 0);
    let q = supabase
      .from("articles")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (opts.editoria) q = q.eq("editoria", opts.editoria);
    if (opts.cidade) q = q.contains("cities", [opts.cidade]);
    if (opts.since) q = q.gte("published_at", opts.since.toISOString());
    if (opts.exclude?.length) q = q.not("id", "in", `(${opts.exclude.join(",")})`);

    const { data, error } = await q;
    if (error) {
      // 42P01 = tabela ainda não existe no Supabase (schema bridge não aplicado)
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return [];
      }
      console.warn("[articles] supabase error", error.message);
      return [];
    }
    return (data ?? []).map((r) => toViewArticle(r as ArticleRow));
  } catch (e) {
    const msg = (e as Error).message;
    // "Dynamic server usage" é o Next bailing out do prerender estático — esperado
    // depois que o header passou a ler cookies(). Não é erro real.
    if (!/Dynamic server usage|DYNAMIC_SERVER_USAGE/i.test(msg)) {
      console.warn("[articles] fetch failed", msg);
    }
    return [];
  }
}

// Conta artigos publicados com filtros opcionais. Para paginação.
async function countPublished(opts: {
  editoria?: EditoriaSlug;
  cidade?: string;
  tag?: string;
  q?: string;
}): Promise<number> {
  try {
    const supabase = createClient();
    let qb = supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("status", "published");
    if (opts.editoria) qb = qb.eq("editoria", opts.editoria);
    if (opts.cidade) qb = qb.contains("cities", [opts.cidade]);
    if (opts.tag) qb = qb.contains("tags", [opts.tag]);
    if (opts.q) {
      const escaped = opts.q.replace(/[%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      qb = qb.or(`title.ilike.${pattern},lede.ilike.${pattern},subtitle.ilike.${pattern}`);
    }
    const { count, error } = await qb;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// Compõe a homepage a partir do Supabase. Sem fallback de mock — seções
// vazias renderizam estado vazio. Pega articles publicados + breaking real.
//
// Curadoria: se o editor marcou `is_cover=true` numa matéria, ela vira a
// capa (heroMain). Idem `is_highlight=true` pros 3 secundários. Quando
// nada foi marcado, cai no automático por data (comportamento legado).
export async function getHomepageData() {
  const { getMuralPostsWithFallback, getBazarItemsWithFallback } = await import("./community");

  const [real, breaking, manualCover, manualHighlights, muralResult, bazarResult] = await Promise.all([
    fetchPublished({ limit: 30 }),
    fetchBreaking(),
    fetchManualCover(),
    fetchManualHighlights(),
    getMuralPostsWithFallback(8),
    getBazarItemsWithFallback(8),
  ]);

  const muralPosts = muralResult.posts;
  const bazarItems = bazarResult.items;

  // Capa: manual primeiro; senão pega a mais recente do pool.
  const realById = new Map(real.map((a) => [a.id, a]));
  let main: Article | null = manualCover ?? null;
  let rest = real;
  if (main) {
    rest = real.filter((a) => a.id !== main!.id);
  } else {
    main = real[0] ?? null;
    rest = real.slice(1);
  }

  // Destaques: manualHighlights primeiro (já em ordem de publicação),
  // completa com mais recentes do pool até 3.
  const highlightIds = new Set(manualHighlights.map((a) => a.id));
  const manualPicks = manualHighlights.filter((a) => a.id !== main?.id).slice(0, 3);
  let secondary: Article[] = [...manualPicks];
  if (secondary.length < 3) {
    const autoFill = rest
      .filter((a) => !highlightIds.has(a.id) && a.id !== main?.id)
      .slice(0, 3 - secondary.length);
    secondary = [...secondary, ...autoFill];
  }
  // Hidrata destaques manuais que não vieram no pool dos 30 mais recentes
  // (caso o editor fixe uma matéria mais antiga).
  secondary = secondary.map((a) => realById.get(a.id) ?? a);

  const usedIds = new Set([main?.id, ...secondary.map((a) => a.id)].filter(Boolean));
  const remaining = rest.filter((a) => !usedIds.has(a.id));

  // Filtra editorias específicas; se ficar vazio, completa com remaining geral
  // pra não deixar buraco visual na home.
  function fillSection(filterFn: (a: Article) => boolean, used: Set<string>) {
    const direct = remaining.filter(filterFn).slice(0, 4);
    if (direct.length >= 4) {
      direct.forEach((a) => used.add(a.id));
      return direct;
    }
    const need = 4 - direct.length;
    const directIds = new Set(direct.map((a) => a.id));
    const fillers = remaining
      .filter((a) => !directIds.has(a.id) && !used.has(a.id) && !filterFn(a))
      .slice(0, need);
    const merged = [...direct, ...fillers];
    merged.forEach((a) => used.add(a.id));
    return merged;
  }

  const sectionUsed = new Set<string>();
  const articlesCidade = fillSection((a) => a.editoria === "CIDADE", sectionUsed);
  const articlesPraias = fillSection((a) => a.editoria === "PRAIAS", sectionUsed);

  return {
    breakingNews: breaking,
    heroMain: main ?? null,
    heroSecondary: secondary,
    articlesCidade,
    articlesPraias,
    muralPosts,
    bazarItems,
  };
}

// Capa fixada manualmente — `is_cover=true`. Só 1, mais recente (a action
// garante exclusividade, mas se algo escapar, ordem por published_at desc
// resolve sozinha). Se a matéria fixada não estiver publicada, ignora.
async function fetchManualCover(): Promise<Article | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("status", "published")
      .eq("is_cover", true)
      .order("published_at", { ascending: false })
      .limit(1);
    const row = (data ?? [])[0];
    return row ? toViewArticle(row as ArticleRow) : null;
  } catch {
    return null;
  }
}

// Destaques fixados — `is_highlight=true`, até 3 mais recentes.
async function fetchManualHighlights(): Promise<Article[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("status", "published")
      .eq("is_highlight", true)
      .order("published_at", { ascending: false })
      .limit(3);
    return (data ?? []).map((r) => toViewArticle(r as ArticleRow));
  } catch {
    return [];
  }
}

// Breaking ativo: artigo com is_breaking=true mais recente; se nenhum, null.
async function fetchBreaking(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("articles")
      .select("title, kicker")
      .eq("status", "published")
      .eq("is_breaking", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ title: string; kicker: string | null }>();
    if (!data) return null;
    return data.kicker ?? data.title;
  } catch {
    return null;
  }
}

// Últimas matérias publicadas — usado pela sidebar e ticker. Sem filtro
// de editoria. `exclude` evita repetir o que já está na home. `since`
// limita a janela (ex.: ticker da home pega só publicadas hoje).
export async function getLatestArticles(
  opts: { limit?: number; exclude?: string[]; since?: Date } = {},
): Promise<Article[]> {
  return fetchPublished({
    limit: opts.limit ?? 5,
    exclude: opts.exclude ?? [],
    since: opts.since,
  });
}

// Meia-noite de hoje no fuso de Imbituba (America/Sao_Paulo). Usado pra
// filtrar "matérias do dia" sem depender do horário do servidor.
export function startOfTodayInBrazil(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = fmt.format(new Date()); // "2026-05-11"
  return new Date(`${ymd}T00:00:00-03:00`);
}

export async function getArticleBySlug(slug: string): Promise<ArticleRow | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) return null;
    return data as ArticleRow | null;
  } catch {
    return null;
  }
}

// Listing por editoria — Supabase puro (estado vazio se não houver matérias).
export async function getArticlesByEditoria(
  editoria: EditoriaSlug,
  opts: { limit?: number; offset?: number; excludeId?: string; cidade?: string } = {},
): Promise<Article[]> {
  return fetchPublished({
    editoria,
    limit: opts.limit ?? 24,
    offset: opts.offset,
    exclude: opts.excludeId ? [opts.excludeId] : [],
    cidade: opts.cidade,
  });
}

// Versão paginada: artigos + contagem total. Pra renderizar /[editoria] com
// "página X de Y". Não exclui id — paginação é independente de "matéria atual".
export async function getArticlesByEditoriaPaginated(
  editoria: EditoriaSlug,
  opts: { page?: number; pageSize?: number; cidade?: string } = {},
): Promise<Paginated<Article>> {
  const pageSize = Math.max(1, opts.pageSize ?? 24);
  const page = Math.max(1, opts.page ?? 1);
  const offset = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    fetchPublished({ editoria, limit: pageSize, offset, cidade: opts.cidade }),
    countPublished({ editoria, cidade: opts.cidade }),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Distintas cidades em matérias publicadas de uma editoria — pra renderizar
// chips de filtro. Limitado a 12 mais recentes pra UI não estourar.
export async function getCidadesEmEditoria(
  editoria: EditoriaSlug,
): Promise<string[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("articles")
      .select("cities")
      .eq("status", "published")
      .eq("editoria", editoria)
      .order("published_at", { ascending: false })
      .limit(200);
    const set = new Set<string>();
    for (const row of data ?? []) {
      const cities = (row as { cities?: string[] | null }).cities ?? [];
      for (const c of cities) {
        const k = c.trim();
        if (k) set.add(k);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, 12);
  } catch {
    return [];
  }
}

// Artigo individual — Supabase. Sem fallback pra mock.
export async function getArticleViewBySlug(
  slug: string,
): Promise<{ row: ArticleRow | null; view: Article | null }> {
  const row = await getArticleBySlug(slug);
  if (row) return { row, view: toViewArticle(row) };
  return { row: null, view: null };
}

// Lista artigos publicados com a tag exata (case-sensitive — tags vêm
// normalizadas no Supabase). Vazio se tabela não existe ou tag não encontrada.
export async function getArticlesByTag(
  tag: string,
  opts: { limit?: number; offset?: number } | number = 30,
): Promise<Article[]> {
  const limit = typeof opts === "number" ? opts : (opts.limit ?? 30);
  const offset = typeof opts === "number" ? 0 : Math.max(0, opts.offset ?? 0);
  const t = tag.trim();
  if (!t) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("status", "published")
      .contains("tags", [t])
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      if (error.code === "42P01") return [];
      console.warn("[getArticlesByTag]", error.message);
      return [];
    }
    return (data ?? []).map((r) => toViewArticle(r as ArticleRow));
  } catch (e) {
    const msg = (e as Error).message;
    if (!/Dynamic server usage|DYNAMIC_SERVER_USAGE/i.test(msg)) {
      console.warn("[getArticlesByTag] fetch failed", msg);
    }
    return [];
  }
}

export async function getArticlesByTagPaginated(
  tag: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<Paginated<Article>> {
  const pageSize = Math.max(1, opts.pageSize ?? 24);
  const page = Math.max(1, opts.page ?? 1);
  const offset = (page - 1) * pageSize;
  const t = tag.trim();
  if (!t) {
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }
  const [items, total] = await Promise.all([
    getArticlesByTag(t, { limit: pageSize, offset }),
    countPublished({ tag: t }),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Origem (raw_items.url) de uma ou várias matérias — caminho:
// articles.scored_item_id → scored_items.raw_item_id → raw_items.url
// Retorna Map<articleId, {url, host}> só pros que têm origem rastreável.
export async function getArticleSourceUrls(
  articleIds: string[],
): Promise<Map<string, { url: string; host: string | null }>> {
  const result = new Map<string, { url: string; host: string | null }>();
  if (!articleIds.length) return result;
  try {
    const supabase = createClient();
    const { data: articles } = await supabase
      .from("articles")
      .select("id, scored_item_id, source_url")
      .in("id", articleIds);
    const scoredToArticle = new Map<string, string>();
    // Matérias importadas manualmente já têm source_url direto — pega esse
    // primeiro e só consulta scored_items/raw_items pras que vieram do radar.
    for (const a of (articles ?? []) as {
      id: string;
      scored_item_id: string | null;
      source_url: string | null;
    }[]) {
      if (a.source_url) {
        result.set(a.id, { url: a.source_url, host: hostnameOf(a.source_url) });
      } else if (a.scored_item_id) {
        scoredToArticle.set(a.scored_item_id, a.id);
      }
    }
    if (!scoredToArticle.size) return result;

    const { data: scored } = await supabase
      .from("scored_items")
      .select("id, raw_item_id")
      .in("id", Array.from(scoredToArticle.keys()));
    const rawToArticle = new Map<string, string>();
    for (const s of (scored ?? []) as { id: string; raw_item_id: string }[]) {
      const articleId = scoredToArticle.get(s.id);
      if (articleId && s.raw_item_id) rawToArticle.set(s.raw_item_id, articleId);
    }
    if (!rawToArticle.size) return result;

    const { data: raws } = await supabase
      .from("raw_items")
      .select("id, url")
      .in("id", Array.from(rawToArticle.keys()));
    for (const r of (raws ?? []) as { id: string; url: string | null }[]) {
      const articleId = rawToArticle.get(r.id);
      if (articleId && r.url) {
        result.set(articleId, { url: r.url, host: hostnameOf(r.url) });
      }
    }
    return result;
  } catch {
    return result;
  }
}

export async function getArticleSourceUrl(
  articleId: string,
): Promise<{ url: string; host: string | null } | null> {
  const map = await getArticleSourceUrls([articleId]);
  return map.get(articleId) ?? null;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Lista todas tags ativas (de matérias publicadas) com contagem.
export async function getTopTags(limit = 30): Promise<{ tag: string; count: number }[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("articles")
      .select("tags")
      .eq("status", "published")
      .limit(500);
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const tags = (row as { tags?: string[] | null }).tags ?? [];
      for (const t of tags) {
        const k = t.trim();
        if (!k) continue;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// Busca textual simples: ilike em title/lede/subtitle. Sem full-text por enquanto —
// quando volume justificar, migrar pra tsvector + trigram.
export async function searchArticles(
  query: string,
  opts: { limit?: number; offset?: number } | number = 30,
): Promise<Article[]> {
  const limit = typeof opts === "number" ? opts : (opts.limit ?? 30);
  const offset = typeof opts === "number" ? 0 : Math.max(0, opts.offset ?? 0);
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const supabase = createClient();
    const escaped = q.replace(/[%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("status", "published")
      .or(`title.ilike.${pattern},lede.ilike.${pattern},subtitle.ilike.${pattern}`)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      if (error.code === "42P01") return [];
      console.warn("[searchArticles]", error.message);
      return [];
    }
    return (data ?? []).map((r) => toViewArticle(r as ArticleRow));
  } catch (e) {
    const msg = (e as Error).message;
    if (!/Dynamic server usage|DYNAMIC_SERVER_USAGE/i.test(msg)) {
      console.warn("[searchArticles] fetch failed", msg);
    }
    return [];
  }
}

export async function searchArticlesPaginated(
  query: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<Paginated<Article>> {
  const pageSize = Math.max(1, opts.pageSize ?? 24);
  const page = Math.max(1, opts.page ?? 1);
  const offset = (page - 1) * pageSize;
  const q = query.trim();
  if (q.length < 2) {
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }
  const [items, total] = await Promise.all([
    searchArticles(q, { limit: pageSize, offset }),
    countPublished({ q }),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
