// Embed de vídeo em matéria — aceita URL pública de YouTube, Instagram
// (Reels/IGTV) ou TikTok. O provider é detectado pela URL; renderiza
// iframe responsivo 16:9 com lazy-loading. Sem upload — quem hospeda
// continua sendo a plataforma original.

type Provider = "youtube" | "instagram" | "tiktok" | "unknown";

type ParsedVideo = {
  provider: Provider;
  embedUrl: string;
  title: string;
  /** Aspect ratio do iframe: 16/9 horizontal, 9/16 vertical pra Reels/TikTok */
  aspectRatio: "16/9" | "9/16";
};

// Cobre formatos comuns: youtu.be/<id>, watch?v=<id>, shorts/<id>, embed/<id>.
function parseYouTube(url: URL): ParsedVideo | null {
  const host = url.hostname.replace(/^www\./, "");
  let id: string | null = null;
  let isShort = false;

  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1]) {
      id = parts[1];
      isShort = true;
    } else if (parts[0] === "embed" && parts[1]) {
      id = parts[1];
    } else {
      id = url.searchParams.get("v");
    }
  }

  if (!id || !/^[\w-]{6,}$/.test(id)) return null;
  return {
    provider: "youtube",
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    title: "Vídeo no YouTube",
    aspectRatio: isShort ? "9/16" : "16/9",
  };
}

function parseInstagram(url: URL): ParsedVideo | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "instagram.com" && !host.endsWith(".instagram.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // /reel/<id>, /p/<id>, /tv/<id>
  const kind = parts[0];
  const id = parts[1];
  if (!["reel", "reels", "p", "tv"].includes(kind ?? "") || !id) return null;
  return {
    provider: "instagram",
    embedUrl: `https://www.instagram.com/${kind}/${id}/embed/`,
    title: "Post no Instagram",
    aspectRatio: kind === "reel" || kind === "reels" ? "9/16" : "16/9",
  };
}

function parseTikTok(url: URL): ParsedVideo | null {
  const host = url.hostname.replace(/^www\./, "");
  if (!host.endsWith("tiktok.com")) return null;
  // /@user/video/<id>
  const m = url.pathname.match(/\/video\/(\d+)/);
  if (!m) return null;
  return {
    provider: "tiktok",
    embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`,
    title: "Vídeo no TikTok",
    aspectRatio: "9/16",
  };
}

export function parseVideoUrl(raw: string | null | undefined): ParsedVideo | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  return parseYouTube(url) ?? parseInstagram(url) ?? parseTikTok(url);
}

type Props = {
  url: string;
  /** Quando true, mostra cantos arredondados e shadow leve. Default: true. */
  framed?: boolean;
  className?: string;
};

export default function VideoEmbed({ url, framed = true, className = "" }: Props) {
  const parsed = parseVideoUrl(url);
  if (!parsed) {
    // URL inválida ou provider não suportado: mostra um link simples
    // como fallback (degraded gracefully, sem quebrar o layout).
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-md border border-border-subtle bg-white px-4 py-3 text-fs-13 text-navy hover:border-navy ${className}`}
      >
        ▶ Assistir no link original ↗
      </a>
    );
  }

  const wrapperBase =
    "relative w-full overflow-hidden bg-black";
  const wrapperFrame = framed ? "rounded-md shadow-z-1" : "";
  // 9/16 (vertical) limita largura pra não ficar gigante em desktop.
  const verticalCap = parsed.aspectRatio === "9/16" ? "max-w-[400px] mx-auto" : "";

  return (
    <div
      className={`${wrapperBase} ${wrapperFrame} ${verticalCap} ${className}`}
      style={{ aspectRatio: parsed.aspectRatio }}
    >
      <iframe
        src={parsed.embedUrl}
        title={parsed.title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
