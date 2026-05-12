"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createArticleComment } from "@/lib/actions/community";

type Comment = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
};

type Props = {
  articleId: string;
  articleSlug: string;
  isLoggedIn: boolean;
  initialComments: Comment[];
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function ArticleComments({
  articleId,
  articleSlug,
  isLoggedIn,
  initialComments,
}: Props) {
  const [list, setList] = useState<Comment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoggedIn) {
      window.location.href = `/login?next=/${articleSlug}`;
      return;
    }
    const value = draft.trim();
    if (value.length < 2) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("article_id", articleId);
      fd.set("article_slug", articleSlug);
      fd.set("body", value);
      const r = await createArticleComment(fd);
      if (r.ok) {
        setDraft("");
        setList((prev) => [
          ...prev,
          {
            id: r.data?.id ?? crypto.randomUUID(),
            author_name: "Você",
            body: value,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <section className="mt-12 border-t border-border-subtle pt-8">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="h-[3px] w-10 bg-zimba-gold" aria-hidden />
        <h2 className="font-display text-fs-22 font-bold text-navy">
          Comentários{" "}
          <span className="text-ink-400 tabular-nums font-normal">
            ({list.length})
          </span>
        </h2>
      </div>

      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="mb-7 flex gap-3 items-start">
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Deixa sua opinião…"
              className="w-full resize-none rounded-md border border-border-subtle bg-white px-4 py-3 text-fs-14 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
              disabled={pending}
            />
            {error && (
              <p className="mt-1 text-fs-12 text-alert-red">{error}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={pending || draft.trim().length < 2}
            className="bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-11 hover:bg-zimba-gold hover:text-navy transition-colors disabled:opacity-50"
          >
            {pending ? "..." : "Comentar"}
          </button>
        </form>
      ) : (
        <div className="mb-7 rounded-md border border-border-subtle bg-white p-5">
          <p className="text-fs-14 text-navy/80">
            <Link
              href={`/login?next=/${articleSlug}`}
              className="text-zimba-blue underline font-bold"
            >
              Entra
            </Link>{" "}
            pra deixar sua opinião nesta matéria.
          </p>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-fs-14 text-ink-500 italic">
          Nenhum comentário ainda. Solta o primeiro.
        </p>
      ) : (
        <ul className="space-y-5">
          {list.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-navy text-zimba-gold font-display font-black text-[12px] flex items-center justify-center shrink-0 tracking-[-0.02em]">
                {initials(c.author_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                  <span className="font-display font-bold text-navy">
                    {c.author_name}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-semibold">
                    {relTime(c.created_at)}
                  </span>
                </div>
                <p className="text-fs-15 text-navy/90 leading-relaxed">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
