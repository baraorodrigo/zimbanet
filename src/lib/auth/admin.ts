import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "admin" | "editor";

export function roleFromUser(user: User | null | undefined): AdminRole | null {
  if (!user) return null;
  const role = (user.app_metadata?.role as string | undefined) ?? null;
  if (role === "admin" || role === "editor") return role;
  return null;
}

export function isAdmin(user: User | null | undefined): boolean {
  return roleFromUser(user) === "admin";
}

export function isStaff(user: User | null | undefined): boolean {
  return roleFromUser(user) !== null;
}

// Server-side helper. Redireciona pra /login com next= ou /
// se logado mas sem role. Use no início de páginas/actions do /admin.
export async function requireAdmin(opts: { next?: string } = {}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = opts.next ?? "/admin";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!isStaff(user)) {
    redirect("/?erro=" + encodeURIComponent("Sem permissão pra acessar o painel."));
  }
  return { user, supabase };
}
