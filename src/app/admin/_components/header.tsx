export function Header({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <header className="border-b border-border-subtle pb-6">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.28em] text-zimba-gold">
        {kicker}
      </p>
      <h1 className="font-display font-black text-fs-44 text-navy leading-[1.05] tracking-tight2 mt-1">
        {title}
      </h1>
      {sub && <p className="mt-2 text-fs-15 text-ink-700 max-w-[60ch]">{sub}</p>}
    </header>
  );
}
