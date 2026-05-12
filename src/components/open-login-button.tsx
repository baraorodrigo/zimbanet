"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { openLoginHref } from "@/lib/auth/login-url";

type Props = {
  children: React.ReactNode;
  className?: string;
  next?: string;
  onClick?: () => void;
};

// Botão que abre o modal de login público (AuthModal monitora `?login=1`).
// Usar em qualquer lugar que precise gatilhar auth sem mandar pra /login (página).
export default function OpenLoginButton({ children, className, next, onClick }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function handleClick() {
    onClick?.();
    const href = openLoginHref(pathname ?? "/", search, next);
    router.push(href, { scroll: false });
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
