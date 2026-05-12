"use server";

// Server actions pra config de slots de IA. Cada slot tem:
//   slot:{slot}:model  -> id do modelo escolhido (do catálogo)
//   slot:{slot}:key    -> chave da API daquele provider
//
// Persiste em app_settings (Supabase, RLS service_role-only). Resolver
// em src/lib/ai/resolve.ts lê daqui em runtime — admin rotaciona pela
// UI sem deploy/restart.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isAdmin } from "@/lib/auth/admin";
import {
  SLOTS,
  type SlotId,
  findModelEntry,
} from "@/lib/ai/catalog";

export type SlotConfig = {
  slot: SlotId;
  label: string;
  description: string;
  options: Array<{ id: string; label: string; provider: string; keyHint: string; keyUrl: string }>;
  selectedModelId: string | null;
  selectedModelLabel: string | null;
  selectedKeyHint: string | null;
  selectedKeyUrl: string | null;
  selectedProvider: string | null;
  hasKey: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
};

function maskKey(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t.length <= 10) return "•".repeat(t.length);
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export async function listSlotsConfig(): Promise<SlotConfig[]> {
  const { user } = await requireAdmin();
  if (!isAdmin(user)) throw new Error("Só admin pode ver/editar config de IA.");

  const admin = createAdminClient();
  // Lê todos os slot:* de uma vez
  const allKeys = SLOTS.flatMap((s) => [`slot:${s.id}:model`, `slot:${s.id}:key`]);
  const { data } = await admin
    .from("app_settings")
    .select("key, value, updated_at")
    .in("key", allKeys);

  const rows = new Map<string, { value: string; updated_at: string }>();
  for (const r of data ?? []) {
    rows.set(r.key as string, {
      value: (r.value as string) ?? "",
      updated_at: (r.updated_at as string) ?? "",
    });
  }

  return SLOTS.map((s) => {
    const modelRow = rows.get(`slot:${s.id}:model`);
    const keyRow = rows.get(`slot:${s.id}:key`);
    const entry = modelRow?.value ? findModelEntry(s.id, modelRow.value) : null;
    return {
      slot: s.id,
      label: s.label,
      description: s.description,
      options: s.models.map((m) => ({
        id: m.id,
        label: m.label,
        provider: m.provider,
        keyHint: m.keyHint,
        keyUrl: m.keyUrl,
      })),
      selectedModelId: modelRow?.value ?? null,
      selectedModelLabel: entry?.label ?? null,
      selectedKeyHint: entry?.keyHint ?? null,
      selectedKeyUrl: entry?.keyUrl ?? null,
      selectedProvider: entry?.provider ?? null,
      hasKey: !!keyRow?.value,
      maskedKey: maskKey(keyRow?.value),
      updatedAt:
        (keyRow?.updated_at || modelRow?.updated_at || null) as string | null,
    };
  });
}

// Salva config do slot. Aceita:
//   slot      (obrigatório)
//   model     (obrigatório se action != "clear")
//   key       (opcional — se vazio, mantém a chave atual ou cai pro env)
//   action    "save" | "clear" | "clear_key"
export async function saveSlotConfig(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  if (!isAdmin(user)) throw new Error("Só admin pode editar config de IA.");

  const slotRaw = formData.get("slot");
  const action = String(formData.get("action") ?? "save");
  if (typeof slotRaw !== "string") throw new Error("Slot ausente.");
  if (!SLOTS.some((s) => s.id === slotRaw)) {
    throw new Error(`Slot "${slotRaw}" inválido.`);
  }
  const slot = slotRaw as SlotId;
  const admin = createAdminClient();

  // ── Limpar tudo do slot
  if (action === "clear") {
    await admin
      .from("app_settings")
      .delete()
      .in("key", [`slot:${slot}:model`, `slot:${slot}:key`]);
    revalidatePath("/admin/configuracoes");
    return;
  }

  // ── Limpar só a chave (mantém o modelo escolhido → cai pro env do provider)
  if (action === "clear_key") {
    await admin.from("app_settings").delete().eq("key", `slot:${slot}:key`);
    revalidatePath("/admin/configuracoes");
    return;
  }

  // ── Salvar
  const modelId = String(formData.get("model") ?? "").trim();
  const keyRaw = String(formData.get("key") ?? "").trim();

  if (!modelId) throw new Error("Escolha um modelo.");
  const entry = findModelEntry(slot, modelId);
  if (!entry) {
    throw new Error(`Modelo "${modelId}" não pertence ao slot "${slot}".`);
  }

  // Valida formato da chave SE veio chave. Se vazia, deixa quieta — o admin
  // pode estar só trocando o modelo sem rotacionar a chave (caso a chave
  // atual já seja do mesmo provider).
  if (keyRaw) {
    if (!entry.keyPattern.test(keyRaw)) {
      throw new Error(
        `Essa chave não parece ser do provider ${entry.provider} (formato esperado: ${entry.keyHint}).`,
      );
    }
  }

  const updatedAt = new Date().toISOString();
  await admin.from("app_settings").upsert(
    {
      key: `slot:${slot}:model`,
      value: modelId,
      updated_at: updatedAt,
      updated_by: user.id,
    },
    { onConflict: "key" },
  );

  if (keyRaw) {
    await admin.from("app_settings").upsert(
      {
        key: `slot:${slot}:key`,
        value: keyRaw,
        updated_at: updatedAt,
        updated_by: user.id,
      },
      { onConflict: "key" },
    );
  }

  revalidatePath("/admin/configuracoes");
}
