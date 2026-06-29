// Compartilhado do Estúdio de mídia. SEM "use server" — Server Actions só podem
// EXPORTAR funções async; tipos e o helper requireStaff (importado pelos módulos
// de ação) moram aqui pra poderem ser re-usados entre eles.

import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";

export type GenResult = {
  variations: string[];
  prompt: string;
  used_redux: boolean;
};

export type ApplyResult = {
  mediaUrl: string;
  previous: string | null;
};

export type HeroVariationsResult =
  | { ok: true; urls: string[]; prompt: string; used_source: boolean; modelId: string; provider: string }
  | { ok: false; error: string };

export type PackItem = {
  scope: "social_post" | "article_hero";
  socialPostId?: string;
  channel?: string;
  format?: string;
  mediaUrl: string;
  size: string;
};

export type PackResult = {
  prompt: string;
  used_redux: boolean;
  items: PackItem[];
  errors: { scope: string; label: string; error: string }[];
};

export type TemplateResult = {
  applied: number;
  skipped: number;
  errors: { channel: string; format: string; error: string }[];
};

export async function requireStaff() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");
  return { supabase, user: user! };
}
