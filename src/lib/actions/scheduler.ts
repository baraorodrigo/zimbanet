"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";
import { runSchedulerJob, startScheduler, stopScheduler } from "@/lib/radar";

async function ensureStaff() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");
  return { supabase, actor: user!.email ?? user!.id };
}

async function audit(
  supabase: ReturnType<typeof createClient>,
  args: { action: string; actor: string; metadata?: Record<string, unknown> },
) {
  await supabase.from("audit_log").insert({
    entity_type: "scheduler",
    entity_id: args.action,
    action: args.action,
    actor: args.actor,
    agent: "admin_ui",
    metadata: args.metadata ?? {},
  });
}

export async function triggerSchedulerStart(): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const r = await startScheduler();
  await audit(supabase, {
    action: "scheduler_start",
    actor,
    metadata: { running: r.running, jobs: r.jobs ?? [] },
  });
  revalidatePath("/admin/autonomo");
}

export async function triggerSchedulerStop(): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  await stopScheduler();
  await audit(supabase, {
    action: "scheduler_stop",
    actor,
  });
  revalidatePath("/admin/autonomo");
}

export async function triggerSchedulerRunJob(formData: FormData): Promise<void> {
  const { supabase, actor } = await ensureStaff();
  const jobId = String(formData.get("job_id") ?? "").trim();
  if (!jobId) throw new Error("job_id ausente.");
  const r = await runSchedulerJob(jobId);
  await audit(supabase, {
    action: "scheduler_run_job",
    actor,
    metadata: { job_id: jobId, ok: r.ok, reason: r.reason ?? null },
  });
  revalidatePath("/admin/autonomo");
  revalidatePath("/admin");
}
