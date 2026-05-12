"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCuratorRubric } from "@/lib/actions/curator";
import type { CuratorRubricRow } from "@/lib/db/types";

export default function CuradorForm({
  initial,
}: {
  initial: CuratorRubricRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSavedVersion(null);
    startTransition(async () => {
      const res = await updateCuratorRubric(formData);
      if (!res.ok) {
        setError(res.error);
      } else {
        setSavedVersion(res.data?.prompt_version ?? null);
        router.refresh();
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="grid gap-6 rounded-md border-2 border-border-subtle bg-white p-6"
    >
      {error && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {error}
        </div>
      )}
      {savedVersion && !error && (
        <div className="rounded-md border border-eco-green bg-eco-green/5 p-3 text-fs-13 text-eco-green">
          Salvo. Versão da rubrica agora é{" "}
          <strong>v{savedVersion}</strong>. Na próxima rodada do Curador,
          os ítens em backlog serão re-scoreados.
        </div>
      )}

      <Field
        label="Voz editorial (contexto da redação)"
        hint="Frase que descreve o ZIMBANET pro Curador. Não é regra — é o pano de fundo do que somos."
      >
        <textarea
          name="editorial_voice"
          rows={3}
          defaultValue={initial?.editorial_voice ?? ""}
          className="w-full px-3 py-2 rounded-md border-2 border-border-subtle text-fs-14 focus:outline-none focus:border-navy bg-off-white resize-y"
        />
      </Field>

      <Section
        title="O que é relevante"
        kicker="relevance_score"
        hint="Faixas 0.0 – 1.0. Liste os tipos de matéria por bandas de score. Quanto mais específico (com palavras-chave, nomes, pautas), melhor o Curador acerta."
      >
        <textarea
          name="relevance_rules"
          required
          minLength={40}
          rows={14}
          defaultValue={initial?.relevance_rules ?? ""}
          className="w-full px-3 py-2 rounded-md border-2 border-border-subtle font-mono text-fs-13 leading-relaxed focus:outline-none focus:border-navy bg-off-white resize-y"
        />
      </Section>

      <Section
        title="O que viraliza"
        kicker="virality_score"
        hint="O que faz uma pauta render no WhatsApp/IG. Indignação legítima, personagens locais, mar, política com nome — descreva o que costuma engajar AQUI."
      >
        <textarea
          name="virality_rules"
          required
          minLength={40}
          rows={12}
          defaultValue={initial?.virality_rules ?? ""}
          className="w-full px-3 py-2 rounded-md border-2 border-border-subtle font-mono text-fs-13 leading-relaxed focus:outline-none focus:border-navy bg-off-white resize-y"
        />
      </Section>

      <Section
        title="Onde tem risco"
        kicker="risk_score + risk_flags"
        hint="Liste as armadilhas (legal, difamação, sensibilidade) com as flags que o Curador deve marcar. Ítens com risk_score ≥ 0.7 entram em decision=investigate e exigem revisão."
      >
        <textarea
          name="risk_rules"
          required
          minLength={40}
          rows={14}
          defaultValue={initial?.risk_rules ?? ""}
          className="w-full px-3 py-2 rounded-md border-2 border-border-subtle font-mono text-fs-13 leading-relaxed focus:outline-none focus:border-navy bg-off-white resize-y"
        />
      </Section>

      <div className="grid gap-5 md:grid-cols-3 pt-2 border-t border-border-subtle">
        <ListField
          label="Cidades-foco"
          name="focus_cities"
          hint="Uma por linha. Boost na relevância quando aparecem."
          defaultValue={initial?.focus_cities ?? []}
        />
        <ListField
          label="Palavras-gatilho"
          name="trigger_keywords"
          hint="Termos que dão sinal de relevância. Uma por linha."
          defaultValue={initial?.trigger_keywords ?? []}
        />
        <ListField
          label="Palavras-bloqueio"
          name="block_keywords"
          hint="Termos que automaticamente derrubam o score (futilidade, celebridade, etc)."
          defaultValue={initial?.block_keywords ?? []}
          tone="red"
        />
      </div>

      <Field
        label="Notas internas (não vão pro prompt)"
        hint="Pra você lembrar por que mexeu no quê. Aparece em /admin/auditoria."
      >
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          className="w-full px-3 py-2 rounded-md border-2 border-border-subtle text-fs-13 focus:outline-none focus:border-navy bg-off-white resize-y"
        />
      </Field>

      <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
        <button
          type="submit"
          disabled={pending}
          className="h-11 px-6 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors disabled:opacity-50"
        >
          {pending ? "Salvando…" : initial ? "Salvar rubrica (bump versão)" : "Criar rubrica"}
        </button>
        <p className="text-fs-12 text-ink-500">
          Salvar = nova versão se algo mudou. O motor re-scoreia ítens em backlog na próxima rodada.
        </p>
      </div>
    </form>
  );
}

function Section({
  title,
  kicker,
  hint,
  children,
}: {
  title: string;
  kicker: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
          {kicker}
        </p>
        <h3 className="font-display font-black text-fs-18 text-navy mt-0.5">{title}</h3>
        <p className="text-fs-12 text-ink-500 max-w-[80ch] mt-0.5">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-1">
        {label}
      </span>
      {children}
      {hint && <p className="mt-1 text-fs-12 text-ink-500">{hint}</p>}
    </label>
  );
}

function ListField({
  label,
  name,
  hint,
  defaultValue,
  tone,
}: {
  label: string;
  name: string;
  hint: string;
  defaultValue: string[];
  tone?: "red";
}) {
  const border =
    tone === "red"
      ? "border-alert-red/40 focus:border-alert-red"
      : "border-border-subtle focus:border-navy";
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-1">
        {label}{" "}
        <span className="text-ink-400 normal-case tracking-normal">
          ({defaultValue.length})
        </span>
      </span>
      <textarea
        name={name}
        rows={8}
        defaultValue={defaultValue.join("\n")}
        className={`w-full px-3 py-2 rounded-md border-2 ${border} font-mono text-fs-12 focus:outline-none bg-off-white resize-y`}
      />
      <p className="mt-1 text-fs-12 text-ink-500">{hint}</p>
    </label>
  );
}
