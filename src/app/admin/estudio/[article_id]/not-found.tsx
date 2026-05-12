import Link from "next/link";

export default function NotFound() {
  return (
    <div className="-mx-6 lg:-mx-10 -my-8 lg:-my-10 min-h-[calc(100vh-1px)] bg-off-white flex items-center justify-center px-6 py-20">
      <div className="text-center max-w-[52ch]">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.28em] text-zimba-gold">
          Estúdio Zimbanet
        </p>
        <h1 className="mt-2 font-display font-black text-fs-44 text-navy leading-[1.05] tracking-tight2">
          Matéria não encontrada
        </h1>
        <p className="mt-4 text-fs-15 text-ink-700">
          O ID que você abriu não existe — ou a matéria foi removida antes da gente
          conseguir gerar o pacote de social. Volte pra inbox e escolha outro pacote.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            href="/admin/social"
            className="inline-block h-11 px-5 leading-[44px] rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
          >
            Inbox de social
          </Link>
          <Link
            href="/admin/fila"
            className="inline-block h-11 px-5 leading-[44px] rounded-md border border-border-subtle text-navy font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:border-navy transition-colors"
          >
            Fila editorial
          </Link>
        </div>
      </div>
    </div>
  );
}
