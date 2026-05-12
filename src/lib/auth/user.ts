import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PARAM, LOGIN_NEXT_PARAM } from "./login-url";

// Gate pro painel público "/minha-conta": exige user logado, mas SEM exigir role.
// Quando não logado, manda pra "/" com ?login=1 pra abrir o modal direto.
export async function requireUser(opts: { next?: string } = {}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = opts.next ?? "/minha-conta";
    const qs = new URLSearchParams();
    qs.set(LOGIN_PARAM, "1");
    qs.set(LOGIN_NEXT_PARAM, next);
    redirect(`/?${qs.toString()}`);
  }
  return { user, supabase };
}
