import { createClient } from "@/lib/supabase/server";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zimbanet.com";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toUTCString();
}

type FeedRow = {
  id: string;
  slug: string;
  editoria: EditoriaSlug;
  title: string;
  lede: string | null;
  subtitle: string | null;
  byline: string | null;
  hero_image_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  created_at: string;
  tags: string[] | null;
};

export async function GET() {
  let rows: FeedRow[] = [];
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("articles")
      .select(
        "id, slug, editoria, title, lede, subtitle, byline, hero_image_url, published_at, updated_at, created_at, tags",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    rows = (data ?? []) as FeedRow[];
  } catch {
    rows = [];
  }

  const lastBuild = rows[0]?.updated_at ?? rows[0]?.published_at ?? new Date().toISOString();

  const items = rows
    .map((r) => {
      const url = `${SITE}/${r.editoria}/${r.slug}`;
      const desc = r.lede ?? r.subtitle ?? "";
      const enclosure = r.hero_image_url
        ? `<enclosure url="${escapeXml(r.hero_image_url)}" type="image/jpeg" />`
        : "";
      const categories = [
        EDITORIA_LABEL[r.editoria] ?? r.editoria,
        ...(r.tags ?? []),
      ]
        .map((c) => `<category>${escapeXml(c)}</category>`)
        .join("");
      const author = r.byline ? `<dc:creator>${escapeXml(r.byline)}</dc:creator>` : "";
      return `
    <item>
      <title>${escapeXml(r.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${rfc822(r.published_at ?? r.created_at)}</pubDate>
      <description>${escapeXml(desc)}</description>
      ${author}
      ${categories}
      ${enclosure}
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>ZIMBANET — Imbituba conectada</title>
    <link>${SITE}</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Notícias e comunidade de Imbituba, Garopaba, Laguna, Imaruí, Paulo Lopes e região.</description>
    <language>pt-BR</language>
    <copyright>© ZIMBANET</copyright>
    <lastBuildDate>${rfc822(lastBuild)}</lastBuildDate>
    <ttl>15</ttl>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900",
    },
  });
}
