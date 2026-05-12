// POST /api/push/subscribe
// Recebe a PushSubscription do navegador (VAPID) e persiste em push_subscribers.
// Idempotente: se o endpoint já existe, atualiza last_seen_at + reativa.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  editorias?: string[];
  user_agent?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const editorias = Array.isArray(body.editorias) ? body.editorias : [];
  const ua = body.user_agent || req.headers.get("user-agent") || null;

  const row = {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    editorias,
    user_agent: ua,
    active: true,
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("push_subscribers")
    .upsert(row, { onConflict: "endpoint" })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
