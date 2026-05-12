import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import CookieBanner from "@/components/cookie-banner";
import PostFab from "@/components/post-fab";

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const PLAUSIBLE_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ZIMBANET — Imbituba conectada",
    template: "%s · ZIMBANET",
  },
  description:
    "Portal de notícias e comunidade regional de Imbituba, SC. Cobertura: Imbituba, Garopaba, Laguna, Imaruí, Paulo Lopes e região.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://zimbanet.com"),
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ZIMBANET",
    title: "ZIMBANET — Imbituba conectada",
    description:
      "Portal de notícias e comunidade regional de Imbituba, SC.",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "ZIMBANET" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZIMBANET — Imbituba conectada",
    description: "Portal regional de Imbituba e do litoral sul de SC.",
    images: ["/api/og"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/logos/avatar-instagram.svg",
  },
  manifest: "/manifest.webmanifest",
  applicationName: "ZIMBANET",
  appleWebApp: {
    capable: true,
    title: "ZIMBANET",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0D1B2A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {PLAUSIBLE_DOMAIN && (
          <Script
            defer
            src={PLAUSIBLE_SRC}
            data-domain={PLAUSIBLE_DOMAIN}
            strategy="afterInteractive"
          />
        )}
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-zimba-gold focus:text-navy focus:px-4 focus:py-2 focus:font-bold focus:text-sm focus:rounded-xs focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-navy"
        >
          Pular pro conteúdo
        </a>
        <div id="conteudo" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <PostFab />
        <CookieBanner />
      </body>
    </html>
  );
}
