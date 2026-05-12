// Helpers pra abrir/fechar o modal de login público via URL state.
// O modal escuta `?login=1` (e `next=/x` opcional pra redirect pós-login).
// Mantém os outros search params da página intactos.

export const LOGIN_PARAM = "login";
export const LOGIN_NEXT_PARAM = "login_next";

function isSafeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

// Gera href pra abrir o modal preservando query atual.
export function openLoginHref(
  pathname: string,
  currentSearch: URLSearchParams | string | null,
  next?: string,
): string {
  const sp =
    currentSearch instanceof URLSearchParams
      ? new URLSearchParams(currentSearch)
      : new URLSearchParams(currentSearch ?? "");
  sp.set(LOGIN_PARAM, "1");
  const safeNext = isSafeNext(next);
  if (safeNext) sp.set(LOGIN_NEXT_PARAM, safeNext);
  else sp.delete(LOGIN_NEXT_PARAM);
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// Remove os params do modal e devolve a URL "limpa".
export function closeLoginHref(
  pathname: string,
  currentSearch: URLSearchParams | string | null,
): string {
  const sp =
    currentSearch instanceof URLSearchParams
      ? new URLSearchParams(currentSearch)
      : new URLSearchParams(currentSearch ?? "");
  sp.delete(LOGIN_PARAM);
  sp.delete(LOGIN_NEXT_PARAM);
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function readLoginParams(search: URLSearchParams | null): {
  open: boolean;
  next: string;
} {
  if (!search) return { open: false, next: "/" };
  const open = search.get(LOGIN_PARAM) === "1";
  const next = isSafeNext(search.get(LOGIN_NEXT_PARAM)) ?? "/";
  return { open, next };
}
