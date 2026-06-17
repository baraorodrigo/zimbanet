import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { submitUrlToRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

// POST /api/ai/radar/submit-url  { url, note? }
// Hermes manda uma URL achada na web → radar raspa, pontua (Curador) e cai na Pauta.
// Rota estática tem precedência sobre /radar/[agent], então não conflita.
export const POST = withAgent(
  { tool: "submit_url_to_radar", action: "write", resource: "radar" },
  async (req) => {
    const body = (await req.json().catch(() => ({}))) as { url?: string; note?: string };
    const url = (body.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { ok: false, error: "url inválida (precisa começar com http:// ou https://)" },
        { status: 400 },
      );
    }
    const data = await submitUrlToRadar(url, body.note);
    return NextResponse.json({ ok: true, data });
  },
);
