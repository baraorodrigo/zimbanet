// Banner 1200×630 — Open Graph / Facebook / WhatsApp link preview.
// Search params: ?title=...&kicker=...&editoria=...&photo=...

type Search = Record<string, string | string[] | undefined>;
function pick(s: Search, k: string, fallback = "") {
  const v = s[k];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? fallback : fallback;
}

const NAVY = "#0D1B2A";
const NAVY_DEEP = "#15263A";
const GOLD = "#E8B100";
const OFF = "#F5F5F5";

export default function Banner({ searchParams }: { searchParams: Search }) {
  const kicker = pick(searchParams, "kicker", "ZIMBANET");
  const title = pick(searchParams, "title", "Manchete da matéria do portal");
  const editoria = pick(searchParams, "editoria", "cidade").toUpperCase();
  const photo = pick(searchParams, "photo", "");

  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        background: NAVY,
        overflow: "hidden",
        color: OFF,
      }}
    >
      {/* Coluna esquerda — texto (1.1fr) */}
      <div
        style={{
          flex: 1.1,
          padding: "52px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: NAVY,
          position: "relative",
        }}
      >
        {/* Top: logo + faixa */}
        <div>
          <div style={{ height: 4, width: 80, background: GOLD, marginBottom: 18 }} />
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: "0.04em",
            }}
          >
            ZIMBA<span style={{ color: GOLD }}>NET</span>
          </div>
        </div>

        {/* Middle: kicker + título */}
        <div>
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 800,
              color: GOLD,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: title.length > 90 ? 36 : title.length > 60 ? 42 : 50,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.015em",
              color: OFF,
            }}
          >
            {title}
          </div>
        </div>

        {/* Footer: editoria + URL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(245,245,245,0.55)",
          }}
        >
          <span>zimbanet.com</span>
          <span style={{ color: GOLD, letterSpacing: "0.18em" }}>{editoria}</span>
        </div>
      </div>

      {/* Coluna direita — foto (1fr) */}
      <div
        style={{
          flex: 1,
          position: "relative",
          background: photo
            ? `url("${photo}") center/cover no-repeat`
            : `radial-gradient(circle at 30% 35%, rgba(232,177,0,0.45) 0%, rgba(232,177,0,0) 50%),
               repeating-linear-gradient(135deg, rgba(245,245,245,0.05) 0 8px, rgba(13,27,42,0) 8px 24px),
               linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 60%, #1B3A5C 100%)`,
        }}
      >
        {/* Scrim na borda esquerda — transição suave da coluna de texto */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, ${NAVY} 0%, rgba(13,27,42,0.0) 18%)`,
          }}
        />
      </div>
    </div>
  );
}
