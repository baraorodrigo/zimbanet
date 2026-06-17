"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Mostrado quando o "Redigir com AI" foi disparado (assíncrono): atualiza a Fila
// sozinha algumas vezes pra o rascunho aparecer sem o usuário recarregar, e some.
export function GerandoBanner() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= 3) {
        setDone(true);
        clearInterval(id);
      }
    }, 12000);
    return () => clearInterval(id);
  }, [router]);

  if (done) return null;
  return (
    <div className="mt-6 flex items-center gap-3 rounded-md border-2 border-zimba-gold bg-zimba-gold/5 p-4">
      <span
        aria-hidden
        className="h-4 w-4 shrink-0 rounded-full border-2 border-zimba-gold border-r-transparent animate-spin"
      />
      <p className="text-fs-14 text-navy">
        ✍️ <strong>Rascunho sendo gerado pela IA</strong> — aparece aqui em ~30s. A página atualiza
        sozinha.
      </p>
    </div>
  );
}
