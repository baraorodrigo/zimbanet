import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { runCurador, runInvestigador, runRedator, runPipelineAll } from "@/lib/radar";

export const dynamic = "force-dynamic";

// POST /api/ai/radar/{agent}?limit=5  → dispara um agente do radar.
// agent ∈ curador | investigador | redator | pipeline
export const POST = withAgent(
  { tool: "run_radar", action: "write", resource: "radar" },
  async (req, _ctx, route) => {
    const agent = route.params.agent;
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 5), 1), 50);

    let data: unknown;
    if (agent === "curador") data = await runCurador(limit);
    else if (agent === "investigador") data = await runInvestigador(limit);
    else if (agent === "redator") data = await runRedator(limit);
    else if (agent === "pipeline") data = await runPipelineAll();
    else {
      return NextResponse.json(
        { ok: false, error: `agente '${agent}' desconhecido (use curador|investigador|redator|pipeline)` },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, data });
  },
);
