import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "../_components/header";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, { label: string; tone: "good" | "warn" | "bad" | "info" }> = {
  create_draft: { label: "rascunho criado", tone: "info" },
  create_published: { label: "publicado direto", tone: "good" },
  update: { label: "editado", tone: "info" },
  update_publish: { label: "editado e publicado", tone: "good" },
  approve_publish: { label: "aprovado e publicado", tone: "good" },
  reject: { label: "rejeitado", tone: "bad" },
  unpublish: { label: "despublicado", tone: "warn" },
  delete: { label: "apagado", tone: "bad" },
};

const TONE: Record<string, string> = {
  good: "bg-eco-green/10 text-eco-green",
  warn: "bg-zimba-blue/10 text-zimba-blue",
  bad: "bg-alert-red/10 text-alert-red",
  info: "bg-ink-100 text-ink-700",
};

type LogRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default async function AuditoriaPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, entity_type, entity_id, action, actor, agent, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (data ?? []) as LogRow[];

  return (
    <>
      <Header
        kicker="Histórico"
        title="Auditoria"
        sub={`${items.length} eventos recentes — quem fez o quê, quando. Útil pra rastrear edições e publicações.`}
      />

      {error && (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          {error.message}
        </div>
      )}

      <div className="mt-8">
        {items.length === 0 ? (
          <div className="rounded-md border-2 border-dashed border-border-subtle bg-white p-10 text-center">
            <p className="font-display font-black text-fs-20 text-navy">Sem registros ainda</p>
            <p className="mt-2 text-fs-14 text-ink-500 max-w-[44ch] mx-auto">
              Toda ação no painel (criar, editar, publicar, apagar) vai aparecer aqui.
            </p>
          </div>
        ) : (
          <ol className="relative border-l-2 border-border-subtle ml-3">
            {items.map((log) => {
              const meta = ACTION_LABEL[log.action] ?? { label: log.action, tone: "info" as const };
              const meta_metadata = log.metadata ?? {};
              const title = (meta_metadata as { title?: string }).title;
              const isArticle = log.entity_type === "article";
              return (
                <li key={log.id} className="relative pl-6 pb-6">
                  <span className="absolute -left-[7px] top-2 w-3 h-3 rounded-full bg-zimba-gold ring-4 ring-off-white" />
                  <div className="rounded-md border border-border-subtle bg-white p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-1 ${TONE[meta.tone]}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-fs-12 text-ink-500">{log.entity_type}</span>
                      <span className="text-fs-12 text-ink-400 ml-auto font-mono">
                        {new Date(log.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {title && (
                      <p className="mt-2 font-display font-bold text-fs-15 text-navy">
                        {isArticle ? (
                          <Link
                            href={`/admin/materias/${log.entity_id}`}
                            className="hover:text-zimba-blue"
                          >
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-fs-12 text-ink-500">
                      <span>
                        por <strong className="text-navy font-bold">{log.actor}</strong>
                      </span>
                      {log.agent && (
                        <span className="font-mono text-fs-11 text-ink-400">{log.agent}</span>
                      )}
                      {!title && (
                        <span className="font-mono text-fs-11 text-ink-400 truncate">
                          #{log.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
