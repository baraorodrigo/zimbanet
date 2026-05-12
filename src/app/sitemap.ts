import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { EDITORIA_SLUGS } from "@/lib/db/types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zimbanet.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE}/zimbamilgrau`, lastModified: now, changeFrequency: "always", priority: 0.9 },
    { url: `${SITE}/bazardazimba`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE}/buscar`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/sobre`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/editorial`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/anuncie`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/pauta`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/newsletter`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const editoriaUrls: MetadataRoute.Sitemap = EDITORIA_SLUGS.map((slug) => ({
    url: `${SITE}/${slug}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: 0.7,
  }));

  let articleUrls: MetadataRoute.Sitemap = [];
  let tagUrls: MetadataRoute.Sitemap = [];
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("articles")
      .select("slug, editoria, updated_at, published_at, tags")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1000);
    const rows = (data ?? []) as Array<{
      slug: string;
      editoria: string;
      updated_at: string | null;
      published_at: string | null;
      tags: string[] | null;
    }>;
    articleUrls = rows.map((a) => ({
      url: `${SITE}/${a.editoria}/${a.slug}`,
      lastModified: new Date(a.updated_at ?? a.published_at ?? now),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
    const tagSet = new Set<string>();
    for (const r of rows) for (const t of r.tags ?? []) tagSet.add(t);
    tagUrls = Array.from(tagSet).slice(0, 200).map((t) => ({
      url: `${SITE}/tag/${encodeURIComponent(t)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    }));
  } catch {
    // sem Supabase, segue só com URLs estáticas
  }

  return [...staticUrls, ...editoriaUrls, ...articleUrls, ...tagUrls];
}
