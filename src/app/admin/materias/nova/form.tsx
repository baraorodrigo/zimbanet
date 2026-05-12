"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createArticle, updateArticle } from "@/lib/actions/articles";
import { EDITORIA_LABEL, EDITORIA_SLUGS, type ArticleRow } from "@/lib/db/types";
import { ImagePicker } from "@/components/image-picker";

type Mode = "create" | "edit";

type Props =
  | { mode: "create"; initial?: Partial<ArticleRow>; id?: undefined }
  | { mode: "edit"; id: string; initial: Partial<ArticleRow> };

// Normalizado pros dois modos: só preciso de ok/error pra UI.
type State = { ok: true } | { ok: false; error: string } | null;

const initialState: State = null;

export default function ArticleForm(props: Props) {
  const action = async (_: State, formData: FormData): Promise<State> => {
    const r =
      props.mode === "create"
        ? await createArticle(formData)
        : await updateArticle(props.id, formData);
    if (r.ok) return { ok: true };
    return { ok: false, error: r.error };
  };

  const [state, formAction] = useFormState<State, FormData>(action, initialState);

  const v = props.initial ?? ({} as Partial<ArticleRow>);

  return (
    <form action={formAction} className="grid gap-6">
      {/* Erro */}
      {state && !state.ok && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          {state.error}
        </div>
      )}

      {/* Bloco título / editoria */}
      <Section title="Título e classificação">
        <Field label="Editoria *" name="editoria">
          <select
            name="editoria"
            defaultValue={(v.editoria as string) ?? "cidade"}
            required
            className="input"
          >
            {EDITORIA_SLUGS.map((s) => (
              <option key={s} value={s}>
                {EDITORIA_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Kicker (chapéu acima do título)" name="kicker" hint="Ex.: ELEIÇÕES 2026 · BREAKING · EXCLUSIVO">
          <input
            type="text"
            name="kicker"
            defaultValue={v.kicker ?? ""}
            maxLength={60}
            className="input"
            placeholder="opcional"
          />
        </Field>

        <Field label="Título *" name="title">
          <input
            type="text"
            name="title"
            defaultValue={v.title ?? ""}
            required
            minLength={3}
            maxLength={200}
            className="input text-fs-18 font-display font-bold"
            placeholder="O que aconteceu, em uma frase"
          />
        </Field>

        <Field label="Subtítulo" name="subtitle">
          <input
            type="text"
            name="subtitle"
            defaultValue={v.subtitle ?? ""}
            maxLength={240}
            className="input"
            placeholder="opcional — uma linha de contexto"
          />
        </Field>

        <Field
          label="Slug (URL)"
          name="slug"
          hint="Deixa vazio que eu gero automaticamente do título."
        >
          <input
            type="text"
            name="slug"
            defaultValue={v.slug ?? ""}
            maxLength={90}
            className="input font-mono text-fs-13"
            placeholder="ex.: porto-imbituba-recorde-2026"
          />
        </Field>
      </Section>

      {/* Texto */}
      <Section title="Conteúdo">
        <Field label="Lede (resumo de abertura)" name="lede">
          <textarea
            name="lede"
            defaultValue={v.lede ?? ""}
            rows={3}
            maxLength={500}
            className="input resize-y"
            placeholder="O parágrafo de abertura — o que o leitor precisa saber em 2-3 linhas."
          />
        </Field>

        <Field label="Corpo da matéria *" name="body" hint="Mínimo 20 caracteres. HTML simples (parágrafos, listas) é OK.">
          <textarea
            name="body"
            defaultValue={v.body ?? ""}
            rows={18}
            required
            className="input resize-y font-serif text-fs-16 leading-relaxed"
            placeholder="O texto completo. Use parágrafos curtos. Aspas literais entre &quot;...&quot;."
          />
        </Field>

        <Field label="Assinatura" name="byline" hint="Ex.: Redação ZIMBANET · Rodrigo Barão · BOMBEI Imbituba">
          <input
            type="text"
            name="byline"
            defaultValue={v.byline ?? "Redação ZIMBANET"}
            maxLength={120}
            className="input"
          />
        </Field>
      </Section>

      {/* Mídia */}
      <Section title="Imagem de capa">
        <ImagePicker
          name="hero_image_url"
          defaultValue={v.hero_image_url ?? ""}
          scope="article"
          label="Hero da matéria"
          hint="Solte um arquivo, escolha do disco ou cole uma URL. Depois de salvar, o Estúdio completo libera geração via IA."
          aspect="video"
        />

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Crédito" name="hero_image_credit">
            <input
              type="text"
              name="hero_image_credit"
              defaultValue={v.hero_image_credit ?? ""}
              maxLength={120}
              className="input"
              placeholder="Foto: Fulano / ZIMBANET"
            />
          </Field>
          <Field label="Texto alternativo (alt)" name="hero_image_alt">
            <input
              type="text"
              name="hero_image_alt"
              defaultValue={v.hero_image_alt ?? ""}
              maxLength={200}
              className="input"
              placeholder="Descrição pra acessibilidade"
            />
          </Field>
        </div>
      </Section>

      {/* Meta */}
      <Section title="Etiquetas e flags">
        <Field
          label="Tags"
          name="tags"
          hint="Separadas por vírgula. Ex.: porto, obras, vereador-josé"
        >
          <input
            type="text"
            name="tags"
            defaultValue={(v.tags ?? []).join(", ")}
            className="input"
            placeholder="opcional"
          />
        </Field>

        <Field
          label="Cidades cobertas"
          name="cities"
          hint="Separadas por vírgula. Ex.: Imbituba, Garopaba"
        >
          <input
            type="text"
            name="cities"
            defaultValue={(v.cities ?? []).join(", ")}
            className="input"
            placeholder="Imbituba"
          />
        </Field>

        <div className="flex items-center gap-6 flex-wrap">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_breaking"
              defaultChecked={v.is_breaking ?? false}
              className="h-4 w-4 accent-alert-red"
            />
            <span className="text-fs-14 text-ink-700">
              <strong className="text-alert-red font-bold uppercase tracking-wide">Breaking</strong> — urgente, mostra no topo
            </span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_exclusive"
              defaultChecked={v.is_exclusive ?? false}
              className="h-4 w-4 accent-zimba-blue"
            />
            <span className="text-fs-14 text-ink-700">
              <strong className="text-zimba-blue font-bold uppercase tracking-wide">Exclusivo</strong> — apuração própria
            </span>
          </label>
        </div>
      </Section>

      {/* Status + submit */}
      <Section title="Publicação">
        <Field label="Status *" name="status">
          <div className="grid grid-cols-3 gap-2 max-w-[480px]">
            {[
              { k: "draft", l: "Rascunho", h: "salva pra revisar depois" },
              { k: "review", l: "Em revisão", h: "vai pra fila" },
              { k: "published", l: "Publicar", h: "vai pro portal já" },
            ].map((s, i) => {
              const cur = (v.status as string | undefined) ?? "draft";
              const checked = cur === s.k || (props.mode === "create" && i === 0 && !cur);
              return (
                <label
                  key={s.k}
                  className="cursor-pointer rounded-md border border-border-subtle bg-white p-3 has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-zimba-gold transition-colors"
                >
                  <input
                    type="radio"
                    name="status"
                    value={s.k}
                    defaultChecked={checked}
                    className="sr-only"
                    required
                  />
                  <span className="block font-display font-bold text-fs-14">{s.l}</span>
                  <span className="block text-fs-11 opacity-70 mt-0.5">{s.h}</span>
                </label>
              );
            })}
          </div>
        </Field>

        <SubmitRow mode={props.mode} />
      </Section>
    </form>
  );
}

// ---- helpers ---------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-md border border-border-subtle bg-white p-5">
      <legend className="px-2 text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
        {title}
      </legend>
      <div className="grid gap-4 mt-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  name,
  hint,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-fs-13 font-bold text-navy mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-fs-12 text-ink-500 mt-1">{hint}</span>}
      <input type="hidden" data-field={name} />
    </label>
  );
}

function SubmitRow({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={pending}
        className="h-12 px-6 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Salvando..." : mode === "create" ? "Criar matéria" : "Salvar alterações"}
      </button>
      <p className="text-fs-12 text-ink-500">
        Atalhos: <kbd className="font-mono text-fs-11 px-1.5 py-0.5 rounded border border-border-subtle bg-off-white">Ctrl/Cmd + S</kbd> em breve.
      </p>
    </div>
  );
}
