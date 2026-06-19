"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { redigirScored, redigirBatch } from "@/lib/actions/articles";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
  gerando: Set<string>;
  startGerando: (ids: string[]) => void;
};

const SelCtx = createContext<Ctx | null>(null);

function useSel(): Ctx {
  const c = useContext(SelCtx);
  if (!c) throw new Error("PautaSelectionProvider ausente");
  return c;
}

export function PautaSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gerando, setGerando] = useState<Set<string>>(new Set());
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  // Marca itens como "escrevendo…" e fica atualizando a Pauta sozinha por ~80s
  // pra o card virar "rascunho pronto" quando o motor terminar (~30s/item).
  const startGerando = useCallback(
    (ids: string[]) => {
      setGerando((g) => {
        const n = new Set(g);
        ids.forEach((i) => n.add(i));
        return n;
      });
      if (pollRef.current) clearInterval(pollRef.current);
      let count = 0;
      pollRef.current = setInterval(() => {
        count += 1;
        router.refresh();
        if (count >= 8) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setGerando(new Set());
        }
      }, 10000);
    },
    [router],
  );

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  return (
    <SelCtx.Provider value={{ selected, toggle, clear, gerando, startGerando }}>
      {children}
    </SelCtx.Provider>
  );
}

export function PautaCheckbox({ id }: { id: string }) {
  const { selected, toggle, gerando } = useSel();
  if (gerando.has(id)) return null;
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-ink-500">
      <input
        type="checkbox"
        checked={selected.has(id)}
        onChange={() => toggle(id)}
        className="w-4 h-4 accent-zimba-gold cursor-pointer"
        aria-label="Selecionar pra redigir em lote"
      />
      selecionar
    </label>
  );
}

export function RedigirButton({ scoredId }: { scoredId: string }) {
  const { gerando, startGerando } = useSel();
  const [pending, start] = useTransition();
  const isGerando = gerando.has(scoredId);

  if (isGerando) {
    return (
      <span className="flex-1 h-10 rounded-md bg-zimba-gold/30 text-navy text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center justify-center gap-2">
        <span className="w-3.5 h-3.5 border-2 border-navy/40 border-t-navy rounded-full animate-spin" />
        escrevendo…
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          startGerando([scoredId]);
          await redigirScored(scoredId);
        })
      }
      title="Investigador + Redator em segundo plano. Você fica aqui na Pauta."
      className="flex-1 h-10 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60"
    >
      ✨ Redigir com IA
    </button>
  );
}

export function PautaBulkBar() {
  const { selected, clear, startGerando } = useSel();
  const [pending, start] = useTransition();
  const n = selected.size;
  if (n === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="max-w-[1180px] mx-auto px-4 lg:px-10 pb-4">
        <div className="pointer-events-auto rounded-lg bg-navy text-off-white shadow-z-3 border border-white/10 px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-display font-bold text-fs-14">
            {n} pauta{n > 1 ? "s" : ""} selecionada{n > 1 ? "s" : ""}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={clear}
            className="h-9 px-3 rounded-md text-[11px] uppercase tracking-[0.22em] font-bold text-off-white/70 hover:text-off-white"
          >
            limpar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const ids = [...selected];
                startGerando(ids);
                clear();
                await redigirBatch(ids);
              })
            }
            className="h-9 px-4 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-white transition-colors disabled:opacity-60"
          >
            ✨ Redigir {n} selecionada{n > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
