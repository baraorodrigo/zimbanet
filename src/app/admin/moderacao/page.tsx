import { requireAdmin } from "@/lib/auth/admin";
import { Header } from "../_components/header";
import {
  moderateMuralPost,
  moderateMuralComment,
  moderateArticleComment,
  moderateBazarItem,
} from "@/lib/actions/moderation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MuralRow = {
  id: string;
  author_name: string;
  is_anon: boolean;
  bairro: string;
  body: string;
  moderation_status: string;
  status: string;
  pending_email: string | null;
  created_at: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_name: string;
  body: string;
  moderation_status: string;
  created_at: string;
};

type ArticleCommentRow = {
  id: string;
  article_id: string;
  author_name: string;
  body: string;
  moderation_status: string;
  created_at: string;
};

type BazarRow = {
  id: string;
  title: string;
  type: string;
  bairro: string;
  description: string;
  whatsapp: string;
  status: string;
  pending_email: string | null;
  created_at: string;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ModeracaoPage() {
  const { supabase } = await requireAdmin({ next: "/admin/moderacao" });

  const [muralRes, commentRes, articleCommentRes, bazarRes] = await Promise.all([
    supabase
      .from("mural_posts")
      .select("id, author_name, is_anon, bairro, body, moderation_status, status, pending_email, created_at")
      .or("moderation_status.eq.pending,status.eq.pending_confirmation")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("mural_comments")
      .select("id, post_id, author_name, body, moderation_status, created_at")
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("article_comments")
      .select("id, article_id, author_name, body, moderation_status, created_at")
      .in("moderation_status", ["pending", "flagged"])
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("bazar_items")
      .select("id, title, type, bairro, description, whatsapp, status, pending_email, created_at")
      .eq("status", "pending_confirmation")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const muralPending = (muralRes.data ?? []) as MuralRow[];
  const commentPending = (commentRes.data ?? []) as CommentRow[];
  const articleCommentPending = (articleCommentRes.data ?? []) as ArticleCommentRow[];
  const bazarPending = (bazarRes.data ?? []) as BazarRow[];

  const total =
    muralPending.length +
    commentPending.length +
    articleCommentPending.length +
    bazarPending.length;

  return (
    <div className="space-y-10">
      <Header
        kicker="Comunidade"
        title="Moderação"
        sub={
          total === 0
            ? "Tudo limpo. Quando chegar conteúdo guest ou flag de moderação, aparece aqui."
            : `${total} ${total === 1 ? "item aguarda" : "itens aguardam"} sua decisão.`
        }
      />

      <Section
        title="#zimbamilgrau — posts"
        count={muralPending.length}
        empty="Nenhum post na fila."
      >
        {muralPending.map((p) => (
          <article
            key={p.id}
            className="rounded-md border border-border-subtle bg-white p-5"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
              <span className="font-display font-bold text-navy">
                {p.is_anon ? "Anônimo" : p.author_name}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-gold-700">
                {p.bairro}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-semibold">
                {fmt(p.created_at)}
              </span>
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] font-bold rounded-xs px-2 py-0.5 bg-alert-red/10 text-alert-red">
                {p.status === "pending_confirmation" ? "Guest sem confirmar" : "Aguarda mod"}
              </span>
            </div>
            <p className="text-fs-15 text-navy/90 leading-[1.55] mb-4 whitespace-pre-wrap">
              {p.body}
            </p>
            {p.pending_email && (
              <p className="text-fs-12 text-ink-500 mb-3 font-mono">
                guest: {p.pending_email}
              </p>
            )}
            <ModerateActions
              action={moderateMuralPost}
              id={p.id}
              hint={p.status === "pending_confirmation"
                ? "Aprovar publica mesmo sem o magic-link confirmado."
                : undefined}
            />
          </article>
        ))}
      </Section>

      <Section
        title="#zimbamilgrau — comentários"
        count={commentPending.length}
        empty="Sem comentários pendentes."
      >
        {commentPending.map((c) => (
          <article
            key={c.id}
            className="rounded-md border border-border-subtle bg-white p-5"
          >
            <div className="flex items-baseline gap-3 mb-2 flex-wrap">
              <span className="font-display font-bold text-navy text-fs-14">
                {c.author_name}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-semibold">
                {fmt(c.created_at)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-mono">
                post: {c.post_id.slice(0, 8)}
              </span>
            </div>
            <p className="text-fs-14 text-navy/90 leading-relaxed mb-4">
              {c.body}
            </p>
            <ModerateActions action={moderateMuralComment} id={c.id} />
          </article>
        ))}
      </Section>

      <Section
        title="Comentários em matérias"
        count={articleCommentPending.length}
        empty="Sem comentários sinalizados em matérias."
      >
        {articleCommentPending.map((c) => (
          <article
            key={c.id}
            className="rounded-md border border-border-subtle bg-white p-5"
          >
            <div className="flex items-baseline gap-3 mb-2 flex-wrap">
              <span className="font-display font-bold text-navy text-fs-14">
                {c.author_name}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-semibold">
                {fmt(c.created_at)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-mono">
                matéria: {c.article_id.slice(0, 8)}
              </span>
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] font-bold rounded-xs px-2 py-0.5 bg-alert-red/10 text-alert-red">
                {c.moderation_status === "flagged" ? "Sinalizado" : "Pendente"}
              </span>
            </div>
            <p className="text-fs-14 text-navy/90 leading-relaxed mb-4">
              {c.body}
            </p>
            <ModerateActions action={moderateArticleComment} id={c.id} />
          </article>
        ))}
      </Section>

      <Section
        title="#bazardazimba — anúncios"
        count={bazarPending.length}
        empty="Sem anúncios na fila."
      >
        {bazarPending.map((b) => (
          <article
            key={b.id}
            className="rounded-md border border-border-subtle bg-white p-5"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
              <span className="font-display font-bold text-navy text-fs-16">
                {b.title}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-zimba-blue">
                {b.type} · {b.bairro}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-semibold">
                {fmt(b.created_at)}
              </span>
            </div>
            <p className="text-fs-13 text-navy/85 leading-relaxed mb-3 whitespace-pre-wrap">
              {b.description}
            </p>
            <p className="text-fs-12 text-ink-500 font-mono mb-3">
              wa: {b.whatsapp}
              {b.pending_email && <> · guest: {b.pending_email}</>}
            </p>
            <ModerateActions action={moderateBazarItem} id={b.id} />
          </article>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display font-bold text-fs-22 text-navy mb-4 flex items-baseline gap-3">
        <span className="h-[3px] w-8 bg-zimba-gold" aria-hidden />
        {title}
        <span className="text-ink-400 tabular-nums font-normal text-fs-15">
          ({count})
        </span>
      </h2>
      {count === 0 ? (
        <p className="text-fs-13 text-ink-500 italic">{empty}</p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

type FormAction = (formData: FormData) => void | Promise<void>;

function ModerateActions({
  action,
  id,
  hint,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean }>;
  id: string;
  hint?: string;
}) {
  const formAction = action as unknown as FormAction;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value="approve" />
        <button
          type="submit"
          className="bg-eco-green text-off-white text-[10px] uppercase tracking-[0.22em] font-bold px-4 h-9 hover:bg-navy transition-colors"
        >
          Aprovar
        </button>
      </form>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value="reject" />
        <button
          type="submit"
          className="bg-alert-red text-off-white text-[10px] uppercase tracking-[0.22em] font-bold px-4 h-9 hover:bg-navy transition-colors"
        >
          Rejeitar
        </button>
      </form>
      {hint && (
        <span className="text-[11px] text-ink-500 ml-2">{hint}</span>
      )}
    </div>
  );
}
