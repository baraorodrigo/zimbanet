// Story 1080×1920 — Instagram story, vertical, com sticker CTA.
// Search params: ?kicker=...&headline=...&cta=...&photo=...&editoria=...

type Search = Record<string, string | string[] | undefined>;
function pick(s: Search, k: string, fallback = "") {
  const v = s[k];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? fallback : fallback;
}

const NAVY = "#0D1B2A";
const NAVY_DEEP = "#15263A";
const GOLD = "#E8B100";
const OFF = "#F5F5F5";

export default function Story({ searchParams }: { searchParams: Search }) {
  const kicker = pick(searchParams, "kicker", "AGORA");
  const headline = pick(searchParams, "headline", "Manchete vertical");
  const cta = pick(searchParams, "cta", "Ler matéria");
  const photo = pick(searchParams, "photo", "");
  const editoria = pick(searchParams, "editoria", "cidade").toUpperCase();

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        position: "relative",
        background: NAVY,
        overflow: "hidden",
        color: OFF,
      }}
    >
      {/* Background — foto edge-to-edge ou pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: photo
            ? `url("${photo}") center/cover no-repeat`
            : `radial-gradient(circle at 25% 30%, rgba(232,177,0,0.35) 0%, rgba(232,177,0,0) 50%),
               repeating-linear-gradient(135deg, rgba(245,245,245,0.04) 0 8px, rgba(13,27,42,0) 8px 24px),
               linear-gradient(180deg, ${NAVY_DEEP} 0%, ${NAVY} 100%)`,
        }}
      />

      {/* Scrim mais agressivo (área de texto fica embaixo) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(13,27,42,0.55) 0%, rgba(13,27,42,0.10) 35%, rgba(13,27,42,0.55) 65%, rgba(13,27,42,0.96) 100%)`,
        }}
      />

      {/* Top bar — logo + editoria */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 60,
          right: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 38, letterSpacing: "0.04em" }}>
          ZIMBA<span style={{ color: GOLD }}>NET</span>
        </div>
        <div
          style={{
            background: GOLD,
            color: NAVY,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: "0.18em",
            padding: "10px 20px",
          }}
        >
          {editoria}
        </div>
      </div>

      {/* Faixa dourada decorativa abaixo do header */}
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 60,
          height: 4,
          width: "calc(100% - 120px)",
          background: "rgba(232,177,0,0.4)",
        }}
      />

      {/* Bloco de texto principal — meio-baixo da tela */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          bottom: 460,
        }}
      >
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 28,
            fontWeight: 800,
            color: GOLD,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 36,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontSize: headline.length > 60 ? 88 : 108,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: OFF,
          }}
        >
          {headline}
        </div>
      </div>

      {/* Sticker CTA */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 220,
          transform: "translateX(-50%)",
          background: GOLD,
          color: NAVY,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: "0.05em",
          padding: "26px 60px",
          textTransform: "uppercase",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        }}
      >
        ↑ {cta}
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(245,245,245,0.65)",
        }}
      >
        zimbanet.com
      </div>
    </div>
  );
}
