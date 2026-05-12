// Helper de envio de Web Push via VAPID — só roda em Node.
// Chamado após publicação de matéria com is_breaking=true.
//
// ENV obrigatórias:
//   VAPID_PUBLIC_KEY  — chave pública URL-safe Base64
//   VAPID_PRIVATE_KEY — chave privada URL-safe Base64
//   VAPID_SUBJECT     — mailto:... ou https://... (contato técnico)
//
// Tabela: push_subscribers(id, endpoint, p256dh, auth, editorias text[], active bool)

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  editorias: string[] | null;
};

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !sub) {
    console.warn("[push] VAPID env não configurada — pulando envio");
    return false;
  }
  webpush.setVapidDetails(sub, pub, priv);
  vapidConfigured = true;
  return true;
}

export type BreakingPayload = {
  title: string;
  body: string;
  url: string;
  editoria?: string;
  image?: string | null;
  tag?: string;
};

export async function sendBreakingPush(
  article: {
    id: string;
    title: string;
    lede: string | null;
    subtitle: string | null;
    editoria: string;
    slug: string;
    hero_image_url?: string | null;
  },
): Promise<{ sent: number; pruned: number }> {
  if (!ensureVapid()) return { sent: 0, pruned: 0 };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("push_subscribers")
    .select("id, endpoint, p256dh, auth, editorias")
    .eq("active", true);
  if (error) {
    console.warn("[push] subscribers fetch:", error.message);
    return { sent: 0, pruned: 0 };
  }
  const subs = (data ?? []) as SubRow[];
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zimbanet.com";
  const payload: BreakingPayload = {
    title: `🚨 BREAKING — ${article.title}`,
    body: article.lede ?? article.subtitle ?? "Notícia urgente em Imbituba.",
    url: `${SITE}/${article.editoria}/${article.slug}`,
    editoria: article.editoria,
    image: article.hero_image_url ?? null,
    tag: `breaking-${article.id}`,
  };
  const json = JSON.stringify(payload);

  let sent = 0;
  const deadEndpoints: string[] = [];

  await Promise.all(
    subs
      .filter((s) => !s.editorias?.length || s.editorias.includes(article.editoria))
      .map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            json,
            { TTL: 60 * 60 * 6 },
          );
          sent++;
        } catch (err) {
          const status =
            (err as { statusCode?: number }).statusCode ??
            (err as { status?: number }).status;
          if (status === 404 || status === 410) {
            deadEndpoints.push(s.endpoint);
          } else {
            console.warn("[push] send falhou", status, (err as Error).message);
          }
        }
      }),
  );

  if (deadEndpoints.length > 0) {
    await supabase
      .from("push_subscribers")
      .update({ active: false })
      .in("endpoint", deadEndpoints);
  }

  return { sent, pruned: deadEndpoints.length };
}
