import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TickerMessage = {
  id: string;
  text: string;
  link: string | null;
  kicker: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// Mensagens ativas do ticker — usado no portal público (RLS libera leitura
// de is_active=true pra anon/authenticated). Ordenado por sort_order, depois
// pelas mais recentes.
export async function getActiveTickerMessages(): Promise<TickerMessage[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ticker_messages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) {
      if (error.code === "42P01") return [];
      console.warn("[ticker] read error", error.message);
      return [];
    }
    return (data ?? []) as TickerMessage[];
  } catch (e) {
    const msg = (e as Error).message;
    if (!/Dynamic server usage|DYNAMIC_SERVER_USAGE/i.test(msg)) {
      console.warn("[ticker] fetch failed", msg);
    }
    return [];
  }
}

// Todos os itens — usado no /admin/ticker. Vai pelo service_role.
export async function listAllTickerMessages(): Promise<TickerMessage[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ticker_messages")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as TickerMessage[];
  } catch {
    return [];
  }
}

export async function getTickerMessageById(id: string): Promise<TickerMessage | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ticker_messages")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as TickerMessage) ?? null;
  } catch {
    return null;
  }
}
