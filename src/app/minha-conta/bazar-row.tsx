"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/icon";
import {
  deleteBazarItem,
  setBazarItemStatus,
} from "@/lib/actions/my-account";
import type { MyBazarItem } from "@/lib/db/my-account";

const STATUS_LABEL: Record<MyBazarItem["status"], string> = {
  active: "Ativo",
  sold: "Vendido",
  expired: "Expirado",
  removed: "Removido",
};

const STATUS_BADGE: Record<MyBazarItem["status"], string> = {
  active: "bg-eco-green text-off-white",
  sold: "bg-navy text-off-white",
  expired: "bg-navy/30 text-navy",
  removed: "bg-alert-red/15 text-alert-red",
};

function priceLabel(it: MyBazarItem): string {
  if (it.price_label) return it.price_label;
  if (it.price_cents != null && it.price_cents > 0) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(it.price_cents / 100);
  }
  return "A combinar";
}

export default function BazarRow({ item }: { item: MyBazarItem }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeStatus(next: MyBazarItem["status"]) {
    setError(null);
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("status", next);
    start(async () => {
      const res = await setBazarItemStatus(fd);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    if (!confirm("Apagar este anúncio? Não dá pra desfazer.")) return;
    setError(null);
    const fd = new FormData();
    fd.set("id", item.id);
    start(async () => {
      const res = await deleteBazarItem(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <article className="border border-border-subtle bg-white p-4 flex flex-col sm:flex-row gap-4">
      <div className="w-full sm:w-24 sm:h-24 aspect-square bg-navy/5 flex items-center justify-center shrink-0">
        <span className="font-display italic text-navy/20 text-[44px] leading-none select-none">
          {item.title[0]}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <span
            className={`text-[9px] uppercase tracking-[0.22em] font-bold px-2 py-0.5 ${STATUS_BADGE[item.status]}`}
          >
            {STATUS_LABEL[item.status]}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-navy/50">
            {item.type} · {item.bairro}
          </span>
        </div>
        <Link
          href={`/bazardazimba/${item.id}`}
          className="block font-display font-bold text-fs-16 text-navy hover:text-zimba-blue leading-tight line-clamp-2"
        >
          {item.title}
        </Link>
        <p className="font-display font-black text-fs-15 text-navy mt-1">
          {priceLabel(item)}
        </p>
        {error && (
          <p className="mt-2 text-fs-12 text-alert-red">{error}</p>
        )}
      </div>

      <div className="flex flex-wrap sm:flex-col gap-2 sm:w-44 shrink-0">
        {item.status === "active" && (
          <button
            type="button"
            onClick={() => changeStatus("sold")}
            disabled={pending}
            className="text-[10px] uppercase tracking-[0.22em] font-bold px-3 h-9 border border-navy text-navy hover:bg-navy hover:text-off-white transition-colors disabled:opacity-50"
          >
            <Icon name="check" size={12} className="inline mr-1" />
            Marcar vendido
          </button>
        )}
        {item.status === "sold" && (
          <button
            type="button"
            onClick={() => changeStatus("active")}
            disabled={pending}
            className="text-[10px] uppercase tracking-[0.22em] font-bold px-3 h-9 border border-eco-green text-eco-green hover:bg-eco-green hover:text-off-white transition-colors disabled:opacity-50"
          >
            Reativar
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-[10px] uppercase tracking-[0.22em] font-bold px-3 h-9 border border-alert-red/40 text-alert-red hover:bg-alert-red hover:text-off-white transition-colors disabled:opacity-50"
        >
          Apagar
        </button>
      </div>
    </article>
  );
}
