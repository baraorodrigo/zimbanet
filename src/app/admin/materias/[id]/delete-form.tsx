"use client";

import { deleteArticle } from "@/lib/actions/articles";

export default function DeleteForm({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteArticle}
      onSubmit={(e) => {
        if (!window.confirm(`Apagar definitivamente "${title}"? Não tem como voltar atrás.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="h-9 px-4 rounded-md border border-alert-red/40 text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-alert-red hover:text-white transition-colors"
      >
        Apagar
      </button>
    </form>
  );
}
