// POST /api/social/render
// Renderiza um template social via Puppeteer, sobe pro bucket social-cards
// e (opcionalmente) atualiza social_posts.media_url.
//
// Body:
// {
//   format: "card-1080" | "story-1080x1920" | "banner-1200x630",
//   params: { kicker?, headline?, title?, subline?, editoria?, photo?, cta?, credit? },
//   social_post_id?: string,        // se vier, atualiza media_url + status="ready"
//   article_slug?: string           // só pra organizar key no Storage
// }
//
// Auth: header `x-render-token` deve bater com RENDER_API_TOKEN no .env.

import { NextResponse } from "next/server";
import { type Browser } from "puppeteer-core";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Em prod (VPS) usamos o chromium do sistema (instalado via apt no Dockerfile)
// apontado por PUPPETEER_EXECUTABLE_PATH. Fallback: @sparticuz/chromium quando
// PUPPETEER_EXECUTABLE_PATH não tá setado (ex: Vercel/serverless). Em dev,
// puppeteer (devDep) traz seu próprio Chromium.
async function getBrowser(): Promise<Browser> {
  const systemPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (systemPath) {
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      executablePath: systemPath,
      headless: true,
    }) as unknown as Promise<Browser>;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Promise<Browser>;
  }
  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  }) as unknown as Promise<Browser>;
}

type Format = "card-1080" | "story-1080x1920" | "banner-1200x630";

const VIEWPORTS: Record<Format, { width: number; height: number }> = {
  "card-1080": { width: 1080, height: 1080 },
  "story-1080x1920": { width: 1080, height: 1920 },
  "banner-1200x630": { width: 1200, height: 630 },
};

const BUCKET = "social-cards";

function originFromRequest(req: Request) {
  // Em dev, Next.js às vezes sobe em portas alternativas (3000/3001/3003).
  // Pegamos o host do próprio request pra evitar hardcode.
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function buildTemplateUrl(origin: string, format: Format, params: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") qs.set(k, String(v));
  }
  return `${origin}/social-template/${format}?${qs.toString()}`;
}

function slugifyForKey(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(req: Request) {
  // Auth simples via header — o radar/python passa esse token.
  // Em produção o token é obrigatório (fail-closed). Em dev, se a env não
  // estiver setada, a rota fica aberta pra facilitar testes locais.
  const expected = process.env.RENDER_API_TOKEN;
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !expected) {
    return NextResponse.json(
      { error: "server_misconfigured", detail: "RENDER_API_TOKEN ausente em produção" },
      { status: 500 },
    );
  }
  if (expected) {
    const got = req.headers.get("x-render-token");
    if (got !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: {
    format?: Format;
    params?: Record<string, string>;
    social_post_id?: string;
    article_slug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { format, params = {}, social_post_id, article_slug } = body;
  if (!format || !(format in VIEWPORTS)) {
    return NextResponse.json(
      { error: "invalid_format", expected: Object.keys(VIEWPORTS) },
      { status: 400 },
    );
  }

  const origin = originFromRequest(req);
  const targetUrl = buildTemplateUrl(origin, format, params);
  const viewport = VIEWPORTS[format];

  let browser: Browser | null = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 30_000 });

    // Garante que webfonts (Inter via next/font) terminaram de carregar.
    await page.evaluate(() => (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready);

    const buffer = (await page.screenshot({
      type: "png",
      omitBackground: false,
      clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    })) as Buffer;

    await browser.close();
    browser = null;

    const supabase = createAdminClient();

    const slugPart = article_slug ? slugifyForKey(article_slug) : "ad-hoc";
    const stamp = Date.now();
    const path = `${format}/${slugPart}-${stamp}.png`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: "storage_upload_failed", detail: uploadErr.message },
        { status: 500 },
      );
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const mediaUrl = pub.publicUrl;

    if (social_post_id) {
      const { error: updErr } = await supabase
        .from("social_posts")
        .update({ media_url: mediaUrl, status: "ready" })
        .eq("id", social_post_id);
      if (updErr) {
        return NextResponse.json(
          {
            url: mediaUrl,
            path,
            warning: "social_post_update_failed",
            detail: updErr.message,
          },
          { status: 207 },
        );
      }
    }

    return NextResponse.json({ url: mediaUrl, path, format, viewport });
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "render_failed", detail: message, target: targetUrl },
      { status: 500 },
    );
  }
}
