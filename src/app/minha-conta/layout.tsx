import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "Minha conta · ZIMBANET",
  description: "Gerencie seus anúncios no bazar e posts no mural.",
  robots: { index: false, follow: false },
};

export default async function MinhaContaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser({ next: "/minha-conta" });
  return <>{children}</>;
}
