import Link from "next/link";
import Icon from "./icon";

const cols = [
  {
    label: "Editorias",
    links: [
      ["Cidade", "/cidade"],
      ["Política", "/politica"],
      ["Esporte", "/esporte"],
      ["Cultura", "/cultura"],
      ["Polícia", "/policia"],
      ["Praias", "/praias"],
    ],
  },
  {
    label: "Comunidade",
    links: [
      ["#zimbamilgrau", "/zimbamilgrau"],
      ["#bazardazimba", "/bazardazimba"],
      ["Newsletter", "/newsletter"],
      ["Enviar pauta", "/pauta"],
    ],
  },
  {
    label: "Institucional",
    links: [
      ["Sobre o Zimbanet", "/sobre"],
      ["Estatuto editorial", "/editorial"],
      ["Anuncie", "/anuncie"],
      ["Termos de uso", "/termos"],
      ["Privacidade", "/privacidade"],
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="bg-navy text-off-white mt-20">
      <div className="zb-container py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <Link href="/" className="inline-flex flex-col leading-none" aria-label="Zimbanet">
            <span className="font-display font-black text-[36px] tracking-tight2">
              ZIMBA<span className="text-zimba-gold">NET</span>
            </span>
            <span className="mt-2 text-[10px] uppercase tracking-[0.32em] font-medium text-zimba-gold/85">
              Imbituba conectada
            </span>
          </Link>
          <p className="mt-5 text-fs-14 text-off-white/65 leading-relaxed max-w-xs">
            Portal regional de notícias e atualidades de Imbituba e cidades
            num raio de 50 km. Conectando a região desde os anos 2000.
          </p>
          <div className="mt-5 flex items-center gap-3 text-off-white/70">
            <a
              href="https://instagram.com/bombei_imbituba"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @bombei_imbituba"
              className="hover:text-zimba-gold"
            >
              <Icon name="instagram" size={18} />
            </a>
            <a
              href="https://facebook.com/bombei.imbituba"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook @bombei.imbituba"
              className="hover:text-zimba-gold"
            >
              <Icon name="facebook" size={18} />
            </a>
          </div>
        </div>

        {cols.map((c) => (
          <div key={c.label}>
            <h4 className="text-fs-12 uppercase tracking-tag font-bold text-zimba-gold mb-4">
              {c.label}
            </h4>
            <ul className="space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-fs-14 text-off-white/75 hover:text-zimba-gold transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="zb-container py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-fs-12 text-off-white/55">
          <p>© 2026 Zimbanet · Imbituba, SC. Todos os direitos reservados.</p>
          <p>Imbituba conectada.</p>
        </div>
      </div>
    </footer>
  );
}
