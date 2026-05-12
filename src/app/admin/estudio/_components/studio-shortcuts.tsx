"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  articleId: string;
  socialPostId: string | null;
  channels: Array<{ channel: string }>;
};

// StudioShortcuts — Fase D. Atalhos globais que NÃO são tratados pelo
// canvas-stage (ele cuida de ⌘↵/⌘⌫). Aqui:
//   G   -> dispatch zb-empty-action {action:"generate"}  (gera variações)
//   S   -> dispatch zb-empty-action {action:"source"}    (puxa hero)
//   U   -> dispatch zb-empty-action {action:"upload"}    (abre file picker)
//   A   -> dispatch zb-empty-action {action:"auto-adapt"} (não usado direto, reservado)
//   1-7 -> troca canal ativo via router.push?ch=...
// Todos só disparam fora de input/textarea pra não atrapalhar digitação.
export function StudioShortcuts({ articleId, socialPostId, channels }: Props) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable);
      if (inEditable) return;

      // Ignora se modificadores (⌘↵/⌘⌫ são do canvas-stage)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (socialPostId && (key === "g" || key === "s" || key === "u")) {
        e.preventDefault();
        const action = key === "g" ? "generate" : key === "s" ? "source" : "upload";
        window.dispatchEvent(
          new CustomEvent("zb-empty-action", {
            detail: { action, articleId, socialPostId },
          }),
        );
        return;
      }

      // Trocar canal por número 1..7
      if (/^[1-7]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const target = channels[idx];
        if (target) {
          e.preventDefault();
          router.push(`/admin/estudio/${articleId}?ch=${target.channel}`);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [articleId, socialPostId, channels, router]);

  return null;
}
