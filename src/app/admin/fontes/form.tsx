"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createSource, updateSource } from "@/lib/actions/sources";
import {
  SOURCE_TYPES,
  SOURCE_PRIORITIES,
  type SourceType,
  type SourcePriority,
} from "@/lib/db/sources";

type SourceFormValues = {
  id?: string;
  name?: string;
  type?: SourceType;
  priority?: SourcePriority;
  city?: string;
  active?: boolean;
  url?: string;
  keywords?: string[];
};

type Props =
  | { mode: "create"; initial?: SourceFormValues; id?: undefined }
  | { mode: "edit"; id: string; initial: SourceFormValues };

type State = { ok: true } | { ok: false; error: string } | null;
const initialState: State = null;

const TYPE_LABEL: Record<SourceType, string> = {
  rss: "RSS feed",
  scraper: "Scraper HTML",
  api: "API JSON",
  social: "Rede social",
  google_alerts: "Google Alerts",
};

const TYPE_HINT: Record<SourceType, string> = {
  rss: "URL termina em /feed, /rss ou /atom.",
  scraper: "Vai precisar de código custom no pipeline. URL é só de referência.",
  api: "Endpoint que devolve JSON.",
  social: "Cadastro pra futura integração (IG / FB / TikTok).",
  google_alerts: "URL do feed RSS gerado pelo Google Alerts.",
};

const PRIORITY_LABEL: Record<SourcePriority, string> = {
  high: "Alta — coleta sempre, prioritária",
  medium: "Média — padrão",
  low: "Baixa — só quando der",
};

export default function SourceForm(props: Props) {
  const action = async (_: State, formData: FormData): Promise<State> => {
    const r =
      props.mode === "create"
        ? await createSource(formData)
        : await updateSource(props.id, formData);
    if (r.ok) return { ok: true };
    return { ok: false, error: r.error };
  };

  const [state, formAction] = useFormState<State, FormData>(action, initialState);

  const v = props.initial ?? {};

  return (
    <form action={formAction} className="grid gap-6">
      {state && !state.ok && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          {state.error}
        </div>
      )}

      <Section title="Identidade da fonte">
        <Field label="Nome *" name="name" hint="Como aparece no painel. Ex.: G1 SC, Câmara de Imbituba.">
          <input
            type="text"
            name="name"
            defaultValue={v.name ?? ""}
            required
            minLength={2}
            maxLength={80}
            className="input text-fs-15"
            placeholder="Ex.: NSC Total — Sul"
          />
        </Field>

        <Field
          label={props.mode === "create" ? "ID (slug interno)" : "ID"}
          name="id"
          hint={
            props.mode === "create"
              ? "Deixa vazio que eu gero do nome (ex.: nsc_total_sul). Só letras, números e _."
              : "ID é fixo depois de criado — é a chave que liga a fonte aos itens coletados."
          }
        >
          <input
            type="text"
            name="id"
            defaultValue={v.id ?? ""}
            disabled={props.mode === "edit"}
            maxLength={60}
            className="input font-mono text-fs-13 disabled:bg-off-white disabled:text-ink-500"
            placeholder="opcional"
            pattern="[a-z0-9_]*"
          />
        </Field>
      </Section>

      <Section title="Tipo e coleta">
        <Field label="Tipo *" name="type">
          <div className="grid sm:grid-cols-2 gap-2">
            {SOURCE_TYPES.map((t) => {
              const checked = (v.type ?? "rss") === t;
              return (
                <label
                  key={t}
                  className="cursor-pointer rounded-md border border-border-subtle bg-white p-3 has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-zimba-gold transition-colors"
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    defaultChecked={checked}
                    className="sr-only"
                    required
                  />
                  <span className="block font-display font-bold text-fs-14">{TYPE_LABEL[t]}</span>
                  <span className="block text-fs-11 opacity-70 mt-0.5">{TYPE_HINT[t]}</span>
                </label>
              );
            })}
          </div>
        </Field>

        <Field
          label="URL"
          name="url"
          hint="Obrigatória pra RSS / API. Pra scraper, é só referência."
        >
          <input
            type="url"
            name="url"
            defaultValue={v.url ?? ""}
            className="input font-mono text-fs-13"
            placeholder="https://exemplo.com/feed"
          />
        </Field>

        <Field
          label="Filtro por palavras-chave"
          name="keywords"
          hint="Separadas por vírgula. Item só entra se conter pelo menos uma. Vazio = aceita tudo. Ex.: imbituba, garopaba, porto"
        >
          <input
            type="text"
            name="keywords"
            defaultValue={(v.keywords ?? []).join(", ")}
            className="input"
            placeholder="opcional — sem filtro coleta tudo"
          />
        </Field>
      </Section>

      <Section title="Cobertura e prioridade">
        <Field label="Cidade principal *" name="city" hint="Cidade que essa fonte cobre majoritariamente.">
          <input
            type="text"
            name="city"
            defaultValue={v.city ?? "Imbituba"}
            required
            maxLength={60}
            className="input"
            placeholder="Imbituba"
          />
        </Field>

        <Field label="Prioridade *" name="priority">
          <div className="grid grid-cols-3 gap-2 max-w-[560px]">
            {SOURCE_PRIORITIES.map((p) => {
              const checked = (v.priority ?? "medium") === p;
              return (
                <label
                  key={p}
                  className="cursor-pointer rounded-md border border-border-subtle bg-white p-3 has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-zimba-gold transition-colors"
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    defaultChecked={checked}
                    className="sr-only"
                    required
                  />
                  <span className="block font-display font-bold text-fs-14 uppercase tracking-wide">
                    {p}
                  </span>
                  <span className="block text-fs-11 opacity-70 mt-0.5">{PRIORITY_LABEL[p]}</span>
                </label>
              );
            })}
          </div>
        </Field>

        <label className="inline-flex items-center gap-2 cursor-pointer mt-1">
          <input
            type="checkbox"
            name="active"
            defaultChecked={v.active ?? true}
            className="h-4 w-4 accent-eco-green"
          />
          <span className="text-fs-14 text-ink-700">
            <strong className="text-eco-green font-bold uppercase tracking-wide">Ativa</strong> — o
            Curador coleta dessa fonte na próxima rodada
          </span>
        </label>
      </Section>

      <SubmitRow mode={props.mode} />
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

function SubmitRow({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={pending}
        className="h-12 px-6 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Salvando..." : mode === "create" ? "Criar fonte" : "Salvar alterações"}
      </button>
      <p className="text-fs-12 text-ink-500">
        Pra coletar agora, rode <code className="font-mono text-fs-11 px-1.5 py-0.5 rounded border border-border-subtle bg-off-white">npm run curador</code> no terminal.
      </p>
    </div>
  );
}
