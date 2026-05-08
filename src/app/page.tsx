export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-zimba-blue mb-6">
          Imbituba · Santa Catarina
        </p>
        <h1 className="font-serif text-6xl md:text-7xl font-bold leading-none">
          <span className="text-navy">ZIMBA</span>
          <span className="text-zimba-gold">NET</span>
        </h1>
        <p className="mt-4 text-zimba-blue text-lg">Imbituba conectada</p>
        <div className="mt-12 inline-block border-l-2 border-zimba-gold bg-white px-6 py-4 text-sm text-navy/70 text-left">
          Portal em construção. Próximos passos: configurar Supabase, criar
          editorias e portar pipeline editorial do BOMBEI.
        </div>
      </div>
    </main>
  );
}
