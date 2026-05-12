"use client";

import { useState, useTransition } from "react";
import { deleteMuralPost } from "@/lib/actions/my-account";
import type { MyMuralPost } from "@/lib/db/my-account";

const STATUS_BADGE: Record<MyMuralPost["moderation_status"], string> = {
  pending: "bg-zimba-gold/20 text-navy",
  approved: "bg-eco-green text-off-white",
  rejected: "bg-alert-red/15 text-alert-red",
};

const STATUS_LABEL: Record<MyMuralPost["moderation_status"], string> = {
  pending: "Em revisão",
  approved: "Publicado",
  rejected: "Recusado",
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function MuralRow({ post }: { post: MyMuralPost }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm("Apagar este post? Não dá pra desfazer.")) return;
    setError(null);
    const fd = new FormData();
    fd.set("id", post.id);
    start(async () => {
      const res = await deleteMuralPost(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <article className="border border-border-subtle bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-[9px] uppercase tracking-[0.22em] font-bold px-2 py-0.5 ${STATUS_BADGE[post.moderation_status]}`}
        >
          {STATUS_LABEL[post.moderation_status]}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-navy/50">
          {post.bairro} · {relativeTime(post.created_at)}
        </span>
        {post.is_anon && (
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-navy/50">
            · anônimo
          </span>
        )}
      </div>

      <p className="font-serif text-fs-15 text-navy leading-snug whitespace-pre-line line-clamp-4">
        {post.body}
      </p>

      <div className="flex items-center gap-4 mt-3 text-[10px] uppercase tracking-[0.18em] font-semibold text-navy/50">
        <span>{post.likes_count} curtidas</span>
        <span>{post.comments_count} comentários</span>
      </div>

      {error && <p className="mt-2 text-fs-12 text-alert-red">{error}</p>}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-[10px] uppercase tracking-[0.22em] font-bold px-3 h-9 border border-alert-red/40 text-alert-red hover:bg-alert-red hover:text-off-white transition-colors disabled:opacity-50"
        >
          Apagar
        </button>
      </div>
    </article>
  );
}
