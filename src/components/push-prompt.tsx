"use client";

// Componente client-side que pede permissão e registra a PushSubscription.
// Mostrar via /push ou rodapé do portal — não é modal agressivo.
//
// Requer NEXT_PUBLIC_VAPID_PUBLIC_KEY no env.

import { useEffect, useState } from "react";

const PUBLIC_VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

const EDITORIA_OPTIONS: { slug: string; label: string }[] = [
  { slug: "cidade", label: "Cidade" },
  { slug: "politica", label: "Política" },
  { slug: "esporte", label: "Esporte" },
  { slug: "cultura", label: "Cultura" },
  { slug: "policia", label: "Polícia" },
  { slug: "praias", label: "Praias" },
];

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushPrompt() {
  const [status, setStatus] = useState<
    "idle" | "subscribing" | "ok" | "error" | "denied" | "unsupported"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [allEditorias, setAllEditorias] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
    }
  }, []);

  function toggleEditoria(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function subscribe() {
    if (!PUBLIC_VAPID) {
      setError("VAPID public key não configurada");
      setStatus("error");
      return;
    }
    setStatus("subscribing");
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID),
      });

      const editorias = allEditorias ? [] : Array.from(selected);

      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          editorias,
          user_agent: navigator.userAgent,
        }),
      });
      if (!r.ok) throw new Error(`subscribe falhou: ${r.status}`);
      setStatus("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-navy/70">
        Seu navegador não suporta notificações push.
      </p>
    );
  }

  const customDisabled = allEditorias;
  const cantSubscribe = !allEditorias && selected.size === 0;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="font-sans text-[11px] uppercase tracking-[0.22em] font-bold text-navy/70 mb-1">
          O que você quer receber?
        </legend>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="zb-push-scope"
            checked={allEditorias}
            onChange={() => setAllEditorias(true)}
            className="mt-1 accent-zimba-gold"
          />
          <span className="font-sans text-fs-14 text-navy">
            <span className="font-bold">Tudo</span>
            <span className="block text-fs-12 text-ink-500">
              Breaking + alertas das principais editorias.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="zb-push-scope"
            checked={!allEditorias}
            onChange={() => setAllEditorias(false)}
            className="mt-1 accent-zimba-gold"
          />
          <span className="font-sans text-fs-14 text-navy">
            <span className="font-bold">Selecionar editorias</span>
            <span className="block text-fs-12 text-ink-500">
              Recebe só o que você marcar abaixo.
            </span>
          </span>
        </label>

        <div
          className={`grid grid-cols-2 gap-2 mt-1 pl-7 transition-opacity ${
            customDisabled ? "opacity-40 pointer-events-none" : "opacity-100"
          }`}
        >
          {EDITORIA_OPTIONS.map((e) => {
            const checked = selected.has(e.slug);
            return (
              <label
                key={e.slug}
                className={`flex items-center gap-2 px-3 h-9 rounded-xs cursor-pointer text-fs-13 font-semibold border transition-colors ${
                  checked
                    ? "bg-zimba-gold text-navy border-zimba-gold"
                    : "bg-white text-navy/70 border-navy/15 hover:border-zimba-gold"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={customDisabled}
                  onChange={() => toggleEditoria(e.slug)}
                  className="sr-only"
                />
                {e.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        onClick={subscribe}
        disabled={
          status === "subscribing" || status === "ok" || cantSubscribe
        }
        className="rounded-sm bg-zimba-gold px-5 py-3 font-sans text-sm font-bold uppercase tracking-widest text-navy transition hover:bg-zimba-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "ok"
          ? "Inscrito ✓"
          : status === "subscribing"
            ? "Inscrevendo…"
            : "Receber alertas"}
      </button>
      {cantSubscribe && (
        <p className="text-fs-12 text-ink-500">
          Marque ao menos uma editoria — ou volte pra opção &ldquo;Tudo&rdquo;.
        </p>
      )}
      {status === "denied" && (
        <p className="text-sm text-alert-red">
          Permissão negada. Habilite nas configurações do navegador.
        </p>
      )}
      {status === "error" && error && (
        <p className="text-sm text-alert-red">Erro: {error}</p>
      )}
    </div>
  );
}
