// Server Component — lê audit_log do post atual e mostra timeline simples.
// Não rola undo de verdade ainda; o histórico já é suficiente pra dar
// visibilidade do que rolou no pacote.

import { createClient } from "@/lib/supabase/server";

type Props = {
  socialPostId: string;
};

const ACTION_LABEL: Record<string, { label: string; icon: string; tone: string }> = {
  edit_caption: { label: "Caption editada", icon: "✎", tone: "text-zimba-blue" },
  edit_hashtags: { label: "Hashtags editadas", icon: "#", tone: "text-zimba-blue" },
  switch_channel: { label: "Canal trocado", icon: "↔", tone: "text-ink-500" },
  generate_variations: { label: "4 variações IA", icon: "✦", tone: "text-zimba-gold" },
  apply_variation: { label: "Variação aplicada", icon: "✓", tone: "text-eco-green" },
  fetch_source_image: { label: "Fonte aplicada", icon: "⤓", tone: "text-eco-green" },
  upload_image: { label: "Upload aplicado", icon: "↑", tone: "text-eco-green" },
  auto_adapt_captions: { label: "Auto-adapt rodou", icon: "✶", tone: "text-zimba-gold" },
  approve_post: { label: "Aprovado", icon: "✓", tone: "text-eco-green" },
  dismiss_post: { label: "Descartado", icon: "✕", tone: "text-alert-red" },
  queue_image_regen: { label: "Regen enfileirada", icon: "⏳", tone: "text-ink-500" },
  reset_visual_slots: { label: "Slots resetados", icon: "↺", tone: "text-ink-500" },
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export async function HistoryPanel({ socialPostId }: Props) {
  const supabase = createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, actor, agent, metadata, created_at")
    .eq("entity_id", socialPostId)
    .order("created_at", { ascending: false })
    .limit(8);

  const entries = (data ?? []) as Array<{
    id: string;
    action: string;
    actor: string;
    agent: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;

  return (
    <section className="px-4 py-3 bg-white border-t border-border-subtle">
      <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold mb-2">
        Histórico
      </p>

      {entries.length === 0 ? (
        <p className="text-[11px] text-ink-500 leading-snug">
          Nenhuma ação registrada ainda. Edite a caption, gere variações ou aprove
          pra preencher essa timeline.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((e) => {
            const meta = ACTION_LABEL[e.action] ?? {
              label: e.action,
              icon: "·",
              tone: "text-ink-500",
            };
            const actor = e.actor.includes("@") ? e.actor.split("@")[0] : e.actor;
            return (
              <li
                key={e.id}
                className="flex items-start gap-2 text-[11px] border-l-2 border-border-subtle pl-2 py-0.5 hover:border-zimba-gold transition-colors"
              >
                <span className={`shrink-0 font-bold ${meta.tone}`} aria-hidden>
                  {meta.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-ink-700 font-medium">{meta.label}</span>
                  <span className="text-ink-400"> · {actor}</span>
                </span>
                <time
                  className="shrink-0 font-mono text-[10px] text-ink-400"
                  dateTime={e.created_at}
                  title={new Date(e.created_at).toLocaleString("pt-BR")}
                >
                  {relativeTime(e.created_at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
