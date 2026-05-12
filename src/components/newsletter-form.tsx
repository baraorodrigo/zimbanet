"use client";

import { useState, useTransition } from "react";
import { subscribeNewsletter } from "@/lib/actions/newsletter";

type Variant = "sidebar" | "footer";

export default function NewsletterForm({
  variant = "sidebar",
}: {
  variant?: Variant;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("email", trimmed);
      const r = await subscribeNewsletter(fd);
      if (r.ok) {
        setEmail("");
        setState({ ok: true, msg: "✓ Inscrição confirmada. Boas notícias chegando." });
      } else {
        setState({ ok: false, msg: r.error });
      }
    });
  }

  if (variant === "footer") {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2 max-w-md"
      >
        <input
          type="email"
          required
          placeholder="seu@email.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="flex-1 bg-white/10 border border-white/15 rounded-sm px-3 h-11 text-fs-14 text-off-white placeholder:text-off-white/40 outline-none focus:border-zimba-gold disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-zimba-gold text-navy h-11 px-5 rounded-sm text-fs-12 uppercase tracking-tag font-bold hover:bg-off-white transition-colors disabled:opacity-50"
        >
          {pending ? "..." : "Inscrever"}
        </button>
        {state && (
          <p
            className={`sm:absolute sm:translate-y-12 text-fs-13 ${
              state.ok ? "text-zimba-gold" : "text-alert-red"
            }`}
          >
            {state.msg}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="bg-navy text-off-white p-6 rounded-md">
      <h3 className="font-display font-bold text-fs-20 flex items-center gap-3 mb-1.5">
        <span aria-hidden className="block w-1 h-4 bg-zimba-gold" />
        Boletim diário
      </h3>
      <p className="text-fs-14 text-off-white/75 leading-relaxed">
        Receba as principais manchetes de Imbituba todos os dias às 7h, direto
        no seu e-mail.
      </p>
      {state?.ok ? (
        <p className="mt-4 text-fs-14 text-zimba-gold font-semibold">
          {state.msg}
        </p>
      ) : (
        <form className="mt-4 space-y-2" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            placeholder="seu@email.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="w-full bg-white/10 border border-white/15 rounded-sm px-3 h-10 text-fs-14 text-off-white placeholder:text-off-white/40 outline-none focus:border-zimba-gold disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-zimba-gold text-navy h-10 rounded-sm text-fs-13 uppercase tracking-tag font-bold hover:bg-gold-400 transition-colors disabled:opacity-50"
          >
            {pending ? "..." : "Quero receber"}
          </button>
          {state && !state.ok && (
            <p className="text-fs-12 text-alert-red mt-1">{state.msg}</p>
          )}
        </form>
      )}
    </div>
  );
}
