/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allowlist explícito — evita que `next/image` vire proxy aberto pra
    // qualquer host (custo de banda + risco de abuso de cache). Para liberar
    // uma fonte regional nova, adicionar aqui e reiniciar o dev.
    // Servidor-side fetch (downloadAndStoreImage) tem guard próprio em
    // src/lib/storage-images.ts contra SSRF (IPs privados/loopback).
    remotePatterns: [
      // Supabase Storage (onde nossas imagens vivem definitivamente)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },

      // Portais regionais cobertos pelo radar
      { protocol: "https", hostname: "portalahora.com.br" },
      { protocol: "https", hostname: "**.portalahora.com.br" },
      { protocol: "https", hostname: "portalclicksul.com.br" },
      { protocol: "https", hostname: "**.portalclicksul.com.br" },
      { protocol: "https", hostname: "ndmais.com.br" },
      { protocol: "https", hostname: "**.ndmais.com.br" },
      { protocol: "https", hostname: "notisul.com.br" },
      { protocol: "https", hostname: "**.notisul.com.br" },
      { protocol: "https", hostname: "agoralaguna.com.br" },
      { protocol: "https", hostname: "**.agoralaguna.com.br" },
      { protocol: "https", hostname: "engeplus.com.br" },
      { protocol: "https", hostname: "**.engeplus.com.br" },
      { protocol: "https", hostname: "imbituba.sc.gov.br" },
      { protocol: "https", hostname: "**.imbituba.sc.gov.br" },

      // CDNs comuns usadas por WordPress, Jetpack, Cloudfront etc.
      { protocol: "https", hostname: "*.wp.com" },
      { protocol: "https", hostname: "*.wordpress.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "*.cdninstagram.com" },

      // Geração de imagem IA (Fal.ai e congêneres) — bate aqui antes de ir
      // pro storage via downloadAndStoreImage
      { protocol: "https", hostname: "*.fal.media" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "*.fal.ai" },
      { protocol: "https", hostname: "v3.fal.media" },
      { protocol: "https", hostname: "replicate.delivery" },
    ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://plausible.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://plausible.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
