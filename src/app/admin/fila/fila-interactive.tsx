"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { publishBatch } from "@/lib/actions/articles";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
};

const Ctx = createContext<Ctx | null>(null);

function useSel(): Ctx {
  const c = useContext(Ctx);
  if (!c) throw new Error("FilaSelectionProvider ausente");
  return c;
}

export function FilaSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return <Ctx.Provider value={{ selected, toggle, clear }}>{children}</Ctx.Provider>;
}

export function FilaCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useSel();
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-ink-500">
      <input
        type="checkbox"
        checked={selected.has(id)}
        onChange={() => toggle(id)}
        className="w-4 h-4 accent-eco-green cursor-pointer"
        aria-label="Selecionar pra publicar em lote"
      />
      selecionar
    </label>
  );
}

export function FilaBulkBar() {
  const { selected, clear } = useSel();
  const [pending, start] = useTransition();
  const router = useRouter();
  const n = selected.size;
  if (n === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="max-w-[1180px] mx-auto px-4 lg:px-10 pb-4">
        <div className="pointer-events-auto rounded-lg bg-navy text-off-white shadow-z-3 border border-white/10 px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-display font-bold text-fs-14">
            {n} com foto selecionada{n > 1 ? "s" : ""}
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
                clear();
                await publishBatch(ids);
                router.refresh();
              })
            }
            className="h-9 px-4 rounded-md bg-eco-green text-white text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            ✓ Publicar {n} selecionada{n > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
