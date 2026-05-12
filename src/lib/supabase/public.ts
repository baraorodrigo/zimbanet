// Wrapper pro Supabase do "lado público" do portal (mural, bazar, /minha-conta,
// comments). Hoje aponta pro MESMO projeto do admin — quando criarmos o 2º
// projeto Supabase pra isolar auth público, troca-se só este arquivo (URLs e
// keys próprias) e o resto do código continua usando estas factories.
//
// NÃO usar pra rotas /admin/* — admin segue importando de "@/lib/supabase/server"
// e "@/lib/supabase/admin" (service-role).

import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function publicUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

function publicAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

// Browser client — use em "use client" components do portal público.
export function createPublicBrowserClient() {
  return createBrowserClient(publicUrl(), publicAnonKey());
}

// Server client — use em RSC, route handlers e Server Actions do portal público.
export function createPublicServerClient() {
  const cookieStore = cookies();
  return createServerClient(publicUrl(), publicAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Setado de RSC — middleware cuida do refresh.
        }
      },
    },
  });
}
