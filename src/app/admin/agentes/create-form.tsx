"use client";

import { useState } from "react";
import { createAgent } from "@/lib/actions/agents";
import { AGENT_PRESETS } from "@/lib/ai/agent-presets";

export function CreateAgentForm() {
  const [token, setToken] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setErr(null);
    setToken(null);
    setCopied(false);
    const res = await createAgent({
      name: String(fd.get("name") || ""),
      preset: String(fd.get("preset") || "editor"),
    });
    setBusy(false);
    if (res.ok) {
      setToken(res.token);
      setCreatedId(res.id);
      form.reset();
    } else {
      setErr(res.error);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-md border-2 border-border-subtle bg-white p-5">
      <p className="font-display font-black text-fs-16 text-navy">Criar novo agente</p>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-1">
            Nome
          </span>
          <input name="name" required placeholder="ex: Editor IA" autoComplete="off" className="input w-full" />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-1">
            Papel
          </span>
          <select name="preset" defaultValue="editor" className="input w-full">
            {Object.entries(AGENT_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-11 px-5 rounded-md bg-navy text-zimba-gold font-display font-bold text-[11px] uppercase tracking-[0.22em] hover:bg-zimba-gold hover:text-navy transition-colors disabled:opacity-50"
        >
          {busy ? "Criando…" : "Criar agente"}
        </button>
      </form>

      {err && (
        <p className="mt-3 rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {err}
        </p>
      )}

      {token && (
        <div className="mt-4 rounded-md border-2 border-zimba-gold bg-zimba-gold/5 p-4">
          <p className="text-fs-14 text-navy">
            Agente <strong>{createdId}</strong> criado. <strong>Copie o token agora</strong> — ele não
            aparece de novo:
          </p>
          <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
            <code className="flex-1 font-mono text-fs-12 break-all bg-white border border-border-subtle rounded p-2.5">
              {token}
            </code>
            <button
              type="button"
              onClick={copy}
              className="h-10 px-4 rounded-md bg-navy text-zimba-gold font-display font-bold text-[11px] uppercase tracking-[0.22em] hover:bg-zimba-gold hover:text-navy transition-colors shrink-0"
            >
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-fs-12 text-ink-500">
            Cole no <code className="font-mono">AGENT_TOKEN</code> da config do <code className="font-mono">zimbanet-mcp</code> no Hermes.
          </p>
        </div>
      )}
    </div>
  );
}
