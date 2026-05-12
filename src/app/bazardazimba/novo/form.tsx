"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { createBazarItem, type ActionResult } from "@/lib/actions/community";
import { ImagePicker } from "@/components/image-picker";

const tipos = [
  { v: "Vende", desc: "Vender" },
  { v: "Doa", desc: "Doar" },
  { v: "Troca", desc: "Trocar" },
  { v: "Procura", desc: "Procurar" },
] as const;

const categorias = [
  "Eletrônicos",
  "Móveis",
  "Esporte",
  "Moda",
  "Casa",
  "Auto",
  "Serviços",
  "Outros",
];

const bairros = [
  "Centro",
  "Vila Nova",
  "Praia da Vila",
  "Itapirubá",
  "Mirim",
  "Nova Brasília",
  "Alto Arroio",
  "Guarda do Embaú",
  "Sambaqui",
  "Arroio",
  "Outro / não listado",
];

type State = ActionResult<{ id: string; status: "published" | "pending_confirmation" }> | null;

async function submit(_prev: State, formData: FormData): Promise<State> {
  return await createBazarItem(formData);
}

function PublishButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { pending } = useFormStatus();
  const idleLabel = isLoggedIn ? "Publicar anúncio" : "Publicar e confirmar";
  const pendingLabel = isLoggedIn ? "Publicando…" : "Enviando link…";
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-8 h-12 inline-flex items-center justify-center hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

const labelCls = "text-fs-13 font-semibold text-navy mb-1.5 block";
const inputCls =
  "w-full h-12 rounded-md border border-border-subtle bg-white px-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none";

type Props = { isLoggedIn: boolean };

export default function BazarNovoForm({ isLoggedIn }: Props) {
  const [state, formAction] = useFormState<State, FormData>(submit, null);
  const [tipo, setTipo] = useState<(typeof tipos)[number]["v"]>("Vende");
  const errorMsg = state && state.ok === false ? state.error : null;
  const ok = state && state.ok === true;
  const pendingConfirm = ok && state.data?.status === "pending_confirmation";
  const publishedNow = ok && state.data?.status === "published";

  return (
    <form action={formAction} className="space-y-6">
      {/* Tipo — segmented pill */}
      <div>
        <span className={labelCls}>Quero…</span>
        <div className="grid grid-cols-4 gap-2">
          {tipos.map((t) => (
            <label
              key={t.v}
              className={`cursor-pointer text-center rounded-md border px-2 h-12 inline-flex items-center justify-center text-fs-14 font-bold transition-colors ${
                tipo === t.v
                  ? "border-navy bg-navy text-off-white"
                  : "border-border-subtle bg-white text-navy hover:border-navy"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t.v}
                checked={tipo === t.v}
                onChange={() => setTipo(t.v)}
                className="sr-only"
                required
              />
              {t.desc}
            </label>
          ))}
        </div>
      </div>

      {/* Título */}
      <label className="block">
        <span className={labelCls}>Título</span>
        <input
          type="text"
          name="title"
          required
          minLength={3}
          maxLength={120}
          placeholder="Ex.: Bicicleta aro 26 azul, semi-nova"
          className={inputCls}
        />
      </label>

      {/* Preço + Bairro + WhatsApp */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className={tipo === "Vende" ? "block" : "block opacity-60"}>
          <span className={labelCls}>
            Preço{" "}
            {tipo !== "Vende" && (
              <span className="text-ink-400 font-normal">(opcional)</span>
            )}
          </span>
          <input
            type="text"
            name="price"
            placeholder={tipo === "Vende" ? "R$ 350" : "—"}
            disabled={tipo !== "Vende"}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Bairro</span>
          <select
            name="bairro"
            required
            defaultValue=""
            className={inputCls}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {bairros.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>WhatsApp</span>
          <input
            type="tel"
            name="whatsapp"
            required
            autoComplete="tel"
            placeholder="(48) 99999-9999"
            className={inputCls}
          />
        </label>
      </div>

      {/* Foto + descrição lado a lado em desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="rounded-md border border-border-subtle bg-white p-3">
          <ImagePicker
            name="photo_url"
            scope="bazar"
            label="Foto"
            hint="Anúncios com foto vendem 3x mais."
            aspect="square"
          />
        </div>
        <label className="block">
          <span className={labelCls}>Descrição</span>
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={2000}
            rows={6}
            placeholder="Estado de conservação, motivo da venda, condições de retirada…"
            className="w-full rounded-md border border-border-subtle bg-white p-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none resize-none h-[152px] lg:h-full"
          />
        </label>
      </div>

      {/* Email pra guest — visível só pra não-logado */}
      {!isLoggedIn && (
        <label className="block">
          <span className={labelCls}>
            Seu email{" "}
            <span className="text-ink-400 font-normal">
              (mandamos link pra confirmar)
            </span>
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="voce@email.com"
            className={inputCls}
          />
        </label>
      )}

      {/* Avançado: categoria */}
      <details className="group border-t border-border-subtle pt-4">
        <summary className="cursor-pointer list-none flex items-center justify-between text-[11px] uppercase tracking-[0.22em] font-bold text-navy/70 hover:text-navy">
          <span>Mais opções</span>
          <span className="text-navy/40 group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <div className="pt-4">
          <label className="block max-w-sm">
            <span className={labelCls}>Categoria</span>
            <select
              name="category"
              defaultValue=""
              className={inputCls}
            >
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      {errorMsg && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          {errorMsg}
        </div>
      )}
      {publishedNow && (
        <div className="rounded-md border border-eco-green bg-eco-green/5 p-4 text-fs-14 text-eco-green">
          Anúncio publicado.{" "}
          <Link href="/bazardazimba" className="font-bold underline">
            Ver no #bazardazimba
          </Link>
        </div>
      )}
      {pendingConfirm && (
        <div className="rounded-md border-2 border-eco-green bg-eco-green/5 p-5 space-y-2">
          <p className="font-display font-bold text-fs-18 text-navy">
            Quase lá! Confere seu email.
          </p>
          <p className="text-fs-14 text-ink-700">
            Mandei um link pro email que você informou. Clica nele em até 1
            hora pra publicar o anúncio. Depois disso você nem precisa logar
            pra anunciar de novo.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border-subtle">
        <PublishButton isLoggedIn={isLoggedIn} />
        <Link
          href="/bazardazimba"
          className="border border-navy/20 text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-7 h-12 inline-flex items-center justify-center hover:border-navy transition-colors"
        >
          Cancelar
        </Link>
      </div>

      <p className="text-fs-12 text-ink-500 leading-relaxed max-w-[60ch]">
        <strong className="text-alert-red">Cuidado com golpes:</strong> combine
        sempre em pessoa, em local público. Nunca pague antes de ver o item.
        ZIMBANET não intermedia negociações.
      </p>
    </form>
  );
}
