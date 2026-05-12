// Card 1080×1080 — Instagram feed.
// Recebe via search params: ?kicker=...&headline=...&subline=...&editoria=...&photo=...

type Search = Record<string, string | string[] | undefined>;
function pick(s: Search, k: string, fallback = "") {
  const v = s[k];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? fallback : fallback;
}

const NAVY = "#0D1B2A";
const NAVY_DEEP = "#15263A";
const GOLD = "#E8B100";
const OFF = "#F5F5F5";

export default function Card1080({ searchParams }: { searchParams: Search }) {
  const kicker = pick(searchParams, "kicker", "ZIMBANET");
  const headline = pick(searchParams, "headline", "Manchete da matéria");
  const subline = pick(searchParams, "subline", "");
  const editoria = pick(searchParams, "editoria", "cidade");
  const photo = pick(searchParams, "photo", "");
  const credit = pick(searchParams, "credit", "");

  const editoriaUpper = editoria.toUpperCase();

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        position: "relative",
        background: NAVY,
        overflow: "hidden",
        color: OFF,
      }}
    >
      {/* Foto de fundo OU placeholder com pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: photo
            ? `url("${photo}") center/cover no-repeat`
            : `radial-gradient(circle at 30% 35%, rgba(232,177,0,0.40) 0%, rgba(232,177,0,0) 45%),
               repeating-linear-gradient(135deg, rgba(245,245,245,0.04) 0 8px, rgba(13,27,42,0) 8px 24px),
               linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 60%, #1B3A5C 100%)`,
        }}
      />

      {/* Scrim — escurece embaixo pra texto ficar legível */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(13,27,42,0.10) 0%, rgba(13,27,42,0.55) 55%, rgba(13,27,42,0.92) 100%)`,
        }}
      />

      {/* Faixa dourada superior — assinatura visual */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 56,
          height: 6,
          width: 110,
          background: GOLD,
        }}
      />

      {/* Logo bar */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 56,
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: "0.04em",
          color: OFF,
        }}
      >
        ZIMBA<span style={{ color: GOLD }}>NET</span>
      </div>

      {/* Editoria pill */}
      <div
        style={{
          position: "absolute",
          top: 72,
          right: 56,
          background: GOLD,
          color: NAVY,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: "0.18em",
          padding: "10px 18px",
          textTransform: "uppercase",
        }}
      >
        {editoriaUpper}
      </div>

      {/* Kicker */}
      <div
        style={{
          position: "absolute",
          bottom: 380,
          left: 56,
          right: 56,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: GOLD,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        {kicker}
      </div>

      {/* Headline — Georgia gigante */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          left: 56,
          right: 56,
          fontFamily: "Georgia, serif",
          fontSize: headline.length > 80 ? 60 : headline.length > 50 ? 72 : 84,
          fontWeight: 700,
          lineHeight: 1.04,
          letterSpacing: "-0.015em",
          color: OFF,
        }}
      >
        {headline}
      </div>

      {/* Subline */}
      {subline && (
        <div
          style={{
            position: "absolute",
            bottom: 90,
            left: 56,
            right: 56,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.3,
            color: "rgba(245,245,245,0.85)",
          }}
        >
          {subline}
        </div>
      )}

      {/* Footer bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: NAVY,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 56px",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(245,245,245,0.6)",
          borderTop: `3px solid ${GOLD}`,
        }}
      >
        <span>zimbanet.com</span>
        <span>{credit || "Imbituba conectada"}</span>
      </div>
    </div>
  );
}
