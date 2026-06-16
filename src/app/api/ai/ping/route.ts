import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";

export const dynamic = "force-dynamic";

export const GET = withAgent({ tool: "ping" }, async (_req, { agent }) => {
  return NextResponse.json({ ok: true, data: { agent: agent.id, pong: true } });
});
