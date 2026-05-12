// Resolver de slot — lê `slot:{slot}:model` e `slot:{slot}:key` do
// app_settings, valida contra o catálogo, retorna { provider, modelId, apiKey }
// pronto pro dispatch usar.
//
// Fallback: se a chave não tiver no DB, tenta env por provider
// (ANTHROPIC_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, FAL_KEY).
// Útil em dev quando o .env.local tá preenchido.

import { createAdminClient } from "@/lib/supabase/admin";
import { findModelEntry, type Provider, type SlotId } from "./catalog";

export type ResolvedSlot = {
  slot: SlotId;
  provider: Provider;
  modelId: string;
  apiKey: string;
};

const ENV_KEY_BY_PROVIDER: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  fal: "FAL_KEY",
};

async function readSettings(keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", keys);
    for (const row of data ?? []) {
      const k = row.key as string;
      const v = row.value as string;
      if (typeof v === "string" && v.trim()) out.set(k, v.trim());
    }
  } catch {
    // DB indisponível em build/CI — cai pro env
  }
  return out;
}

export async function resolveSlot(slot: SlotId): Promise<ResolvedSlot> {
  const settings = await readSettings([`slot:${slot}:model`, `slot:${slot}:key`]);
  const modelChoice = settings.get(`slot:${slot}:model`);

  if (!modelChoice) {
    throw new Error(
      `Slot "${slot}" sem modelo escolhido. Vá em Admin → Configurações e escolha um modelo.`,
    );
  }

  const entry = findModelEntry(slot, modelChoice);
  if (!entry) {
    throw new Error(
      `Modelo "${modelChoice}" não está no catálogo do slot "${slot}". Pode ter sido removido — escolha outro em Configurações.`,
    );
  }

  // 1) chave do slot (DB) → 2) chave envar do provider
  let apiKey = settings.get(`slot:${slot}:key`);
  if (!apiKey) {
    const envName = ENV_KEY_BY_PROVIDER[entry.provider];
    const fromEnv = process.env[envName];
    if (fromEnv && fromEnv.trim()) apiKey = fromEnv.trim();
  }

  if (!apiKey) {
    throw new Error(
      `Slot "${slot}" usa ${entry.label} mas sem chave. Cole sua chave do ${entry.provider} em Configurações.`,
    );
  }

  return { slot, provider: entry.provider, modelId: entry.modelId, apiKey };
}

// Versão "best effort" pra UI mostrar status sem explodir.
export async function describeSlot(slot: SlotId): Promise<{
  slot: SlotId;
  modelChoice: string | null;
  modelLabel: string | null;
  provider: Provider | null;
  hasKey: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
}> {
  const map = await readSettingsWithMeta([`slot:${slot}:model`, `slot:${slot}:key`]);
  const modelRow = map.get(`slot:${slot}:model`);
  const keyRow = map.get(`slot:${slot}:key`);
  const modelChoice = modelRow?.value ?? null;
  const entry = modelChoice ? findModelEntry(slot, modelChoice) : null;
  return {
    slot,
    modelChoice,
    modelLabel: entry?.label ?? null,
    provider: entry?.provider ?? null,
    hasKey: !!keyRow?.value,
    maskedKey: keyRow?.value ? maskKey(keyRow.value) : null,
    updatedAt: keyRow?.updated_at ?? modelRow?.updated_at ?? null,
  };
}

async function readSettingsWithMeta(
  keys: string[],
): Promise<Map<string, { value: string; updated_at: string | null }>> {
  const out = new Map<string, { value: string; updated_at: string | null }>();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("key, value, updated_at")
      .in("key", keys);
    for (const row of data ?? []) {
      out.set(row.key as string, {
        value: (row.value as string) ?? "",
        updated_at: (row.updated_at as string) ?? null,
      });
    }
  } catch {
    /* segue vazio */
  }
  return out;
}

function maskKey(v: string): string {
  const t = v.trim();
  if (t.length <= 10) return "•".repeat(t.length);
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}
