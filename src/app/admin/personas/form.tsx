"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPersona, updatePersona } from "@/lib/actions/personas";
import type { EditorialPersonaRow } from "@/lib/db/types";

type Mode = "create" | "edit";

export default function PersonaForm({
  mode,
  id,
  initial,
}: {
  mode: Mode;
  id?: string;
  initial?: Partial<EditorialPersonaRow>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      if (mode === "edit" && id) {
        const res = await updatePersona(id, formData);
        if (!res.ok) {
          setError(res.error);
        } else {
          setSaved(true);
          router.refresh();
        }
      } else {
        try {
          await createPersona(formData);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="grid gap-5 rounded-md border-2 border-border-subtle bg-white p-6"
    >
      {error && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-md border border-eco-green bg-eco-green/5 p-3 text-fs-13 text-eco-green">
          Salvo.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-[1fr_140px]">
        <Field
          label="Nome da persona"
          hint="Como aparece nos seletores. Ex: Rua, Análise, Crítica."
        >
          <input
            type="text"
            name="name"
            required
            minLength={2}
            maxLength={60}
            defaultValue={initial?.name ?? ""}
            className="w-full h-11 px-3 rounded-md border-2 border-border-subtle font-display font-bold text-fs-16 text-navy focus:outline-none focus:border-navy bg-off-white"
            autoFocus={mode === "create"}
          />
        </Field>
        <Field label="Ordem" hint="Menor primeiro.">
          <input
            type="number"
            name="sort_order"
            min={0}
            max={9999}
            defaultValue={initial?.sort_order ?? 100}
            className="w-full h-11 px-3 rounded-md border-2 border-border-subtle font-mono text-fs-14 focus:outline-none focus:border-navy bg-off-white"
          />
        </Field>
      </div>

      <Field
        label="Slug (URL-safe)"
        hint='Identificador interno. Auto-gerado do nome. Ex: "rua", "analise".'
      >
        <input
          type="text"
          name="slug"
          pattern="[a-z0-9-]+"
          maxLength={60}
          defaultValue={initial?.slug ?? ""}
          placeholder="Deixa em branco pra gerar do nome"
          className="w-full h-11 px-3 rounded-md border-2 border-border-subtle font-mono text-fs-13 focus:outline-none focus:border-navy bg-off-white"
        />
      </Field>

      <Field
        label="Headline (1 linha)"
        hint="Frase curta que descreve a voz. Aparece no card e no seletor."
      >
        <input
          type="text"
          name="headline"
          maxLength={120}
          defaultValue={initial?.headline ?? ""}
          placeholder="Ex: Voz popular, direta — como vizinho contando o que rolou"
          className="w-full h-11 px-3 rounded-md border-2 border-border-subtle text-fs-14 focus:outline-none focus:border-navy bg-off-white"
        />
      </Field>

      <Field
        label="Descrição (2-3 frases)"
        hint="Pra editor entender quando usar essa persona. Não vai pro prompt."
      >
        <textarea
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={initial?.description ?? ""}
          className="w-full px-3 py-2 rounded-md border-2 border-border-subtle text-fs-14 focus:outline-none focus:border-navy bg-off-white resize-y"
        />
      </Field>

      <Field
        label="Prompt-sistema (manda na voz)"
        hint="Esse é o texto que entra como system na chamada de IA. Defina identidade, ângulo, princípios não-negociáveis, formato de saída. Mín. 40 caracteres."
      >
        <textarea
          name="system_prompt"
          required
          minLength={40}
          maxLength={8000}
          rows={20}
          defaultValue={initial?.system_prompt ?? ""}
          className="w-full px-3 py-2 rounded-md border-2 border-border-subtle font-mono text-fs-13 leading-relaxed focus:outline-none focus:border-navy bg-off-white resize-y"
        />
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-400">
          Use blocos: IDENTIDADE · ÂNGULO · PRINCÍPIOS · FORMATO DE SAÍDA. O JSON
          esperado tem keys <code className="font-mono">kicker</code>,{" "}
          <code className="font-mono">title</code>,{" "}
          <code className="font-mono">lede</code>,{" "}
          <code className="font-mono">body</code>,{" "}
          <code className="font-mono">byline</code>.
        </p>
      </Field>

      <label className="flex items-center gap-3 select-none">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initial?.is_active ?? true}
          className="h-5 w-5 rounded border-2 border-border-subtle accent-navy"
        />
        <span className="text-fs-14 font-bold text-navy">Ativa</span>
        <span className="text-fs-12 text-ink-500">
          (aparece no seletor da matéria)
        </span>
      </label>

      <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
        <button
          type="submit"
          disabled={pending}
          className="h-11 px-6 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors disabled:opacity-50"
        >
          {pending ? "Salvando…" : mode === "edit" ? "Salvar alterações" : "Criar persona"}
        </button>
        <a
          href="/admin/personas"
          className="h-11 px-5 inline-flex items-center rounded-md border border-border-subtle text-ink-700 font-bold text-fs-12 uppercase tracking-[0.18em] hover:border-navy hover:text-navy transition-colors"
        >
          Cancelar
        </a>
      </div>
    </form>
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
