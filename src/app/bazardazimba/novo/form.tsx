"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { createBazarItem, type ActionResult } from "@/lib/actions/community";
import { ImagePicker } from "@/components/image-picker";

const tipos = [
  { v: "Vende", desc: "Tem algo pra vender" },
  { v: "Doa", desc: "Vai dar de graça" },
  { v: "Troca", desc: "Quer trocar por outra coisa" },
  { v: "Procura", desc: "Tá atrás de algo" },
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

type Props = { isLoggedIn: boolean };

export default function BazarNovoForm({ isLoggedIn }: Props) {
  const [state, formAction] = useFormState<State, FormData>(submit, null);
  const errorMsg = state && state.ok === false ? state.error : null;
  const ok = state && state.ok === true;
  const pendingConfirm = ok && state.data?.status === "pending_confirmation";
  const publishedNow = ok && state.data?.status === "published";

  return (
    <form action={formAction} className="space-y-8">
      {/* Tipo */}
      <fieldset>
        <legend className="font-display font-bold text-fs-18 text-navy mb-3">
          1. Você quer…
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tipos.map((t, i) => (
            <label
              key={t.v}
              className="cursor-pointer border rounded-md p-4 transition-colors border-border-subtle bg-white hover:border-navy has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-off-white"
            >
              <input
                type="radio"
                name="type"
                value={t.v}
                defaultChecked={i === 0}
                className="sr-only"
                required
              />
              <div className="font-display font-black text-fs-18">{t.v}</div>
              <div className="text-fs-12 mt-1 text-ink-500 group-has-[:checked]:text-off-white/70">
                {t.desc}
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Título + descrição */}
      <fieldset>
        <legend className="font-display font-bold text-fs-18 text-navy mb-3">
          2. O que é?
        </legend>
        <div className="space-y-3">
          <label className="block">
            <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
              Título do anúncio
            </span>
            <input
              type="text"
              name="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="Ex.: Bicicleta aro 26 azul, semi-nova"
              className="w-full h-12 rounded-md border border-border-subtle bg-white px-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
              Descrição
            </span>
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="Estado de conservação, motivo da venda, condições de retirada…"
              className="w-full rounded-md border border-border-subtle bg-white p-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none resize-none"
            />
          </label>
        </div>
      </fieldset>

      {/* Categoria + bairro */}
      <fieldset>
        <legend className="font-display font-bold text-fs-18 text-navy mb-3">
          3. Onde encaixa?
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
              Categoria
            </span>
            <select
              name="category"
              defaultValue=""
              className="w-full h-12 rounded-md border border-border-subtle bg-white px-3 text-fs-15 text-navy focus:border-zimba-gold focus:outline-none"
            >
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
              Bairro
            </span>
            <select
              name="bairro"
              required
              defaultValue=""
              className="w-full h-12 rounded-md border border-border-subtle bg-white px-3 text-fs-15 text-navy focus:border-zimba-gold focus:outline-none"
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
        </div>
      </fieldset>

      {/* Foto do item */}
      <fieldset>
        <legend className="font-display font-bold text-fs-18 text-navy mb-3">
          4. Tem foto?
        </legend>
        <div className="rounded-md border border-border-subtle bg-white p-4">
          <ImagePicker
            name="photo_url"
            scope="bazar"
            label="Foto do anúncio"
            hint="Anúncios com foto vendem 3x mais. Solte um arquivo, escolha do disco ou cole uma URL."
            aspect="square"
          />
        </div>
      </fieldset>

      {/* Preço + WhatsApp */}
      <fieldset>
        <legend className="font-display font-bold text-fs-18 text-navy mb-3">
          5. Quanto e como te chamam?
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
              Preço (só pra &ldquo;Vende&rdquo;)
            </span>
            <input
              type="text"
              name="price"
              placeholder="R$ 350"
              className="w-full h-12 rounded-md border border-border-subtle bg-white px-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
              WhatsApp (com DDD)
            </span>
            <input
              type="tel"
              name="whatsapp"
              required
              placeholder="(48) 99999-9999"
              className="w-full h-12 rounded-md border border-border-subtle bg-white px-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
            />
          </label>
        </div>
      </fieldset>

      {/* Email só pra guest */}
      {!isLoggedIn && (
        <fieldset>
          <legend className="font-display font-bold text-fs-18 text-navy mb-3">
            6. Seu email pra confirmar
          </legend>
          <label className="block">
            <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="voce@email.com"
              className="w-full h-12 rounded-md border border-border-subtle bg-white px-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
            />
          </label>
          <p className="mt-2 text-fs-12 text-ink-500 leading-relaxed max-w-[60ch]">
            Sem cadastro chato. Mandamos um link pro seu email — clica nele e o
            anúncio vai pro ar. Da próxima vez você nem precisa confirmar de
            novo.
          </p>
        </fieldset>
      )}

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

      {/* Submit */}
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
        Ao publicar você concorda em ser contatado por interessados e em
        retirar o anúncio quando o item for vendido. ZIMBANET pode remover
        anúncios fora das regras da comunidade.
      </p>
    </form>
  );
}
