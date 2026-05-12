import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const start = Date.now();
  let supabaseStatus: "ok" | "fail" = "fail";
  try {
    const supabase = createClient();
    const { error } = await supabase.from("articles").select("id").limit(1);
    if (!error) supabaseStatus = "ok";
  } catch {
    supabaseStatus = "fail";
  }
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    supabase: supabaseStatus,
    latencyMs: Date.now() - start,
  });
}
