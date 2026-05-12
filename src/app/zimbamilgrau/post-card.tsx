"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleMuralLike, createMuralComment } from "@/lib/actions/community";

type Comment = {
  id: string;
  author_name: string;
  is_anon: boolean;
  body: string;
  created_at: string;
};

type Props = {
  id: string;
  author: string;
  bairro: string;
  postedAt: string;
  body: string;
  isAnon: boolean;
  likes: number;
  comments: number;
  initialLiked: boolean;
  isLoggedIn: boolean;
  initialComments?: Comment[];
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

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

export default function PostCard({
  id,
  author,
  bairro,
  postedAt,
  body,
  isAnon,
  likes,
  comments,
  initialLiked,
  isLoggedIn,
  initialComments = [],
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(likes);
  const [showComments, setShowComments] = useState(false);
  const [commentList, setCommentList] = useState<Comment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [commentPending, startCommentTransition] = useTransition();

  function handleLike() {
    if (!isLoggedIn) {
      window.location.href = `/login?next=/zimbamilgrau`;
      return;
    }
    const optimisticLiked = !liked;
    setLiked(optimisticLiked);
    setCount((c) => c + (optimisticLiked ? 1 : -1));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("post_id", id);
      const r = await toggleMuralLike(fd);
      if (r.ok && r.data) {
        setLiked(r.data.liked);
        setCount(r.data.count);
      } else if (!r.ok) {
        setLiked((prev) => !prev);
        setCount((c) => c + (optimisticLiked ? -1 : 1));
      }
    });
  }

  function handleComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoggedIn) {
      window.location.href = `/login?next=/zimbamilgrau`;
      return;
    }
    const value = draft.trim();
    if (value.length < 1) return;
    setCommentError(null);
    startCommentTransition(async () => {
      const fd = new FormData();
      fd.set("post_id", id);
      fd.set("body", value);
      const r = await createMuralComment(fd);
      if (r.ok) {
        setDraft("");
        setCommentList((prev) => [
          ...prev,
          {
            id: r.data?.id ?? crypto.randomUUID(),
            author_name: "Você",
            is_anon: false,
            body: value,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        setCommentError(r.error);
      }
    });
  }

  return (
    <li className="bg-white border border-border-subtle border-l-2 border-l-zimba-gold/60 hover:border-l-zimba-gold transition-colors">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-navy text-zimba-gold font-display font-black text-[15px] flex items-center justify-center shrink-0 tracking-[-0.02em]">
            {isAnon ? "?" : initials(author)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mb-1.5">
              <span className="font-display font-bold text-navy tracking-[-0.005em]">
                {isAnon ? "Anônimo" : author}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-gold-700">
                {bairro}
              </span>
              <span className="text-[10px] tracking-[0.18em] uppercase text-ink-400 font-semibold ml-auto">
                {postedAt}
              </span>
            </div>
            <p className="text-[15px] leading-[1.55] text-navy/90">{body}</p>
            <div className="mt-3 flex items-center gap-6 text-[12px] text-ink-500">
              <button
                type="button"
                onClick={handleLike}
                disabled={pending}
                className={`flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
                  liked ? "text-alert-red" : "hover:text-alert-red"
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={liked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={liked ? 0 : 2}
                >
                  <path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10z" />
                </svg>
                {count}
              </button>
              <button
                type="button"
                onClick={() => setShowComments((v) => !v)}
                className="flex items-center gap-1.5 hover:text-zimba-blue transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                {comments + (commentList.length - initialComments.length)}
              </button>
              <button
                type="button"
                className="ml-auto text-[10px] uppercase tracking-[0.28em] font-bold hover:text-navy transition-colors"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.share) {
                    navigator.share({ text: body, url: window.location.href }).catch(() => {});
                  }
                }}
              >
                Compartilhar
              </button>
            </div>
          </div>
        </div>
      </div>

      {showComments && (
        <div className="border-t border-border-subtle px-5 py-4 bg-off-white/60">
          {commentList.length === 0 ? (
            <p className="text-fs-13 text-ink-500 italic">Ninguém comentou ainda. Solta a primeira.</p>
          ) : (
            <ul className="space-y-3 mb-4">
              {commentList.map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-navy/10 text-navy font-display font-black text-[10px] flex items-center justify-center shrink-0">
                    {c.is_anon ? "?" : initials(c.author_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-display font-bold text-fs-13 text-navy">
                        {c.is_anon ? "Anônimo" : c.author_name}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-semibold">
                        {relTime(c.created_at)}
                      </span>
                    </div>
                    <p className="text-fs-13 text-navy/90 mt-0.5 leading-relaxed">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isLoggedIn ? (
            <form onSubmit={handleComment} className="flex gap-2 items-start">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                maxLength={600}
                placeholder="Comenta aí…"
                className="flex-1 resize-none rounded-md border border-border-subtle bg-white px-3 py-2 text-fs-13 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
                disabled={commentPending}
              />
              <button
                type="submit"
                disabled={commentPending || draft.trim().length < 1}
                className="bg-navy text-zimba-gold text-[10px] uppercase tracking-[0.22em] font-bold px-4 h-10 hover:bg-zimba-gold hover:text-navy transition-colors disabled:opacity-50"
              >
                {commentPending ? "..." : "Enviar"}
              </button>
            </form>
          ) : (
            <p className="text-fs-13 text-ink-500">
              <Link href="/login?next=/zimbamilgrau" className="text-zimba-blue underline font-bold">
                Entra
              </Link>{" "}
              pra comentar.
            </p>
          )}
          {commentError && <p className="mt-2 text-fs-12 text-alert-red">{commentError}</p>}
        </div>
      )}
    </li>
  );
}
