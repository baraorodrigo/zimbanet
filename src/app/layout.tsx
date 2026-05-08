import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL("https://zimbanet.com.br"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
