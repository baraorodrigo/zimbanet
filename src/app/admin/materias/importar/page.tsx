// Importar matéria por URL — fluxo de duas etapas no mesmo arquivo:
// 1) sem ?url: form de colar URL (GET → recarrega com ?url=...).
// 2) com ?url: server-side scrape, mostra preview + form pra revisar campos
//    e salvar como rascunho via Server Action.
//
// Fica de propósito num único Server Component pra não embaralhar client/server
// state. O scrape roda no servidor (sem CORS), e o form de salvar é o mesmo
// padrão das outras telas do admin.

import Link from "next/link";
import { Header } from "../../_components/header";
import { scrapeArticleByUrl } from "@/lib/scrape/article";
import { createArticleFromImport } from "@/lib/actions/articles";
import { EDITORIA_LABEL, EDITORIA_SLUGS, type EditoriaSlug } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type SP = { url?: string };

export default async function ImportarMateriaPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const url = (searchParams.url ?? "").trim();

  if (!url) {
    return <UrlPrompt />;
  }

  const scraped = await scrapeArticleByUrl(url);

  return (
    <>
      <Header
        kicker="Importar de link · revisar"
        title="Confira o que veio da fonte"
        sub="Ajuste o que precisar e salve como rascunho. O texto extraído é só ponto de partida — o Redator IA reescreve depois com voz da ZIMBANET."
      />

      {scraped.error && (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4">
          <p className="font-display font-bold text-alert-red">
            Não consegui extrair tudo.
          </p>
          <p className="mt-1 text-fs-13 text-ink-700">{scraped.error}</p>
          <p className="mt-2 text-fs-12 text-ink-500">
            Tenta outra URL, ou preenche manualmente abaixo se conseguiu pegar
            só alguns campos.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-md border border-zimba-blue bg-zimba-blue/5 p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-blue">
          Fonte original
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 font-mono text-fs-13 text-navy hover:text-zimba-blue underline underline-offset-2 break-all"
        >
          {url} ↗
        </a>
        {scraped.sourceHost && (
          <p className="mt-1 text-fs-12 text-ink-500">
            <strong className="font-bold">{scraped.sourceHost}</strong>
            {scraped.siteName && scraped.siteName !== scraped.sourceHost && (
              <> · {scraped.siteName}</>
            )}
            {scraped.publishedAt && (
              <> · publicado em {formatDate(scraped.publishedAt)}</>
            )}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Link
            href="/admin/materias/importar"
            className="text-fs-12 font-bold uppercase tracking-[0.18em] text-zimba-blue hover:text-navy"
          >
            ← Trocar URL
          </Link>
        </div>
      </div>

      <ImportPreviewForm
        sourceUrl={url}
        initialTitle={scraped.title ?? ""}
        initialLede={scraped.lede ?? ""}
        initialBody={scraped.body ?? ""}
        initialImage={scraped.imageUrl ?? ""}
        initialCredit={scraped.siteName ?? scraped.sourceHost ?? ""}
      />
    </>
  );
}

function UrlPrompt() {
  return (
    <>
      <Header
        kicker="Importar de link"
        title="Cole a URL da matéria"
        sub="Funciona com qualquer portal de notícia: cola o link, eu extraio título, foto, lede e corpo. Você revisa, ajusta a editoria, e salva como rascunho."
      />

      <form method="get" className="mt-8 grid gap-6 max-w-[640px]">
        <fieldset className="rounded-md border border-border-subtle bg-white p-5">
          <legend className="px-2 text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
            URL da matéria
          </legend>
          <div className="grid gap-3 mt-2">
            <label className="block">
              <span className="block text-fs-13 font-bold text-navy mb-1.5">
                Endereço completo *
              </span>
              <input
                type="url"
                name="url"
                required
                pattern="https?://.*"
                placeholder="https://nsctotal.com.br/noticias/..."
                autoFocus
                className="input font-mono text-fs-14"
              />
              <span className="block text-fs-12 text-ink-500 mt-1">
                Tem que começar com <code>http://</code> ou <code>https://</code>.
                Funciona melhor com portais que expõem meta tags (og:image, og:title).
              </span>
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="h-11 px-5 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
              >
                Extrair conteúdo
              </button>
              <Link
                href="/admin/materias"
                className="text-fs-13 text-ink-500 hover:text-navy"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </fieldset>

        <div className="rounded-md border border-border-subtle bg-off-white p-4">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-ink-500">
            Como usar
          </p>
          <ol className="mt-2 grid gap-1.5 text-fs-13 text-ink-700 list-decimal pl-5">
            <li>Pesquisa no Google (ou onde quiser) a matéria que te interessa.</li>
            <li>Copia o link da página.</li>
            <li>Cola aqui e clica em <strong>Extrair</strong>.</li>
            <li>Revisa título, foto, corpo — ajusta o que precisar.</li>
            <li>Salva como rascunho. Depois você reescreve com voz da ZIMBANET.</li>
          </ol>
        </div>
      </form>
    </>
  );
}

function ImportPreviewForm({
  sourceUrl,
  initialTitle,
  initialLede,
  initialBody,
  initialImage,
  initialCredit,
}: {
  sourceUrl: string;
  initialTitle: string;
  initialLede: string;
  initialBody: string;
  initialImage: string;
  initialCredit: string;
}) {
  return (
    <form action={createArticleFromImport} className="mt-6 grid gap-6">
      <input type="hidden" name="source_url" value={sourceUrl} />

      {/* Preview hero */}
      {initialImage && (
        <div className="rounded-md border border-border-subtle bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
            Foto extraída
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={initialImage}
            alt="Hero extraído da fonte"
            className="w-full max-h-[420px] object-cover rounded-sm border border-border-subtle bg-off-white"
          />
          <p className="mt-2 text-fs-12 text-ink-500 font-mono break-all">
            {initialImage}
          </p>
        </div>
      )}

      <Section title="Título e editoria">
        <Field label="Editoria *">
          <select
            name="editoria"
            defaultValue={"cidade" as EditoriaSlug}
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

        <Field label="Título *">
          <input
            type="text"
            name="title"
            defaultValue={initialTitle}
            required
            minLength={3}
            maxLength={200}
            className="input text-fs-18 font-display font-bold"
          />
        </Field>

        <Field label="Lede (abertura)">
          <textarea
            name="lede"
            defaultValue={initialLede}
            rows={2}
            maxLength={500}
            className="input resize-y"
          />
        </Field>
      </Section>

      <Section title="Corpo extraído">
        <Field
          label="Texto"
          hint="Veio direto dos <p> da fonte. Use só como referência — reescreva antes de publicar."
        >
          <textarea
            name="body"
            defaultValue={initialBody}
            rows={16}
            className="input resize-y font-serif text-fs-15 leading-relaxed"
            placeholder="Se nada veio, escreva aqui ou deixe vazio e completa depois."
          />
        </Field>
      </Section>

      <Section title="Imagem de capa">
        <Field
          label="URL da foto"
          hint="Pode trocar pra outra URL. No editor da matéria você pode fazer upload de arquivo também."
        >
          <input
            type="url"
            name="hero_image_url"
            defaultValue={initialImage}
            className="input font-mono text-fs-13"
            placeholder="https://..."
          />
        </Field>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Crédito">
            <input
              type="text"
              name="hero_image_credit"
              defaultValue={initialCredit ? `Foto: ${initialCredit}` : ""}
              maxLength={120}
              className="input"
              placeholder="Foto: Fulano / Veículo"
            />
          </Field>
          <Field label="Texto alternativo (alt)">
            <input
              type="text"
              name="hero_image_alt"
              defaultValue=""
              maxLength={200}
              className="input"
              placeholder="Descrição pra acessibilidade"
            />
          </Field>
        </div>
      </Section>

      <Section title="Metadados">
        <Field label="Assinatura">
          <input
            type="text"
            name="byline"
            defaultValue="Redação ZIMBANET"
            maxLength={120}
            className="input"
          />
        </Field>
        <Field label="Cidades cobertas" hint="Separadas por vírgula.">
          <input
            type="text"
            name="cities"
            defaultValue=""
            className="input"
            placeholder="Imbituba, Garopaba"
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3 pt-2 flex-wrap">
        <button
          type="submit"
          className="h-12 px-6 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
        >
          Salvar como rascunho
        </button>
        <Link
          href="/admin/materias/importar"
          className="text-fs-13 text-ink-500 hover:text-navy"
        >
          Tentar outra URL
        </Link>
        <p className="text-fs-12 text-ink-500 max-w-[40ch]">
          Vai pro acervo como <strong>rascunho</strong>. Você reescreve e publica depois.
        </p>
      </div>
    </form>
  );
}

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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-fs-13 font-bold text-navy mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-fs-12 text-ink-500 mt-1">{hint}</span>}
    </label>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
