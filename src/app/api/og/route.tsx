import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const NAVY = "#0D1B2A";
const GOLD = "#E8B100";
const OFF_WHITE = "#F5F5F5";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = (searchParams.get("title") ?? "ZIMBANET").slice(0, 200);
  const editoria = (searchParams.get("editoria") ?? "Imbituba conectada").slice(0, 60);
  const kicker = (searchParams.get("kicker") ?? "").slice(0, 80);
  const isBreaking = searchParams.get("breaking") === "1";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: NAVY,
          color: OFF_WHITE,
          display: "flex",
          flexDirection: "column",
          padding: "64px",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(0deg, ${GOLD}10 1px, transparent 1px), linear-gradient(90deg, ${GOLD}10 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
            opacity: 0.18,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            position: "relative",
          }}
        >
          <span
            style={{
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              fontFamily: "Inter, sans-serif",
            }}
          >
            ZIMBA<span style={{ color: GOLD }}>NET</span>
          </span>
          {isBreaking && (
            <span
              style={{
                marginLeft: "auto",
                background: "#C62828",
                color: OFF_WHITE,
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "8px 16px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              ◉ Breaking
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            position: "relative",
          }}
        >
          {kicker && (
            <p
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: GOLD,
                margin: 0,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {kicker}
            </p>
          )}
          <h1
            style={{
              fontSize: title.length > 80 ? 56 : 72,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              margin: 0,
              maxWidth: "1000px",
            }}
          >
            {title}
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginTop: "12px",
            }}
          >
            <span
              style={{
                width: "40px",
                height: "3px",
                background: GOLD,
              }}
            />
            <span
              style={{
                fontSize: 20,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: OFF_WHITE,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {editoria}
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
