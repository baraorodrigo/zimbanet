"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";
import {
  runAnalista,
  runCollectAll,
  runCollectSource,
  runCurador,
  runInvestigador,
  runPipelineAll,
  runRedator,
} from "@/lib/radar";

async function audit(
  supabase: ReturnType<typeof createClient>,
  args: {
    action: string;
    actor: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_log").insert({
    entity_type: "pipeline",
    entity_id: args.action,
    action: args.action,
    actor: args.actor,
    agent: "admin_ui",
    metadata: args.metadata ?? {},
  });
}

async function ensureStaff() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");
  return { supabase, actor: user!.email ?? user!.id };
}

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// === COLETA =================================================================

export async function triggerCollectAll(): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const r = await runCollectAll();
  await audit(supabase, {
    action: "collect_all",
    actor,
    metadata: { sources_run: r.sources_run, inserted: r.total_inserted },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/fontes");
  revalidatePath("/admin/pauta");
}

export async function triggerCollectSource(formData: FormData): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const sourceId = field(formData, "source_id");
  if (!sourceId) throw new Error("source_id ausente.");
  const r = await runCollectSource(sourceId);
  await audit(supabase, {
    action: "collect_source",
    actor,
    metadata: { source_id: sourceId, inserted: r.inserted ?? 0, error: r.error ?? null },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/fontes");
  revalidatePath("/admin/pauta");
}

// === AGENTES ================================================================

export async function triggerCurador(): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const r = await runCurador(20);
  await audit(supabase, {
    action: "run_curador",
    actor,
    metadata: { processed: r.processed, failed: r.failed },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/pauta");
}

export async function triggerInvestigador(): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const r = await runInvestigador(5);
  await audit(supabase, {
    action: "run_investigador",
    actor,
    metadata: { processed: r.processed, failed: r.failed },
  });
  revalidatePath("/admin");
}

export async function triggerRedator(): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const r = await runRedator(5);
  await audit(supabase, {
    action: "run_redator",
    actor,
    metadata: { processed: r.processed, failed: r.failed },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/fila");
}

export async function triggerAnalista(): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const r = await runAnalista(5);
  await audit(supabase, {
    action: "run_analista",
    actor,
    metadata: { processed: r.processed, failed: r.failed },
  });
  revalidatePath("/admin");
}

// === PIPELINE COMPLETO =====================================================

export async function triggerPipelineAll(): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const r = await runPipelineAll();
  await audit(supabase, {
    action: "run_pipeline_all",
    actor,
    metadata: {
      collect: r.collect,
      curador: r.curador,
      investigador: r.investigador,
      redator: r.redator,
    },
  });
  revalidatePath("/admin", "layout");
}
