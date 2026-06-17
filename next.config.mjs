/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera um servidor mínimo (~150MB vs ~1GB) — necessário pro Docker.
  output: "standalone",
  experimental: {
    // Default do Next 14 é 1MB. Subimos pra cobrir upload de vídeo manual
    // (limite efetivo enforçado em src/lib/actions/uploads.ts: 50MB).
    serverActions: { bodySizeLimit: "52mb" },
  },
  images: {
    // ZIMBANET agrega fotos de MUITAS fontes regionais (e sempre entra fonte
    // nova). Allowlist fixa quebrava: foto de fonte recém-adicionada não
    // carregava (next/image devolvia 400 -> imagem quebrada na home). Liberamos
    // qualquer host https — só URLs que o próprio site renderiza em <Image>
    // passam pelo otimizador, e o fetch server-side (downloadAndStoreImage) já
    // tem guard próprio de SSRF (IPs privados/loopback) em storage-images.ts.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://plausible.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https://*.supabase.co https://*.supabase.in",
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
