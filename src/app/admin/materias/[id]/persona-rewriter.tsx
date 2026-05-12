"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { rewriteArticleWithPersona } from "@/lib/actions/personas";
import type { EditorialPersonaRow } from "@/lib/db/types";

type Persona = Pick<
  EditorialPersonaRow,
  "id" | "slug" | "name" | "headline" | "description"
>;

export function PersonaRewriter({
  articleId,
  personas,
  currentPersonaId,
}: {
  articleId: string;
  personas: Persona[];
  currentPersonaId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string>(
    currentPersonaId ?? personas[0]?.id ?? "",
  );
  const [angle, setAngle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (personas.length === 0) {
    return (
      <section className="rounded-md border-2 border-dashed border-border-subtle bg-white p-5">
        <p className="text-fs-13 text-ink-500">
          Nenhuma persona ativa.{" "}
          <Link
            href="/admin/personas"
            className="font-bold text-navy underline-offset-2 hover:underline"
          >
            Criar/ativar uma persona →
          </Link>
        </p>
      </section>
    );
  }

  const selected = personas.find((p) => p.id === selectedId) ?? personas[0];
  const isCurrent = selected.id === currentPersonaId;

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await rewriteArticleWithPersona(
        articleId,
        selected.id,
        angle.trim() || undefined,
      );
      setConfirming(false);
      if (!res.ok) {
        setError(res.error);
      } else {
        const parts: string[] = [];
        parts.push(`✓ Matéria reescrita como "${selected.name}".`);
        if (res.data?.title) parts.push(`Novo título: "${res.data.title}".`);
        if (res.data?.socialRegenerated) {
          parts.push("Pacote social regenerado com a nova voz.");
        } else if (res.data?.socialError) {
          parts.push(
            "⚠ Pacote social NÃO foi regenerado (radar offline?). Use ↻ Regerar legendas no painel social.",
          );
        }
        setSuccess(parts.join(" "));
        setAngle("");
        router.refresh();
      }
    });
  }

  return (
    <section
      id="reescrever"
      className="rounded-md border-2 border-navy/15 bg-white p-5 shadow-z-1"
    >
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
            Voz da redação
          </p>
          <h2 className="font-display font-black text-fs-20 text-navy mt-0.5">
            Reescrever com persona
          </h2>
        </div>
        <Link
          href="/admin/personas"
          className="text-fs-12 text-ink-500 hover:text-navy"
        >
          gerenciar personas →
        </Link>
      </header>

      <p className="mt-2 text-fs-13 text-ink-700 leading-relaxed">
        Reescreve <strong>kicker, título, subtítulo, lede, corpo e byline</strong> sob a
        voz escolhida e em cascata regenera as <strong>legendas do pacote social</strong>.
        Mantém fatos e fonte. Sobrescreve a versão atual — abre na hora.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-1">
            Persona
          </span>
          <select
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={pending}
            className="w-full h-11 px-3 rounded-md border-2 border-border-subtle font-display font-bold text-fs-15 text-navy focus:outline-none focus:border-navy bg-off-white"
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === currentPersonaId ? "  · atual" : ""}
              </option>
            ))}
          </select>
        </label>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            className="h-11 px-5 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors disabled:opacity-50"
          >
            ✍️ Reescrever
          </button>
        ) : (
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="h-11 px-5 rounded-md bg-alert-red text-white font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {pending ? "Reescrevendo…" : "Confirmar — sobrescrever"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="h-11 px-4 rounded-md border border-border-subtle text-ink-700 font-bold text-fs-12 uppercase tracking-[0.18em] hover:border-navy hover:text-navy transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Ângulo extra — instrução livre pro modelo, opcional */}
      <label className="block mt-4">
        <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-1">
          Ângulo extra (opcional)
        </span>
        <textarea
          value={angle}
          onChange={(e) => setAngle(e.target.value.slice(0, 600))}
          disabled={pending}
          rows={2}
          placeholder='Ex: "puxar pra crítica ao prefeito" · "tom mais comunidade, menos formal" · "destacar impacto pros surfistas"'
          className="w-full px-3 py-2 rounded-md border-2 border-border-subtle text-fs-13 text-navy focus:outline-none focus:border-navy bg-off-white resize-y"
        />
        <span className="block text-fs-11 text-ink-400 mt-1">
          {angle.length}/600 · vira instrução extra junto da persona
        </span>
      </label>

      {/* Headline / descrição da persona escolhida */}
      <div className="mt-4 rounded-md bg-off-white border border-border-subtle p-3">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500">
          {selected.name}
          {isCurrent && (
            <span className="ml-2 text-eco-green normal-case tracking-normal">
              · persona atual da matéria
            </span>
          )}
        </p>
        {selected.headline && (
          <p className="mt-1 text-fs-14 text-navy font-bold leading-snug">
            {selected.headline}
          </p>
        )}
        {selected.description && (
          <p className="mt-1 text-fs-13 text-ink-700 leading-relaxed">
            {selected.description}
          </p>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {error}
        </div>
      )}
      {success && !error && (
        <div className="mt-3 rounded-md border border-eco-green bg-eco-green/5 p-3 text-fs-13 text-eco-green">
          {success}
        </div>
      )}
    </section>
  );
}
