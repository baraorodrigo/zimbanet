import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Painel · ZIMBANET",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-screen bg-off-white lg:grid lg:grid-cols-[260px_1fr]">
      <AdminSidebar email={user.email ?? null} />
      <main className="min-w-0">
        <div className="max-w-[1180px] mx-auto px-4 lg:px-10 pt-14 lg:pt-10 pb-8 lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
